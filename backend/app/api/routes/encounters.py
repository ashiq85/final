from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Any
from datetime import datetime
import logging
from app.db.base import get_db
from app.schemas import EncounterCreate, EncounterResponse, PrescriptionCreate, PrescriptionResponse
from app.api.routes.auth import get_current_user
from app.db.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/encounters", tags=["Encounters"])

@router.post("/{patient_id}", response_model=EncounterResponse)
async def create_encounter(
    patient_id: str,
    encounter: EncounterCreate,
    db: Any = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Document a new patient encounter"""
    if user.role != "doctor" and user.role != "admin":
        raise HTTPException(status_code=403, detail="Only doctors can document encounters")
        
    try:
        # Check if patient exists
        p_doc = db.collection("patients").document(patient_id).get()
        if not p_doc.exists:
            raise HTTPException(status_code=404, detail="Patient not found")
            
        encounter_data = encounter.model_dump()
        encounter_data["patient_id"] = patient_id
        encounter_data["doctor_id"] = user.id
        encounter_data["created_at"] = datetime.utcnow()
        encounter_data["prescriptions"] = []
        
        # Save to Firestore
        enc_ref = db.collection("encounters").document()
        enc_ref.set(encounter_data)
        
        # If there's a related appointment, mark it as completed
        if encounter.appointment_id:
            apt_ref = db.collection("appointments").document(encounter.appointment_id)
            if apt_ref.get().exists:
                apt_ref.update({"status": "completed"})
                
        # Also create a Medical Record entry for historical timeline
        mr_data = {
            "patient_id": patient_id,
            "visit_date": datetime.utcnow(),
            "chief_complaint": "Follow-up / Encounter",
            "diagnosis": ", ".join(encounter.diagnoses),
            "treatment_plan": encounter.treatment_plan,
            "created_by": user.id,
            "created_at": datetime.utcnow()
        }
        db.collection("medical_records").document().set(mr_data)

        response_data = encounter_data.copy()
        response_data["id"] = enc_ref.id
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating encounter: {e}")
        raise HTTPException(status_code=500, detail="Failed to create encounter")


@router.get("/{patient_id}", response_model=List[EncounterResponse])
async def get_patient_encounters(
    patient_id: str,
    db: Any = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get all past encounters for a patient"""
    # Allowed: Patient themselves, Doctor, Admin
    is_patient = user.role == "patient"
    
    if is_patient:
        # Verify patient owns this data
        p_doc = db.collection("patients").where("user_id", "==", user.id).get()
        if not p_doc or p_doc[0].id != patient_id:
            raise HTTPException(status_code=403, detail="Not authorized to view these encounters")

    try:
        encounters = []
        docs = db.collection("encounters").where("patient_id", "==", patient_id).stream()
        for doc in docs:
            d = doc.to_dict()
            d["id"] = doc.id
            encounters.append(d)
            
        # Sort by latest first
        encounters.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
        return encounters
    except Exception as e:
        logger.error(f"Error fetching encounters: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch encounters")


@router.post("/{encounter_id}/prescribe", response_model=PrescriptionResponse)
async def add_prescription(
    encounter_id: str,
    prescription: PrescriptionCreate,
    db: Any = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Add a prescription to an existing encounter"""
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can prescribe medication")
        
    try:
        enc_ref = db.collection("encounters").document(encounter_id)
        enc_doc = enc_ref.get()
        
        if not enc_doc.exists:
            raise HTTPException(status_code=404, detail="Encounter not found")
            
        enc_data = enc_doc.to_dict()
        
        # Security: ensure doctor owns this encounter
        if enc_data.get("doctor_id") != user.id:
            raise HTTPException(status_code=403, detail="Not authorized to modify this encounter")
            
        rx_data = prescription.model_dump()
        rx_data["id"] = f"rx_{int(datetime.now().timestamp())}"
        
        current_rx = enc_data.get("prescriptions", [])
        current_rx.append(rx_data)
        
        enc_ref.update({"prescriptions": current_rx})
        return rx_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding prescription: {e}")
        raise HTTPException(status_code=500, detail="Failed to add prescription")
