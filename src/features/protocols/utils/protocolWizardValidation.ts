import type { ProtocolWizardForm } from '../components/wizardTypes';

export type ProtocolWizardValidationIssue = {
  field: string;
  message: string;
};

const text = (value: unknown) => String(value ?? '').trim();
const hasValue = (value: unknown) => value !== null && value !== undefined && text(value) !== '';
const chemicalTemplates = new Set(['ambient_air', 'workplace_air', 'soil', 'water']);

export const validateDraft = (form: ProtocolWizardForm): ProtocolWizardValidationIssue[] => {
  const issues: ProtocolWizardValidationIssue[] = [];
  const rows = form.results.filter((row) => text(row.indicatorName) || hasValue(row.value) || hasValue(row.textValue));
  if (!rows.length) return [{ field: 'results', message: 'Добавьте минимум одну строку результата.' }];

  rows.forEach((row, index) => {
    const prefix = `results.${index}`;
    if (!text(row.indicatorName)) issues.push({ field: `${prefix}.indicatorName`, message: 'Укажите показатель.' });
    if (!hasValue(row.value) && !hasValue(row.textValue)) issues.push({ field: `${prefix}.value`, message: 'Укажите результат.' });
    if (!text(row.unit)) issues.push({ field: `${prefix}.unit`, message: 'Укажите единицу измерения.' });
    if (text(row.unit) && /^[-+]?\d+(?:[.,]\d+)?$/.test(text(row.unit))) issues.push({ field: `${prefix}.unit`, message: 'Единица измерения не может быть числом.' });
    if (chemicalTemplates.has(form.templateId) && !text(row.pollutantCode)) issues.push({ field: `${prefix}.pollutantCode`, message: 'Укажите код показателя.' });
    if (form.templateId && !chemicalTemplates.has(form.templateId) && !text(row.factorType)) issues.push({ field: `${prefix}.factorType`, message: 'Выберите тип физического фактора.' });
  });
  return issues;
};

export const validateForApproval = (form: ProtocolWizardForm): ProtocolWizardValidationIssue[] => {
  const issues = validateDraft(form);
  form.results.forEach((row, index) => {
    const prefix = `results.${index}`;
    const manualConfirmed = row.normativeSource === 'MANUAL' && hasValue(row.normativeValue);
    const directoryConfirmed = row.normativeSource === 'DIRECTORY' && Number(row.normativeId) > 0;
    if (!manualConfirmed && !directoryConfirmed) {
      issues.push({ field: `${prefix}.normativeId`, message: 'Выберите или укажите норматив перед согласованием.' });
    }
    if (row.normativeStatus === 'REVIEW') {
      issues.push({ field: `${prefix}.normativeId`, message: 'Норматив со статусом REVIEW требует подтверждения.' });
    }
    if (row.normativeStatus === 'INACTIVE') {
      issues.push({ field: `${prefix}.normativeId`, message: 'Неактивный норматив нельзя использовать для согласования.' });
    }
    if (form.templateId === 'soil') {
      if (!text(row.sampleNumber)) issues.push({ field: `${prefix}.sampleNumber`, message: 'Укажите номер пробы.' });
      const depth = text(row.samplingDepth).replace(',', '.');
      if (!depth || !Number.isFinite(Number(depth)) || Number(depth) < 0) {
        issues.push({ field: `${prefix}.samplingDepth`, message: 'Укажите корректную глубину отбора пробы.' });
      }
    }
  });
  return issues;
};
