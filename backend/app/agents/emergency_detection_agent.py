from crewai import Agent
from app.core.config import settings
from app.core.llm import get_llm
import logging

logger = logging.getLogger(__name__)


# Emergency Detection Agent
_emergency_detection_agent = None

def get_emergency_detection_agent():
    """
    Initialize and return the emergency detection agent.
    Uses lazy loading to avoid get_llm() call at module level.
    """
    global _emergency_detection_agent
    if _emergency_detection_agent is None and CREWAI_AVAILABLE and Agent:
        _emergency_detection_agent = Agent(
            role="Emergency Health Detection Specialist",
            goal="""Detect critical health emergencies including stroke, heart attack, and cardiac arrest.
            Provide immediate emergency response guidance and trigger appropriate alerts.""",
            backstory="""You are an expert emergency medical AI trained to recognize life-threatening 
            health conditions. You specialize in the FAST protocol for stroke detection, cardiac emergency 
            assessment, and critical vital sign analysis. Your primary responsibility is to save lives by 
            detecting emergencies early and providing clear, actionable emergency response instructions.""",
            verbose=True,
            allow_delegation=False,
            llm=get_llm()
        )
    return _emergency_detection_agent

# For backward compatibility if needed, but recommended to use the getter
emergency_detection_agent = None 



def detect_stroke_symptoms(symptoms: list, vitals: dict) -> dict:
    """
    Detect stroke using FAST protocol
    F - Face drooping
    A - Arm weakness
    S - Speech difficulty
    T - Time to call emergency
    """
    stroke_indicators = {
        "face_drooping": False,
        "arm_weakness": False,
        "speech_difficulty": False,
        "sudden_severe_headache": False,
        "vision_problems": False,
        "dizziness": False
    }
    
    # Check symptoms
    for symptom in symptoms:
        symptom_lower = symptom.lower()
        if any(word in symptom_lower for word in ["face", "droop", "facial", "asymmetry"]):
            stroke_indicators["face_drooping"] = True
        if any(word in symptom_lower for word in ["arm", "weakness", "numbness", "paralysis"]):
            stroke_indicators["arm_weakness"] = True
        if any(word in symptom_lower for word in ["speech", "slurred", "confusion", "difficulty speaking"]):
            stroke_indicators["speech_difficulty"] = True
        if any(word in symptom_lower for word in ["headache", "severe headache", "worst headache"]):
            stroke_indicators["sudden_severe_headache"] = True
        if any(word in symptom_lower for word in ["vision", "blurred", "double vision", "blind"]):
            stroke_indicators["vision_problems"] = True
        if any(word in symptom_lower for word in ["dizzy", "dizziness", "balance", "coordination"]):
            stroke_indicators["dizziness"] = True
    
    # Count FAST indicators
    fast_count = sum([
        stroke_indicators["face_drooping"],
        stroke_indicators["arm_weakness"],
        stroke_indicators["speech_difficulty"]
    ])
    
    is_stroke_likely = fast_count >= 1 or stroke_indicators["sudden_severe_headache"]
    
    return {
        "is_emergency": is_stroke_likely,
        "condition": "Possible Stroke",
        "indicators": stroke_indicators,
        "fast_score": fast_count,
        "emergency_actions": [
            "CALL 108 IMMEDIATELY - Time is critical",
            "Note the time symptoms started",
            "Do not give aspirin or other medications",
            "Keep patient calm and lying down",
            "Monitor breathing and consciousness"
        ] if is_stroke_likely else []
    }


def detect_heart_attack(symptoms: list, vitals: dict) -> dict:
    """Detect heart attack symptoms"""
    heart_attack_indicators = {
        "chest_pain": False,
        "shortness_of_breath": False,
        "arm_pain": False,
        "jaw_pain": False,
        "nausea": False,
        "sweating": False,
        "abnormal_vitals": False
    }
    
    # Check symptoms
    for symptom in symptoms:
        symptom_lower = symptom.lower()
        if any(word in symptom_lower for word in ["chest pain", "chest pressure", "tightness"]):
            heart_attack_indicators["chest_pain"] = True
        if any(word in symptom_lower for word in ["breath", "breathing", "shortness"]):
            heart_attack_indicators["shortness_of_breath"] = True
        if any(word in symptom_lower for word in ["arm pain", "left arm", "shoulder pain"]):
            heart_attack_indicators["arm_pain"] = True
        if any(word in symptom_lower for word in ["jaw", "neck pain", "back pain"]):
            heart_attack_indicators["jaw_pain"] = True
        if any(word in symptom_lower for word in ["nausea", "vomit", "indigestion"]):
            heart_attack_indicators["nausea"] = True
        if any(word in symptom_lower for word in ["sweat", "cold sweat", "clammy"]):
            heart_attack_indicators["sweating"] = True
    
    # Check vitals
    if vitals:
        if "blood_pressure" in vitals:
            bp = vitals["blood_pressure"]
            if isinstance(bp, dict):
                systolic = bp.get("systolic", 0)
                if systolic > 180 or systolic < 90:
                    heart_attack_indicators["abnormal_vitals"] = True
        
        if "heart_rate" in vitals:
            hr = int(vitals.get("heart_rate", 0))
            if hr > 120 or hr < 50:
                heart_attack_indicators["abnormal_vitals"] = True
    
    # Major indicators
    major_count = sum([
        heart_attack_indicators["chest_pain"],
        heart_attack_indicators["shortness_of_breath"],
        heart_attack_indicators["abnormal_vitals"]
    ])
    
    is_heart_attack_likely = major_count >= 2 or (
        heart_attack_indicators["chest_pain"] and 
        any([heart_attack_indicators["arm_pain"], heart_attack_indicators["jaw_pain"]])
    )
    
    return {
        "is_emergency": is_heart_attack_likely,
        "condition": "Possible Heart Attack",
        "indicators": heart_attack_indicators,
        "severity_score": major_count,
        "emergency_actions": [
            "CALL 108 IMMEDIATELY",
            "Chew and swallow aspirin (if not allergic)",
            "Sit down and rest",
            "Loosen tight clothing",
            "Stay calm and breathe slowly",
            "Do not drive yourself to hospital"
        ] if is_heart_attack_likely else []
    }


def detect_cardiac_emergency(vitals: dict) -> dict:
    """Detect cardiac arrest risk from vital signs"""
    cardiac_indicators = {
        "severe_tachycardia": False,
        "severe_bradycardia": False,
        "irregular_rhythm": False,
        "critical_bp": False
    }
    
    if not vitals:
        return {"is_emergency": False, "condition": "No vitals provided"}
    
    # Heart rate check
    if "heart_rate" in vitals:
        hr = int(vitals.get("heart_rate", 0))
        if hr > 150:
            cardiac_indicators["severe_tachycardia"] = True
        if hr < 40:
            cardiac_indicators["severe_bradycardia"] = True
    
    # Blood pressure check
    if "blood_pressure" in vitals:
        bp = vitals["blood_pressure"]
        if isinstance(bp, dict):
            systolic = bp.get("systolic", 0)
            diastolic = bp.get("diastolic", 0)
            if systolic > 200 or systolic < 70:
                cardiac_indicators["critical_bp"] = True
    
    is_cardiac_emergency = any([
        cardiac_indicators["severe_tachycardia"],
        cardiac_indicators["severe_bradycardia"],
        cardiac_indicators["critical_bp"]
    ])
    
    return {
        "is_emergency": is_cardiac_emergency,
        "condition": "Cardiac Emergency",
        "indicators": cardiac_indicators,
        "emergency_actions": [
            "CALL 108 IMMEDIATELY",
            "Monitor patient continuously",
            "Be prepared to perform CPR if needed",
            "Have AED ready if available",
            "Keep patient calm and still"
        ] if is_cardiac_emergency else []
    }
