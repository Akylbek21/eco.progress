import api from './api';
import type { Lead, LeadStatus } from '../types';

export type { LeadStatus, Lead };

export type CreateLeadPayload = Omit<Lead, 'id' | 'status' | 'createdAt'>;

export const createLead = async (payload: CreateLeadPayload): Promise<Lead> => {
  const { data } = await api.post<{ data: Lead; message: string | null }>('/leads', payload);
  return data.data;
};

export const getLeads = async (): Promise<Lead[]> => {
  const { data } = await api.get<{ data: Lead[]; message: string | null }>('/staff/leads');
  return data.data;
};

export const updateLeadStatus = async (id: string, status: LeadStatus): Promise<Lead | undefined> => {
  const { data } = await api.patch<{ data: Lead; message: string | null }>(`/staff/leads/${id}`, { status });
  return data.data;
};
