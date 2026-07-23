import type {
  CreateProtocolPayload,
  CalculationResultResponse,
  MeasurementDevice,
  MethodTemplateResponse,
  LaboratoryProfile,
  NormativeRecord,
  NormativeSearchResult,
  Pollutant,
  Protocol,
  ProtocolEnvironmentalConditions,
  ProtocolHistoryItem,
  ProtocolInternalStatus,
  ProtocolLaboratorySnapshot,
  ProtocolMeasurementDevice,
  ProtocolPage,
  QuickProtocolCreatePayload,
  ProtocolResultPayload,
  ProtocolResultRow,
  ProtocolStatus,
  ProtocolCalculationSummaryResponse,
  ProtocolTemplate,
  RawMeasurementRequest,
  RawMeasurementsResponse,
  UpdateProtocolPayload,
  WeatherConditions,
} from '../types/protocols';
import { mockCompanies } from '../mocks/mockCompanies';
import { mockDevices, mockLaboratory } from '../mocks/mockDevices';
import { mockNormatives } from '../mocks/mockNormatives';
import { mockProtocols } from '../mocks/mockProtocols';
import { protocolTemplates } from '../data/protocolTemplates';
import { normalizeProtocolPrintVisibility } from '../utils/protocolPrintVisibility';

const STORAGE_KEY = 'eco-progress-mock-protocols-v2';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const wait = async () => new Promise((resolve) => setTimeout(resolve, 300 + Math.floor(Math.random() * 301)));
const now = () => new Date().toISOString();
const scalarValue = (value: unknown): string | number | null => {
  if (Array.isArray(value)) return scalarValue(value.find((item) => item !== undefined && item !== null && String(item) !== ''));
  return typeof value === 'string' || typeof value === 'number' ? value : null;
};
const laboratorySnapshot = (
  profile: LaboratoryProfile,
  executorId?: string,
): ProtocolLaboratorySnapshot => {
  const profileEmployees = profile.employees || [];
  const executor = profileEmployees.find((employee) => String(employee.id) === executorId && employee.active)
    || profileEmployees.find((employee) => employee.active);
  return {
    id: String(profile.id),
    laboratoryId: String(profile.id),
    name: profile.name,
    laboratoryName: profile.name,
    legalName: profile.legalName || undefined,
    bin: profile.bin || undefined,
    address: profile.address,
    laboratoryAddress: profile.address || '',
    phone: profile.phone || undefined,
    email: profile.email || undefined,
    accreditationNumber: profile.accreditationNumber || '',
    accreditationIssuedAt: profile.accreditationIssuedAt || undefined,
    accreditationValidUntil: profile.accreditationValidUntil || '',
    directorId: profile.directorId ? String(profile.directorId) : undefined,
    directorName: profile.directorName || '',
    director: profile.directorName || '',
    laboratoryHeadId: profile.laboratoryHeadId ? String(profile.laboratoryHeadId) : undefined,
    laboratoryHeadName: profile.laboratoryHeadName || '',
    laboratoryHead: profile.laboratoryHeadName || '',
    executorId: executor?.id ? String(executor.id) : undefined,
    executorName: executor?.fullName || '',
    executor: executor?.fullName || '',
    logoUrl: profile.logoUrl || undefined,
    standardNote: profile.standardNote || undefined,
    capturedAt: now(),
  };
};

const emptyLaboratorySnapshot = (): ProtocolLaboratorySnapshot => ({
  laboratoryName: '',
  laboratoryAddress: '',
  accreditationNumber: '',
  accreditationValidUntil: '',
  director: '',
  laboratoryHead: '',
  executor: '',
  capturedAt: now(),
});

const read = (): Protocol[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as Protocol[];
  } catch {
    // Broken demo storage is replaced by the initial fixture.
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mockProtocols));
  return clone(mockProtocols);
};

const write = (items: Protocol[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

const history = (action: string, comment?: string): ProtocolHistoryItem => ({
  id: id('history'),
  action,
  comment,
  actorName: mockLaboratory.executor,
  createdAt: now(),
});

const updateStored = (protocolId: string, updater: (protocol: Protocol) => Protocol) => {
  const items = read();
  const index = items.findIndex((item) => item.id === protocolId);
  if (index < 0) throw new Error('Протокол не найден.');
  items[index] = updater(clone(items[index]));
  items[index].updatedAt = now();
  write(items);
  return clone(items[index]);
};

const numberFor = (templateId: Protocol['templateId'], sequence: number) => {
  const prefix = {
    industrial_emissions: 'Ф 01',
    water: 'Ф 02',
    water_wastewater: 'Ф 02',
    ambient_air: 'Ф 03',
    physical_factors: 'Ф 04',
    microclimate: 'Ф 04',
    lighting: 'Ф 04',
    noise_vibration: 'Ф 04',
    uv_emf_laser: 'Ф 04',
    soil: 'П',
    food_products: 'ПП',
    surfaces: 'ПВ',
    udmh_special: 'РТ',
    workplace_air: 'Ф 03',
    vehicle_emissions: 'Ф 05',
    sanitary_hygiene: 'СГ',
  }[templateId];
  return `${prefix}-${String(sequence).padStart(3, '0')}/2026`;
};

const compare = (row: ProtocolResultRow): ProtocolInternalStatus => {
  const result = Number(row.values.result ?? row.values.resultMg ?? row.values.resultGs);
  if (!Number.isFinite(result)) return 'EMPTY_RESULT';
  const normative = Number(row.values.normative ?? row.values.pdk ?? row.values.normativeMax ?? row.values.normativeMin ?? row.values.pdkBackground ?? row.values.mdvMg);
  const min = Number(row.values.normativeMin);
  const max = Number(row.values.normativeMax);
  const comparison = String(row.values.comparisonType || (Number.isFinite(min) && Number.isFinite(max) ? 'RANGE' : 'LESS_OR_EQUAL'));
  const hasReferenceNormative = Boolean(row.normativeReference?.id || row.values.normativeId);
  if (comparison === 'RANGE') {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return 'NORMATIVE_NOT_FOUND';
    return result >= min && result <= max ? (hasReferenceNormative ? 'NORMAL' : 'OK_MANUAL') : 'EXCEEDED';
  }
  if (!Number.isFinite(normative)) return 'NORMATIVE_NOT_FOUND';
  if (comparison === 'GREATER_OR_EQUAL') return result >= normative ? (hasReferenceNormative ? 'NORMAL' : 'OK_MANUAL') : 'BELOW_REQUIRED';
  return result <= normative ? (hasReferenceNormative ? 'NORMAL' : 'OK_MANUAL') : 'EXCEEDED';
};

const overall = (rows: ProtocolResultRow[]) => {
  if (rows.some((row) => ['EXCEEDED', 'BELOW_REQUIRED'].includes(row.internalStatus || ''))) return 'DOES_NOT_COMPLY';
  if (rows.some((row) => !row.internalStatus || ['NORMATIVE_NOT_FOUND', 'UNIT_MISMATCH', 'EMPTY_RESULT', 'NEEDS_REVIEW'].includes(row.internalStatus))) return 'NEEDS_REVIEW';
  return 'COMPLIES';
};

export async function getProtocols(_params?: Record<string, string>): Promise<Protocol[]> {
  await wait();
  return read();
}

export async function getProtocolsPage(params?: Record<string, string>, _signal?: AbortSignal): Promise<ProtocolPage> {
  await wait();
  const search = String(params?.search || '').trim().toLowerCase();
  const status = String(params?.status || '').trim().toUpperCase();
  const templateId = String(params?.templateId || params?.protocolType || '').trim().toLowerCase();
  const subtype = String(params?.subtype || '').trim().toUpperCase();
  const compliance = String(params?.compliance || '').trim().toUpperCase();
  const filtered = read().filter((protocol) => {
    const haystack = `${protocol.protocolNumber} ${protocol.companySnapshot.companyName} ${protocol.companySnapshot.bin || ''} ${protocol.companySnapshot.objectName || ''}`.toLowerCase();
    return (!search || haystack.includes(search))
      && (!status || String(protocol.status).toUpperCase() === status)
      && (!templateId || String(protocol.templateId).toLowerCase() === templateId)
      && (!subtype || String(protocol.subtype || '').toUpperCase() === subtype)
      && (!compliance || String(protocol.complianceResult || '').toUpperCase() === compliance);
  });
  const page = Math.max(0, Number(params?.page || 0));
  const size = Math.max(1, Number(params?.size || 25));
  return {
    items: clone(filtered.slice(page * size, page * size + size)),
    page,
    size,
    totalElements: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / size)),
    first: page === 0,
    last: page >= Math.max(1, Math.ceil(filtered.length / size)) - 1,
    hasNext: page < Math.max(1, Math.ceil(filtered.length / size)) - 1,
    hasPrevious: page > 0,
  };
}

export async function getProtocol(protocolId: string): Promise<Protocol> {
  await wait();
  const item = read().find((protocol) => protocol.id === protocolId);
  if (!item) throw new Error('Протокол не найден.');
  return clone(item);
}

export const getProtocolById = getProtocol;

export async function getProtocolTemplates(): Promise<ProtocolTemplate[]> {
  await wait();
  return clone(protocolTemplates);
}

export async function createProtocol(payload: CreateProtocolPayload): Promise<Protocol> {
  await wait();
  const company = mockCompanies.find((item) => item.id === String(payload.companyId));
  const companyObject = company?.objects.find((item) => item.id === String(payload.objectId));
  if (!company || !companyObject) throw new Error('Выберите компанию и объект.');
  const items = read();
  const protocolId = id('protocol');
  const protocolNumber = payload.protocolNumber?.trim() || numberFor(payload.templateId, items.length + 1);
  const createdAt = now();
  const sampleDate = payload.sampleDate || payload.measurementDate || '';
  let snapshot = emptyLaboratorySnapshot();
  const laboratoryService = await import('./laboratorySettingsService');
  const laboratories = await laboratoryService.getLaboratories({ page: 0, size: 100, status: 'ACTIVE' }).then((page) => page.items);
  const selectedLaboratory = payload.laboratoryId
    ? laboratories.find((item) => String(item.id) === payload.laboratoryId)
    : laboratories.find((item) => item.isDefault) || (laboratories.length === 1 ? laboratories[0] : undefined);
  const laboratoryProfile = selectedLaboratory ? await laboratoryService.getLaboratory(selectedLaboratory.id) : undefined;
  if (laboratoryProfile) snapshot = laboratorySnapshot(laboratoryProfile, payload.executorId);
  const protocol: Protocol = {
    id: protocolId,
    protocolNumber,
    number: protocolNumber,
    templateId: payload.templateId,
    subtype: payload.subtype,
    status: 'DRAFT',
    companyId: company.id,
    objectId: companyObject.id,
    companySnapshot: {
      companyName: company.name,
      bin: company.bin,
      legalAddress: company.legalAddress,
      actualAddress: company.actualAddress,
      phone: company.phone,
      email: company.email,
      director: company.director,
      contactPerson: company.contactPerson,
      activityType: company.activityType,
      objectName: companyObject.name,
      objectAddress: companyObject.address,
      objectActivityType: companyObject.activityType,
      coordinates: companyObject.coordinates,
    },
    protocolDate: payload.protocolDate,
    measurementDate: payload.measurementDate,
    measurementTime: payload.measurementTime,
    measurementPlace: payload.measurementPlace,
    sourceNumber: payload.sourceNumber,
    samplingDate: sampleDate,
    testingStartDate: payload.testingStartDate,
    testingEndDate: payload.testingEndDate,
    purpose: payload.purpose,
    environment: clone(payload.environment || {}),
    organization: {
      organizationName: company.name,
      organizationAddress: company.actualAddress || company.legalAddress,
      objectName: companyObject.name,
      productName: payload.productName || companyObject.activityType,
      testingBasis: payload.testingBasis || `Договор ${company.contractNumber} от ${company.contractDate}`,
    },
    laboratory: snapshot,
    testing: {
      productNormativeDocument: payload.productNormativeDocument || '',
      samplingMethodDocument: payload.samplingMethodDocument || '',
      testingMethodDocument: payload.testingMethodDocument || '',
      samplingDate: sampleDate,
      testingStartDate: payload.testingStartDate || '',
      testingEndDate: payload.testingEndDate || '',
      testingDate: payload.testingEndDate || '',
      testingPurpose: payload.purpose || '',
      environmentConditions: payload.environment?.comment || '',
      physicalFactorType: payload.subtype,
    },
    results: [],
    measurementDevices: [],
    explanatoryNote: '',
    executor: snapshot.executor,
    executorId: snapshot.executorId,
    approver: snapshot.laboratoryHead,
    printVisibility: normalizeProtocolPrintVisibility(payload.printVisibility),
    complianceResult: 'NEEDS_REVIEW',
    history: [history('Протокол создан')],
    createdAt,
    updatedAt: createdAt,
  };
  write([protocol, ...items]);
  return clone(protocol);
}

export async function quickCreateProtocol(payload: QuickProtocolCreatePayload): Promise<Protocol> {
  const protocol = await createProtocol({
    companyId: payload.companyId,
    objectId: payload.objectId || '',
    templateId: payload.templateId,
    subtype: payload.subtype,
    protocolDate: payload.protocolDate,
    sampleDate: payload.sampleDate,
    testingStartDate: payload.measurementDate,
    testingEndDate: payload.measurementDate,
    measurementDate: payload.measurementDate,
    measurementTime: payload.measurementTime,
    measurementPlace: payload.measurementPlace,
    laboratoryId: String(payload.laboratoryId),
    executorId: String(payload.executorId),
    sourceDocumentCode: payload.sourceDocumentCode,
    docxTemplateCode: payload.docxTemplateCode,
    normativeTemplateId: payload.normativeTemplateId,
    environmentType: payload.environmentType,
    defaultUnit: payload.defaultUnit,
    waterType: payload.waterType,
    waterUseCategory: payload.waterUseCategory,
    purpose: 'Лабораторные испытания',
    environment: {
      ...(payload.conditions || {}),
      ...(payload.environment || {}),
    } as ProtocolEnvironmentalConditions,
    printVisibility: normalizeProtocolPrintVisibility(payload.printVisibility),
  });
  for (const measurement of payload.measurements) {
    await addResult(protocol.id, {
      normativeId: measurement.normativeId,
      measurementDeviceId: measurement.measurementDeviceId || measurement.deviceId,
      values: {
        ...(payload.conditions || {}),
        ...(measurement.values || {}),
        factorType: measurement.factorType || payload.subtype || '',
        factorCode: measurement.factorCode || '',
        indicator: measurement.indicatorName,
        indicatorName: measurement.indicatorName,
        unit: measurement.unit || '',
        primaryReading: measurement.value,
        measurementReadings: measurement.value,
        result: measurement.value,
        resultValue: measurement.value,
        measurementPlace: payload.measurementPlace || '',
        samplingPlace: payload.measurementPlace || '',
        sourceDocumentCode: payload.sourceDocumentCode || '',
        measurementDeviceId: measurement.measurementDeviceId || measurement.deviceId || '',
        deviceId: measurement.deviceId || measurement.measurementDeviceId || '',
      },
    });
  }
  return checkNormatives(protocol.id);
}

export async function updateProtocol(protocolId: string, payload: UpdateProtocolPayload): Promise<Protocol> {
  await wait();
  return updateStored(protocolId, (protocol) => ({
    ...protocol,
    protocolNumber: payload.number,
    number: payload.number,
    protocolDate: payload.protocolDate,
    objectId: payload.objectId || protocol.objectId,
    measurementDate: payload.measurementDate || protocol.measurementDate,
    measurementTime: payload.measurementTime || protocol.measurementTime,
    measurementPlace: payload.measurementPlace || protocol.measurementPlace,
    formCode: payload.formCode,
    application: payload.application,
    executor: payload.executor,
    executorId: payload.executorId || protocol.executorId,
    approver: payload.approver,
    laboratory: payload.laboratory ? clone({
      ...protocol.laboratory,
      ...payload.laboratory,
      executorId: payload.executorId || payload.laboratory.executorId || protocol.laboratory.executorId,
      executor: payload.executor || payload.laboratory.executor || protocol.laboratory.executor,
    }) : payload.executorId ? {
      ...protocol.laboratory,
      executorId: payload.executorId,
      executor: payload.executor || protocol.laboratory.executor,
    } : protocol.laboratory,
    organization: clone(payload.organization),
    testing: clone(payload.testing),
    environment: clone(payload.environment || {}),
    explanatoryNote: payload.explanatoryNote || '',
    printVisibility: normalizeProtocolPrintVisibility(payload.printVisibility),
    history: [...(protocol.history || []), history('Протокол сохранён')],
  }));
}

export async function deleteProtocol(protocolId: string): Promise<void> {
  await wait();
  const items = read();
  const item = items.find((protocol) => protocol.id === protocolId);
  if (!item) throw new Error('Протокол не найден.');
  if (item.status !== 'DRAFT') throw new Error('Удалить можно только активный протокол.');
  write(items.filter((protocol) => protocol.id !== protocolId));
}

export async function addResult(protocolId: string, payload: ProtocolResultPayload): Promise<ProtocolResultRow> {
  await wait();
  const result: ProtocolResultRow = {
    id: id('result'),
    values: { ...clone(payload.values), normativeId: payload.normativeId ?? payload.values.normativeId },
    measurementDeviceId: payload.measurementDeviceId || undefined,
    internalStatus: 'NEEDS_REVIEW',
    checkStatus: 'NEEDS_REVIEW',
  };
  updateStored(protocolId, (protocol) => ({ ...protocol, results: [...protocol.results, result], history: [...(protocol.history || []), history('Строка результата добавлена')] }));
  return clone(result);
}

export const addProtocolResult = addResult;

export async function updateResult(protocolId: string, resultId: string, payload: ProtocolResultPayload): Promise<ProtocolResultRow> {
  await wait();
  let saved!: ProtocolResultRow;
  updateStored(protocolId, (protocol) => ({
    ...protocol,
    results: protocol.results.map((row) => {
      if (row.id !== resultId) return row;
      saved = {
        ...row,
        values: { ...clone(payload.values), normativeId: payload.normativeId ?? payload.values.normativeId },
        measurementDeviceId: payload.measurementDeviceId || undefined,
        internalStatus: 'NEEDS_REVIEW',
        checkStatus: 'NEEDS_REVIEW',
      };
      return saved;
    }),
    history: [...(protocol.history || []), history('Строка результата изменена')],
  }));
  if (!saved) throw new Error('Строка результата не найдена.');
  return clone(saved);
}

export const updateProtocolResult = updateResult;

export async function deleteResult(protocolId: string, resultId: string): Promise<void> {
  await wait();
  updateStored(protocolId, (protocol) => ({ ...protocol, results: protocol.results.filter((row) => row.id !== resultId), history: [...(protocol.history || []), history('Строка результата удалена')] }));
}

export const deleteProtocolResult = deleteResult;

export async function checkNormatives(protocolId: string): Promise<Protocol> {
  await wait();
  return updateStored(protocolId, (protocol) => {
    const results = protocol.results.map((row) => {
      const primary = row.values.primaryReading ?? row.values.measurementReadings;
      const values = row.values.result || row.values.resultMg
        ? row.values
        : { ...row.values, result: primary, resultMg: protocol.templateId === 'industrial_emissions' ? primary : row.values.resultMg };
      const calculated = { ...row, values };
      const internalStatus = compare(calculated);
      const normativeValue = String(values.normative ?? values.normativeMax ?? values.normativeMin ?? '');
      return {
        ...calculated,
        result: String(values.result ?? values.resultMg ?? ''),
        internalStatus,
        checkStatus: internalStatus,
        calculationDetails: {
          formula: 'Официальная формула методики (демонстрационный backend)',
          substitutedValues: String(primary ?? ''),
          finalValue: String(values.result ?? values.resultMg ?? ''),
          unit: String(values.unit || ''),
          normativeValue,
          comparisonResult: internalStatus,
          methodVersion: String(values.methodVersion || 'demo-1'),
        },
      };
    });
    return { ...protocol, results, complianceResult: overall(results), history: [...(protocol.history || []), history('Нормативы проверены')] };
  });
}

export async function changeStatus(protocolId: string, status: ProtocolStatus): Promise<Protocol> {
  await wait();
  return updateStored(protocolId, (protocol) => ({
    ...protocol,
    status,
    approvedAt: status === 'APPROVED' ? now() : protocol.approvedAt,
    signedAt: status === 'SIGNED' ? now() : protocol.signedAt,
    history: [...(protocol.history || []), history(`Статус изменён: ${status}`)],
  }));
}

export const readyForApproval = (id: string) => changeStatus(id, 'READY_FOR_APPROVAL');
export const approveProtocol = (id: string) => changeStatus(id, 'APPROVED');
export const returnForRevision = async (id: string, _reason: string) => changeStatus(id, 'NEEDS_REVISION');
export const cancelProtocol = (id: string) => changeStatus(id, 'CANCELLED');
export const signProtocol = (id: string) => changeStatus(id, 'SIGNED');

export async function replaceProtocol(protocolId: string, reason: string): Promise<Protocol> {
  await wait();
  const items = read();
  const sourceIndex = items.findIndex((item) => item.id === protocolId);
  if (sourceIndex < 0) throw new Error('Протокол не найден.');
  const source = items[sourceIndex];
  const replacementId = id('protocol');
  const replacementNumber = `${source.protocolNumber}-И${items.filter((item) => item.replacesProtocolId === protocolId).length + 1}`;
  const replacement: Protocol = {
    ...clone(source),
    id: replacementId,
    protocolNumber: replacementNumber,
    number: replacementNumber,
    status: 'DRAFT',
    replacesProtocolId: source.id,
    replacedByProtocolId: undefined,
    approvedAt: undefined,
    signedAt: undefined,
    history: [...(source.history || []), history('Создана исправленная версия', reason)],
    createdAt: now(),
    updatedAt: now(),
  };
  items[sourceIndex] = { ...source, status: 'REPLACED', replacedByProtocolId: replacementId, history: [...(source.history || []), history('Протокол заменён исправленной версией', reason)] };
  write([replacement, ...items]);
  return clone(replacement);
}

export async function duplicateProtocol(protocolId: string): Promise<Protocol> {
  await wait();
  const items = read();
  const source = items.find((item) => item.id === protocolId);
  if (!source) throw new Error('Протокол не найден.');
  const duplicateId = id('protocol');
  const duplicateNumber = `${source.protocolNumber || source.number}-COPY-${items.filter((item) => item.replacesProtocolId === protocolId).length + 1}`;
  const duplicate: Protocol = {
    ...clone(source),
    id: duplicateId,
    protocolNumber: duplicateNumber,
    number: duplicateNumber,
    status: 'DRAFT',
    approvedAt: undefined,
    signedAt: undefined,
    replacesProtocolId: undefined,
    replacedByProtocolId: undefined,
    results: source.results.map((row) => ({ ...clone(row), id: id('result') })),
    measurementDevices: source.measurementDevices.map((device) => ({ ...clone(device), id: id('protocol-device'), protocolId: duplicateId })),
    history: [history('Создана копия протокола', source.protocolNumber || source.number)],
    createdAt: now(),
    updatedAt: now(),
  };
  write([duplicate, ...items]);
  return clone(duplicate);
}

export async function addProtocolMeasurementDevice(protocolId: string, device: MeasurementDevice): Promise<Protocol> {
  await wait();
  if (device.status === 'EXPIRED' || device.status === 'ARCHIVED') throw new Error('Прибор с истёкшей поверкой недоступен.');
  return updateStored(protocolId, (protocol) => {
    if (protocol.measurementDevices.some((item) => item.deviceId === device.id)) return protocol;
    const item: ProtocolMeasurementDevice = { id: id('protocol-device'), protocolId, deviceId: device.id, deviceSnapshot: clone(device) };
    return { ...protocol, measurementDevices: [...protocol.measurementDevices, item], history: [...(protocol.history || []), history(`Добавлен прибор: ${device.name}`)] };
  });
}

export async function removeProtocolMeasurementDevice(protocolId: string, deviceId: string): Promise<Protocol> {
  await wait();
  return updateStored(protocolId, (protocol) => ({ ...protocol, measurementDevices: protocol.measurementDevices.filter((item) => item.deviceId !== deviceId), history: [...(protocol.history || []), history('Прибор удалён')] }));
}

export async function searchNormative(params: Record<string, string>, _signal?: AbortSignal): Promise<NormativeSearchResult> {
  await wait();
  const query = String(params.query || params.code || params.pollutantCode || params.indicator || '').trim().toLowerCase();
  if (query.length < 3) return { found: false, normatives: [], items: [] };
  const codeMap: Record<string, string> = { '0301': 'n-no2', '0304': 'n-no', '0330': 'n-so2', '0337': 'n-co' };
  const items = mockNormatives.filter((item) =>
    item.templateId === params.templateId
    && (codeMap[params.code] ? item.id === codeMap[params.code] : `${item.code || ''} ${item.pollutantCode || ''} ${item.indicator || ''}`.toLowerCase().includes(query))).slice(0, 20);
  return { found: items.length > 0, normative: items[0], normatives: clone(items), ambiguous: items.length > 1 };
}

const demoPollutants: Pollutant[] = [
  { code: '0301', name: 'Азота диоксид', formula: 'NO₂', cas: '10102-44-0', unit: 'мг/м³', testingMethod: 'МВИ 01-2024' },
  { code: '0304', name: 'Азота оксид', formula: 'NO', cas: '10102-43-9', unit: 'мг/м³', testingMethod: 'МВИ 01-2024' },
  { code: '0330', name: 'Сера диоксид', formula: 'SO₂', cas: '7446-09-5', unit: 'мг/м³', testingMethod: 'МВИ 02-2024' },
  { code: '0337', name: 'Углерода оксид', formula: 'CO', cas: '630-08-0', unit: 'мг/м³', testingMethod: 'МВИ 03-2024' },
];

const demoMethodTemplates: MethodTemplateResponse[] = [
  {
    id: 'demo-method-air',
    code: 'DEMO-AIR-001',
    name: 'Demo calculation method',
    protocolTemplateCode: 'industrial_emissions',
    methodDocument: 'MVI DEMO-001',
    measurementUnit: 'mg/m3',
    resultUnit: 'mg/m3',
    formulaExpression: '(reading1 + reading2) / 2',
    decimalPlaces: 3,
    active: true,
    variables: [
      { id: 'v-reading-1', variableKey: 'reading1', variableLabel: 'Reading 1', unit: 'mg/m3', type: 'number', required: true, displayOrder: 1 },
      { id: 'v-reading-2', variableKey: 'reading2', variableLabel: 'Reading 2', unit: 'mg/m3', type: 'number', required: false, displayOrder: 2 },
    ],
  },
];

const defaultMethodTemplate = (row?: ProtocolResultRow): MethodTemplateResponse => ({
  ...demoMethodTemplates[0],
  pollutantCode: String(row?.values.pollutantCode || row?.code || row?.values.code || ''),
  pollutantName: String(row?.values.indicator || row?.indicatorName || row?.indicator || ''),
  methodDocument: String(row?.testingMethodDocument || row?.testingMethod || row?.values.testingMethodDocument || row?.values.testingMethod || demoMethodTemplates[0].methodDocument),
  measurementUnit: String(row?.unit || row?.values.unit || demoMethodTemplates[0].measurementUnit),
  resultUnit: String(row?.unit || row?.values.unit || demoMethodTemplates[0].resultUnit),
});

const rawMeasurementsFor = (protocolId: string, row: ProtocolResultRow): RawMeasurementsResponse => {
  const methodTemplate = defaultMethodTemplate(row);
  const measurements = methodTemplate.variables.map<RawMeasurementRequest>((variable) => ({
    variableKey: variable.variableKey,
    variableValue: scalarValue(row.values[`raw_${variable.variableKey}`]) ?? scalarValue(row.values[variable.variableKey]) ?? variable.defaultValue ?? '',
    unit: variable.unit,
    sourceType: 'MANUAL',
    deviceId: row.measurementDeviceId || row.deviceId || String(row.values.measurementDeviceId || row.values.deviceId || ''),
  }));
  return {
    protocolId,
    resultId: row.id,
    methodTemplate,
    variables: methodTemplate.variables,
    measurements,
    calculationStatus: row.calculationStatus,
    calculationMessage: row.calculationMessage,
  };
};

const calculationResponseFor = (protocolId: string, row: ProtocolResultRow): CalculationResultResponse => ({
  protocolId,
  resultId: row.id,
  result: row.result || scalarValue(row.values.result) || scalarValue(row.values.resultMg),
  uncertaintyValue: row.uncertaintyValue || scalarValue(row.values.uncertaintyValue),
  normativeValue: row.normativeValue || row.normative || row.pdk || scalarValue(row.values.normative) || scalarValue(row.values.pdk),
  internalStatus: row.internalStatus,
  calculationStatus: row.calculationStatus,
  calculationMessage: row.calculationMessage,
  warnings: row.warnings,
  row,
});

const calculateMockRow = (row: ProtocolResultRow): ProtocolResultRow => {
  const rawValues = ['reading1', 'reading2']
    .map((key) => Number(String(row.values[`raw_${key}`] ?? row.values[key] ?? '').replace(',', '.')))
    .filter(Number.isFinite);
  const manual = Number(String(row.values.primaryReading ?? row.values.result ?? row.result ?? '').replace(',', '.'));
  const resultNumber = rawValues.length
    ? rawValues.reduce((sum, value) => sum + value, 0) / rawValues.length
    : manual;
  if (!Number.isFinite(resultNumber)) {
    return {
      ...row,
      calculationStatus: 'WAITING_INPUTS',
      calculationMessage: 'Waiting for raw inputs',
      internalStatus: 'EMPTY_RESULT',
      checkStatus: 'EMPTY_RESULT',
    };
  }
  const result = resultNumber.toFixed(3).replace(/\.?0+$/, '');
  const calculated: ProtocolResultRow = {
    ...row,
    result,
    calculationStatus: rawValues.length ? 'CALCULATED' : 'MANUAL',
    calculationMessage: rawValues.length ? 'Calculated' : 'Manual input',
    uncertaintyValue: String(row.values.uncertaintyValue || ''),
    values: {
      ...row.values,
      result,
      resultMg: result,
      resultValue: result,
      calculationStatus: rawValues.length ? 'CALCULATED' : 'MANUAL',
      calculationMessage: rawValues.length ? 'Calculated' : 'Manual input',
    },
  };
  const internalStatus = compare(calculated);
  return { ...calculated, internalStatus, checkStatus: internalStatus };
};

export async function getMethodTemplates(): Promise<MethodTemplateResponse[]> {
  await wait();
  return clone(demoMethodTemplates);
}

export async function getMethodTemplate(id: string): Promise<MethodTemplateResponse> {
  await wait();
  return clone(demoMethodTemplates.find((item) => item.id === id) || demoMethodTemplates[0]);
}

export async function getRawMeasurements(protocolId: string, resultId: string): Promise<RawMeasurementsResponse> {
  await wait();
  const protocol = await getProtocol(protocolId);
  const row = protocol.results.find((item) => item.id === resultId);
  if (!row) throw new Error('Result row not found.');
  return clone(rawMeasurementsFor(protocolId, row));
}

export async function saveRawMeasurements(
  protocolId: string,
  resultId: string,
  payload: RawMeasurementRequest[],
  methodTemplateId?: string | number | null,
): Promise<ProtocolResultRow | undefined> {
  await wait();
  let saved: ProtocolResultRow | undefined;
  updateStored(protocolId, (protocol) => ({
    ...protocol,
    results: protocol.results.map((row) => {
      if (row.id !== resultId) return row;
      const rawValues = Object.fromEntries(payload.map((item) => [`raw_${item.variableKey}`, item.variableValue ?? '']));
      saved = {
        ...row,
        calculationStatus: 'WAITING_INPUTS',
        calculationMessage: '',
        values: {
          ...row.values,
          ...rawValues,
          methodTemplateId: methodTemplateId || row.values.methodTemplateId,
          measurementDeviceId: payload.find((item) => item.deviceId)?.deviceId || row.values.measurementDeviceId,
        },
      };
      return saved;
    }),
    history: [...(protocol.history || []), history('Raw measurements saved')],
  }));
  if (!saved) throw new Error('Result row not found.');
  return clone(saved);
}

export async function calculateResult(protocolId: string, resultId: string): Promise<CalculationResultResponse> {
  await wait();
  let saved: ProtocolResultRow | undefined;
  updateStored(protocolId, (protocol) => {
    const results = protocol.results.map((row) => {
      if (row.id !== resultId) return row;
      saved = calculateMockRow(row);
      return saved;
    });
    return { ...protocol, results, complianceResult: overall(results), history: [...(protocol.history || []), history('Result calculated')] };
  });
  if (!saved) throw new Error('Result row not found.');
  return clone(calculationResponseFor(protocolId, saved));
}

export async function calculateProtocolSummary(protocolId: string): Promise<ProtocolCalculationSummaryResponse> {
  await wait();
  let savedRows: ProtocolResultRow[] = [];
  updateStored(protocolId, (protocol) => {
    savedRows = protocol.results.map(calculateMockRow);
    return { ...protocol, results: savedRows, complianceResult: overall(savedRows), history: [...(protocol.history || []), history('Protocol calculated')] };
  });
  const rows = savedRows.map((row) => calculationResponseFor(protocolId, row));
  return {
    protocolId,
    total: rows.length,
    calculated: rows.filter((row) => row.calculationStatus === 'CALCULATED').length,
    manual: rows.filter((row) => row.calculationStatus === 'MANUAL').length,
    waitingInputs: rows.filter((row) => row.calculationStatus === 'WAITING_INPUTS').length,
    needsRepeat: rows.filter((row) => row.calculationStatus === 'NEEDS_REPEAT').length,
    normativeNotFound: rows.filter((row) => row.internalStatus === 'NORMATIVE_NOT_FOUND').length,
    errors: rows.filter((row) => row.calculationStatus === 'ERROR').length,
    exceeded: rows.filter((row) => row.internalStatus === 'EXCEEDED').length,
    complies: rows.filter((row) => ['NORMAL', 'OK', 'OK_MANUAL', 'MANUAL_NORMATIVE'].includes(String(row.internalStatus))).length,
    rows,
  };
}

export async function getCalculationHistory(): Promise<CalculationResultResponse[]> {
  await wait();
  return [];
}

export async function searchPollutants(query: string, _params?: Record<string, string>, _signal?: AbortSignal): Promise<Pollutant[]> {
  await wait();
  if (query.trim().length < 3) return [];
  const tokens = query.toLowerCase().split(/[\s,;]+/).filter(Boolean);
  return clone(demoPollutants.filter((item) => tokens.some((token) =>
    `${item.code} ${item.name} ${item.cas} ${item.formula}`.toLowerCase().includes(token))).slice(0, 20));
}

export async function getWeatherConditions(): Promise<WeatherConditions> {
  await wait();
  return {
    temperature: '24.6',
    minTemperature: '23.9',
    maxTemperature: '25.1',
    humidity: '41',
    minHumidity: '39',
    maxHumidity: '43',
    pressureKpa: '96.8',
    windSpeed: '2.4',
    status: 'LOADED',
    source: 'API',
    dataSource: 'Демонстрационный погодный архив',
    observedAt: now(),
    loadedAt: now(),
  };
}

export const calculateProtocol = checkNormatives;

export async function previewProtocol(protocolId: string): Promise<Blob> {
  const protocol = await getProtocol(protocolId);
  updateStored(protocolId, (item) => ({ ...item, history: [...(item.history || []), history('Предпросмотр открыт')] }));
  return new Blob([`<html><body><h1>${protocol.protocolNumber}</h1></body></html>`], { type: 'text/html;charset=utf-8' });
}

export const generatePdf = getProtocol;
export const generateDocx = getProtocol;
export const importExcel = async (protocolId: string) => getProtocol(protocolId);

const download = async (protocolId: string, extension: string) => {
  const protocol = await getProtocol(protocolId);
  const content = `Макет лабораторного протокола ${protocol.protocolNumber}\n${protocol.companySnapshot.companyName}`;
  return { blob: new Blob([content], { type: extension === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), fileName: `${protocol.protocolNumber}.${extension}` };
};

export const downloadPdf = (id: string) => download(id, 'pdf');
export const downloadDocx = (id: string) => download(id, 'docx');

export function resetMockProtocols() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mockProtocols));
}
