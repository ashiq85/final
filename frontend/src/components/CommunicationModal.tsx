import React, { useState, useEffect, useRef } from 'react';
import { communicationsAPI } from '../services/api';
import { Send, X, MessageCircle, Clock } from 'lucide-react';
import type { Message } from '../types';
import { format } from 'date-fns';

interface CommunicationModalProps {
    isOpen: boolean;
    onClose: () => void;
    recipientId: string | null;
    recipientName: string | null;
}

const CommunicationModal: React.FC<CommunicationModalProps> = ({ isOpen, onClose, recipientId, recipientName }) => {
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);
    const [thread, setThread] = useState<Message[]>([]);
    const [loadingThread, setLoadingThread] = useState(false);

    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    const threadEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen && recipientId) {
            fetchThread();
        }
    }, [isOpen, recipientId]);

    useEffect(() => {
        scrollToBottom();
    }, [thread]);

    const fetchThread = async () => {
        if (!recipientId) return;
        setLoadingThread(true);
        try {
            const res = await communicationsAPI.getThread(recipientId);
            setThread(res.data);
        } catch (err) {
            console.error('Failed to fetch thread', err);
        } finally {
            setLoadingThread(false);
        }
    };

    if (!isOpen || !recipientId) return null;

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsSending(true);

        try {
            await communicationsAPI.send({
                recipient_id: recipientId,
                subject,
                body,
                is_urgent: isUrgent
            });

            setSuccess('Message sent successfully!');
            // Add to local thread immediately for better UX
            const newMessage: any = {
                id: Math.random().toString(),
                sender_id: 'me', // simplistic for UI
                sender_name: 'You',
                subject,
                body,
                is_urgent: isUrgent,
                created_at: new Date().toISOString(),
                is_read: false
            };
            setThread(prev => [newMessage, ...prev].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
            
            setSubject('');
            setBody('');
            setIsUrgent(false);
            
            setTimeout(() => setSuccess(''), 3000);

        } catch (err: any) {
            console.error('Failed to send message', err);
            setError(err.response?.data?.detail || 'Failed to send message. Please try again.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary-100 p-2 rounded-full">
                            <MessageCircle className="h-5 w-5 text-primary-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Communication History</h3>
                            <p className="text-xs text-gray-500 font-medium">Chatting with {recipientName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto p-6 bg-gray-50/50 space-y-4 min-h-[300px]">
                    {loadingThread ? (
                        <div className="flex justify-center items-center h-full py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        </div>
                    ) : thread.length === 0 ? (
                        <div className="text-center py-12">
                            <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-sm text-gray-500">No previous messages with this patient.</p>
                            <p className="text-xs text-gray-400 mt-1">Send a message below to start the conversation.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {thread.map((msg, idx) => {
                                const isMe = msg.sender_id === 'me' || msg.sender_role === 'doctor' || msg.sender_id !== recipientId;
                                return (
                                    <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                                            isMe 
                                            ? 'bg-primary-600 text-white rounded-tr-none' 
                                            : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                                        }`}>
                                            {!isMe && <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-60">{msg.sender_name}</p>}
                                            <p className="text-xs font-bold mb-1">{msg.subject}</p>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                                            <div className={`mt-2 flex items-center gap-2 text-[10px] ${isMe ? 'text-primary-100' : 'text-gray-400'}`}>
                                                <span>{format(new Date(msg.created_at), 'MMM dd, HH:mm')}</span>
                                                {msg.is_urgent && <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full font-black animate-pulse">URGENT</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={threadEndRef} />
                        </div>
                    )}
                </div>

                <div className="p-6 bg-white border-t border-gray-100">
                    <form onSubmit={handleSend} className="space-y-3">
                        <div className="flex gap-3">
                            <div className="flex-grow space-y-3">
                                <input
                                    type="text"
                                    required
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500 text-sm font-medium"
                                    placeholder="Message Subject..."
                                />
                                <textarea
                                    required
                                    rows={2}
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary-500 text-sm font-medium resize-none"
                                    placeholder="Type your message here..."
                                />
                            </div>
                            <div className="flex flex-col justify-between py-1">
                                <div className="flex flex-col items-center gap-2">
                                    <input
                                        id="urgent-toggle"
                                        type="checkbox"
                                        checked={isUrgent}
                                        onChange={(e) => setIsUrgent(e.target.checked)}
                                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded cursor-pointer"
                                    />
                                    <label htmlFor="urgent-toggle" className="text-[10px] font-bold text-red-500 uppercase cursor-pointer">Urgent</label>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSending || !body.trim()}
                                    className="bg-primary-600 hover:bg-primary-700 text-white p-3 rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-primary-200"
                                >
                                    {isSending ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                        {error && <p className="text-xs text-red-500 font-bold px-1 animate-bounce">{error}</p>}
                        {success && <p className="text-xs text-green-500 font-bold px-1">{success}</p>}
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CommunicationModal;
