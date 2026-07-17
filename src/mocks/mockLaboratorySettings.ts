import type { LaboratoryEmployee, LaboratoryProfile } from '../types/protocols';

export const mockLaboratories: LaboratoryProfile[] = [{
  id: '1',
  name: 'Испытательная лаборатория Eco Progress',
  legalName: 'ТОО «Eco Progress»',
  bin: '123456789012',
  address: 'г. Шымкент',
  phone: '+7 7252 00 00 00',
  email: 'laboratory@ecoprogress.kz',
  accreditationNumber: 'KZ.T.00.0000',
  accreditationIssuedAt: '2025-01-01',
  accreditationValidUntil: '2028-01-01',
  directorId: '1',
  directorName: 'Администратор системы',
  laboratoryHeadId: '2',
  laboratoryHeadName: 'Заведующий лабораторией',
  logoUrl: '',
  standardNote: '',
  isDefault: true,
  active: true,
  employees: [],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}];

export const mockLaboratoryEmployees: Record<string, LaboratoryEmployee[]> = {
  '1': [
    { id: '1', laboratoryId: '1', userId: '1', fullName: 'Администратор системы', position: 'Директор', email: 'admin@ecoprogress.kz', role: 'DIRECTOR', active: true },
    { id: '2', laboratoryId: '1', userId: '2', fullName: 'Заведующий лабораторией', position: 'Заведующий', email: 'head@ecoprogress.kz', role: 'HEAD', active: true },
  ],
};

export const mockEligibleLaboratoryEmployees: LaboratoryEmployee[] = [
  ...mockLaboratoryEmployees['1'],
  { id: '3', userId: '3', fullName: 'Инженер-лаборант', position: 'Инженер', email: 'laboratory@ecoprogress.kz', role: 'LABORATORY', active: true },
];
