try:
    from crewai import Agent
    CREWAI_AVAILABLE = True
except ImportError:
    Agent = None
    CREWAI_AVAILABLE = False
from app.agents.tools import query_patient_db, query_medical_records
from app.core.config import settings
from app.core.llm import get_llm
import logging

logger = logging.getLogger(__name__)


# Patient Data Agent
_patient_data_agent = None

def get_patient_data_agent():
    """
    Initialize and return the patient data agent.
    Uses lazy loading to avoid get_llm() call at module level.
    """
    global _patient_data_agent
    if _patient_data_agent is None and CREWAI_AVAILABLE and Agent:
        _patient_data_agent = Agent(
            role="Patient Data Specialist",
            goal="""Retrieve and normalize patient medical records, demographics, and health history.
            Provide comprehensive patient data for clinical decision making.""",
            backstory="""You are an expert in electronic health records (EHR) management. You specialize 
            in retrieving patient information from databases, normalizing data formats, and presenting 
            comprehensive patient profiles. You ensure data accuracy and completeness for healthcare providers.""",
            verbose=True,
            allow_delegation=False,
            tools=[query_patient_db, query_medical_records],
            llm=get_llm()
        )
    return _patient_data_agent

patient_data_agent = None



def fetch_patient_data(patient_id: int, include_records: bool = True) -> dict:
    """
    Fetch comprehensive patient data including demographics and medical records.
    
    Args:
        patient_id: Patient ID
        include_records: Whether to include medical records
    
    Returns:
        Complete patient data profile
    """
    try:
        logger.info(f"Fetching data for patient {patient_id}")
        
        # Get patient demographics
        if hasattr(query_patient_db, 'func'):
            patient_info = query_patient_db.func(patient_id)
        else:
            patient_info = query_patient_db(patient_id)
        
        if "error" in patient_info:
            return patient_info
        
        result = {
            "patient_id": patient_id,
            "demographics": patient_info,
            "medical_records": []
        }
        
        # Get medical records if requested
        if include_records:
            if hasattr(query_medical_records, 'func'):
                records = query_medical_records.func(patient_id, limit=10)
            else:
                records = query_medical_records(patient_id, limit=10)
            result["medical_records"] = records
        
        return result
    
    except Exception as e:
        logger.error(f"Error fetching patient data: {e}")
        return {"error": str(e)}


def get_patient_medical_history(patient_id: int) -> dict:
    """
    Get patient's medical history summary.
    
    Args:
        patient_id: Patient ID
    
    Returns:
        Medical history summary
    """
    try:
        patient_data = fetch_patient_data(patient_id, include_records=True)
        
        if "error" in patient_data:
            return patient_data
        
        demographics = patient_data["demographics"]
        records = patient_data["medical_records"]
        
        # Extract diagnoses and treatments
        diagnoses = []
        treatments = []
        
        for record in records:
            if record.get("diagnosis"):
                diagnoses.append({
                    "date": record["visit_date"],
                    "diagnosis": record["diagnosis"]
                })
            if record.get("treatment_plan"):
                treatments.append({
                    "date": record["visit_date"],
                    "treatment": record["treatment_plan"]
                })
        
        return {
            "patient_id": patient_id,
            "medical_history": demographics.get("medical_history", []),
            "allergies": demographics.get("allergies", []),
            "current_medications": demographics.get("current_medications", []),
            "past_diagnoses": diagnoses,
            "past_treatments": treatments
        }
    
    except Exception as e:
        logger.error(f"Error getting medical history: {e}")
        return {"error": str(e)}
