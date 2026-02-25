try:
    from crewai import Agent, Task, Crew
    CREWAI_AVAILABLE = True
except ImportError:
    CREWAI_AVAILABLE = False
    Agent = Task = Crew = None

from app.agents.tools import search_similar_cases, query_medical_records, create_alert_tool, emergency_detection_tool, query_health_metrics
from app.core.config import settings
from app.core.llm import get_llm
import logging

logger = logging.getLogger(__name__)

# ─── Local Symptom Knowledge Base ───────────────────────────────────────────
# Used when LLM is unavailable. Maps symptom keywords to conditions + actions.
_SYMPTOM_KB = [
    {
        "keywords": ["chest pain", "chest", "heart", "cardiac", "palpitation"],
        "conditions": ["Acute Coronary Syndrome", "Angina Pectoris", "Myocardial Infarction"],
        "actions": [
            "Seek emergency care immediately (call 108)",
            "Chew aspirin 325mg if not allergic and no contraindications",
            "Rest in a comfortable semi-reclined position",
            "Loosen tight clothing around the chest",
            "Monitor pulse and breathing",
        ],
    },
    {
        "keywords": ["shortness of breath", "breathing difficulty", "breath", "dyspnea"],
        "conditions": ["Pulmonary Embolism", "Asthma Exacerbation", "Pneumonia"],
        "actions": [
            "Ensure adequate airflow and sit upright",
            "Use rescue inhaler if prescribed",
            "Seek emergency care if breathing worsens",
            "Monitor oxygen levels if pulse oximeter available",
        ],
    },
    {
        "keywords": ["headache", "migraine", "head pain", "head", "skull"],
        "conditions": ["Migraine", "Tension-Type Headache", "Hypertensive Headache"],
        "actions": [
            "Rest in a quiet, dark room",
            "Apply cold or warm compress to the forehead",
            "Take OTC analgesic (paracetamol/ibuprofen) as directed",
            "Stay hydrated",
            "Seek care immediately if headache is sudden and severe ('thunderclap')",
        ],
    },
    {
        "keywords": ["fever", "temperature", "chills", "sweating", "sweat"],
        "conditions": ["Viral Infection", "Bacterial Infection", "Influenza"],
        "actions": [
            "Rest and stay well hydrated",
            "Take paracetamol/ibuprofen to reduce fever",
            "Monitor temperature every 4 hours",
            "Seek care if fever exceeds 39.5°C (103°F) or lasts more than 3 days",
        ],
    },
    {
        "keywords": ["abdominal pain", "stomach pain", "abdomen", "belly", "nausea", "vomiting"],
        "conditions": ["Gastroenteritis", "Peptic Ulcer Disease", "Appendicitis"],
        "actions": [
            "Stay hydrated with clear fluids",
            "Avoid solid foods until nausea subsides",
            "Seek care immediately if pain is severe, in the lower right abdomen, or with rigidity",
            "Do NOT take NSAIDs if ulcer is suspected",
        ],
    },
    {
        "keywords": ["dizziness", "vertigo", "lightheaded", "faint", "syncope"],
        "conditions": ["Benign Paroxysmal Positional Vertigo (BPPV)", "Orthostatic Hypotension", "Inner Ear Disorder"],
        "actions": [
            "Sit or lie down immediately to prevent fall injury",
            "Avoid sudden position changes",
            "Stay hydrated",
            "Seek care if dizziness accompanies chest pain, slurred speech, or vision changes",
        ],
    },
    {
        "keywords": ["cough", "sore throat", "throat", "cold", "runny nose", "congestion"],
        "conditions": ["Upper Respiratory Tract Infection", "Pharyngitis", "COVID-19"],
        "actions": [
            "Rest and stay hydrated",
            "Gargle warm salt water for sore throat",
            "Take OTC cough suppressant/expectorant as needed",
            "Consider COVID-19 test if symptoms persist",
            "Seek care if you develop difficulty breathing or high fever",
        ],
    },
    {
        "keywords": ["back pain", "lower back", "spine", "lumbar"],
        "conditions": ["Lumbar Muscle Strain", "Herniated Disc", "Sciatica"],
        "actions": [
            "Apply ice pack for first 48 hours, then switch to heat",
            "Take OTC anti-inflammatories (ibuprofen) as directed",
            "Avoid bed rest; gentle movement helps recovery",
            "Seek care if pain radiates down the leg or is associated with bladder/bowel changes",
        ],
    },
    {
        "keywords": ["joint pain", "arthritis", "swelling", "stiffness"],
        "conditions": ["Osteoarthritis", "Rheumatoid Arthritis", "Gout"],
        "actions": [
            "Rest the affected joint",
            "Apply ice to reduce swelling",
            "Take OTC NSAIDs as directed",
            "Seek rheumatology evaluation if symptoms persist",
        ],
    },
    {
        "keywords": ["skin rash", "rash", "itching", "hives", "allergy"],
        "conditions": ["Allergic Reaction", "Contact Dermatitis", "Urticaria"],
        "actions": [
            "Avoid the suspected allergen",
            "Take OTC antihistamine (cetirizine/loratadine)",
            "Apply calamine lotion or hydrocortisone cream",
            "Seek emergency care if rash is accompanied by swelling of face/throat or difficulty breathing",
        ],
    },
    {
        "keywords": ["urination", "burning urination", "frequent urination", "uti"],
        "conditions": ["Urinary Tract Infection", "Cystitis", "Kidney Infection"],
        "actions": [
            "Drink plenty of fluids",
            "Urinate frequently and do not hold urine",
            "Seek medical consultation for antibiotic prescription",
            "Seek emergency care if symptoms include high fever, back pain or chills (signs of kidney infection)",
        ],
    },
    {
        "keywords": ["fatigue", "tired", "weakness", "lethargy", "exhaustion"],
        "conditions": ["Iron Deficiency Anemia", "Hypothyroidism", "Chronic Fatigue Syndrome"],
        "actions": [
            "Ensure adequate sleep hygiene (7-9 hours per night)",
            "Maintain a balanced diet rich in iron and vitamins",
            "Stay hydrated",
            "Schedule a blood panel including CBC, thyroid function and iron studies",
        ],
    },
]


def _local_symptom_lookup(symptoms: list) -> dict:
    """Match symptoms against the local knowledge base and return conditions + recommendations."""
    combined = " ".join(symptoms).lower()
    matched_conditions = []
    matched_actions = []
    seen_conditions = set()

    for entry in _SYMPTOM_KB:
        if any(kw in combined for kw in entry["keywords"]):
            for c in entry["conditions"]:
                if c not in seen_conditions:
                    matched_conditions.append(c)
                    seen_conditions.add(c)
            matched_actions.extend(entry["actions"])

    if not matched_conditions:
        # Generic fallback if no keywords matched
        matched_conditions = ["Undifferentiated Illness — clinical assessment required"]
        matched_actions = [
            "Schedule an in-person medical consultation",
            "Keep a symptom diary to share with your doctor",
            "Stay hydrated and rest",
        ]

    # De-duplicate actions while preserving order
    seen = set()
    unique_actions = []
    for a in matched_actions:
        if a not in seen:
            unique_actions.append(a)
            seen.add(a)

    return {
        "potential_diagnosis": matched_conditions[:5],
        "recommendations": unique_actions[:6],
    }


# Diagnosis Agent
_diagnosis_agent = None

def get_diagnosis_agent():
    """
    Initialize and return the diagnosis agent.
    Uses lazy loading to avoid get_llm() call at module level.
    """
    global _diagnosis_agent
    if _diagnosis_agent is None and CREWAI_AVAILABLE and Agent:
        _diagnosis_agent = Agent(
            role="Clinical Diagnosis Specialist",
            goal="""Analyze patient symptoms and provide evidence-based diagnosis suggestions.
            Use vector similarity search to find similar cases and assess risk levels.""",
            backstory="""You are an expert clinical diagnostician with deep knowledge of medical conditions,
            symptoms, and differential diagnosis. You use AI-powered similarity search to find relevant 
            medical cases and provide accurate diagnosis suggestions with confidence scores. You prioritize 
            patient safety by identifying high-risk conditions early.""",
            verbose=True,
            allow_delegation=False,
            tools=[search_similar_cases, query_medical_records, create_alert_tool, emergency_detection_tool, query_health_metrics],
            llm=get_llm()
        )
    return _diagnosis_agent

diagnosis_agent = None



def analyze_symptoms(patient_id: str, symptoms: list, vitals: dict = None) -> dict:
    """
    Analyze patient symptoms and provide diagnosis suggestions.
    
    Args:
        patient_id: Patient ID (can be 'anonymous')
        symptoms: List of symptoms
        vitals: Optional vital signs
    
    Returns:
        Diagnosis analysis with suggestions and risk assessment
    """
    import json
    try:
        logger.info(f"Analyzing symptoms for patient {patient_id}: {symptoms}")
        vitals = vitals or {}
        
        # Direct emergency detection (avoid crewAI tool wrapper issues)
        from app.agents.emergency_detection_agent import (
            detect_stroke_symptoms,
            detect_heart_attack,
            detect_cardiac_emergency
        )
        
        emergency_result = {"is_emergency": False, "detected_conditions": [], "emergency_actions": []}
        try:
            stroke = detect_stroke_symptoms(symptoms, vitals)
            if stroke["is_emergency"]:
                emergency_result["is_emergency"] = True
                emergency_result["detected_conditions"].append(stroke["condition"])
                emergency_result["emergency_actions"].extend(stroke.get("emergency_actions", []))
            
            heart = detect_heart_attack(symptoms, vitals)
            if heart["is_emergency"]:
                emergency_result["is_emergency"] = True
                emergency_result["detected_conditions"].append(heart["condition"])
                emergency_result["emergency_actions"].extend(heart.get("emergency_actions", []))
            
            if vitals:
                cardiac = detect_cardiac_emergency(vitals)
                if cardiac["is_emergency"]:
                    emergency_result["is_emergency"] = True
                    emergency_result["detected_conditions"].append(cardiac["condition"])
                    emergency_result["emergency_actions"].extend(cardiac.get("emergency_actions", []))
        except Exception as em_err:
            logger.error(f"Emergency detection error: {em_err}")
        
        # Assess risk level
        risk_level = "LOW"
        if emergency_result["is_emergency"]:
            risk_level = "CRITICAL"
            # Create critical alert
            if hasattr(create_alert_tool, 'func'):
                create_alert_tool.func(
                    patient_id=patient_id,
                    severity="CRITICAL",
                    title="Critical Symptoms Detected",
                    description=f"Emergency conditions: {', '.join(emergency_result.get('detected_conditions', []))}",
                    actions=emergency_result.get("emergency_actions", [])
                )
            else:
                create_alert_tool(
                    patient_id=patient_id,
                    severity="CRITICAL",
                    title="Critical Symptoms Detected",
                    description=f"Emergency conditions: {', '.join(emergency_result.get('detected_conditions', []))}",
                    actions=emergency_result.get("emergency_actions", [])
                )
        else:
            high_risk_keywords = ["severe", "intense", "unbearable", "sudden", "acute", "bleeding", "unconscious", "seizure", "paralysis"]
            if any(any(kw in s.lower() for kw in high_risk_keywords) for s in symptoms):
                risk_level = "HIGH"
            elif len(symptoms) >= 4:
                risk_level = "MEDIUM"

        # Use LLM for diagnosis and recommendations
        prompt = f"""You are a clinical diagnosis assistant. Analyze these patient symptoms and provide a JSON diagnosis.

Patient Symptoms: {', '.join(symptoms)}
Vital Signs: {vitals if vitals else 'Not provided'}
Risk Level: {risk_level}

Respond ONLY with a valid JSON object in exactly this format (no markdown, no explanation):
{{
    "potential_diagnosis": ["condition 1", "condition 2", "condition 3"],
    "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}}"""
        
        import json
        llm_result = {"potential_diagnosis": [], "recommendations": []}
        try:
            llm = get_llm()
            try:
                response = llm.invoke(prompt)
                content = response.content.strip()
                # Strip markdown code blocks if present
                if content.startswith("```json"):
                    content = content[7:]
                    if content.endswith("```"):
                        content = content[:-3]
                elif content.startswith("```"):
                    content = content[3:]
                    if content.endswith("```"):
                        content = content[:-3]
                llm_result = json.loads(content.strip())
                logger.info(f"LLM diagnosis result: {llm_result}")
            except Exception as inner_err:
                err_str = str(inner_err)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    logger.warning("LLM rate limited. Using local symptom knowledge base as fallback.")
                raise inner_err
        except Exception as llm_err:
            logger.warning(f"LLM diagnosis failed, using local fallback: {type(llm_err).__name__}")
            llm_result = _local_symptom_lookup(symptoms)
        
        final_risk = llm_result.get("risk_level", risk_level)
        if risk_level == "CRITICAL":
            final_risk = "CRITICAL"
        
        return {
            "patient_id": patient_id,
            "symptoms": symptoms,
            "vitals": vitals,
            "emergency_status": emergency_result,
            "risk_level": final_risk,
            "potential_diagnosis": llm_result.get("potential_diagnosis", []),
            "recommendations": llm_result.get("recommendations", [
                "Consult with healthcare provider",
                "Monitor symptoms closely",
                "Seek immediate care if symptoms worsen"
            ]) if final_risk != "CRITICAL" else emergency_result.get("emergency_actions", [])
        }
    
    except Exception as e:
        logger.error(f"Error analyzing symptoms: {e}", exc_info=True)
        return {
            "error": str(e),
            "potential_diagnosis": ["Analysis failed - please try again"],
            "recommendations": ["Please consult a healthcare professional"],
            "risk_level": "MEDIUM",
            "emergency_status": {"is_emergency": False}
        }


def assess_risk_level(symptoms: list, vitals: dict = None, medical_history: list = None) -> str:
    """
    Assess the risk level of a patient's condition.
    
    Args:
        symptoms: List of symptoms
        vitals: Optional vital signs
        medical_history: Optional medical history
    
    Returns:
        Risk level: LOW, MEDIUM, HIGH, or CRITICAL
    """
    try:
        # Check for emergency conditions
        if hasattr(emergency_detection_tool, 'func'):
            emergency_result = emergency_detection_tool.func(symptoms, vitals or {})
        else:
            emergency_result = emergency_detection_tool(symptoms, vitals or {})
        
        if emergency_result["is_emergency"]:
            return "CRITICAL"
        
        # Check for high-risk symptoms
        high_risk_keywords = [
            "severe", "intense", "unbearable", "sudden", "acute",
            "bleeding", "unconscious", "seizure", "paralysis"
        ]
        
        for symptom in symptoms:
            if any(keyword in symptom.lower() for keyword in high_risk_keywords):
                return "HIGH"
        
        # Check vital signs
        if vitals:
            if "temperature" in vitals:
                temp = float(vitals.get("temperature", 0))
                if temp > 103 or temp < 95:
                    return "HIGH"
            
            if "oxygen_saturation" in vitals:
                o2 = float(vitals.get("oxygen_saturation", 100))
                if o2 < 90:
                    return "HIGH"
        
        # Medium risk if multiple symptoms
        if len(symptoms) >= 4:
            return "MEDIUM"
        
        return "LOW"
    
    except Exception as e:
        logger.error(f"Error assessing risk level: {e}")
        return "MEDIUM"  # Default to medium on error
