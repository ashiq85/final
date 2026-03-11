import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { patientsAPI, authAPI } from '../services/api';
import { User, Mail, Shield, Phone, Heart, Save, AlertCircle, Users } from 'lucide-react';

const Profile: React.FC = () => {
    const { user } = useAuth();
    const [patientData, setPatientData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    useEffect(() => {
        const fetchPatientProfile = async () => {
            if (user?.role === 'patient') {
                setIsLoading(true);
                try {
                    const res = await patientsAPI.getMyProfile();
                    setPatientData(res.data);
                } catch (error) {
                    console.error('Error fetching patient profile:', error);
                } finally {
                    setIsLoading(false);
                }
            }
        };

        fetchPatientProfile();
    }, [user]);

    const [profileForm, setProfileForm] = useState({ full_name: '', specialization: '' });

    useEffect(() => {
        if (user) {
            setProfileForm({
                full_name: user.full_name || '',
                specialization: user.specialization || ''
            });
        }
    }, [user]);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            await authAPI.updateMe(profileForm);
            setSaveMessage('Profile configuration updated successfully!');
            // Refresh local state or force reload
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error('Error updating profile:', error);
            setSaveMessage('Failed to update profile.');
        } finally {
            setIsLoading(false);
            setIsEditing(false);
            setTimeout(() => setSaveMessage(''), 3000);
        }
    };

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Profile Header */}
                <div className="bg-primary-600 h-32 relative">
                    <div className="absolute -bottom-12 left-8">
                        <div className="h-24 w-24 rounded-2xl bg-white border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
                            <div className="h-full w-full bg-primary-100 flex items-center justify-center text-primary-700 text-3xl font-bold">
                                {user.full_name?.charAt(0) || 'U'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-16 pb-8 px-8 flex justify-between items-start">
                    <div>
                        {isEditing ? (
                            <input
                                className="text-2xl font-bold text-gray-900 border-b border-primary-300 focus:outline-none focus:border-primary-500 bg-transparent w-full"
                                value={profileForm.full_name}
                                onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                            />
                        ) : (
                            <h1 className="text-2xl font-bold text-gray-900">{user.full_name}</h1>
                        )}
                        <p className="text-gray-500 flex items-center gap-1 mt-1 capitalize">
                            <Shield className="h-4 w-4 text-primary-500" />
                            {user.role} Status
                        </p>
                    </div>
                    <button
                        onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${isEditing
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        {isEditing ? <Save className="h-4 w-4" /> : 'Edit Profile'}
                        {isEditing ? 'Save Changes' : ''}
                    </button>
                </div>
            </div>

            {saveMessage && (
                <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <Save className="h-5 w-5" /> {saveMessage}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sidebar Details */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <User className="h-4 w-4 text-primary-500" /> Account Info
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Email Address</label>
                                <p className="text-sm font-semibold text-gray-700 mt-0.5 flex items-center gap-2 italic">
                                    <Mail className="h-3.5 w-3.5" /> {user.email}
                                </p>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Account ID</label>
                                <p className="text-sm font-mono text-gray-500 mt-0.5 truncate">{user.id}</p>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Status</label>
                                <div className="mt-1 flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                    <span className="text-sm font-semibold text-gray-700">Active</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {user.role === 'doctor' && (
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-l-primary-500">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Shield className="h-4 w-4 text-primary-500" /> Professional
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Specialization</p>
                                    {isEditing ? (
                                        <input
                                            className="text-lg font-bold text-gray-900 border-b border-primary-300 focus:outline-none focus:border-primary-500 bg-transparent w-full"
                                            value={profileForm.specialization}
                                            onChange={(e) => setProfileForm({ ...profileForm, specialization: e.target.value })}
                                            placeholder="e.g. Cardiology"
                                        />
                                    ) : (
                                        <p className="text-lg font-bold text-gray-900">{user.specialization || 'Not specified'}</p>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 italic">Authorized clinical representative for AgentHealth Medical Group.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="md:col-span-2 space-y-6">
                    {user.role === 'patient' ? (
                        isLoading ? (
                            <div className="bg-white p-12 rounded-2xl border border-gray-100 flex flex-col items-center justify-center">
                                <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mb-4"></div>
                                <p className="text-gray-500">Loading medical profile...</p>
                            </div>
                        ) : patientData ? (
                            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-8">
                                <h3 className="text-lg font-bold text-gray-900 border-b pb-4 flex items-center gap-2">
                                    <Heart className="h-5 w-5 text-red-500" /> Medical Profile
                                </h3>

                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400 font-bold uppercase">Date of Birth</label>
                                        <p className="font-semibold">{patientData.date_of_birth ? new Date(patientData.date_of_birth).toLocaleDateString() : '—'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400 font-bold uppercase">Gender</label>
                                        <p className="font-semibold">{patientData.gender || '—'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400 font-bold uppercase">Blood Type</label>
                                        <p className="font-semibold text-red-600">{patientData.blood_type || '—'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-400 font-bold uppercase">Physical Stats</label>
                                        <p className="font-semibold">{patientData.height}cm / {patientData.weight}kg</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                        <h4 className="text-xs font-bold text-red-700 uppercase mb-2">Allergies</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {(patientData.allergies || []).length > 0 ? (
                                                (patientData.allergies || []).map((a: string, i: number) => (
                                                    <span key={i} className="px-3 py-1 bg-white border border-red-200 text-red-700 text-xs font-bold rounded-full">{a}</span>
                                                ))
                                            ) : <p className="text-sm text-red-400 italic">No allergies reported</p>}
                                        </div>
                                    </div>

                                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                        <h4 className="text-xs font-bold text-amber-700 uppercase mb-2">Current Medications</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {(patientData.current_medications || []).length > 0 ? (
                                                (patientData.current_medications || []).map((m: string, i: number) => (
                                                    <span key={i} className="px-3 py-1 bg-white border border-amber-200 text-amber-700 text-xs font-bold rounded-full">{m}</span>
                                                ))
                                            ) : <p className="text-sm text-amber-400 italic">No active medications</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                                        <Phone className="h-4 w-4" /> Emergency Contact
                                    </h4>
                                    <div className="flex justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{patientData.emergency_contact?.name || '—'}</p>
                                            <p className="text-xs text-gray-500">{patientData.emergency_contact?.relationship || 'Contact'}</p>
                                        </div>
                                        <p className="text-sm font-mono font-bold text-primary-600">{patientData.emergency_contact?.phone || '—'}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center">
                                <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                                <h3 className="font-bold text-gray-900 mb-2">Medical Profile Incomplete</h3>
                                <p className="text-gray-500 text-sm max-w-sm mx-auto">Please visit clinical support to complete your health profile.</p>
                            </div>
                        )
                    ) : (
                        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                            <Users className="h-16 w-16 text-gray-100 mb-6" />
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Staff Profile Summary</h3>
                            <p className="text-gray-500 max-w-md mx-auto mb-8 text-sm">You are logged in as an authorized staff member. Clinical access privileges are managed by the administrator.</p>

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
