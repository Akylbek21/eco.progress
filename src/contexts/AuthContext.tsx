import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import api from '../services/api';
import type { User, UserRole } from '../types';

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isStaff: boolean;
  login: (email: string, password: string) => Promise<void>;
  staffLogin: (email: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
};

export type RegisterPayload =
  | {
      type: 'individual';
      name: string;
      phone: string;
      email: string;
      city: string;
      password: string;
    }
  | {
      type: 'company';
      companyName: string;
      bin: string;
      organizationType: string;
      legalAddress: string;
      city: string;
      contactPerson: string;
      position: string;
      phone: string;
      email: string;
      password: string;
    };

const TOKEN_KEY = 'eco-progress-token';
const USER_KEY = 'eco-progress-user';

const staffRoles: UserRole[] = ['MANAGER', 'ADMIN', 'ACCOUNTANT', 'ECOLOGIST', 'LABORATORY'];
const DEMO_PASSWORD = 'demo';
const demoUsers: Record<string, User> = {
  'client@demo.kz': {
    id: 'demo-client',
    role: 'CLIENT',
    type: 'company',
    email: 'client@demo.kz',
    name: 'Демо клиент',
    phone: '+7 700 000 00 01',
    city: 'Алматы',
    companyName: 'ТОО Demo Client',
    bin: '240519000999',
    organizationType: 'ТОО',
    legalAddress: 'г. Алматы, ул. Демо, 1',
    position: 'Директор',
  },
  'manager@demo.kz': { id: 'demo-manager', role: 'MANAGER', type: 'staff', email: 'manager@demo.kz', name: 'Демо менеджер', phone: '+7 700 000 00 02', position: 'Менеджер' },
  'ecologist@demo.kz': { id: 'demo-ecologist', role: 'ECOLOGIST', type: 'staff', email: 'ecologist@demo.kz', name: 'Демо эколог', phone: '+7 700 000 00 03', position: 'Эколог' },
  'laboratory@demo.kz': { id: 'demo-laboratory', role: 'LABORATORY', type: 'staff', email: 'laboratory@demo.kz', name: 'Демо лаборатория', phone: '+7 700 000 00 04', position: 'Лаборатория' },
  'accountant@demo.kz': { id: 'demo-accountant', role: 'ACCOUNTANT', type: 'staff', email: 'accountant@demo.kz', name: 'Демо бухгалтер', phone: '+7 700 000 00 05', position: 'Бухгалтер' },
  'admin@demo.kz': { id: 'demo-admin', role: 'ADMIN', type: 'admin', email: 'admin@demo.kz', name: 'Демо администратор', phone: '+7 700 000 00 06', position: 'Администратор' },
};

const demoLogin = (email: string, password: string, staffOnly = false) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = demoUsers[normalizedEmail];
  if (!user || password !== DEMO_PASSWORD) return null;
  if (staffOnly && !staffRoles.includes(user.role)) return null;
  if (!staffOnly && user.role !== 'CLIENT') return null;
  return { token: `demo-token-${user.id}`, user };
};

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as User; } catch { return null; }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(!!localStorage.getItem(TOKEN_KEY));

  const saveSession = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUserState(newUser);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUserState(null);
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) { setLoading(false); return; }
    if (storedToken.startsWith('demo-token-')) { setLoading(false); return; }
    api.get<{ data: User; message: string | null }>('/auth/me')
      .then(({ data }) => {
        const u = data.data;
        localStorage.setItem(USER_KEY, JSON.stringify(u));
        setUserState(u);
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => setLoading(false));
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data } = await api.post<{ data: { token: string; user: User }; message: string | null }>('/auth/login', { email, password });
      saveSession(data.data.token, data.data.user);
    } catch (error) {
      const demo = demoLogin(email, password);
      if (!demo) throw error;
      saveSession(demo.token, demo.user);
    }
  }, [saveSession]);

  const staffLogin = useCallback(async (email: string, password: string) => {
    try {
      const { data } = await api.post<{ data: { token: string; user: User }; message: string | null }>('/auth/staff/login', { email, password });
      saveSession(data.data.token, data.data.user);
    } catch (error) {
      const demo = demoLogin(email, password, true);
      if (!demo) throw error;
      saveSession(demo.token, demo.user);
    }
  }, [saveSession]);

  const register = useCallback(async (payload: RegisterPayload) => {
    const { data } = await api.post<{ data: { token: string; user: User }; message: string | null }>('/auth/register', payload);
    saveSession(data.data.token, data.data.user);
  }, [saveSession]);

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => {});
    clearSession();
  }, [clearSession]);

  const setUser = useCallback((u: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUserState(u);
  }, []);

  const isAuthenticated = !!token && !!user;
  const isStaff = !!user && staffRoles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, token, loading, isAuthenticated, isStaff, login, staffLogin, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default AuthContext;
