from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from app.db.base import get_db
from app.db.models import User, Patient, HealthMetric
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
    is_emergency = chest_pain and shortness_of_breath
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
    
    # Use provided patient_id, or fallback to current user's ID
    p_id = request.patient_id or getattr(current_user, 'id', "unknown")
    
    try:
        ai_result = analyze_with_agent(
            patient_id=p_id,
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
        
        # AI risk level takes precedence if higher
        risk_map = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
        ai_risk = ai_result.get("risk_level", "LOW")
        if risk_map.get(ai_risk, 0) > risk_map.get(risk_level, 0):
            risk_level = ai_risk
            
    except Exception as e:
        logger.error(f"AI Analysis failed: {e}")

    return DiagnosisResponse(
        potential_diagnosis=potential_diagnosis,
        recommendations=recommendations,
        risk_level=risk_level,
        emergency_assessment=emergency
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
