import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    Calendar,
    Activity,
    Bell,
    LogOut,
    Heart,
    Users,
    Pill,
    MessageSquare,
    Inbox
} from 'lucide-react';
import clsx from 'clsx';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, logout } = useAuth();
    const location = useLocation();

    const navigation = (() => {
        let baseNav = [];
        if (user?.role === 'admin') {
            baseNav = [
                { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
                { name: 'Admin Panel', href: '/admin', icon: Users },
            ];
        } else if (user?.role === 'doctor') {
            baseNav = [
                { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
                { name: 'Patient Records', href: '/doctor/patients', icon: Users },
                { name: 'Add New Patient', href: '/patients', icon: Users },
                { name: 'Appointments', href: '/appointments', icon: Calendar },
                { name: 'Inbox', href: '/inbox', icon: Inbox },
            ];
        } else {
            // Patient
            baseNav = [
                { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
                { name: 'Appointments', href: '/appointments', icon: Calendar },
                { name: 'Clinical Support', href: '/clinical-support', icon: Activity },
                { name: 'Medications', href: '/medications', icon: Pill },
                { name: 'Inbox', href: '/inbox', icon: Inbox },
                { name: 'Alerts', href: '/alerts', icon: Bell },
                { name: 'Health Reports', href: '/reports', icon: Heart },
                { name: 'Feedback', href: '/feedback', icon: MessageSquare },
            ];
        }
        return [...baseNav, { name: 'My Profile', href: '/profile', icon: Users }];
    })();

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <div className="hidden md:flex md:w-64 md:flex-col fixed h-full bg-white border-r border-gray-200">
                <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
                    <div className="flex items-center flex-shrink-0 px-4 mb-5">
                        <Activity className="h-8 w-8 text-primary-600" />
                        <span className="ml-2 text-xl font-bold text-gray-900">AgentHealth</span>
                    </div>
                    <nav className="mt-5 flex-1 px-2 space-y-1">
                        {navigation.map((item) => {
                            const isActive = location.pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    to={item.href}
                                    className={clsx(
                                        isActive
                                            ? 'bg-primary-50 text-primary-600'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                                        'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-150'
                                    )}
                                >
                                    <item.icon
                                        className={clsx(
                                            isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500',
                                            'mr-3 flex-shrink-0 h-6 w-6 transition-colors duration-150'
                                        )}
                                        aria-hidden="true"
                                    />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
                <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
                    <div className="flex-shrink-0 w-full group block">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <div className="inline-block h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
                                    {user?.full_name?.charAt(0) || 'U'}
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-gray-700">
                                        {user?.full_name}
                                    </p>
                                    <p className="text-xs font-medium text-gray-500">
                                        {user?.role}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={logout}
                                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Sign out"
                            >
                                <LogOut className="h-5 w-5" />
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col md:pl-64">
                <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;
