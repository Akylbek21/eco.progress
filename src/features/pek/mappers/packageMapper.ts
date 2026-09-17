import type { PekPackageFile, PekPackageIssue, PekPackagePreflight, PekReportPackage } from '../api/pekContracts';
import { asPekRecord, unwrapPekData } from '../api/pekMappers';

const actions = (value: unknown): Record<string, boolean> => Object.fromEntries(
  Object.entries(asPekRecord(value)).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
);
const issue = (value: unknown): PekPackageIssue => {
  const source = asPekRecord(value);
  return {
    code: String(source.code || ''), section: String(source.section || ''),
    entityId: source.entityId == null ? null : Number(source.entityId),
    field: source.field == null ? null : String(source.field), message: String(source.message || ''),
  };
};
const issues = (value: unknown) => Array.isArray(value) ? value.map(issue) : [];
const file = (value: unknown): PekPackageFile => {
  const source = asPekRecord(value);
  return {
    key: String(source.key || ''), path: String(source.path || ''), title: String(source.title || ''),
    documentType: String(source.documentType || ''), format: String(source.format || '') as PekPackageFile['format'],
    required: source.required === true, status: String(source.status || 'MISSING') as PekPackageFile['status'],
    versionId: source.versionId == null ? null : Number(source.versionId),
    documentVersion: source.documentVersion == null ? null : Number(source.documentVersion),
    sourceContentRevision: source.sourceContentRevision == null ? null : Number(source.sourceContentRevision),
    generatedAt: source.generatedAt == null ? null : String(source.generatedAt),
    generatedBy: source.generatedBy == null ? null : Number(source.generatedBy),
  };
};

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
    generatedBy: typeof source.generatedBy === 'string' || typeof source.generatedBy === 'number'
      ? source.generatedBy
      : Object.keys(generatedBy).length
      ? { id: Number(generatedBy.id), name: String(generatedBy.name ?? generatedBy.fullName ?? '') }
      : null,
    downloadAvailable: source.downloadAvailable === true,
    availableActions: actions(source.availableActions),
    version: Number(source.version),
    missingDocuments: issues(source.missingDocuments),
    staleDocuments: issues(source.staleDocuments),
    readiness: issues(source.readiness),
  };
};

export const mapPackagePreflight = (value: unknown): PekPackagePreflight => {
  const source = asPekRecord(unwrapPekData<unknown>(value));
  return {
    reportId: Number(source.reportId),
    currentContentRevision: Number(source.currentContentRevision),
    ready: source.ready === true,
    files: Array.isArray(source.files) ? source.files.map(file) : [],
    missingDocuments: issues(source.missingDocuments),
    staleDocuments: issues(source.staleDocuments),
    issues: issues(source.issues),
    availableActions: actions(source.availableActions),
  };
};
