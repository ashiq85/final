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
                insight_prompt = f"You are a medical consultant. Synthesize these medical record excerpts into a concise, professional 'Insights from Documents' narrative summary.\n\nFindings:\n{context}\n\nProvide only the synthesized narrative summary."
                ai_summary = await llm.ainvoke(insight_prompt)
                report_data["ai_insights"] = ai_summary.content
                print(f"[RAG] AI synthesis succeeded for report of patient {patient_id}")
                
                # 2. If medical_history is empty, also synthesize a specific history summary
                if not report_data.get("medical_history") or len(report_data["medical_history"]) == 0:
                    history_prompt = f"You are a medical scribe. Based ONLY on the following medical record excerpts, write a concise bulleted medical history for this patient. If no history is found, return exactly the word 'NONE' and nothing else.\n\nExcerpts:\n{context}"
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
