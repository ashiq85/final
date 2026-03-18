from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from app.db.models import UserRole, AppointmentStatus, AlertSeverity


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole
    specialization: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    specialization: Optional[str] = None


class UserResponse(UserBase):
    id: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None


# Patient Schemas
class PatientBase(BaseModel):
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[Dict[str, Any]] = None
    emergency_phone: Optional[str] = None
    primary_doctor_id: Optional[str] = None
    email: Optional[EmailStr] = None
    medical_history: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    allergies: Optional[List[str]] = Field(default_factory=list)
    current_medications: Optional[List[str]] = Field(default_factory=list)
    height: Optional[float] = None
    weight: Optional[float] = None

    @field_validator('medical_history', 'allergies', 'current_medications', mode='before')
    @classmethod
    def none_to_empty_list(cls, v):
        return v if v is not None else []


class PatientCreate(PatientBase):
    user_id: Optional[str] = None


class PatientUpdate(BaseModel):
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[Dict[str, Any]] = None
    emergency_phone: Optional[str] = None
    medical_history: Optional[List[Dict[str, Any]]] = None
    allergies: Optional[List[str]] = None
    current_medications: Optional[List[str]] = None
    height: Optional[float] = None
    weight: Optional[float] = None


class PatientResponse(PatientBase):
    id: str
    user_id: str
    medical_id: Optional[str] = None
    created_at: datetime
    user: Optional['UserBasic'] = None
    
    class Config:
        from_attributes = True


# Health Metric Schemas
class HealthMetricCreate(BaseModel):
    metric_name: str
    value: float
    unit: Optional[str] = None
    notes: Optional[str] = None
    recorded_at: Optional[datetime] = None


class HealthMetricResponse(HealthMetricCreate):
    id: str
    patient_id: str
    recorded_at: datetime
    
    class Config:
        from_attributes = True


class UserBasic(BaseModel):
    id: str
    full_name: str
    email: str
    role: UserRole
    specialization: Optional[str] = None

    class Config:
        from_attributes = True


class PatientBasic(BaseModel):
    id: str
    user_id: str
    user: Optional[UserBasic] = None

    class Config:
        from_attributes = True


class AppointmentBase(BaseModel):
    appointment_date: datetime
    duration_minutes: int = 30
    reason: Optional[str] = None


class AppointmentCreate(AppointmentBase):
    patient_id: str
    doctor_id: str


class AppointmentUpdate(BaseModel):
    appointment_date: Optional[datetime] = None
    requested_new_date: Optional[datetime] = None
    status: Optional[AppointmentStatus] = None
    notes: Optional[str] = None


class AppointmentRescheduleSchema(BaseModel):
    requested_new_date: datetime


class AppointmentResponse(AppointmentBase):
    id: str
    patient_id: str
    doctor_id: str
    status: AppointmentStatus
    notes: Optional[str] = None
    requested_new_date: Optional[datetime] = None
    is_follow_up: bool = False
    created_at: Optional[datetime] = None

    doctor: Optional[UserBasic] = None
    patient: Optional[PatientBasic] = None

    model_config = {"from_attributes": True}





# Document Schemas
class DocumentUpload(BaseModel):
    document_type: str = "general"


class DocumentResponse(BaseModel):
    id: str
    patient_id: str
    filename: str
    file_type: str
    file_size: int
    document_type: str
    extracted_data: Optional[Dict] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Alert Schemas
class AlertCreate(BaseModel):
    patient_id: str
    severity: AlertSeverity
    title: str
    description: str
    recommended_actions: List[str]


class AlertResponse(BaseModel):
    id: str
    patient_id: str
    severity: AlertSeverity
    title: str
    description: str
    recommended_actions: List[str]
    is_resolved: bool
    auto_booked_appointment_id: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Medical Record Schemas
class MedicalRecordCreate(BaseModel):
    patient_id: str
    visit_date: datetime
    chief_complaint: Optional[str] = None
    symptoms: Optional[List[str]] = None
    vitals: Optional[Dict] = None
    diagnosis: Optional[str] = None
    treatment_plan: Optional[str] = None
    prescriptions: Optional[List[Dict]] = None
    lab_results: Optional[Dict] = None


class MedicalRecordResponse(MedicalRecordCreate):
    id: str
    created_by: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Health Report Schemas
class HealthReportCreate(BaseModel):
    patient_id: str
    report_type: str = "summary"


class HealthReportResponse(BaseModel):
    id: str
    patient_id: str
    report_type: str
    report_data: Dict
    pdf_path: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# Notification Schemas
class NotificationResponse(BaseModel):
    id: str
    notification_type: str
    title: str
    message: Optional[str] = None
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Medication Schemas
class PatientMedication(BaseModel):
    medication_name: str
    dosage: str
    frequency: str
    instructions: Optional[str] = None
    prescribed_by: str
    prescribed_date: datetime


# Feedback Schemas
class FeedbackCreate(BaseModel):
    category: str
    subject: str
    content: str
    rating: Optional[int] = None

class FeedbackResponse(FeedbackCreate):
    id: str
    user_id: str
    role: str
    is_resolved: bool
    created_at: datetime
    admin_notes: Optional[str] = None

    class Config:
        from_attributes = True


# Diagnosis Schemas
class EmergencyAssessment(BaseModel):
    is_emergency: bool
    condition: str
    actions: List[str]


class SymptomAnalysisRequest(BaseModel):
    symptoms: List[str]
    patient_id: Optional[str] = None
    vital_signs: Optional[Dict] = None


class DiagnosisResponse(BaseModel):
    potential_diagnosis: List[str]
    recommendations: List[str]
    risk_level: str
    emergency_assessment: Optional[EmergencyAssessment] = None
    booked_appointment_id: Optional[str] = None
    booked_doctor_name: Optional[str] = None

# Encounter & Prescription Schemas
class PrescriptionCreate(BaseModel):
    medication_name: str
    dosage: str
    frequency: str
    duration_days: int
    instructions: Optional[str] = None

class PrescriptionResponse(PrescriptionCreate):
    id: str

class EncounterCreate(BaseModel):
    appointment_id: Optional[str] = None
    visit_notes: str
    diagnoses: List[str]
    treatment_plan: str

class EncounterResponse(EncounterCreate):
    id: str
    patient_id: str
    doctor_id: str
    created_at: datetime
    prescriptions: List[PrescriptionResponse] = []

# IP Record Schemas
class IPRecordCreate(BaseModel):
    admission_date: datetime
    discharge_date: Optional[datetime] = None
    reason: str
    ward: Optional[str] = None
    bed_number: Optional[str] = None
    attending_doctor: Optional[str] = None
    notes: Optional[str] = None
    status: str = "admitted"

class IPRecordUpdate(BaseModel):
    discharge_date: Optional[datetime] = None
    ward: Optional[str] = None
    bed_number: Optional[str] = None
    attending_doctor: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class IPRecordResponse(IPRecordCreate):
    id: str
    patient_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# Communication Schemas
class MessageCreate(BaseModel):
    recipient_id: str
    subject: str
    body: str
    is_urgent: bool = False

class MessageResponse(MessageCreate):
    id: str
    sender_id: str
    sender_name: str
    sender_role: str
    is_urgent: bool = False   # Override to default False for backward compat with old messages
    is_read: bool = False
    created_at: datetime
