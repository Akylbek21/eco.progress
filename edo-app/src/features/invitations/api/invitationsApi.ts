import { edoApiClient } from '../../../shared/api/edoApiClient';

export type InvitationView = {
  organizationName: string;
  role: string;
  emailMasked: string;
  status: string;
};

export const invitationsApi = {
  async get(token: string, signal?: AbortSignal) {
    const { data } = await edoApiClient.get<InvitationView>(`/invitations/${token}`, { signal });
    return data;
  },
  async respond(token: string, action: 'accept' | 'decline') {
    await edoApiClient.post(`/invitations/${token}/${action}`);
  },
};
