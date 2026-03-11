import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { patientsAPI, encountersAPI, appointmentsAPI, alertsAPI } from '../services/api';
import { ArrowLeft, Save, Plus, Trash2, FileText, Pill, Stethoscope, AlertCircle, History, User, Phone, MapPin, Activity, X } from 'lucide-react';
import type { Patient, Appointment, Alert, Encounter } from '../types';

const MedicalHistoryModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    patientId: string;
}> = ({ isOpen, onClose, patientId }) => {
    const [history, setHistory] = useState<Encounter[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && patientId) {
            const fetchHistory = async () => {
                try {
                    setLoading(true);
                    const res = await encountersAPI.getByPatientId(patientId);
                    setHistory(res.data);
                } catch (e) {
                    console.error("Failed to fetch history:", e);
                } finally {
                    setLoading(false);
                }
            };
            fetchHistory();
        }
    }, [isOpen, patientId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                        <History className="h-5 w-5 mr-2 text-primary-600" />
                        Full Medical History
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="h-6 w-6 text-gray-500" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="text-center py-10">Loading history...</div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 italic">No past encounters found.</div>
                    ) : (
                        <div className="space-y-6">
                            {history.map((enc) => (
                                <div key={enc.id} className="border rounded-lg p-4 hover:border-primary-200 transition-colors">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="text-sm font-bold text-primary-700 bg-primary-50 px-2 py-1 rounded">
                                            {new Date(enc.created_at).toLocaleDateString()}
                                        </span>
                                        <span className="text-xs text-gray-400 font-mono">ID: {enc.id}</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-500 uppercase">Diagnoses</h4>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {enc.diagnoses.map((d, i) => (
                                                    <span key={i} className="text-sm font-medium text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{d}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-500 uppercase">Treatment Plan</h4>
                                            <p className="text-sm text-gray-700 mt-1">{enc.treatment_plan}</p>
                                        </div>
                                        <div className="md:col-span-2">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase">Clinical Notes</h4>
                                            <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{enc.visit_notes}</p>
                                        </div>
                                        {enc.prescriptions && enc.prescriptions.length > 0 && (
                                            <div className="md:col-span-2">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase">Prescriptions</h4>
                                                <ul className="mt-1 space-y-1">
                                                    {enc.prescriptions.map((p, i) => (
                                                        <li key={i} className="text-sm text-gray-700 border-l-2 border-primary-300 pl-2">
                                                            <span className="font-bold">{p.medication_name}</span> - {p.dosage} ({p.frequency}) for {p.duration_days} days
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const PatientEncounter: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [patient, setPatient] = useState<Patient | null>(null);
    const [appointment, setAppointment] = useState<Appointment | null>(null);
    const [activeAlert, setActiveAlert] = useState<Alert | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [error, setError] = useState('');

    // Form State
    const [visitNotes, setVisitNotes] = useState('');
    const [diagnoses, setDiagnoses] = useState<string[]>(['']);
    const [treatmentPlan, setTreatmentPlan] = useState('');

    // Prescription State
    const [prescriptions, setPrescriptions] = useState([{
        medication_name: '',
        dosage: '',
        frequency: '',
        duration_days: 7,
        instructions: ''
    }]);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            try {
                const patRes = await patientsAPI.getById(id);
                setPatient(patRes.data);

                // Try to find today's active appointment for this patient to auto-link it
                const aptRes = await appointmentsAPI.getAll();
                const today = new Date().toISOString().split('T')[0];
                const activeApt = aptRes.data.find((a: Appointment) =>
                    a.patient_id === id &&
                    a.status === 'scheduled' &&
                    a.appointment_date.startsWith(today)
                );

                if (activeApt) {
                    setAppointment(activeApt);
                }

                // Fetch latest alert for emergency context
                try {
                    const alertRes = await alertsAPI.getAll({ patient_id: id, active_only: true, limit: 1 });
                    if (alertRes.data && alertRes.data.length > 0) {
                        setActiveAlert(alertRes.data[0]);
                    }
                } catch (e) {
                    console.error("Failed to fetch alerts:", e);
                }

            } catch (err: any) {
                console.error("Error fetching encounter data:", err);
                setError('Failed to load patient information.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handleAddDiagnosis = () => setDiagnoses([...diagnoses, '']);
    const handleRemoveDiagnosis = (index: number) => setDiagnoses(diagnoses.filter((_, i) => i !== index));
    const handleDiagnosisChange = (index: number, value: string) => {
        const newD = [...diagnoses];
        newD[index] = value;
        setDiagnoses(newD);
    };

    const handleAddPrescription = () => setPrescriptions([...prescriptions, {
        medication_name: '', dosage: '', frequency: '', duration_days: 7, instructions: ''
    }]);

    const handleRemovePrescription = (index: number) => setPrescriptions(prescriptions.filter((_, i) => i !== index));

    const handlePrescriptionChange = (index: number, field: string, value: string | number) => {
        const newP: any = [...prescriptions];
        newP[index][field] = value;
        setPrescriptions(newP);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!id) return;

        // Clean up empty lines
        const cleanDiagnoses = diagnoses.filter(d => d.trim() !== '');
        const cleanPrescriptions = prescriptions.filter(p => p.medication_name.trim() !== '');

        if (cleanDiagnoses.length === 0) {
            setError('At least one diagnosis is required.');
            return;
        }

        try {
            // 1. Create the base encounter
            const encounterRes = await encountersAPI.create(id, {
                appointment_id: appointment?.id,
                visit_notes: visitNotes,
                diagnoses: cleanDiagnoses,
                treatment_plan: treatmentPlan
            });

            const encounterId = encounterRes.data.id;

            // 2. Add prescriptions if any
            for (const rx of cleanPrescriptions) {
                await encountersAPI.addPrescription(encounterId, rx);
            }

            alert("Patient encounter saved successfully!");
            navigate(`/patients`); // Go back to patient management or dashboard

        } catch (err: any) {
            console.error("Submission failed:", err);
            setError("Failed to save encounter. " + (err.response?.data?.detail || ""));
        }
    };

    if (isLoading) return <div className="flex justify-center p-8">Loading patient data...</div>;
    if (!patient) return <div className="p-8 text-center text-red-600">Patient not found.</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50">
                        <ArrowLeft className="h-5 w-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Clinical Encounter</h1>
                        <p className="text-gray-500">
                            Documenting visit for {patient.user?.full_name || patient.medical_id || patient.email || 'Unknown Patient'}
                        </p>
                    </div>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={handleSubmit}
                        className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium shadow-sm transition-colors"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        Complete Encounter
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                    <div className="flex">
                        <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Context */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Emergency Context Alert */}
                    {activeAlert && (
                        <div className="bg-red-50 border-2 border-red-200 p-5 rounded-lg shadow-sm animate-pulse-subtle">
                            <h3 className="text-red-800 font-bold flex items-center mb-2">
                                <AlertCircle className="h-5 w-5 mr-2" />
                                EMERGENCY CONTEXT
                            </h3>
                            <div className="space-y-2 text-sm">
                                <p className="text-red-700 font-medium">{activeAlert.title}</p>
                                <div>
                                    <span className="text-red-900 font-bold block text-[10px] uppercase">Predicted Condition:</span>
                                    <p className="text-red-800 font-bold">
                                        {activeAlert.potential_diagnoses?.[0] || 'Unknown'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-red-900 font-bold block text-[10px] uppercase">Symptoms Reported:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {activeAlert.symptoms?.map((s, i) => (
                                            <span key={i} className="px-2 py-0.5 bg-red-200 text-red-900 text-[10px] rounded-full font-bold">{s}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center border-b pb-2 mb-3">
                            <h3 className="text-lg font-medium text-gray-900">Patient Details</h3>
                            <button
                                type="button"
                                onClick={() => setIsHistoryOpen(true)}
                                className="text-primary-600 hover:text-primary-700 text-xs font-bold flex items-center bg-primary-50 px-2 py-1 rounded"
                            >
                                <History className="h-3 w-3 mr-1" />
                                Records
                            </button>
                        </div>
                        <div className="space-y-4 text-sm">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-gray-50 rounded-lg"><User className="h-4 w-4 text-gray-400" /></div>
                                <div className="flex-1">
                                    <span className="text-gray-500 block text-[10px] uppercase font-bold">Full Name</span>
                                    <span className="font-medium text-gray-900">{patient.user?.full_name}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-gray-50 rounded-lg"><Phone className="h-4 w-4 text-gray-400" /></div>
                                    <div className="flex-1">
                                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Phone</span>
                                        <span className="font-medium text-gray-900 text-xs">{patient.phone || '—'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-gray-50 rounded-lg"><Activity className="h-4 w-4 text-gray-400" /></div>
                                    <div className="flex-1">
                                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Gender</span>
                                        <span className="font-medium text-gray-900 capitalize text-xs">{patient.gender || '—'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-gray-50 rounded-lg"><Activity className="h-4 w-4 text-gray-400" /></div>
                                    <div className="flex-1">
                                        <span className="text-gray-500 block text-[10px] uppercase font-bold">DOB</span>
                                        <span className="font-medium text-gray-900 text-xs">{patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : '—'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-gray-50 rounded-lg"><Activity className="h-4 w-4 text-gray-400" /></div>
                                    <div className="flex-1">
                                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Blood</span>
                                        <span className="font-bold text-red-600 text-xs">{patient.blood_type || '—'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-gray-50 rounded-lg"><Activity className="h-4 w-4 text-gray-400" /></div>
                                    <div className="flex-1">
                                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Height</span>
                                        <span className="font-medium text-gray-900 text-xs">{patient.height ? `${patient.height} cm` : '—'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-gray-50 rounded-lg"><Activity className="h-4 w-4 text-gray-400" /></div>
                                    <div className="flex-1">
                                        <span className="text-gray-500 block text-[10px] uppercase font-bold">Weight</span>
                                        <span className="font-medium text-gray-900 text-xs">{patient.weight ? `${patient.weight} kg` : '—'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3">
                                <div className="p-2 bg-gray-50 rounded-lg"><MapPin className="h-4 w-4 text-gray-400" /></div>
                                <div className="flex-1">
                                    <span className="text-gray-500 block text-[10px] uppercase font-bold">Address</span>
                                    <span className="font-medium text-gray-900 text-xs">{patient.address || 'No address provided'}</span>
                                </div>
                            </div>

                            <div className="border-t pt-3 mt-3">
                                <span className="text-gray-500 block mb-1 text-[10px] uppercase font-bold">Known Allergies</span>
                                <div className="flex flex-wrap gap-1">
                                    {(patient.allergies || []).length > 0 ? (patient.allergies || []).map((a, i) => (
                                        <span key={i} className="px-2 py-1 bg-red-100 text-red-800 text-[10px] rounded-full font-bold">{a}</span>
                                    )) : <span className="text-gray-400 italic text-[10px]">None reported</span>}
                                </div>
                            </div>
                            {appointment && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider block mb-1">Linked Appointment</span>
                                    <p className="text-gray-800 font-medium">{appointment.reason}</p>
                                    <p className="text-gray-500 text-xs mt-1">{new Date(appointment.appointment_date).toLocaleString()}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Documentation Form */}
                <div className="lg:col-span-2 space-y-6">
                    <form id="encounter-form" className="space-y-6" onSubmit={handleSubmit}>

                        {/* Clinical Notes */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                            <div className="flex items-center space-x-2 border-b pb-3 mb-4">
                                <FileText className="h-5 w-5 text-primary-600" />
                                <h3 className="text-lg font-medium text-gray-900">Visit Notes</h3>
                            </div>
                            <textarea
                                value={visitNotes}
                                onChange={(e) => setVisitNotes(e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                placeholder="Subjective complaints, objective findings, general assessment..."
                                required
                            />
                        </div>

                        {/* Diagnoses */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between border-b pb-3 mb-4">
                                <div className="flex items-center space-x-2">
                                    <Stethoscope className="h-5 w-5 text-primary-600" />
                                    <h3 className="text-lg font-medium text-gray-900">Diagnoses</h3>
                                </div>
                                <button type="button" onClick={handleAddDiagnosis} className="text-xs flex items-center text-primary-600 hover:text-primary-700 font-medium">
                                    <Plus className="h-3 w-3 mr-1" /> Add
                                </button>
                            </div>
                            <div className="space-y-3">
                                {diagnoses.map((diag, idx) => (
                                    <div key={idx} className="flex items-center space-x-2">
                                        <input
                                            type="text"
                                            value={diag}
                                            onChange={(e) => handleDiagnosisChange(idx, e.target.value)}
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                            placeholder="e.g. Acute Bronchitis"
                                            required={idx === 0}
                                        />
                                        {diagnoses.length > 1 && (
                                            <button type="button" onClick={() => handleRemoveDiagnosis(idx)} className="p-2 text-gray-400 hover:text-red-500">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Prescriptions */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between border-b pb-3 mb-4">
                                <div className="flex items-center space-x-2">
                                    <Pill className="h-5 w-5 text-primary-600" />
                                    <h3 className="text-lg font-medium text-gray-900">Prescriptions & Medications</h3>
                                </div>
                                <button type="button" onClick={handleAddPrescription} className="text-xs flex items-center text-primary-600 hover:text-primary-700 font-medium">
                                    <Plus className="h-3 w-3 mr-1" /> Add Medication
                                </button>
                            </div>

                            <div className="space-y-6">
                                {prescriptions.map((px, idx) => (
                                    <div key={idx} className="bg-gray-50 p-4 rounded-md border border-gray-200 relative">
                                        <button type="button" onClick={() => handleRemovePrescription(idx)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Medication Name</label>
                                                <input
                                                    type="text" value={px.medication_name} onChange={(e) => handlePrescriptionChange(idx, 'medication_name', e.target.value)}
                                                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500" placeholder="Amoxicillin"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Dosage</label>
                                                <input
                                                    type="text" value={px.dosage} onChange={(e) => handlePrescriptionChange(idx, 'dosage', e.target.value)}
                                                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500" placeholder="500mg"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Frequency</label>
                                                <input
                                                    type="text" value={px.frequency} onChange={(e) => handlePrescriptionChange(idx, 'frequency', e.target.value)}
                                                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500" placeholder="Twice a day"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Duration (Days)</label>
                                                <input
                                                    type="number" value={px.duration_days} onChange={(e) => handlePrescriptionChange(idx, 'duration_days', parseInt(e.target.value) || 0)}
                                                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500" min="1"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Special Instructions</label>
                                                <input
                                                    type="text" value={px.instructions} onChange={(e) => handlePrescriptionChange(idx, 'instructions', e.target.value)}
                                                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500" placeholder="Take with food"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {prescriptions.length === 0 && (
                                    <p className="text-sm text-gray-500 italic text-center py-2">No medications prescribed for this visit.</p>
                                )}
                            </div>
                        </div>

                        {/* Plan */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                            <h3 className="text-lg font-medium text-gray-900 border-b pb-3 mb-4">Treatment Plan & Follow-up</h3>
                            <textarea
                                value={treatmentPlan}
                                onChange={(e) => setTreatmentPlan(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                                placeholder="Rest, hydrate, follow up in 2 weeks..."
                                required
                            />
                        </div>

                    </form>
                </div>
            </div>

            <MedicalHistoryModal
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                patientId={id || ''}
            />
        </div>
    );
};

export default PatientEncounter;
