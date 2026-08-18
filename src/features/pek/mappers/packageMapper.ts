import type { PekReportPackage } from '../api/pekContracts';
import { asPekRecord, unwrapPekData } from '../api/pekMappers';

const actions = (value: unknown): Record<string, boolean> => Object.fromEntries(
  Object.entries(asPekRecord(value)).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
);

export const mapReportPackage = (value: unknown): PekReportPackage => {
  const source = asPekRecord(unwrapPekData<unknown>(value));
  const generatedBy = asPekRecord(source.generatedBy);
  return {
    id: Number(source.id),
    reportId: Number(source.reportId),
    documentVersion: Number(source.documentVersion),
    sourceContentRevision: Number(source.sourceContentRevision),
    files: Array.isArray(source.files) ? source.files.map(String) : [],
    missingFields: Array.isArray(source.missingFields) ? source.missingFields.map(String) : [],
    generatedAt: source.generatedAt == null ? null : String(source.generatedAt),
    generatedBy: Object.keys(generatedBy).length
      ? { id: Number(generatedBy.id), name: String(generatedBy.name ?? generatedBy.fullName ?? '') }
      : null,
    downloadAvailable: source.downloadAvailable === true,
    availableActions: actions(source.availableActions),
    version: Number(source.version),
  };
};
