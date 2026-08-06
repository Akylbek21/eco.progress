import { z } from 'zod';

export const pekProgramFormSchema = z.object({
  companyId: z.number().int().positive('Выберите компанию'),
  objectId: z.number().int().positive('Выберите объект'),
  number: z.string().trim().min(1, 'Укажите номер'),
  name: z.string().trim().min(1, 'Укажите название'),
  description: z.string().nullish(),
  validFrom: z.string().min(1, 'Укажите начало действия'),
  validUntil: z.string().min(1, 'Укажите окончание действия'),
  responsibleUserId: z.number().int().positive().nullish(),
  controlItems: z.array(z.object({
    clientId: z.string().min(1),
    code: z.string().min(1, 'Укажите код позиции'),
    name: z.string().min(1, 'Укажите название позиции'),
    controlType: z.string().trim().min(1, 'Укажите тип контроля'),
    frequencyType: z.string().trim().min(1, 'Укажите периодичность'),
    plannedCount: z.number().int().positive('Укажите плановое количество').nullish(),
    mandatory: z.boolean(),
    sortOrder: z.number(),
    active: z.boolean(),
  }).passthrough()),
  indicators: z.array(z.object({
    clientId: z.string().min(1),
    controlItemClientId: z.string().optional(),
    indicatorName: z.string().min(1, 'Укажите показатель'),
    unit: z.string().trim().min(1, 'Укажите единицу измерения'),
    comparisonType: z.string().trim().min(1, 'Укажите способ сравнения'),
    mandatory: z.boolean(),
    sortOrder: z.number(),
    normativeValue: z.number().nullable().optional(),
    minValue: z.number().nullable().optional(),
    maxValue: z.number().nullable().optional(),
  }).passthrough()),
  measures: z.array(z.object({
    clientId: z.string().min(1),
    code: z.string().trim().min(1, 'Укажите код мероприятия'),
    name: z.string().min(1, 'Укажите мероприятие'),
    plannedStartDate: z.string().nullable().optional(),
    plannedEndDate: z.string().min(1, 'Укажите срок мероприятия'),
    responsibleUserId: z.number().int().positive('Выберите ответственного'),
    plannedBudget: z.number().min(0, 'Бюджет не может быть отрицательным').nullable().optional(),
    completionPercent: z.number().min(0).max(100).nullable().optional(),
  }).passthrough()),
}).superRefine((value, context) => {
  if (value.validUntil < value.validFrom) context.addIssue({ code: 'custom', path: ['validUntil'], message: 'Дата окончания должна быть не раньше даты начала' });
  value.measures.forEach((measure, index) => {
    if (measure.plannedStartDate && (measure.plannedStartDate < value.validFrom || measure.plannedStartDate > value.validUntil)) {
      context.addIssue({ code: 'custom', path: ['measures', index, 'plannedStartDate'], message: 'Дата мероприятия должна входить в период программы' });
    }
    if (measure.plannedEndDate && (measure.plannedEndDate < value.validFrom || measure.plannedEndDate > value.validUntil)) {
      context.addIssue({ code: 'custom', path: ['measures', index, 'plannedEndDate'], message: 'Дата мероприятия должна входить в период программы' });
    }
    if (measure.plannedStartDate && measure.plannedEndDate && measure.plannedEndDate < measure.plannedStartDate) {
      context.addIssue({ code: 'custom', path: ['measures', index, 'plannedEndDate'], message: 'Окончание мероприятия раньше начала' });
    }
  });
  value.controlItems.forEach((item, index) => {
    if (item.frequencyType === 'PER_EVENT' && !item.plannedCount) {
      context.addIssue({ code: 'custom', path: ['controlItems', index, 'plannedCount'], message: 'Для контроля по событию укажите плановое количество' });
    }
    if (item.startDate && item.endDate && item.endDate < item.startDate) {
      context.addIssue({ code: 'custom', path: ['controlItems', index, 'endDate'], message: 'Окончание контроля не может быть раньше начала' });
    }
  });
  value.indicators.forEach((indicator, index) => {
    if (indicator.comparisonType === 'RANGE') {
      if (indicator.minValue == null || indicator.maxValue == null) {
        context.addIssue({ code: 'custom', path: ['indicators', index, 'minValue'], message: 'Для диапазона укажите минимум и максимум' });
      } else if (indicator.minValue > indicator.maxValue) {
        context.addIssue({ code: 'custom', path: ['indicators', index, 'maxValue'], message: 'Максимум должен быть не меньше минимума' });
      }
    }
    if (['MAX', 'MIN', 'EQUAL'].includes(indicator.comparisonType || '') && indicator.normativeValue == null) {
      context.addIssue({ code: 'custom', path: ['indicators', index, 'normativeValue'], message: 'Укажите нормативное значение' });
    }
  });
});
