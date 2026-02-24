# Core imports
from app.db.base import Base, engine
from app.db.models import User, UserRole, Patient
from app.core.security import get_password_hash
from sqlalchemy.orm import Session


def init_db():
    """Initialize database and create tables"""
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    # Create default admin user
    from app.db.base import SessionLocal
    db = SessionLocal()
    
    try:
        # Check if admin exists
        admin = db.query(User).filter(User.email == "admin@agenthealth.com").first()
        if not admin:
            admin_user = User(
                email="admin@agenthealth.com",
                full_name="System Administrator",
                role=UserRole.ADMIN,
                hashed_password=get_password_hash("admin123"),
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print("[OK] Default admin user created: admin@agenthealth.com / admin123")
        
        # Create default doctor
        doctor = db.query(User).filter(User.email == "doctor@agenthealth.com").first()
        if not doctor:
            doctor_user = User(
                email="doctor@agenthealth.com",
                full_name="Dr. John Smith",
                role=UserRole.DOCTOR,
                hashed_password=get_password_hash("doctor123"),
                is_active=True
            )
            db.add(doctor_user)
            db.commit()
            print("[OK] Default doctor user created: doctor@agenthealth.com / doctor123")
            
        # Create default patient
        patient = db.query(User).filter(User.email == "patient@agenthealth.com").first()
        if not patient:
            patient_user = User(
                email="patient@agenthealth.com",
                full_name="Test Patient",
                role=UserRole.PATIENT,
                hashed_password=get_password_hash("patient123"),
                is_active=True
            )
            db.add(patient_user)
            db.commit()
            db.refresh(patient_user)
            
            # Create patient profile
            patient_profile = Patient(user_id=patient_user.id)
            db.add(patient_profile)
            db.commit()
            print("[OK] Default patient user created: patient@agenthealth.com / patient123")
            
    finally:
        db.close()
