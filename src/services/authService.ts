import { staffUsers, type ClientType, type MockUser } from '../data/mockData';

const TOKEN_KEY = 'eco-progress-token';
const USER_KEY = 'eco-progress-user';

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

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

const saveSession = (user: MockUser) => {
  const token = btoa(`${user.email}:${Date.now()}`);
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return { token, user };
};

export const login = async (email: string, password: string) => {
  await delay();
  void password;
  return saveSession({
    id: 'client-1',
    role: 'CLIENT',
    type: 'company',
    email,
    name: 'Контактное лицо',
    phone: '+7 (___) ___-__-__',
    city: 'Астана',
    companyName: 'ТОО "Клиент Eco"',
    bin: '000000000000',
    organizationType: 'ТОО',
    legalAddress: 'Республика Казахстан, г. Астана',
    position: 'Менеджер',
  });
};

export const staffLogin = async (email: string, password: string) => {
  await delay();
  void password;
  const staff = staffUsers.find((item) => item.email === email) ?? staffUsers[0];
  return saveSession(staff);
};

export const register = async (payload: RegisterPayload) => {
  await delay();
  const base = {
    id: `client-${Date.now()}`,
    role: 'CLIENT' as const,
    type: payload.type as ClientType,
    email: payload.email,
    phone: payload.phone,
    city: payload.city,
  };

  const user: MockUser =
    payload.type === 'individual'
      ? { ...base, name: payload.name }
      : {
          ...base,
          name: payload.contactPerson,
          companyName: payload.companyName,
          bin: payload.bin,
          organizationType: payload.organizationType,
          legalAddress: payload.legalAddress,
          position: payload.position,
        };

  return saveSession(user);
};

export const logout = () => {
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
