import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { patientsAPI } from '../services/api';
import type { Patient } from '../types';
import { Search, UserPlus, Info, Phone, Activity as ActivityIcon, PlusCircle, X, MessageSquare } from 'lucide-react';
import CommunicationModal from '../components/CommunicationModal';

const PatientManagement: React.FC = () => {
    const { user } = useAuth();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'metrics'>('info');
    const [metrics, setMetrics] = useState<any[]>([]);
    const [records, setRecords] = useState<any[]>([]);
    const [isLogging, setIsLogging] = useState(false);
    const [newMetric, setNewMetric] = useState({ metric_name: 'blood_sugar_before', value: '', unit: 'mg/dL' });

    // New Patient modal
    const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
    const [patientForm, setPatientForm] = useState({ full_name: '', email: '', password: '', phone: '', gender: '', date_of_birth: '' });
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    // Message modal
    const [isMessageOpen, setIsMessageOpen] = useState(false);

    // Edit Patient state
    const [isEditingPatient, setIsEditingPatient] = useState(false);

    const handleUpdatePatient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPatient) return;
        setFormError('');
        setFormSuccess('');
        try {
            const updateData = {
                phone: patientForm.phone,
                gender: patientForm.gender,
                date_of_birth: patientForm.date_of_birth ? new Date(patientForm.date_of_birth).toISOString() : null
            };
            await patientsAPI.update(selectedPatient.id, updateData);
            setFormSuccess('Patient updated successfully!');
            loadPatients();
            setTimeout(() => {
                setIsEditingPatient(false);
                setFormSuccess('');
            }, 2000);
        } catch (err: any) {
            setFormError(err?.response?.data?.detail || 'Failed to update patient.');
        }
    };

    useEffect(() => {
        loadPatients();
    }, []);

    const loadPatients = async () => {
        try {
            setIsLoading(true);
            const response = await patientsAPI.getAll();
            setPatients(response.data);
        } catch (error) {
            console.error('Error loading patients:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsLoading(true);
            const response = await patientsAPI.search(searchQuery);
            setPatients(response.data);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddPatient = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        setFormSuccess('');
        try {
            await patientsAPI.registerByDoctor(
                { full_name: patientForm.full_name, email: patientForm.email, password: patientForm.password, role: 'patient' },
                { phone: patientForm.phone, gender: patientForm.gender, date_of_birth: patientForm.date_of_birth || null }
            );
            setFormSuccess(`Patient ${patientForm.full_name} has been registered successfully!`);
            setPatientForm({ full_name: '', email: '', password: '', phone: '', gender: '', date_of_birth: '' });
            // Refresh list
            loadPatients();
            // Close after 2 seconds
            setTimeout(() => {
                setIsAddPatientOpen(false);
                setFormSuccess('');
            }, 2000);
        } catch (err: any) {
            setFormError(err?.response?.data?.detail || 'Failed to register patient.');
        }
    };

    if (user?.role === 'patient') {
        return <div className="p-8 text-center text-gray-500">Access denied.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Patient Management</h2>
                <button
                    onClick={() => { setIsAddPatientOpen(true); setFormError(''); setFormSuccess(''); }}
                    className="btn-primary flex items-center space-x-2"
                >
                    <UserPlus className="h-5 w-5" />
                    <span>New Patient</span>
                </button>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex space-x-2">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                        type="text"
                        placeholder="Search patients by name or email..."
                        className="input-field pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button type="submit" className="btn-secondary">Search</button>
            </form>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Patient List */}
                <div className="lg:col-span-1 bg-white shadow rounded-lg overflow-hidden">
                    <div className="px-4 py-5 border-b border-gray-200">
                        <h3 className="text-lg font-medium">Patients List</h3>
                    </div>
                    <ul className="divide-y divide-gray-200 h-[600px] overflow-y-auto">
                        {isLoading ? (
                            <li className="p-4 text-center text-gray-500">Loading...</li>
                        ) : patients.length === 0 ? (
                            <li className="p-4 text-center text-gray-500">No patients found</li>
                        ) : (
                            patients.map((p) => (
                                <li
                                    key={p.id}
                                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${selectedPatient?.id === p.id ? 'bg-primary-50' : ''
                                        }`}
                                    onClick={() => setSelectedPatient(p)}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center space-x-3">
                                            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700">
                                                {p.user?.full_name?.charAt(0) || 'P'}
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-sm font-bold text-gray-900 truncate">{p.user?.full_name}</p>
                                                <p className="text-[10px] text-gray-500 font-mono">
                                                    {p.medical_id || `ID: ${p.id}`}
                                                </p>
                                            </div>
                                        </div>
                                        <Info className="h-4 w-4 text-gray-300" />
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                </div>

                {/* Patient Details */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedPatient ? (
                        <div className="bg-white shadow rounded-lg p-6 space-y-8">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary-700">
                                        {selectedPatient.user?.full_name?.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">{selectedPatient.user?.full_name}</h3>
                                        <div className="flex items-center space-x-2 mt-1">
                                            <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">ID: {selectedPatient.medical_id || 'Pending'}</span>
                                            <span className="text-xs text-gray-400">•</span>
                                            <span className="text-xs text-gray-500">{selectedPatient.user?.email}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => setIsMessageOpen(true)}
                                        className="btn-secondary text-xs px-3 py-1 flex items-center space-x-1"
                                    >
                                        <MessageSquare className="h-3 w-3" />
                                        <span>Message</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setPatientForm({
                                                full_name: selectedPatient.user?.full_name || '',
                                                email: selectedPatient.user?.email || '',
                                                password: '', // Don't show password
                                                phone: selectedPatient.phone || '',
                                                gender: selectedPatient.gender || '',
                                                date_of_birth: selectedPatient.date_of_birth ? new Date(selectedPatient.date_of_birth).toISOString().split('T')[0] : ''
                                            });
                                            setIsEditingPatient(true);
                                        }}
                                        className="btn-secondary text-xs px-3 py-1"
                                    >
                                        Edit
                                    </button>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-gray-200">
                                <button
                                    className={`px-4 py-2 text-sm font-medium ${activeTab === 'info' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    onClick={() => setActiveTab('info')}
                                >
                                    Personal & Medical Info
                                </button>
                                <button
                                    className={`px-4 py-2 text-sm font-medium ${activeTab === 'metrics' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    onClick={async () => {
                                        setActiveTab('metrics');
                                        try {
                                            // Fetch both health metrics and medical records
                                            const res = await patientsAPI.getHealthMetrics(selectedPatient.id as string);
                                            setMetrics(res.data);
                                            const recRes = await patientsAPI.getMedicalRecords(selectedPatient.id as string);
                                            setRecords(recRes.data);
                                        } catch (e) { console.error(e); }
                                    }}
                                >
                                    Health Metrics & Records
                                </button>
                            </div>

                            {activeTab === 'info' ? (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <h4 className="font-semibold flex items-center text-primary-700">
                                                <Info className="h-5 w-5 mr-2" /> Personal Info
                                            </h4>
                                            <div className="bg-gray-50 p-4 rounded-md space-y-2 text-sm">
                                                <p><span className="text-gray-500">Gender:</span> <span className="capitalize">{selectedPatient.gender || 'Not specified'}</span></p>
                                                <p><span className="text-gray-500">DOB:</span> {selectedPatient.date_of_birth ? new Date(selectedPatient.date_of_birth).toLocaleDateString() : 'Not provided'}</p>
                                                <p><span className="text-gray-500">Blood Type:</span> <span className="text-red-600 font-bold">{selectedPatient.blood_type || 'Unknown'}</span></p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="font-semibold flex items-center text-primary-700">
                                                <Phone className="h-5 w-5 mr-2" /> Contact
                                            </h4>
                                            <div className="bg-gray-50 p-4 rounded-md space-y-2 text-sm">
                                                <p><span className="text-gray-500">Emergency:</span> {selectedPatient.emergency_contact?.name || 'Not provided'}</p>
                                                <p><span className="text-gray-500">Rel:</span> {selectedPatient.emergency_contact?.relationship || 'N/A'}</p>
                                                <p><span className="text-gray-500">Phone:</span> {selectedPatient.emergency_contact?.phone || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>

                                </>
                            ) : (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-bold text-gray-900">Health History</h4>
                                        <button
                                            onClick={() => setIsLogging(!isLogging)}
                                            className="text-xs bg-primary-50 text-primary-700 px-3 py-1 rounded-full border border-primary-100 hover:bg-primary-100"
                                        >
                                            {isLogging ? 'Cancel' : 'Log Metric'}
                                        </button>
                                    </div>

                                    {isLogging && (
                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            <div className="grid grid-cols-3 gap-3">
                                                <select
                                                    className="text-xs p-2 border rounded"
                                                    value={newMetric.metric_name}
                                                    onChange={e => setNewMetric({ ...newMetric, metric_name: e.target.value })}
                                                >
                                                    <option value="blood_sugar_before">Sugar (Before)</option>
                                                    <option value="blood_sugar_after">Sugar (After)</option>
                                                    <option value="bp_systolic">BP (Systolic)</option>
                                                    <option value="bp_diastolic">BP (Diastolic)</option>
                                                    <option value="cholesterol">Cholesterol</option>
                                                </select>
                                                <input
                                                    type="number"
                                                    placeholder="Value"
                                                    className="text-xs p-2 border rounded"
                                                    value={newMetric.value}
                                                    onChange={e => setNewMetric({ ...newMetric, value: e.target.value })}
                                                />
                                                <button
                                                    className="bg-primary-600 text-white text-xs rounded hover:bg-primary-700"
                                                    onClick={async () => {
                                                        try {
                                                            await patientsAPI.logHealthMetric(selectedPatient.id, {
                                                                ...newMetric,
                                                                value: parseFloat(newMetric.value)
                                                            });
                                                            setIsLogging(false);
                                                            const res = await patientsAPI.getHealthMetrics(selectedPatient.id);
                                                            setMetrics(res.data);
                                                        } catch (e) { console.error(e); }
                                                    }}
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-white border rounded-lg overflow-hidden">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50 text-left">
                                                <tr>
                                                    <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase">Date</th>
                                                    <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase">Metric</th>
                                                    <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase">Value</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 text-xs">
                                                {metrics.map((m, i) => (
                                                    <tr key={i}>
                                                        <td className="px-4 py-2 text-gray-500">{new Date(m.recorded_at).toLocaleDateString()}</td>
                                                        <td className="px-4 py-2 font-medium capitalize">{m.metric_name.replace(/_/g, ' ')}</td>
                                                        <td className="px-4 py-2 font-bold">{m.value} {m.unit}</td>
                                                    </tr>
                                                ))}
                                                {metrics.length === 0 && (
                                                    <tr>
                                                        <td colSpan={3} className="px-4 py-8 text-center text-gray-400">No data found</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Medical Records Secton */}
                            {activeTab === 'metrics' && (
                                <div className="p-6 border-t border-gray-100">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-lg font-bold text-gray-900">Medical Records</h4>
                                    </div>
                                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diagnosis</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symptoms</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Treatment Notes</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {records.length > 0 ? (
                                                    records.map((r, i) => (
                                                        <tr key={i} className="hover:bg-primary-50">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                {new Date(r.visit_date).toLocaleDateString()}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 border-l-4 border-primary-500">
                                                                {r.diagnosis ?? 'Pending Analysis'}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                                {(r.symptoms || []).join(', ')}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-gray-500 italic max-w-sm truncate">
                                                                {r.treatment_plan ?? 'N/A'}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                                                            No medical records found for this patient.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white shadow rounded-lg p-12 text-center text-gray-500 flex flex-col items-center justify-center">
                            <ActivityIcon className="h-12 w-12 text-gray-300 mb-4" />
                            <p>Select a patient to view detailed information</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Patient Modal */}
            {isAddPatientOpen && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Register New Patient</h3>
                            <button onClick={() => setIsAddPatientOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        {formError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{formError}</div>}
                        {formSuccess && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{formSuccess}</div>}
                        <form onSubmit={handleAddPatient} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                    <input required className="input-field" placeholder="Jane Doe" value={patientForm.full_name}
                                        onChange={e => setPatientForm({ ...patientForm, full_name: e.target.value })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input required type="email" className="input-field" placeholder="patient@email.com" value={patientForm.email}
                                        onChange={e => setPatientForm({ ...patientForm, email: e.target.value })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
                                    <input required type="password" className="input-field" placeholder="Min 8 characters" value={patientForm.password}
                                        onChange={e => setPatientForm({ ...patientForm, password: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                    <input className="input-field" placeholder="+91 98765 43210" value={patientForm.phone}
                                        onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                                    <select className="input-field" value={patientForm.gender}
                                        onChange={e => setPatientForm({ ...patientForm, gender: e.target.value })}>
                                        <option value="">Select</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                                    <input type="date" className="input-field" value={patientForm.date_of_birth}
                                        onChange={e => setPatientForm({ ...patientForm, date_of_birth: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => setIsAddPatientOpen(false)} className="btn-secondary">Close</button>
                                <button type="submit" className="btn-primary"><PlusCircle className="h-4 w-4 mr-2 inline" />Register Patient</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Patient Modal */}
            {isEditingPatient && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Edit Patient Profile</h3>
                            <button onClick={() => setIsEditingPatient(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        {formError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{formError}</div>}
                        {formSuccess && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{formSuccess}</div>}
                        <form onSubmit={handleUpdatePatient} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name (Read-only)</label>
                                    <input disabled className="input-field bg-gray-50" value={patientForm.full_name} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                    <input className="input-field" placeholder="+91 98765 43210" value={patientForm.phone}
                                        onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                                    <select className="input-field" value={patientForm.gender}
                                        onChange={e => setPatientForm({ ...patientForm, gender: e.target.value })}>
                                        <option value="">Select</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                                    <input type="date" className="input-field" value={patientForm.date_of_birth}
                                        onChange={e => setPatientForm({ ...patientForm, date_of_birth: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => setIsEditingPatient(false)} className="btn-secondary">Close</button>
                                <button type="submit" className="btn-primary">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Message Modal */}
            <CommunicationModal
                isOpen={isMessageOpen}
                onClose={() => setIsMessageOpen(false)}
                recipientId={selectedPatient?.user?.id ?? selectedPatient?.id ?? null}
                recipientName={selectedPatient?.user?.full_name ?? null}
            />
        </div>
    );
};

export default PatientManagement;
