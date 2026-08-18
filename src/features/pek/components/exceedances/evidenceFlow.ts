import { uploadStaffRepositoryDocument, type StaffRepositoryDocument } from '../../../../services/staffDocumentRepositoryService';
import { pekApi } from '../../api/pekService';

type EvidenceFlowDependencies = {
  upload: typeof uploadStaffRepositoryDocument;
  attach: typeof pekApi.attachExceedanceEvidence;
};

const defaultDependencies: EvidenceFlowDependencies = {
  upload: uploadStaffRepositoryDocument,
  attach: pekApi.attachExceedanceEvidence,
};

export const uploadAndAttachExceedanceEvidence = async ({
  file,
  exceedanceId,
  reportId,
  version,
}: {
  file: File;
  exceedanceId: number;
  reportId: number;
  version: number;
}, dependencies: EvidenceFlowDependencies = defaultDependencies): Promise<StaffRepositoryDocument> => {
  const uploaded = await dependencies.upload({
    file,
    name: file.name,
    category: 'pek-exceedance-evidence',
    comment: `Подтверждение превышения №${exceedanceId} отчёта ПЭК №${reportId}`,
  });
  if (!uploaded.id) throw new Error('Backend не вернул идентификатор загруженного файла.');
  await dependencies.attach(exceedanceId, version, uploaded.id);
  return uploaded;
};
