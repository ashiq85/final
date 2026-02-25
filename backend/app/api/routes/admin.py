from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Any, Optional
from app.db.base import get_db
from app.db.models import User, UserRole, Patient
from app.schemas import UserCreate, UserResponse, PatientResponse
from app.api.routes.auth import get_current_user
from app.core.security import get_password_hash
from firebase_admin import auth as firebase_auth
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


async def require_admin(current_user: User = Depends(get_current_user)):
    """Dependency to require admin role"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


@router.post("/doctors", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_doctor(
    doctor_data: UserCreate,
    db: Any = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Admin endpoint to create a new doctor account"""
    if doctor_data.role != UserRole.DOCTOR:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is for creating doctor accounts only"
        )
    
    # Check if email already exists
    docs = db.collection("users").where("email", "==", doctor_data.email).limit(1).stream()
    if any(docs):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user account in Firebase Auth
    try:
        try:
            firebase_user = firebase_auth.get_user_by_email(doctor_data.email)
            firebase_uid = firebase_user.uid
        except firebase_auth.UserNotFoundError:
            firebase_user = firebase_auth.create_user(
                email=doctor_data.email,
                password=doctor_data.password,
                display_name=doctor_data.full_name
            )
            firebase_uid = firebase_user.uid
    except Exception as e:
        logger.error(f"Failed to create Firebase Auth user for Doctor: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Firebase authentication account: {str(e)}"
        )

    hashed_password = get_password_hash(doctor_data.password)
    new_doctor = User(
        email=doctor_data.email,
        full_name=doctor_data.full_name,
        role=UserRole.DOCTOR,
        hashed_password=hashed_password,
        is_active=True
    )
    
    # Use Firebase UID as Firestore Document ID
    doc_ref = db.collection("users").document(firebase_uid)
    doc_ref.set(new_doctor.to_firestore())
    new_doctor.id = firebase_uid
    
    return new_doctor


@router.get("/doctors", response_model=List[UserResponse])
async def get_all_doctors(
    db: Any = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get all doctors in the system"""
    docs = db.collection("users").where("role", "==", UserRole.DOCTOR).stream()
    results = []
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        results.append(UserResponse(**data))
    return results


@router.put("/doctors/{doctor_id}/deactivate")
async def deactivate_doctor(
    doctor_id: str,
    db: Any = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Deactivate a doctor account"""
    doc_ref = db.collection("users").document(doctor_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("role") != UserRole.DOCTOR:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
    
    doc_ref.update({"is_active": False})
    return {"message": "Doctor deactivated successfully"}


@router.put("/doctors/{doctor_id}/activate")
async def activate_doctor(
    doctor_id: str,
    db: Any = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Activate a doctor account"""
    doc_ref = db.collection("users").document(doctor_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("role") != UserRole.DOCTOR:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
    
    doc_ref.update({"is_active": True})
    return {"message": "Doctor activated successfully"}


@router.get("/patients", response_model=List[PatientResponse])
async def get_all_patients(
    db: Any = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get all patients in the system"""
    docs = db.collection("patients").stream()
    results = []
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        
        # Attach user data
        user_id = data.get('user_id')
        if user_id:
            user_doc = db.collection("users").document(user_id).get()
            if user_doc.exists:
                user_data = user_doc.to_dict()
                user_data['id'] = user_doc.id
                data['user'] = user_data
        
        results.append(PatientResponse(**data))
    return results


@router.put("/patients/{patient_id}/deactivate")
async def deactivate_patient(
    patient_id: str,
    db: Any = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Deactivate a patient account"""
    patient_doc = db.collection("patients").document(patient_id).get()
    if not patient_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    user_id = patient_doc.to_dict().get("user_id")
    if user_id:
        db.collection("users").document(user_id).update({"is_active": False})
    
    return {"message": "Patient deactivated successfully"}


@router.get("/users", response_model=List[UserResponse])
async def get_all_users(
    role: Optional[UserRole] = None,
    db: Any = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get all users, optionally filtered by role"""
    query = db.collection("users")
    if role:
        query = query.where("role", "==", role)
    
    docs = query.stream()
    results = []
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        results.append(UserResponse(**data))
    return results


@router.get("/stats")
async def get_system_stats(
    db: Any = Depends(get_db),
    admin: User = Depends(get_current_user) # Allow doctors to see some stats too? Maybe just for admin dashboard
):
    """Get summary statistics for the dashboard"""
    # Simple count for users by role
    doctors_docs = db.collection("users").where("role", "==", UserRole.DOCTOR).stream()
    doctors_count = sum(1 for _ in doctors_docs)
    
    patients_docs = db.collection("patients").stream()
    patients_count = sum(1 for _ in patients_docs)
    
    alerts_docs = db.collection("alerts").where("is_resolved", "==", False).stream()
    alerts_count = sum(1 for _ in alerts_docs)
    
    # Mocking pending visits for now as appointments count
    visits_docs = db.collection("appointments").stream()
    visits_count = sum(1 for _ in visits_docs)
    
    return {
        "total_doctors": doctors_count,
        "total_patients": patients_count,
        "active_alerts": alerts_count,
        "pending_visits": visits_count
    }
