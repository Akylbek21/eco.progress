import { publicEdoApiClient } from '../../../shared/api/publicEdoApiClient';

export type ExternalSigningView = {
  sender: string;
  title: string;
  status: string;
  version: number;
  hash: string;
  canSign: boolean;
  signingDataBase64?: string;
};

// Backend: kz.ecoprogress.documentflow.signing.api.PublicSigningController, base path
// /api/public/document-flow/signing/{token} - was /external-sign/{token} here, which has no
// backend mapping at all (would 404). Response/request shapes are still a gap: GET returns
// PublicInvitationView (documentId/title/status/expiresAt/...), not {hash, signingDataBase64};
// POST /sign expects SubmitSignatureRequest {documentId, versionId, assignmentId, cms,
// clientRequestId}, not {version, hash, cmsSignatureBase64} - see the reconciliation report.
const PUBLIC_SIGNING = '/public/document-flow/signing';

export const externalSigningApi = {
  async get(token: string, signal?: AbortSignal) {
    const { data } = await publicEdoApiClient.get<ExternalSigningView>(`${PUBLIC_SIGNING}/${token}`, { signal });
    return data;
  },
  async submit(token: string, value: ExternalSigningView, cmsSignatureBase64: string) {
    await publicEdoApiClient.post(`${PUBLIC_SIGNING}/${token}/sign`, {
      version: value.version,
      hash: value.hash,
      cmsSignatureBase64,
    }, {
      headers: { 'If-Match': `"${value.version}"` },
    });
  },
};
