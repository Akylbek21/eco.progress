import type { ProtocolResultColumn, ProtocolTemplate } from '../types/protocols';

export const protocolTemplates: ProtocolTemplate[] = [
  { id: 'industrial_emissions', name: 'Промышленные выбросы в атмосферу' },
  { id: 'water_wastewater', name: 'Вода / сточные воды' },
  { id: 'workplace_air', name: 'Воздух рабочей зоны' },
  { id: 'ambient_air', name: 'Атмосферный воздух' },
  { id: 'vehicle_emissions', name: 'Выбросы автотранспорта' },
  { id: 'physical_factors', name: 'Физические факторы' },
  { id: 'sanitary_hygiene', name: 'Санитарно-гигиенические исследования' },
];

export const physicalFactorTypes = ['шум', 'освещенность', 'температура', 'влажность', 'скорость движения воздуха', 'микроклимат'];

export const protocolResultColumns: Record<string, ProtocolResultColumn[]> = {
  industrial_emissions: [
    { key: 'samplingDate', label: 'Дата отбора проб', type: 'date' },
    { key: 'samplingPlace', label: 'Место отбора' },
    { key: 'sourceNumber', label: 'Номер источника загрязнения' },
    { key: 'indicator', label: 'Показатель', required: true },
    { key: 'temperature', label: 'Температура, °C', type: 'number' },
    { key: 'speed', label: 'Скорость, м/с', type: 'number' },
    { key: 'gasVolume', label: 'Объем газовоздушной смеси, нм3/с', type: 'number' },
    { key: 'ductArea', label: 'Площадь газохода, м2', type: 'number' },
    { key: 'mdvMg', label: 'ПДВ, мг/м3', type: 'number' },
    { key: 'mdvGs', label: 'ПДВ, г/с', type: 'number' },
    { key: 'resultMg', label: 'Результат, мг/м3', type: 'number' },
    { key: 'resultGs', label: 'Результат, г/с', type: 'number' },
  ],
  water_wastewater: [
    { key: 'object', label: 'Объект' },
    { key: 'indicator', label: 'Показатель', required: true },
    { key: 'testingMethodDocument', label: 'НД на метод испытаний' },
    { key: 'pds', label: 'ПДС, мг/дм3', type: 'number' },
    { key: 'result', label: 'Результат, мг/дм3', type: 'number' },
  ],
  workplace_air: [
    { key: 'samplingPlace', label: 'Место отбора' },
    { key: 'indicator', label: 'Показатель', required: true },
    { key: 'pdk', label: 'ПДК, мг/м3', type: 'number' },
    { key: 'result', label: 'Результат, мг/м3', type: 'number' },
  ],
  ambient_air: [
    { key: 'object', label: 'Объект' },
    { key: 'indicator', label: 'Показатель', required: true },
    { key: 'testingMethodDocument', label: 'НД на метод испытаний' },
    { key: 'pdkBackground', label: 'ПДК / фон' },
    { key: 'result', label: 'Результат' },
    { key: 'unit', label: 'Единица' },
  ],
  vehicle_emissions: [
    { key: 'vehicleModel', label: 'Модель автомобиля' },
    { key: 'plateNumber', label: 'Госномер' },
    { key: 'co', label: 'CO, %', type: 'number' },
    { key: 'ch', label: 'CH, ppm', type: 'number' },
    { key: 'smokeK', label: 'Дымность K, 1/м', type: 'number' },
    { key: 'smokeN', label: 'Дымность N, %', type: 'number' },
  ],
  physical_factors: [
    { key: 'measurementPlace', label: 'Место замера' },
    { key: 'workplace', label: 'Помещение / рабочее место' },
    { key: 'indicator', label: 'Показатель', required: true },
    { key: 'unit', label: 'Единица измерения' },
    { key: 'normative', label: 'Норматив' },
    { key: 'result', label: 'Результат' },
    { key: 'device', label: 'Прибор' },
    { key: 'verificationDate', label: 'Дата поверки', type: 'date' },
    { key: 'validUntil', label: 'Действует до', type: 'date' },
  ],
  sanitary_hygiene: [
    { key: 'samplingPlace', label: 'Место отбора' },
    { key: 'sampleName', label: 'Наименование пробы' },
    { key: 'indicator', label: 'Показатель', required: true },
    { key: 'testingMethodDocument', label: 'НД на метод испытаний' },
    { key: 'normative', label: 'Норматив' },
    { key: 'result', label: 'Результат' },
    { key: 'unit', label: 'Единица' },
  ],
};

export const templateName = (templateId: string, fallback = '') =>
  protocolTemplates.find((template) => template.id === templateId)?.name || fallback || templateId;
