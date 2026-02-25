from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from app.db.models import UserRole, AppointmentStatus, AlertSeverity


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole
    specialization: Optional[str] = None


class UserCreate(UserBase):
    password: str


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
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    primary_doctor_id: Optional[str] = None
    email: Optional[EmailStr] = None


class PatientCreate(PatientBase):
    user_id: str


class PatientUpdate(PatientBase):
    medical_history: Optional[Dict] = None
    allergies: Optional[List[str]] = None
    current_medications: Optional[List[str]] = None


class PatientResponse(PatientBase):
    id: str
    user_id: str
    medical_id: Optional[str] = None
    medical_history: Optional[Dict] = None
    allergies: Optional[List[str]] = None
    current_medications: Optional[List[str]] = None
    created_at: datetime
    
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


# Appointment Schemas
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
    is_follow_up: bool
    created_at: datetime
    doctor: Optional[UserBasic] = None
    patient: Optional[PatientBasic] = None

    class Config:
        from_attributes = True


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
    message: str
    is_read: bool
    created_at: datetime
    
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
