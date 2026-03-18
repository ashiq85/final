import os
import sys

# Add the parent directory to sys.path to allow imports from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.firebase_config import get_firestore_client
from firebase_admin import auth as firebase_auth
from app.db.models import User, UserRole, Patient
import random
import string

def generate_medical_id(db):
    while True:
        digits = ''.join(random.choices(string.digits, k=5))
        medical_id = f"AH-{digits}"
        docs = db.collection("patients").where("medical_id", "==", medical_id).limit(1).stream()
        if not any(docs):
            return medical_id

def test_registration():
    db = get_firestore_client()
    
    email = f"test_patient_{random.randint(1000, 9999)}@example.com"
    password = "password123"
    full_name = "Test Patient"
    
    print(f"Testing registration for {email}...")
    
    try:
        # 1. Firebase Auth
        try:
            firebase_user = firebase_auth.get_user_by_email(email)
            firebase_uid = firebase_user.uid
            print(f"User already exists in Firebase: {firebase_uid}")
        except Exception as e:
            print(f"Creating new Firebase user...")
            firebase_user = firebase_auth.create_user(
                email=email,
                password=password,
                display_name=full_name
            )
            firebase_uid = firebase_user.uid
            print(f"Created Firebase user: {firebase_uid}")
            
        # 2. Firestore User
        new_user = User(
            email=email,
            full_name=full_name,
            role=UserRole.PATIENT,
            hashed_password="dummy_hash",
            is_active=True
        )
        user_ref = db.collection("users").document(firebase_uid)
        user_ref.set(new_user.to_firestore())
        print(f"Created Firestore user document: {firebase_uid}")
        
        # 3. Firestore Patient
        medical_id = generate_medical_id(db)
        p_data = {
            "user_id": firebase_uid,
            "medical_id": medical_id,
            "email": email,
            "full_name": full_name,
            "gender": "male",
            "date_of_birth": None
        }
        
        patient = Patient(**p_data)
        doc_ref = db.collection("patients").document()
        doc_ref.set(patient.to_firestore())
        print(f"Created Firestore patient document: {doc_ref.id}")
        
        print("Registration test SUCCESSFUL")
        
    except Exception as e:
        import traceback
        print(f"Registration test FAILED: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    test_registration()
