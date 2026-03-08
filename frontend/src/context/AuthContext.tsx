import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { auth } from '../services/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import api from '../services/api';

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

    async function logout() {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Firebase sign out error', error);
        }
        setUser(null);
        setIsAuthenticated(false);
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    // Firebase manages the token. The API interceptor will use auth.currentUser.getIdToken()
                    const res = await api.get('/auth/me');
                    setUser(res.data);
                    setIsAuthenticated(true);
                } catch (error) {
                    console.error('Failed to fetch user details from backend:', error);
                    // If backend fails, they aren't fully authenticated in our system
                    logout();
                }
            } else {
                setUser(null);
                setIsAuthenticated(false);
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (credentials: any) => {
        try {
            await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
        } catch (error: any) {
            console.error('Firebase login error:', error);
            const code = error.code;
            // If user does NOT exist in Firebase Auth, check if they have a legacy account
            if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
                try {
                    console.log('Attempting legacy migration...');
                    await api.post('/auth/migrate-legacy', credentials);
                    // Migration succeeded, try Firebase login now
                    await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
                    return;
                } catch (migrationError: any) {
                    console.error('Legacy migration failed:', migrationError);
                    if (migrationError.response?.status === 401) {
                        throw new Error('Incorrect email or password. Please try again.');
                    }
                    if (migrationError.response?.status === 404) {
                        throw new Error('No account found with this email. Please sign up first.');
                    }
                    // Firebase specific: the password was wrong in Firebase itself
                    throw new Error('Incorrect email or password. Please try again.');
                }
            }
            // Map other Firebase error codes to readable messages
            if (code === 'auth/too-many-requests') {
                throw new Error('Too many login attempts. Your account has been temporarily disabled. Please try again later.');
            }
            if (code === 'auth/invalid-email') {
                throw new Error('Please enter a valid email address.');
            }
            throw new Error('Login failed. Please check your credentials and try again.');
        }
    };

    const register = async (userData: any) => {
        try {
            // Call the backend to create the user in Firebase Auth and Firestore
            await api.post('/auth/signup', userData);
            // Log in via Firebase to establish the local session
            await signInWithEmailAndPassword(auth, userData.email, userData.password);
        } catch (error: any) {
            console.error('Registration/Login error:', error);
            // Provide helpful error messages
            if (error.response?.status === 400) {
                const detail = error.response?.data?.detail || '';
                if (detail.includes('already registered') || detail.includes('already exists')) {
                    throw new Error('An account with this email already exists. Please log in instead.');
                }
                throw new Error(detail || 'Registration failed. Please check your details and try again.');
            }
            if (error.code === 'auth/email-already-in-use') {
                throw new Error('An account with this email already exists. Please log in instead.');
            }
            if (error.code === 'auth/weak-password') {
                throw new Error('Password is too weak. Please use at least 6 characters.');
            }
            throw error;
        }
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
