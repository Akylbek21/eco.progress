import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type { CompanyPermission, User, UserRole } from '../types';
import { clearStoredDocumentFlowOrganizations } from '../features/document-flow/model/organizationSelection';
import { clearCompanyQueries } from '../features/companies/companyCache';

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
  refreshUser: () => Promise<User | null>;
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

const staffRoles: UserRole[] = ['MANAGER', 'ADMIN', 'DIRECTOR', 'HEAD', 'ACCOUNTANT', 'ECOLOGIST', 'LABORATORY', 'WASTE_SPECIALIST', 'STAFF'];
const companyPermissionNames: CompanyPermission[] = [
  'COMPANY_VIEW',
  'COMPANY_CREATE',
  'COMPANY_EDIT',
  'COMPANY_ARCHIVE',
  'COMPANY_CREATE_OBJECT',
  'COMPANY_EDIT_OBJECT',
  'COMPANY_ARCHIVE_OBJECT',
];

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
    LAB_HEAD: 'HEAD',
    LABORATORY_HEAD: 'HEAD',
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

const normalizeCompanyPermissions = (value: unknown): User['companyPermissions'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    companyPermissionNames.map((permission) => [permission, source[permission] === true]),
  ) as Record<CompanyPermission, boolean>;
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
      permissions: Array.isArray(rawUser.permissions)
        ? rawUser.permissions.map(String).filter(Boolean)
        : undefined,
      companyPermissions: normalizeCompanyPermissions(rawUser.companyPermissions),
    },
  };
};

const AuthContext = createContext<AuthState | null>(null);
const normalizeStoredUser = (value: User): User => ({
  ...value,
  role: normalizeRole(value.role, value.role === 'CLIENT' ? 'CLIENT' : 'MANAGER'),
  permissions: Array.isArray(value.permissions) ? value.permissions.map(String).filter(Boolean) : undefined,
  companyPermissions: normalizeCompanyPermissions(value.companyPermissions),
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [user, setUserState] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return normalizeStoredUser(JSON.parse(raw) as User); } catch { return null; }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(!!localStorage.getItem(TOKEN_KEY));
  const userIdRef = useRef(user?.id);

  const saveSession = useCallback((newToken: string, newUser: User) => {
    queryClient.removeQueries({ queryKey: ['pek'] });
    if (userIdRef.current !== newUser.id) clearCompanyQueries(queryClient);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    sessionStorage.removeItem('eco-progress-401-redirect');
    setToken(newToken);
    setUserState(newUser);
    userIdRef.current = newUser.id;
  }, [queryClient]);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    clearStoredDocumentFlowOrganizations();
    queryClient.removeQueries({ queryKey: ['document-flow'] });
    queryClient.removeQueries({ queryKey: ['protocols'] });
    queryClient.removeQueries({ queryKey: ['protocol'] });
    queryClient.removeQueries({ queryKey: ['pek'] });
    clearCompanyQueries(queryClient);
    setToken(null);
    setUserState(null);
    userIdRef.current = undefined;
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return null;
    const { data } = await api.get<{ data: User; message: string | null }>('/auth/me');
    const nextUser = normalizeStoredUser(data.data);
    if (userIdRef.current !== nextUser.id) clearCompanyQueries(queryClient);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUserState((currentUser) => {
      if (currentUser?.id !== nextUser.id) queryClient.removeQueries({ queryKey: ['pek'] });
      return nextUser;
    });
    userIdRef.current = nextUser.id;
    return nextUser;
  }, [queryClient]);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) { setLoading(false); return; }
    refreshUser()
      .catch(() => {
        clearSession();
      })
      .finally(() => setLoading(false));
  }, [clearSession, refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<AuthResponsePayload & { message?: string | null }>('/auth/login', { email, password });
    const session = readAuthPayload(data, email);
    saveSession(session.token, { ...session.user, companyPermissions: undefined });
    try {
      await refreshUser();
    } catch (error) {
      clearSession();
      throw error;
    }
  }, [clearSession, refreshUser, saveSession]);

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
    saveSession(session.token, { ...session.user, companyPermissions: undefined });
    try {
      await refreshUser();
    } catch (error) {
      clearSession();
      throw error;
    }
  }, [clearSession, refreshUser, saveSession]);

  const register = useCallback(async (payload: RegisterPayload) => {
    const { data } = await api.post<AuthResponsePayload & { message?: string | null }>('/auth/register', payload);
    const session = readAuthPayload(data, 'email' in payload ? payload.email : '');
    saveSession(session.token, { ...session.user, companyPermissions: undefined });
    try {
      await refreshUser();
    } catch (error) {
      clearSession();
      throw error;
    }
  }, [clearSession, refreshUser, saveSession]);

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => {});
    clearSession();
  }, [clearSession]);

  const setUser = useCallback((u: User) => {
    const normalizedUser = normalizeStoredUser(u);
    queryClient.removeQueries({ queryKey: ['pek'] });
    if (userIdRef.current !== normalizedUser.id) clearCompanyQueries(queryClient);
    localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
    setUserState(normalizedUser);
    userIdRef.current = normalizedUser.id;
  }, [queryClient]);

  const isAuthenticated = !!token && !!user;
  const isStaff = !!user && staffRoles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, token, loading, isAuthenticated, isStaff, login, staffLogin, register, logout, setUser, refreshUser }}>
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
