try:
    from crewai import Agent
    CREWAI_AVAILABLE = True
except ImportError:
    Agent = None
    CREWAI_AVAILABLE = False
from app.agents.tools import search_similar_cases
from app.core.config import settings
from app.core.llm import get_llm
import logging

logger = logging.getLogger(__name__)


# Medical Agent
_medical_agent = None

def get_medical_agent():
    """
    Initialize and return the medical agent.
    Uses lazy loading to avoid get_llm() call at module level.
    """
    global _medical_agent
    if _medical_agent is None and CREWAI_AVAILABLE and Agent:
        _medical_agent = Agent(
            role="Medical Knowledge Specialist",
            goal="""Provide evidence-based medical recommendations, treatment protocols, and drug information.
            Search medical literature and check for drug interactions.""",
            backstory="""You are a medical knowledge expert with comprehensive understanding of treatment 
            protocols, pharmacology, and evidence-based medicine. You provide accurate medical recommendations
            based on current medical guidelines and research. You prioritize patient safety by checking for
            drug interactions and contraindications.""",
            verbose=True,
            allow_delegation=False,
            tools=[search_similar_cases],
            llm=get_llm()
        )
    return _medical_agent

medical_agent = None



def get_treatment_recommendations(diagnosis: str, patient_allergies: list = None, current_medications: list = None) -> dict:
    """
    Get treatment recommendations for a diagnosis.
    
    Args:
        diagnosis: The diagnosis
        patient_allergies: List of patient allergies
        current_medications: List of current medications
    
    Returns:
        Treatment recommendations and warnings
    """
    try:
        logger.info(f"Getting treatment recommendations for: {diagnosis}")
        
        # TODO: Integrate with medical knowledge base and Ollama
        # For now, return structured placeholder
        
        recommendations = {
            "diagnosis": diagnosis,
            "treatment_options": [
                {
                    "type": "Pharmacological",
                    "description": "Medication-based treatment (requires medical knowledge base integration)",
                    "considerations": "Check for drug interactions and allergies"
                },
                {
                    "type": "Non-pharmacological",
                    "description": "Lifestyle modifications and supportive care",
                    "considerations": "Patient education and follow-up"
                }
            ],
            "drug_interactions": [],
            "contraindications": [],
            "follow_up": "Schedule follow-up appointment in 1-2 weeks"
        }
        
        # Check for allergies
        if patient_allergies:
            recommendations["allergy_warnings"] = [
                f"Patient allergic to: {', '.join(patient_allergies)}",
                "Avoid medications containing these allergens"
            ]
        
        # Check current medications
        if current_medications:
            recommendations["current_medications"] = current_medications
            recommendations["interaction_check"] = "Review for potential drug interactions"
        
        return recommendations
    
    except Exception as e:
        logger.error(f"Error getting treatment recommendations: {e}")
        return {"error": str(e)}


def check_drug_interactions(medications: list) -> dict:
    """
    Check for potential drug interactions.
    
    Args:
        medications: List of medications
    
    Returns:
        Drug interaction analysis
    """
    try:
        logger.info(f"Checking drug interactions for {len(medications)} medications")
        
        # TODO: Integrate with drug interaction database
        # For now, return placeholder
        
        return {
            "medications": medications,
            "interactions_found": 0,
            "interactions": [],
            "warnings": [],
            "note": "Drug interaction database integration pending"
        }
    
    except Exception as e:
        logger.error(f"Error checking drug interactions: {e}")
        return {"error": str(e)}


def search_medical_literature(query: str, limit: int = 5) -> list:
    """
    Search medical literature for relevant information.
    
    Args:
        query: Search query
        limit: Maximum number of results
    
    Returns:
        List of relevant medical literature
    """
    try:
        logger.info(f"Searching medical literature: {query}")
        
        # TODO: Integrate with medical literature database and vector search
        # For now, return placeholder
        
        return [
            {
                "title": "Medical Literature Search",
                "summary": "Integration with medical databases pending",
                "source": "PubMed/Medical Knowledge Base",
                "relevance": 0.0
            }
        ]
    
    except Exception as e:
        logger.error(f"Error searching medical literature: {e}")
        return []
