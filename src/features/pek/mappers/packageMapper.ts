import type {
  PekPackageDocument,
  PekPackageDocumentStatus,
  PekPackageFile,
  PekPackageFileFormat,
  PekReportPackage,
} from '../api/pekContracts';
import { asPekRecord, unwrapPekData } from '../api/pekMappers';

const statuses = new Set<PekPackageDocumentStatus>(['NOT_READY', 'READY', 'GENERATING', 'ERROR']);
const formats = new Set<PekPackageFileFormat>(['XLSX', 'DOCX', 'PDF']);
const status = (value: unknown): PekPackageDocumentStatus => {
  const normalized = String(value || 'NOT_READY').toUpperCase() as PekPackageDocumentStatus;
  return statuses.has(normalized) ? normalized : 'NOT_READY';
};
const format = (value: unknown): PekPackageFileFormat | null => {
  const normalized = String(value || '').toUpperCase() as PekPackageFileFormat;
  return formats.has(normalized) ? normalized : null;
};
const actions = (value: unknown): Record<string, boolean> => {
  const source = asPekRecord(value);
  return Object.fromEntries(Object.entries(source).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'));
};
const text = (value: unknown) => value == null || String(value).trim() === '' ? null : String(value);

const mapFile = (value: unknown, fallbackStatus: PekPackageDocumentStatus): PekPackageFile | null => {
  if (typeof value === 'string') {
    const fileFormat = format(value);
    return fileFormat ? { format: fileFormat, status: fallbackStatus, availableActions: {} } : null;
  }
  const source = asPekRecord(value);
  const fileFormat = format(source.format ?? source.fileFormat ?? source.extension);
  if (!fileFormat) return null;
  return {
    id: typeof source.id === 'number' || typeof source.id === 'string' ? source.id : undefined,
    format: fileFormat,
    status: status(source.status ?? fallbackStatus),
    filename: text(source.filename ?? source.fileName),
    downloadUrl: text(source.downloadUrl ?? source.url ?? source.path),
    availableActions: actions(source.availableActions),
  };
};

const mapDocument = (value: unknown): PekPackageDocument => {
  const source = asPekRecord(value);
  const documentStatus = status(source.status);
  const rawFiles = Array.isArray(source.files) ? source.files : Array.isArray(source.formats) ? source.formats : [];
  const downloadUrls = asPekRecord(source.downloadUrls);
  const urlFiles = Object.entries(downloadUrls).map(([fileFormat, downloadUrl]) => mapFile({ format: fileFormat, downloadUrl, status: documentStatus, availableActions: source.availableActions }, documentStatus));
  for (const fileFormat of ['XLSX', 'DOCX', 'PDF'] as const) {
    const downloadUrl = source[`${fileFormat.toLowerCase()}Url`];
    if (downloadUrl) urlFiles.push(mapFile({ format: fileFormat, downloadUrl, status: documentStatus, availableActions: source.availableActions }, documentStatus));
  }
  const files = [...rawFiles.map((file) => mapFile(file, documentStatus)), ...urlFiles].filter((file): file is PekPackageFile => Boolean(file));
  const declaredFormats = Array.isArray(source.formats) ? source.formats.map(format).filter((item): item is PekPackageFileFormat => Boolean(item)) : [];
  const documentFormats = [...new Set([...declaredFormats, ...files.map((file) => file.format)])];
  return {
    code: String(source.code ?? source.documentType ?? source.type ?? ''),
    name: String(source.name ?? source.title ?? ''),
    status: documentStatus,
    formats: documentFormats,
    files,
    protocolId: source.protocolId == null ? null : Number(source.protocolId),
    protocolNumber: text(source.protocolNumber),
    errorMessage: text(source.errorMessage ?? source.error),
    availableActions: actions(source.availableActions),
  };
};

export const mapReportPackage = (value: unknown): PekReportPackage => {
  const source = asPekRecord(unwrapPekData<unknown>(value));
  const generatedBy = asPekRecord(source.generatedBy);
  return {
    status: status(source.status),
    version: source.version == null ? null : Number(source.version),
    generatedAt: text(source.generatedAt),
    generatedBy: Object.keys(generatedBy).length ? { id: Number(generatedBy.id), name: String(generatedBy.name ?? generatedBy.fullName ?? '') } : null,
    generatedByName: text(source.generatedByName ?? (typeof source.generatedBy === 'string' ? source.generatedBy : null)),
    missingFields: Array.isArray(source.missingFields) ? source.missingFields.map((item) => {
      if (typeof item === 'string') return item;
      const field = asPekRecord(item);
      return String(field.label ?? field.message ?? field.field ?? field.code ?? 'обязательные данные');
    }) : [],
    documents: Array.isArray(source.documents) ? source.documents.map(mapDocument) : Object.entries(asPekRecord(source.documents)).map(([code, document]) => mapDocument({ ...asPekRecord(document), code })),
    availableActions: actions(source.availableActions),
    downloadAvailable: source.downloadAvailable === true || source.hasPackage === true,
  };
};
