import React, { useState } from 'react';
import { patientsAPI, appointmentsAPI } from '../services/api';
import api from '../services/api';
import {
    Search, User, FileText, Activity, Calendar,
    Pill, ChevronDown, ChevronUp, PlusCircle,
    X, CheckCircle, AlertCircle, Bed
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';

type Section = 'profile' | 'history' | 'metrics' | 'appointments' | 'ip';
const TABS: { id: Section; label: string; icon: any }[] = [
    { id: 'profile', label: 'Patient Profile', icon: User },
    { id: 'ip', label: 'IP Management', icon: Bed },
    { id: 'history', label: 'Medical History', icon: FileText },
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
    const [patientId, setPatientId] = useState('');
    const [patient, setPatient] = useState<any>(null);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
    const [healthMetrics, setHealthMetrics] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
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
            const [recsRes, metricsRes, aptsRes, ipRes] = await Promise.all([
                api.get(`/patients/${id}/medical-records`),
                patientsAPI.getHealthMetrics(id),
                appointmentsAPI.getAll(),
                api.get(`/patients/${id}/ip-records`).catch(() => ({ data: [] }))
            ]);
            setMedicalRecords(recsRes.data || []);
            setHealthMetrics(metricsRes.data || []);
            setAppointments(aptsRes.data.filter((a: any) => a.patient_id === id) || []);
            setIpHistory(ipRes.data || []);
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
                                                    <span className="text-xs text-gray-400">{ip.admission_date ? format(new Date(ip.admission_date), 'dd MMM yyyy') : '—'}</span>
                                                </div>
                                                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-600">
                                                    {ip.ward && <span><strong>Ward:</strong> {ip.ward}</span>}
                                                    {ip.bed_number && <span><strong>Bed:</strong> {ip.bed_number}</span>}
                                                    {ip.attending_doctor && <span><strong>Doctor:</strong> {ip.attending_doctor}</span>}
                                                    {ip.discharge_date && <span><strong>Discharged:</strong> {format(new Date(ip.discharge_date), 'dd MMM yyyy')}</span>}
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
                                                    {rec.visit_date ? format(new Date(rec.visit_date), 'dd MMM yyyy, HH:mm') : '—'}
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
                            <div className="bg-white rounded-xl border border-gray-100 p-6">
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
                                                    {m.recorded_at ? format(new Date(m.recorded_at), 'dd MMM yyyy') : ''}
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
                                                    <td className="px-5 py-3 text-gray-700">{apt.appointment_date ? format(new Date(apt.appointment_date), 'dd MMM yyyy, HH:mm') : '—'}</td>
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
                    </div>
                </div>
            )}
        </div>
    );
};

export default DoctorPatientView;
