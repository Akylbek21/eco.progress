export type LeadStatus = 'new' | 'contacted' | 'in_progress' | 'closed';

export type Lead = {
  id: string;
  name: string;
  phone: string;
  city: string;
  serviceType: string;
  comment: string;
  source: string;
  status: LeadStatus;
  createdAt: string;
};

export type CreateLeadPayload = Omit<Lead, 'id' | 'status' | 'createdAt'>;

const LEADS_KEY = 'eco-progress-leads';
const delay = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

const readLeads = (): Lead[] => {
  const raw = localStorage.getItem(LEADS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Lead[];
  } catch {
    return [];
  }
};

const writeLeads = (items: Lead[]) => {
  localStorage.setItem(LEADS_KEY, JSON.stringify(items));
};

export const getLeads = async (): Promise<Lead[]> => {
  await delay();
  return readLeads();
};

export const createLead = async (payload: CreateLeadPayload): Promise<Lead> => {
  await delay();
  const lead: Lead = {
    ...payload,
    id: `LEAD-${Date.now()}`,
    status: 'new',
    createdAt: new Date().toLocaleString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  };
  writeLeads([lead, ...readLeads()]);
  return lead;
};

export const updateLeadStatus = async (id: string, status: LeadStatus): Promise<Lead | undefined> => {
  await delay();
  const items = readLeads().map((lead) => (lead.id === id ? { ...lead, status } : lead));
  writeLeads(items);
  return items.find((lead) => lead.id === id);
};
