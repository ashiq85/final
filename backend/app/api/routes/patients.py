from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from typing import List, Optional, Any, Dict
from datetime import datetime
from app.db.base import get_db
from app.db.models import Patient, User, UserRole, HealthMetric, HealthReport
from app.schemas import PatientCreate, PatientUpdate, PatientResponse, UserCreate, HealthMetricCreate, HealthMetricResponse
from app.core.llm import get_llm
from app.api.routes.auth import get_current_user
from app.core.security import get_password_hash
import random
import string
import logging
from firebase_admin import auth as firebase_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/patients", tags=["Patients"])


def generate_medical_id(db: Any) -> str:
    """Generate a unique medical ID in the format AH-XXXXX"""
    while True:
        digits = ''.join(random.choices(string.digits, k=5))
        medical_id = f"AH-{digits}"
        # Firestore check
        docs = db.collection("patients").where("medical_id", "==", medical_id).limit(1).stream()
        if not any(docs):
            return medical_id


@router.get("/search", response_model=List[PatientResponse])
async def search_patients(
    query: Optional[str] = Query(None, description="Search by name, email, or ID"),
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search patients by name, email, or ID (Admin/Doctor only)"""
    if current_user.role not in [UserRole.ADMIN, UserRole.DOCTOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to search patients"
        )
    
    if not query:
        return []
    
    # Firestore doesn't support complex OR/ILike queries well without a search index
    # We'll do a simple match on medical_id first, then maybe full_name if possible
    results = []
    
    # Search by medical_id (exact match for simplicity in this migration step)
    docs = db.collection("patients").where("medical_id", "==", query).stream()
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        results.append(PatientResponse(**data))
    
    # If no results, try matching name (exact match)
    if not results:
        user_docs = db.collection("users").where("full_name", "==", query).stream()
        for u_doc in user_docs:
            p_docs = db.collection("patients").where("user_id", "==", u_doc.id).stream()
            for p_doc in p_docs:
                data = p_doc.to_dict()
                data['id'] = p_doc.id
                
                # Attach user data
                user_data = u_doc.to_dict()
                user_data['id'] = u_doc.id
                data['user'] = user_data
                
                results.append(PatientResponse(**data))
    else:
        # If we got results by medical_id, we still need to attach user data
        for i, res in enumerate(results):
            if not getattr(res, 'user', None):
                user_doc = db.collection("users").document(res.user_id).get()
                if user_doc.exists:
                    user_data = user_doc.to_dict()
                    user_data['id'] = user_doc.id
                    # Update the result in the list
                    data = res.model_dump()
                    data['user'] = user_data
                    results[i] = PatientResponse(**data)

    return results


@router.get("/me", response_model=PatientResponse)
async def get_my_patient_profile(
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's patient profile"""
    if current_user.role != UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can access this endpoint"
        )
    
    docs = db.collection("patients").where("user_id", "==", current_user.id).limit(1).stream()
    patient_doc = None
    for doc in docs:
        patient_doc = doc
        break
        
    if not patient_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found"
        )
    
    data = patient_doc.to_dict()
    data['id'] = patient_doc.id
    return PatientResponse(**data)


@router.post("/", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient_data: PatientCreate,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new patient profile"""
    # Check if patient profile already exists
    docs = db.collection("patients").where("user_id", "==", patient_data.user_id).limit(1).stream()
    if any(docs):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Patient profile already exists for this user"
        )
    
    medical_id = generate_medical_id(db)
    patient = Patient(
        **patient_data.model_dump(),
        medical_id=medical_id,
        email=patient_data.email
    )
    
    doc_ref = db.collection("patients").document()
    doc_ref.set(patient.to_firestore())
    patient.id = doc_ref.id
    
    return patient


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get patient by ID"""
    doc_ref = db.collection("patients").document(patient_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
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
            
    return PatientResponse(**data)


@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: str,
    patient_data: PatientUpdate,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update patient information"""
    doc_ref = db.collection("patients").document(patient_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    update_data = patient_data.model_dump(exclude_unset=True)
    if update_data:
        doc_ref.update(update_data)
    
    final_doc = doc_ref.get()
    data = final_doc.to_dict()
    data['id'] = final_doc.id
    return PatientResponse(**data)


@router.get("/", response_model=List[PatientResponse])
async def list_patients(
    skip: int = 0,
    limit: int = 100,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all patients (admin/doctor only)"""
    if current_user.role not in [UserRole.ADMIN, UserRole.DOCTOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view all patients"
        )
    
    docs = db.collection("patients").limit(limit).stream()
    results = []
    
    # Pre-fetch all user info to avoid N+1 querying 
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        
        # Manually fetch the corresponding user profile!
        user_id = data.get('user_id')
        if user_id:
            user_doc = db.collection("users").document(user_id).get()
            if user_doc.exists:
                user_data = user_doc.to_dict()
                user_data['id'] = user_doc.id
                data['user'] = user_data
                
        results.append(PatientResponse(**data))
    
    return results


@router.post("/register", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def doctor_create_patient(
    user_data: UserCreate,
    patient_data: PatientCreate,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Doctor/Admin-initiated patient account creation"""
    if current_user.role not in [UserRole.DOCTOR, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors and admins can create patient accounts"
        )
    
    # Check if email already exists
    docs = db.collection("users").where("email", "==", user_data.email).limit(1).stream()
    if any(docs):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user account in Firebase Auth
    try:
        # Check if user already exists in Firebase Auth to prevent errors
        try:
            firebase_user = firebase_auth.get_user_by_email(user_data.email)
            firebase_uid = firebase_user.uid
        except firebase_auth.UserNotFoundError:
            firebase_user = firebase_auth.create_user(
                email=user_data.email,
                password=user_data.password,
                display_name=user_data.full_name
            )
            firebase_uid = firebase_user.uid
    except Exception as e:
        logger.error(f"Failed to create Firebase Auth user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Firebase authentication account: {str(e)}"
        )

    # Continue with custom JWT logic for now, but link the Firestore doc ID to the Firebase UID
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        role=UserRole.PATIENT,
        hashed_password=hashed_password,
        is_active=True
    )
    
    # We use the firebase_uid as the document ID in Firestore for consistency!
    user_ref = db.collection("users").document(firebase_uid)
    user_ref.set(new_user.to_firestore())
    new_user.id = firebase_uid
    
    # Create patient profile
    patient = Patient(
        user_id=new_user.id,
        primary_doctor_id=current_user.id,
        medical_id=generate_medical_id(db),
        email=new_user.email,
        **patient_data.model_dump(exclude={"user_id", "primary_doctor_id", "email"})
    )
    
    patient_ref = db.collection("patients").document()
    patient_ref.set(patient.to_firestore())
    patient.id = patient_ref.id
    
    return patient


@router.put("/{patient_id}/assign-doctor/{doctor_id}", response_model=PatientResponse)
async def assign_doctor(
    patient_id: str,
    doctor_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Assign a primary doctor to a patient (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can assign doctors to patients"
        )
    
    patient_ref = db.collection("patients").document(patient_id)
    if not patient_ref.get().exists:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    doctor_doc = db.collection("users").document(doctor_id).get()
    if not doctor_doc.exists or doctor_doc.to_dict().get("role") != UserRole.DOCTOR:
        raise HTTPException(status_code=404, detail="Doctor not found")
        
    patient_ref.update({"primary_doctor_id": doctor_id})
    
    updated = patient_ref.get()
    data = updated.to_dict()
    data['id'] = updated.id
    return PatientResponse(**data)


@router.get("/{patient_id}/health-metrics", response_model=List[HealthMetricResponse])
async def get_health_metrics(
    patient_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get health metrics for a specific patient"""
    # Check permissions
    if current_user.role == UserRole.PATIENT:
        # Need to find patient by user_id
        docs = db.collection("patients").where("user_id", "==", current_user.id).limit(1).stream()
        p_doc = None
        for d in docs: p_doc = d
        if not p_doc or p_doc.id != patient_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    metrics_docs = db.collection("health_metrics")\
        .where("patient_id", "==", patient_id)\
        .stream()
        
    results = []
    for doc in metrics_docs:
        data = doc.to_dict()
        data['id'] = doc.id
        results.append(HealthMetricResponse(**data))
    
    # Sort in-memory to avoid index requirement
    results.sort(key=lambda x: str(x.recorded_at), reverse=True)
    return results


@router.post("/{patient_id}/health-metrics", response_model=HealthMetricResponse)
async def log_health_metric(
    patient_id: str,
    metric_data: HealthMetricCreate,
    background_tasks: BackgroundTasks,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Log a new health metric for a patient"""
    # Confirm patient exists
    p_doc = db.collection("patients").document(patient_id).get()
    if not p_doc.exists:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    # Check permissions
    if current_user.role == UserRole.PATIENT:
        if p_doc.to_dict().get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
            
    metric = HealthMetric(
        patient_id=patient_id,
        **metric_data.model_dump()
    )
    
    metric_ref = db.collection("health_metrics").document()
    metric_ref.set(metric.to_firestore())
    metric.id = metric_ref.id
    
    # Trigger background AI analysis
    background_tasks.add_task(
        _generate_health_analysis,
        db=db,
        patient_id=patient_id,
        metric_name=metric.metric_name,
        value=metric.value,
        unit=metric.unit
    )
    
    return metric


async def _generate_health_analysis(db: Any, patient_id: str, metric_name: str, value: float, unit: str):
    """Generate AI analysis for a newly logged health metric"""
    try:
        # Fetch patient info for context
        p_doc = db.collection("patients").document(patient_id).get()
        p_data = p_doc.to_dict() if p_doc.exists else {}
        
        # Prepare prompt
        prompt = f"""You are a clinical analyst. A patient has logged a new health metric.
        Metric: {metric_name}
        Value: {value} {unit}
        Patient Context: {p_data.get('medical_history', 'No history available')}
        
        Provide a concise clinical interpretation (2-3 sentences) of this value.
        Then provide 2-3 specific health recommendations.
        
        Respond with raw text in this format:
        INTERPRETATION: [text]
        RECOMMENDATIONS: [bullet points]
        """
        
        llm = get_llm()
        response = llm.invoke(prompt)
        content = response.content.strip()
        
        # Parse or just store as dict
        interpretation = "Analysis complete."
        recommendations = []
        
        if "INTERPRETATION:" in content:
            parts = content.split("RECOMMENDATIONS:")
            interpretation = parts[0].replace("INTERPRETATION:", "").strip()
            if len(parts) > 1:
                recommendations = [r.strip("- ").strip() for r in parts[1].strip().split("\n") if r.strip()]

        report = HealthReport(
            patient_id=patient_id,
            report_type="AI Health Insight",
            report_data={
                "metric": metric_name,
                "value": value,
                "unit": unit,
                "interpretation": interpretation,
                "recommendations": recommendations,
                "timestamp": datetime.utcnow().isoformat()
            },
            created_at=datetime.utcnow()
        )
        
        db.collection("health_reports").document().set(report.to_firestore())
        logger.info(f"Generated health report for patient {patient_id}")
        
    except Exception as e:
        logger.error(f"Failed to generate health analysis: {e}")


@router.get("/{patient_id}/medical-records", response_model=List[Dict[str, Any]])
async def get_medical_records(
    patient_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a patient's medical records"""
    # Verify access
    if current_user.role == UserRole.PATIENT:
        p_doc = db.collection("patients").where("user_id", "==", current_user.id).limit(1).stream()
        p_id = None
        for d in p_doc: p_id = d.id
        if p_id != patient_id:
            raise HTTPException(status_code=403, detail="Not authorized")
            
    docs = db.collection("medical_records")\
        .where("patient_id", "==", patient_id)\
        .stream()
        
    results = []
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        results.append(data)
    
    # Sort in-memory to avoid index requirement
    results.sort(key=lambda x: str(x.get("visit_date", "")), reverse=True)
    return results[:50]
