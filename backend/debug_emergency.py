import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.firebase_config import get_firestore_client
from app.api.routes.diagnosis import _auto_book_emergency_appointment
import logging

logging.basicConfig(level=logging.INFO)

db = get_firestore_client()

PATIENT_ID = "WR7FrYf37QpjRB4xAwkJ"
USER_ID = "ZekWb4ARXFfRSmcO7ylaaxTJOFS2" # ashiq user ID

print("Triggering emergency auto-book for Chest Pain (Cardiologist)...")
appt_id, doctor_name = _auto_book_emergency_appointment(db, PATIENT_ID, USER_ID, "chest pain heart attack")

print(f"Result -> Appointment ID: {appt_id}, Doctor: {doctor_name}")
