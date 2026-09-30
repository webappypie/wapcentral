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
  loginAsDemo: (role: AdminRole) => void;
  hasRole: (requiredRole: AdminRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getStoredDemoUser = (): AuthContextUser | null => {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return null;
  const saved = sessionStorage.getItem('wap_demo_user');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  return null;
};

const setStoredDemoUser = (u: AuthContextUser | null) => {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  if (u) {
    sessionStorage.setItem('wap_demo_user', JSON.stringify(u));
  } else {
    sessionStorage.removeItem('wap_demo_user');
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthContextUser | null>(() => getStoredDemoUser());

  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // If a demo user session is active, don't wait for Firebase Auth
    if (user?.uid.startsWith('demo-')) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: User | null) => {
      if (fbUser) {
        let role: AdminRole = 'viewer';
        try {
          const idTokenResult = await fbUser.getIdTokenResult();
          if (idTokenResult.claims['role']) {
            role = idTokenResult.claims['role'] as AdminRole;
          }
        } catch {
          role = 'viewer';
        }

        const authUser: AuthContextUser = {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
          role,
          roleLevel: ROLE_HIERARCHY[role] ?? 1,
        };
        setUser(authUser);
      } else {
        // Only clear if not in demo mode
        if (!user?.uid.startsWith('demo-')) {
          setUser(null);
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const signInWithEmail = async (email: string, pass: string) => {
    setStoredDemoUser(null);
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signInWithGoogle = async () => {
    setStoredDemoUser(null);
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    setStoredDemoUser(null);
    setUser(null);
    try {
      await fbSignOut(auth);
    } catch {
      // Fallback
    }
  };

  // Quick switch for development & testing different RBAC roles
  const loginAsDemo = (role: AdminRole) => {
    const demoUser: AuthContextUser = {
      uid: `demo-${role}`,
      email: `${role}@webappypie.com`,
      displayName: `Demo ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      role,
      roleLevel: ROLE_HIERARCHY[role] ?? 1,
    };
    setStoredDemoUser(demoUser);
    setUser(demoUser);
  };

  const hasRole = (requiredRole: AdminRole): boolean => {
    if (!user) return false;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 1;
    return user.roleLevel >= requiredLevel;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signInWithEmail,
        signInWithGoogle,
        signOut,
        loginAsDemo,
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
