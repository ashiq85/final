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
    getById: (id: number) => api.get(`/patients/${id}`),
    create: (data: any) => api.post('/patients/', data),
    update: (id: number, data: any) => api.put(`/patients/${id}`, data),
    search: (query: string) => api.get('/patients/search', { params: { query } }),
    getMyProfile: () => api.get('/patients/me'),
    registerByDoctor: (userData: any, patientData: any) =>
        api.post('/patients/register', { user_data: userData, patient_data: patientData }),
    getHealthMetrics: (patientId: number) => api.get<any[]>(`/patients/${patientId}/health-metrics`),
    logHealthMetric: (patientId: number, data: any) => api.post<any>(`/patients/${patientId}/health-metrics`, data),
};

// Appointments API
export const appointmentsAPI = {
    getAll: (params?: any) => api.get<Appointment[]>('/appointments/', { params }),
    getById: (id: number) => api.get<Appointment>(`/appointments/${id}`),
    create: (data: any) => api.post<Appointment>('/appointments/', data),
    update: (id: number, data: any) => api.put<Appointment>(`/appointments/${id}`, data),
    cancel: (id: number) => api.delete(`/appointments/${id}`),
    getDoctors: () => api.get<any[]>('/appointments/doctors'),
    requestReschedule: (id: number, requested_new_date: string) =>
        api.post<Appointment>(`/appointments/${id}/request-reschedule`, { requested_new_date }),
    approveReschedule: (id: number) =>
        api.post<Appointment>(`/appointments/${id}/approve-reschedule`),
    rejectReschedule: (id: number) =>
        api.post<Appointment>(`/appointments/${id}/reject-reschedule`),
};

// Alerts API
export const alertsAPI = {
    getAll: (params?: any) => api.get('/alerts/', { params }),
    getActive: () => api.get('/alerts/', { params: { is_resolved: false } }),
    getById: (id: number) => api.get(`/alerts/${id}`),
    resolve: (id: number) => api.put(`/alerts/${id}/resolve`),
    triggerEmergency: (data: any) => api.post('/alerts/emergency', data),
};

// Diagnosis API
export const diagnosisAPI = {
    analyze: (symptoms: string[]) => api.post('/diagnosis/analyze', { symptoms }),
    getHistory: (patientId: number) => api.get(`/diagnosis/history/${patientId}`),
};

// Documents API
export const documentsAPI = {
    getAll: () => api.get('/documents/'),
    upload: (file: File, type: string) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_type', type);
        return api.post('/documents/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    delete: (id: number) => api.delete(`/documents/${id}`),
};

// Reports API
export const reportsAPI = {
    get: (patientId: number) => api.get(`/reports/patient/${patientId}`),
    downloadPDF: (patientId: number) =>
        api.get(`/reports/patient/${patientId}/download`, { responseType: 'blob' })
            .then(response => {
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `health-report-${patientId}.pdf`);
                document.body.appendChild(link);
                link.click();
            }),
};

// Admin API
export const adminAPI = {
    getDoctors: () => api.get('/admin/doctors'),
    createDoctor: (data: any) => api.post('/admin/doctors', data),
    deactivateDoctor: (id: number) => api.put(`/admin/doctors/${id}/deactivate`),
    activateDoctor: (id: number) => api.put(`/admin/doctors/${id}/activate`),
    getPatients: () => api.get('/admin/patients'),
    getUsers: (role?: string) => api.get('/admin/users', { params: { role } }),
    getStats: () => api.get('/admin/stats'),
};
