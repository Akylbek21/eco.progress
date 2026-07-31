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
  }).passthrough()),
  measures: z.array(z.object({
    clientId: z.string().min(1),
    name: z.string().min(1, 'Укажите мероприятие'),
  }).passthrough()),
}).refine((value) => value.validUntil >= value.validFrom, {
  path: ['validUntil'],
  message: 'Дата окончания должна быть не раньше даты начала',
});
