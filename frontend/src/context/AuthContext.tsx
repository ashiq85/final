import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import * as authService from '../services/auth.service';
import { jwtDecode } from 'jwt-decode';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: any) => Promise<void>;
    register: (userData: any) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const decoded: any = jwtDecode(token);
                    const currentTime = Date.now() / 1000;

                    if (decoded.exp < currentTime) {
                        logout();
                    } else {
                        const currentUser = await authService.getCurrentUser();
                        setUser(currentUser);
                        setIsAuthenticated(true);
                    }
                } catch (error) {
                    console.error('Auth initialization error:', error);
                    logout();
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const login = async (credentials: any) => {
        try {
            const response = await authService.login(credentials);
            localStorage.setItem('token', response.access_token);

            // Fetch user info after successful login
            const currentUser = await authService.getCurrentUser();
            setUser(currentUser);
            setIsAuthenticated(true);
        } catch (error) {
            throw error;
        }
    };

    const register = async (userData: any) => {
        try {
            await authService.register(userData);
            // Auto login after register
            await login({ email: userData.email, password: userData.password });
        } catch (error) {
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
