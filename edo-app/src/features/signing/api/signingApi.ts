import { edoApiClient } from '../../../shared/api/edoApiClient';
import type { DocumentDetails } from '../../documents/types';

export interface SigningChallenge {
  assignmentId: string;
  version: number;
  hash: string;
  dataBase64: string;
  detached: true;
}

export const signingApi = {
  async challenge(documentId: string, assignmentId: string, version: number) {
    const { data } = await edoApiClient.post<SigningChallenge>(`/documents/${documentId}/signing-data`, { assignmentId, version });
    return data;
  },
  async submit(documentId: string, challenge: SigningChallenge, cmsSignatureBase64: string) {
    const { data } = await edoApiClient.post<DocumentDetails>(`/documents/${documentId}/signatures`, {
      assignmentId: challenge.assignmentId,
      version: challenge.version,
      hash: challenge.hash,
      cmsSignatureBase64,
      detached: true,
    });
    return data;
  },
};
