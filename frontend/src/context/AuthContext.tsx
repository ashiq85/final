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
        // Log in via Firebase
        await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
        // onAuthStateChanged will handle fetching the user role and setting state
    };

    const register = async (userData: any) => {
        // Note: For custom claims/roles, the backend /auth/signup still needs to be called to save to Firestore.
        // We do this via authService, which calls the backend. 
        // The backend signup endpoint we modified ALREADY creates the Firebase Auth user!

        // So we just call the API. It will create the auth user and the firestore doc.
        await api.post('/auth/signup', userData);

        // Then we log in via Firebase client SDK to establish the session.
        await signInWithEmailAndPassword(auth, userData.email, userData.password);
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
