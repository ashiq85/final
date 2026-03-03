import React, { useState, useEffect } from 'react';
import { reportsAPI, patientsAPI } from '../services/api';
import { format } from 'date-fns';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Heart, Activity, FileText, Download, TrendingUp, Calendar, ChevronRight, CheckCircle, RefreshCw } from 'lucide-react';

const Reports: React.FC = () => {
    const [patient, setPatient] = useState<any>(null);
    const [metrics, setMetrics] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [trendData, setTrendData] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const profileRes = await patientsAPI.getMyProfile();
            const p = profileRes.data;
            setPatient(p);

            const metricsRes = await patientsAPI.getHealthMetrics(p.id);
            const mData = metricsRes.data || [];
            setMetrics(mData);

            const reportsRes = await reportsAPI.get(p.id);
            setReports(reportsRes.data || []);

            // Process metrics for chart (last 10 points)
            const sorted = [...mData].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
            const chartPoints = sorted.slice(-10).map(m => ({
                date: format(new Date(m.recorded_at), 'MMM d'),
                value: m.value,
                name: m.metric_name,
                unit: m.unit
            }));

            // Re-group by date for better visualization if multiple metrics exist
            const grouped = chartPoints.reduce((acc: any, curr: any) => {
                if (!acc[curr.date]) acc[curr.date] = { date: curr.date };
                if (curr.name.includes('heart')) acc[curr.date].heartRate = curr.value;
                if (curr.name.includes('blood_sugar')) acc[curr.date].sugar = curr.value;
                return acc;
            }, {});

            setTrendData(Object.values(grouped));

        } catch (error) {
            console.error('Error loading reports data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!patient) return;
        try {
            await reportsAPI.downloadPDF(patient.id);
        } catch (error) {
            console.error('Download error:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <RefreshCw className="h-12 w-12 text-primary-500 animate-spin" />
                <p className="text-gray-500 font-medium tracking-widest uppercase text-xs">Generating Your Clinical Analytics...</p>
            </div>
        );
    }

    const latestReport = reports.find(r => r.report_type === "AI Health Insight") || reports[0];



    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center">
                    <div className="bg-green-100 p-3 rounded-lg mr-4">
                        <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Analytics & Health Reports</h1>
                        <p className="text-gray-500">Comprehensive health trends and printable clinical summaries</p>
                    </div>
                </div>
                <button
                    onClick={handleDownload}
                    className="btn-primary flex items-center px-6"
                >
                    <Download className="h-4 w-4 mr-2" />
                    Export Detailed PDF
                </button>
            </div>

            {/* Health Score Hub */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card border-0 bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10">
                        <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Latest Heart Rate</p>
                        <div className="flex items-baseline mt-2">
                            <p className="text-4xl font-black">
                                {metrics.find(m => m.metric_name.includes('heart'))?.value || '--'}
                            </p>
                            <span className="ml-2 text-sm font-medium text-blue-100">BPM</span>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-blue-100 font-bold">
                            <TrendingUp className="h-3 w-3 mr-1" /> Updated {metrics.find(m => m.metric_name.includes('heart')) ? format(new Date(metrics.find(m => m.metric_name.includes('heart')).recorded_at), 'MMM d') : 'recently'}
                        </div>
                    </div>
                    <Heart className="absolute -right-4 -bottom-4 h-32 w-32 text-white/10" />
                </div>

                <div className="card border-0 bg-gradient-to-br from-green-600 to-green-700 text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10">
                        <p className="text-xs font-bold uppercase tracking-widest text-green-100">Latest Blood Sugar</p>
                        <div className="flex items-baseline mt-2">
                            <p className="text-4xl font-black">
                                {metrics.find(m => m.metric_name.includes('sugar'))?.value || '--'}
                            </p>
                            <span className="ml-2 text-sm font-medium text-green-100">mg/dL</span>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-green-100 font-bold">
                            <CheckCircle className="h-3 w-3 mr-1" /> {metrics.find(m => m.metric_name.includes('sugar'))?.unit || 'Verified'}
                        </div>
                    </div>
                    <Activity className="absolute -right-4 -bottom-4 h-32 w-32 text-white/10" />
                </div>

                <div className="card border-0 bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10">
                        <p className="text-xs font-bold uppercase tracking-widest text-purple-100">Total Visits</p>
                        <div className="flex items-baseline mt-2">
                            <p className="text-4xl font-black">12</p>
                            <span className="ml-2 text-sm font-medium text-purple-100">Clinical Sessions</span>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-purple-100 font-bold">
                            <Calendar className="h-3 w-3 mr-1" /> Next visit in 12 days
                        </div>
                    </div>
                    <FileText className="absolute -right-4 -bottom-4 h-32 w-32 text-white/10" />
                </div>
            </div>

            {/* Insight Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card p-0 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-bold text-gray-900">Vitals Monitoring Trend</h3>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded">Last 6 Months</span>
                    </div>
                    <div className="p-6 h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="heartRate" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorHr)" name="Heart Rate (BPM)" />
                                <Area type="monotone" dataKey="sugar" stroke="#10b981" strokeWidth={3} fillOpacity={0.1} fill="#10b981" name="Blood Sugar (mg/dL)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-900">Health Summary & AI Findings</h3>
                        <button className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center uppercase tracking-widest">
                            Full History <ChevronRight className="h-3 w-3 ml-1" />
                        </button>
                    </div>
                    <div className="space-y-6">
                        {latestReport ? (
                            <>
                                <div className="flex items-start">
                                    <div className="h-2 w-2 rounded-full bg-primary-500 mt-2 mr-3 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">{latestReport.report_type}</p>
                                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                            {latestReport.report_data?.interpretation || "No interpretation available for this period."}
                                        </p>
                                    </div>
                                </div>
                                {latestReport.report_data?.recommendations?.map((rec: string, i: number) => (
                                    <div key={i} className="flex items-start">
                                        <div className="h-2 w-2 rounded-full bg-green-500 mt-2 mr-3 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">Recommendation {i + 1}</p>
                                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{rec}</p>
                                        </div>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div className="text-center py-10">
                                <FileText className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                                <p className="text-sm text-gray-400">No AI health insights available yet. Log your vitals to trigger an analysis.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
