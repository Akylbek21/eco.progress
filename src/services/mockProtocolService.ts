import type {
  CreateProtocolPayload,
  MeasurementDevice,
  NormativeRecord,
  NormativeSearchResult,
  Protocol,
  ProtocolHistoryItem,
  ProtocolInternalStatus,
  ProtocolMeasurementDevice,
  ProtocolResultPayload,
  ProtocolResultRow,
  ProtocolStatus,
  ProtocolTemplate,
  UpdateProtocolPayload,
} from '../types/protocols';
import { mockCompanies } from '../mocks/mockCompanies';
import { mockDevices, mockLaboratory } from '../mocks/mockDevices';
import { mockNormatives } from '../mocks/mockNormatives';
import { mockProtocols } from '../mocks/mockProtocols';
import { protocolTemplates } from '../data/protocolTemplates';

const STORAGE_KEY = 'eco-progress-mock-protocols-v2';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const wait = async () => new Promise((resolve) => setTimeout(resolve, 300 + Math.floor(Math.random() * 301)));
const now = () => new Date().toISOString();

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
    water_wastewater: 'Ф 02',
    ambient_air: 'Ф 03',
    physical_factors: 'Ф 04',
    soil: 'П',
    workplace_air: 'Ф 03',
    vehicle_emissions: 'Ф 05',
    sanitary_hygiene: 'СГ',
  }[templateId];
  return `${prefix}-${String(sequence).padStart(3, '0')}/2026`;
};

const compare = (row: ProtocolResultRow): ProtocolInternalStatus => {
  const result = Number(row.values.result ?? row.values.resultMg ?? row.values.resultGs);
  if (!Number.isFinite(result)) return 'EMPTY_RESULT';
  const normative = Number(row.values.normative ?? row.values.normativeMax ?? row.values.normativeMin ?? row.values.pdkBackground ?? row.values.mdvMg);
  const min = Number(row.values.normativeMin);
  const max = Number(row.values.normativeMax);
  const comparison = String(row.values.comparisonType || (Number.isFinite(min) && Number.isFinite(max) ? 'RANGE' : 'LESS_OR_EQUAL'));
  if (comparison === 'RANGE') {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return 'NORMATIVE_NOT_FOUND';
    return result >= min && result <= max ? 'NORMAL' : 'EXCEEDED';
  }
  if (!Number.isFinite(normative)) return 'NORMATIVE_NOT_FOUND';
  if (comparison === 'GREATER_OR_EQUAL') return result >= normative ? 'NORMAL' : 'BELOW_REQUIRED';
  return result <= normative ? 'NORMAL' : 'EXCEEDED';
};

const overall = (rows: ProtocolResultRow[]) => {
  if (rows.some((row) => ['EXCEEDED', 'BELOW_REQUIRED'].includes(row.internalStatus || ''))) return 'DOES_NOT_COMPLY';
  if (rows.some((row) => !row.internalStatus || ['NORMATIVE_NOT_FOUND', 'UNIT_MISMATCH', 'EMPTY_RESULT', 'NEEDS_REVIEW'].includes(row.internalStatus))) return 'NEEDS_REVIEW';
  return 'COMPLIES';
};

export async function getProtocols(): Promise<Protocol[]> {
  await wait();
  return read();
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
    },
    protocolDate: payload.protocolDate,
    samplingDate: payload.samplingDate,
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
    laboratory: clone(mockLaboratory),
    testing: {
      productNormativeDocument: payload.productNormativeDocument || '',
      samplingMethodDocument: payload.samplingMethodDocument || '',
      testingMethodDocument: payload.testingMethodDocument || '',
      samplingDate: payload.samplingDate || '',
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
    executor: mockLaboratory.executor,
    approver: mockLaboratory.laboratoryHead,
    complianceResult: 'NEEDS_REVIEW',
    history: [history('Протокол создан')],
    createdAt,
    updatedAt: createdAt,
  };
  write([protocol, ...items]);
  return clone(protocol);
}

export async function updateProtocol(protocolId: string, payload: UpdateProtocolPayload): Promise<Protocol> {
  await wait();
  return updateStored(protocolId, (protocol) => ({
    ...protocol,
    protocolNumber: payload.number,
    number: payload.number,
    protocolDate: payload.protocolDate,
    formCode: payload.formCode,
    application: payload.application,
    executor: payload.executor,
    approver: payload.approver,
    laboratory: clone(payload.laboratory),
    organization: clone(payload.organization),
    testing: clone(payload.testing),
    environment: clone(payload.environment || {}),
    explanatoryNote: payload.explanatoryNote || '',
    history: [...(protocol.history || []), history('Протокол сохранён')],
  }));
}

export async function deleteProtocol(protocolId: string): Promise<void> {
  await wait();
  const items = read();
  const item = items.find((protocol) => protocol.id === protocolId);
  if (!item) throw new Error('Протокол не найден.');
  if (item.status !== 'DRAFT') throw new Error('Удалить можно только черновик.');
  write(items.filter((protocol) => protocol.id !== protocolId));
}

export async function addResult(protocolId: string, payload: ProtocolResultPayload): Promise<ProtocolResultRow> {
  await wait();
  const result: ProtocolResultRow = { id: id('result'), values: clone(payload.values), measurementDeviceId: payload.measurementDeviceId, internalStatus: 'NEEDS_REVIEW', checkStatus: 'NEEDS_REVIEW' };
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
      saved = { ...row, values: clone(payload.values), measurementDeviceId: payload.measurementDeviceId, internalStatus: 'NEEDS_REVIEW', checkStatus: 'NEEDS_REVIEW' };
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
      const internalStatus = compare(row);
      return { ...row, internalStatus, checkStatus: internalStatus };
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
export const returnToDraft = (id: string) => changeStatus(id, 'DRAFT');
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

export async function searchNormative(params: Record<string, string>): Promise<NormativeSearchResult> {
  await wait();
  const query = String(params.indicator || '').trim().toLowerCase();
  const items = mockNormatives.filter((item) => item.templateId === params.templateId && item.indicator.toLowerCase().includes(query));
  return { found: items.length > 0, normative: items[0], normatives: clone(items), ambiguous: items.length > 1 };
}

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
