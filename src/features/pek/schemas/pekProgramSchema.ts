import type { PekProgramRequest } from '../api/pekContracts';

export const validatePekProgram = (value: Partial<PekProgramRequest>) => {
  const errors: Record<string, string> = {};
  if (!value.companyId) errors.companyId = 'Выберите компанию';
  if (!value.objectId) errors.objectId = 'Выберите объект компании';
  if (!value.number?.trim()) errors.number = 'Укажите номер программы';
  if (!value.name?.trim()) errors.name = 'Укажите название программы';
  if (!value.validFrom) errors.validFrom = 'Укажите начало действия';
  if (!value.validUntil) errors.validUntil = 'Укажите окончание действия';
  if (value.validFrom && value.validUntil && value.validFrom > value.validUntil) errors.validUntil = 'Дата окончания должна быть позже даты начала';
  if (!value.controlItems?.length) errors.controlItems = 'Добавьте хотя бы одну позицию контроля';
  return errors;
};
