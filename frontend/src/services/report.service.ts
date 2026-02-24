import api from './api';
import type { HealthReport } from '../types';

export const getHealthReport = async (patientId: number): Promise<HealthReport> => {
    // Calling POST to generate/fetch the summary
    const response = await api.post<HealthReport>(`/reports/summary/${patientId}`);
    return response.data;
};

export const downloadReportPDF = async (patientId: number): Promise<void> => {
    // This would normally trigger a file download via API or direct link
    window.open(`http://127.0.0.1:8000/reports/${patientId}/pdf`, '_blank');
};
