import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { UserPlus, Users, Search, CheckCircle, XCircle, Eye, EyeOff, Stethoscope, Phone, Mail, ShieldCheck } from 'lucide-react';

const SPECIALIZATIONS = [
    'General Physician',
    'Cardiologist',
    'Neurologist',
    'Orthopedic',
    'Dermatologist',
    'Pediatrician',
    'Psychiatrist',
    'Oncologist',
    'Gynecologist',
    'Endocrinologist',
    'Pulmonologist',
    'Gastroenterologist',
    'Urologist',
    'ENT Specialist',
    'Ophthalmologist',
    'Radiologist',
    'Anesthesiologist',
    'Other',
];

type Tab = 'add-doctor' | 'patients' | 'doctors';

const AdminPage: React.FC = () => {
    const [tab, setTab] = useState<Tab>('add-doctor');
    const [doctorForm, setDoctorForm] = useState({
        full_name: '',
        email: '',
        password: '',
        specialization: '',
        customSpecialization: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [patients, setPatients] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [isLoadingPatients, setIsLoadingPatients] = useState(false);
    const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (tab === 'patients') loadPatients();
        if (tab === 'doctors') loadDoctors();
    }, [tab]);

    const loadPatients = async () => {
        setIsLoadingPatients(true);
        try {
            const res = await adminAPI.getPatients();
            setPatients(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingPatients(false);
        }
    };

    const loadDoctors = async () => {
        setIsLoadingDoctors(true);
        try {
            const res = await adminAPI.getDoctors();
            setDoctors(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingDoctors(false);
        }
    };

    const handleAddDoctor = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        setFormSuccess('');
        setIsSubmitting(true);
        const spec = doctorForm.specialization === 'Other' ? doctorForm.customSpecialization : doctorForm.specialization;
        try {
            await adminAPI.createDoctor({
                full_name: doctorForm.full_name,
                email: doctorForm.email,
                password: doctorForm.password,
                specialization: spec,
                role: 'doctor',
            });
            setFormSuccess(`Dr. ${doctorForm.full_name} (${spec}) has been added successfully!`);
            setDoctorForm({ full_name: '', email: '', password: '', specialization: '', customSpecialization: '' });
        } catch (err: any) {
            setFormError(err?.response?.data?.detail || 'Failed to create doctor.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredPatients = patients.filter((p) => {
        const q = search.toLowerCase();
        return (
            p.medical_id?.toLowerCase().includes(q) ||
            p.email?.toLowerCase().includes(q) ||
            p.user?.full_name?.toLowerCase().includes(q)
        );
    });

    const filteredDoctors = doctors.filter((d) => {
        const q = search.toLowerCase();
        return (
            d.full_name?.toLowerCase().includes(q) ||
            d.email?.toLowerCase().includes(q) ||
            d.specialization?.toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="bg-blue-100 p-3 rounded-lg mr-4">
                    <ShieldCheck className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
                    <p className="text-gray-500">Manage doctors and view patient registrations</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
                {([
                    { key: 'add-doctor', label: 'Add Doctor', icon: <UserPlus className="h-4 w-4" /> },
                    { key: 'patients', label: 'Patient List', icon: <Users className="h-4 w-4" /> },
                    { key: 'doctors', label: 'Doctor List', icon: <Stethoscope className="h-4 w-4" /> },
                ] as { key: Tab; label: string; icon: React.ReactNode }[]).map((t) => (
                    <button
                        key={t.key}
                        onClick={() => { setTab(t.key); setSearch(''); }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${tab === t.key ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            {/* Add Doctor Form */}
            {tab === 'add-doctor' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-2xl">
                    <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-blue-600" /> Create Doctor Account
                    </h2>
                    {formError && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                            <XCircle className="h-4 w-4 flex-shrink-0" />{formError}
                        </div>
                    )}
                    {formSuccess && (
                        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 flex-shrink-0" />{formSuccess}
                        </div>
                    )}
                    <form onSubmit={handleAddDoctor} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                            <input
                                required
                                className="input-field"
                                placeholder="Dr. John Smith"
                                value={doctorForm.full_name}
                                onChange={(e) => setDoctorForm({ ...doctorForm, full_name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    required
                                    type="email"
                                    className="input-field pl-10"
                                    placeholder="doctor@hospital.com"
                                    value={doctorForm.email}
                                    onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
                            <div className="relative">
                                <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <select
                                    required
                                    className="input-field pl-10"
                                    value={doctorForm.specialization}
                                    onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                                >
                                    <option value="">Select Specialization</option>
                                    {SPECIALIZATIONS.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {doctorForm.specialization === 'Other' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Specialization</label>
                                <input
                                    required
                                    className="input-field"
                                    placeholder="Enter specialization"
                                    value={doctorForm.customSpecialization}
                                    onChange={(e) => setDoctorForm({ ...doctorForm, customSpecialization: e.target.value })}
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
                            <div className="relative">
                                <input
                                    required
                                    type={showPassword ? 'text' : 'password'}
                                    className="input-field pr-10"
                                    placeholder="Min 8 characters"
                                    value={doctorForm.password}
                                    onChange={(e) => setDoctorForm({ ...doctorForm, password: e.target.value })}
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="btn-primary w-full flex items-center justify-center gap-2"
                            >
                                <UserPlus className="h-4 w-4" />
                                {isSubmitting ? 'Creating Account...' : 'Create Doctor Account'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Patients List */}
            {tab === 'patients' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-4">
                        <h2 className="text-lg font-bold text-gray-900">Registered Patients</h2>
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                className="input-field pl-9 py-2 text-sm"
                                placeholder="Search by name, email, ID..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    {isLoadingPatients ? (
                        <div className="text-center py-16 text-gray-400">Loading patients...</div>
                    ) : filteredPatients.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">No patients found.</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-3 text-left">Patient</th>
                                    <th className="px-6 py-3 text-left">Medical ID</th>
                                    <th className="px-6 py-3 text-left">Contact</th>
                                    <th className="px-6 py-3 text-left">Gender</th>
                                    <th className="px-6 py-3 text-left">Blood Type</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredPatients.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm">
                                                    {(p.user?.full_name || p.email || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900">{p.user?.full_name || '—'}</p>
                                                    <p className="text-xs text-gray-500">{p.email || p.user?.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{p.medical_id || '—'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {p.phone ? (
                                                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 capitalize">{p.gender || '—'}</td>
                                        <td className="px-6 py-4">
                                            {p.blood_type ? (
                                                <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded">{p.blood_type}</span>
                                            ) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Doctors List */}
            {tab === 'doctors' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-4">
                        <h2 className="text-lg font-bold text-gray-900">Doctor Accounts</h2>
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                className="input-field pl-9 py-2 text-sm"
                                placeholder="Search doctors..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    {isLoadingDoctors ? (
                        <div className="text-center py-16 text-gray-400">Loading doctors...</div>
                    ) : filteredDoctors.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">No doctors found.</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-3 text-left">Doctor</th>
                                    <th className="px-6 py-3 text-left">Specialization</th>
                                    <th className="px-6 py-3 text-left">Email</th>
                                    <th className="px-6 py-3 text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredDoctors.map((d: any) => (
                                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-sm">
                                                    {d.full_name?.charAt(0) || 'D'}
                                                </div>
                                                <span className="font-semibold text-gray-900">{d.full_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-1 rounded">
                                                {d.specialization || 'General'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{d.email}</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {d.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminPage;
