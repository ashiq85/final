import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.firebase_config import get_firestore_client
from app.api.routes.appointments import _load_appointment_data
from app.schemas import AppointmentResponse
import json

db = get_firestore_client()

data = _load_appointment_data(db, "lg2B5oGyvWDsOA6KSRii")
print(f"Loaded dict: {list(data.keys())}")
print(f"Doctor dict: {data.get('doctor') is not None}")
print(f"Patient dict: {data.get('patient') is not None}")

try:
    resp = AppointmentResponse(**data)
    print("Pydantic Validation SUCCESS!")
    print(resp.model_dump_json(indent=2))
except Exception as e:
    print(f"Pydantic Validation FAILED: {e}")
