import React, { useState } from 'react';
import { communicationsAPI } from '../services/api';
import { Send, X, AlertCircle } from 'lucide-react';
import type { Patient } from '../types';

interface CommunicationModalProps {
    isOpen: boolean;
    onClose: () => void;
    patient: Patient | null;
}

const CommunicationModal: React.FC<CommunicationModalProps> = ({ isOpen, onClose, patient }) => {
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);

    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    if (!isOpen || !patient) return null;

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsSending(true);

        try {
            await communicationsAPI.send({
                recipient_id: patient.user_id, // Important: messages route to the user_id, not patient_id
                subject,
                body,
                is_urgent: isUrgent
            });

            setSuccess('Message sent successfully!');
            setTimeout(() => {
                onClose();
                setSubject('');
                setBody('');
                setIsUrgent(false);
                setSuccess('');
            }, 1500);

        } catch (err: any) {
            console.error('Failed to send message', err);
            setError(err.response?.data?.detail || 'Failed to send message. Please try again.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-lg font-medium text-gray-900">Message Patient</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSend} className="p-6 space-y-4">
                    <div>
                        <p className="text-sm text-gray-500 mb-4">
                            Sending to: <span className="font-medium text-gray-900">{patient.user?.full_name}</span>
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 text-sm text-red-700 bg-red-50 rounded-md border border-red-200">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 text-sm text-green-700 bg-green-50 rounded-md border border-green-200">
                            {success}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                        <input
                            type="text"
                            required
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            placeholder="Follow-up instructions"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                        <textarea
                            required
                            rows={4}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                            placeholder="Please remember to take your new medication..."
                        />
                    </div>

                    <div className="flex items-center">
                        <input
                            id="urgent"
                            type="checkbox"
                            checked={isUrgent}
                            onChange={(e) => setIsUrgent(e.target.checked)}
                            className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                        />
                        <label htmlFor="urgent" className="ml-2 block text-sm text-gray-900 flex items-center">
                            <AlertCircle className="h-4 w-4 text-red-500 mr-1" />
                            Mark as Urgent
                        </label>
                    </div>

                    <div className="pt-4 flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSending}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                        >
                            {isSending ? 'Sending...' : (
                                <>
                                    <Send className="h-4 w-4 mr-2" />
                                    Send Message
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CommunicationModal;
