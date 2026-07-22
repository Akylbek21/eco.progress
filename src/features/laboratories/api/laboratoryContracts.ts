export type { AccreditationStatus, CreateLaboratoryRequest, LaboratoriesQuery, Laboratory, LaboratoryApiDto, LaboratoryEmployee, LaboratoryEmployeeFormValues, LaboratoryFormValues, PageResponse, UpdateLaboratoryRequest } from '../../../types/laboratories';

export const laboratoryCapabilities = {
  serverPagination: false,
  employeeRestore: false,
  employeePermissions: true,
  logoRemove: true,
} as const;
