import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
    Users,
    Calendar,
    AlertCircle,
    FileText,
    Activity,
    ArrowRight,
    Search,
    UserPlus,
    PlusCircle,
    Heart,
    Send,
    X,
    Inbox,
    CheckCircle2
} from 'lucide-react';
import { alertsAPI, appointmentsAPI, adminAPI, patientsAPI, communicationsAPI } from '../services/api';
import api from '../services/api';
import type { Alert, Appointment, Patient, Message } from '../types';
import clsx from 'clsx';
import CommunicationModal from '../components/CommunicationModal';

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [patientProfile, setPatientProfile] = useState<any>(null);
    const [healthMetrics, setHealthMetrics] = useState<any[]>([]);
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [isCommunicationModalOpen, setIsCommunicationModalOpen] = useState(false);
    const [selectedPatientForMessage, setSelectedPatientForMessage] = useState<Patient | null>(null);
    const [newMetric, setNewMetric] = useState({ metric_name: 'blood_sugar_before', value: '', unit: 'mg/dL', notes: '' });
    const [diagnosis] = useState<any>(null);
    const [stats, setStats] = useState({ total_doctors: 0, total_patients: 0, active_alerts: 0, pending_visits: 0 });
    const [patientDocuments, setPatientDocuments] = useState<any[]>([]);
    const [upcomingAppointment, setUpcomingAppointment] = useState<Appointment | null>(null);

    const [isAddDoctorOpen, setIsAddDoctorOpen] = useState(false);
    const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
    const [doctorForm, setDoctorForm] = useState({ full_name: '', email: '', password: '', specialization: '' });
    const [patientForm, setPatientForm] = useState({ full_name: '', email: '', password: '', phone: '', gender: '', date_of_birth: '' });
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    const [isLoading, setIsLoading] = useState({ alerts: false, appointments: false, profile: false, stats: false });

    const loadData = async () => {
        if (!user) return;

        // Alerts - only for header badge, use cached light endpoint
        setIsLoading(prev => ({ ...prev, alerts: true }));
        try {
            const alertsRes = await alertsAPI.getActive();
            setAlerts(alertsRes.data.slice(0, 5)); // only load max 5 for dashboard
        } catch (error) {
            console.error('Loader: Alerts failed', error);
        } finally {
            setIsLoading(prev => ({ ...prev, alerts: false }));
        }

        // Appointments
        setIsLoading(prev => ({ ...prev, appointments: true }));
        let fetchedAppointments: Appointment[] = [];
        try {
            const aptsRes = await appointmentsAPI.getAll({ limit: 10 });
            fetchedAppointments = aptsRes.data;
            setAppointments(fetchedAppointments);

            // Sync upcoming visit — keep old value during reload to prevent flicker
            const now = new Date();
            const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
            const relevant = fetchedAppointments
                .filter(a => {
                    const aptDate = new Date(a.appointment_date);
                    return aptDate > fourHoursAgo && a.status === 'scheduled';
                })
                .sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());

            setUpcomingAppointment(relevant.length > 0 ? relevant[0] : null);

            // Fetch unread messages if patient
            if (user.role === 'patient') {
                const msgRes = await communicationsAPI.getInbox(user.uid as string);
                setMessages(msgRes.data.filter((m: Message) => !m.is_read));
            }

        } catch (error) {
            console.error('Loader: Appointments failed', error);
        } finally {
            setIsLoading(prev => ({ ...prev, appointments: false }));
        }

        // Stats
        if (user.role === 'admin' || user.role === 'doctor') {
            setIsLoading(prev => ({ ...prev, stats: true }));
            try {
                const statsRes = await adminAPI.getStats();
                setStats(statsRes.data);
            } catch (error) {
                console.error('Loader: Stats failed', error);
            } finally {
                setIsLoading(prev => ({ ...prev, stats: false }));
            }
        }

        // Patient profile & dependent data
        if (user.role === 'patient') {
            setIsLoading(prev => ({ ...prev, profile: true }));
            try {
                const profileRes = await patientsAPI.getMyProfile();
                const profileData = profileRes.data;
                setPatientProfile(profileData);

                // Load metrics
                try {
                    const metricsRes = await patientsAPI.getHealthMetrics(profileData.id);
                    setHealthMetrics(metricsRes.data);
                } catch (error) {
                    console.error('Loader: Metrics failed', error);
                }

                // Load documents
                try {
                    const docsRes = await api.get(`/documents/patient/${profileData.id}`);
                    setPatientDocuments(docsRes.data);
                } catch (error) {
                    console.error('Loader: Documents failed', error);
                }
            } catch (error) {
                console.error('Loader: Profile failed', error);
            } finally {
                setIsLoading(prev => ({ ...prev, profile: false }));
            }
        }
    };

    useEffect(() => {
        loadData();
        // No polling - avoid repeated heavy API calls
    }, [user?.role]);

    const handleAddDoctor = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        setFormSuccess('');
        try {
            await adminAPI.createDoctor({ ...doctorForm, role: 'doctor' });
            setFormSuccess(`Dr. ${doctorForm.full_name} has been added successfully!`);
            setDoctorForm({ full_name: '', email: '', password: '', specialization: '' });
        } catch (err: any) {
            setFormError(err?.response?.data?.detail || 'Failed to create doctor.');
        }
    };

    const handleAddPatient = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        setFormSuccess('');
        try {
            await patientsAPI.registerByDoctor(
                { full_name: patientForm.full_name, email: patientForm.email, password: patientForm.password, role: 'patient' },
                { user_id: 'pending', phone: patientForm.phone, gender: patientForm.gender, date_of_birth: patientForm.date_of_birth || null }
            );
            setFormSuccess(`Patient ${patientForm.full_name} has been registered successfully!`);
            setPatientForm({ full_name: '', email: '', password: '', phone: '', gender: '', date_of_birth: '' });
        } catch (err: any) {
            console.error("Failed to register patient:", err.response?.data || err);
            const detail = err.response?.data?.detail;
            const errorMsg = Array.isArray(detail)
                ? detail.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join(', ')
                : (detail || err.message || 'Failed to register patient.');
            setFormError(errorMsg);
        }
    };

    const handleLogMetric = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await patientsAPI.logHealthMetric(patientProfile.id, {
                ...newMetric,
                value: parseFloat(newMetric.value)
            });
            setIsLogModalOpen(false);
            setNewMetric({ metric_name: 'blood_sugar_before', value: '', unit: 'mg/dL', notes: '' });
            // Redirect to reports page
            navigate('/reports');
        } catch (error: any) {
            console.error('Error logging metric:', error?.response?.data || error.message);
            alert("Failed to save health metric. Please try again.");
        }
    };

    const handleMarkMessageRead = async (messageId: string) => {
        try {
            await communicationsAPI.markAsRead(messageId);
            setMessages(prev => prev.filter(m => m.id !== messageId));
        } catch (error) {
            console.error('Error marking message read:', error);
        }
    };

    if (!user) {
        return <Navigate to="/login" />;
    }

    const renderAdminDashboard = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard title="Total Doctors" value={stats.total_doctors.toString()} icon={Users} color="blue" />
                <StatCard title="Total Patients" value={stats.total_patients.toString()} icon={Users} color="green" />
                <StatCard title="Active Alerts" value={stats.active_alerts.toString()} icon={AlertCircle} color="red" />
                <StatCard title="Pending Visits" value={stats.pending_visits.toString()} icon={Calendar} color="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DashboardCard title="System Activity" icon={Activity}>
                    <div className="space-y-4">
                        <ActivityItem text="New doctor account created: Dr. Sarah Jenkins" time="2 hours ago" />
                        <ActivityItem text="System backup completed successfully" time="5 hours ago" />
                        <ActivityItem text="Security patch 1.0.4 applied" time="Yesterday" />
                    </div>
                </DashboardCard>
                <DashboardCard title="Quick Actions" icon={PlusCircle}>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => { setIsAddDoctorOpen(true); setFormError(''); setFormSuccess(''); }}
                            className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg hover:bg-primary-50 border border-transparent hover:border-primary-200 transition-all"
                        >
                            <UserPlus className="h-6 w-6 text-primary-600 mb-2" />
                            <span className="text-sm font-medium">Add Doctor</span>
                        </button>
                        <button
                            onClick={() => { setIsAddPatientOpen(true); setFormError(''); setFormSuccess(''); }}
                            className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg hover:bg-green-50 border border-transparent hover:border-green-200 transition-all"
                        >
                            <PlusCircle className="h-6 w-6 text-green-600 mb-2" />
                            <span className="text-sm font-medium">Add Patient</span>
                        </button>
                    </div>
                </DashboardCard>
            </div>
        </div>
    );

    const renderDoctorDashboard = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <DashboardCard title="Today's Appointments" icon={Calendar} footer={
                        <Link to="/appointments" className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center">
                            View all appointments <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                    }>
                        <div className="space-y-4">
                            {appointments.length > 0 ? (
                                appointments.map(apt => (
                                    <div key={apt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center space-x-3">
                                            <div className="h-10 w-10 flex-shrink-0 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">
                                                {apt.patient?.user?.full_name?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{apt.patient?.user?.full_name}</p>
                                                <p className="text-xs text-gray-500">{new Date(apt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {apt.reason}</p>
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => {
                                                    setSelectedPatientForMessage(apt.patient || null);
                                                    setIsCommunicationModalOpen(true);
                                                }}
                                                className="text-gray-500 hover:text-primary-600 text-sm font-medium flex items-center bg-white px-2 py-1 rounded border shadow-sm"
                                            >
                                                <Send className="h-3 w-3 mr-1" /> Message
                                            </button>
                                            <button
                                                onClick={() => navigate(`/encounter/${apt.patient_id}`)}
                                                className="text-white bg-primary-600 hover:bg-primary-700 font-medium px-3 py-1 rounded text-sm shadow-sm"
                                            >
                                                Start Encounter
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">No appointments for today.</p>
                            )}
                        </div>
                    </DashboardCard>

                    <DashboardCard title="Patient Lookup" icon={Search}>
                        <form className="flex space-x-2">
                            <input type="text" placeholder="Enter Patient ID or Name..." className="input-field flex-grow" />
                            <button className="btn-primary">Search</button>
                        </form>
                    </DashboardCard>
                </div>

                <div className="lg:col-span-1">
                    <DashboardCard title="Emergency Alerts" icon={AlertCircle} className="bg-red-50 border-red-100">
                        <div className="space-y-4">
                            {isLoading.alerts ? (
                                <div className="flex justify-center flex-col items-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mb-2"></div>
                                    <p className="text-xs text-red-400 font-medium">Checking system alerts...</p>
                                </div>
                            ) : alerts.length > 0 ? (
                                alerts.map(alert => (
                                    <div key={alert.id} className="p-3 bg-white border border-red-200 rounded-lg shadow-sm">
                                        <div className="flex items-start">
                                            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{alert.title}</p>
                                                <p className="text-xs text-red-600 mb-2">{alert.severity.toUpperCase()} SEVERITY</p>
                                                <p className="text-xs text-gray-600 mb-3">{alert.description}</p>
                                                <Link to="/alerts" className="text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded hover:bg-red-200">
                                                    Action Required
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">No active alerts.</p>
                            )}
                        </div>
                    </DashboardCard>
                </div>
            </div>

            {/* Direct Messaging Modal */}
            <CommunicationModal
                isOpen={isCommunicationModalOpen}
                onClose={() => setIsCommunicationModalOpen(false)}
                patient={selectedPatientForMessage}
            />
        </div>
    );

    const renderPatientDashboard = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-8 text-white shadow-lg relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-bold mb-1">Hello, {user.full_name}!</h2>
                                    {patientProfile?.medical_id && (
                                        <p className="text-primary-100 text-sm font-mono bg-primary-800/30 px-2 py-0.5 rounded inline-block mb-4">
                                            ID: {patientProfile.medical_id}
                                        </p>
                                    )}
                                </div>
                                <Activity className="h-12 w-12 text-primary-400/50" />
                            </div>
                            <p className="text-primary-500 mb-6 font-medium">Your health is our priority. Keep your records updated for better AI insights.</p>
                            <div className="flex space-x-4">
                                <Link to="/appointments" className="inline-flex items-center bg-white text-primary-600 px-4 py-2 rounded-lg font-semibold hover:bg-primary-50 transition-colors shadow-sm">
                                    Appointments <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                                <button
                                    onClick={() => setIsLogModalOpen(true)}
                                    className="inline-flex items-center bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-400 transition-colors border border-primary-400 shadow-sm"
                                >
                                    Log Health Data <PlusCircle className="ml-2 h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 -mr-8 -mt-8 h-48 w-48 bg-primary-500/20 rounded-full blur-3xl"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <DashboardCard title="Health Summary" icon={Activity}>
                            <div className="space-y-4">
                                {healthMetrics.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        {['blood_sugar_before', 'bp_systolic', 'cholesterol'].map(mName => {
                                            const m = healthMetrics.find(metric => metric.metric_name === mName);
                                            return m ? (
                                                <div key={mName} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                                    <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">{mName.replace(/_/g, ' ')}</p>
                                                    <p className="text-lg font-bold text-gray-900 mt-1">{m.value} <span className="text-xs font-normal text-gray-500">{m.unit}</span></p>
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 py-2">No health data logged yet.</p>
                                )}

                                {diagnosis && (
                                    <div className={clsx(
                                        "p-4 rounded-lg border",
                                        diagnosis.risk_level === 'HIGH' ? "bg-red-50 border-red-100" :
                                            diagnosis.risk_level === 'MEDIUM' ? "bg-amber-50 border-amber-100" : "bg-green-50 border-green-100"
                                    )}>
                                        <div className="flex items-center mb-2">
                                            <Heart className={clsx(
                                                "h-5 w-5 mr-2",
                                                diagnosis.risk_level === 'HIGH' ? "text-red-600" :
                                                    diagnosis.risk_level === 'MEDIUM' ? "text-amber-600" : "text-green-600"
                                            )} />
                                            <span className="font-bold text-sm uppercase">AI Health Prediction</span>
                                        </div>
                                        <p className="text-xs font-bold text-gray-800">{diagnosis.potential_diagnosis[0]}</p>
                                        <p className="text-[10px] text-gray-600 mt-1">{diagnosis.recommendations[0]}</p>
                                    </div>
                                )}
                            </div>
                        </DashboardCard>

                        {alerts.length > 0 && (
                            <DashboardCard title="Active Medical Alerts" icon={AlertCircle} className="bg-red-50 border-red-100">
                                <div className="space-y-4">
                                    {alerts.map(alert => (
                                        <div key={alert.id} className="p-4 bg-white border border-red-200 rounded-xl shadow-sm">
                                            <div className="flex items-start">
                                                <AlertCircle className="h-6 w-6 text-red-500 mt-0.5 mr-3" />
                                                <div className="flex-grow">
                                                    <p className="text-sm font-bold text-gray-900">{alert.title}</p>
                                                    <p className="text-xs text-red-600 mb-2 font-black uppercase tracking-widest">{alert.severity} SEVERITY</p>
                                                    <p className="text-xs text-gray-600 mb-3">{alert.description}</p>
                                                    <Link to="/alerts" className="text-xs font-bold text-red-700 bg-red-50 px-3 py-1.5 rounded-full border border-red-100 hover:bg-red-100 transition-colors inline-block">
                                                        View Action Protocol
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </DashboardCard>
                        )}

                        <DashboardCard title="Recent Documents" icon={FileText} footer={
                            <Link to="/documents" className="text-sm font-medium text-primary-600 hover:text-primary-700">View all</Link>
                        }>
                            <div className="space-y-3">
                                {patientDocuments.length > 0 ? (
                                    patientDocuments.slice(0, 3).map(doc => (
                                        <DocumentItem key={doc.id} name={doc.filename} date={new Date(doc.uploaded_at || Date.now()).toLocaleDateString()} />
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-500 py-2">No documents uploaded yet.</p>
                                )}
                            </div>
                        </DashboardCard>
                    </div>

                    {/* Patient Inbox / Clinical Instructions */}
                    <DashboardCard title="Inbox & Clinical Instructions" icon={Inbox}>
                        <div className="space-y-4">
                            {messages.length > 0 ? (
                                messages.map(msg => (
                                    <div key={msg.id} className={clsx(
                                        "p-4 rounded-lg border shadow-sm",
                                        msg.is_urgent ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-100"
                                    )}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center space-x-2">
                                                {msg.is_urgent && <AlertCircle className="h-4 w-4 text-red-600" />}
                                                <h4 className="text-sm font-bold text-gray-900">{msg.subject}</h4>
                                            </div>
                                            <span className="text-xs text-gray-500">{new Date(msg.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap">{msg.body}</p>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-medium text-gray-600">From: {msg.sender_name}</span>
                                            <button
                                                onClick={() => handleMarkMessageRead(msg.id)}
                                                className="flex items-center text-primary-600 hover:text-primary-800 font-medium bg-white px-2 py-1 rounded shadow-sm border border-primary-100"
                                            >
                                                <CheckCircle2 className="h-3 w-3 mr-1" /> Mark as Read
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6">
                                    <Inbox className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">Your inbox is empty.</p>
                                </div>
                            )}
                        </div>
                    </DashboardCard>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <DashboardCard title="Upcoming Visit" icon={Calendar} className="bg-primary-50">
                        {isLoading.appointments ? (
                            <div className="flex justify-center flex-col items-center py-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
                                <p className="text-xs text-primary-400 font-medium">Syncing appointments...</p>
                            </div>
                        ) : upcomingAppointment ? (
                            <div className="text-center p-4">
                                <div className="text-3xl font-bold text-primary-600 mb-1">
                                    {new Date(upcomingAppointment.appointment_date).getDate()}
                                </div>
                                <div className="text-sm font-medium text-primary-500 uppercase tracking-wide">
                                    {new Date(upcomingAppointment.appointment_date).toLocaleString('default', { month: 'long' })}
                                </div>
                                <div className="mt-4 p-3 bg-white rounded-lg shadow-sm inline-block w-full">
                                    <p className="text-sm font-bold text-gray-900">
                                        {new Date(upcomingAppointment.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    <p className="text-xs text-gray-500 line-clamp-2">{upcomingAppointment.reason}</p>
                                </div>
                                <div className="mt-6">
                                    <Link to="/appointments" className="btn-secondary w-full text-sm inline-block">Manage Visits</Link>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center p-6">
                                <p className="text-sm text-gray-500 mb-4">No upcoming visits scheduled.</p>
                                <Link to="/appointments" className="btn-primary w-full text-sm inline-block">Book Now</Link>
                            </div>
                        )}
                    </DashboardCard>

                    <DashboardCard title="Recommended Actions" icon={AlertCircle}>
                        <ul className="space-y-3 text-sm">
                            <li className="flex items-start">
                                <span className="h-5 w-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center flex-shrink-0 mr-2">✓</span>
                                <span className="text-gray-600 font-medium">Book follow-up for next month</span>
                            </li>
                            <li className="flex items-start">
                                <span className="h-5 w-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mr-2">!</span>
                                <span className="text-gray-600 font-medium">Upload recent lab reports</span>
                            </li>
                        </ul>
                    </DashboardCard>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-500 mt-1">
                        {user.role === 'admin' && 'Enterprise System Administration'}
                        {user.role === 'doctor' && 'Clinical Management & Decision Support'}
                        {user.role === 'patient' && 'Personal Health Overview'}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <div className="mt-2 flex items-center justify-end space-x-2">
                        <span className={clsx(
                            "px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider",
                            user.role === 'admin' && "bg-blue-100 text-blue-700",
                            user.role === 'doctor' && "bg-green-100 text-green-700",
                            user.role === 'patient' && "bg-amber-100 text-amber-700"
                        )}>
                            {user.role}
                        </span>
                    </div>
                </div>
            </div>

            {user.role === 'admin' && renderAdminDashboard()}
            {user.role === 'doctor' && renderDoctorDashboard()}
            {user.role === 'patient' && renderPatientDashboard()}

            {/* Add Doctor Modal */}
            {isAddDoctorOpen && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Create Doctor Account</h3>
                            <button onClick={() => setIsAddDoctorOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
                        </div>
                        {formError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{formError}</div>}
                        {formSuccess && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{formSuccess}</div>}
                        <form onSubmit={handleAddDoctor} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                <input required className="input-field" placeholder="Dr. John Smith" value={doctorForm.full_name}
                                    onChange={e => setDoctorForm({ ...doctorForm, full_name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input required type="email" className="input-field" placeholder="doctor@hospital.com" value={doctorForm.email}
                                    onChange={e => setDoctorForm({ ...doctorForm, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
                                <input required type="password" className="input-field" placeholder="Min 8 characters" value={doctorForm.password}
                                    onChange={e => setDoctorForm({ ...doctorForm, password: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
                                <input required className="input-field" placeholder="e.g. Cardiologist, General Physician" value={doctorForm.specialization}
                                    onChange={e => setDoctorForm({ ...doctorForm, specialization: e.target.value })} />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => setIsAddDoctorOpen(false)} className="btn-secondary">Close</button>
                                <button type="submit" className="btn-primary"><UserPlus className="h-4 w-4 mr-2 inline" />Create Doctor</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Patient Modal */}
            {isAddPatientOpen && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Register New Patient</h3>
                            <button onClick={() => setIsAddPatientOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
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

            {/* Log Health Data Modal */}
            {isLogModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                        </div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <form onSubmit={handleLogMetric}>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                            <h3 className="text-lg leading-6 font-bold text-gray-900 mb-4">Log Health Metric</h3>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Metric Type</label>
                                                    <select
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                                        value={newMetric.metric_name}
                                                        onChange={e => setNewMetric({ ...newMetric, metric_name: e.target.value })}
                                                    >
                                                        <option value="blood_sugar_before">Blood Sugar (Before Meals)</option>
                                                        <option value="blood_sugar_after">Blood Sugar (After Meals)</option>
                                                        <option value="bp_systolic">Blood Pressure (Systolic)</option>
                                                        <option value="bp_diastolic">Blood Pressure (Diastolic)</option>
                                                        <option value="cholesterol">Cholesterol</option>
                                                        <option value="custom">Other (Custom Parameter)</option>
                                                    </select>
                                                </div>
                                                {newMetric.metric_name === 'custom' && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Custom Metric Name</label>
                                                        <input
                                                            type="text"
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                                            placeholder="e.g., Uric Acid"
                                                            required
                                                            onChange={e => setNewMetric({ ...newMetric, metric_name: e.target.value })}
                                                        />
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Value</label>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                                            value={newMetric.value}
                                                            required
                                                            onChange={e => setNewMetric({ ...newMetric, value: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Unit</label>
                                                        <input
                                                            type="text"
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                                            value={newMetric.unit}
                                                            placeholder="e.g., mg/dL"
                                                            onChange={e => setNewMetric({ ...newMetric, unit: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
                                                    <textarea
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                                        rows={2}
                                                        value={newMetric.notes}
                                                        onChange={e => setNewMetric({ ...newMetric, notes: e.target.value })}
                                                    ></textarea>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 sm:ml-3 sm:w-auto sm:text-sm">
                                        Save Metric
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsLogModalOpen(false)}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper Components
const StatCard = ({ title, value, icon: Icon, color }: any) => {
    const colors = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        red: 'bg-red-50 text-red-600',
        amber: 'bg-amber-50 text-amber-600'
    };
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className={clsx("p-3 rounded-lg", colors[color as keyof typeof colors])}>
                    <Icon className="h-6 w-6" />
                </div>
            </div>
        </div>
    );
};

const DashboardCard = ({ title, icon: Icon, children, footer, className }: any) => (
    <div className={clsx("bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col", className)}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center">
                <Icon className="h-5 w-5 mr-2 text-primary-600" /> {title}
            </h3>
        </div>
        <div className="p-6 flex-grow">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">{footer}</div>}
    </div>
);

const ActivityItem = ({ text, time }: any) => (
    <div className="flex items-start space-x-3">
        <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary-500 flex-shrink-0" />
        <div>
            <p className="text-sm text-gray-700">{text}</p>
            <p className="text-xs text-gray-400 mt-0.5">{time}</p>
        </div>
    </div>
);

const DocumentItem = ({ name, date }: any) => (
    <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors cursor-pointer">
        <div className="flex items-center space-x-3">
            <FileText className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-700 font-medium">{name}</span>
        </div>
        <span className="text-xs text-gray-400">{date}</span>
    </div>
);

export default Dashboard;
