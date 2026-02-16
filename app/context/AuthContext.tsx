'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface UserPermission {
  module: string;
  action: string;
  scope: 'ALL' | 'DEPARTMENT' | 'SELF';
}

interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'HR' | 'EMPLOYEE' | 'MANAGER';
  permissions: UserPermission[];
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    department?: { id: string; name: string };
    designation?: { title: string };
    appRole?: { id: string; name: string; color: string };
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (module: string, action: string) => boolean;
  getPermissionScope: (module: string, action: string) => 'ALL' | 'DEPARTMENT' | 'SELF' | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUser = useCallback(async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser({
          ...data.user,
          permissions: data.user.permissions || [],
        });
      } else {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      }
    } catch {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      fetchUser(storedToken).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('token', data.token);
    setToken(data.token);
    // Fetch full user data with permissions
    await fetchUser(data.token);
    router.push('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    router.push('/');
  };

  // Check if user has a specific permission
  const hasPermission = useCallback((module: string, action: string): boolean => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return user.permissions?.some(p => p.module === module && p.action === action) ?? false;
  }, [user]);

  // Get the scope of a permission (ALL, DEPARTMENT, SELF)
  const getPermissionScope = useCallback((module: string, action: string): 'ALL' | 'DEPARTMENT' | 'SELF' | null => {
    if (!user) return null;
    if (user.role === 'ADMIN') return 'ALL';
    const perm = user.permissions?.find(p => p.module === module && p.action === action);
    return perm?.scope || null;
  }, [user]);

  return (
    <AuthContext.Provider value={{ 
      user, token, loading, login, logout, 
      isAuthenticated: !!user, 
      hasPermission,
      getPermissionScope,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
