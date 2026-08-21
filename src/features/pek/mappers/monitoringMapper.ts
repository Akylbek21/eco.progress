import type {
  PekMonitoringDirection,
  PekMonitoringType,
  PekPeriodicity,
  PekProgramMonitoringResponse,
} from '../api/pekContracts';
import { asPekRecord, unwrapPekData } from '../api/pekMappers';

const actions = (value: unknown): Record<string, boolean> => Object.fromEntries(
  Object.entries(asPekRecord(value)).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
);
const numberIds = (value: unknown): number[] => Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
const strings = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : [];

const mapMonitoring = (value: unknown): PekMonitoringDirection => {
  const source = asPekRecord(value);
  return {
    id: Number(source.id),
    programId: Number(source.programId),
    monitoringType: String(source.monitoringType) as PekMonitoringType,
    name: String(source.name),
    methodology: source.methodology == null ? null : String(source.methodology),
    laboratoryId: source.laboratoryId == null ? null : Number(source.laboratoryId),
    frequencyType: String(source.frequencyType) as PekPeriodicity,
    plannedCount: Number(source.plannedCount),
    controlItemIds: numberIds(source.controlItemIds),
    protocolTypes: strings(source.protocolTypes),
    active: source.active === true,
    version: Number(source.version),
    availableActions: actions(source.availableActions),
  };
};

export const mapProgramMonitoring = (value: unknown, programId: number): PekProgramMonitoringResponse => {
  const source = asPekRecord(unwrapPekData<unknown>(value));
  const availableActions = actions(source.availableActions);
  return {
    programId: Number(source.programId ?? programId),
    items: (Array.isArray(source.items) ? source.items : []).map(mapMonitoring),
    availableActions: {
      create: availableActions.create === true,
    },
  };
};
