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
            // If the user isn't in Firebase but has a legacy account, Firebase throws invalid-credential
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                try {
                    console.log('Attempting legacy migration...');
                    // Try the migrate endpoint
                    await api.post('/auth/migrate-legacy', credentials);
                    // If successful, try Firebase login again!
                    await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
                    return; // Login succeeded after migration
                } catch (migrationError: any) {
                    console.error('Legacy migration failed:', migrationError);
                    // Throw the original or meaningful error to the UI
                    if (migrationError.response && migrationError.response.status === 401) {
                        throw new Error("Invalid password");
                    }
                    if (migrationError.response && migrationError.response.status === 404) {
                        throw new Error("User not found. Please sign up.");
                    }
                    throw error;
                }
            }
            throw error;
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
