import type { LaboratoryDetails, LaboratoryEmployee } from '../types/laboratories';

export const mockLaboratories: LaboratoryDetails[] = [{
  id: 1,
  version: 1,
  name: 'Испытательная лаборатория Eco Progress',
  shortName: 'Eco Progress',
  legalName: 'ТОО «Eco Progress»',
  bin: '123456789012',
  address: 'г. Шымкент',
  city: 'Шымкент',
  phone: '+7 7252 00 00 00',
  email: 'laboratory@ecoprogress.kz',
  accreditationNumber: 'KZ.T.00.0000',
  accreditationIssuedAt: '2025-01-01',
  accreditationValidUntil: '2028-01-01',
  accreditationStatus: 'VALID',
  directorId: 1,
  directorName: 'Администратор системы',
  laboratoryHeadId: 2,
  laboratoryHeadName: 'Заведующий лабораторией',
  logoUrl: '',
  standardNote: '',
  isDefault: true,
  active: true,
  employeesCount: 2,
  devicesCount: 0,
  protocolsCount: 0,
  employees: [],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}];

export const mockLaboratoryEmployees: Record<string, LaboratoryEmployee[]> = {
  '1': [
    { id: 1, laboratoryId: 1, userId: 1, fullName: 'Администратор системы', position: 'Директор', email: 'admin@ecoprogress.kz', phone: '', employeeNumber: '001', qualification: '', role: 'DIRECTOR', canExecuteMeasurements: false, canApproveProtocols: true, canSignProtocols: true, active: true },
    { id: 2, laboratoryId: 1, userId: 2, fullName: 'Заведующий лабораторией', position: 'Заведующий', email: 'head@ecoprogress.kz', phone: '', employeeNumber: '002', qualification: '', role: 'LABORATORY_HEAD', canExecuteMeasurements: true, canApproveProtocols: true, canSignProtocols: true, active: true },
  ],
};

export const mockEligibleLaboratoryEmployees: LaboratoryEmployee[] = [
  ...mockLaboratoryEmployees['1'],
  { id: 3, laboratoryId: 0, userId: 3, fullName: 'Инженер-лаборант', position: 'Инженер', email: 'laboratory@ecoprogress.kz', phone: '', employeeNumber: '003', qualification: '', role: 'LABORATORY_EMPLOYEE', canExecuteMeasurements: true, canApproveProtocols: false, canSignProtocols: false, active: true },
];
