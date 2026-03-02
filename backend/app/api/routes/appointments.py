from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Any, Optional
from datetime import datetime
from app.db.base import get_db
from app.db.models import Appointment, User, Patient, AppointmentStatus, UserRole, Notification
from app.api.routes.auth import get_current_user
from app.schemas import AppointmentCreate, AppointmentUpdate, AppointmentResponse, AppointmentRescheduleSchema, UserBasic, PatientBasic

router = APIRouter(prefix="/appointments", tags=["appointments"])


def _load_appointment_data(db: Any, appointment_id: str) -> Optional[dict]:
    """Helper to load appointment with related doctor and patient data for Firestore."""
    app_doc = db.collection("appointments").document(appointment_id).get()
    if not app_doc.exists:
        return None
    
    app_data = app_doc.to_dict()
    app_data['id'] = app_doc.id
    
    # Fetch Doctor
    doc_user = db.collection("users").document(app_data['doctor_id']).get()
    if doc_user.exists:
        u_data = doc_user.to_dict()
        u_data['id'] = doc_user.id
        app_data['doctor'] = u_data
        
    # Fetch Patient
    p_doc = db.collection("patients").document(app_data['patient_id']).get()
    if p_doc.exists:
        p_data = p_doc.to_dict()
        p_data['id'] = p_doc.id
        
        # Fetch Patient User
        p_user = db.collection("users").document(p_data['user_id']).get()
        if p_user.exists:
            pu_data = p_user.to_dict()
            pu_data['id'] = p_user.id
            p_data['user'] = pu_data
        app_data['patient'] = p_data
        
    return app_data


@router.post("/{appointment_id}/request-reschedule", response_model=AppointmentResponse)
async def request_reschedule(
    appointment_id: str,
    reschedule: AppointmentRescheduleSchema,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Request to reschedule an appointment (Patient only)"""
    doc_ref = db.collection("appointments").document(appointment_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    app_data = doc.to_dict()
    
    if current_user.role != UserRole.PATIENT:
        raise HTTPException(status_code=403, detail="Only patients can request rescheduling")
    
    # Verify patient ownership
    p_docs = db.collection("patients").where("user_id", "==", current_user.id).limit(1).stream()
    patient_doc = None
    for d in p_docs: patient_doc = d
    
    if not patient_doc or app_data['patient_id'] != patient_doc.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    doc_ref.update({
        "requested_new_date": reschedule.requested_new_date,
        "status": AppointmentStatus.RESCHEDULE_REQUESTED
    })
    
    # Create notification for doctor
    notification = Notification(
        user_id=app_data['doctor_id'],
        notification_type="appointment",
        title="Reschedule Request",
        message=f"Patient {current_user.full_name} has requested to reschedule an appointment to {reschedule.requested_new_date}.",
        appointment_id=appointment_id
    )
    db.collection("notifications").document().set(notification.to_firestore())
    
    return _load_appointment_data(db, appointment_id)


@router.post("/{appointment_id}/approve-reschedule", response_model=AppointmentResponse)
async def approve_reschedule(
    appointment_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve a reschedule request (Doctor/Admin only)"""
    doc_ref = db.collection("appointments").document(appointment_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    app_data = doc.to_dict()
    
    if current_user.role not in [UserRole.DOCTOR, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only doctors or admins can approve rescheduling")
    
    if app_data.get("status") != AppointmentStatus.RESCHEDULE_REQUESTED or not app_data.get("requested_new_date"):
        raise HTTPException(status_code=400, detail="No reschedule request pending")
    
    old_date = app_data['appointment_date']
    new_date = app_data['requested_new_date']
    
    doc_ref.update({
        "appointment_date": new_date,
        "requested_new_date": None,
        "status": AppointmentStatus.SCHEDULED
    })
    
    # Get patient user_id
    p_doc = db.collection("patients").document(app_data['patient_id']).get()
    if p_doc.exists:
        patient_user_id = p_doc.to_dict().get("user_id")
        notification = Notification(
            user_id=patient_user_id,
            notification_type="appointment",
            title="Reschedule Approved",
            message=f"Your reschedule request for {old_date} has been approved. New date: {new_date}.",
            appointment_id=appointment_id
        )
        db.collection("notifications").document().set(notification.to_firestore())

    return _load_appointment_data(db, appointment_id)


@router.post("/{appointment_id}/reject-reschedule", response_model=AppointmentResponse)
async def reject_reschedule(
    appointment_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reject a reschedule request (Doctor/Admin only)"""
    doc_ref = db.collection("appointments").document(appointment_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    app_data = doc.to_dict()
    
    if current_user.role not in [UserRole.DOCTOR, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only doctors or admins can reject rescheduling")
    
    if app_data.get("status") != AppointmentStatus.RESCHEDULE_REQUESTED:
        raise HTTPException(status_code=400, detail="No reschedule request pending")
    
    doc_ref.update({
        "requested_new_date": None,
        "status": AppointmentStatus.SCHEDULED
    })
    
    # Get patient user_id
    p_doc = db.collection("patients").document(app_data['patient_id']).get()
    if p_doc.exists:
        patient_user_id = p_doc.to_dict().get("user_id")
        notification = Notification(
            user_id=patient_user_id,
            notification_type="appointment",
            title="Reschedule Rejected",
            message=f"Your reschedule request for {app_data['appointment_date']} was rejected. Please contact the clinic.",
            appointment_id=appointment_id
        )
        db.collection("notifications").document().set(notification.to_firestore())
        
    return _load_appointment_data(db, appointment_id)


@router.get("/doctors", response_model=List[UserBasic])
async def get_doctors(
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of all active doctors (accessible to all roles for booking)"""
    docs = db.collection("users")\
        .where("role", "==", UserRole.DOCTOR)\
        .where("is_active", "==", True)\
        .stream()
    
    results = []
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        results.append(UserBasic(**data))
    return results


@router.post("/", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    appointment: AppointmentCreate,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new appointment"""
    # If patient is booking for themselves, resolve patient_id automatically
    if current_user.role == UserRole.PATIENT:
        p_docs = db.collection("patients").where("user_id", "==", current_user.id).limit(1).stream()
        patient_doc = None
        for d in p_docs: patient_doc = d
        if not patient_doc:
            raise HTTPException(status_code=404, detail="Patient profile not found. Contact your doctor.")
        appointment.patient_id = patient_doc.id

    # Verify patient exists
    p_doc = db.collection("patients").document(appointment.patient_id).get()
    if not p_doc.exists:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Verify doctor exists and has doctor role
    d_doc = db.collection("users").document(appointment.doctor_id).get()
    if not d_doc.exists or d_doc.to_dict().get("role") != UserRole.DOCTOR:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    db_appointment = Appointment(
        patient_id=appointment.patient_id,
        doctor_id=appointment.doctor_id,
        appointment_date=appointment.appointment_date,
        duration_minutes=appointment.duration_minutes,
        reason=appointment.reason,
    )
    
    doc_ref = db.collection("appointments").document()
    doc_ref.set(db_appointment.to_firestore())
    
    return _load_appointment_data(db, doc_ref.id)


@router.get("/", response_model=List[AppointmentResponse])
async def get_appointments(
    skip: int = 0,
    limit: int = 100,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get appointments based on user role"""
    query = db.collection("appointments")

    if current_user.role == UserRole.ADMIN:
        docs = query.stream()
    elif current_user.role == UserRole.DOCTOR:
        docs = query.where("doctor_id", "==", current_user.id).stream()
    else:  # Patient
        p_docs = db.collection("patients").where("user_id", "==", current_user.id).limit(1).stream()
        patient_doc = None
        for d in p_docs: patient_doc = d
        if not patient_doc:
            return []
        docs = query.where("patient_id", "==", patient_doc.id).stream()
    
    results = []
    
    # In-memory caching for related entities to prevent N+1 queries
    cache = {'doctors': {}, 'patients': {}, 'users': {}}
    
    def fetch_with_cache(doc):
        app_data = doc.to_dict()
        app_data['id'] = doc.id
        
        doc_id = app_data.get('doctor_id')
        if doc_id and doc_id not in cache['doctors']:
            doc_user = db.collection("users").document(doc_id).get()
            if doc_user.exists:
                u_data = doc_user.to_dict()
                u_data['id'] = doc_user.id
                cache['doctors'][doc_id] = u_data
            else:
                cache['doctors'][doc_id] = None
        app_data['doctor'] = cache['doctors'].get(doc_id)
            
        pat_id = app_data.get('patient_id')
        if pat_id and pat_id not in cache['patients']:
            p_doc = db.collection("patients").document(pat_id).get()
            if p_doc.exists:
                p_data = p_doc.to_dict()
                p_data['id'] = p_doc.id
                p_user_id = p_data.get('user_id')
                if p_user_id and p_user_id not in cache['users']:
                    p_user = db.collection("users").document(p_user_id).get()
                    if p_user.exists:
                        pu_data = p_user.to_dict()
                        pu_data['id'] = p_user.id
                        cache['users'][p_user_id] = pu_data
                    else:
                        cache['users'][p_user_id] = None
                p_data['user'] = cache['users'].get(p_user_id)
                cache['patients'][pat_id] = p_data
            else:
                cache['patients'][pat_id] = None
                
        app_data['patient'] = cache['patients'].get(pat_id)
        return app_data

    for doc in docs:
        results.append(fetch_with_cache(doc))
    
    # Sort in-memory to ensure most recent/relevant are included
    valid_results = [r for r in results if r is not None]
    valid_results.sort(key=lambda x: str(x.get("appointment_date", "")), reverse=True)
    
    return valid_results[skip : skip + limit]


@router.get("/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific appointment"""
    app_data = _load_appointment_data(db, appointment_id)
    if not app_data:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    if current_user.role == UserRole.PATIENT:
        p_docs = db.collection("patients").where("user_id", "==", current_user.id).limit(1).stream()
        patient_doc = None
        for d in p_docs: patient_doc = d
        if not patient_doc or app_data['patient_id'] != patient_doc.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == UserRole.DOCTOR:
        if app_data['doctor_id'] != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    return app_data


@router.put("/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: str,
    appointment_update: AppointmentUpdate,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an appointment"""
    doc_ref = db.collection("appointments").document(appointment_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    app_data = doc.to_dict()
    
    if current_user.role == UserRole.PATIENT:
        p_docs = db.collection("patients").where("user_id", "==", current_user.id).limit(1).stream()
        patient_doc = None
        for d in p_docs: patient_doc = d
        if not patient_doc or app_data['patient_id'] != patient_doc.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == UserRole.DOCTOR:
        if app_data['doctor_id'] != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = appointment_update.model_dump(exclude_unset=True)
    if update_data:
        doc_ref.update(update_data)
        
    return _load_appointment_data(db, appointment_id)


@router.delete("/{appointment_id}")
async def cancel_appointment(
    appointment_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel an appointment"""
    doc_ref = db.collection("appointments").document(appointment_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    app_data = doc.to_dict()
    
    if current_user.role == UserRole.PATIENT:
        p_docs = db.collection("patients").where("user_id", "==", current_user.id).limit(1).stream()
        patient_doc = None
        for d in p_docs: patient_doc = d
        if not patient_doc or app_data['patient_id'] != patient_doc.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == UserRole.DOCTOR:
        if app_data['doctor_id'] != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    doc_ref.update({"status": AppointmentStatus.CANCELLED})
    return {"message": "Appointment cancelled successfully"}
