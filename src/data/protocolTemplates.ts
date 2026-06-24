import type { ProtocolResultColumn, ProtocolTemplate, ProtocolSubtype } from '../types/protocols';

export const protocolTemplates: ProtocolTemplate[] = [
  { id: 'industrial_emissions', name: 'Промышленные выбросы' },
  { id: 'water_wastewater', name: 'Вода / сточные воды' },
  { id: 'ambient_air', name: 'Воздух СЗЗ / промплощадки' },
  { id: 'physical_factors', name: 'Физические факторы' },
  { id: 'soil', name: 'Почва' },
];

export const physicalFactorTypes: Array<{ value: ProtocolSubtype; label: string }> = [
  { value: 'MICROCLIMATE', label: 'Микроклимат' },
  { value: 'LIGHTING', label: 'Освещённость' },
  { value: 'NOISE', label: 'Шум' },
  { value: 'VIBRATION', label: 'Вибрация' },
  { value: 'NOISE_VIBRATION', label: 'Шум и вибрация' },
];

export const subtypeName = (subtype?: string) =>
  physicalFactorTypes.find((item) => item.value === subtype)?.label || subtype || '—';

const industrialEmissions: ProtocolResultColumn[] = [
  { key: 'samplingDate', label: 'Дата отбора', type: 'date' },
  { key: 'samplingPlace', label: 'Место отбора' },
  { key: 'sourceNumber', label: 'Номер источника' },
  { key: 'indicator', label: 'Показатель', type: 'indicator', required: true },
  { key: 'temperature', label: 'Температура', type: 'number' },
  { key: 'speed', label: 'Скорость', type: 'number' },
  { key: 'gasVolume', label: 'Объём смеси', type: 'number' },
  { key: 'ductArea', label: 'Площадь газохода', type: 'number' },
  { key: 'mdvMg', label: 'ПДВ мг/м³', type: 'number' },
  { key: 'mdvGs', label: 'ПДВ г/с', type: 'number' },
  { key: 'resultMg', label: 'Результат мг/м³', type: 'number' },
  { key: 'resultGs', label: 'Результат г/с', type: 'number' },
  { key: 'testingMethod', label: 'Метод' },
  { key: 'measurementDeviceId', label: 'Прибор', type: 'device' },
];

const water: ProtocolResultColumn[] = [
  { key: 'object', label: 'Объект / водовыпуск' },
  { key: 'sampleName', label: 'Проба' },
  { key: 'indicator', label: 'Показатель', type: 'indicator', required: true },
  { key: 'unit', label: 'Единица' },
  { key: 'testingMethodDocument', label: 'НД на метод испытаний' },
  { key: 'normative', label: 'Норматив' },
  { key: 'result', label: 'Результат', type: 'number' },
  { key: 'externalLaboratory', label: 'Внешняя лаборатория' },
];

const ambientAir: ProtocolResultColumn[] = [
  { key: 'samplingPlace', label: 'Место отбора' },
  { key: 'direction', label: 'Направление' },
  { key: 'indicator', label: 'Показатель', type: 'indicator', required: true },
  { key: 'unit', label: 'Единица' },
  { key: 'pdkBackground', label: 'ПДК / фон' },
  { key: 'result', label: 'Результат', type: 'number' },
  { key: 'samplingMethod', label: 'Метод отбора' },
  { key: 'testingMethod', label: 'Метод испытаний' },
  { key: 'measurementDeviceId', label: 'Прибор', type: 'device' },
];

const soil: ProtocolResultColumn[] = [
  { key: 'sampleName', label: 'Проба' },
  { key: 'samplingPlace', label: 'Место отбора' },
  { key: 'indicator', label: 'Показатель', type: 'indicator', required: true },
  { key: 'unit', label: 'Единица' },
  { key: 'testingMethodDocument', label: 'НД на метод испытаний' },
  { key: 'normativeMax', label: 'ПДК, не более' },
  { key: 'result', label: 'Результат', type: 'number' },
];

const microclimate: ProtocolResultColumn[] = [
  { key: 'measurementPlace', label: 'Место замера' },
  {
    key: 'indicator',
    label: 'Показатель',
    type: 'select',
    required: true,
    options: [
      { value: 'Температура', label: 'Температура' },
      { value: 'Относительная влажность', label: 'Относительная влажность' },
      { value: 'Скорость движения воздуха', label: 'Скорость движения воздуха' },
    ],
  },
  { key: 'unit', label: 'Единица' },
  { key: 'testingMethodDocument', label: 'НД на метод' },
  { key: 'normativeMin', label: 'Минимальная норма' },
  { key: 'normativeMax', label: 'Максимальная норма' },
  { key: 'result', label: 'Результат', type: 'number' },
  { key: 'measurementDeviceId', label: 'Прибор', type: 'device' },
];

const lighting: ProtocolResultColumn[] = [
  { key: 'measurementPlace', label: 'Место замера' },
  { key: 'indicator', label: 'Показатель', type: 'indicator', required: true },
  { key: 'unit', label: 'Единица' },
  { key: 'testingMethodDocument', label: 'НД на метод' },
  { key: 'normativeMin', label: 'Минимальная норма' },
  { key: 'result', label: 'Результат', type: 'number' },
  { key: 'measurementDeviceId', label: 'Прибор', type: 'device' },
];

const noiseVibration: ProtocolResultColumn[] = [
  { key: 'measurementPlace', label: 'Место замера' },
  {
    key: 'factorType',
    label: 'Вид фактора',
    type: 'select',
    required: true,
    options: [
      { value: 'NOISE', label: 'Шум' },
      { value: 'VIBRATION', label: 'Вибрация' },
    ],
  },
  { key: 'indicator', label: 'Показатель', type: 'indicator', required: true },
  { key: 'unit', label: 'Единица' },
  { key: 'testingMethodDocument', label: 'НД на метод' },
  { key: 'normativeMax', label: 'Максимально допустимое значение' },
  { key: 'result', label: 'Результат', type: 'number' },
  { key: 'measurementDeviceId', label: 'Прибор', type: 'device' },
];

const physicalColumns: Record<ProtocolSubtype, ProtocolResultColumn[]> = {
  MICROCLIMATE: microclimate,
  LIGHTING: lighting,
  NOISE: noiseVibration.map((column) =>
    column.key === 'factorType' ? { ...column, options: [{ value: 'NOISE', label: 'Шум' }] } : column),
  VIBRATION: noiseVibration.map((column) =>
    column.key === 'factorType' ? { ...column, options: [{ value: 'VIBRATION', label: 'Вибрация' }] } : column),
  NOISE_VIBRATION: noiseVibration,
};

export const protocolResultColumns: Record<string, ProtocolResultColumn[]> = {
  industrial_emissions: industrialEmissions,
  water_wastewater: water,
  ambient_air: ambientAir,
  soil,
  physical_factors: microclimate,
  workplace_air: ambientAir,
  sanitary_hygiene: soil,
  vehicle_emissions: [],
};

export const getProtocolResultColumns = (templateId: string, subtype?: string): ProtocolResultColumn[] =>
  templateId === 'physical_factors'
    ? physicalColumns[(subtype || 'MICROCLIMATE') as ProtocolSubtype] || microclimate
    : protocolResultColumns[templateId] || [];

export const templateName = (templateId: string, fallback = '') =>
  protocolTemplates.find((template) => template.id === templateId)?.name || fallback || templateId;
