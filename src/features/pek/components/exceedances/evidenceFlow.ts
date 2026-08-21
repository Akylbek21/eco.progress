import { pekApi } from '../../api/pekService';

type UploadedEvidence = { fileId: string; fileName?: string };
type EvidenceFlowDependencies = {
  upload: typeof pekApi.uploadExceedanceEvidence;
  attach: typeof pekApi.attachExceedanceEvidence;
};

const defaultDependencies: EvidenceFlowDependencies = {
  upload: pekApi.uploadExceedanceEvidence,
  attach: pekApi.attachExceedanceEvidence,
};

export const uploadAndAttachExceedanceEvidence = async ({
  file,
  exceedanceId,
  version,
}: {
  file: File;
  exceedanceId: number;
  reportId: number;
  version: number;
}, dependencies: EvidenceFlowDependencies = defaultDependencies): Promise<UploadedEvidence> => {
  const uploaded = await dependencies.upload(exceedanceId, version, file);
  if (!uploaded.fileId) throw new Error('Backend не вернул fileId загруженного доказательства.');
  await dependencies.attach(exceedanceId, version, uploaded.fileId);
  return uploaded;
};
