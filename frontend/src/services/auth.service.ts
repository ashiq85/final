import api from './api';
import type { AuthResponse, User } from '../types';

export const login = async (credentials: any): Promise<AuthResponse> => {
    const formData = new FormData();
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);

    const response = await api.post<AuthResponse>('/auth/login', formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    return response.data;
};

export const register = async (userData: any): Promise<User> => {
    const response = await api.post<User>('/auth/signup', userData);
    return response.data;
};

export const getCurrentUser = async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
};
