import api from './api';
import type { Appointment } from '../types';

export const getAppointments = async (): Promise<Appointment[]> => {
    const response = await api.get<Appointment[]>('/appointments');
    return response.data;
};

export const createAppointment = async (appointmentData: any): Promise<Appointment> => {
    const response = await api.post<Appointment>('/appointments', appointmentData);
    return response.data;
};

export const updateAppointmentStatus = async (id: number, status: string): Promise<Appointment> => {
    const response = await api.put<Appointment>(`/appointments/${id}/status`, { status });
    return response.data;
};

export const cancelAppointment = async (id: number): Promise<Appointment> => {
    const response = await api.delete<Appointment>(`/appointments/${id}`);
    return response.data;
};
