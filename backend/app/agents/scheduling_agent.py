try:
    from crewai import Agent
    CREWAI_AVAILABLE = True
except ImportError:
    Agent = None
    CREWAI_AVAILABLE = False
from app.agents.tools import check_doctor_availability
from app.core.config import settings
from app.core.llm import get_llm
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


# Scheduling Agent
_scheduling_agent = None

def get_scheduling_agent():
    """
    Initialize and return the scheduling agent.
    Uses lazy loading to avoid get_llm() call at module level.
    """
    global _scheduling_agent
    if _scheduling_agent is None and CREWAI_AVAILABLE and Agent:
        _scheduling_agent = Agent(
            role="Appointment Scheduling Specialist",
            goal="""Optimize appointment scheduling by finding available time slots, managing conflicts,
            and coordinating follow-up appointments. Ensure efficient use of healthcare provider time.""",
            backstory="""You are an expert in healthcare scheduling and resource optimization. You manage
            doctor calendars, find optimal appointment slots, handle rescheduling, and ensure patients
            receive timely care. You prioritize urgent cases and follow-up appointments while maintaining
            efficient scheduling.""",
            verbose=True,
            allow_delegation=False,
            tools=[check_doctor_availability],
            llm=get_llm()
        )
    return _scheduling_agent

scheduling_agent = None



def find_available_slots(doctor_id: int, preferred_date: str = None, days_ahead: int = 7) -> dict:
    """
    Find available appointment slots for a doctor.
    
    Args:
        doctor_id: Doctor ID
        preferred_date: Preferred date (ISO format)
        days_ahead: Number of days to search ahead
    
    Returns:
        Available slots grouped by date
    """
    try:
        logger.info(f"Finding available slots for doctor {doctor_id}")
        
        # If no preferred date, start from tomorrow
        if not preferred_date:
            start_date = datetime.now() + timedelta(days=1)
        else:
            start_date = datetime.fromisoformat(preferred_date)
        
        available_slots = {}
        
        # Check availability for each day
        for day_offset in range(days_ahead):
            check_date = start_date + timedelta(days=day_offset)
            date_str = check_date.date().isoformat()
            
            if hasattr(check_doctor_availability, 'func'):
                availability = check_doctor_availability.func(doctor_id, date_str)
            else:
                availability = check_doctor_availability(doctor_id, date_str)
            
            if "error" not in availability and availability.get("total_available", 0) > 0:
                available_slots[date_str] = {
                    "date": date_str,
                    "slots": availability.get("available_slots", []),
                    "total_available": availability.get("total_available", 0)
                }
        
        return {
            "doctor_id": doctor_id,
            "search_period": f"{days_ahead} days",
            "available_dates": list(available_slots.keys()),
            "slots_by_date": available_slots,
            "total_slots_found": sum(day["total_available"] for day in available_slots.values())
        }
    
    except Exception as e:
        logger.error(f"Error finding available slots: {e}")
        return {"error": str(e)}


def optimize_appointment_time(patient_id: int, doctor_id: int, urgency: str = "routine") -> dict:
    """
    Find the optimal appointment time based on urgency.
    
    Args:
        patient_id: Patient ID
        doctor_id: Doctor ID
        urgency: Urgency level (emergency, urgent, routine)
    
    Returns:
        Recommended appointment slot
    """
    try:
        logger.info(f"Optimizing appointment for patient {patient_id}, urgency: {urgency}")
        
        # Determine search window based on urgency
        if urgency == "emergency":
            days_ahead = 1
            message = "Emergency appointment - same day or next day"
        elif urgency == "urgent":
            days_ahead = 3
            message = "Urgent appointment - within 3 days"
        else:
            days_ahead = 14
            message = "Routine appointment - within 2 weeks"
        
        # Find available slots
        slots = find_available_slots(doctor_id, days_ahead=days_ahead)
        
        if "error" in slots:
            return slots
        
        # Get the earliest available slot
        earliest_slot = None
        if slots["available_dates"]:
            first_date = slots["available_dates"][0]
            first_day_slots = slots["slots_by_date"][first_date]["slots"]
            if first_day_slots:
                earliest_slot = first_day_slots[0]
        
        return {
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "urgency": urgency,
            "message": message,
            "recommended_slot": earliest_slot,
            "alternative_slots": slots["slots_by_date"],
            "total_options": slots["total_slots_found"]
        }
    
    except Exception as e:
        logger.error(f"Error optimizing appointment time: {e}")
        return {"error": str(e)}


def schedule_follow_up(patient_id: int, doctor_id: int, parent_appointment_id: int, weeks_after: int = 2) -> dict:
    """
    Schedule a follow-up appointment.
    
    Args:
        patient_id: Patient ID
        doctor_id: Doctor ID
        parent_appointment_id: ID of the original appointment
        weeks_after: Number of weeks after the original appointment
    
    Returns:
        Follow-up appointment details
    """
    try:
        logger.info(f"Scheduling follow-up for patient {patient_id}")
        
        # Calculate follow-up date
        follow_up_date = datetime.now() + timedelta(weeks=weeks_after)
        date_str = follow_up_date.date().isoformat()
        
        # Find available slots around that date
        slots = find_available_slots(doctor_id, preferred_date=date_str, days_ahead=7)
        
        if "error" in slots:
            return slots
        
        # Get earliest slot
        earliest_slot = None
        if slots["available_dates"]:
            first_date = slots["available_dates"][0]
            first_day_slots = slots["slots_by_date"][first_date]["slots"]
            if first_day_slots:
                earliest_slot = first_day_slots[0]
        
        return {
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "parent_appointment_id": parent_appointment_id,
            "is_follow_up": True,
            "recommended_date": earliest_slot,
            "target_timeframe": f"{weeks_after} weeks after original appointment",
            "available_slots": slots["slots_by_date"]
        }
    
    except Exception as e:
        logger.error(f"Error scheduling follow-up: {e}")
        return {"error": str(e)}
