import type { CreateLaboratoryRequest, LaboratoriesQuery, Laboratory, LaboratoryApiDto, LaboratoryEmployee, LaboratoryFormValues, LaboratoryListItem, PageResponse, UpdateLaboratoryRequest } from '../../../types/laboratories';
import { getAccreditationStatus } from '../utils/laboratoryFormatters';

type UnknownRecord = Record<string, unknown>;
const record = (value: unknown): UnknownRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const text = (value: unknown) => value === undefined || value === null ? '' : String(value).trim();
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const nullableNumber = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
const bool = (value: unknown, fallback = false) => value === undefined || value === null ? fallback : value === true || value === 'true' || value === 1;
const nullable = (value: string) => value.trim() || null;
const unwrap = (value: unknown): unknown => {
  let current = value;
  for (let depth = 0; depth < 3; depth += 1) {
    const source = record(current);
    if ('id' in source || 'content' in source || 'items' in source || 'records' in source) break;
    if (!('data' in source)) break;
    current = source.data;
  }
  return current;
};

export function mapLaboratoryDtoToModel(dto: LaboratoryApiDto | unknown): Laboratory {
  const source = record(unwrap(dto));
  const director = record(source.director);
  const head = record(source.laboratoryHead ?? source.head);
  const id = number(source.id ?? source.laboratoryId);
  if (!id) throw new Error('Backend вернул лабораторию без корректного ID');
  return {
    id,
    version: source.version === undefined ? undefined : number(source.version),
    name: text(source.name ?? source.laboratoryName),
    shortName: text(source.shortName) || null, legalName: text(source.legalName) || null,
    bin: text(source.bin) || null, address: text(source.address ?? source.laboratoryAddress), city: text(source.city) || null,
    phone: text(source.phone) || null, email: text(source.email) || null, website: text(source.website ?? source.site) || null,
    accreditationNumber: text(source.accreditationNumber ?? source.certificateNumber) || null,
    accreditationIssuedAt: text(source.accreditationIssuedAt).slice(0, 10) || null,
    accreditationValidUntil: text(source.accreditationValidUntil ?? source.certificateValidUntil).slice(0, 10) || null,
    accreditationIssuedBy: text(source.accreditationIssuedBy) || null,
    directorId: nullableNumber(source.directorId), directorName: text(source.directorName ?? director.fullName) || null,
    laboratoryHeadId: nullableNumber(source.laboratoryHeadId), laboratoryHeadName: text(source.laboratoryHeadName ?? head.fullName) || null,
    standardNote: text(source.standardNote) || null, logoUrl: text(source.logoUrl) || null,
    isDefault: bool(source.isDefault ?? source.defaultLaboratory), active: source.active !== false && !bool(source.archived),
    employeesCount: source.employeesCount === undefined ? undefined : number(source.employeesCount),
    devicesCount: source.devicesCount === undefined && source.measurementDevicesCount === undefined ? undefined : number(source.devicesCount ?? source.measurementDevicesCount),
    protocolsCount: source.protocolsCount === undefined ? undefined : number(source.protocolsCount),
    createdAt: text(source.createdAt) || undefined, updatedAt: text(source.updatedAt) || undefined,
  };
}

export function mapLaboratoryToForm(laboratory: Laboratory): LaboratoryFormValues {
  return {
    id: laboratory.id, version: laboratory.version, name: laboratory.name, shortName: laboratory.shortName || '', legalName: laboratory.legalName || '',
    bin: laboratory.bin || '', address: laboratory.address, city: laboratory.city || '', phone: laboratory.phone || '', email: laboratory.email || '', website: laboratory.website || '',
    accreditationNumber: laboratory.accreditationNumber || '', accreditationIssuedAt: laboratory.accreditationIssuedAt || '', accreditationValidUntil: laboratory.accreditationValidUntil || '', accreditationIssuedBy: laboratory.accreditationIssuedBy || '',
    directorId: laboratory.directorId || null, laboratoryHeadId: laboratory.laboratoryHeadId || null,
    standardNote: laboratory.standardNote || '', logoUrl: laboratory.logoUrl || '', isDefault: laboratory.isDefault, active: laboratory.active,
  };
}

export function mapLaboratoryFormToCreateRequest(values: LaboratoryFormValues): CreateLaboratoryRequest {
  return {
    name: values.name.trim(), shortName: nullable(values.shortName), legalName: nullable(values.legalName), bin: nullable(values.bin), address: values.address.trim(), city: nullable(values.city),
    phone: nullable(values.phone), email: nullable(values.email), website: nullable(values.website), accreditationNumber: nullable(values.accreditationNumber), accreditationIssuedAt: nullable(values.accreditationIssuedAt), accreditationValidUntil: nullable(values.accreditationValidUntil), accreditationIssuedBy: nullable(values.accreditationIssuedBy),
    directorId: values.directorId, laboratoryHeadId: values.laboratoryHeadId, standardNote: nullable(values.standardNote), logoUrl: nullable(values.logoUrl), isDefault: values.isDefault, active: values.active,
  };
}
export function mapLaboratoryFormToUpdateRequest(values: LaboratoryFormValues): UpdateLaboratoryRequest {
  return { ...mapLaboratoryFormToCreateRequest(values), ...(values.version === undefined ? {} : { version: values.version }) };
}

export function mapLaboratoryEmployeeDto(raw: unknown): LaboratoryEmployee {
  const source = record(unwrap(raw)); const user = record(source.user);
  for (const capability of ['canExecuteMeasurements', 'canApproveProtocols', 'canSignProtocols']) if (!(capability in source) && import.meta.env.DEV) console.warn(`[laboratories] Employee DTO does not contain ${capability}; safe false is used.`);
  return {
    id: number(source.id ?? source.laboratoryEmployeeId ?? source.employeeId), version: source.version === undefined ? undefined : number(source.version), laboratoryId: number(source.laboratoryId), userId: nullableNumber(source.userId ?? user.id),
    fullName: text(source.fullName ?? source.name ?? user.fullName ?? user.name), position: text(source.position), email: text(source.email ?? user.email), phone: text(source.phone ?? user.phone), employeeNumber: text(source.employeeNumber), qualification: text(source.qualification), role: text(source.role),
    canExecuteMeasurements: bool(source.canExecuteMeasurements, false), canApproveProtocols: bool(source.canApproveProtocols, false), canSignProtocols: bool(source.canSignProtocols, false), active: source.active !== false && !['INACTIVE', 'DEACTIVATED'].includes(text(source.status).toUpperCase()), deactivatedAt: text(source.deactivatedAt) || undefined,
  };
}

const listItem = (raw: unknown): LaboratoryListItem => {
  const model = mapLaboratoryDtoToModel(raw); const source = record(unwrap(raw));
  return { ...model, accreditationStatus: getAccreditationStatus(model.accreditationValidUntil) };
};

const compare = (sort = 'updatedAt,desc') => {
  const [field, direction] = sort.split(','); const factor = direction === 'asc' ? 1 : -1;
  return (a: LaboratoryListItem, b: LaboratoryListItem) => String(a[field as keyof LaboratoryListItem] ?? '').localeCompare(String(b[field as keyof LaboratoryListItem] ?? ''), 'ru') * factor;
};

export function mapLaboratoriesResponse(response: unknown, query: LaboratoriesQuery): PageResponse<LaboratoryListItem> {
  const raw = unwrap(response); const source = record(raw);
  const serverRows = Array.isArray(raw) ? raw : Array.isArray(source.content) ? source.content : Array.isArray(source.items) ? source.items : Array.isArray(source.records) ? source.records : [];
  let rows = serverRows.map(listItem);
  const search = query.search?.trim().toLocaleLowerCase('ru');
  if (search) rows = rows.filter((item) => [item.name, item.shortName, item.bin, item.address, item.city, item.accreditationNumber].some((value) => String(value || '').toLocaleLowerCase('ru').includes(search)));
  if (query.status === 'ACTIVE') rows = rows.filter((item) => item.active);
  if (query.status === 'INACTIVE') rows = rows.filter((item) => !item.active);
  if (query.accreditationStatus && query.accreditationStatus !== 'ALL') rows = rows.filter((item) => item.accreditationStatus === query.accreditationStatus);
  if (query.city) rows = rows.filter((item) => item.city?.toLocaleLowerCase('ru') === query.city?.toLocaleLowerCase('ru'));
  if (query.defaultOnly) rows = rows.filter((item) => item.isDefault);
  rows.sort(compare(query.sort));
  const totalElements = rows.length; const totalPages = totalElements ? Math.ceil(totalElements / query.size) : 0; const page = Math.min(query.page, Math.max(0, totalPages - 1));
  const content = rows.slice(page * query.size, page * query.size + query.size);
  return { content, items: content, page, size: query.size, totalElements, totalPages, first: page === 0, last: totalPages === 0 || page >= totalPages - 1, hasNext: totalPages > 0 && page < totalPages - 1, hasPrevious: page > 0 };
}

export const mapLaboratoryListItem = listItem;
