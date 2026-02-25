from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
import enum


class UserRole(str, enum.Enum):
    """User role enumeration"""
    ADMIN = "admin"
    DOCTOR = "doctor"
    PATIENT = "patient"


class AlertSeverity(str, enum.Enum):
    """Alert severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AppointmentStatus(str, enum.Enum):
    """Appointment status"""
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"
    RESCHEDULE_REQUESTED = "reschedule_requested"


class FirestoreModel(BaseModel):
    """Base model for Firestore documents"""
    id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def to_firestore(self) -> Dict[str, Any]:
        data = self.model_dump(exclude={'id'})
        # Convert enums to strings
        for k, v in data.items():
            if isinstance(v, enum.Enum):
                data[k] = v.value
        return data


class User(FirestoreModel):
    """User model for authentication and authorization"""
    email: EmailStr
    hashed_password: str
    full_name: str
    role: UserRole
    is_active: bool = True
    specialization: Optional[str] = None


class Patient(FirestoreModel):
    """Patient model with EHR data"""
    user_id: str
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    medical_history: Optional[List[Dict[str, Any]]] = None
    allergies: Optional[List[str]] = None
    current_medications: Optional[List[str]] = None
    medical_id: Optional[str] = None
    primary_doctor_id: Optional[str] = None
    email: Optional[str] = None


class Appointment(FirestoreModel):
    """Appointment model with follow-up tracking"""
    patient_id: str
    doctor_id: str
    appointment_date: datetime
    requested_new_date: Optional[datetime] = None
    duration_minutes: int = 30
    status: AppointmentStatus = AppointmentStatus.SCHEDULED
    reason: Optional[str] = None
    notes: Optional[str] = None
    is_follow_up: bool = False
    parent_appointment_id: Optional[str] = None


class MedicalRecord(FirestoreModel):
    """Medical record model"""
    patient_id: str
    visit_date: datetime
    chief_complaint: Optional[str] = None
    symptoms: List[str] = []
    vitals: Dict[str, Any] = {}
    diagnosis: Optional[str] = None
    treatment_plan: Optional[str] = None
    prescriptions: List[Dict[str, Any]] = []
    lab_results: List[Dict[str, Any]] = []
    created_by: str


class Document(FirestoreModel):
    """Document model for uploaded files"""
    patient_id: str
    filename: str
    file_path: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    document_type: Optional[str] = None  # lab_report, prescription, imaging, etc.
    extracted_data: Optional[Dict[str, Any]] = None


class Alert(FirestoreModel):
    """Alert model for critical health notifications"""
    patient_id: str
    severity: AlertSeverity
    title: str
    description: Optional[str] = None
    recommended_actions: List[str] = []
    is_resolved: bool = False
    auto_booked_appointment_id: Optional[str] = None
    resolved_at: Optional[datetime] = None


class HealthReport(FirestoreModel):
    """Health report model"""
    patient_id: str
    report_type: Optional[str] = None
    report_data: Dict[str, Any] = {}
    pdf_path: Optional[str] = None


class HealthMetric(FirestoreModel):
    """Model for tracking health metrics like sugar, pressure, cholesterol, etc."""
    patient_id: str
    metric_name: str
    value: float
    unit: Optional[str] = None
    notes: Optional[str] = None
    recorded_at: datetime = Field(default_factory=datetime.utcnow)


class Notification(FirestoreModel):
    """Notification model"""
    user_id: str
    notification_type: str
    title: str
    message: Optional[str] = None
    is_read: bool = False
    appointment_id: Optional[str] = None


class AuditLog(FirestoreModel):
    """Audit log for HIPAA compliance"""
    user_id: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
