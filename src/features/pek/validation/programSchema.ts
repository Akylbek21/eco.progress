import { z } from 'zod';

const controlTypes = ['EMISSION', 'AMBIENT_AIR', 'WATER_INTAKE', 'WASTEWATER', 'WASTE', 'SOIL', 'PHYSICAL_FACTOR', 'BIODIVERSITY'] as const;
const periodicities = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'PER_EVENT'] as const;
const comparisonTypes = ['LESS_OR_EQUAL', 'GREATER_OR_EQUAL', 'RANGE', 'BETWEEN', 'EQUAL', 'ABSENT', 'INFO'] as const;
const actionStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED'] as const;

export const pekProgramFormSchema = z.object({
  companyId: z.number().int().positive('Выберите компанию'),
  objectId: z.number().int().positive('Выберите объект'),
  number: z.string().trim().min(1, 'Укажите номер'),
  name: z.string().trim().min(1, 'Укажите название'),
  description: z.string().nullish(),
  validFrom: z.string().min(1, 'Укажите начало действия'),
  validUntil: z.string().min(1, 'Укажите окончание действия'),
  responsibleUserId: z.number().int().positive().nullish(),
  facilityInformation: z.string().nullish(),
  kato: z.string().nullish(),
  bin: z.string().refine((value) => !value || /^\d{12}$/.test(value), 'БИН должен содержать 12 цифр').nullish(),
  oked: z.string().nullish(),
  environmentalCategory: z.string().nullish(),
  designCapacity: z.string().nullish(),
  productionCharacteristics: z.string().nullish(),
  monitoringScope: z.string().nullish(),
  internalInspectionProcedure: z.string().nullish(),
  measurementQualityAssurance: z.string().nullish(),
  emergencyProcedures: z.string().nullish(),
  responsibilityMatrix: z.string().nullish(),
  permitIds: z.array(z.number().int().positive()).optional(),
  readinessNotes: z.string().nullish(),
  controlItems: z.array(z.object({
    clientId: z.string().min(1),
    code: z.string().min(1, 'Укажите код позиции'),
    name: z.string().min(1, 'Укажите название позиции'),
    controlType: z.enum(controlTypes, { message: 'Укажите тип контроля' }),
    frequencyType: z.enum(periodicities, { message: 'Укажите периодичность' }),
    plannedCount: z.number().int().positive('Укажите плановое количество').nullish(),
    mandatory: z.boolean(),
    sortOrder: z.number(),
    active: z.boolean(),
  }).passthrough()).min(1, 'Добавьте хотя бы одну позицию контроля'),
  indicators: z.array(z.object({
    clientId: z.string().min(1),
    controlItemClientId: z.string().optional(),
    indicatorName: z.string().min(1, 'Укажите показатель'),
    unit: z.string().trim().min(1, 'Укажите единицу измерения'),
    comparisonType: z.enum(comparisonTypes, { message: 'Укажите способ сравнения' }),
    mandatory: z.boolean(),
    sortOrder: z.number(),
    normativeValue: z.number().nullable().optional(),
    minValue: z.number().nullable().optional(),
    maxValue: z.number().nullable().optional(),
  }).passthrough()).min(1, 'Добавьте хотя бы один показатель'),
  measures: z.array(z.object({
    clientId: z.string().min(1),
    code: z.string().trim().min(1, 'Укажите код мероприятия'),
    name: z.string().min(1, 'Укажите мероприятие'),
    plannedStartDate: z.string().nullable().optional(),
    plannedEndDate: z.string().min(1, 'Укажите срок мероприятия'),
    responsibleUserId: z.number().int().positive('Выберите ответственного'),
    plannedBudget: z.number().min(0, 'Бюджет не может быть отрицательным').nullable().optional(),
    completionPercent: z.number().min(0).max(100).nullable().optional(),
    status: z.enum(actionStatuses).nullable().optional(),
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
    if (item.startDate && (item.startDate < value.validFrom || item.startDate > value.validUntil)) {
      context.addIssue({ code: 'custom', path: ['controlItems', index, 'startDate'], message: 'Дата позиции должна входить в период программы' });
    }
    if (item.endDate && (item.endDate < value.validFrom || item.endDate > value.validUntil)) {
      context.addIssue({ code: 'custom', path: ['controlItems', index, 'endDate'], message: 'Дата позиции должна входить в период программы' });
    }
    if (!value.indicators.some((indicator) => indicator.controlItemClientId === item.clientId || (indicator.controlItemId && indicator.controlItemId === item.id))) {
      context.addIssue({ code: 'custom', path: ['controlItems', index, 'name'], message: 'Добавьте хотя бы один показатель для позиции' });
    }
  });
  value.indicators.forEach((indicator, index) => {
    if (indicator.comparisonType === 'RANGE' || indicator.comparisonType === 'BETWEEN') {
      if (indicator.minValue == null || indicator.maxValue == null) {
        context.addIssue({ code: 'custom', path: ['indicators', index, 'minValue'], message: 'Для диапазона укажите минимум и максимум' });
      } else if (indicator.minValue > indicator.maxValue) {
        context.addIssue({ code: 'custom', path: ['indicators', index, 'maxValue'], message: 'Максимум должен быть не меньше минимума' });
      }
    }
    if (['LESS_OR_EQUAL', 'GREATER_OR_EQUAL', 'EQUAL'].includes(indicator.comparisonType || '') && indicator.normativeValue == null) {
      context.addIssue({ code: 'custom', path: ['indicators', index, 'normativeValue'], message: 'Укажите нормативное значение' });
    }
  });
});
