import React from 'react';
import { reportsAPI } from '../services/api';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Heart, Activity, FileText, Download, TrendingUp, Calendar, ChevronRight, CheckCircle } from 'lucide-react';

const Reports: React.FC = () => {
    const handleDownload = async () => {
        try {
            await reportsAPI.downloadPDF(1);
        } catch (error) {
            console.error('Download error:', error);
        }
    };

    // Mock data for trends visualization
    const trendData = [
        { date: 'Jan', heartRate: 72, bp: 120, oxygen: 98 },
        { date: 'Feb', heartRate: 75, bp: 118, oxygen: 97 },
        { date: 'Mar', heartRate: 70, bp: 122, oxygen: 99 },
        { date: 'Apr', heartRate: 68, bp: 119, oxygen: 98 },
        { date: 'May', heartRate: 74, bp: 121, oxygen: 98 },
        { date: 'Jun', heartRate: 71, bp: 120, oxygen: 99 }
    ];

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
                        <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Avg. Heart Rate</p>
                        <div className="flex items-baseline mt-2">
                            <p className="text-4xl font-black">72</p>
                            <span className="ml-2 text-sm font-medium text-blue-100">BPM</span>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-blue-100 font-bold">
                            <TrendingUp className="h-3 w-3 mr-1" /> 2% decrease from last month
                        </div>
                    </div>
                    <Heart className="absolute -right-4 -bottom-4 h-32 w-32 text-white/10" />
                </div>

                <div className="card border-0 bg-gradient-to-br from-green-600 to-green-700 text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10">
                        <p className="text-xs font-bold uppercase tracking-widest text-green-100">Blood Pressure</p>
                        <div className="flex items-baseline mt-2">
                            <p className="text-4xl font-black">120/80</p>
                            <span className="ml-2 text-sm font-medium text-green-100">mmHg</span>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-green-100 font-bold">
                            <CheckCircle className="h-3 w-3 mr-1" /> Optimal Range
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
                                <Area type="monotone" dataKey="heartRate" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorHr)" name="Heart Rate" />
                                <Area type="monotone" dataKey="bp" stroke="#ef4444" strokeWidth={3} fillOpacity={0} name="Systolic BP" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-900">Health Summary & Findings</h3>
                        <button className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center uppercase tracking-widest">
                            Full Analysis <ChevronRight className="h-3 w-3 ml-1" />
                        </button>
                    </div>
                    <div className="space-y-6">
                        <div className="flex items-start">
                            <div className="h-2 w-2 rounded-full bg-green-500 mt-2 mr-3 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-gray-800">Cardiovascular Health</p>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">Vitals remain within optimal parameters. Stability in blood pressure noted over the last 90 days.</p>
                            </div>
                        </div>
                        <div className="flex items-start">
                            <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 mr-3 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-gray-800">Respiratory Performance</p>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">Oxygen saturation is consistently at 98-99%. No significant anomalies detected during sleep patterns.</p>
                            </div>
                        </div>
                        <div className="flex items-start">
                            <div className="h-2 w-2 rounded-full bg-amber-500 mt-2 mr-3 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-gray-800">Weight & Metabolic Profile</p>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">BMI is steady. Recommend continuing current activity levels with focus on cardiovascular endurance.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
