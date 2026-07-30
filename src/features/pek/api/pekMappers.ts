import type { PageResponse } from './pekContracts';

/**
 * Temporary response-envelope migration adapter.
 *
 * Removal deadline: 2026-08-31, or earlier when the Spring Boot OpenAPI
 * client is generated. Do not add DTO field aliases here.
 */
export const PEK_MAPPER_REMOVAL_DATE = '2026-08-31';

type Row = Record<string, unknown>;
export const asPekRecord = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
export const unwrapPekData = <T>(value: unknown): T => {
  const outer = asPekRecord(value);
  const response = 'status' in outer && 'data' in outer ? outer.data : value;
  const envelope = asPekRecord(response);
  return ('data' in envelope ? envelope.data : response) as T;
};
export const mapPekPage = <T>(value: unknown): PageResponse<T> => {
  const data = unwrapPekData<unknown>(value);
  if (Array.isArray(data)) return { content: data as T[], page: 0, size: data.length, totalElements: data.length, totalPages: data.length ? 1 : 0 };
  const row = asPekRecord(data);
  const content = (Array.isArray(row.content) ? row.content : Array.isArray(row.items) ? row.items : []) as T[];
  const size = Number(row.size ?? content.length ?? 20);
  const totalElements = Number(row.totalElements ?? row.total ?? content.length);
  return {
    content,
    page: Number(row.number ?? row.page ?? 0),
    size,
    totalElements,
    totalPages: Number(row.totalPages ?? (size ? Math.ceil(totalElements / size) : 0)),
  };
};
export const filenameFromDisposition = (header: unknown, fallback: string) => {
  const value = String(header || '');
  const utf = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = value.match(/filename="?([^";]+)"?/i)?.[1];
  try { return decodeURIComponent(utf || plain || fallback); } catch { return plain || fallback; }
};
