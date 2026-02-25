import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { appointmentsAPI } from '../services/api';
import { format } from 'date-fns';
import { Calendar, Clock, Plus, X, User } from 'lucide-react';
import type { Appointment } from '../types';
import { AppointmentStatus } from '../types';

interface Doctor {
    id: number;
    full_name: string;
    email: string;
}

const Appointments: React.FC = () => {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [bookingError, setBookingError] = useState('');
    const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
    const [newAppointment, setNewAppointment] = useState({
        doctor_id: 0,
        appointment_date: '',
        reason: '',
        duration_minutes: 30,
        patient_id: 0, // will be auto-set by backend for patients
    });

    const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [rescheduleDate, setRescheduleDate] = useState('');

    useEffect(() => {
        loadAppointments();
        loadDoctors();
    }, []);

    const loadAppointments = async () => {
        try {
            setIsLoading(true);
            const response = await appointmentsAPI.getAll();
            setAppointments(response.data);
        } catch (error) {
            console.error('Error loading appointments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadDoctors = async () => {
        try {
            const response = await appointmentsAPI.getDoctors();
            setDoctors(response.data);
            if (response.data.length > 0) {
                setNewAppointment(prev => ({ ...prev, doctor_id: response.data[0].id }));
            }
        } catch (error) {
            console.error('Error loading doctors:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBookingError('');
        if (!newAppointment.doctor_id) {
            setBookingError('Please select a doctor.');
            return;
        }
        try {
            await appointmentsAPI.create({
                doctor_id: newAppointment.doctor_id,
                appointment_date: new Date(newAppointment.appointment_date).toISOString(),
                reason: newAppointment.reason,
                duration_minutes: newAppointment.duration_minutes,
                patient_id: 0, // backend resolves this for patients
            });
            setIsModalOpen(false);
            setNewAppointment(prev => ({ ...prev, appointment_date: '', reason: '' }));
            loadAppointments();
        } catch (error: any) {
            const msg = error?.response?.data?.detail || 'Error booking appointment.';
            setBookingError(msg);
            console.error('Error booking appointment:', error);
        }
    };

    const handleCancel = async (id: number) => {
        if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
        try {
            await appointmentsAPI.cancel(id);
            loadAppointments();
        } catch (error) {
            console.error('Error cancelling appointment:', error);
        }
    };

    const handleRescheduleRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAppointment) return;
        try {
            await appointmentsAPI.requestReschedule(selectedAppointment.id, new Date(rescheduleDate).toISOString());
            setIsRescheduleModalOpen(false);
            setSelectedAppointment(null);
            setRescheduleDate('');
            loadAppointments();
        } catch (error) {
            console.error('Error requesting reschedule:', error);
        }
    };

    const handleApprove = async (id: number) => {
        try {
            await appointmentsAPI.approveReschedule(id);
            loadAppointments();
        } catch (error) {
            console.error('Error approving reschedule:', error);
        }
    };

    const handleReject = async (id: number) => {
        try {
            await appointmentsAPI.rejectReschedule(id);
            loadAppointments();
        } catch (error) {
            console.error('Error rejecting reschedule:', error);
        }
    };

    const upcomingStatuses = ['scheduled', 'confirmed', 'reschedule_requested'] as const;
    const pastStatuses = ['completed', 'cancelled', 'no_show'] as const;

    const filteredAppointments = appointments.filter(a =>
        activeTab === 'upcoming'
            ? (upcomingStatuses as readonly string[]).includes(a.status)
            : (pastStatuses as readonly string[]).includes(a.status)
    );

    const getStatusBadge = (status: string) => {
        const map: Record<string, string> = {
            scheduled: 'bg-green-100 text-green-700',
            confirmed: 'bg-blue-100 text-blue-700',
            completed: 'bg-gray-100 text-gray-700',
            cancelled: 'bg-red-100 text-red-700',
            no_show: 'bg-orange-100 text-orange-700',
            reschedule_requested: 'bg-amber-100 text-amber-700',
        };
        return map[status] ?? 'bg-gray-100 text-gray-700';
    };

    const getProviderName = (apt: Appointment) => {
        if (user?.role === 'doctor') {
            return apt.patient?.user?.full_name ?? `Patient #${apt.patient_id}`;
        }
        return apt.doctor?.full_name ?? `Doctor #${apt.doctor_id}`;
    };

    const canReschedule = (apt: Appointment) =>
        apt.status === 'scheduled' && user?.role === 'patient';

    const canManageReschedule = (apt: Appointment) =>
        apt.status === 'reschedule_requested' &&
        (user?.role === 'doctor' || user?.role === 'admin');

    const canCancel = (apt: Appointment) =>
        (apt.status === 'scheduled' || apt.status === 'confirmed') &&
        (user?.role === 'doctor' || user?.role === 'admin' || user?.role === 'patient');

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
                    <p className="text-gray-500">Manage clinical sessions and scheduling</p>
                </div>
                {user?.role === 'patient' && (
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="btn-primary flex items-center"
                    >
                        <Plus className="h-5 w-5 mr-2" />
                        Book New Session
                    </button>
                )}
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card bg-primary-50 border-primary-100 flex items-center p-4">
                    <Calendar className="h-10 w-10 text-primary-600 mr-4" />
                    <div>
                        <p className="text-xs font-semibold text-primary-700 uppercase">Upcoming</p>
                        <p className="text-2xl font-bold text-gray-900">
                            {appointments.filter(a => (upcomingStatuses as readonly string[]).includes(a.status)).length}
                        </p>
                    </div>
                </div>
                <div className="card bg-green-50 border-green-100 flex items-center p-4">
                    <User className="h-10 w-10 text-green-600 mr-4" />
                    <div>
                        <p className="text-xs font-semibold text-green-700 uppercase">Completed</p>
                        <p className="text-2xl font-bold text-gray-900">
                            {appointments.filter(a => a.status === AppointmentStatus.COMPLETED).length}
                        </p>
                    </div>
                </div>
                <div className="card bg-amber-50 border-amber-100 flex items-center p-4">
                    <Clock className="h-10 w-10 text-amber-600 mr-4" />
                    <div>
                        <p className="text-xs font-semibold text-amber-700 uppercase">Reschedule Pending</p>
                        <p className="text-2xl font-bold text-gray-900">
                            {appointments.filter(a => a.status === AppointmentStatus.RESCHEDULE_REQUESTED).length}
                        </p>
                    </div>
                </div>
            </div>

            {/* Appointments Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="flex border-b border-gray-200">
                    <button
                        className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === 'upcoming'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('upcoming')}
                    >
                        Upcoming Sessions
                    </button>
                    <button
                        className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === 'past'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('past')}
                    >
                        Past History
                    </button>
                </div>
                <div className="p-0">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {user?.role === 'doctor' ? 'Patient' : 'Doctor'}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading appointments...</td>
                                </tr>
                            ) : filteredAppointments.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        No {activeTab === 'upcoming' ? 'upcoming' : 'past'} appointments found.
                                    </td>
                                </tr>
                            ) : (
                                filteredAppointments.map((apt) => (
                                    <tr key={apt.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                                                    <User className="h-4 w-4 text-gray-500" />
                                                </div>
                                                <div className="text-sm font-medium text-gray-900">
                                                    {getProviderName(apt)}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {format(new Date(apt.appointment_date), 'MMM d, yyyy')} &bull; {format(new Date(apt.appointment_date), 'h:mm a')}
                                            {apt.status === AppointmentStatus.RESCHEDULE_REQUESTED && apt.requested_new_date && (
                                                <div className="text-xs text-amber-600 font-semibold mt-1">
                                                    Requested: {format(new Date(apt.requested_new_date), 'MMM d, h:mm a')}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {apt.reason || <span className="text-gray-400 italic">No reason provided</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${getStatusBadge(apt.status)}`}>
                                                {apt.status.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end space-x-3">
                                                {canReschedule(apt) && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedAppointment(apt);
                                                            setIsRescheduleModalOpen(true);
                                                        }}
                                                        className="text-primary-600 hover:text-primary-900"
                                                    >
                                                        Reschedule
                                                    </button>
                                                )}
                                                {canManageReschedule(apt) && (
                                                    <>
                                                        <button
                                                            onClick={() => handleApprove(apt.id)}
                                                            className="text-green-600 hover:text-green-900 font-bold"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(apt.id)}
                                                            className="text-red-600 hover:text-red-900 font-bold"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                                {canCancel(apt) && (
                                                    <button
                                                        onClick={() => handleCancel(apt.id)}
                                                        className="text-red-600 hover:text-red-900"
                                                    >
                                                        Cancel
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Book Appointment Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Schedule Session</h3>
                            <button onClick={() => { setIsModalOpen(false); setBookingError(''); }} className="text-gray-400 hover:text-gray-500">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {bookingError && (
                            <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">{bookingError}</div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="label">Select Doctor</label>
                                {doctors.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic">No doctors available at the moment.</p>
                                ) : (
                                    <select
                                        required
                                        className="input-field"
                                        value={newAppointment.doctor_id}
                                        onChange={(e) => setNewAppointment({ ...newAppointment, doctor_id: Number(e.target.value) })}
                                    >
                                        <option value={0} disabled>-- Select a Doctor --</option>
                                        {doctors.map(d => (
                                            <option key={d.id} value={d.id}>{d.full_name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div>
                                <label className="label">Appointment Date & Time</label>
                                <input
                                    type="datetime-local"
                                    required
                                    className="input-field"
                                    value={newAppointment.appointment_date}
                                    min={new Date().toISOString().slice(0, 16)}
                                    onChange={(e) => setNewAppointment({ ...newAppointment, appointment_date: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="label">Duration (minutes)</label>
                                <select
                                    className="input-field"
                                    value={newAppointment.duration_minutes}
                                    onChange={(e) => setNewAppointment({ ...newAppointment, duration_minutes: Number(e.target.value) })}
                                >
                                    <option value={15}>15 minutes</option>
                                    <option value={30}>30 minutes</option>
                                    <option value={45}>45 minutes</option>
                                    <option value={60}>1 hour</option>
                                </select>
                            </div>

                            <div>
                                <label className="label">Reason for Visit</label>
                                <textarea
                                    required
                                    className="input-field"
                                    rows={3}
                                    value={newAppointment.reason}
                                    onChange={(e) => setNewAppointment({ ...newAppointment, reason: e.target.value })}
                                    placeholder="Briefly describe the purpose of this appointment..."
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-6">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); setBookingError(''); }}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Confirm Booking
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reschedule Request Modal */}
            {isRescheduleModalOpen && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Request New Slot</h3>
                            <button onClick={() => setIsRescheduleModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <form onSubmit={handleRescheduleRequest} className="space-y-4">
                            <div className="bg-amber-50 p-3 rounded-md mb-4 text-xs text-amber-800">
                                Current scheduled date: {selectedAppointment && format(new Date(selectedAppointment.appointment_date), 'MMM d, yyyy h:mm a')}
                            </div>
                            <div>
                                <label className="label">Requested Date & Time</label>
                                <input
                                    type="datetime-local"
                                    required
                                    className="input-field"
                                    value={rescheduleDate}
                                    min={new Date().toISOString().slice(0, 16)}
                                    onChange={(e) => setRescheduleDate(e.target.value)}
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsRescheduleModalOpen(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Submit Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Appointments;
