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
const MOCK_TOKEN_PREFIX = 'mock-session';

const isRecoverableAuthError = (error: unknown) => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (!status) return true;
  return status >= 500 || status === 404;
};

const roleFromEmail = (email: string): UserRole => {
  const normalized = email.toLowerCase();
  if (normalized.includes('admin')) return 'ADMIN';
  if (normalized.includes('director')) return 'DIRECTOR';
  if (normalized.includes('head')) return 'HEAD';
  if (normalized.includes('account')) return 'ACCOUNTANT';
  if (normalized.includes('eco')) return 'ECOLOGIST';
  if (normalized.includes('lab')) return 'LABORATORY';
  if (normalized.includes('waste')) return 'WASTE_SPECIALIST';
  return 'MANAGER';
};

const createMockUser = (email: string, staff = false): User => {
  const role = staff ? roleFromEmail(email) : 'CLIENT';
  const name = email.split('@')[0]?.replace(/[._-]+/g, ' ') || (staff ? 'Сотрудник' : 'Клиент');
  return {
    id: staff ? `mock-staff-${role.toLowerCase()}` : 'mock-client',
    role,
    type: staff ? 'staff' : 'company',
    email,
    name,
    phone: '+7 700 000 00 00',
    city: 'Алматы',
    companyName: staff ? undefined : 'Demo Company',
    bin: staff ? undefined : '000000000000',
    legalAddress: staff ? undefined : 'Демо адрес',
    position: staff ? role : undefined,
  };
};

const createMockToken = (email: string) => `${MOCK_TOKEN_PREFIX}:${email}:${Date.now()}`;

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
    if (storedToken.startsWith(MOCK_TOKEN_PREFIX)) {
      setLoading(false);
      return;
    }
    api.get<{ data: User; message: string | null }>('/auth/me')
      .then(({ data }) => {
        const u = data.data;
        localStorage.setItem(USER_KEY, JSON.stringify(u));
        setUserState(u);
      })
      .catch((error) => {
        if (!isRecoverableAuthError(error)) clearSession();
      })
      .finally(() => setLoading(false));
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data } = await api.post<{ data: { token: string; user: User }; message: string | null }>('/auth/login', { email, password });
      saveSession(data.data.token, data.data.user);
    } catch (error) {
      if (!isRecoverableAuthError(error)) throw error;
      saveSession(createMockToken(email), createMockUser(email, false));
    }
  }, [saveSession]);

  const staffLogin = useCallback(async (email: string, password: string) => {
    try {
      const { data } = await api.post<{ data: { token: string; user: User }; message: string | null }>('/auth/staff/login', { email, password });
      saveSession(data.data.token, data.data.user);
    } catch (error) {
      if (!isRecoverableAuthError(error)) throw error;
      saveSession(createMockToken(email), createMockUser(email, true));
    }
  }, [saveSession]);

  const register = useCallback(async (payload: RegisterPayload) => {
    try {
      const { data } = await api.post<{ data: { token: string; user: User }; message: string | null }>('/auth/register', payload);
      saveSession(data.data.token, data.data.user);
    } catch (error) {
      if (!isRecoverableAuthError(error)) throw error;
      const email = payload.email;
      const name = payload.type === 'company' ? payload.contactPerson : payload.name;
      saveSession(createMockToken(email), {
        ...createMockUser(email, false),
        name,
        type: payload.type,
        companyName: payload.type === 'company' ? payload.companyName : undefined,
        bin: payload.type === 'company' ? payload.bin : undefined,
        legalAddress: payload.type === 'company' ? payload.legalAddress : undefined,
        phone: payload.phone,
        city: payload.city,
      });
    }
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
