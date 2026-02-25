from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from app.db.base import get_db
from app.db.models import User, Patient, HealthMetric, UserRole
from app.api.routes.auth import get_current_user
from app.schemas import SymptomAnalysisRequest, DiagnosisResponse, EmergencyAssessment
from app.agents.diagnosis_agent import analyze_symptoms as analyze_with_agent
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/diagnosis", tags=["diagnosis"])


def detect_stroke_symptoms(symptoms: list, vitals: dict) -> dict:
    stroke_indicators = {
        "face_drooping": False,
        "arm_weakness": False,
        "speech_difficulty": False,
    }
    for symptom in symptoms:
        s_low = symptom.lower()
        if any(w in s_low for w in ["face", "droop", "facial"]): stroke_indicators["face_drooping"] = True
        if any(w in s_low for w in ["arm", "weak", "numb"]): stroke_indicators["arm_weakness"] = True
        if any(w in s_low for w in ["speech", "slur", "confus"]): stroke_indicators["speech_difficulty"] = True
    
    is_emergency = any(stroke_indicators.values())
    return {
        "is_emergency": is_emergency,
        "condition": "Possible Stroke",
        "emergency_actions": ["CALL 108 IMMEDIATELY", "Note time symptoms started", "Do not give aspirin"] if is_emergency else []
    }

def detect_heart_attack(symptoms: list, vitals: dict) -> dict:
    chest_pain = any("chest" in s.lower() for s in symptoms)
    shortness_of_breath = any("breath" in s.lower() for s in symptoms)
    is_emergency = chest_pain or shortness_of_breath
    return {
        "is_emergency": is_emergency,
        "condition": "Possible Heart Attack",
        "emergency_actions": ["CALL 108 IMMEDIATELY", "Sit down and rest", "Loosen tight clothing"] if is_emergency else []
    }

def detect_cardiac_emergency(vitals: dict) -> dict:
    is_emergency = False
    if vitals and "blood_pressure" in vitals:
        bp = vitals["blood_pressure"]
        if isinstance(bp, dict):
            systolic = bp.get("systolic", 0)
            if systolic > 180 or systolic < 90: is_emergency = True
    return {
        "is_emergency": is_emergency,
        "condition": "Cardiac Emergency",
        "emergency_actions": ["CALL 108 IMMEDIATELY", "Monitor breathing", "Be ready for CPR"] if is_emergency else []
    }

def get_latest_metrics(db: Any, patient_id: str) -> Dict[str, float]:
    """Fetch the latest values for each metric type for a patient from Firestore"""
    docs = db.collection("health_metrics")\
        .where("patient_id", "==", patient_id)\
        .order_by("recorded_at", direction="DESCENDING")\
        .stream()
        
    latest = {}
    for doc in docs:
        m = doc.to_dict()
        if m["metric_name"] not in latest:
            latest[m["metric_name"]] = m["value"]
    return latest

@router.post("/analyze", response_model=DiagnosisResponse)
async def analyze_symptoms(
    request: SymptomAnalysisRequest,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Analyze symptoms and provide diagnosis suggestions"""
    # Detect emergencies
    vitals = request.vital_signs or {}
    stroke = detect_stroke_symptoms(request.symptoms, vitals)
    heart_attack = detect_heart_attack(request.symptoms, vitals)
    cardiac = detect_cardiac_emergency(vitals)
    
    emergency = None
    risk_level = "LOW"
    
    if stroke["is_emergency"]:
        emergency = EmergencyAssessment(
            is_emergency=True,
            condition=stroke["condition"],
            actions=stroke["emergency_actions"]
        )
        risk_level = "HIGH"
    elif heart_attack["is_emergency"]:
        emergency = EmergencyAssessment(
            is_emergency=True,
            condition=heart_attack["condition"],
            actions=heart_attack["emergency_actions"]
        )
        risk_level = "HIGH"
    elif cardiac["is_emergency"]:
        emergency = EmergencyAssessment(
            is_emergency=True,
            condition=cardiac["condition"],
            actions=cardiac["emergency_actions"]
        )
        risk_level = "HIGH"

    # For other symptoms, provide generic suggestions if not emergency
    potential_diagnosis = []
    recommendations = []
    
    # AI Agent Deep Analysis
    ai_result = {}
    p_id = request.patient_id
    
    # Try to resolve patient ID from user if not explicitly passed
    if current_user.role == UserRole.PATIENT and not p_id:
        p_doc = db.collection("patients").where("user_id", "==", getattr(current_user, 'id', None)).limit(1).stream()
        for d in p_doc: p_id = d.id
        
    try:
        ai_result = analyze_with_agent(
            patient_id=p_id or getattr(current_user, 'id', "anonymous"),
            symptoms=request.symptoms,
            vitals=vitals
        )
        # Merge AI results if they provide more insight
        if "potential_diagnosis" in ai_result:
            # Add unique diagnoses from AI
            for d in ai_result["potential_diagnosis"]:
                if d not in potential_diagnosis:
                    potential_diagnosis.append(d)
        
        if "recommendations" in ai_result:
            for r in ai_result["recommendations"]:
                if r not in recommendations:
                    recommendations.append(r)
        
    except Exception as e:
        logger.error(f"AI Analysis failed: {e}")

    # AI risk level takes precedence if higher
    risk_map = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
    ai_risk = ai_result.get("risk_level", "LOW")
    if risk_map.get(ai_risk, 0) > risk_map.get(risk_level, 0):
        risk_level = ai_risk
        
    # Guarantee we have at least one diagnosis and recommendation for the UI
    if not potential_diagnosis:
        potential_diagnosis.append(f"AI Quota Exceeded: Unable to determine diagnosis for symptoms.")
    if not recommendations:
        recommendations.append("Please consult a healthcare professional immediately for proper evaluation.")

    # Process Emergency Booking & Saving Record
    # We always have a current_user since it's an authenticated route
    use_id = p_id if (p_id and p_id != "anonymous") else current_user.id
    booked_appointment_id = None
    booked_doctor_name = None
    from datetime import datetime, timedelta
    
    # 1. Save to medical records
    record_data = {
        "patient_id": use_id,
        "visit_date": datetime.utcnow(),
        "symptoms": request.symptoms,
        "vitals": vitals,
        "diagnosis": ", ".join(potential_diagnosis) if potential_diagnosis else "Pending Analysis",
        "treatment_plan": ", ".join(recommendations) if recommendations else "N/A",
        "created_by": current_user.id
    }
    db.collection("medical_records").document().set(record_data)
    # 2. Handle emergency booking
    if risk_level in ["HIGH", "CRITICAL"]:
        # Basic text-matching for specialization
        specialization = "General Physician"
        sym_text = " ".join(request.symptoms).lower()
        diag_text = " ".join(potential_diagnosis).lower()
        combined = sym_text + " " + diag_text
        
        if any(w in combined for w in ["heart", "chest", "cardiac", "stroke"]):
            specialization = "Cardiologist"
        elif any(w in combined for w in ["neuro", "head", "brain"]):
            specialization = "Neurologist"
            
        # Find a doctor matching this
        doctor_docs = db.collection("users").where("role", "==", UserRole.DOCTOR.value).where("is_active", "==", True).stream()
        target_doctor_id = None
        target_doctor_name = None
        fallback_doctor_id = None
        fallback_doctor_name = None
        for d in doctor_docs:
            d_data = d.to_dict()
            fallback_doctor_id = d.id
            fallback_doctor_name = d_data.get("full_name", "Doctor")
            if d_data.get("specialization") and d_data["specialization"].lower() == specialization.lower():
                target_doctor_id = d.id
                target_doctor_name = d_data.get("full_name", "Doctor")
                break
                
        if not target_doctor_id:
            target_doctor_id = fallback_doctor_id
            target_doctor_name = fallback_doctor_name
            
        if target_doctor_id:
            # Book appointment for within the next hour
            apt_date = datetime.utcnow() + timedelta(hours=1)
            
            # Check for existing pending emergency appointments to avoid spam
            existing = db.collection("appointments").where("patient_id", "==", use_id).where("status", "==", "scheduled").stream()
            already_booked = False
            for e in existing:
                e_data = e.to_dict()
                if e_data.get("reason", "").startswith("EMERGENCY AUTO-BOOK:"):
                    already_booked = True
                    break
            
            if not already_booked:
                db_appointment = {
                    "patient_id": use_id,
                    "doctor_id": target_doctor_id,
                    "appointment_date": apt_date,
                    "duration_minutes": 30,
                    "status": "scheduled",
                    "reason": f"EMERGENCY AUTO-BOOK: {specialization} required immediately.",
                    "is_follow_up": False,
                    "created_at": datetime.utcnow()
                }
                appt_ref = db.collection("appointments").document()
                appt_ref.set(db_appointment)
                booked_appointment_id = appt_ref.id
                booked_doctor_name = target_doctor_name
                logger.info(f"Emergency appointment booked: {appt_ref.id} with doctor {target_doctor_name}")
                
                # Notify patient
                notif_data = {
                    "user_id": current_user.id,
                    "notification_type": "alert",
                    "title": "Emergency Appointment Booked",
                    "message": f"An emergency appointment has been booked for you with {target_doctor_name} ({specialization}).",
                    "appointment_id": appt_ref.id,
                    "is_read": False,
                    "created_at": datetime.utcnow()
                }
                db.collection("notifications").document().set(notif_data)
            else:
                logger.info(f"Emergency appointment already booked for patient {use_id}, skipping duplicate.")

    return DiagnosisResponse(
        potential_diagnosis=potential_diagnosis,
        recommendations=recommendations,
        risk_level=risk_level,
        emergency_assessment=emergency,
        booked_appointment_id=booked_appointment_id,
        booked_doctor_name=booked_doctor_name
    )


@router.get("/history/{patient_id}")
async def get_diagnosis_history(
    patient_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get diagnosis history for a patient from Firestore"""
    patient_doc = db.collection("patients").document(patient_id).get()
    if not patient_doc.exists:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Placeholder: Retrieve diagnosis history from database
    return {"message": "Diagnosis history endpoint - integration pending"}
