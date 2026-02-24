import React, { useState } from 'react';
import { diagnosisAPI } from '../services/api';
import { Activity, AlertTriangle, CheckCircle, Info, Brain, FlaskConical, Stethoscope } from 'lucide-react';

const ClinicalSupport: React.FC = () => {
    const [symptoms, setSymptoms] = useState('');
    const [result, setResult] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!symptoms.trim()) {
            return;
        }

        try {
            setIsLoading(true);
            const symptomList = symptoms.split(/[,\n]/).map(s => s.trim()).filter(s => s);
            const response = await diagnosisAPI.analyze(symptomList);
            setResult(response.data);
        } catch (error) {
            console.error('Analysis error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                        <Brain className="h-8 w-8 text-primary-600 mr-3" />
                        Clinical Decision Support AI
                    </h1>
                    <p className="text-gray-500 mt-1">AI-powered symptom analysis and evidence-based diagnostic suggestions</p>
                </div>
                <div className="hidden md:flex space-x-2">
                    <span className="bg-primary-50 text-primary-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">HIPAA Ready</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Symptom Input Area */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="card h-fit">
                        <div className="flex items-center mb-4">
                            <Stethoscope className="h-5 w-5 text-primary-600 mr-2" />
                            <h2 className="text-lg font-bold text-gray-900">Symptom Input</h2>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="label">Observed Symptoms</label>
                                <textarea
                                    required
                                    className="input-field min-h-[200px]"
                                    value={symptoms}
                                    onChange={(e) => setSymptoms(e.target.value)}
                                    placeholder="Enter patient symptoms (e.g., chest pain, difficulty breathing, numbness in left arm)..."
                                />
                                <p className="text-xs text-gray-400 mt-2">
                                    Separate symptoms with commas or new lines for better AI processing.
                                </p>
                            </div>
                            <button
                                type="submit"
                                className="btn-primary w-full flex items-center justify-center py-3"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Activity className="h-5 w-5 animate-spin mr-2" />
                                        Running Analysis...
                                    </>
                                ) : (
                                    <>
                                        <Brain className="h-5 w-5 mr-2" />
                                        Analyze with CrewAI
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start">
                        <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                        <p className="text-xs text-blue-700 leading-relaxed">
                            <strong>Note:</strong> This tool is for clinical support purposes only. All AI-generated suggestions must be verified by a qualified medical professional.
                        </p>
                    </div>
                </div>

                {/* Analysis Results Display */}
                <div className="lg:col-span-2 space-y-6">
                    {isLoading ? (
                        <div className="card flex flex-col items-center justify-center py-24 bg-gray-50 border-dashed border-2">
                            <Brain className="h-16 w-16 text-primary-200 animate-pulse mb-6" />
                            <p className="text-gray-500 font-medium">CrewAI agents are collaborating on the diagnosis...</p>
                            <div className="mt-8 flex space-x-2">
                                <div className="h-2 w-2 bg-primary-600 rounded-full animate-bounce"></div>
                                <div className="h-2 w-2 bg-primary-600 rounded-full animate-bounce delay-75"></div>
                                <div className="h-2 w-2 bg-primary-600 rounded-full animate-bounce delay-150"></div>
                            </div>
                        </div>
                    ) : result ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Emergency Alert Widget */}
                            {result.emergency_assessment?.is_emergency && (
                                <div className="bg-red-50 border-l-8 border-red-500 p-6 rounded-r-xl shadow-sm">
                                    <div className="flex">
                                        <AlertTriangle className="h-8 w-8 text-red-600" />
                                        <div className="ml-4">
                                            <h3 className="text-xl font-black text-red-900 uppercase tracking-tight">
                                                CRITICAL: Emergency Alert
                                            </h3>
                                            <div className="mt-3 text-red-800">
                                                <p className="font-bold text-lg mb-2">{result.emergency_assessment.condition}</p>
                                                <div className="space-y-2">
                                                    {result.emergency_assessment.actions.map((action: string, i: number) => (
                                                        <div key={i} className="flex items-start">
                                                            <span className="font-bold mr-2 text-red-600">•</span>
                                                            <span className="text-sm font-medium">{action}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Main Diagnosis Content */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="card">
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center border-b pb-2">
                                        <FlaskConical className="h-5 w-5 text-primary-600 mr-2" />
                                        Potential Conditions
                                    </h3>
                                    <div className="space-y-3">
                                        {(result.potential_diagnosis || []).map((condition: string, i: number) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                                <span className="font-semibold text-gray-800">{condition}</span>
                                                <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded">Likely</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="card">
                                    <h3 className="font-bold text-gray-900 mb-4 flex items-center border-b pb-2">
                                        <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                                        Clinical Actions
                                    </h3>
                                    <ul className="space-y-3">
                                        {(result.recommendations || []).map((rec: string, i: number) => (
                                            <li key={i} className="flex items-start">
                                                <CheckCircle className="h-4 w-4 text-green-500 mt-1 mr-2 flex-shrink-0" />
                                                <span className="text-sm text-gray-700">{rec}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <div className="card">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <Activity className="h-5 w-5 text-gray-400 mr-2" />
                                        <span className="font-bold text-gray-700">Risk Assessment Score</span>
                                    </div>
                                    <div className={`px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-widest ${result.risk_level === 'HIGH' ? 'bg-red-100 text-red-700' :
                                        result.risk_level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>
                                        {result.risk_level} Risk
                                    </div>
                                </div>
                                <div className="mt-4 w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-1000 ${result.risk_level === 'HIGH' ? 'bg-red-500 w-[90%]' :
                                            result.risk_level === 'MEDIUM' ? 'bg-amber-500 w-1/2' :
                                                'bg-green-500 w-[20%]'
                                            }`}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="card flex flex-col items-center justify-center py-32 bg-gray-50 border-dashed border-2">
                            <Info className="h-16 w-16 text-gray-200 mb-6" />
                            <h3 className="text-lg font-bold text-gray-400">Awaiting Clinical Data</h3>
                            <p className="text-gray-400 mt-2">Input patient symptoms on the left to start the AI analysis pipeline.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClinicalSupport;
