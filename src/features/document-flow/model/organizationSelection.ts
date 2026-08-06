import { create } from 'zustand';

const STORAGE_PREFIX = 'document-flow:organization:';

const storageKey = (userId: string) => `${STORAGE_PREFIX}${userId}`;

const readStoredOrganization = (userId: string): number | null => {
  const parsed = Number(localStorage.getItem(storageKey(userId)));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

interface OrganizationSelectionState {
  userId: string | null;
  organizationId: number | null;
  initialize: (userId: string) => void;
  select: (userId: string, organizationId: number | null) => void;
  clear: () => void;
}

export const useDocumentFlowOrganizationSelection = create<OrganizationSelectionState>((set) => ({
  userId: null,
  organizationId: null,
  initialize: (userId) => set((state) => state.userId === userId
    ? state
    : { userId, organizationId: readStoredOrganization(userId) }),
  select: (userId, organizationId) => {
    if (organizationId === null) localStorage.removeItem(storageKey(userId));
    else localStorage.setItem(storageKey(userId), String(organizationId));
    set({ userId, organizationId });
  },
  clear: () => set({ userId: null, organizationId: null }),
}));

export const clearStoredDocumentFlowOrganizations = () => {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
  }
  useDocumentFlowOrganizationSelection.getState().clear();
};
