import type { NormativeRecord } from '../types/protocols';

const normative = (
  id: string,
  templateId: NormativeRecord['templateId'],
  indicator: string,
  unit: string,
  value: string,
  comparisonType: NormativeRecord['comparisonType'] = 'LESS_OR_EQUAL',
  min?: string,
  max?: string,
): NormativeRecord => ({
  id,
  templateId,
  researchObject: 'Производственный экологический контроль',
  indicator,
  unit,
  normativeType: 'ПДК',
  value,
  min,
  max,
  comparisonType,
  normativeDocument: 'Экологический кодекс РК и действующие санитарные правила',
  testingMethod: 'Методика выполнения измерений согласно области аккредитации',
  samplingMethod: 'Отбор проб согласно НД',
  validFrom: '2025-01-01',
  active: true,
});

export const mockNormatives: NormativeRecord[] = [
  normative('n-no2', 'industrial_emissions', 'Диоксид азота', 'мг/м³', '200'),
  normative('n-no', 'industrial_emissions', 'Оксид азота', 'мг/м³', '400'),
  normative('n-so2', 'industrial_emissions', 'Диоксид серы', 'мг/м³', '500'),
  normative('n-co', 'industrial_emissions', 'Оксид углерода', 'мг/м³', '250'),
  ...['Взвешенные вещества', 'БПК', 'ХПК', 'Азот аммонийный', 'Нитриты', 'Нитраты', 'Фосфаты', 'ПАВ', 'Сульфаты', 'Хлориды', 'Жиры']
    .map((name, index) => normative(`n-water-${index}`, 'water_wastewater', name, 'мг/дм³', String([15, 6, 30, 2, 0.08, 40, 3.5, 0.5, 100, 300, 1][index]))),
  normative('n-air-no2', 'ambient_air', 'Диоксид азота', 'мг/м³', '0.2'),
  normative('n-air-so2', 'ambient_air', 'Диоксид серы', 'мг/м³', '0.5'),
  normative('n-air-co', 'ambient_air', 'Оксид углерода', 'мг/м³', '5'),
  normative('n-temp', 'physical_factors', 'Температура', '°C', '', 'RANGE', '18', '26'),
  normative('n-humidity', 'physical_factors', 'Влажность', '%', '', 'RANGE', '30', '60'),
  normative('n-speed', 'physical_factors', 'Скорость движения воздуха', 'м/с', '0.5'),
  normative('n-light', 'physical_factors', 'Освещённость', 'лк', '300', 'GREATER_OR_EQUAL'),
  normative('n-noise', 'physical_factors', 'Уровень звука', 'дБА', '80'),
  normative('n-vibration', 'physical_factors', 'Виброускорение', 'дБ', '112'),
  normative('n-soil-as', 'soil', 'Мышьяк', 'мг/кг', '2.0'),
  normative('n-soil-pb', 'soil', 'Свинец', 'мг/кг', '32.0'),
  normative('n-soil-oil', 'soil', 'Нефтепродукты', 'мг/кг', '0.3'),
];

