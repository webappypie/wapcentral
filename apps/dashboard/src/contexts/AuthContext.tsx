import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AdminRole } from '@wapcentral/types';
import { ROLE_HIERARCHY } from '@wapcentral/config';
import { auth } from '../lib/firebase.js';
import {
  onAuthStateChanged,
  signOut as fbSignOut,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';

export interface AuthContextUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: AdminRole;
  roleLevel: number;
}

interface AuthContextType {
  user: AuthContextUser | null;
  isLoading: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (requiredRole?: AdminRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthContextUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: User | null) => {
      if (fbUser) {
        let role: AdminRole = 'super_admin';
        try {
          const idTokenResult = await fbUser.getIdTokenResult();
          if (idTokenResult.claims['role']) {
            role = idTokenResult.claims['role'] as AdminRole;
          } else {
            const configuredSuperAdmin = (
              import.meta.env.VITE_SUPER_ADMIN_EMAIL || ''
            ).toLowerCase();
            if (configuredSuperAdmin && fbUser.email?.toLowerCase() === configuredSuperAdmin) {
              role = 'super_admin';
            }
          }
        } catch {
          role = 'super_admin';
        }

        const authUser: AuthContextUser = {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Super Admin',
          role,
          roleLevel: ROLE_HIERARCHY[role] ?? 4,
        };
        setUser(authUser);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    setUser(null);
    try {
      await fbSignOut(auth);
    } catch {
      // Fallback
    }
  };

  const hasRole = (_requiredRole: AdminRole = 'super_admin'): boolean => {
    if (!user) return false;
    // Super Admin has full administrative access to all sections and operations
    return user.role === 'super_admin';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signInWithEmail,
        signInWithGoogle,
        signOut,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
