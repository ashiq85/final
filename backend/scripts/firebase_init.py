from app.db.firebase_config import get_firestore_client
from app.db.models import User, UserRole, Patient
from app.core.security import get_password_hash

def run_init():
    db = get_firestore_client()
    
    users = [
        {
            "email": "admin@agenthealth.com",
            "full_name": "System Administrator",
            "role": UserRole.ADMIN,
            "password": "admin123"
        },
        {
            "email": "doctor@agenthealth.com",
            "full_name": "Dr. John Smith",
            "role": UserRole.DOCTOR,
            "password": "doctor123"
        },
        {
            "email": "patient@agenthealth.com",
            "full_name": "Test Patient",
            "role": UserRole.PATIENT,
            "password": "patient123"
        }
    ]
    
    for u_data in users:
        # Check if exists
        docs = db.collection("users").where("email", "==", u_data["email"]).limit(1).stream()
        if not any(docs):
            user = User(
                email=u_data["email"],
                full_name=u_data["full_name"],
                role=u_data["role"],
                hashed_password=get_password_hash(u_data["password"]),
                is_active=True
            )
            user_ref = db.collection("users").document()
            user_ref.set(user.to_firestore())
            print(f"[OK] Created: {u_data['email']} / {u_data['password']}")
            
            if u_data["role"] == UserRole.PATIENT:
                # also create a patient record
                patient_profile = Patient(user_id=user_ref.id, full_name=u_data["full_name"], email=u_data["email"])
                db.collection("patients").document().set(patient_profile.to_firestore())
        else:
            print(f"[SKIP] User {u_data['email']} already exists")

if __name__ == "__main__":
    run_init()
