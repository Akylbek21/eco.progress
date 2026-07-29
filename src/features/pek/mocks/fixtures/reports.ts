import type { PekReport, PekReportStatus, PekSectionSummary } from '../../api/pekContracts';
import { programActive } from './programs';

const sections: PekSectionSummary[] = [
  { code: 'GENERAL', label: 'Обзор', applicable: true, readinessPercent: 100, errorCount: 0, warningCount: 0, completed: true },
  { code: 'PROGRAM_EXECUTION', label: 'План/факт', applicable: true, readinessPercent: 75, errorCount: 1, warningCount: 1, completed: false },
  { code: 'EMISSIONS', label: 'Результаты', applicable: true, readinessPercent: 66, errorCount: 1, warningCount: 0, completed: false },
  { code: 'EXCEEDANCES', label: 'Превышения', applicable: true, readinessPercent: 50, errorCount: 0, warningCount: 1, completed: false },
  { code: 'DOCUMENTS', label: 'Документы', applicable: true, readinessPercent: 0, errorCount: 0, warningCount: 0, completed: false },
  { code: 'REVIEW', label: 'Согласование', applicable: true, readinessPercent: 0, errorCount: 0, warningCount: 0, completed: false },
];

const makeReport = (id: number, status: PekReportStatus, overrides: Partial<PekReport> = {}): PekReport => ({
  id, number: `ПЭК-ОТЧ-${id}`, revision: 1, version: 4, status,
  periodType: 'QUARTER', year: 2026, quarter: 2,
  periodStart: '2026-04-01', periodEnd: '2026-06-30', dueDate: '2026-08-15',
  company: programActive.company, object: programActive.object,
  program: { id: programActive.id, name: programActive.name, version: programActive.version },
  responsible: programActive.responsible, readinessPercent: 66, valid: false,
  blockingIssueCount: 1, warningCount: 2, exceedanceCount: 1, sections,
  availableActions: [
    { code: 'COLLECT', label: 'Собрать данные', enabled: true },
    { code: 'VALIDATE', label: 'Проверить готовность', enabled: true },
  ],
  readOnly: false, validationActual: false, blockingReasons: ['Отсутствует обязательный результат'],
  ...overrides,
});

export const reportDraft = makeReport(2001, 'DRAFT');
export const reportCollecting = makeReport(2002, 'COLLECTING');
export const reportValidationFailed = makeReport(2003, 'REQUIRES_CORRECTION');
export const reportOnReview = makeReport(2004, 'UNDER_REVIEW', {
  availableActions: [{ code: 'RETURN', label: 'Вернуть на доработку', enabled: true, requiresComment: true }, { code: 'ACCEPT_REVIEW', label: 'Завершить проверку', enabled: true }],
});
export const reportReturned = makeReport(2005, 'RETURNED', {
  availableActions: [{ code: 'EDIT', label: 'Исправить', enabled: true }, { code: 'SUBMIT_REVIEW', label: 'Повторно отправить', enabled: true }],
});
export const reportApproved = makeReport(2006, 'APPROVED', {
  readinessPercent: 100, valid: true, blockingIssueCount: 0, blockingReasons: [],
  availableActions: [{ code: 'PREPARE_SIGNING', label: 'Подготовить подписи', enabled: true }],
});
export const reportPartiallySigned = makeReport(2007, 'PARTIALLY_SIGNED', {
  readinessPercent: 100, valid: true, blockingIssueCount: 0, blockingReasons: [], readOnly: true,
  availableActions: [{ code: 'SIGN', label: 'Подписать', enabled: true }],
});
export const reportSigned = makeReport(2008, 'SIGNED', {
  readinessPercent: 100, valid: true, blockingIssueCount: 0, blockingReasons: [], readOnly: true,
  availableActions: [{ code: 'REGISTER_SUBMISSION', label: 'Зарегистрировать отправку', enabled: true }, { code: 'DOWNLOAD_PDF', label: 'Скачать PDF', enabled: true }],
});
export const reportSubmitted = makeReport(2009, 'SUBMITTED', { readOnly: true, availableActions: [{ code: 'REGISTER_RESULT', label: 'Зарегистрировать результат', enabled: true }] });
export const reportRejected = makeReport(2010, 'REJECTED', { readOnly: true, rejectionReason: 'Требуется уточнить сведения об источнике', availableActions: [{ code: 'CREATE_REVISION', label: 'Создать исправленную версию', enabled: true }] });

export const pekReportFixtures = [
  reportDraft, reportCollecting, reportValidationFailed, reportOnReview, reportReturned,
  reportApproved, reportPartiallySigned, reportSigned, reportSubmitted, reportRejected,
];
