import { edoApiClient } from '../../../shared/api/edoApiClient';
import type { DocumentDetails } from '../../documents/types';

export interface SigningChallenge {
  assignmentId: string;
  version: number;
  hash: string;
  dataBase64: string;
  detached: true;
}

// See kz.ecoprogress.documentflow.signing.DocumentFlowSigningController, base path
// /api/document-flow/documents/{id} - edoApiClient's baseURL only carries /api.
const DF = '/document-flow';

export const signingApi = {
  /** Backend's GET .../signing-data (DocumentFlowSigningController.java:82) takes no
   *  assignmentId/version and returns the full SigningRouteResponse, not a {hash, dataBase64}
   *  challenge - method/path fixed here (was POST with a body the backend ignores), but the
   *  SigningChallenge shape this returns does NOT match what the backend actually sends back.
   *  Flagged as a real contract gap - see the frontend/backend reconciliation report. */
  async challenge(documentId: string, _assignmentId: string, _version: number) {
    const { data } = await edoApiClient.get<SigningChallenge>(`${DF}/documents/${documentId}/signing-data`);
    return data;
  },
  /** Path fixed to include /document-flow. Backend's SubmitSignatureRequest
   *  (SigningRouteDtos.java:81) expects {documentId, versionId, assignmentId, cms,
   *  clientRequestId} - different field names than sent here (version/hash/cmsSignatureBase64/
   *  detached). Left as-is pending a coordinated fix - see the reconciliation report. */
  async submit(documentId: string, challenge: SigningChallenge, cmsSignatureBase64: string) {
    const { data } = await edoApiClient.post<DocumentDetails>(`${DF}/documents/${documentId}/signatures`, {
      assignmentId: challenge.assignmentId,
      version: challenge.version,
      hash: challenge.hash,
      cmsSignatureBase64,
      detached: true,
    }, { headers: { 'If-Match': `"${challenge.version}"` } });
    return data;
  },
};
