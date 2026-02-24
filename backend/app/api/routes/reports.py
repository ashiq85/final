from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from typing import List, Any, Optional
from app.db.base import get_db
from app.db.models import HealthReport, User, Patient, UserRole, MedicalRecord
from app.api.routes.auth import get_current_user
from datetime import datetime
import json

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/", response_model=dict)
def generate_health_report(
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

    records_docs = db.collection("medical_records")\
        .where("patient_id", "==", patient_id)\
        .order_by("visit_date", direction="DESCENDING")\
        .limit(10)\
        .stream()

    recent_visits = []
    for rdoc in records_docs:
        rd = rdoc.to_dict()
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

    health_report = HealthReport(
        patient_id=patient_id,
        report_type=report_type,
        report_data=report_data
    )
    doc_ref = db.collection("health_reports").document()
    doc_ref.set(health_report.to_firestore())

    return {"id": doc_ref.id, "report_data": report_data, "message": "Report generated successfully"}


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
        .order_by("created_at", direction="DESCENDING")\
        .stream()

    results = []
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        results.append(data)
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
