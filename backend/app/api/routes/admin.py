from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Any, Optional
from app.db.base import get_db
from app.db.models import User, UserRole, Patient
from app.schemas import UserCreate, UserResponse, PatientResponse
from app.api.routes.auth import get_current_user
from app.core.security import get_password_hash

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
    
    hashed_password = get_password_hash(doctor_data.password)
    new_doctor = User(
        email=doctor_data.email,
        full_name=doctor_data.full_name,
        role=UserRole.DOCTOR,
        hashed_password=hashed_password,
        is_active=True
    )
    
    doc_ref = db.collection("users").document()
    doc_ref.set(new_doctor.to_firestore())
    new_doctor.id = doc_ref.id
    
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
