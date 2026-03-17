import React, { useState } from 'react';
import { patientsAPI, appointmentsAPI } from '../services/api';
import api from '../services/api';
import {
    Search, User, FileText, Activity, Calendar,
    Pill, PlusCircle, Info,
    X, CheckCircle, AlertCircle, Bed, Eye, Download, Trash2
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { reportsAPI, documentsAPI } from '../services/api';
import CommunicationModal from '../components/CommunicationModal';
import { Send } from 'lucide-react';

const safeFormat = (dateStr: any, formatStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isValid(d) ? format(d, formatStr) : 'Invalid Date';
};

type Section = 'profile' | 'history' | 'metrics' | 'appointments' | 'ip' | 'documents' | 'reports';
const TABS: { id: Section; label: string; icon: any }[] = [
    { id: 'profile', label: 'Patient Profile', icon: User },
    { id: 'ip', label: 'IP Management', icon: Bed },
    { id: 'history', label: 'Medical History', icon: FileText },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'metrics', label: 'Health Metrics', icon: Activity },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
];

interface IPEntry {
    id?: string;
    admission_date: string;
    discharge_date?: string;
    reason: string;
    ward?: string;
    bed_number?: string;
    attending_doctor?: string;
    notes?: string;
    status: 'admitted' | 'discharged';
}

const DoctorPatientView: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [patientId, setPatientId] = useState('');
    const [patient, setPatient] = useState<any>(null);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
    const [healthMetrics, setHealthMetrics] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [patientDocuments, setPatientDocuments] = useState<any[]>([]);
    const [ipHistory, setIpHistory] = useState<IPEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [activeTab, setActiveTab] = useState<Section>('profile');

    // IP Management state
    const [showAddIP, setShowAddIP] = useState(false);
    const [ipForm, setIpForm] = useState<Partial<IPEntry>>({
        admission_date: new Date().toISOString().split('T')[0],
        reason: '', ward: '', bed_number: '', attending_doctor: '', notes: '', status: 'admitted',
    });
    const [ipSubmitting, setIpSubmitting] = useState(false);
    const [ipSuccess, setIpSuccess] = useState('');

    // Document Upload state
    const [uploading, setUploading] = useState(false);
    const [processVector, setProcessVector] = useState(true);
    const [uploadType, setUploadType] = useState('clinical_report');

    // Health Metrics Logic
    const [showMetricForm, setShowMetricForm] = useState(false);
    const [metricSubmitting, setMetricSubmitting] = useState(false);
    const [newMetric, setNewMetric] = useState({ metric_name: 'blood_pressure', value: '', unit: 'mmHg', notes: '' });

    // AI Search & Reports state
    const [aiSearchResults, setAiSearchResults] = useState<any[]>([]);
    const [aiAnswer, setAiAnswer] = useState<string>('');
    const [aiSearchQuery, setAiSearchQuery] = useState<string>('');
    const [aiSearchLoading, setAiSearchLoading] = useState(false);
    const [patientReports, setPatientReports] = useState<any[]>([]);
    const [reportGenerating, setReportGenerating] = useState(false);
    const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

    // Communication state
    const [isCommunicationModalOpen, setIsCommunicationModalOpen] = useState(false);

    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const query = params.get('query');
        if (query) {
            setPatientId(query);
            // Trigger search manually since we can't easily call handleSearch without an event
            // Better to extract search logic into a reusable function
        }
    }, []);

    const performSearch = async (query: string) => {
        if (!query) return;
        setError('');
        setIsLoading(true);
        setPatient(null);
        setSearchResults([]);

        try {
            // First, try as a search query
            const searchRes = await patientsAPI.search(query);

            if (searchRes.data && searchRes.data.length > 0) {
                if (searchRes.data.length === 1) {
                    await selectPatient(searchRes.data[0]);
                } else {
                    setSearchResults(searchRes.data);
                }
            } else {
                // If search fails, try directly as ID
                try {
                    const patRes = await patientsAPI.getById(query);
                    await selectPatient(patRes.data);
                } catch (e) {
                    setError('No patient found matching "' + query + '"');
                }
            }
        } catch (err: any) {
            console.error('Search error:', err);
            setError('Failed to search patients.');
        } finally {
            setIsLoading(false);
        }
    };

    const selectPatient = async (p: any) => {
        setIsLoading(true);
        setPatient(p);
        setSearchResults([]);
        const id = p.id;
        try {
            const [recsRes, metricsRes, aptsRes, ipRes, docsRes, reportsRes] = await Promise.all([
                api.get(`/patients/${id}/medical-records`),
                patientsAPI.getHealthMetrics(id),
                appointmentsAPI.getAll({ patient_id: id }),
                api.get(`/patients/${id}/ip-records`).catch(() => ({ data: [] })),
                api.get(`/documents/patient/${id}`).catch(() => ({ data: [] })),
                reportsAPI.get(id).catch(() => ({ data: [] }))
            ]);
            setMedicalRecords(recsRes.data || []);
            setHealthMetrics(metricsRes.data || []);
            setAppointments(aptsRes.data || []);
            setIpHistory(ipRes.data || []);
            setPatientDocuments(docsRes.data || []);
            setPatientReports(reportsRes.data || []);
        } catch (err) {
            console.error('Load patient data error:', err);
            setError('Failed to load full record.');
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        const search = searchParams.get('search') || searchParams.get('query');
        if (search) {
            setPatientId(search);
            performSearch(search);
        }
    }, [searchParams]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        performSearch(patientId.trim());
    };

    const handleAddIPRecord = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patient) return;

        setIpSubmitting(true);
        try {
            const res = await api.post(`/patients/${patient.id}/ip-records`, ipForm);
            setIpHistory(prev => [res.data, ...prev]);
            setIpSuccess('IP record added successfully!');
            setShowAddIP(false);
            setIpForm({
                admission_date: new Date().toISOString().split('T')[0],
                reason: '', ward: '', bed_number: '', attending_doctor: '', notes: '', status: 'admitted',
            });
        } catch (err) {
            console.error('Error adding IP:', err);
            alert('Failed to save IP record.');
        } finally {
            setIpSubmitting(false);
        }
    };

    const handleDischargeIP = async (recordId: string) => {
        if (!patient || !window.confirm('Are you sure you want to discharge this patient?')) return;
        
        try {
            const res = await patientsAPI.updateIPRecord(patient.id, recordId, {
                status: 'discharged',
                discharge_date: new Date().toISOString()
            });
            // Update local state
            setIpHistory(prev => prev.map(rec => rec.id === recordId ? res.data : rec));
            alert('Patient discharged successfully!');
        } catch (err) {
            console.error('Discharge error:', err);
            alert('Failed to discharge patient.');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !patient) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('document_type', uploadType);

            // Use query params for basic settings
            const res = await api.post(`/documents/upload?patient_id=${patient.id}&document_type=${uploadType}&process_vector=${processVector}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setPatientDocuments(prev => [res.data, ...prev]);
            alert('Document uploaded successfully!');
        } catch (err) {
            console.error('Upload error:', err);
            alert('Failed to upload document.');
        } finally {
            setUploading(false);
            e.target.value = ''; // Reset input
        }
    };

    const handleDocumentView = async (doc: any) => {
        try {
            const response = await documentsAPI.view(doc.id);
            const blob = new Blob([response.data], { type: response.headers['content-type'] });
            const viewUrl = window.URL.createObjectURL(blob);
            window.open(viewUrl, '_blank');
        } catch (error) {
            console.error('View error:', error);
            alert("Failed to open document. Please try downloading it instead.");
        }
    };

    const handleDocumentDownload = (doc: any) => {
        const downloadUrl = documentsAPI.getDownloadURL(doc.id);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', doc.filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleDocumentDelete = async (docId: string) => {
        if (!window.confirm('Are you sure you want to delete this document?')) return;
        try {
            await documentsAPI.delete(docId);
            setPatientDocuments(prev => prev.filter(d => d.id !== docId));
        } catch (err) {
            console.error('Delete error:', err);
            alert('Failed to delete document.');
        }
    };

    const handleLogMetric = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patient) return;
        setMetricSubmitting(true);

        // Optimistic update: show metric immediately in the UI
        const optimisticMetric = {
            id: `temp-${Date.now()}`,
            patient_id: patient.id,
            ...newMetric,
            value: parseFloat(newMetric.value) || 0,
            recorded_at: new Date().toISOString(),
        };
        setHealthMetrics(prev => [optimisticMetric, ...prev]);
        setShowMetricForm(false);
        const prevMetricState = { ...newMetric };
        setNewMetric({ metric_name: 'blood_pressure', value: '', unit: 'mmHg', notes: '' });

        try {
            const res = await patientsAPI.logHealthMetric(patient.id, {
                ...prevMetricState,
                value: parseFloat(prevMetricState.value) || 0
            });
            // Replace the optimistic entry with the real server response
            setHealthMetrics(prev => prev.map(m => m.id === optimisticMetric.id ? res.data : m));
        } catch (error) {
            console.error('Error logging metric:', error);
            // Rollback optimistic update on failure
            setHealthMetrics(prev => prev.filter(m => m.id !== optimisticMetric.id));
            setShowMetricForm(true);
            setNewMetric(prevMetricState);
            alert("Failed to save health metric.");
        } finally {
            setMetricSubmitting(false);
        }
    };

    const handleAISearch = async (query: string) => {
        if (!query || !patient) return;
        setAiSearchLoading(true);
        try {
            const res = await documentsAPI.searchAI(patient.id, query);
            // res.data now contains { query, answer, results }
            setAiSearchResults(res.data.results || []);
            setAiAnswer(res.data.answer || '');
        } catch (err) {
            console.error('AI Search error:', err);
            alert('Failed to perform semantic search.');
        } finally {
            setAiSearchLoading(false);
        }
    };

    const handleGenerateReport = async () => {
        if (!patient) return;
        setReportGenerating(true);
        try {
            const res = await reportsAPI.generate(patient.id);
            setPatientReports(prev => [res.data, ...prev]);
            alert('Health report generated successfully with AI insights!');
        } catch (err) {
            console.error('Report error:', err);
            alert('Failed to generate report.');
        } finally {
            setReportGenerating(false);
        }
    };

    const handleDeleteReport = async (reportId: string) => {
        if (!window.confirm("Are you sure you want to delete this report?")) return;
        
        try {
            await reportsAPI.delete(reportId);
            setPatientReports(prev => prev.filter(r => r.id !== reportId));
            if (expandedReportId === reportId) setExpandedReportId(null);
            alert("Report deleted successfully");
        } catch (err) {
            console.error('Delete report error:', err);
            alert('Failed to delete report.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="bg-green-100 p-3 rounded-lg mr-4">
                    <User className="h-6 w-6 text-green-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Patient Medical Records</h1>
                    <p className="text-gray-500">Search by Patient ID to view complete medical data and manage inpatient records</p>
                </div>
                {patient && (
                    <div className="ml-auto">
                        <button
                            onClick={() => navigate(`/encounter/${patient.id}`)}
                            className="btn-primary flex items-center gap-2"
                        >
                            <PlusCircle className="h-5 w-5" />
                            <span>Start Clinical Encounter</span>
                        </button>
                        <button
                            onClick={() => setIsCommunicationModalOpen(true)}
                            className="btn-secondary flex items-center gap-2 ml-2"
                        >
                            <Send className="h-5 w-5" />
                            <span>Message Patient</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex gap-3">
                <div className="relative flex-1 max-w-lg">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        className="input-field pl-10"
                        placeholder="Search by Name, Medical ID, or Email..."
                        value={patientId}
                        onChange={(e) => setPatientId(e.target.value)}
                    />
                </div>
                <button type="submit" className="btn-primary flex items-center gap-2" disabled={isLoading}>
                    <Search className="h-4 w-4" />{isLoading ? 'Searching...' : 'Search Patient'}
                </button>
            </form>

            {searchResults.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                        <h3 className="font-bold text-gray-700">Multiple Patients Found</h3>
                        <button onClick={() => setSearchResults([])} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {searchResults.map(p => (
                            <div
                                key={p.id}
                                className="p-4 hover:bg-primary-50 cursor-pointer flex justify-between items-center transition-colors"
                                onClick={() => selectPatient(p)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-primary-100 p-2 rounded-full">
                                        <User className="h-4 w-4 text-primary-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">{p.user?.full_name}</p>
                                        <p className="text-xs text-gray-500 font-mono">{p.medical_id} | {p.email || p.user?.email}</p>
                                    </div>
                                </div>
                                <button className="text-xs font-bold text-primary-600 px-3 py-1 bg-white border border-primary-200 rounded-lg shadow-sm">Select</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />{error}
                </div>
            )}

            {patient && (
                <div className="space-y-6">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 overflow-x-auto no-scrollbar">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id
                                    ? 'border-primary-600 text-primary-600 bg-primary-50/30'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                                {tab.id === 'ip' && ipHistory.length > 0 && (
                                    <span className="ml-1 bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded-full">{ipHistory.length}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {activeTab === 'profile' && (
                            <div className="bg-white rounded-xl border border-gray-100 p-6 grid grid-cols-2 md:grid-cols-4 gap-5">
                                {[
                                    { label: 'Full Name', value: patient.user?.full_name || '—' },
                                    { label: 'Medical ID', value: patient.medical_id || '—', mono: true },
                                    { label: 'Gender', value: patient.gender || '—' },
                                    { label: 'Blood Type', value: patient.blood_type || '—', badge: 'red' },
                                    { label: 'Email', value: patient.email || patient.user?.email || '—' },
                                    { label: 'Phone', value: patient.phone || '—' },
                                    { label: 'Emergency Contact', value: patient.emergency_contact || '—' },
                                    { label: 'Emergency Phone', value: patient.emergency_phone || '—' },
                                ].map(({ label, value, mono, badge }) => (
                                    <div key={label} className="bg-gray-50 rounded-lg p-3">
                                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">{label}</p>
                                        {badge ? (
                                            <span className="bg-red-100 text-red-700 text-sm font-bold px-2 py-0.5 rounded">{value}</span>
                                        ) : (
                                            <p className={`text-sm font-semibold text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</p>
                                        )}
                                    </div>
                                ))}
                                {patient.allergies?.length > 0 && (
                                    <div className="col-span-2 bg-red-50 rounded-lg p-3">
                                        <p className="text-xs text-red-600 font-semibold uppercase tracking-wide mb-1">⚠️ Allergies</p>
                                        <p className="text-sm font-semibold text-red-800">{patient.allergies.join(', ')}</p>
                                    </div>
                                )}
                                {patient.current_medications?.length > 0 && (
                                    <div className="col-span-2 bg-amber-50 rounded-lg p-3">
                                        <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1"><Pill className="h-3 w-3" />Current Medications</p>
                                        <p className="text-sm font-semibold text-amber-900">{patient.current_medications.join(', ')}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'ip' && (
                            <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
                                <div className="flex justify-end">
                                    <button
                                        className="btn-primary flex items-center gap-2 text-sm"
                                        onClick={() => { setShowAddIP(true); setIpSuccess(''); }}
                                    >
                                        <PlusCircle className="h-4 w-4" /> Add IP Record
                                    </button>
                                </div>

                                {ipSuccess && (
                                    <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4" />{ipSuccess}
                                    </div>
                                )}

                                {showAddIP && (
                                    <div className="border border-purple-100 bg-purple-50/40 rounded-xl p-5">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-gray-900">New Inpatient Admission</h3>
                                            <button onClick={() => setShowAddIP(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                                        </div>
                                        <form onSubmit={handleAddIPRecord} className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Admission Date</label>
                                                <input type="date" required className="input-field" value={ipForm.admission_date} onChange={e => setIpForm(p => ({ ...p, admission_date: e.target.value }))} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                                                <select className="input-field" value={ipForm.status} onChange={e => setIpForm(p => ({ ...p, status: e.target.value as any }))}>
                                                    <option value="admitted">Admitted</option>
                                                    <option value="discharged">Discharged</option>
                                                </select>
                                            </div>
                                            {ipForm.status === 'discharged' && (
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Discharge Date</label>
                                                    <input type="date" className="input-field" value={ipForm.discharge_date} onChange={e => setIpForm(p => ({ ...p, discharge_date: e.target.value }))} />
                                                </div>
                                            )}
                                            <div className="col-span-2">
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Reason for Admission</label>
                                                <input required className="input-field" placeholder="Chief complaint / diagnosis" value={ipForm.reason} onChange={e => setIpForm(p => ({ ...p, reason: e.target.value }))} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Ward</label>
                                                <input className="input-field" placeholder="e.g. Cardiology Ward A" value={ipForm.ward} onChange={e => setIpForm(p => ({ ...p, ward: e.target.value }))} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Bed Number</label>
                                                <input className="input-field" placeholder="e.g. B-12" value={ipForm.bed_number} onChange={e => setIpForm(p => ({ ...p, bed_number: e.target.value }))} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Attending Doctor</label>
                                                <input className="input-field" placeholder="Doctor name" value={ipForm.attending_doctor} onChange={e => setIpForm(p => ({ ...p, attending_doctor: e.target.value }))} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                                                <input className="input-field" placeholder="Additional notes" value={ipForm.notes} onChange={e => setIpForm(p => ({ ...p, notes: e.target.value }))} />
                                            </div>
                                            <div className="col-span-2 flex justify-end gap-3">
                                                <button type="button" onClick={() => setShowAddIP(false)} className="btn-secondary text-sm">Cancel</button>
                                                <button type="submit" disabled={ipSubmitting} className="btn-primary text-sm">{ipSubmitting ? 'Saving...' : 'Save IP Record'}</button>
                                            </div>
                                        </form>
                                    </div>
                                )}

                                {ipHistory.length === 0 ? (
                                    <p className="text-center text-gray-400 py-6">No inpatient records found for this patient.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {ipHistory.map((ip) => (
                                            <div key={ip.id || ip.admission_date} className={`p-4 rounded-xl border ${ip.status === 'admitted' ? 'border-purple-200 bg-purple-50/30' : 'border-gray-200 bg-gray-50/30'}`}>
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Bed className="h-4 w-4 text-purple-500" />
                                                        <span className="font-bold text-gray-900">{ip.reason}</span>
                                                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${ip.status === 'admitted' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'}`}>
                                                            {ip.status === 'admitted' ? '🏥 Admitted' : '✓ Discharged'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {ip.status === 'admitted' && (
                                                            <button
                                                                onClick={() => handleDischargeIP(ip.id!)}
                                                                className="text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded shadow-sm"
                                                            >
                                                                Discharge Patient
                                                            </button>
                                                        )}
                                                        <span className="text-xs text-gray-400">{safeFormat(ip.admission_date, 'dd MMM yyyy')}</span>
                                                    </div>
                                                </div>
                                                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-600">
                                                    {ip.ward && <span><strong>Ward:</strong> {ip.ward}</span>}
                                                    {ip.bed_number && <span><strong>Bed:</strong> {ip.bed_number}</span>}
                                                    {ip.attending_doctor && <span><strong>Doctor:</strong> {ip.attending_doctor}</span>}
                                                    {ip.discharge_date && <span><strong>Discharged:</strong> {safeFormat(ip.discharge_date, 'dd MMM yyyy')}</span>}
                                                    {ip.notes && <span className="col-span-3 italic">{ip.notes}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
                                {medicalRecords.length === 0 ? (
                                    <p className="text-center text-gray-400 py-6">No medical records found.</p>
                                ) : medicalRecords.map((rec, i) => (
                                    <div key={rec.id || i} className="border border-gray-100 rounded-xl p-5 hover:shadow-sm transition-shadow">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="font-bold text-gray-900">{rec.diagnosis || 'Diagnosis pending'}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {safeFormat(rec.visit_date, 'dd MMM yyyy, HH:mm')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            {rec.symptoms?.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Symptoms</p>
                                                    <p className="text-gray-700">{rec.symptoms.join(', ')}</p>
                                                </div>
                                            )}
                                            {rec.treatment_plan && (
                                                <div>
                                                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Treatment Plan</p>
                                                    <p className="text-gray-700">{rec.treatment_plan}</p>
                                                </div>
                                            )}
                                            {rec.vitals && Object.keys(rec.vitals).length > 0 && (
                                                <div className="col-span-2">
                                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Vitals</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(rec.vitals).map(([k, v]) => (
                                                            <span key={k} className="text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded">
                                                                {k.replace(/_/g, ' ')}: <strong>{String(v)}</strong>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'metrics' && (
                            <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
                                <div className="flex justify-end">
                                    <button className="btn-primary text-sm flex items-center gap-2" onClick={() => setShowMetricForm(!showMetricForm)}>
                                        <PlusCircle className="h-4 w-4" /> Add Metric
                                    </button>
                                </div>

                                {showMetricForm && (
                                    <div className="bg-primary-50 rounded-xl p-4 border border-primary-100 mb-4 animate-in fade-in slide-in-from-top-2">
                                        <h3 className="font-bold text-sm mb-3">Log Health Metric</h3>
                                        <form onSubmit={handleLogMetric} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="text-xs font-bold text-gray-500 uppercase">Metric</label>
                                                <select className="input-field text-sm mt-1" value={newMetric.metric_name} onChange={e => setNewMetric({ ...newMetric, metric_name: e.target.value })}>
                                                    <option value="blood_pressure">Blood Pressure (Systolic)</option>
                                                    <option value="heart_rate">Heart Rate</option>
                                                    <option value="weight">Weight</option>
                                                    <option value="temperature">Temperature</option>
                                                    <option value="blood_sugar">Blood Sugar</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Value</label>
                                                <input required type="number" step="any" className="input-field text-sm mt-1" value={newMetric.value} onChange={e => setNewMetric({ ...newMetric, value: e.target.value })} placeholder="e.g. 120" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Unit</label>
                                                <input className="input-field text-sm mt-1" value={newMetric.unit} onChange={e => setNewMetric({ ...newMetric, unit: e.target.value })} placeholder="e.g. mmHg" />
                                            </div>
                                            <div className="col-span-2 md:col-span-4 flex justify-end gap-2 mt-2">
                                                <button type="button" onClick={() => setShowMetricForm(false)} className="btn-secondary text-sm">Cancel</button>
                                                <button type="submit" disabled={metricSubmitting} className="btn-primary text-sm">{metricSubmitting ? 'Saving...' : 'Save Metric'}</button>
                                            </div>
                                        </form>
                                    </div>
                                )}

                                {healthMetrics.length === 0 ? (
                                    <p className="text-center text-gray-400 py-6">No health metrics logged.</p>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {healthMetrics.map((m, i) => (
                                            <div key={m.id || i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                                                    {m.metric_name?.replace(/_/g, ' ')}
                                                </p>
                                                <p className="text-xl font-black text-gray-900">{m.value} <span className="text-xs font-normal text-gray-400">{m.unit}</span></p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {safeFormat(m.recorded_at, 'dd MMM yyyy, HH:mm')}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'appointments' && (
                            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                                {appointments.length === 0 ? (
                                    <p className="text-center text-gray-400 py-6">No appointments found.</p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                                            <tr>
                                                <th className="px-5 py-3 text-left">Date & Time</th>
                                                <th className="px-5 py-3 text-left">Doctor</th>
                                                <th className="px-5 py-3 text-left">Reason</th>
                                                <th className="px-5 py-3 text-left">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {appointments.map((apt) => (
                                                <tr key={apt.id} className="hover:bg-gray-50">
                                                    <td className="px-5 py-3 text-gray-700">{safeFormat(apt.appointment_date, 'dd MMM yyyy, HH:mm')}</td>
                                                    <td className="px-5 py-3 text-gray-700">{apt.doctor?.full_name || '—'}</td>
                                                    <td className="px-5 py-3 text-gray-600">{apt.reason || '—'}</td>
                                                    <td className="px-5 py-3">
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded capitalize ${apt.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                                                            apt.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                                apt.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                                    'bg-gray-100 text-gray-600'
                                                            }`}>{apt.status}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}

                        {activeTab === 'documents' && (
                            <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
                                <div className="bg-primary-50 rounded-xl p-6 border border-primary-100">
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <PlusCircle className="h-5 w-5 text-primary-600" />
                                        Upload Medical Document
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-lg border border-primary-50">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Document Type</label>
                                            <select
                                                className="input-field bg-gray-50 text-sm"
                                                value={uploadType}
                                                onChange={e => setUploadType(e.target.value)}
                                            >
                                                <option value="clinical_report">Clinical Report</option>
                                                <option value="lab_result">Lab Result</option>
                                                <option value="prescription">Prescription</option>
                                                <option value="imaging">Imaging/Scan</option>
                                                <option value="discharge_summary">Discharge Summary</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col justify-end">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <input
                                                    type="checkbox"
                                                    id="vectorProcess"
                                                    checked={processVector}
                                                    onChange={e => setProcessVector(e.target.checked)}
                                                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                                />
                                                <label htmlFor="vectorProcess" className="text-sm font-bold text-gray-700 flex items-center gap-1">
                                                    Process with Vector DB (RAG) <Info className="h-3 w-3 text-gray-400" />
                                                </label>
                                            </div>
                                            <p className="text-[10px] text-gray-500">Enables AI-powered semantic search across this document's content.</p>
                                        </div>
                                        <div className="flex items-end">
                                            <label className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-sm cursor-pointer transition-all ${uploading ? 'bg-gray-100 text-gray-400' : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200'}`}>
                                                {uploading ? <Activity className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                                                {uploading ? 'Uploading...' : 'Choose File & Upload'}
                                                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="font-bold text-gray-500 text-xs uppercase tracking-wider px-2">Patient Document Library</h3>
                                    {patientDocuments.length === 0 ? (
                                        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                                            <p className="text-sm text-gray-500 font-medium">No documents uploaded for this patient.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {patientDocuments.map((doc) => (
                                                <div key={doc.id} className="p-4 rounded-xl border border-gray-100 bg-white hover:border-primary-200 hover:shadow-sm transition-all flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-gray-100 p-2.5 rounded-lg">
                                                            <FileText className="h-5 w-5 text-gray-500" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-900 line-clamp-1">{doc.filename}</p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-black uppercase">{doc.document_type?.replace(/_/g, ' ')}</span>
                                                                {doc.is_vectorized && (
                                                                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-0.5" title={`${doc.chunks_count || 0} chunks indexed`}>
                                                                        <CheckCircle className="h-3 w-3" /> Vector Ready
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleDocumentView(doc)}
                                                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                                            title="View"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDocumentDownload(doc)}
                                                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                                            title="Download"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDocumentDelete(doc.id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="pt-6 border-t border-gray-100">
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <Search className="h-5 w-5 text-primary-600" />
                                        Semantic Search (AI Insights)
                                    </h3>
                                    <div className="bg-gray-900 rounded-xl p-6 text-white shadow-xl">
                                        <p className="text-xs text-gray-400 mb-4 font-medium uppercase tracking-widest">Query indexed records using natural language</p>
                                        <div className="flex gap-2 mb-6">
                                            <input
                                                className="flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-500 rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-primary-500 outline-none"
                                                placeholder="e.g. Find mention of previous cardiac surgeries or chronic conditions..."
                                                value={aiSearchQuery}
                                                onChange={(e) => setAiSearchQuery(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleAISearch(aiSearchQuery);
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={() => handleAISearch(aiSearchQuery)}
                                                disabled={aiSearchLoading || !aiSearchQuery.trim()}
                                                className="bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
                                            >
                                                {aiSearchLoading ? 'Searching...' : 'Search'}
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {aiAnswer && (
                                                <div className="p-5 bg-gradient-to-r from-primary-900 to-indigo-900 rounded-xl border border-primary-500 shadow-lg animate-in fade-in zoom-in-95 duration-500">
                                                    <div className="flex items-center gap-2 mb-3 text-primary-400">
                                                        <Activity className="h-5 w-5 animate-pulse" />
                                                        <h4 className="text-sm font-black uppercase tracking-widest">AI Synthesis</h4>
                                                    </div>
                                                    <p className="text-sm text-white leading-relaxed font-medium italic">
                                                        "{aiAnswer}"
                                                    </p>
                                                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                                                        <span className="text-[10px] text-primary-300 font-bold uppercase tracking-tight">Verified against medical records</span>
                                                        <span className="text-[10px] text-gray-400 italic">References below</span>
                                                    </div>
                                                </div>
                                            )}

                                            {aiSearchResults.length === 0 && !aiSearchLoading && !aiAnswer && (
                                                <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                                                    <p className="text-xs italic text-gray-400">Search results will appear here after searching indexed documents...</p>
                                                </div>
                                            )}

                                            {aiSearchResults.length > 0 && (
                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest pl-1 mt-6 mb-2">Source References</p>
                                            )}
                                            <div className="flex flex-wrap gap-3 mt-2 mb-4">
                                                {Array.from(new Set(aiSearchResults.map(res => res.metadata?.filename || 'Untitled Document'))).map((filename, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 border-l-4 border-l-primary-500 shadow-lg animate-in fade-in slide-in-from-left-2 transition-all hover:bg-gray-750">
                                                        <FileText className="h-3.5 w-3.5 text-primary-500" />
                                                        <span className="text-xs font-bold text-white tracking-tight">{filename}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="mt-8 pt-6 border-t border-gray-800">
                                            <h4 className="text-sm font-bold text-primary-400 mb-3 flex items-center gap-2">
                                                <Info className="h-4 w-4" /> What Happens Next?
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
                                                    <p className="text-xs font-bold text-gray-300 mb-1">Report Generation</p>
                                                    <p className="text-[11px] text-gray-400 leading-normal">When you generate a "Health Report" for the patient, the AI will automatically pull insights from these vectorized documents to make the report more accurate.</p>
                                                </div>
                                                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
                                                    <p className="text-xs font-bold text-gray-300 mb-1">Clinical Support</p>
                                                    <p className="text-[11px] text-gray-400 leading-normal">The AI diagnosis agent will also have access to the "Vector DB" data to provide better treatment recommendations based on the patient's full history.</p>
                                                </div>
                                            </div>
                                            <p className="mt-4 text-[10px] text-gray-500 italic">Pro-Tip: For the best AI performance, upload documents in Text (.txt), Markdown (.md), or PDF format.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'reports' && (
                            <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-gray-900">Health Reports</h3>
                                        <p className="text-xs text-gray-500">AI-synthesized patient health summaries</p>
                                    </div>
                                    <button
                                        disabled={reportGenerating}
                                        onClick={handleGenerateReport}
                                        className="btn-primary flex items-center gap-2"
                                    >
                                        {reportGenerating ? <Activity className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                                        Generate AI Summary Report
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {patientReports.length === 0 ? (
                                        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                            <p className="text-sm text-gray-500 font-medium">No reports generated yet.</p>
                                            <p className="text-xs text-gray-400 mt-1">Click the button above to synthesize data into a summary.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            {patientReports.map((report) => (
                                                <div key={report.id} className="p-5 rounded-xl border border-gray-100 bg-white hover:border-primary-200 shadow-sm transition-all">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-primary-50 p-2.5 rounded-lg">
                                                                <FileText className="h-6 w-6 text-primary-600" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-gray-900 capitalize">{report.report_type} Health Report</h4>
                                                                <p className="text-xs text-gray-500">{safeFormat(report.created_at, 'dd MMMM yyyy, HH:mm')}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setExpandedReportId(expandedReportId === report.id ? null : report.id)}
                                                                className="text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                                            >
                                                                {expandedReportId === report.id ? "Hide Details" : "View Details"}
                                                            </button>
                                                            <button
                                                                onClick={() => reportsAPI.downloadPDF(report.id)}
                                                                className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                                            >
                                                                <FileText className="h-3 w-3" /> PDF
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteReport(report.id)}
                                                                className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {expandedReportId === report.id && report.report_data?.ai_insights && (
                                                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                            <p className="text-[10px] font-black text-primary-600 uppercase mb-2 tracking-widest flex items-center gap-1">
                                                                <CheckCircle className="h-3 w-3" /> AI Synthesized Insights
                                                            </p>
                                                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                                                                {typeof report.report_data.ai_insights === 'string'
                                                                    ? report.report_data.ai_insights
                                                                    : (report.report_data.ai_insights as string[]).join('\n')}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Communication Modal */}
            <CommunicationModal
                isOpen={isCommunicationModalOpen}
                onClose={() => setIsCommunicationModalOpen(false)}
                recipientId={patient?.user_id || null}
                recipientName={patient?.user?.full_name || null}
            />
        </div>
    );
};

export default DoctorPatientView;
