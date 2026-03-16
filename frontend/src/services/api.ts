import axios from 'axios';
import type { Appointment } from '../types';
import { auth } from './firebase';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add request interceptor to add auth token
api.interceptors.request.use(
    async (config) => {
        // Fetch the current Firebase ID token
        const user = auth.currentUser;
        if (user) {
            const token = await user.getIdToken();
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            // Redirect to login if unauthorized
            auth.signOut().then(() => {
                window.location.href = '/login';
            });
        }
        return Promise.reject(error);
    }
);

export default api;

// Patients API
export const patientsAPI = {
    getAll: () => api.get('/patients/'),
    getById: (id: string) => api.get(`/patients/${id}`),
    create: (data: any) => api.post('/patients/', data),
    update: (id: string, data: any) => api.put(`/patients/${id}`, data),
    search: (query: string) => api.get('/patients/search', { params: { query } }),
    getMyProfile: () => api.get('/patients/me'),
    registerByDoctor: (userData: any, patientData: any) =>
        api.post('/patients/register', { user_data: userData, patient_data: patientData }),
    getHealthMetrics: (patientId: string) => api.get<any[]>(`/patients/${patientId}/health-metrics`),
    logHealthMetric: (patientId: string, data: any) => api.post<any>(`/patients/${patientId}/health-metrics`, data),
    getMedicalRecords: (patientId: string) => api.get<any[]>(`/patients/${patientId}/medical-records`),
    getMedications: (patientId: string) => api.get<any[]>(`/patients/${patientId}/medications`),
    searchRecords: (patientId: string, query: string) => api.get(`/patients/${patientId}/search-records`, { params: { query } }),
};

// Appointments API
export const appointmentsAPI = {
    getAll: (params?: any) => api.get<Appointment[]>('/appointments/', { params }),
    getById: (id: string) => api.get<Appointment>(`/appointments/${id}`),
    create: (data: any) => api.post<Appointment>('/appointments/', data),
    update: (id: string, data: any) => api.put<Appointment>(`/appointments/${id}`, data),
    cancel: (id: string) => api.delete(`/appointments/${id}`),
    getDoctors: () => api.get<any[]>('/appointments/doctors'),
    requestReschedule: (id: string, requested_new_date: string) =>
        api.post<Appointment>(`/appointments/${id}/request-reschedule`, { requested_new_date }),
    approveReschedule: (id: string) =>
        api.post<Appointment>(`/appointments/${id}/approve-reschedule`),
    rejectReschedule: (id: string) =>
        api.post<Appointment>(`/appointments/${id}/reject-reschedule`),
};

// Alerts API
export const alertsAPI = {
    getAll: (params?: any) => api.get('/alerts/', { params }),
    getActive: () => api.get('/alerts/', { params: { is_resolved: false } }),
    getById: (id: string) => api.get(`/alerts/${id}`),
    resolve: (id: string) => api.put(`/alerts/${id}/resolve`),
    triggerEmergency: (data: any) => api.post('/alerts/emergency', data),
};

// Diagnosis API
export const diagnosisAPI = {
    analyze: (symptoms: string[], patientId?: string) => api.post('/diagnosis/analyze', { symptoms, patient_id: patientId }),
    getHistory: (patientId: string) => api.get(`/diagnosis/history/${patientId}`),
};

// Documents API
export const documentsAPI = {
    getAll: (patientId: string) => api.get(`/documents/patient/${patientId}`),
    upload: (patientId: string, file: File, type: string, processVector: boolean = false) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_type', type);
        return api.post(`/documents/upload?patient_id=${patientId}&document_type=${type}&process_vector=${processVector}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    delete: (id: string) => api.delete(`/documents/${id}`),
    searchAI: (patientId: string, query: string) => api.get(`/documents/search/${patientId}`, { params: { query } }),
};

// Reports API
export const reportsAPI = {
    get: (patientId: string) => api.get(`/reports/patient/${patientId}`),
    generate: (patientId: string, type: string = "summary") => api.post(`/reports/`, null, { params: { patient_id: patientId, report_type: type } }),
    downloadPDF: (reportId: string) =>
        api.get(`/reports/${reportId}/pdf`, { responseType: 'blob' })
            .then(response => {
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `health-report-${reportId}.pdf`);
                document.body.appendChild(link);
                link.click();
            }),
};

// Admin API
export const adminAPI = {
    getDoctors: () => api.get('/admin/doctors'),
    createDoctor: (data: any) => api.post('/admin/doctors', data),
    deactivateDoctor: (id: string) => api.put(`/admin/doctors/${id}/deactivate`),
    activateDoctor: (id: string) => api.put(`/admin/doctors/${id}/activate`),
    getPatients: () => api.get('/admin/patients'),
    getUsers: (role?: string) => api.get('/admin/users', { params: { role } }),
    getStats: () => api.get('/admin/stats'),
};

// Encounters API
export const encountersAPI = {
    getByPatientId: (patientId: string) => api.get<any[]>(`/encounters/${patientId}`),
    create: (patientId: string, data: any) => api.post(`/encounters/${patientId}`, data),
    addPrescription: (encounterId: string, data: any) => api.post(`/encounters/${encounterId}/prescribe`, data),
};

// Communications API
export const communicationsAPI = {
    getInbox: (userId: string) => api.get<any[]>(`/communications/${userId}`),
    send: (data: any) => api.post('/communications/send', data),
    markAsRead: (messageId: string) => api.put(`/communications/${messageId}/read`),
    getNotifications: (userId: string) => api.get<any[]>(`/communications/notifications/${userId}`),
    markNotificationRead: (id: string) => api.put(`/communications/notifications/${id}/read`),
};

// Feedback API
export const feedbackAPI = {
    submit: (data: any) => api.post('/feedback/', data),
    getAll: () => api.get('/feedback/'),
    resolve: (id: string, notes: string) => api.put(`/feedback/${id}/resolve`, { admin_notes: notes }),
};

// Auth Extensions API
export const authAPI = {
    updateMe: (data: any) => api.put('/auth/me', data),
};
