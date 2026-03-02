from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Any, Optional
from app.db.base import get_db
from app.db.models import Alert, User, Patient, AlertSeverity, UserRole
from app.api.routes.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("/", response_model=dict)
def create_alert_endpoint(
    patient_id: str,
    severity: AlertSeverity,
    title: str,
    description: Optional[str] = None,
    recommended_actions: Optional[List[str]] = None,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new alert"""
    patient_doc = db.collection("patients").document(patient_id).get()
    if not patient_doc.exists:
        raise HTTPException(status_code=404, detail="Patient not found")

    alert = Alert(
        patient_id=patient_id,
        severity=severity,
        title=title,
        description=description,
        recommended_actions=recommended_actions or []
    )
    doc_ref = db.collection("alerts").document()
    doc_ref.set(alert.to_firestore())
    alert.id = doc_ref.id

    return {"id": alert.id, "message": "Alert created successfully"}


@router.post("/emergency", response_model=dict)
async def trigger_emergency_alert(
    patient_id: str,
    emergency_type: str,
    symptoms: List[str],
    vital_signs: Optional[dict] = None,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger an emergency alert for critical health conditions"""
    patient_doc = db.collection("patients").document(patient_id).get()
    if not patient_doc.exists:
        raise HTTPException(status_code=404, detail="Patient not found")

    alert = Alert(
        patient_id=patient_id,
        severity=AlertSeverity.CRITICAL,
        title=f"EMERGENCY: {emergency_type.replace('_', ' ').title()}",
        description=f"Emergency detected: {', '.join(symptoms)}",
        recommended_actions=[
            "Call emergency services immediately (911)",
            "Do not leave patient alone",
            "Follow emergency protocol guidance"
        ]
    )
    doc_ref = db.collection("alerts").document()
    doc_ref.set(alert.to_firestore())

    return {"id": doc_ref.id, "message": "Emergency alert triggered"}


@router.get("/", response_model=List[dict])
def get_alerts(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get alerts based on user role"""
    query = db.collection("alerts")

    if active_only:
        query = query.where("is_resolved", "==", False)

    if current_user.role == UserRole.PATIENT:
        p_docs = db.collection("patients").where("user_id", "==", current_user.id).limit(1).stream()
        patient_doc = None
        for d in p_docs:
            patient_doc = d
        if not patient_doc:
            return []
        query = query.where("patient_id", "==", patient_doc.id)

    try:
        from firebase_admin import firestore
        q = query.order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit + skip)
        docs = q.stream()
        results = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            results.append(data)
        return results[skip:skip+limit]
    except Exception as e:
        docs = query.stream()
        results = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            results.append(data)
        results.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
        return results[skip : skip + limit]


@router.get("/{alert_id}", response_model=dict)
def get_alert(
    alert_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific alert"""
    doc = db.collection("alerts").document(alert_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Alert not found")

    data = doc.to_dict()
    data['id'] = doc.id

    if current_user.role == UserRole.PATIENT:
        p_docs = db.collection("patients").where("user_id", "==", current_user.id).limit(1).stream()
        patient_doc = None
        for d in p_docs:
            patient_doc = d
        if not patient_doc or data.get("patient_id") != patient_doc.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    return data


@router.put("/{alert_id}/resolve")
def resolve_alert(
    alert_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Resolve an alert"""
    doc_ref = db.collection("alerts").document(alert_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Alert not found")

    if current_user.role == UserRole.PATIENT:
        raise HTTPException(status_code=403, detail="Not authorized")

    doc_ref.update({
        "is_resolved": True,
        "resolved_at": datetime.utcnow()
    })

    return {"message": "Alert resolved successfully"}
