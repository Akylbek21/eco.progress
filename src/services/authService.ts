import api from './api';
import type { MockUser } from '../types';

const TOKEN_KEY = 'eco-progress-token';
const USER_KEY = 'eco-progress-user';

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

export const login = async (email: string, password: string) => {
  const { data } = await api.post<{ data: { token: string; user: MockUser }; message: string | null }>('/auth/login', { email, password });
  localStorage.setItem(TOKEN_KEY, data.data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.data.user));
  return data.data;
};

export const staffLogin = async (email: string, password: string) => {
  const { data } = await api.post<{ data: { token: string; user: MockUser }; message: string | null }>('/auth/staff/login', { email, password });
  localStorage.setItem(TOKEN_KEY, data.data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.data.user));
  return data.data;
};

export const register = async (payload: RegisterPayload) => {
  const { data } = await api.post<{ data: { token: string; user: MockUser }; message: string | null }>('/auth/register', payload);
  localStorage.setItem(TOKEN_KEY, data.data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.data.user));
  return data.data;
};

export const logout = () => {
  api.post('/auth/logout').catch(() => {});
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const getCurrentUser = (): MockUser | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MockUser;
  } catch {
    return null;
  }
};

export const isAuthenticated = () => Boolean(getToken());
