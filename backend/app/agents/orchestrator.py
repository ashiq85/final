try:
    from crewai import Agent, Task, Crew
    CREWAI_AVAILABLE = True
except ImportError:
    Agent = Task = Crew = None
    CREWAI_AVAILABLE = False
from app.agents.tools import (
    query_patient_db,
    query_medical_records,
    check_doctor_availability,
    create_alert_tool,
    search_similar_cases,
    emergency_detection_tool
)
from app.core.config import settings
from app.core.llm import get_llm
import logging

logger = logging.getLogger(__name__)


# Orchestrator Agent
_orchestrator_agent = None

def get_orchestrator_agent():
    """
    Initialize and return the orchestrator agent.
    Uses lazy loading to avoid get_llm() call at module level.
    """
    global _orchestrator_agent
    if _orchestrator_agent is None and CREWAI_AVAILABLE and Agent:
        _orchestrator_agent = Agent(
            role="Healthcare Orchestrator",
            goal="""Coordinate all healthcare tasks by routing requests to appropriate specialized agents.
            Aggregate responses and provide comprehensive healthcare management.""",
            backstory="""You are the central AI coordinator for the AgentHealth system. You understand 
            patient needs and delegate tasks to specialized agents including patient data retrieval, 
            diagnosis analysis, medical recommendations, appointment scheduling, and emergency detection.
            You synthesize information from multiple agents to provide complete healthcare solutions.""",
            verbose=True,
            allow_delegation=True,
            llm=get_llm()
        )
    return _orchestrator_agent

orchestrator_agent = None



def orchestrate_patient_query(patient_id: int, query_type: str, query_data: dict) -> dict:
    """
    Orchestrate a patient query by routing to appropriate agents.
    
    Args:
        patient_id: Patient ID
        query_type: Type of query (diagnosis, appointment, emergency, etc.)
        query_data: Additional query parameters
    
    Returns:
        Orchestrated response from relevant agents
    """
    try:
        logger.info(f"Orchestrating {query_type} query for patient {patient_id}")
        
        # Get patient data first
        if hasattr(query_patient_db, 'func'):
            patient_data = query_patient_db.func(patient_id)
        else:
            patient_data = query_patient_db(patient_id)
        
            # Route to emergency detection
            symptoms = query_data.get("symptoms", [])
            vitals = query_data.get("vitals", {})
            if hasattr(emergency_detection_tool, 'func'):
                emergency_result = emergency_detection_tool.func(symptoms, vitals)
            else:
                emergency_result = emergency_detection_tool(symptoms, vitals)
            
            # Create alert if emergency detected
            if emergency_result.get("is_emergency"):
                if hasattr(create_alert_tool, 'func'):
                    create_alert_tool.func(
                        patient_id=patient_id,
                        severity="CRITICAL",
                        title="Emergency Detected",
                        description=f"Conditions: {', '.join(emergency_result.get('detected_conditions', []))}",
                        actions=emergency_result.get("emergency_actions", [])
                    )
                else:
                    create_alert_tool(
                        patient_id=patient_id,
                        severity="CRITICAL",
                        title="Emergency Detected",
                        description=f"Conditions: {', '.join(emergency_result.get('detected_conditions', []))}",
                        actions=emergency_result.get("emergency_actions", [])
                    )
            
            return {
                "patient_id": patient_id,
                "query_type": query_type,
                "emergency_result": emergency_result,
                "patient_data": patient_data
            }
        
        elif query_type == "diagnosis":
            # Route to diagnosis agent
            symptoms = query_data.get("symptoms", [])
            
            if hasattr(search_similar_cases, 'func'):
                similar_cases = search_similar_cases.func(symptoms)
            else:
                similar_cases = search_similar_cases(symptoms)
                
            if hasattr(query_medical_records, 'func'):
                medical_records = query_medical_records.func(patient_id, limit=5)
            else:
                medical_records = query_medical_records(patient_id, limit=5)
            
            return {
                "patient_id": patient_id,
                "query_type": query_type,
                "symptoms": symptoms,
                "similar_cases": similar_cases,
                "medical_history": medical_records,
                "patient_data": patient_data
            }
        
        elif query_type == "appointment":
            # Route to scheduling agent
            doctor_id = query_data.get("doctor_id")
            date = query_data.get("date")
            
            if hasattr(check_doctor_availability, 'func'):
                availability = check_doctor_availability.func(doctor_id, date)
            else:
                availability = check_doctor_availability(doctor_id, date)
            
            return {
                "patient_id": patient_id,
                "query_type": query_type,
                "availability": availability,
                "patient_data": patient_data
            }
        
        else:
            return {
                "patient_id": patient_id,
                "query_type": query_type,
                "patient_data": patient_data,
                "message": "Query type not recognized"
            }
    
    except Exception as e:
        logger.error(f"Error in orchestration: {e}")
        return {"error": str(e)}
