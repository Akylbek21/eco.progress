type Filters = Readonly<Record<string, unknown>>;

export const queryKeys = {
  companies: (filters: Filters = {}) => ['companies', filters] as const,
  company: (id: string | number) => ['company', String(id)] as const,
  protocols: (filters: Filters = {}) => ['protocols', filters] as const,
  protocol: (id: string | number) => ['protocol', String(id)] as const,
  journals: (filters: Filters = {}) => ['journal-entries', filters] as const,
  normatives: (filters: Filters = {}) => ['normatives', filters] as const,
  measurementDevices: (filters: Filters = {}) => ['measurement-devices', filters] as const,
  laboratories: (filters: Filters = {}) => ['laboratories', filters] as const,
  laboratory: (id: string | number) => ['laboratory-details', Number(id)] as const,
};
