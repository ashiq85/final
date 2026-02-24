import api from './api';
import type { Alert } from '../types';

export const getAlerts = async (patientId: number): Promise<Alert[]> => {
    const response = await api.get<Alert[]>(`/alerts/patient/${patientId}`);
    return response.data;
};

export const createAlert = async (alertData: any): Promise<Alert> => {
    const response = await api.post<Alert>('/alerts', alertData);
    return response.data;
};

export const resolveAlert = async (id: number): Promise<Alert> => {
    const response = await api.put<Alert>(`/alerts/${id}/resolve`, {});
    return response.data;
};

export const triggerEmergency = async (data: any): Promise<any> => {
    const response = await api.post('/alerts/emergency', data);
    return response.data;
};
