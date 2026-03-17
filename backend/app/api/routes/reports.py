from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from typing import List, Any, Optional
from app.db.base import get_db
from app.db.models import HealthReport, User, Patient, UserRole, MedicalRecord
from app.api.routes.auth import get_current_user
from app.core.rag_service import rag_service
from app.core.llm import get_llm
from app.utils.report_generator import generate_patient_report_pdf
import os
import json
from datetime import datetime

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/", response_model=dict)
async def generate_health_report(
    patient_id: str,
    report_type: str = "summary",
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate a health status report for a patient"""
    patient_doc = db.collection("patients").document(patient_id).get()
    if not patient_doc.exists:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient_data = patient_doc.to_dict()

    if current_user.role == UserRole.PATIENT:
        if patient_data.get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    user_doc = db.collection("users").document(patient_data.get("user_id", "")).get()
    patient_name = user_doc.to_dict().get("full_name", "Unknown") if user_doc.exists else "Unknown"

    # Fetch records without order_by to avoid missing index error
    records_docs = db.collection("medical_records")\
        .where("patient_id", "==", patient_id)\
        .stream()

    # Sort in memory
    recent_visits_raw = []
    for rdoc in records_docs:
        rd = rdoc.to_dict()
        rd['id'] = rdoc.id
        recent_visits_raw.append(rd)
    
    # Sort by visit_date DESC
    recent_visits_raw.sort(key=lambda x: str(x.get("visit_date", "")), reverse=True)
    
    recent_visits = []
    for rd in recent_visits_raw[:10]: # Limit to 10
        recent_visits.append({
            "date": str(rd.get("visit_date")),
            "diagnosis": rd.get("diagnosis"),
            "treatment": rd.get("treatment_plan")
        })

    report_data = {
        "patient_info": {
            "id": patient_doc.id,
            "name": patient_name,
            "date_of_birth": str(patient_data.get("date_of_birth")),
            "blood_type": patient_data.get("blood_type"),
            "gender": patient_data.get("gender")
        },
        "medical_history": patient_data.get("medical_history") or [],
        "allergies": patient_data.get("allergies") or [],
        "current_medications": patient_data.get("current_medications") or [],
        "recent_visits": recent_visits,
        "generated_at": datetime.utcnow().isoformat()
    }

    # Fetch recent health metrics
    try:
        metrics_docs = db.collection("health_metrics")\
            .where("patient_id", "==", patient_id)\
            .stream()
        
        metrics_raw = []
        for mdoc in metrics_docs:
            md = mdoc.to_dict()
            metrics_raw.append({
                "recorded_at": str(md.get("recorded_at")),
                "metric": md.get("metric_name"),
                "value": md.get("value"),
                "unit": md.get("unit"),
                "notes": md.get("notes")
            })
        
        # Sort by recorded_at DESC
        metrics_raw.sort(key=lambda x: str(x.get("recorded_at", "")), reverse=True)
        report_data["health_metrics"] = metrics_raw[:15] # Include last 15 readings
    except Exception as e:
        print(f"Failed to fetch health metrics for report: {e}")
        report_data["health_metrics"] = []

    doc_ref = db.collection("health_reports").document()
    
    health_report = HealthReport(
        patient_id=patient_id,
        report_type=report_type,
        report_data=report_data
    )
    
    # Optional: Mix in RAG insights (with fallback to raw excerpts if LLM is unavailable)
    try:
        rag_results = await rag_service.query_patient_records(
            patient_id,
            "Provide a concise clinical narrative summary of this patient's medical history, focusing on chronic conditions, major surgeries, and recent significant findings. Format as a cohesive medical summary."
        )
        if rag_results and "documents" in rag_results and len(rag_results["documents"][0]) > 0:
            doc_chunks = rag_results["documents"][0]
            context = "\n\n".join(doc_chunks)
            
            # Try AI synthesis first
            try:
                llm = get_llm()
                
                # 1. Synthesize general 'Insights from Documents'
                metrics_context = "\n".join([f"- {m['recorded_at'][:10]} {m['metric']}: {m['value']} {m['unit']}" for m in report_data.get("health_metrics", [])[:5]])
                history_context = ", ".join(report_data.get("medical_history", []))
                
                insight_prompt = f"""You are a senior medical consultant. Synthesize a professional 'Comprehensive Health Assessment' for the patient '{patient_name}'.

PATIENT PROFILE:
- Name: {patient_name}
- Medical History: {history_context}
- Recent Metrics:
{metrics_context}

DOCUMENT EXCERPTS (FOR CONTEXT):
{context}

INSIGHTS_INSTRUCTIONS:
1. Provide a cohesive, professional clinical narrative summarizing the patient's status.
2. Integrate and reconcile findings from the excerpts with the patient's known history and recent metrics. 
3. TRUST that all provided document excerpts belong to the patient '{patient_name}', even if they mention different names (e.g., 'John Doe') or placeholders. Assume these are the patient's records.
4. If there are conflicting findings, note them professionally.
5. Include a 'Clinical Assessment' and 'Recommended Next Steps' section.
6. Keep it concise but thorough.

Provide only the synthesized assessment. Match the patient's name as '{patient_name}' in your final output. """
                
                ai_summary = await llm.ainvoke(insight_prompt)
                report_data["ai_insights"] = ai_summary.content
                print(f"[RAG] AI synthesis succeeded for report of patient {patient_id}")
                
                # 2. If medical_history is empty, also synthesize a specific history summary
                if not report_data.get("medical_history") or len(report_data["medical_history"]) == 0:
                    history_prompt = f"You are a medical scribe. Based on the following medical record excerpts, write a concise bulleted medical history for the patient '{patient_name}'. NOTE: Trust that these excerpts belong to this patient even if names like 'John Doe' appear. Extract chronic conditions, surgeries, and significant past diagnoses. If NO relevant medical history is found at all, return exactly the word 'NONE' and nothing else.\n\nExcerpts:\n{context}"
                    history_summary = await llm.ainvoke(history_prompt)
                    content = history_summary.content.strip()
                    if content != "NONE":
                        synthesized_history = content.split('\n')
                        # Filter out empty lines or preamble
                        final_history = [h.strip().lstrip('*-• ') for h in synthesized_history if h.strip() and not h.lower().startswith('here is')]
                        if final_history:
                            report_data["medical_history"] = final_history

            except Exception as llm_error:
                # LLM failed (quota, model not found, etc.) — fall back to raw document excerpts
                err_msg = str(llm_error).lower()
                print(f"[RAG] LLM synthesis failed for report (will use excerpts): {llm_error}")
                
                # Build a brief note if AI fails
                if "resource_exhausted" in err_msg or "429" in err_msg:
                    note = "AI synthesis unavailable (API quota reached)."
                elif "not_found" in err_msg or "404" in err_msg:
                    note = "AI model not found. Please check configuration."
                else:
                    note = "AI synthesis failed for this report."
                
                report_data["ai_insights"] = note

            # Update report_data in the model
            health_report.report_data = report_data

    except Exception as e:
        print(f"RAG insights gathering failed for report: {e}")

    # Generate PDF
    REPORTS_DIR = "app/static/reports"
    os.makedirs(REPORTS_DIR, exist_ok=True)
    pdf_filename = f"report_{doc_ref.id}.pdf"
    pdf_path = f"{REPORTS_DIR}/{pdf_filename}"
    
    try:
        generate_patient_report_pdf(report_data, pdf_path)
        # Update model with PDF path
        health_report.pdf_path = pdf_path
    except Exception as e:
        print(f"PDF generation failed: {e}")

    doc_ref.set(health_report.to_firestore())

    return {
        "id": doc_ref.id, 
        "report_data": report_data, 
        "pdf_url": f"/static/reports/{pdf_filename}",
        "message": "Report generated successfully"
    }


@router.get("/patient/{patient_id}", response_model=List[dict])
def get_patient_reports(
    patient_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all health reports for a patient"""
    patient_doc = db.collection("patients").document(patient_id).get()
    if not patient_doc.exists:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user.role == UserRole.PATIENT:
        if patient_doc.to_dict().get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    docs = db.collection("health_reports")\
        .where("patient_id", "==", patient_id)\
        .stream()

    results = []
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        results.append(data)
    
    # Sort by created_at DESC in memory
    results.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
    return results


@router.get("/{report_id}", response_model=dict)
def get_report(
    report_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific health report"""
    doc = db.collection("health_reports").document(report_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Report not found")

    data = doc.to_dict()
    data['id'] = doc.id

    if current_user.role == UserRole.PATIENT:
        patient_doc = db.collection("patients").document(data.get("patient_id", "")).get()
        if not patient_doc.exists or patient_doc.to_dict().get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    return data


@router.get("/{report_id}/pdf")
def download_report_pdf(
    report_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download health report as PDF"""
    doc = db.collection("health_reports").document(report_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Report not found")

    data = doc.to_dict()

    if current_user.role == UserRole.PATIENT:
        patient_doc = db.collection("patients").document(data.get("patient_id", "")).get()
        if not patient_doc.exists or patient_doc.to_dict().get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    pdf_path = data.get("pdf_path")
    if not pdf_path:
        raise HTTPException(status_code=404, detail="PDF not generated yet")

    return FileResponse(pdf_path, media_type="application/pdf", filename=f"health_report_{report_id}.pdf")

@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a specific health report"""
    doc_ref = db.collection("health_reports").document(report_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Report not found")

    data = doc.to_dict()

    if current_user.role == UserRole.PATIENT:
        # Check authorization (if we want patients to delete their own reports, or maybe only doctors should)
        patient_doc = db.collection("patients").document(data.get("patient_id", "")).get()
        if not patient_doc.exists or patient_doc.to_dict().get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role != UserRole.DOCTOR and current_user.role != UserRole.ADMIN:
         raise HTTPException(status_code=403, detail="Not authorized to delete reports")

    # Optional: Delete the PDF file from the server if it exists
    pdf_path = data.get("pdf_path")
    if pdf_path and os.path.exists(pdf_path):
        try:
            os.remove(pdf_path)
            print(f"Deleted report PDF: {pdf_path}")
        except Exception as e:
            print(f"Failed to delete report PDF {pdf_path}: {e}")

    # Delete the document from Firestore
    doc_ref.delete()
    return None
