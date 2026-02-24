try:
    from crewai.tools import tool
except ImportError:
    # Fallback: plain decorator when crewai is not installed
    def tool(name=None):
        def decorator(func):
            return func
        if callable(name):
            return name
        return decorator

from app.db.firebase_config import get_firestore_client
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


@tool("Query Patient Database")
def query_patient_db(patient_id: str) -> Dict:
    """
    Query patient information from the database.
    Returns patient demographics, medical history, and current medications.
    """
    try:
        db = get_firestore_client()
        doc = db.collection("patients").document(patient_id).get()
        if not doc.exists:
            return {"error": "Patient not found"}

        patient = doc.to_dict()
        return {
            "patient_id": doc.id,
            "date_of_birth": str(patient.get("date_of_birth")) if patient.get("date_of_birth") else None,
            "gender": patient.get("gender"),
            "blood_type": patient.get("blood_type"),
            "medical_history": patient.get("medical_history") or [],
            "allergies": patient.get("allergies") or [],
            "current_medications": patient.get("current_medications") or []
        }
    except Exception as e:
        logger.error(f"Error querying patient database: {e}")
        return {"error": str(e)}


@tool("Query Medical Records")
def query_medical_records(patient_id: str, limit: int = 10) -> List[Dict]:
    """
    Query patient's medical records from the database.
    Returns recent medical visits, diagnoses, and treatments.
    """
    try:
        db = get_firestore_client()
        docs = db.collection("medical_records")\
            .where("patient_id", "==", patient_id)\
            .order_by("visit_date", direction="DESCENDING")\
            .limit(limit)\
            .stream()

        return [
            {
                "visit_date": str(d.to_dict().get("visit_date")),
                "chief_complaint": d.to_dict().get("chief_complaint"),
                "symptoms": d.to_dict().get("symptoms") or [],
                "vitals": d.to_dict().get("vitals") or {},
                "diagnosis": d.to_dict().get("diagnosis"),
                "treatment_plan": d.to_dict().get("treatment_plan"),
                "prescriptions": d.to_dict().get("prescriptions") or []
            }
            for d in docs
        ]
    except Exception as e:
        logger.error(f"Error querying medical records: {e}")
        return []


@tool("Check Doctor Availability")
def check_doctor_availability(doctor_id: str, date: str) -> Dict:
    """
    Check doctor's availability for appointments on a specific date.
    Returns available time slots.
    """
    try:
        from datetime import datetime, timedelta
        db = get_firestore_client()
        target_date = datetime.fromisoformat(date).date()
        target_start = datetime.combine(target_date, datetime.min.time())
        target_end = target_start + timedelta(days=1)

        docs = db.collection("appointments")\
            .where("doctor_id", "==", doctor_id)\
            .where("appointment_date", ">=", target_start)\
            .where("appointment_date", "<", target_end)\
            .stream()

        booked_times = set()
        for d in docs:
            apt_date = d.to_dict().get("appointment_date")
            if apt_date:
                booked_times.add(str(apt_date))

        # Generate available slots (9 AM to 5 PM, 30-minute slots)
        all_slots = []
        for hour in range(9, 17):
            for minute in [0, 30]:
                slot_time = datetime.combine(target_date, datetime.min.time()).replace(hour=hour, minute=minute)
                all_slots.append(slot_time)

        available_slots = [slot for slot in all_slots if str(slot) not in booked_times]

        return {
            "doctor_id": doctor_id,
            "date": date,
            "available_slots": [str(slot) for slot in available_slots],
            "total_available": len(available_slots)
        }
    except Exception as e:
        logger.error(f"Error checking doctor availability: {e}")
        return {"error": str(e)}


@tool("Create Alert")
def create_alert_tool(patient_id: str, severity: str, title: str, description: str, actions: List[str]) -> Dict:
    """
    Create a health alert for a patient.
    Severity levels: LOW, MEDIUM, HIGH, CRITICAL
    """
    try:
        from app.db.models import Alert, AlertSeverity
        db = get_firestore_client()

        alert = Alert(
            patient_id=patient_id,
            severity=AlertSeverity[severity.upper()],
            title=title,
            description=description,
            recommended_actions=actions
        )
        doc_ref = db.collection("alerts").document()
        doc_ref.set(alert.to_firestore())

        return {
            "alert_id": doc_ref.id,
            "patient_id": patient_id,
            "severity": severity,
            "title": title,
            "created": True
        }
    except Exception as e:
        logger.error(f"Error creating alert: {e}")
        return {"error": str(e), "created": False}


@tool("Search Similar Cases")
def search_similar_cases(symptoms: List[str], diagnosis: str = None) -> List[Dict]:
    """
    Search for similar medical cases based on symptoms and diagnosis.
    This will integrate with ChromaDB vector search in the future.
    """
    # TODO: Integrate with ChromaDB vector service
    return [
        {
            "case_id": "placeholder",
            "similarity_score": 0.0,
            "symptoms": symptoms,
            "diagnosis": "Pending vector search integration",
            "treatment": "Integration with ChromaDB pending"
        }
    ]


@tool("Emergency Detection")
def emergency_detection_tool(symptoms: List[str], vitals: Dict = None) -> Dict:
    """
    Detect emergency health conditions from symptoms and vital signs.
    Returns emergency status and recommended actions.
    """
    from app.agents.emergency_detection_agent import (
        detect_stroke_symptoms,
        detect_heart_attack,
        detect_cardiac_emergency
    )

    results = {
        "is_emergency": False,
        "detected_conditions": [],
        "emergency_actions": []
    }

    stroke_result = detect_stroke_symptoms(symptoms, vitals or {})
    if stroke_result["is_emergency"]:
        results["is_emergency"] = True
        results["detected_conditions"].append(stroke_result["condition"])
        results["emergency_actions"].extend(stroke_result["emergency_actions"])

    heart_attack_result = detect_heart_attack(symptoms, vitals or {})
    if heart_attack_result["is_emergency"]:
        results["is_emergency"] = True
        results["detected_conditions"].append(heart_attack_result["condition"])
        results["emergency_actions"].extend(heart_attack_result["emergency_actions"])

    if vitals:
        cardiac_result = detect_cardiac_emergency(vitals)
        if cardiac_result["is_emergency"]:
            results["is_emergency"] = True
            results["detected_conditions"].append(cardiac_result["condition"])
            results["emergency_actions"].extend(cardiac_result["emergency_actions"])

    return results


@tool("Query Health Metrics")
def query_health_metrics(patient_id: str, limit: int = 10) -> List[Dict]:
    """
    Query patient's daily health metrics (sugar, pressure, cholesterol, etc.) from the database.
    Returns recent health measurements and vitals.
    """
    try:
        db = get_firestore_client()
        docs = db.collection("health_metrics")\
            .where("patient_id", "==", patient_id)\
            .order_by("recorded_at", direction="DESCENDING")\
            .limit(limit)\
            .stream()

        return [
            {
                "recorded_at": str(d.to_dict().get("recorded_at")),
                "metric_name": d.to_dict().get("metric_name"),
                "value": d.to_dict().get("value"),
                "unit": d.to_dict().get("unit"),
                "notes": d.to_dict().get("notes")
            }
            for d in docs
        ]
    except Exception as e:
        logger.error(f"Error querying health metrics: {e}")
        return []
