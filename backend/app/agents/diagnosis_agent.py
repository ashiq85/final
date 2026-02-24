try:
    from crewai import Agent
    CREWAI_AVAILABLE = True
except ImportError:
    CREWAI_AVAILABLE = False
    Agent = None

from app.agents.tools import search_similar_cases, query_medical_records, create_alert_tool, emergency_detection_tool, query_health_metrics
from app.core.config import settings
from app.core.llm import get_llm
import logging

logger = logging.getLogger(__name__)


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



def analyze_symptoms(patient_id: int, symptoms: list, vitals: dict = None) -> dict:
    """
    Analyze patient symptoms and provide diagnosis suggestions.
    
    Args:
        patient_id: Patient ID
        symptoms: List of symptoms
        vitals: Optional vital signs
    
    Returns:
        Diagnosis analysis with suggestions and risk assessment
    """
    try:
        logger.info(f"Analyzing symptoms for patient {patient_id}")
        
        # First check for emergencies
        if hasattr(emergency_detection_tool, 'func'):
            emergency_result = emergency_detection_tool.func(symptoms, vitals or {})
        else:
            emergency_result = emergency_detection_tool(symptoms, vitals or {})
        
        # Search for similar cases
        if hasattr(search_similar_cases, 'func'):
            similar_cases = search_similar_cases.func(symptoms)
        else:
            similar_cases = search_similar_cases(symptoms)
        
        # Get patient's medical history
        if hasattr(query_medical_records, 'func'):
            medical_records = query_medical_records.func(patient_id, limit=5)
        else:
            medical_records = query_medical_records(patient_id, limit=5)
        
        # Get patient's latest health metrics
        if hasattr(query_health_metrics, 'func'):
            health_metrics = query_health_metrics.func(patient_id, limit=10)
        else:
            health_metrics = query_health_metrics(patient_id, limit=10)
        
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
        elif len(symptoms) > 5:
            risk_level = "MEDIUM"
        
        return {
            "patient_id": patient_id,
            "symptoms": symptoms,
            "vitals": vitals,
            "health_metrics": health_metrics,
            "emergency_status": emergency_result,
            "similar_cases": similar_cases,
            "risk_level": risk_level,
            "recommendations": [
                "Consult with healthcare provider",
                "Monitor symptoms closely",
                "Seek immediate care if symptoms worsen"
            ] if risk_level != "CRITICAL" else emergency_result["emergency_actions"]
        }
    
    except Exception as e:
        logger.error(f"Error analyzing symptoms: {e}")
        return {"error": str(e)}


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
