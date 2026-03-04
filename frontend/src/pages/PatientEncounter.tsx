import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { patientsAPI, encountersAPI, appointmentsAPI } from '../services/api';
import { ArrowLeft, Save, Plus, Trash2, FileText, Pill, Stethoscope, AlertCircle } from 'lucide-react';
import type { Patient, Appointment } from '../types';

const PatientEncounter: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [patient, setPatient] = useState<Patient | null>(null);
    const [appointment, setAppointment] = useState<Appointment | null>(null);
    const [isLoading, setIsLoading] = useState(true);
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
                        <p className="text-gray-500">Documenting visit for {patient.user?.full_name}</p>
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
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                        <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-3">Patient Context</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">DOB</span>
                                <span className="font-medium">{new Date(patient.date_of_birth).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Blood Type</span>
                                <span className="font-medium text-red-600 font-bold">{patient.blood_type}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block mb-1">Known Allergies</span>
                                <div className="flex flex-wrap gap-1">
                                    {patient.allergies.length ? patient.allergies.map((a, i) => (
                                        <span key={i} className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">{a}</span>
                                    )) : <span className="text-gray-400 italic">None reported</span>}
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
        </div>
    );
};

export default PatientEncounter;
