import api from './api';
import type { Document } from '../types';

export const getDocuments = async (): Promise<Document[]> => {
    const response = await api.get<Document[]>('/documents');
    return response.data;
};

export const uploadDocument = async (file: File, documentType: string): Promise<Document> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);

    const response = await api.post<Document>('/documents/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

export const deleteDocument = async (id: number): Promise<void> => {
    await api.delete(`/documents/${id}`);
};
