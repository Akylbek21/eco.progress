import type { Pollutant, ProtocolSubtype } from '../types/protocols';

export const physicalFactorIndicators: Record<ProtocolSubtype, Pollutant[]> = {
  LIGHTING: [
    { code: 'LIGHTING', name: 'Освещённость', unit: 'лк' },
    { code: 'KEO', name: 'Коэффициент естественной освещённости', unit: '%' },
    { code: 'LIGHT_PULSATION', name: 'Пульсация освещённости', unit: '%' },
  ],
  MICROCLIMATE: [
    { code: 'AIR_TEMPERATURE', name: 'Температура воздуха', unit: '°C' },
    { code: 'HUMIDITY', name: 'Относительная влажность', unit: '%' },
    { code: 'AIR_SPEED', name: 'Скорость движения воздуха', unit: 'м/с' },
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
};

export const getPhysicalFactorIndicators = (subtype?: string): Pollutant[] =>
  physicalFactorIndicators[(subtype || 'MICROCLIMATE') as ProtocolSubtype] || physicalFactorIndicators.MICROCLIMATE;

export const filterPhysicalFactorIndicators = (query: string, subtype?: string): Pollutant[] => {
  const value = query.trim().toLowerCase();
  const indicators = getPhysicalFactorIndicators(subtype);
  if (!value) return indicators;
  return indicators.filter((item) => `${item.code} ${item.name}`.toLowerCase().includes(value));
};
