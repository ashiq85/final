import React, { useState, useEffect } from 'react';
import { documentsAPI } from '../services/api';
import { FileText, Upload, Trash2, Download, Search, File, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { Document } from '../types';

const Documents: React.FC = () => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [documentType, setDocumentType] = useState('medical_report');
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadDocuments();
    }, []);

    const loadDocuments = async () => {
        try {
            setIsLoading(true);
            const response = await documentsAPI.getAll();
            setDocuments(response.data);
        } catch (error) {
            console.error('Error loading documents:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        try {
            setIsLoading(true);
            await documentsAPI.upload(file, documentType);
            setIsUploadOpen(false);
            setFile(null);
            loadDocuments();
        } catch (error) {
            console.error('Upload error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this document?')) return;
        try {
            await documentsAPI.delete(id);
            loadDocuments();
        } catch (error) {
            console.error('Delete error:', error);
        }
    };

    const filteredDocuments = documents.filter(doc =>
        doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.document_type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Medical Documents</h1>
                    <p className="text-gray-500">Secure storage for your medical records and lab results</p>
                </div>
                <button
                    onClick={() => setIsUploadOpen(!isUploadOpen)}
                    className="btn-primary flex items-center"
                >
                    <Upload className="h-5 w-5 mr-2" />
                    Upload New
                </button>
            </div>

            {/* Upload Area */}
            {isUploadOpen && (
                <div className="card bg-gray-50 border-dashed border-2 border-primary-300 animate-in fade-in zoom-in duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center">
                            <Upload className="h-5 w-5 text-primary-600 mr-2" />
                            Secure File Upload
                        </h2>
                        <button onClick={() => setIsUploadOpen(false)} className="text-gray-400 hover:text-gray-600">Close</button>
                    </div>
                    <form onSubmit={handleUpload} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="label">Document Category</label>
                                <select
                                    className="input-field"
                                    value={documentType}
                                    onChange={(e) => setDocumentType(e.target.value)}
                                >
                                    <option value="medical_report">Clinical Report</option>
                                    <option value="lab_result">Laboratory Result</option>
                                    <option value="prescription">Medical Prescription</option>
                                    <option value="imaging">Medical Imaging (X-Ray/MRI/CT)</option>
                                    <option value="insurance">Insurance Document</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">Select File (PDF, Image)</label>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-primary-400 transition-colors cursor-pointer relative">
                                    <div className="space-y-1 text-center">
                                        <FileText className="mx-auto h-12 w-12 text-gray-400" />
                                        <div className="flex text-sm text-gray-600">
                                            <span className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500">
                                                {file ? file.name : 'Click to select a file'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500">PDF, PNG, JPG up to 10MB</p>
                                    </div>
                                    <input
                                        type="file"
                                        required
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={() => setIsUploadOpen(false)}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn-primary px-8"
                                disabled={isLoading || !file}
                            >
                                {isLoading ? 'Processing...' : 'Upload & Scan'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Search and Filters */}
            <div className="flex items-center space-x-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                        type="text"
                        placeholder="Search by filename or type..."
                        className="input-field pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Document Grid/List */}
            <div className="bg-white shadow rounded-xl overflow-hidden border border-gray-100">
                <ul className="divide-y divide-gray-200">
                    {isLoading && documents.length === 0 ? (
                        <li className="px-6 py-12 text-center text-gray-500 flex flex-col items-center">
                            <Clock className="h-12 w-12 text-gray-300 animate-spin mb-4" />
                            <p>Loading your medical vault...</p>
                        </li>
                    ) : filteredDocuments.length === 0 ? (
                        <li className="px-6 py-12 text-center text-gray-500 flex flex-col items-center">
                            <File className="h-12 w-12 text-gray-300 mb-4" />
                            <p>No documents found matching your search</p>
                        </li>
                    ) : (
                        filteredDocuments.map((doc) => (
                            <li key={doc.id} className="group hover:bg-gray-50 transition-colors duration-150">
                                <div className="px-6 py-5 flex items-center justify-between">
                                    <div className="flex items-center space-x-4 min-w-0">
                                        <div className="h-12 w-12 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 transition-colors">
                                            <FileText className="h-6 w-6 text-primary-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-bold text-gray-900 truncate uppercase mt-1">
                                                {doc.document_type.replace('_', ' ')}
                                            </h3>
                                            <p className="text-sm text-gray-500 font-medium truncate mb-1">
                                                {doc.filename}
                                            </p>
                                            <div className="flex items-center text-xs text-gray-400 space-x-3">
                                                <span className="flex items-center"><Clock className="h-3 w-3 mr-1" /> {format(new Date(doc.upload_date), 'MMM d, yyyy')}</span>
                                                <span className="flex items-center text-green-600 font-bold uppercase"><CheckCircle className="h-3 w-3 mr-1" /> SECURE</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all" title="Download">
                                            <Download className="h-5 w-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(doc.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            title="Delete"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                                {doc.extracted_data && (
                                    <div className="px-6 pb-4 ml-16">
                                        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 border border-gray-100">
                                            <span className="font-bold text-primary-700 mr-2 uppercase tracking-tighter">AI Summary:</span>
                                            {JSON.stringify(doc.extracted_data).substring(0, 150)}...
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))
                    )}
                </ul>
            </div>
        </div>
    );
};

export default Documents;
