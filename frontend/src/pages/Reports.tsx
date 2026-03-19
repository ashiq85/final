import React, { useState, useEffect, useRef } from 'react';
import { reportsAPI, patientsAPI, documentsAPI } from '../services/api';
import { format } from 'date-fns';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    Heart, Activity, FileText, Download, TrendingUp, Calendar,
    ChevronRight, CheckCircle, RefreshCw, Upload, PlusCircle, X,
    Paperclip, Loader2, Trash2
} from 'lucide-react';

const METRIC_OPTIONS = [
    { value: 'blood_sugar_before', label: 'Blood Sugar (Before Meals)', unit: 'mg/dL' },
    { value: 'blood_sugar_after', label: 'Blood Sugar (After Meals)', unit: 'mg/dL' },
    { value: 'bp_systolic', label: 'Blood Pressure (Systolic)', unit: 'mmHg' },
    { value: 'bp_diastolic', label: 'Blood Pressure (Diastolic)', unit: 'mmHg' },
    { value: 'heart_rate', label: 'Heart Rate', unit: 'BPM' },
    { value: 'cholesterol', label: 'Cholesterol', unit: 'mg/dL' },
    { value: 'weight', label: 'Weight', unit: 'kg' },
    { value: 'custom', label: 'Other (Custom)', unit: '' },
];

const DOC_TYPES = ['lab_report', 'scan', 'prescription', 'discharge_summary', 'general'];

const Reports: React.FC = () => {
    const [patient, setPatient] = useState<any>(null);
    const [metrics, setMetrics] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [trendData, setTrendData] = useState<any[]>([]);

    // Health Metric Logging
    const [showMetricForm, setShowMetricForm] = useState(false);
    const [newMetric, setNewMetric] = useState({ metric_name: 'blood_sugar_before', custom_name: '', value: '', unit: 'mg/dL', notes: '' });
    const [savingMetric, setSavingMetric] = useState(false);
    const [metricMsg, setMetricMsg] = useState('');

    // Document Upload
    const [showUpload, setShowUpload] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [docType, setDocType] = useState('lab_report');
    const [uploading, setUploading] = useState(false);
    const [uploadMsg, setUploadMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const profileRes = await patientsAPI.getMyProfile();
            const p = profileRes.data;
            setPatient(p);

            const [metricsRes, reportsRes, docsRes] = await Promise.all([
                patientsAPI.getHealthMetrics(p.id),
                reportsAPI.get(p.id),
                documentsAPI.getAll(p.id),
            ]);

            const mData = metricsRes.data || [];
            setMetrics(mData);
            setReports(reportsRes.data || []);
            setDocuments(docsRes.data || []);

            const sorted = [...mData].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
            const chartPoints = sorted.slice(-10).map(m => ({
                date: format(new Date(m.recorded_at), 'MMM d'),
                value: m.value,
                name: m.metric_name,
                unit: m.unit
            }));
            const grouped = chartPoints.reduce((acc: any, curr: any) => {
                if (!acc[curr.date]) acc[curr.date] = { date: curr.date };
                
                const lowerName = curr.name.toLowerCase();
                
                if (lowerName.includes('heart')) {
                    acc[curr.date].heartRate = curr.value;
                } else if (lowerName.includes('sugar')) {
                    acc[curr.date].sugar = curr.value;
                } else if (lowerName.includes('bp') || lowerName.includes('pressure')) {
                    acc[curr.date].bp = curr.value;
                } else if (lowerName.includes('weight')) {
                    acc[curr.date].weight = curr.value;
                } else if (lowerName.includes('temp')) {
                    acc[curr.date].temp = curr.value;
                }
                
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
        try { await reportsAPI.downloadPDF(patient.id); } catch (error) { console.error('Download error:', error); }
    };

    const handleLogMetric = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patient) return;
        setSavingMetric(true);
        setMetricMsg('');
        try {
            const metricName = newMetric.metric_name === 'custom' ? newMetric.custom_name : newMetric.metric_name;
            const opt = METRIC_OPTIONS.find(o => o.value === newMetric.metric_name);
            await patientsAPI.logHealthMetric(patient.id, {
                metric_name: metricName,
                value: parseFloat(newMetric.value),
                unit: newMetric.unit || opt?.unit || '',
                notes: newMetric.notes,
            });
            setMetricMsg('✓ Health metric logged successfully!');
            setNewMetric({ metric_name: 'blood_sugar_before', custom_name: '', value: '', unit: 'mg/dL', notes: '' });
            setShowMetricForm(false);
            loadData();
        } catch (err: any) {
            setMetricMsg(err?.response?.data?.detail || 'Failed to log metric.');
        } finally {
            setSavingMetric(false);
            setTimeout(() => setMetricMsg(''), 4000);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadFile || !patient) return;
        setUploading(true);
        setUploadMsg('');
        try {
            await documentsAPI.upload(patient.id, uploadFile, docType, true);
            setUploadMsg('✓ Document uploaded successfully! Your doctor can now view it.');
            setUploadFile(null);
            setShowUpload(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            loadData();
        } catch (err: any) {
            setUploadMsg(err?.response?.data?.detail || 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
            setTimeout(() => setUploadMsg(''), 5000);
        }
    };

    const handleDeleteDoc = async (docId: string) => {
        if (!window.confirm('Remove this document?')) return;
        setDeletingDocId(docId);
        try {
            await documentsAPI.delete(docId);
            setDocuments(prev => prev.filter(d => d.id !== docId));
        } catch (err) { console.error(err); }
        finally { setDeletingDocId(null); }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <RefreshCw className="h-12 w-12 text-primary-500 animate-spin" />
                <p className="text-gray-500 font-medium tracking-widest uppercase text-xs">Loading your health data...</p>
            </div>
        );
    }

    const latestReport = reports.find(r => r.report_type === "AI Health Insight") || reports[0];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center">
                    <div className="bg-green-100 p-3 rounded-lg mr-4">
                        <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Analytics &amp; Health Reports</h1>
                        <p className="text-gray-500">Track your metrics, upload documents, and view clinical summaries</p>
                    </div>
                </div>
                <button onClick={handleDownload} className="btn-primary flex items-center px-6">
                    <Download className="h-4 w-4 mr-2" /> Export PDF
                </button>
            </div>

            {/* Feedback messages */}
            {metricMsg && (
                <div className={`p-3 rounded-lg text-sm font-medium ${metricMsg.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {metricMsg}
                </div>
            )}
            {uploadMsg && (
                <div className={`p-3 rounded-lg text-sm font-medium ${uploadMsg.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {uploadMsg}
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card border-0 bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10">
                        <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Latest Blood Pressure</p>
                        <div className="flex items-baseline mt-2">
                            <p className="text-4xl font-black">{metrics.find(m => (m.metric_name || '').toLowerCase().includes('bp') || (m.metric_name || '').toLowerCase().includes('pressure'))?.value || '--'}</p>
                            <span className="ml-2 text-sm font-medium text-blue-100">mmHg</span>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-blue-100 font-bold">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {metrics.find(m => (m.metric_name || '').toLowerCase().includes('bp') || (m.metric_name || '').toLowerCase().includes('pressure'))
                                ? `Updated ${format(new Date(metrics.find(m => (m.metric_name || '').toLowerCase().includes('bp') || (m.metric_name || '').toLowerCase().includes('pressure'))?.recorded_at || Date.now()), 'MMM d')}`
                                : 'Not logged yet'}
                        </div>
                    </div>
                    <Heart className="absolute -right-4 -bottom-4 h-32 w-32 text-white/10" />
                </div>

                <div className="card border-0 bg-gradient-to-br from-green-600 to-green-700 text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10">
                        <p className="text-xs font-bold uppercase tracking-widest text-green-100">Latest Blood Sugar</p>
                        <div className="flex items-baseline mt-2">
                            <p className="text-4xl font-black">{metrics.find(m => (m.metric_name || '').toLowerCase().includes('sugar') || (m.metric_name || '').toLowerCase().includes('blood_sugar'))?.value || '--'}</p>
                            <span className="ml-2 text-sm font-medium text-green-100">mg/dL</span>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-green-100 font-bold">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {metrics.find(m => (m.metric_name || '').toLowerCase().includes('sugar') || (m.metric_name || '').toLowerCase().includes('blood_sugar'))
                                ? `Updated ${format(new Date(metrics.find(m => (m.metric_name || '').toLowerCase().includes('sugar') || (m.metric_name || '').toLowerCase().includes('blood_sugar'))?.recorded_at || Date.now()), 'MMM d')}`
                                : 'Not logged yet'}
                        </div>
                    </div>
                    <Activity className="absolute -right-4 -bottom-4 h-32 w-32 text-white/10" />
                </div>

                <div className="card border-0 bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10">
                        <p className="text-xs font-bold uppercase tracking-widest text-purple-100">Documents Uploaded</p>
                        <div className="flex items-baseline mt-2">
                            <p className="text-4xl font-black">{documents.length}</p>
                            <span className="ml-2 text-sm font-medium text-purple-100">Files</span>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-purple-100 font-bold">
                            <Calendar className="h-3 w-3 mr-1" /> Shared with your doctor
                        </div>
                    </div>
                    <FileText className="absolute -right-4 -bottom-4 h-32 w-32 text-white/10" />
                </div>
            </div>

            {/* Action Panels Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Log Health Metric */}
                <div className="card space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <Activity className="h-5 w-5 text-primary-600" /> Log Health Metric
                        </h3>
                        <button
                            onClick={() => setShowMetricForm(!showMetricForm)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 transition-all ${showMetricForm ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-primary-100 text-primary-700 hover:bg-primary-200'}`}
                        >
                            {showMetricForm ? <><X className="h-3 w-3" /> Cancel</> : <><PlusCircle className="h-3 w-3" /> Add New</>}
                        </button>
                    </div>

                    {showMetricForm && (
                        <form onSubmit={handleLogMetric} className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Metric Type</label>
                                <select
                                    className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                                    value={newMetric.metric_name}
                                    onChange={e => {
                                        const opt = METRIC_OPTIONS.find(o => o.value === e.target.value);
                                        setNewMetric({ ...newMetric, metric_name: e.target.value, unit: opt?.unit || '' });
                                    }}
                                >
                                    {METRIC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            {newMetric.metric_name === 'custom' && (
                                <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Custom Metric Name</label>
                                    <input
                                        required
                                        className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500"
                                        placeholder="e.g. Uric Acid"
                                        value={newMetric.custom_name}
                                        onChange={e => setNewMetric({ ...newMetric, custom_name: e.target.value })}
                                    />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Value</label>
                                    <input
                                        required type="number" step="0.1"
                                        className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500"
                                        placeholder="0.0"
                                        value={newMetric.value}
                                        onChange={e => setNewMetric({ ...newMetric, value: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Unit</label>
                                    <input
                                        className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500"
                                        placeholder="mg/dL"
                                        value={newMetric.unit}
                                        onChange={e => setNewMetric({ ...newMetric, unit: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Notes (optional)</label>
                                <input
                                    className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500"
                                    placeholder="e.g. fasting, after exercise..."
                                    value={newMetric.notes}
                                    onChange={e => setNewMetric({ ...newMetric, notes: e.target.value })}
                                />
                            </div>
                            <button type="submit" disabled={savingMetric} className="w-full btn-primary py-2 flex items-center justify-center gap-2">
                                {savingMetric ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                {savingMetric ? 'Saving...' : 'Save Metric'}
                            </button>
                        </form>
                    )}

                    {/* Recent Metrics Table */}
                    <div className="overflow-hidden rounded-xl border border-gray-100">
                        <table className="min-w-full divide-y divide-gray-100 text-sm">
                            <thead className="bg-gray-50 text-left">
                                <tr>
                                    <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase">Date</th>
                                    <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase">Metric</th>
                                    <th className="px-4 py-2 text-[10px] font-bold text-gray-500 uppercase">Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {metrics.slice(0, 6).map((m, i) => (
                                    <tr key={i} className="hover:bg-primary-50 transition-colors">
                                        <td className="px-4 py-2 text-gray-500">{format(new Date(m.recorded_at), 'MMM d, yyyy')}</td>
                                        <td className="px-4 py-2 capitalize font-medium">{(m.metric_name || '').replace(/_/g, ' ')}</td>
                                        <td className="px-4 py-2 font-bold text-primary-700">{m.value} <span className="font-normal text-gray-400 text-xs">{m.unit}</span></td>
                                    </tr>
                                ))}
                                {metrics.length === 0 && (
                                    <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No metrics logged yet. Use the button above to add one.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Document Upload */}
                <div className="card space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <Paperclip className="h-5 w-5 text-primary-600" /> My Documents
                        </h3>
                        <button
                            onClick={() => setShowUpload(!showUpload)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 transition-all ${showUpload ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-primary-100 text-primary-700 hover:bg-primary-200'}`}
                        >
                            {showUpload ? <><X className="h-3 w-3" /> Cancel</> : <><Upload className="h-3 w-3" /> Upload</>}
                        </button>
                    </div>

                    {showUpload && (
                        <form onSubmit={handleUpload} className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Document Type</label>
                                <select
                                    className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500 bg-white"
                                    value={docType} onChange={e => setDocType(e.target.value)}
                                >
                                    {DOC_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Select File</label>
                                <div
                                    className="mt-1 border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-all"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {uploadFile ? (
                                        <div className="flex items-center justify-center gap-2 text-primary-700 font-medium text-sm">
                                            <FileText className="h-5 w-5" /> {uploadFile.name}
                                        </div>
                                    ) : (
                                        <>
                                            <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                            <p className="text-sm text-gray-500">Click to select a file</p>
                                            <p className="text-xs text-gray-400">PDF, JPG, PNG supported</p>
                                        </>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef} type="file" className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                                />
                            </div>
                            <button type="submit" disabled={!uploadFile || uploading} className="w-full btn-primary py-2 flex items-center justify-center gap-2 disabled:opacity-50">
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                {uploading ? 'Uploading...' : 'Upload Document'}
                            </button>
                            <p className="text-xs text-gray-400 text-center">Documents are shared with your clinical team</p>
                        </form>
                    )}

                    {/* Documents List */}
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {documents.length === 0 ? (
                            <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                                <Paperclip className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                <p className="text-sm text-gray-400">No documents uploaded yet.</p>
                            </div>
                        ) : documents.map(doc => (
                            <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-primary-200 transition-all">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-9 w-9 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <FileText className="h-4 w-4 text-primary-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-800 truncate">{doc.filename}</p>
                                        <p className="text-xs text-gray-400 capitalize">{(doc.document_type || '').replace(/_/g, ' ')} · {doc.created_at ? format(new Date(doc.created_at), 'MMM d, yyyy') : ''}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteDoc(doc.id)}
                                    disabled={deletingDocId === doc.id}
                                    className="ml-2 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                >
                                    {deletingDocId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Vitals Chart + AI Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card p-0 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="font-bold text-gray-900">Vitals Monitoring Trend</h3>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded">Last 10 Entries</span>
                    </div>
                    <div className="p-6 h-72">
                        {trendData.length > 0 ? (
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
                                    <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                    <Area type="monotone" dataKey="heartRate" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorHr)" name="Heart Rate (BPM)" />
                                    <Area type="monotone" dataKey="sugar" stroke="#10b981" strokeWidth={3} fillOpacity={0.1} fill="#10b981" name="Blood Sugar (mg/dL)" />
                                    <Area type="monotone" dataKey="bp" stroke="#ef4444" strokeWidth={3} fillOpacity={0.1} fill="#ef4444" name="Blood Pressure (mmHg)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center">
                                <Activity className="h-12 w-12 text-gray-200 mb-3" />
                                <p className="text-sm text-gray-400">Log heart rate or blood sugar metrics to see your vitals trend chart.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-gray-900">Health Summary &amp; AI Findings</h3>
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
                                {(latestReport.report_data?.recommendations || []).map((rec: string, i: number) => (
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
                                <p className="text-sm text-gray-400">No AI health insights yet. Log your vitals above to trigger an analysis.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Reports;
