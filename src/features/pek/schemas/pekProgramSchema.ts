import type { PekProgramRequest } from '../api/pekContracts';

export const validatePekProgram = (value: Partial<PekProgramRequest>) => {
  const errors: Record<string, string> = {};
  if (!Number.isInteger(value.companyId) || Number(value.companyId) <= 0) errors.companyId = 'Выберите компанию';
  if (!Number.isInteger(value.objectId) || Number(value.objectId) <= 0) errors.objectId = 'Выберите сохранённый объект компании';
  if (!value.number?.trim()) errors.number = 'Укажите номер программы';
  if (!value.name?.trim()) errors.name = 'Укажите название программы';
  if (!value.validFrom) errors.validFrom = 'Укажите начало действия';
  if (!value.validUntil) errors.validUntil = 'Укажите окончание действия';
  if (value.validFrom && value.validUntil && value.validFrom > value.validUntil) errors.validUntil = 'Дата окончания должна быть позже даты начала';
  if (!value.controlItems?.length) errors.controlItems = 'Добавьте хотя бы одну позицию контроля';
  value.controlItems?.forEach((item,index)=>{
    if (!String(item.sectionType||'').trim()) errors[`controlItems.${index}.sectionType`] = `Строка ${index+1}: выберите раздел`;
    if (!String(item.controlType||'').trim()) errors[`controlItems.${index}.controlType`] = `Строка ${index+1}: выберите тип контроля`;
    if (!String(item.sourceName||'').trim()) errors[`controlItems.${index}.sourceName`] = `Строка ${index+1}: укажите точку или источник`;
    if (!String(item.frequencyType||'').trim()) errors[`controlItems.${index}.frequencyType`] = `Строка ${index+1}: выберите периодичность`;
  });
  value.indicators?.forEach((item,index)=>{
    if (!String(item.indicatorName||'').trim()) errors[`indicators.${index}.indicatorName`] = `Показатель ${index+1}: укажите наименование`;
    if (!String(item.unit||'').trim()) errors[`indicators.${index}.unit`] = `Показатель ${index+1}: укажите единицу`;
  });
  value.measures?.forEach((item,index)=>{
    if (!String(item.name||'').trim()) errors[`measures.${index}.name`] = `Мероприятие ${index+1}: укажите наименование`;
    if (!String(item.deadline||'').trim()) errors[`measures.${index}.deadline`] = `Мероприятие ${index+1}: укажите срок`;
  });
  return errors;
};
