import type { LaboratoryDetails, LaboratoryEmployee } from '../types/laboratories';

export const mockLaboratories: LaboratoryDetails[] = [{
  id: 1, name: 'Испытательная лаборатория Eco Progress', shortName: 'Eco Progress', legalName: 'ТОО «Eco Progress»', bin: '123456789012', address: 'г. Шымкент',
  phone: '+7 7252 00 00 00', email: 'laboratory@ecoprogress.kz', accreditationNumber: 'KZ.T.00.0000', accreditationValidFrom: '2025-01-01', accreditationIssuedAt: '2025-01-01', accreditationValidUntil: '2028-01-01', accreditationStatus: 'VALID',
  directorEmployeeId: 1, directorId: 1, directorName: 'Администратор системы', headEmployeeId: 2, laboratoryHeadId: 2, laboratoryHeadName: 'Заведующий лабораторией', logoUrl: '', notes: '', standardNote: '',
  defaultLaboratory: true, isDefault: true, active: true, archived: false, employeesCount: 2, activeEmployeesCount: 2, employees: [], createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
}];

export const mockLaboratoryEmployees: Record<string, LaboratoryEmployee[]> = {
  '1': [
    { id: 1, laboratoryId: 1, userId: 1, fullName: 'Администратор системы', position: 'Директор', email: 'admin@ecoprogress.kz', canExecuteMeasurements: false, canApproveProtocols: true, canSignProtocols: true, active: true },
    { id: 2, laboratoryId: 1, userId: 2, fullName: 'Заведующий лабораторией', position: 'Заведующий', email: 'head@ecoprogress.kz', canExecuteMeasurements: true, canApproveProtocols: true, canSignProtocols: true, active: true },
  ],
};

export const mockEligibleLaboratoryEmployees: LaboratoryEmployee[] = [
  ...mockLaboratoryEmployees['1'],
  { id: 3, laboratoryId: 0, userId: 3, fullName: 'Инженер-лаборант', position: 'Инженер', email: 'laboratory@ecoprogress.kz', canExecuteMeasurements: true, canApproveProtocols: false, canSignProtocols: false, active: true },
];
