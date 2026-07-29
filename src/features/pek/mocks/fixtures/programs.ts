import type { PekProgram } from '../../api/pekContracts';

const company = { id: 101, name: 'ТОО «ЭкоПром Казахстан»', bin: '120340012345' };
const object = { id: 201, name: 'Производственная площадка №1', address: 'г. Алматы, Промышленная зона, 12' };
const responsible = { id: 301, name: 'Айгуль Сарсенова' };

export const programDraft: PekProgram = {
  id: 1001, number: 'ПЭК-2026-001', name: 'Программа ПЭК основной площадки',
  version: 3, status: 'DRAFT', company, object, responsible,
  validFrom: '2026-01-01', validUntil: '2026-12-31', readinessPercent: 72,
  updatedAt: '2026-07-29T09:20:00+05:00', readOnly: false,
  availableActions: [
    { code: 'EDIT', label: 'Редактировать', enabled: true },
    { code: 'ACTIVATE', label: 'Активировать', enabled: false, disabledReason: 'Устраните блокирующие ошибки' },
  ],
  controlItems: [{ id: 4001, name: 'Контроль выбросов котельной' }],
  indicators: [{ id: 5001, name: 'Диоксид азота', unit: 'мг/м³' }],
  measures: [],
  documents: [],
};

export const programActive: PekProgram = {
  ...programDraft, id: 1002, number: 'ПЭК-2025-004', version: 7, status: 'ACTIVE',
  readinessPercent: 100, readOnly: true,
  availableActions: [{ code: 'CLONE', label: 'Создать копию', enabled: true }, { code: 'ARCHIVE', label: 'Архивировать', enabled: true }],
};

export const programExpired: PekProgram = {
  ...programActive, id: 1003, number: 'ПЭК-2024-002',
  validFrom: '2024-01-01', validUntil: '2024-12-31',
};

export const programArchived: PekProgram = {
  ...programExpired, id: 1004, status: 'ARCHIVED', readOnly: true,
  availableActions: [{ code: 'CLONE', label: 'Создать копию', enabled: true }],
};

export const pekProgramFixtures = [programDraft, programActive, programExpired, programArchived];
