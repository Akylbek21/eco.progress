import type { FieldPath, UseFormReturn } from 'react-hook-form';
import type { ProtocolWizardForm } from '../components/wizardTypes';

export type ProtocolValidationStep = 'BASIC' | 'CONDITIONS' | 'RESULTS' | 'REVIEW' | 'COMPLETION';

export type ProtocolFieldErrorDto = {
  field?: string;
  step?: ProtocolValidationStep | string;
  message?: string;
  rowIndex?: number;
};

export type ProtocolFormIssue = {
  field: FieldPath<ProtocolWizardForm> | null;
  fieldPath: string;
  step: number;
  message: string;
  rowIndex?: number;
};

const stepIndexes: Record<ProtocolValidationStep, number> = {
  BASIC: 0,
  CONDITIONS: 1,
  RESULTS: 2,
  REVIEW: 3,
  COMPLETION: 4,
};

const normalizePath = (value: string, rowIndex?: number) => {
  let path = value.trim()
    .replace(/^header\./, '')
    .replace(/^measurements\./, 'results.')
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/^conditions\./, '');
  if (rowIndex != null && !/^results\.\d+\./.test(path)) path = `results.${rowIndex}.${path}`;
  return path;
};

const inferStep = (field: string) => {
  if (/^results\./.test(field)) return 2;
  if (/laboratory|executor|device|season|workCategory|workplaceType|roomType|lightingType|noiseType|visualWorkCategory|normLevel|waterType|waterUseCategory|temperature|humidity|pressure|wind|method/i.test(field)) return 1;
  if (/company|object|template|protocolDate|measurementDate|measurementPlace|order|pek/i.test(field)) return 0;
  return 3;
};

const friendlyMessage = (message: string) => {
  if (/PROTOCOL_VERSION_CONFLICT|optimistic|version conflict/i.test(message)) return 'Протокол изменён другим сотрудником. Обновите данные перед продолжением.';
  if (/403|forbidden|canSign|sign permission/i.test(message)) return 'У вас нет права подписывать протокол. Передайте его руководителю.';
  if (/INTERNAL_SCHEMA_ERROR|schema mismatch|DTO|quick-create|unknown enum/i.test(message)) return 'Не удалось сохранить протокол. Проверьте выделенные поля.';
  return message.trim() || 'Проверьте значение поля.';
};

export const mapProtocolApiErrorsToForm = (
  input: ProtocolFieldErrorDto[] | Record<string, string> | null | undefined,
): ProtocolFormIssue[] => {
  const items: ProtocolFieldErrorDto[] = Array.isArray(input)
    ? input
    : Object.entries(input ?? {}).map(([field, message]) => ({ field, message }));
  return items.map((item) => {
    const fieldPath = normalizePath(item.field ?? '', item.rowIndex);
    const backendStep = String(item.step ?? '').toUpperCase() as ProtocolValidationStep;
    return {
      field: fieldPath ? fieldPath as FieldPath<ProtocolWizardForm> : null,
      fieldPath,
      step: stepIndexes[backendStep] ?? inferStep(fieldPath),
      message: friendlyMessage(item.message ?? ''),
      rowIndex: item.rowIndex,
    };
  });
};

export const applyProtocolApiErrorsToForm = (
  form: UseFormReturn<ProtocolWizardForm>,
  input: ProtocolFieldErrorDto[] | Record<string, string> | null | undefined,
  goToStep: (step: number) => void,
) => {
  const issues = mapProtocolApiErrorsToForm(input);
  issues.forEach((issue) => {
    if (issue.field) form.setError(issue.field, { type: 'server', message: issue.message });
  });
  const first = issues.find((issue) => issue.field) ?? issues[0];
  if (first) {
    goToStep(first.step);
    if (first.field) window.requestAnimationFrame(() => {
      form.setFocus(first.field!);
      document.querySelector<HTMLElement>(`[name="${first.fieldPath}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
  return issues;
};
