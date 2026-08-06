import type { ProtocolSubtype } from '../../../types/protocols';

export const protocolFactorTypeOptions: Array<{ value: ProtocolSubtype; label: string }> = [
  { value: 'MICROCLIMATE', label: 'Микроклимат' },
  { value: 'LIGHTING', label: 'Освещение' },
  { value: 'NOISE', label: 'Шум' },
  { value: 'VIBRATION', label: 'Вибрация' },
  { value: 'INFRASOUND', label: 'Инфразвук' },
  { value: 'ULTRASOUND', label: 'Ультразвук' },
  { value: 'UV', label: 'Ультрафиолетовое излучение' },
  { value: 'AEROIONS', label: 'Аэроионы' },
  { value: 'ELECTROMAGNETIC_FIELD', label: 'Электромагнитное поле' },
  { value: 'LASER', label: 'Лазерное излучение' },
];
