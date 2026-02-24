import api from './api';

export const analyzeSymptoms = async (symptoms: string[]): Promise<any> => {
    const response = await api.post('/diagnosis/analyze', { symptoms });
    return response.data;
};

export const getDiagnosisHistory = async (patientId: number): Promise<any[]> => {
    const response = await api.get(`/diagnosis/history/${patientId}`);
    return response.data;
};
