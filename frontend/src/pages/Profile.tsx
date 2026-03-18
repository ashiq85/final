import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { patientsAPI, authAPI } from '../services/api';
import {
    User, Mail, Shield, Phone, Heart, Save, AlertCircle, Users,
    Edit2, X, Plus, Activity, MapPin
} from 'lucide-react';
import clsx from 'clsx';

const Profile: React.FC = () => {
    const { user } = useAuth();
    const [patientData, setPatientData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Account-level edit form (name / specialization)
    const [profileForm, setProfileForm] = useState({ full_name: '', specialization: '' });

    // Patient medical profile edit form
    const [patientForm, setPatientForm] = useState<any>({});
    const [newAllergy, setNewAllergy] = useState('');
    const [newMedication, setNewMedication] = useState('');

    // Load patient profile
    useEffect(() => {
        const fetch = async () => {
            if (user?.role === 'patient') {
                setIsLoading(true);
                try {
                    const res = await patientsAPI.getMyProfile();
                    setPatientData(res.data);
                    setPatientForm({
                        phone: res.data.phone || '',
                        address: res.data.address || '',
                        date_of_birth: res.data.date_of_birth ? res.data.date_of_birth.substring(0, 10) : '',
                        gender: res.data.gender || '',
                        blood_type: res.data.blood_type || '',
                        height: res.data.height || '',
                        weight: res.data.weight || '',
                        allergies: res.data.allergies || [],
                        current_medications: res.data.current_medications || [],
                        emergency_contact: typeof res.data.emergency_contact === 'object'
                            ? res.data.emergency_contact?.name || ''
                            : res.data.emergency_contact || '',
                        emergency_phone: typeof res.data.emergency_contact === 'object'
                            ? res.data.emergency_contact?.phone || ''
                            : res.data.emergency_phone || '',
                        emergency_relationship: typeof res.data.emergency_contact === 'object'
                            ? res.data.emergency_contact?.relationship || ''
                            : '',
                    });
                } catch (err) {
                    console.error('Error fetching patient profile:', err);
                } finally {
                    setIsLoading(false);
                }
            }
        };
        fetch();
    }, [user]);

    // Sync account-level form from user
    useEffect(() => {
        if (user) {
            setProfileForm({
                full_name: user.full_name || '',
                specialization: user.specialization || '',
            });
        }
    }, [user]);

    const handleCancel = () => {
        setIsEditing(false);
        // Reset to saved data
        if (patientData) {
            setPatientForm({
                phone: patientData.phone || '',
                address: patientData.address || '',
                date_of_birth: patientData.date_of_birth ? patientData.date_of_birth.substring(0, 10) : '',
                gender: patientData.gender || '',
                blood_type: patientData.blood_type || '',
                height: patientData.height || '',
                weight: patientData.weight || '',
                allergies: patientData.allergies || [],
                current_medications: patientData.current_medications || [],
                emergency_contact: patientData.emergency_contact?.name || '',
                emergency_phone: patientData.emergency_contact?.phone || '',
                emergency_relationship: patientData.emergency_contact?.relationship || '',
            });
        }
        if (user) {
            setProfileForm({ full_name: user.full_name || '', specialization: user.specialization || '' });
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Save account-level info
            await authAPI.updateMe(profileForm);

            // Save patient medical profile if patient
            if (user?.role === 'patient') {
                await patientsAPI.updateMyProfile({
                    phone: patientForm.phone || null,
                    address: patientForm.address || null,
                    date_of_birth: patientForm.date_of_birth ? new Date(patientForm.date_of_birth).toISOString() : null,
                    gender: patientForm.gender || null,
                    blood_type: patientForm.blood_type || null,
                    height: patientForm.height ? parseFloat(patientForm.height) : null,
                    weight: patientForm.weight ? parseFloat(patientForm.weight) : null,
                    allergies: patientForm.allergies,
                    current_medications: patientForm.current_medications,
                    emergency_contact: {
                        name: patientForm.emergency_contact,
                        phone: patientForm.emergency_phone,
                        relationship: patientForm.emergency_relationship,
                    },
                });
                // Refresh patient data
                const res = await patientsAPI.getMyProfile();
                setPatientData(res.data);
            }

            setSaveMessage({ type: 'success', text: 'Profile updated successfully!' });
            setIsEditing(false);
            setTimeout(() => {
                setSaveMessage(null);
                if (user?.role !== 'patient') window.location.reload();
            }, 2000);
        } catch (err) {
            console.error('Error saving profile:', err);
            setSaveMessage({ type: 'error', text: 'Failed to save profile. Please try again.' });
            setTimeout(() => setSaveMessage(null), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    const addAllergy = () => {
        if (newAllergy.trim()) {
            setPatientForm((p: any) => ({ ...p, allergies: [...(p.allergies || []), newAllergy.trim()] }));
            setNewAllergy('');
        }
    };

    const removeAllergy = (idx: number) => {
        setPatientForm((p: any) => ({ ...p, allergies: p.allergies.filter((_: any, i: number) => i !== idx) }));
    };

    const addMedication = () => {
        if (newMedication.trim()) {
            setPatientForm((p: any) => ({ ...p, current_medications: [...(p.current_medications || []), newMedication.trim()] }));
            setNewMedication('');
        }
    };

    const removeMedication = (idx: number) => {
        setPatientForm((p: any) => ({ ...p, current_medications: p.current_medications.filter((_: any, i: number) => i !== idx) }));
    };

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Profile Header Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-primary-600 h-32 relative" />
                <div className="pt-16 pb-8 px-8 flex justify-between items-start">
                    <div className="absolute top-[calc(32px+88px)] left-8">
                        <div className="h-24 w-24 rounded-2xl bg-white border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
                            <div className="h-full w-full bg-primary-100 flex items-center justify-center text-primary-700 text-3xl font-bold">
                                {user.full_name?.charAt(0) || 'U'}
                            </div>
                        </div>
                    </div>
                    <div className="mt-2">
                        {isEditing ? (
                            <input
                                className="text-2xl font-bold text-gray-900 border-b-2 border-primary-400 focus:outline-none focus:border-primary-600 bg-transparent"
                                value={profileForm.full_name}
                                onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
                            />
                        ) : (
                            <h1 className="text-2xl font-bold text-gray-900">{user.full_name}</h1>
                        )}
                        <p className="text-gray-500 flex items-center gap-1 mt-1 capitalize">
                            <Shield className="h-4 w-4 text-primary-500" />
                            {user.role}
                        </p>
                    </div>
                    <div className="flex gap-2 mt-2">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={handleCancel}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                                >
                                    <X className="h-4 w-4" /> Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold bg-green-600 text-white hover:bg-green-700 transition-all disabled:opacity-60"
                                >
                                    <Save className="h-4 w-4" />
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold bg-primary-600 text-white hover:bg-primary-700 transition-all"
                            >
                                <Edit2 className="h-4 w-4" /> Edit Profile
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Save feedback */}
            {saveMessage && (
                <div className={clsx(
                    'p-4 rounded-xl border flex items-center gap-2 font-medium text-sm',
                    saveMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
                )}>
                    {saveMessage.type === 'success' ? <Save className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    {saveMessage.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sidebar */}
                <div className="md:col-span-1 space-y-6">
                    {/* Account Info */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <User className="h-4 w-4 text-primary-500" /> Account Info
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Email</label>
                                <p className="text-sm font-semibold text-gray-700 mt-0.5 flex items-center gap-2">
                                    <Mail className="h-3.5 w-3.5" /> {user.email}
                                </p>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Account ID</label>
                                <p className="text-xs font-mono text-gray-400 mt-0.5 truncate">{user.id}</p>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Status</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="h-2 w-2 rounded-full bg-green-500" />
                                    <span className="text-sm font-semibold text-gray-700">Active</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Doctor Specialization */}
                    {user.role === 'doctor' && (
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-l-primary-500">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Shield className="h-4 w-4 text-primary-500" /> Professional
                            </h3>
                            <div>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Specialization</p>
                                {isEditing ? (
                                    <input
                                        className="text-base font-bold text-gray-900 border-b-2 border-primary-300 focus:outline-none focus:border-primary-500 bg-transparent w-full"
                                        value={profileForm.specialization}
                                        onChange={e => setProfileForm(f => ({ ...f, specialization: e.target.value }))}
                                        placeholder="e.g. Cardiology"
                                    />
                                ) : (
                                    <p className="text-base font-bold text-gray-900">{user.specialization || 'Not specified'}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Patient Quick Stats */}
                    {user.role === 'patient' && patientData && (
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Activity className="h-4 w-4 text-primary-500" /> Quick Stats
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-xs text-gray-400 font-bold uppercase">Blood Type</span>
                                    <span className="font-bold text-red-600">{patientData.blood_type || '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-xs text-gray-400 font-bold uppercase">Height</span>
                                    <span className="font-semibold text-gray-700">{patientData.height ? `${patientData.height} cm` : '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-xs text-gray-400 font-bold uppercase">Weight</span>
                                    <span className="font-semibold text-gray-700">{patientData.weight ? `${patientData.weight} kg` : '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-xs text-gray-400 font-bold uppercase">Medical ID</span>
                                    <span className="font-mono text-xs text-gray-500">{patientData.medical_id || '—'}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Content */}
                <div className="md:col-span-2 space-y-6">
                    {user.role === 'patient' ? (
                        isLoading ? (
                            <div className="bg-white p-12 rounded-2xl border border-gray-100 flex flex-col items-center justify-center">
                                <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mb-4" />
                                <p className="text-gray-500">Loading medical profile...</p>
                            </div>
                        ) : patientData ? (
                            <>
                                {/* Personal Details */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
                                        <User className="h-5 w-5 text-primary-500" /> Personal Details
                                    </h3>
                                    {isEditing ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Date of Birth</label>
                                                <input
                                                    type="date"
                                                    className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                                    value={patientForm.date_of_birth}
                                                    onChange={e => setPatientForm((p: any) => ({ ...p, date_of_birth: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Gender</label>
                                                <select
                                                    className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                                    value={patientForm.gender}
                                                    onChange={e => setPatientForm((p: any) => ({ ...p, gender: e.target.value }))}
                                                >
                                                    <option value="">Select...</option>
                                                    <option value="male">Male</option>
                                                    <option value="female">Female</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Phone</label>
                                                <input
                                                    className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                                    value={patientForm.phone}
                                                    onChange={e => setPatientForm((p: any) => ({ ...p, phone: e.target.value }))}
                                                    placeholder="Phone number"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Blood Type</label>
                                                <select
                                                    className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                                    value={patientForm.blood_type}
                                                    onChange={e => setPatientForm((p: any) => ({ ...p, blood_type: e.target.value }))}
                                                >
                                                    <option value="">Select...</option>
                                                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bt => (
                                                        <option key={bt} value={bt}>{bt}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Height (cm)</label>
                                                <input
                                                    type="number"
                                                    className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                                    value={patientForm.height}
                                                    onChange={e => setPatientForm((p: any) => ({ ...p, height: e.target.value }))}
                                                    placeholder="Height in cm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Weight (kg)</label>
                                                <input
                                                    type="number"
                                                    className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                                    value={patientForm.weight}
                                                    onChange={e => setPatientForm((p: any) => ({ ...p, weight: e.target.value }))}
                                                    placeholder="Weight in kg"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Address</label>
                                                <input
                                                    className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                                    value={patientForm.address}
                                                    onChange={e => setPatientForm((p: any) => ({ ...p, address: e.target.value }))}
                                                    placeholder="Address"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-5">
                                            <div>
                                                <p className="text-xs text-gray-400 font-bold uppercase">Date of Birth</p>
                                                <p className="font-semibold mt-0.5">{patientData.date_of_birth ? new Date(patientData.date_of_birth).toLocaleDateString() : '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400 font-bold uppercase">Gender</p>
                                                <p className="font-semibold mt-0.5 capitalize">{patientData.gender || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400 font-bold uppercase">Phone</p>
                                                <p className="font-semibold mt-0.5 flex items-center gap-1">
                                                    <Phone className="h-3.5 w-3.5 text-gray-400" /> {patientData.phone || '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400 font-bold uppercase">Address</p>
                                                <p className="font-semibold mt-0.5 flex items-center gap-1">
                                                    <MapPin className="h-3.5 w-3.5 text-gray-400" /> {patientData.address || '—'}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Allergies */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5 text-red-500" /> Allergies
                                    </h3>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {(isEditing ? patientForm.allergies : patientData.allergies || []).map((a: string, i: number) => (
                                            <span key={i} className="flex items-center gap-1 px-3 py-1 bg-red-50 border border-red-200 text-red-700 text-sm font-bold rounded-full">
                                                {a}
                                                {isEditing && (
                                                    <button onClick={() => removeAllergy(i)} className="ml-1 hover:text-red-900">
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </span>
                                        ))}
                                        {(isEditing ? patientForm.allergies : patientData.allergies || []).length === 0 && (
                                            <p className="text-sm text-gray-400 italic">No allergies reported</p>
                                        )}
                                    </div>
                                    {isEditing && (
                                        <div className="flex gap-2 mt-3">
                                            <input
                                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                                value={newAllergy}
                                                onChange={e => setNewAllergy(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && addAllergy()}
                                                placeholder="Add allergy (press Enter)"
                                            />
                                            <button onClick={addAllergy} className="px-3 py-2 bg-red-100 text-red-700 font-bold rounded-lg hover:bg-red-200 flex items-center gap-1">
                                                <Plus className="h-4 w-4" /> Add
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Current Medications */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <Heart className="h-5 w-5 text-amber-500" /> Current Medications
                                    </h3>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {(isEditing ? patientForm.current_medications : patientData.current_medications || []).map((m: string, i: number) => (
                                            <span key={i} className="flex items-center gap-1 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-bold rounded-full">
                                                {m}
                                                {isEditing && (
                                                    <button onClick={() => removeMedication(i)} className="ml-1 hover:text-amber-900">
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </span>
                                        ))}
                                        {(isEditing ? patientForm.current_medications : patientData.current_medications || []).length === 0 && (
                                            <p className="text-sm text-gray-400 italic">No active medications</p>
                                        )}
                                    </div>
                                    {isEditing && (
                                        <div className="flex gap-2 mt-3">
                                            <input
                                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                                value={newMedication}
                                                onChange={e => setNewMedication(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && addMedication()}
                                                placeholder="Add medication (press Enter)"
                                            />
                                            <button onClick={addMedication} className="px-3 py-2 bg-amber-100 text-amber-700 font-bold rounded-lg hover:bg-amber-200 flex items-center gap-1">
                                                <Plus className="h-4 w-4" /> Add
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Emergency Contact */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <Phone className="h-5 w-5 text-primary-500" /> Emergency Contact
                                    </h3>
                                    {isEditing ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Contact Name</label>
                                                <input
                                                    className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                                    value={patientForm.emergency_contact}
                                                    onChange={e => setPatientForm((p: any) => ({ ...p, emergency_contact: e.target.value }))}
                                                    placeholder="Full name"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Phone</label>
                                                <input
                                                    className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                                    value={patientForm.emergency_phone}
                                                    onChange={e => setPatientForm((p: any) => ({ ...p, emergency_phone: e.target.value }))}
                                                    placeholder="Phone number"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Relationship</label>
                                                <input
                                                    className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                                                    value={patientForm.emergency_relationship}
                                                    onChange={e => setPatientForm((p: any) => ({ ...p, emergency_relationship: e.target.value }))}
                                                    placeholder="e.g. Spouse, Parent"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl">
                                            <div>
                                                <p className="font-bold text-gray-900">
                                                    {typeof patientData.emergency_contact === 'object'
                                                        ? patientData.emergency_contact?.name || '—'
                                                        : patientData.emergency_contact || '—'}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {typeof patientData.emergency_contact === 'object'
                                                        ? patientData.emergency_contact?.relationship || 'Contact'
                                                        : 'Contact'}
                                                </p>
                                            </div>
                                            <p className="font-mono font-bold text-primary-600">
                                                {typeof patientData.emergency_contact === 'object'
                                                    ? patientData.emergency_contact?.phone || '—'
                                                    : patientData.emergency_phone || '—'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center">
                                <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                                <h3 className="font-bold text-gray-900 mb-2">Medical Profile Incomplete</h3>
                                <p className="text-gray-500 text-sm">Please contact clinical support to complete your health profile.</p>
                            </div>
                        )
                    ) : (
                        // Doctor / Admin Summary
                        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                            <Users className="h-16 w-16 text-gray-100 mb-6" />
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Staff Profile Summary</h3>
                            <p className="text-gray-500 max-w-md mx-auto mb-8 text-sm">You are logged in as an authorized staff member. Clinical access is managed by the administrator.</p>
                            <div className="w-full max-w-sm space-y-4">
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                    <span className="text-sm font-bold text-gray-500">System Role</span>
                                    <span className="text-sm font-bold text-primary-600 uppercase">{user.role}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                    <span className="text-sm font-bold text-gray-500">Access Level</span>
                                    <span className="text-sm font-bold text-green-600">Full Clinical</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Profile;
