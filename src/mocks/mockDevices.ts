import type { MeasurementDevice } from '../types/protocols';

export const mockDevices: MeasurementDevice[] = [
  ['device-dag', 'Газоанализатор ДАГ-510', 'ДАГ-510', '510-24018', 'ПВ-2026/0184', '2026-02-12', '2027-02-12', 'мг/м³', 'VALID'],
  ['device-pito', 'Трубка Пито', 'Пито-2', 'ТП-1198', 'ПВ-2025/4451', '2025-09-18', '2026-09-18', 'м/с', 'EXPIRING'],
  ['device-barometer', 'Барометр-анероид М-67', 'М-67', 'БА-7721', 'ПВ-2026/0201', '2026-01-25', '2027-01-25', 'кПа', 'VALID'],
  ['device-anemometer', 'Анемометр МС-13', 'МС-13', 'АМ-3044', 'ПВ-2025/5012', '2025-08-30', '2026-08-30', 'м/с', 'EXPIRING'],
  ['device-thermometer', 'Термометр ТЛ-2', 'ТЛ-2', 'Т-99104', 'ПВ-2026/0310', '2026-03-10', '2027-03-10', '°C', 'VALID'],
  ['device-lux', 'Люксметр', 'ТКА-ПКМ 31', 'ЛК-6620', 'ПВ-2026/0109', '2026-01-09', '2027-01-09', 'лк', 'VALID'],
  ['device-noise', 'Шумомер-виброметр', 'Экофизика-110А', 'ШВ-4419', 'ПВ-2026/0077', '2026-01-05', '2027-01-05', 'дБ', 'VALID'],
  ['device-ph', 'рН-метр', 'рН-150МИ', 'PH-20318', 'ПВ-2025/2130', '2025-05-20', '2026-05-20', 'pH', 'EXPIRED'],
  ['device-colorimeter', 'Фотоэлектроколориметр', 'КФК-3', 'КФК-8042', 'ПВ-2026/0411', '2026-04-11', '2027-04-11', 'мг/дм³', 'VALID'],
].map(([id, name, model, serialNumber, certificate, verificationDate, verificationValidUntil, units, status]) => ({
  id,
  name,
  model,
  serialNumber,
  verificationCertificateNumber: certificate,
  verificationDate,
  verificationValidUntil,
  units,
  status: status as MeasurementDevice['status'],
}));

export const mockLaboratory = {
  laboratoryName: 'ТОО «Tumar Construction Group» — Испытательная лаборатория',
  laboratoryAddress: 'г. Шымкент, ул. Алимбетова, 199/2',
  accreditationNumber: 'KZ.T.16.2936',
  accreditationValidUntil: '2028-12-31',
  director: 'Тулегенов Е.А.',
  laboratoryHead: 'Дуйсенбай Р.С.',
  executor: 'Маханова К.М.',
};
