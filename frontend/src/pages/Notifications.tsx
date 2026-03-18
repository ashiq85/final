import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, AlertCircle, MessageSquare, Info, Filter } from 'lucide-react';
import { communicationsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

const Notifications: React.FC = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            const res = await communicationsAPI.getNotifications(user.id as string);
            setNotifications(res.data);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, [user]);

    const handleMarkAsRead = async (id: string) => {
        try {
            await communicationsAPI.markNotificationRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'emergency': return <AlertCircle className="h-5 w-5 text-red-600" />;
            case 'new_message': return <MessageSquare className="h-5 w-5 text-blue-600" />;
            case 'appointment': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
            default: return <Info className="h-5 w-5 text-primary-600" />;
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
                    <p className="text-gray-500 mt-1">Updates on your health and appointments</p>
                </div>
                <div className="flex items-center space-x-3">
                    <button className="p-2 text-gray-400 hover:text-primary-600 bg-gray-50 rounded-lg transition-colors">
                        <Filter className="h-5 w-5" />
                    </button>
                    {unreadCount > 0 && (
                        <span className="bg-primary-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-primary-200">
                            {unreadCount} New
                        </span>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            ) : notifications.length > 0 ? (
                <div className="space-y-3">
                    {notifications.map((notif) => (
                        <div
                            key={notif.id}
                            className={clsx(
                                "flex items-start p-5 rounded-2xl border transition-all duration-200",
                                notif.is_read
                                    ? "bg-white border-gray-50 opacity-75"
                                    : "bg-white border-primary-100 shadow-sm shadow-primary-50 ring-1 ring-primary-50"
                            )}
                        >
                            <div className={clsx(
                                "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 mr-4",
                                notif.is_read ? "bg-gray-100" : "bg-primary-50"
                            )}>
                                {getIcon(notif.notification_type)}
                            </div>
                            <div className="flex-grow">
                                <div className="flex justify-between items-start">
                                    <h4 className={clsx("font-bold", notif.is_read ? "text-gray-700" : "text-gray-900")}>
                                        {notif.title}
                                    </h4>
                                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                                        {new Date(notif.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500 mt-1">{notif.message}</p>
                                {!notif.is_read && (
                                    <button
                                        onClick={() => handleMarkAsRead(notif.id)}
                                        className="mt-3 text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center"
                                    >
                                        <CheckCircle2 className="h-3 w-3 mr-1" /> Mark as read
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-2xl p-20 text-center border border-dashed border-gray-200">
                    <div className="h-20 w-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Bell className="h-10 w-10 text-gray-200" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">You're all caught up!</h3>
                    <p className="text-gray-500 max-w-sm mx-auto">No new notifications at the moment. We'll alert you if something important comes up.</p>
                </div>
            )}
        </div>
    );
};

export default Notifications;
