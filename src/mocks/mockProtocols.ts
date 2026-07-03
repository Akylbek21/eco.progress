import type { Protocol, ProtocolResultRow } from '../types/protocols';
import { mockCompanies } from './mockCompanies';
import { mockDevices, mockLaboratory } from './mockDevices';

const companySnapshot = (companyIndex: number, objectIndex: number) => {
  const company = mockCompanies[companyIndex];
  const companyObject = company.objects[objectIndex];
  return {
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
  };
};

const row = (id: string, values: ProtocolResultRow['values'], status: ProtocolResultRow['internalStatus'] = 'NORMAL'): ProtocolResultRow => ({
  id,
  internalStatus: status,
  checkStatus: status,
  values,
});

const base = (
  id: string,
  number: string,
  templateId: Protocol['templateId'],
  companyIndex: number,
  objectIndex: number,
  status: Protocol['status'],
): Protocol => {
  const company = mockCompanies[companyIndex];
  const companyObject = company.objects[objectIndex];
  const now = '2026-06-24T09:30:00.000Z';
  return {
    id,
    protocolNumber: number,
    number,
    templateId,
    status,
    companyId: company.id,
    objectId: companyObject.id,
    companySnapshot: companySnapshot(companyIndex, objectIndex),
    protocolDate: '2026-06-20',
    samplingDate: '2026-06-18',
    testingStartDate: '2026-06-18',
    testingEndDate: '2026-06-20',
    purpose: 'Производственный экологический контроль',
    environment: {
      temperature: '31.4',
      minTemperature: '29.8',
      maxTemperature: '32.1',
      humidity: '29',
      minHumidity: '27',
      maxHumidity: '31',
      pressureKpa: '94.7922039473684',
      windSpeed: '3.2',
      comment: 'Условия проведения измерений соответствуют требованиям методик.',
    },
    organization: {
      organizationName: company.name,
      organizationAddress: company.actualAddress,
      objectName: companyObject.name,
      productName: companyObject.activityType,
      testingBasis: `Договор ${company.contractNumber} от ${company.contractDate}`,
    },
    laboratory: { ...mockLaboratory },
    testing: {
      productNormativeDocument: 'Экологический кодекс Республики Казахстан',
      samplingMethodDocument: 'СТ РК и методики отбора проб согласно области аккредитации',
      testingMethodDocument: 'Методики выполнения измерений испытательной лаборатории',
      samplingDate: '2026-06-18',
      testingStartDate: '2026-06-18',
      testingEndDate: '2026-06-20',
      testingDate: '2026-06-20',
      testingPurpose: 'Производственный экологический контроль',
      environmentConditions: 'Температура 31,4 °C; влажность 29 %; давление 94,7922039473684 кПа.',
    },
    results: [],
    measurementDevices: [],
    explanatoryNote: '',
    executor: mockLaboratory.executor,
    approver: mockLaboratory.laboratoryHead,
    complianceResult: 'NORMAL',
    history: [
      { id: `${id}-history-1`, action: 'Протокол создан', actorName: mockLaboratory.executor, createdAt: now },
      { id: `${id}-history-2`, action: 'Нормативы проверены', actorName: mockLaboratory.executor, createdAt: now },
    ],
    createdAt: now,
    updatedAt: now,
  };
};

const emissions = base('protocol-emissions', 'Ф 01-026/2026', 'industrial_emissions', 1, 1, 'DRAFT');
emissions.results = [
  row('em-1', { samplingDate: '2026-06-18', samplingPlace: 'Паровой котёл', sourceNumber: '0001', indicator: 'Диоксид азота', temperature: '118', speed: '8.4', gasVolume: '2.18', ductArea: '0.28', mdvMg: '200', mdvGs: '0.44', resultMg: '142.6', resultGs: '0.31', measurementDeviceId: 'device-dag' }),
  row('em-2', { samplingDate: '2026-06-18', samplingPlace: 'Паровой котёл', sourceNumber: '0001', indicator: 'Оксид азота', temperature: '118', speed: '8.4', gasVolume: '2.18', ductArea: '0.28', mdvMg: '400', mdvGs: '0.87', resultMg: '186.2', resultGs: '0.41', measurementDeviceId: 'device-dag' }),
  row('em-3', { samplingDate: '2026-06-18', samplingPlace: 'Паровой котёл', sourceNumber: '0001', indicator: 'Диоксид серы', temperature: '118', speed: '8.4', gasVolume: '2.18', ductArea: '0.28', mdvMg: '500', mdvGs: '1.09', resultMg: '18.4', resultGs: '0.04', measurementDeviceId: 'device-dag' }),
  row('em-4', { samplingDate: '2026-06-18', samplingPlace: 'Паровой котёл', sourceNumber: '0001', indicator: 'Оксид углерода', temperature: '118', speed: '8.4', gasVolume: '2.18', ductArea: '0.28', mdvMg: '250', mdvGs: '0.55', resultMg: '212.8', resultGs: '0.46', measurementDeviceId: 'device-dag' }),
];
emissions.measurementDevices = ['device-dag', 'device-pito', 'device-barometer', 'device-anemometer', 'device-thermometer'].map((deviceId, index) => ({
  id: `em-device-${index}`,
  protocolId: emissions.id,
  deviceId,
  deviceSnapshot: { ...mockDevices.find((item) => item.id === deviceId)! },
}));

const water = base('protocol-water', 'Ф 02-014/2026', 'water_wastewater', 0, 2, 'READY_FOR_APPROVAL');
water.results = [
  row('water-1', { object: 'Водовыпуск №2', sampleName: 'Проба №12', indicator: 'БПК', unit: 'мг/дм³', testingMethodDocument: 'ПНД Ф 14.1:2:3:4.123', normative: '6', result: '4.8', externalLaboratory: 'Нет' }),
  row('water-2', { object: 'Водовыпуск №2', sampleName: 'Проба №12', indicator: 'ХПК', unit: 'мг/дм³', testingMethodDocument: 'ПНД Ф 14.1:2.100', normative: '30', result: '24.2', externalLaboratory: 'Нет' }),
];

const air = base('protocol-air', 'Ф 03-009/2026', 'ambient_air', 2, 0, 'APPROVED');
air.results = [
  row('air-1', { direction: 'Север', samplingPlace: 'Граница СЗЗ', indicator: 'Диоксид азота', unit: 'мг/м³', pdkBackground: '0.2', result: '0.087', testingMethod: 'МВИ 01-2024', measurementDeviceId: 'device-dag' }),
  row('air-2', { direction: 'Запад', samplingPlace: 'Граница СЗЗ', indicator: 'Оксид углерода', unit: 'мг/м³', pdkBackground: '5', result: '2.4', testingMethod: 'МВИ 02-2024', measurementDeviceId: 'device-dag' }),
];

const soil = base('protocol-soil', 'П-006/2026', 'soil', 2, 1, 'SIGNED');
soil.results = [
  row('soil-1', { sampleName: 'Проба почвы №1', samplingPlace: 'Южная граница', indicator: 'Мышьяк', unit: 'мг/кг', testingMethodDocument: 'ГОСТ 26930', normativeMax: '2.0', result: '1.62' }),
  row('soil-2', { sampleName: 'Проба почвы №1', samplingPlace: 'Южная граница', indicator: 'Свинец', unit: 'мг/кг', testingMethodDocument: 'ГОСТ 26932', normativeMax: '32.0', result: '26.8' }),
  row('soil-3', { sampleName: 'Проба почвы №1', samplingPlace: 'Южная граница', indicator: 'Нефтепродукты', unit: 'мг/кг', testingMethodDocument: 'ПНД Ф 16.1:2.2.22', normativeMax: '0.3', result: '0.21' }),
];

export const mockProtocols: Protocol[] = [emissions, water, air, soil];
