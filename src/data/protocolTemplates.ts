import type { ProtocolResultColumn, ProtocolTemplate, ProtocolSubtype } from '../types/protocols';

export const protocolTemplates: ProtocolTemplate[] = [
  { id: 'industrial_emissions', name: 'Промышленные выбросы', description: 'Ф 01' },
  { id: 'water', name: 'Вода', description: 'Протокол исследования воды' },
  { id: 'water_wastewater', name: 'Вода и сточные воды', description: 'Ф 02' },
  { id: 'ambient_air', name: 'Воздух СЗЗ', description: 'Ф 03' },
  { id: 'workplace_air', name: 'Воздух рабочей зоны', description: 'Ф 03' },
  { id: 'physical_factors', name: 'Физические факторы', description: 'Ф 04' },
  { id: 'microclimate', name: 'Микроклимат', description: 'Физические факторы' },
  { id: 'lighting', name: 'Освещенность', description: 'Физические факторы' },
  { id: 'noise_vibration', name: 'Шум / вибрация', description: 'Физические факторы' },
  { id: 'uv_emf_laser', name: 'УФ / ЭМП / Лазер', description: 'Физические факторы' },
  { id: 'soil', name: 'Почва', description: 'Протокол исследования почвы' },
  { id: 'food_products', name: 'Пищевые продукты', description: 'ДСМ-70' },
  { id: 'surfaces', name: 'Поверхности', description: 'ДСМ-70' },
  { id: 'udmh_special', name: 'Компоненты ракетного топлива', description: 'ДСМ-70' },
];

export const physicalFactorTypes: Array<{ value: ProtocolSubtype; label: string }> = [
  { value: 'MICROCLIMATE', label: 'Микроклимат' },
  { value: 'LIGHTING', label: 'Освещённость' },
  { value: 'NOISE', label: 'Шум' },
  { value: 'VIBRATION', label: 'Вибрация' },
  { value: 'NOISE_VIBRATION', label: 'Шум и вибрация' },
  { value: 'INFRASOUND', label: 'Инфразвук' },
  { value: 'ULTRASOUND', label: 'Ультразвук' },
  { value: 'UV', label: 'Ультрафиолет' },
  { value: 'AEROIONS', label: 'Аэроионы' },
  { value: 'ELECTROMAGNETIC_FIELD', label: 'ЭМП' },
  { value: 'LASER', label: 'Лазерное излучение' },
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
  INFRASOUND: noiseVibration.map((column) =>
    column.key === 'factorType' ? { ...column, options: [{ value: 'INFRASOUND', label: 'Инфразвук' }] } : column),
  ULTRASOUND: noiseVibration.map((column) =>
    column.key === 'factorType' ? { ...column, options: [{ value: 'ULTRASOUND', label: 'Ультразвук' }] } : column),
  UV: lighting,
  AEROIONS: lighting,
  ELECTROMAGNETIC_FIELD: noiseVibration.map((column) =>
    column.key === 'factorType' ? { ...column, options: [{ value: 'ELECTROMAGNETIC_FIELD', label: 'ЭМП' }] } : column),
  LASER: lighting,
};

const physicalTemplateSubtypes: Record<string, ProtocolSubtype> = {
  physical_factors: 'MICROCLIMATE',
  microclimate: 'MICROCLIMATE',
  lighting: 'LIGHTING',
  noise_vibration: 'NOISE_VIBRATION',
};

const templateDisplayNames: Record<string, string> = {
  ambient_air: 'Атмосферный воздух',
  workplace_air: 'Воздух рабочей зоны',
  water: 'Вода',
  microclimate: 'Микроклимат',
  lighting: 'Освещённость',
  noise_vibration: 'Шум / вибрация',
  uv_emf_laser: 'УФ / ЭМП / Лазер',
  food_products: 'Пищевые продукты',
  surfaces: 'Поверхности',
  udmh_special: 'Компоненты ракетного топлива',
};

export const protocolResultColumns: Record<string, ProtocolResultColumn[]> = {
  industrial_emissions: industrialEmissions,
  water,
  water_wastewater: water,
  ambient_air: ambientAir,
  soil,
  food_products: soil,
  surfaces: soil,
  udmh_special: ambientAir,
  physical_factors: microclimate,
  microclimate,
  lighting,
  noise_vibration: noiseVibration,
  uv_emf_laser: lighting,
  workplace_air: ambientAir,
  sanitary_hygiene: soil,
  vehicle_emissions: [],
};

export const getProtocolResultColumns = (templateId: string, subtype?: string): ProtocolResultColumn[] => {
  const defaultPhysicalSubtype = physicalTemplateSubtypes[templateId];
  return defaultPhysicalSubtype
    ? physicalColumns[(subtype || defaultPhysicalSubtype) as ProtocolSubtype] || microclimate
    : protocolResultColumns[templateId] || [];
};

export const templateName = (templateId: string, fallback = '') =>
  protocolTemplates.find((template) => template.id === templateId)?.name || templateDisplayNames[templateId] || fallback || templateId;
