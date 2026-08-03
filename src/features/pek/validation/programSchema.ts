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
    mandatory: z.boolean(),
    sortOrder: z.number(),
    active: z.boolean(),
  }).passthrough()),
  indicators: z.array(z.object({
    clientId: z.string().min(1),
    controlItemClientId: z.string().optional(),
    indicatorName: z.string().min(1, 'Укажите показатель'),
    mandatory: z.boolean(),
    sortOrder: z.number(),
    normativeValue: z.number().nullable().optional(),
    minValue: z.number().nullable().optional(),
    maxValue: z.number().nullable().optional(),
  }).passthrough()),
  measures: z.array(z.object({
    clientId: z.string().min(1),
    name: z.string().min(1, 'Укажите мероприятие'),
    plannedStartDate: z.string().nullable().optional(),
    plannedEndDate: z.string().nullable().optional(),
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
});
