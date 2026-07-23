import type { ProtocolResultForm, ProtocolTemplateId } from '../../../types/protocols';
import { PROTOCOL_TEMPLATES } from '../utils/protocolTemplates';

export interface ProtocolValidationInput {
  templateId: ProtocolTemplateId | '';
  objectId: string | number | null;
  laboratoryId: string | number | null;
  executorId: string | number | null;
  sampleDate?: string;
  environment?: { humidity?: string | number | null };
  results: ProtocolResultForm[];
}

export type ProtocolValidationErrors = Record<string, string>;

const hasId = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== '';

export const validateProtocol = (values: ProtocolValidationInput): ProtocolValidationErrors => {
  const errors: ProtocolValidationErrors = {};
  if (!values.templateId) errors.templateId = 'Выберите тип протокола';
  if (!hasId(values.objectId)) errors.objectId = 'Выберите реальный объект компании';
  if (!hasId(values.laboratoryId)) errors.laboratoryId = 'Выберите лабораторию';
  if (!hasId(values.executorId)) errors.executorId = 'Выберите исполнителя лаборатории';

  const config = values.templateId ? PROTOCOL_TEMPLATES[values.templateId] : undefined;
  if (config?.requiresSample && !values.sampleDate?.trim()) errors.sampleDate = 'Укажите дату отбора пробы';

  const humidity = values.environment?.humidity;
  if (hasId(humidity) && (Number(humidity) < 0 || Number(humidity) > 100)) {
    errors['environment.humidity'] = 'Влажность должна быть от 0 до 100%';
  }

  values.results.forEach((result, index) => {
    if (!result.unit?.trim()) errors[`results.${index}.unit`] = 'Укажите единицу измерения';
    if (!result.normativeDocument?.trim() && !hasId(result.normativeValue) && !hasId(result.normativeMax) && !hasId(result.normativeMin)) {
      errors[`results.${index}.normative`] = 'Укажите норматив';
    }
    if (config?.requiresDevice && !hasId(result.measurementDeviceId)) {
      errors[`results.${index}.measurementDeviceId`] = 'Выберите прибор';
    }
  });
  return errors;
};
