'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { obfuscateForTransport } from '@/lib/encryption-client';

// ─── Types ────────────────────────────────────────────────────
interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  emailVerified?: boolean;
  createdAt?: string;
  is_premium?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, fullName: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

// ─── Storage keys ─────────────────────────────────────────────
const REMEMBER_KEY   = 'vmfs_remember_me';
const USER_CACHE_KEY = 'vmfs_user_cache'; // sessionStorage — cleared when tab closes

// ─── Helpers ─────────────────────────────────────────────────
function readCachedUser(): User | null {
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}
function writeCachedUser(u: User | null) {
  try {
    if (u) sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
    else    sessionStorage.removeItem(USER_CACHE_KEY);
  } catch { /* storage full / private mode */ }
}

// ─── Context ─────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Seed from sessionStorage immediately so no navigation flash
  const [user, setUser]       = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    return readCachedUser();
  });
  // isLoading stays true only when we have NO cached user and are waiting on the network
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return readCachedUser() === null; // false = we already have a cached user
  });

  // ── Internal setter — always keeps cache in sync ────────────
  const setUserAndCache = useCallback((u: User | null) => {
    setUser(u);
    writeCachedUser(u);
  }, []);

  // ── Refresh: validate session with server in background ─────
  const refreshSession = useCallback(async () => {
    try {
      const res  = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUserAndCache(data.user);
      } else {
        setUserAndCache(null);
      }
    } catch {
      // Network error — keep existing cached state; don't log the user out
    } finally {
      setIsLoading(false);
    }
  }, [setUserAndCache]);

  // On mount: if we had a cached user, validate silently in the background.
  // If no cached user, validate and show loading until done.
  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // ── Login ────────────────────────────────────────────────────
  const login = async (
    email: string,
    password: string,
    rememberMe = false,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const obfuscatedPassword = obfuscateForTransport(password);
      const res  = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: obfuscatedPassword, rememberMe }),
      });
      const data = await res.json();

      if (data.success) {
        setUserAndCache(data.user);
        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, 'true');
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
        // Seed inactivity timestamp for SessionManager
        localStorage.setItem('vmfs_last_activity', Date.now().toString());
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  // ── Signup ───────────────────────────────────────────────────
  const signup = async (
    email: string,
    password: string,
    fullName: string,
    phone?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const obfuscatedPassword = obfuscateForTransport(password);
      const res  = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: obfuscatedPassword, fullName, phone }),
      });
      const data = await res.json();

      if (data.success) {
        setUserAndCache(data.user);
        localStorage.setItem('vmfs_last_activity', Date.now().toString());
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  // ── Logout ───────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch { /* best-effort */ }
    setUserAndCache(null);
    localStorage.removeItem(REMEMBER_KEY);
    localStorage.removeItem('vmfs_last_activity');
    sessionStorage.clear();
  }, [setUserAndCache]);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      signup,
      logout,
      refreshSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
