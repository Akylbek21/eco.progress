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

const staffRoles: UserRole[] = ['MANAGER', 'ADMIN', 'DIRECTOR', 'HEAD', 'ACCOUNTANT', 'ECOLOGIST', 'LABORATORY', 'WASTE_SPECIALIST'];

type AuthResponsePayload = {
  data?: Record<string, unknown>;
  token?: string;
  accessToken?: string;
  jwt?: string;
  user?: Partial<User>;
  employee?: Partial<User>;
  staff?: Partial<User>;
  account?: Partial<User>;
  role?: unknown;
  email?: unknown;
  name?: unknown;
  id?: unknown;
};

const normalizeRole = (value: unknown, fallback: UserRole): UserRole => {
  const raw = String(value || fallback).trim().toUpperCase().replace(/^ROLE_/, '').replace(/^STAFF_/, '');
  const map: Record<string, UserRole> = {
    CLIENT: 'CLIENT',
    USER: 'CLIENT',
    MANAGER: 'MANAGER',
    ADMIN: 'ADMIN',
    DIRECTOR: 'DIRECTOR',
    HEAD: 'HEAD',
    ACCOUNTANT: 'ACCOUNTANT',
    ECOLOGIST: 'ECOLOGIST',
    ECOLOG: 'ECOLOGIST',
    LABORATORY: 'LABORATORY',
    LABORANT: 'LABORATORY',
    WASTE_SPECIALIST: 'WASTE_SPECIALIST',
    WASTE: 'WASTE_SPECIALIST',
  };
  return map[raw] || fallback;
};

const readAuthPayload = (payload: AuthResponsePayload, email: string, staff = false): { token: string; user: User } => {
  const source = (payload.data || payload) as AuthResponsePayload;
  const rawUser = (source.user || source.employee || source.staff || source.account || source) as Partial<User> & Record<string, unknown>;
  const role = normalizeRole(rawUser.role ?? source.role, staff ? 'MANAGER' : 'CLIENT');
  const token = String(source.token || source.accessToken || source.jwt || '');
  if (!token) throw new Error('Backend не вернул token.');
  return {
    token,
    user: {
      id: String(rawUser.id || source.id || email),
      role,
      type: role === 'CLIENT' ? (rawUser.type as User['type']) || 'company' : role === 'ADMIN' ? 'admin' : 'staff',
      email: String(rawUser.email || source.email || email),
      name: String(rawUser.name || source.name || rawUser.email || email),
      phone: rawUser.phone,
      city: rawUser.city,
      companyName: rawUser.companyName,
      bin: rawUser.bin,
      organizationType: rawUser.organizationType,
      legalAddress: rawUser.legalAddress,
      position: rawUser.position,
    },
  };
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
    const { data } = await api.post<AuthResponsePayload & { message?: string | null }>('/auth/login', { email, password });
    const session = readAuthPayload(data, email);
    saveSession(session.token, session.user);
  }, [saveSession]);

  const staffLogin = useCallback(async (email: string, password: string) => {
    let payload: AuthResponsePayload & { message?: string | null };
    try {
      const { data } = await api.post<AuthResponsePayload & { message?: string | null }>('/auth/staff/login', { email, password });
      payload = data;
    } catch (error) {
      const status = (error as { response?: { status?: number; data?: { message?: string } } })?.response?.status;
      const message = (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (error as Error)?.message || '';
      if (status !== 404 && status !== 405 && !/No static resource|not found/i.test(message)) throw error;
      const { data } = await api.post<AuthResponsePayload & { message?: string | null }>('/auth/login', { email, password, staff: true });
      payload = data;
    }
    const session = readAuthPayload(payload, email, true);
    if (!staffRoles.includes(session.user.role)) throw new Error('У пользователя нет роли сотрудника.');
    saveSession(session.token, session.user);
  }, [saveSession]);

  const register = useCallback(async (payload: RegisterPayload) => {
    const { data } = await api.post<AuthResponsePayload & { message?: string | null }>('/auth/register', payload);
    const session = readAuthPayload(data, 'email' in payload ? payload.email : '');
    saveSession(session.token, session.user);
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
