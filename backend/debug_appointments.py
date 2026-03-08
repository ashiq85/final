"""Debug script: read appointments directly from Firestore without auth"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.firebase_config import get_firestore_client
db = get_firestore_client()



PATIENT_ID = "WR7FrYf37QpjRB4xAwkJ"

print(f"--- Appointments for patient {PATIENT_ID} ---")
docs = db.collection("appointments").where("patient_id", "==", PATIENT_ID).stream()
count = 0
for doc in docs:
    data = doc.to_dict()
    count += 1
    print(f"  [{doc.id}] status={data.get('status')} reason={data.get('reason','')[:60]}")
print(f"Total: {count} appointments\n")

print("--- All appointments in DB ---")
all_docs = db.collection("appointments").stream()
total = 0
for doc in all_docs:
    data = doc.to_dict()
    total += 1
    print(f"  [{doc.id}] patient={data.get('patient_id')} status={data.get('status')} reason={data.get('reason','')[:50]}")
print(f"Total: {total} appointments")
