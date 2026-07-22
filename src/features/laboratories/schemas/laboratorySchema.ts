import type { LaboratoryFormValues } from '../../../types/laboratories';
export type LaboratoryValidationErrors = Partial<Record<keyof LaboratoryFormValues, string>>;
export function validateLaboratoryForm(values: LaboratoryFormValues): LaboratoryValidationErrors {
  const errors: LaboratoryValidationErrors = {};
  if (!values.name.trim()) errors.name = 'Укажите название';
  if (!values.address.trim()) errors.address = 'Укажите адрес';
  if (values.bin && !/^\d{12}$/.test(values.bin.trim())) errors.bin = 'БИН должен содержать 12 цифр';
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Проверьте email';
  if (values.website) { try { new URL(values.website); } catch { errors.website = 'Укажите корректный URL'; } }
  if (values.accreditationIssuedAt && values.accreditationValidUntil && values.accreditationValidUntil < values.accreditationIssuedAt) errors.accreditationValidUntil = 'Дата окончания не может быть раньше даты выдачи';
  if (values.accreditationNumber.trim() && !values.accreditationValidUntil) errors.accreditationValidUntil = 'Укажите срок действия аттестата';
  return errors;
}
