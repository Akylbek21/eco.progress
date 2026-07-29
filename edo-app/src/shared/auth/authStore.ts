import { create } from 'zustand';

type AuthState = {
  status: 'BOOTSTRAPPING' | 'AUTHENTICATED' | 'ANONYMOUS';
  activeOrganizationId?: string;
  drawerOpen: boolean;
  setStatus: (status: AuthState['status']) => void;
  setActiveOrganization: (id?: string) => void;
  setDrawerOpen: (open: boolean) => void;
  reset: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'BOOTSTRAPPING',
  drawerOpen: false,
  setStatus: (status) => set({ status }),
  setActiveOrganization: (activeOrganizationId) => set({ activeOrganizationId }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  reset: () => set({ status: 'ANONYMOUS', activeOrganizationId: undefined, drawerOpen: false }),
}));
