import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { communicationsAPI } from '../services/api';
import { Inbox, AlertCircle, CheckCircle2, MessageSquare } from 'lucide-react';
import type { Message } from '../types';
import clsx from 'clsx';

const InboxPage: React.FC = () => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchInbox = async () => {
        if (!user) return;
        try {
            const res = await communicationsAPI.getInbox(user.id as string);
            // Sort by created_at desc
            const sorted = res.data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setMessages(sorted);
        } catch (error) {
            console.error('Failed to fetch inbox:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInbox();
    }, [user]);

    const handleMarkAsRead = async (id: string) => {
        try {
            await communicationsAPI.markAsRead(id);
            setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    const unreadCount = messages.filter(m => !m.is_read).length;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Inbox</h1>
                    <p className="text-gray-500 mt-1">
                        {user?.role === 'doctor' 
                            ? 'Direct messages and inquiries from your patients' 
                            : 'Direct messages and clinical instructions from your doctor'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <span className="bg-primary-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-primary-200">
                        {unreadCount} Unread
                    </span>
                )}
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            ) : messages.length > 0 ? (
                <div className="space-y-4">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={clsx(
                                "flex flex-col p-5 rounded-2xl border transition-all duration-200",
                                msg.is_read
                                    ? "bg-white border-gray-100 opacity-75"
                                    : msg.is_urgent
                                        ? "bg-red-50 border-red-200 shadow-sm ring-1 ring-red-100"
                                        : "bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-100"
                            )}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center space-x-3">
                                    <div className={clsx(
                                        "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
                                        msg.is_urgent ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                                    )}>
                                        {msg.is_urgent ? <AlertCircle className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <h4 className={clsx("font-bold", msg.is_read ? "text-gray-700" : "text-gray-900")}>
                                            {msg.subject}
                                        </h4>
                                        <span className="text-xs font-medium text-gray-500">From: {msg.sender_name}</span>
                                    </div>
                                </div>
                                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                                    {new Date(msg.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            
                            <div className="pl-14 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                {msg.body}
                            </div>
                            
                            {!msg.is_read && (
                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={() => handleMarkAsRead(msg.id)}
                                        className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center bg-white px-3 py-1.5 rounded-lg border border-primary-100 shadow-sm hover:bg-primary-50 transition-colors"
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-1.5" /> Mark as read
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-2xl p-20 text-center border border-dashed border-gray-200">
                    <div className="h-20 w-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Inbox className="h-10 w-10 text-gray-200" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No messages</h3>
                    <p className="text-gray-500 max-w-sm mx-auto">
                        {user?.role === 'doctor' 
                            ? 'Your inbox is empty. Direct messages from your patients will appear here.' 
                            : 'Your inbox is empty. Direct messages from your doctor will appear here.'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default InboxPage;
