import type { Pollutant, ProtocolSubtype } from '../types/protocols';

export const PHYSICAL_FACTOR_UNITS: Record<string, string> = {
  UV_A: 'Вт/м²',
  UV_B: 'Вт/м²',
  UV_C: 'Вт/м²',
  AIR_TEMPERATURE: '°C',
  HUMIDITY: '%',
  AIR_SPEED: 'м/с',
  THC_INDEX: '°C',
  NOISE: 'дБА',
  NOISE_LEVEL: 'дБА',
  NOISE_EQUIVALENT: 'дБА',
  NOISE_MAX: 'дБА',
  LIGHTING: 'лк',
  KEO: '%',
  LIGHT_PULSATION: '%',
  GLARE_INDEX: 'ед.',
  VIBRATION: 'м/с²',
  VIBRATION_SPEED: 'м/с',
  VIBRATION_ACCELERATION: 'м/с²',
  INFRASOUND_LEVEL: 'дБ',
  INFRASOUND_EQUIVALENT: 'дБ',
  ULTRASOUND_AIR: 'дБ',
  ULTRASOUND_CONTACT: 'дБ',
  EMF: 'В/м',
  ELECTRIC_FIELD: 'В/м',
  MAGNETIC_FIELD: 'А/м',
  MAGNETIC_FLUX_DENSITY: 'мкТл',
  ENERGY_FLUX_DENSITY: 'мкВт/см²',
  LASER: 'Дж/см²',
  LASER_ENERGY_EXPOSURE: 'Дж/см²',
  LASER_POWER_DENSITY: 'Вт/см²',
  AEROIONS: 'ион/см³',
  AEROIONS_POSITIVE: 'ион/см³',
  AEROIONS_NEGATIVE: 'ион/см³',
  UNIPOLARITY_COEFFICIENT: 'ед.',
};

export const physicalFactorIndicators: Record<ProtocolSubtype, Pollutant[]> = {
  MICROCLIMATE: [
    { code: 'AIR_TEMPERATURE', name: 'Температура воздуха', unit: '°C' },
    { code: 'HUMIDITY', name: 'Относительная влажность', unit: '%' },
    { code: 'AIR_SPEED', name: 'Скорость движения воздуха', unit: 'м/с' },
    { code: 'THC_INDEX', name: 'ТНС-индекс', unit: '°C' },
  ],
  LIGHTING: [
    { code: 'LIGHTING', name: 'Освещенность', unit: 'лк' },
    { code: 'KEO', name: 'Коэффициент естественной освещенности', unit: '%' },
    { code: 'LIGHT_PULSATION', name: 'Пульсация освещенности', unit: '%' },
    { code: 'GLARE_INDEX', name: 'Показатель ослепленности', unit: 'ед.' },
  ],
  NOISE: [
    { code: 'NOISE_LEVEL', name: 'Уровень шума', unit: 'дБА' },
    { code: 'NOISE_EQUIVALENT', name: 'Эквивалентный уровень шума', unit: 'дБА' },
    { code: 'NOISE_MAX', name: 'Максимальный уровень шума', unit: 'дБА' },
  ],
  VIBRATION: [
    { code: 'VIBRATION', name: 'Вибрация', unit: 'дБ' },
    { code: 'VIBRATION_SPEED', name: 'Виброскорость', unit: 'м/с' },
    { code: 'VIBRATION_ACCELERATION', name: 'Виброускорение', unit: 'м/с²' },
  ],
  NOISE_VIBRATION: [
    { code: 'NOISE_LEVEL', name: 'Уровень шума', unit: 'дБА' },
    { code: 'NOISE_EQUIVALENT', name: 'Эквивалентный уровень шума', unit: 'дБА' },
    { code: 'NOISE_MAX', name: 'Максимальный уровень шума', unit: 'дБА' },
    { code: 'VIBRATION', name: 'Вибрация', unit: 'дБ' },
    { code: 'VIBRATION_SPEED', name: 'Виброскорость', unit: 'м/с' },
    { code: 'VIBRATION_ACCELERATION', name: 'Виброускорение', unit: 'м/с²' },
  ],
  INFRASOUND: [
    { code: 'INFRASOUND_LEVEL', name: 'Уровень инфразвука', unit: 'дБ' },
    { code: 'INFRASOUND_EQUIVALENT', name: 'Эквивалентный уровень инфразвука', unit: 'дБ' },
  ],
  ULTRASOUND: [
    { code: 'ULTRASOUND_AIR', name: 'Ультразвук воздушный', unit: 'дБ' },
    { code: 'ULTRASOUND_CONTACT', name: 'Ультразвук контактный', unit: 'дБ' },
  ],
  UV: [
    { code: 'UV_A', name: 'Ультрафиолетовое излучение UVA', unit: 'Вт/м²' },
    { code: 'UV_B', name: 'Ультрафиолетовое излучение UVB', unit: 'Вт/м²' },
    { code: 'UV_C', name: 'Ультрафиолетовое излучение UVC', unit: 'Вт/м²' },
  ],
  AEROIONS: [
    { code: 'AEROIONS_POSITIVE', name: 'Положительные аэроионы', unit: 'ион/см³' },
    { code: 'AEROIONS_NEGATIVE', name: 'Отрицательные аэроионы', unit: 'ион/см³' },
    { code: 'UNIPOLARITY_COEFFICIENT', name: 'Коэффициент униполярности', unit: 'ед.' },
  ],
  ELECTROMAGNETIC_FIELD: [
    { code: 'ELECTRIC_FIELD', name: 'Напряженность электрического поля', unit: 'В/м' },
    { code: 'MAGNETIC_FIELD', name: 'Напряженность магнитного поля', unit: 'А/м' },
    { code: 'MAGNETIC_FLUX_DENSITY', name: 'Магнитная индукция', unit: 'мкТл' },
    { code: 'ENERGY_FLUX_DENSITY', name: 'Плотность потока энергии', unit: 'мкВт/см²' },
  ],
  LASER: [
    { code: 'LASER_ENERGY_EXPOSURE', name: 'Энергетическая экспозиция лазерного излучения', unit: 'Дж/см²' },
    { code: 'LASER_POWER_DENSITY', name: 'Плотность мощности лазерного излучения', unit: 'Вт/см²' },
  ],
};

export const getPhysicalFactorIndicators = (subtype?: string): Pollutant[] =>
  physicalFactorIndicators[(subtype || 'MICROCLIMATE') as ProtocolSubtype] || physicalFactorIndicators.MICROCLIMATE;

const normalizeSearch = (value: string) => value.trim().toLowerCase().replace(/ё/g, 'е');

export const filterPhysicalFactorIndicators = (query: string, subtype?: string): Pollutant[] => {
  const value = normalizeSearch(query);
  const indicators = getPhysicalFactorIndicators(subtype);
  if (!value) return indicators;
  return indicators.filter((item) => normalizeSearch(`${item.code} ${item.name}`).includes(value));
};
