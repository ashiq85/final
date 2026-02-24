export const UserRole = {
    ADMIN: 'admin',
    DOCTOR: 'doctor',
    PATIENT: 'patient'
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

export interface User {
    id: number;
    email: string;
    full_name: string;
    role: UserRole;
    is_active: boolean;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
}

export interface Patient {
    id: number;
    user_id: number;
    date_of_birth: string;
    gender: string;
    blood_type: string;
    height: number;
    weight: number;
    allergies: string[];
    medical_history: string[];
    current_medications: string[];
    emergency_contact: {
        name: string;
        relationship: string;
        phone: string;
    };
    medical_id?: string;
    user?: User;
}

export interface HealthMetric {
    id: number;
    patient_id: number;
    metric_name: string;
    value: number;
    unit?: string;
    notes?: string;
    recorded_at: string;
}

export const AppointmentStatus = {
    SCHEDULED: 'scheduled',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    NO_SHOW: 'no_show',
    RESCHEDULE_REQUESTED: 'reschedule_requested'
} as const;
export type AppointmentStatus = typeof AppointmentStatus[keyof typeof AppointmentStatus];

export interface Appointment {
    id: number;
    patient_id: number;
    doctor_id: number;
    appointment_date: string;
    requested_new_date?: string;
    duration_minutes: number;
    status: AppointmentStatus;
    reason: string;
    notes?: string;
    patient?: Patient;
    doctor?: User;
}

export const AlertSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
} as const;
export type AlertSeverity = typeof AlertSeverity[keyof typeof AlertSeverity];

export interface Alert {
    id: number;
    patient_id: number;
    severity: AlertSeverity;
    title: string;
    description: string;
    recommended_actions: string[];
    is_resolved: boolean;
    create_at: string;
    resolved_at?: string;
}

export interface Document {
    id: number;
    patient_id: number;
    filename: string;
    file_type: string;
    document_type: string;
    upload_date: string;
    file_path: string;
    extracted_data?: any;
}

export interface HealthReport {
    id: number;
    patient_id: number;
    report_date: string;
    report_type: string;
    report_data: any;
    pdf_path?: string;
}
