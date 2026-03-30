'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  id: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  activeChatId: string | null;
  refreshTrigger: number;
  login: (user: User) => void;
  logout: () => void;
  setActiveChatId: (id: string | null) => void;
  triggerRefresh: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const router = useRouter();

  useEffect(() => {
    // Basic local storage persistence for demo purposes
    const storedUser = localStorage.getItem('nexus_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      document.cookie = "nexus_auth=true; path=/; max-age=2592000; SameSite=Lax;"; // 30 days
    } else {
      document.cookie = "nexus_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      const publicPaths = ['/auth', '/reset-password'];
      if (!publicPaths.includes(window.location.pathname)) {
        router.push('/auth');
      }
    }
  }, [router]);


  const login = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('nexus_user', JSON.stringify(newUser));
    document.cookie = "nexus_auth=true; path=/; max-age=2592000; SameSite=Lax;";
    router.push('/');
  };

  const logout = () => {
    setUser(null);
    setActiveChatId(null);
    localStorage.removeItem('nexus_user');
    document.cookie = "nexus_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push('/auth');
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <AuthContext.Provider value={{ user, activeChatId, refreshTrigger, login, logout, setActiveChatId, triggerRefresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
