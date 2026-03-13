import React, { useState, useEffect } from 'react';
import { Pill, Calendar, User, Info, ChevronRight } from 'lucide-react';
import { patientsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

const Medications: React.FC = () => {
    const { user } = useAuth();
    const [medications, setMedications] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [patientId, setPatientId] = useState<string | null>(null);

    useEffect(() => {
        const fetchMeds = async () => {
            if (!user) return;
            try {
                // First get patient profile to get patient ID
                const profileRes = await patientsAPI.getMyProfile();
                const pId = profileRes.data.id;
                setPatientId(pId);

                const medsRes = await patientsAPI.getMedications(pId);
                setMedications(medsRes.data);
            } catch (error) {
                console.error('Failed to fetch medications:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchMeds();
    }, [user]);

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Medications</h1>
                    <p className="text-gray-500 mt-1">Your prescribed treatments and medication history</p>
                </div>
                <div className="bg-primary-50 text-primary-700 px-4 py-2 rounded-lg border border-primary-100 flex items-center">
                    <Pill className="h-5 w-5 mr-2" />
                    <span className="font-bold">{medications.length} Active/Past Medications</span>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            ) : medications.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {medications.map((med, index) => (
                        <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="h-12 w-12 bg-primary-100 rounded-xl flex items-center justify-center text-primary-600">
                                        <Pill className="h-6 w-6" />
                                    </div>
                                    <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-full uppercase">
                                        Prescribed
                                    </span>
                                </div>

                                <h3 className="text-xl font-bold text-gray-900 mb-1">{med.medication_name}</h3>
                                <div className="flex items-center text-sm text-gray-500 mb-4">
                                    <User className="h-4 w-4 mr-1" />
                                    <span>Dr. {med.prescribed_by}</span>
                                    <span className="mx-2">•</span>
                                    <Calendar className="h-4 w-4 mr-1" />
                                    <span>{new Date(med.prescribed_date).toLocaleDateString()}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Dosage</p>
                                        <p className="text-sm font-bold text-gray-700">{med.dosage}</p>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Frequency</p>
                                        <p className="text-sm font-bold text-gray-700">{med.frequency}</p>
                                    </div>
                                </div>

                                {med.instructions && (
                                    <div className="flex items-start bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
                                        <Info className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                                        <p className="text-xs text-blue-700 leading-relaxed">
                                            <span className="font-bold">Instructions: </span>
                                            {med.instructions}
                                        </p>
                                    </div>
                                )}
                            </div>
                            <div className="bg-gray-50 px-6 py-3 flex justify-between items-center border-t border-gray-100">
                                <span className="text-xs text-gray-400 italic">Reported in Clinical Encounter</span>
                                <button className="text-primary-600 text-xs font-bold flex items-center hover:underline">
                                    Details <ChevronRight className="h-3 w-3 ml-1" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-2xl p-20 text-center border border-dashed border-gray-200">
                    <div className="h-20 w-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Pill className="h-10 w-10 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No Medications Found</h3>
                    <p className="text-gray-500 max-w-sm mx-auto">You don't have any prescribed medications in your records yet. New prescriptions will appear here after your clinical encounters.</p>
                </div>
            )}
        </div>
    );
};

export default Medications;
