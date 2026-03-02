import React, { useState, useEffect } from 'react';
import { alertsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, CheckCircle, Bell, ShieldAlert, Clock, Terminal, Activity, Stethoscope, Brain } from 'lucide-react';
import { format } from 'date-fns';
import { AlertSeverity } from '../types';
import type { Alert } from '../types';

type AlertTab = 'all' | 'emergency' | 'clinical' | 'general';

const severityColors: Record<string, string> = {
    critical: 'border-red-500 bg-red-50/30',
    high: 'border-orange-500 bg-orange-50/30',
    medium: 'border-yellow-500 bg-yellow-50/30',
    low: 'border-blue-500 bg-blue-50/30',
};

const severityBadge: Record<string, string> = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-white',
    low: 'bg-blue-500 text-white',
};

const isEmergency = (alert: Alert) =>
    ['critical', 'high'].includes(alert.severity?.toLowerCase()) &&
    (alert.title?.toLowerCase().includes('emergency') ||
        alert.title?.toLowerCase().includes('priority') ||
        alert.auto_booked_appointment_id != null);

const isClinical = (alert: Alert) =>
    alert.title?.toLowerCase().includes('analysis') ||
    alert.title?.toLowerCase().includes('clinical');

const Alerts: React.FC = () => {
    const { user } = useAuth();
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSimulating, setIsSimulating] = useState(false);
    const [activeTab, setActiveTab] = useState<AlertTab>('all');

    useEffect(() => {
        loadAlerts();
    }, []);

    const loadAlerts = async () => {
        try {
            setIsLoading(true);
            const response = await alertsAPI.getActive();
            setAlerts(response.data);
        } catch (error) {
            console.error('Error loading alerts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResolve = async (id: number) => {
        try {
            await alertsAPI.resolve(id);
            loadAlerts();
        } catch (error) {
            console.error('Resolve error:', error);
        }
    };

    const handleEmergencySimulation = async () => {
        try {
            setIsSimulating(true);
            await alertsAPI.triggerEmergency({
                patient_id: 1,
                symptoms: ['severe chest pain', 'shortness of breath', 'cold sweat'],
                vitals: {
                    heart_rate: 115,
                    blood_pressure: '165/105',
                    oxygen_saturation: 91,
                },
            });
            setIsSimulating(false);
            loadAlerts();
        } catch (error) {
            console.error('Simulation error:', error);
            setIsSimulating(false);
        }
    };

    const filteredAlerts = alerts.filter((a) => {
        if (activeTab === 'all') return true;
        if (activeTab === 'emergency') return isEmergency(a);
        if (activeTab === 'clinical') return isClinical(a) && !isEmergency(a);
        if (activeTab === 'general') return !isEmergency(a) && !isClinical(a);
        return true;
    });

    const tabs: { key: AlertTab; label: string; icon: React.ReactNode; count: number }[] = [
        { key: 'all', label: 'All Alerts', icon: <Bell className="h-4 w-4" />, count: alerts.length },
        { key: 'emergency', label: 'Emergency', icon: <ShieldAlert className="h-4 w-4" />, count: alerts.filter(isEmergency).length },
        {
            key: 'clinical',
            label: 'AI Clinical Analyses',
            icon: <Brain className="h-4 w-4" />,
            count: alerts.filter((a) => isClinical(a) && !isEmergency(a)).length,
        },
        { key: 'general', label: 'General', icon: <Stethoscope className="h-4 w-4" />, count: alerts.filter((a) => !isEmergency(a) && !isClinical(a)).length },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center">
                    <div className="bg-primary-100 p-3 rounded-lg mr-4">
                        <Bell className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Health Alerts</h1>
                        <p className="text-gray-500">Real-time clinical monitoring and AI analysis results</p>
                    </div>
                </div>
                {user?.role === 'admin' && (
                    <button
                        onClick={handleEmergencySimulation}
                        disabled={isSimulating}
                        className="flex items-center text-red-600 font-bold text-sm bg-red-50 px-4 py-2 rounded-lg border border-red-100 hover:bg-red-100 transition-all"
                    >
                        <ShieldAlert className="h-4 w-4 mr-2" />
                        {isSimulating ? 'SIMULATING...' : 'SIMULATE EMERGENCY'}
                    </button>
                )}
            </div>

            {/* Severity Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card bg-red-50 border-red-100">
                    <p className="text-xs font-bold text-red-600 uppercase mb-1">Critical</p>
                    <p className="text-2xl font-black text-gray-900">{alerts.filter((a) => a.severity === AlertSeverity.CRITICAL).length}</p>
                </div>
                <div className="card bg-orange-50 border-orange-100">
                    <p className="text-xs font-bold text-orange-600 uppercase mb-1">High</p>
                    <p className="text-2xl font-black text-gray-900">{alerts.filter((a) => a.severity === AlertSeverity.HIGH).length}</p>
                </div>
                <div className="card bg-yellow-50 border-yellow-100">
                    <p className="text-xs font-bold text-yellow-600 uppercase mb-1">Medium</p>
                    <p className="text-2xl font-black text-gray-900">{alerts.filter((a) => a.severity === AlertSeverity.MEDIUM).length}</p>
                </div>
                <div className="card bg-blue-50 border-blue-100">
                    <p className="text-xs font-bold text-blue-600 uppercase mb-1">Informational</p>
                    <p className="text-2xl font-black text-gray-900">{alerts.filter((a) => a.severity === AlertSeverity.LOW).length}</p>
                </div>
            </div>

            {/* Category Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center flex-1 justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === tab.key
                                ? 'bg-white shadow-sm text-primary-700'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                        {tab.count > 0 && (
                            <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.key ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'}`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Alert List */}
            <div className="space-y-4">
                {isLoading && (
                    <div className="card text-center py-20 grayscale opacity-50">
                        <Activity className="h-12 w-12 text-gray-300 animate-pulse mx-auto mb-4" />
                        <p className="text-gray-500 font-medium">Loading alerts...</p>
                    </div>
                )}

                {filteredAlerts.length === 0 && !isLoading && (
                    <div className="card text-center py-20">
                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6 drop-shadow-sm" />
                        <h2 className="text-xl font-bold text-gray-900">
                            {activeTab === 'emergency' ? 'No Active Emergencies' :
                                activeTab === 'clinical' ? 'No AI Analyses Yet' :
                                    activeTab === 'general' ? 'No General Alerts' : 'All Systems Clear'}
                        </h2>
                        <p className="text-gray-500 mt-2">
                            {activeTab === 'clinical'
                                ? 'Submit symptoms on the Clinical Support page to run an AI analysis. Results will appear here.'
                                : 'No active alerts in this category.'}
                        </p>
                    </div>
                )}

                {filteredAlerts.map((alert) => {
                    const sev = alert.severity?.toLowerCase() || 'low';
                    return (
                        <div
                            key={alert.id}
                            className={`card border-l-8 overflow-hidden transition-all duration-300 hover:shadow-md ${severityColors[sev] || 'border-gray-400'}`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center mb-2 flex-wrap gap-2">
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${severityBadge[sev] || 'bg-gray-500 text-white'}`}>
                                            {alert.severity}
                                        </span>
                                        {isClinical(alert) && (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-purple-100 text-purple-700 flex items-center gap-1">
                                                <Brain className="h-2.5 w-2.5" /> AI Analysis
                                            </span>
                                        )}
                                        {isEmergency(alert) && (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-700 flex items-center gap-1">
                                                <ShieldAlert className="h-2.5 w-2.5" /> Emergency
                                            </span>
                                        )}
                                        {alert.auto_booked_appointment_id && (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-green-100 text-green-700">
                                                Appointment Booked
                                            </span>
                                        )}
                                        <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">{alert.title}</h3>
                                    </div>
                                    <p className="text-gray-700 font-medium mb-4">{alert.description}</p>

                                    {alert.recommended_actions && alert.recommended_actions.length > 0 && (
                                        <div className="bg-white/60 p-4 rounded-xl border border-gray-100 mb-4">
                                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center">
                                                <Terminal className="h-3 w-3 mr-1.5" /> AI Recommended Protocol
                                            </p>
                                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {alert.recommended_actions.map((action: string, i: number) => (
                                                    <li key={i} className="flex items-center text-sm text-gray-800 font-bold">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-primary-500 mr-2" />
                                                        {action}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="flex items-center text-xs text-gray-400 font-bold space-x-4">
                                        <span className="flex items-center">
                                            <Clock className="h-3.5 w-3.5 mr-1" />
                                            {format(new Date(alert.created_at || new Date().toISOString()), 'PPP p')}
                                        </span>
                                        <span className="flex items-center uppercase tracking-tighter text-primary-600">
                                            <AlertCircle className="h-3.5 w-3.5 mr-1" /> ID: {alert.id?.toString().slice(-6).padStart(6, '0')}
                                        </span>
                                    </div>
                                </div>

                                {!alert.is_resolved && (
                                    <button
                                        onClick={() => handleResolve(alert.id)}
                                        className="ml-6 p-4 text-green-600 bg-white shadow-sm border border-green-100 rounded-2xl hover:bg-green-600 hover:text-white transition-all duration-300 group"
                                        title="Acknowledge/Resolve"
                                    >
                                        <CheckCircle className="h-8 w-8 group-hover:scale-110 transition-transform" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Alerts;
