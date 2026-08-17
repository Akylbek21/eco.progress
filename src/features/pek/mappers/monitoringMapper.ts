import type {
  PekMonitoringDirection,
  PekMonitoringProtocolRef,
  PekMonitoringType,
  PekMonitoringTypeOption,
  PekProgramMonitoringResponse,
} from '../api/pekContracts';
import { asPekRecord, unwrapPekData } from '../api/pekMappers';

const monitoringTypes = new Set<PekMonitoringType>(['AMBIENT_AIR', 'EMISSION_SOURCE', 'SURFACE_WATER', 'GROUNDWATER', 'WASTEWATER', 'SOIL', 'WASTE', 'PHYSICAL_FACTOR']);
const rows = (value: unknown) => Array.isArray(value) ? value.filter((item) => item && typeof item === 'object').map((item) => item as Record<string, unknown>) : [];
const actions = (value: unknown) => Object.fromEntries(Object.entries(asPekRecord(value)).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'));
const strings = (value: unknown) => Array.isArray(value) ? value.map(String).filter(Boolean) : [];
const monitoringType = (value: unknown): PekMonitoringType => {
  const type = String(value || '').toUpperCase() as PekMonitoringType;
  if (!monitoringTypes.has(type)) throw new Error(`Backend вернул неизвестное направление ПЭК: ${String(value || 'пусто')}`);
  return type;
};
const protocol = (value: unknown): PekMonitoringProtocolRef => {
  const source = asPekRecord(value);
  return {
    id: Number(source.id ?? source.protocolId),
    number: String(source.number ?? source.protocolNumber ?? ''),
    protocolType: source.protocolType == null ? null : String(source.protocolType),
    protocolTypeLabel: source.protocolTypeLabel == null ? null : String(source.protocolTypeLabel),
    status: source.status == null ? null : String(source.status),
    date: source.date == null && source.protocolDate == null ? null : String(source.date ?? source.protocolDate),
  };
};
const direction = (value: unknown): PekMonitoringDirection => {
  const source = asPekRecord(value);
  return {
    id: Number(source.id),
    version: Number(source.version ?? 0),
    monitoringType: monitoringType(source.monitoringType),
    typeLabel: String(source.typeLabel ?? source.monitoringTypeLabel ?? source.name ?? source.monitoringType),
    controlPoints: rows(source.controlPoints ?? source.monitoringPoints ?? source.sources),
    indicators: rows(source.indicators),
    normatives: rows(source.normatives),
    units: strings(source.units),
    periodicity: source.periodicity == null ? null : String(source.periodicity),
    plannedResearchCount: Number(source.plannedResearchCount ?? source.plannedCount ?? 0),
    actualResearchCount: Number(source.actualResearchCount ?? source.actualCount ?? 0),
    methodology: source.methodology == null ? null : String(source.methodology),
    laboratory: Object.keys(asPekRecord(source.laboratory)).length ? { id: Number(asPekRecord(source.laboratory).id), name: String(asPekRecord(source.laboratory).name ?? '') } : null,
    linkedProtocols: (Array.isArray(source.linkedProtocols) ? source.linkedProtocols : Array.isArray(source.protocols) ? source.protocols : []).map(protocol),
    compatibleProtocols: (Array.isArray(source.compatibleProtocols) ? source.compatibleProtocols : Array.isArray(source.availableProtocols) ? source.availableProtocols : []).map(protocol),
    results: rows(source.results),
    exceedances: rows(source.exceedances),
    measures: rows(source.measures),
    availableActions: actions(source.availableActions),
    missingFields: strings(source.missingFields),
  };
};
const typeOption = (value: unknown): PekMonitoringTypeOption => {
  if (typeof value === 'string') return { code: monitoringType(value), label: value, enabled: true };
  const source = asPekRecord(value);
  const code = monitoringType(source.code ?? source.value ?? source.monitoringType);
  return { code, label: String(source.label ?? source.name ?? code), enabled: source.enabled !== false };
};

export const mapProgramMonitoring = (value: unknown, programId: number): PekProgramMonitoringResponse => {
  const unwrapped = unwrapPekData<unknown>(value);
  if (Array.isArray(unwrapped)) return { programId, version: 0, items: unwrapped.map(direction), availableTypes: [], availableActions: {}, missingFields: [] };
  const source = asPekRecord(unwrapped);
  const rawItems = Array.isArray(source.items) ? source.items : Array.isArray(source.monitoring) ? source.monitoring : Array.isArray(source.directions) ? source.directions : [];
  return {
    programId: Number(source.programId ?? programId),
    version: Number(source.version ?? source.programVersion ?? 0),
    items: rawItems.map(direction),
    availableTypes: (Array.isArray(source.availableTypes) ? source.availableTypes : Array.isArray(source.availableMonitoringTypes) ? source.availableMonitoringTypes : Array.isArray(source.monitoringTypes) ? source.monitoringTypes : []).map(typeOption),
    availableActions: actions(source.availableActions),
    missingFields: strings(source.missingFields),
  };
};
