import { edoApiClient, setAccessToken } from '../../../shared/api/edoApiClient';
import type { AuthSession } from '../../../shared/types/domain';

export interface LoginRequest {
  email: string;
  password: string;
  rememberDevice: boolean;
}

export interface RegistrationRequest {
  user: {
    lastName: string;
    firstName: string;
    middleName?: string;
    email: string;
    phone: string;
    password: string;
  };
  organization: {
    bin: string;
    fullName: string;
    shortName: string;
    directorName: string;
    legalAddress: string;
    actualAddress: string;
    email: string;
    phone: string;
  };
  acceptedTerms: true;
  acceptedPrivacy: true;
}

type TokenResponse = { accessToken?: string };

export const authApi = {
  async login(payload: LoginRequest) {
    const { data } = await edoApiClient.post<TokenResponse>('/auth/login', payload);
    setAccessToken(data.accessToken);
  },
  async session(signal?: AbortSignal) {
    const { data } = await edoApiClient.get<AuthSession>('/auth/me', { signal });
    return data;
  },
  async register(payload: RegistrationRequest) {
    await edoApiClient.post('/auth/register', payload, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
  },
  async logout(allDevices = false) {
    await edoApiClient.post(allDevices ? '/auth/logout-all' : '/auth/logout');
    setAccessToken();
  },
  async verifyEmail(payload: { code?: string; token?: string }) {
    await edoApiClient.post('/auth/verify-email', payload);
  },
  async resendVerification() {
    await edoApiClient.post('/auth/resend-verification');
  },
  async forgotPassword(email: string) {
    await edoApiClient.post('/auth/forgot-password', { email });
  },
  async resetPassword(token: string, password: string) {
    await edoApiClient.post('/auth/reset-password', { token, password });
  },
};
