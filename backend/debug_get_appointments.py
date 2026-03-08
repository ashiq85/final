import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.firebase_config import get_firestore_client
from app.api.routes.appointments import _load_appointment_data

db = get_firestore_client()

# Fetch passing through the backend helper function
print("Fetching appointment lg2B5oGyvWDsOA6KSRii...")
try:
    data = _load_appointment_data(db, "lg2B5oGyvWDsOA6KSRii")
    print("SUCCESS: ", data)
except Exception as e:
    print("ERROR LOADING:", e)

# Also test get_appointments logic
print("\nFetching ALL for patient_id=WR7FrYf37QpjRB4xAwkJ")
query = db.collection("appointments").where("patient_id", "==", "WR7FrYf37QpjRB4xAwkJ").stream()
for d in query:
    try:
        app_data = _load_appointment_data(db, d.id)
        if app_data:
            print(f"Loaded {d.id}: status={app_data.get('status')} reason={app_data.get('reason')}")
        else:
            print(f"Loaded {d.id}: returning None!")
    except Exception as e:
        print(f"Error loading {d.id}: {e}")
