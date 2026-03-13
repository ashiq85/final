from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from typing import List, Dict, Any
from app.db.base import get_db
from app.db.models import User, Patient, HealthMetric, UserRole, Alert, AlertSeverity, AppointmentStatus
from app.api.routes.auth import get_current_user
from app.schemas import SymptomAnalysisRequest, DiagnosisResponse, EmergencyAssessment
from app.agents.diagnosis_agent import analyze_symptoms as analyze_with_agent, local_symptom_lookup
from app.agents.emergency_detection_agent import detect_stroke_symptoms, detect_heart_attack, detect_cardiac_emergency
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/diagnosis", tags=["diagnosis"])




def get_latest_metrics(db: Any, patient_id: str) -> Dict[str, float]:
    """Fetch the latest values for each metric type for a patient from Firestore"""
    docs = db.collection("health_metrics")\
        .where("patient_id", "==", patient_id)\
        .stream()
        
    metrics = []
    for doc in docs:
        m = doc.to_dict()
        m["id"] = doc.id
        metrics.append(m)
    
    # Sort in-memory to avoid index requirement
    metrics.sort(key=lambda x: str(x.get("recorded_at", "")), reverse=True)
    
    latest = {}
    for m in metrics:
        if m["metric_name"] not in latest:
            latest[m["metric_name"]] = m["value"]
    return latest

def _auto_book_emergency_appointment(db, patient_id: str, current_user_id: str, combined_text: str) -> tuple[str, str]:
    from datetime import datetime, timedelta
    SPECIALIZATION_MAP = [
        ("Cardiologist",     ["heart", "cardiac", "chest pain", "myocardial", "angina", "arrhythmia",
                              "palpitation", "coronary", "hypertension", "blood pressure"]),
        ("Neurologist",      ["brain", "stroke", "neuro", "seizure", "paralysis", "migraine", 
                              "neuropathy", "nerve", "dementia", "numbness"]),
        ("Pulmonologist",    ["lung", "pulmo", "asthma", "breath", "asthma", "copd", "pneumonia",
                              "bronchitis", "respiratory", "cough"]),
        ("Gastroenterologist", ["stomach", "gastro", "ulcer", "liver", "intestine", "digestion",
                              "nausea", "vomiting", "bowel", "acid reflux", "gerd", "abdomen"]),
        ("Orthopedist",      ["bone", "joint", "muscle", "fracture", "arthritis", "spine", "back pain",
                              "hip", "ligament", "tendon", "arthritis", "musculo", "orthopedic"]),
        ("Dermatologist",    ["skin", "rash", "itching", "eczema", "psoriasis", "acne", "allergy",
                              "derma", "hives", "wound", "infection", "melanoma"]),
        ("Endocrinologist",  ["diabetes", "thyroid", "hormone", "insulin", "blood sugar", "glucose",
                              "endocrine", "adrenal", "pituitary", "obesity", "weight gain"]),
        ("Urologist",        ["kidney", "urine", "urinary", "bladder", "prostate", "renal",
                              "uti", "incontinence", "nephr", "stone"]),
        ("Psychiatrist",     ["mental", "anxiety", "depression", "psychi", "panic", "stress",
                              "hallucination", "bipolar", "schizophrenia", "suicidal"]),
        ("Gynecologist",     ["gynecol", "menstrual", "pregnancy", "uterus", "ovary", "pelvic",
                              "vaginal", "obstetric", "breast", "cervical"]),
        ("Pediatrician",     ["child", "infant", "pediatric", "baby", "fever in child",
                              "vaccination", "newborn"]),
        ("ENT Specialist",   ["ear", "nose", "throat", "sinus", "tonsil", "hearing", "ent",
                              "larynx", "nasal", "vertigo"]),
        ("Ophthalmologist",  ["eye", "vision", "ophthal", "retina", "cataract", "glaucoma",
                              "sight", "cornea", "blind"]),
        ("Oncologist",       ["cancer", "tumor", "oncol", "carcinoma", "malignant", "lymphoma",
                              "leukemia", "biopsy", "chemo", "metastasis"]),
    ]

    specialization = "General Physician"
    for spec_name, keywords in SPECIALIZATION_MAP:
        if any(kw in combined_text for kw in keywords):
            specialization = spec_name
            logger.info(f"Auto-booking specialization resolved: {specialization}")
            break

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
        apt_date = datetime.utcnow() + timedelta(minutes=30)
        logger.info(f"[AUTO-BOOK] Attempting to book for patient_id={patient_id} with doctor_id={target_doctor_id}")

        existing = db.collection("appointments").where("patient_id", "==", patient_id).where("status", "==", "scheduled").stream()
        already_booked = False
        for e in existing:
            e_data = e.to_dict()
            if e_data.get("reason", "").startswith("EMERGENCY AUTO-BOOK:"):
                already_booked = True
                logger.info(f"[AUTO-BOOK] Found existing emergency appointment {e.id} — returning it")
                return e.id, target_doctor_name

        if not already_booked:
            db_appointment = {
                "patient_id": patient_id,
                "doctor_id": target_doctor_id,
                "appointment_date": apt_date,
                "duration_minutes": 30,
                "status": AppointmentStatus.SCHEDULED.value,
                "reason": f"EMERGENCY AUTO-BOOK: {specialization} required immediately.",
                "is_follow_up": False,
                "created_at": datetime.utcnow()
            }
            appt_ref = db.collection("appointments").document()
            appt_ref.set(db_appointment)
            booked_appointment_id = appt_ref.id
            booked_doctor_name = target_doctor_name
            logger.info(f"[AUTO-BOOK] Emergency appointment booked: {appt_ref.id} with doctor {target_doctor_name} for patient {patient_id}")

            notif_data = {
                "user_id": current_user_id,
                "notification_type": "alert",
                "title": "Emergency Appointment Booked",
                "message": f"An emergency appointment has been booked for you with {target_doctor_name} ({specialization}).",
                "appointment_id": appt_ref.id,
                "is_read": False,
                "created_at": datetime.utcnow()
            }
            db.collection("notifications").document().set(notif_data)
            return booked_appointment_id, booked_doctor_name

    logger.warning(f"[AUTO-BOOK] Could not book — no doctor found.")
    return None, None



async def _run_diagnosis_background_task(
    db: Any,
    patient_id: str,
    symptoms: List[str],
    vitals: Dict[str, Any],
    stroke: dict,
    heart_attack: dict,
    cardiac: dict,
    current_user_id: str,
    current_user_role: str,
    notify_user_id: str,
    pre_booked_appointment_id: str = None,
    pre_booked_doctor_name: str = None
):
    """Background task to run the heavy AI analysis and process emergency bookings without blocking the UI."""
    try:
        emergency = None
        risk_level = "LOW"
        
        if stroke["is_emergency"]:
            emergency = EmergencyAssessment(
                is_emergency=True,
                condition=stroke["condition"],
                actions=stroke["emergency_actions"]
            )
            risk_level = "CRITICAL"
        elif heart_attack["is_emergency"]:
            emergency = EmergencyAssessment(
                is_emergency=True,
                condition=heart_attack["condition"],
                actions=heart_attack["emergency_actions"]
            )
            risk_level = "CRITICAL"
        elif cardiac["is_emergency"]:
            emergency = EmergencyAssessment(
                is_emergency=True,
                condition=cardiac["condition"],
                actions=cardiac["emergency_actions"]
            )
            risk_level = "CRITICAL"

        potential_diagnosis = []
        recommendations = []
        
        if emergency:
            potential_diagnosis.append(emergency.condition)
            recommendations.extend(emergency.actions)
        
        ai_result = {}
        try:
            ai_result = await analyze_with_agent(
                patient_id=patient_id or "anonymous",
                symptoms=symptoms,
                vitals=vitals
            )
            if "potential_diagnosis" in ai_result:
                for d in ai_result["potential_diagnosis"]:
                    if d not in potential_diagnosis:
                        potential_diagnosis.append(d)
            
            if "recommendations" in ai_result:
                for r in ai_result["recommendations"]:
                    if r not in recommendations:
                        recommendations.append(r)
            
        except Exception as e:
            logger.error(f"AI Analysis failed: {e}")

        risk_map = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
        ai_risk = ai_result.get("risk_level", "LOW")
        if risk_map.get(ai_risk, 0) > risk_map.get(risk_level, 0):
            risk_level = ai_risk
            
        if not potential_diagnosis:
            potential_diagnosis.append(f"AI Quota Exceeded: Unable to determine diagnosis for symptoms.")
        if not recommendations:
            recommendations.append("Please consult a healthcare professional immediately for proper evaluation.")

        use_id = patient_id if (patient_id and patient_id != "anonymous") else current_user_id
        booked_appointment_id = pre_booked_appointment_id
        booked_doctor_name = pre_booked_doctor_name
        from datetime import datetime, timedelta
        
        record_data = {
            "patient_id": use_id,
            "visit_date": datetime.utcnow(),
            "symptoms": symptoms,
            "vitals": vitals,
            "diagnosis": ", ".join(potential_diagnosis) if potential_diagnosis else "Pending Analysis",
            "treatment_plan": ", ".join(recommendations) if recommendations else "N/A",
            "created_by": current_user_id
        }
        db.collection("medical_records").document().set(record_data)
        
        if risk_level == "CRITICAL" and not pre_booked_appointment_id:
            # ONLY Auto-book for CRITICAL emergencies if not already booked synchronously
            sym_text = " ".join(symptoms).lower()
            diag_text = " ".join(potential_diagnosis).lower()
            combined = sym_text + " " + diag_text
            booked_appointment_id, booked_doctor_name = _auto_book_emergency_appointment(db, use_id, current_user_id, combined)
        if risk_level in ["HIGH", "CRITICAL"]:
            # Create Alert document for HIGH or CRITICAL
            alert_severity = AlertSeverity.HIGH if risk_level == "HIGH" else AlertSeverity.CRITICAL
            new_alert = Alert(
                patient_id=use_id,
                severity=alert_severity,
                title=f"Priority Medical Alert: {risk_level} Risk",
                description="Our AI has detected potentially high-risk symptoms requiring immediate attention.",
                symptoms=symptoms,
                potential_diagnoses=potential_diagnosis[:2],
                recommended_actions=recommendations[:3],
                auto_booked_appointment_id=booked_appointment_id
            )
            db.collection("alerts").document().set(new_alert.to_firestore())
        else:
            # Create an Informational/Low severity alert for history/visibility
            # Always ensure an alert is created for EVERY analysis
            new_alert = Alert(
                patient_id=use_id,
                severity=AlertSeverity.LOW,
                title="Clinical Analysis Complete",
                description="Routine clinical analysis indicates non-emergency conditions.",
                symptoms=symptoms,
                potential_diagnoses=potential_diagnosis[:2],
                recommended_actions=recommendations[:3],
                auto_booked_appointment_id=None
            )
            db.collection("alerts").document().set(new_alert.to_firestore())

        # Notify the user that processing is complete
        completion_notif = {
            "user_id": notify_user_id,
            "notification_type": "analysis_complete",
            "title": "Clinical Analysis Results Available",
            "message": f"The AI analysis for the submitted symptoms is complete. Please check the alerts page.",
            "is_read": False,
            "created_at": datetime.utcnow()
        }
        db.collection("notifications").document().set(completion_notif)
            
    except Exception as e:
        logger.error(f"Background clinical analysis failed: {e}")


@router.post("/analyze", response_model=DiagnosisResponse)
async def analyze_symptoms(
    request: SymptomAnalysisRequest,
    background_tasks: BackgroundTasks,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Analyze symptoms and provide diagnosis suggestions"""
    vitals = request.vital_signs or {}
    
    logger.info(f"[EMERGENCY SCAN] Received symptoms: {request.symptoms}")
    
    stroke = {"is_emergency": False, "condition": "", "emergency_actions": []}
    heart_attack = {"is_emergency": False, "condition": "", "emergency_actions": []}
    cardiac = {"is_emergency": False, "condition": ""}
    
    try:
        stroke = detect_stroke_symptoms(request.symptoms, vitals)
        logger.info(f"[EMERGENCY SCAN] Stroke: {stroke['is_emergency']}")
        heart_attack = detect_heart_attack(request.symptoms, vitals)
        logger.info(f"[EMERGENCY SCAN] Heart attack: {heart_attack['is_emergency']}")
        cardiac = detect_cardiac_emergency(vitals)
        logger.info(f"[EMERGENCY SCAN] Cardiac: {cardiac['is_emergency']}")
    except Exception as em_err:
        logger.error(f"[EMERGENCY SCAN] Detection error: {em_err}", exc_info=True)
    
    p_id = request.patient_id
    if current_user.role == UserRole.PATIENT and not p_id:
        p_doc = db.collection("patients").where("user_id", "==", getattr(current_user, 'id', None)).limit(1).stream()
        for d in p_doc: p_id = d.id

    # Consolidate emergency results for immediate feedback
    emergency_info = None
    if stroke["is_emergency"]:
        emergency_info = EmergencyAssessment(
            is_emergency=True,
            condition=stroke["condition"],
            actions=stroke["emergency_actions"]
        )
    elif heart_attack["is_emergency"]:
        emergency_info = EmergencyAssessment(
            is_emergency=True,
            condition=heart_attack["condition"],
            actions=heart_attack["emergency_actions"]
        )
    elif cardiac.get("is_emergency"):
        emergency_info = EmergencyAssessment(
            is_emergency=True,
            condition=cardiac["condition"],
            actions=cardiac.get("emergency_actions", [])
        )
    
    logger.info(f"[EMERGENCY SCAN] Final emergency_info: {emergency_info}")

        
    # Fast local analysis for immediate UI feedback
    local_analysis = local_symptom_lookup(request.symptoms)

    sync_booked_id = None
    sync_booked_doctor = None

    if emergency_info:
        # Only auto-book if we have a valid patient document ID
        # p_id is the patient collection doc ID; current_user.id is the auth user ID
        # Only book if p_id is set (i.e., the patient profile was found for this user)
        booking_patient_id = p_id
        if not booking_patient_id and current_user.role.value == 'patient':
            # Try to resolve patient ID for current user
            p_docs = db.collection("patients").where("user_id", "==", current_user.id).limit(1).stream()
            for d in p_docs:
                booking_patient_id = d.id
        
        if booking_patient_id:
            combined = " ".join(request.symptoms).lower() + " " + " ".join(local_analysis.get("potential_diagnosis", [])).lower()
            sync_booked_id, sync_booked_doctor = _auto_book_emergency_appointment(db, booking_patient_id, current_user.id, combined)
        else:
            logger.warning(f"Emergency detected but no patient profile found for user {current_user.id} — skipping auto-book.")

        
    # Offload the rest to a background task
    background_tasks.add_task(
        _run_diagnosis_background_task,
        db=db,
        patient_id=p_id,
        symptoms=request.symptoms,
        vitals=vitals,
        stroke=stroke,
        heart_attack=heart_attack,
        cardiac=cardiac,
        current_user_id=current_user.id,
        current_user_role=current_user.role.value,
        notify_user_id=current_user.id,
        pre_booked_appointment_id=sync_booked_id,
        pre_booked_doctor_name=sync_booked_doctor
    )

    # Return immediately with local findings
    return DiagnosisResponse(
        potential_diagnosis=local_analysis.get("potential_diagnosis", ["Analysis in progress..."]),
        recommendations=local_analysis.get("recommendations", ["The AI is reviewing the symptoms."]),
        risk_level="CRITICAL" if emergency_info else "PENDING",
        emergency_assessment=emergency_info,
        booked_appointment_id=sync_booked_id,
        booked_doctor_name=sync_booked_doctor
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
