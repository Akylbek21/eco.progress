import { pekApi } from '../../api/pekService';

type UploadedEvidence = { fileId: string; fileName?: string; version: number };
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
}, dependencies: EvidenceFlowDependencies = defaultDependencies): Promise<UploadedEvidence & { exceedance: Awaited<ReturnType<typeof pekApi.attachExceedanceEvidence>> }> => {
  const uploaded = await dependencies.upload(exceedanceId, version, file);
  if (!uploaded.fileId) throw new Error('Backend не вернул fileId загруженного доказательства.');
  if (!Number.isInteger(uploaded.version)) throw new Error('Backend не вернул новую version после загрузки доказательства.');
  const exceedance = await dependencies.attach(exceedanceId, uploaded.version, uploaded.fileId);
  return { ...uploaded, exceedance };
};
