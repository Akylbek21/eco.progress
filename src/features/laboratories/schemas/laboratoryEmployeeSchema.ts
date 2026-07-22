import type { LaboratoryEmployeeFormValues } from '../../../types/laboratories';
export const validateLaboratoryEmployee = (values: LaboratoryEmployeeFormValues) => ({
  ...(!values.userId && !values.fullName.trim() ? { fullName: 'Выберите пользователя или укажите ФИО' } : {}),
  ...(!values.position.trim() ? { position: 'Укажите должность' } : {}),
});
