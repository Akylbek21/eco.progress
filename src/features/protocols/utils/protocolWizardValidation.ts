import type { ProtocolWizardForm } from '../components/wizardTypes';

export interface ProtocolValidationIssue {
  severity: 'ERROR' | 'WARNING';
  code: string;
  message: string;
  field: string;
  step: number;
  resultClientRowId?: string;
}

const text = (value: unknown) => String(value ?? '').trim();
const hasValue = (value: unknown) => value !== null && value !== undefined && text(value) !== '';
const chemicalTemplates = new Set(['ambient_air', 'workplace_air', 'soil', 'water']);
const issue = (code: string, message: string, field: string, step: number, severity: ProtocolValidationIssue['severity'] = 'ERROR', resultClientRowId?: string): ProtocolValidationIssue => ({ code, message, field, step, severity, resultClientRowId });

export const validateDraft = (form: ProtocolWizardForm): ProtocolValidationIssue[] => {
  const issues: ProtocolValidationIssue[] = [];
  const populatedRows = form.results.filter((row) => text(row.indicatorName) || hasValue(row.value) || hasValue(row.textValue));
  if (!populatedRows.length) return [issue('RESULT_REQUIRED', 'Добавьте минимум одну строку результата.', 'results', 2)];
  form.results.forEach((row, index) => {
    if (!text(row.indicatorName) && !hasValue(row.value) && !hasValue(row.textValue)) return;
    const prefix = `results.${index}`;
    if (!text(row.indicatorName)) issues.push(issue('RESULT_INDICATOR_REQUIRED', 'Укажите показатель.', `${prefix}.indicatorName`, 2, 'ERROR', row.clientRowId));
    if (!hasValue(row.value) && !hasValue(row.textValue)) issues.push(issue('RESULT_VALUE_REQUIRED', 'Укажите результат.', `${prefix}.value`, 2, 'ERROR', row.clientRowId));
    if (!text(row.unit)) issues.push(issue('RESULT_UNIT_REQUIRED', 'Укажите единицу измерения.', `${prefix}.unit`, 2, 'ERROR', row.clientRowId));
    if (text(row.unit) && /^[-+]?\d+(?:[.,]\d+)?$/.test(text(row.unit))) issues.push(issue('RESULT_UNIT_INVALID', 'Единица измерения не может быть числом.', `${prefix}.unit`, 2, 'ERROR', row.clientRowId));
    if (chemicalTemplates.has(form.templateId) && !text(row.pollutantCode)) issues.push(issue('POLLUTANT_CODE_REQUIRED', 'Укажите код показателя.', `${prefix}.pollutantCode`, 2, 'ERROR', row.clientRowId));
    if (form.templateId && !chemicalTemplates.has(form.templateId) && !text(row.factorType)) issues.push(issue('FACTOR_TYPE_REQUIRED', 'Выберите тип физического фактора.', `${prefix}.factorType`, 2, 'ERROR', row.clientRowId));
  });
  return issues;
};

export const validateProtocolForSubmit = (form: ProtocolWizardForm): ProtocolValidationIssue[] => {
  const issues = [...validateDraft(form)];
  if (!form.templateId) issues.push(issue('TEMPLATE_REQUIRED', 'Выберите тип протокола.', 'templateId', 0));
  if (!form.companyId) issues.push(issue('COMPANY_REQUIRED', 'Выберите компанию.', 'companyId', 0));
  if (!form.objectId) issues.push(issue('OBJECT_REQUIRED', 'Выберите объект компании.', 'objectId', 0));
  if (!form.sampleDate && !form.measurementDate) issues.push(issue('MEASUREMENT_DATE_REQUIRED', 'Укажите дату отбора или измерения.', 'measurementDate', 0));
  if (!form.laboratoryId) issues.push(issue('LABORATORY_REQUIRED', 'Выберите лабораторию.', 'laboratoryId', 1));
  if (!form.executorId) issues.push(issue('EXECUTOR_REQUIRED', 'Выберите исполнителя.', 'executorId', 1));
  if (form.templateId === 'water') {
    if (!form.waterType) issues.push(issue('WATER_TYPE_REQUIRED', 'Выберите тип воды.', 'waterType', 1));
    if (!form.waterUseCategory) issues.push(issue('WATER_USE_REQUIRED', 'Выберите категорию водопользования.', 'waterUseCategory', 1));
  }
  form.results.forEach((row, index) => {
    if (!text(row.indicatorName) && !hasValue(row.value) && !hasValue(row.textValue)) return;
    const prefix = `results.${index}`;
    const effectiveDeviceId = row.measurementDeviceId || form.defaultMeasurementDeviceId;
    if (!effectiveDeviceId) issues.push(issue('DEVICE_REQUIRED', 'Выберите прибор для показателя.', `${prefix}.measurementDeviceId`, 2, 'ERROR', row.clientRowId));
    const manualConfirmed = row.normativeSource === 'MANUAL' && hasValue(row.normativeValue);
    const directoryConfirmed = row.normativeSource === 'DIRECTORY' && Number(row.normativeId) > 0;
    if (!manualConfirmed && !directoryConfirmed) issues.push(issue('NORMATIVE_REQUIRED', 'Выберите или укажите норматив перед согласованием.', `${prefix}.normativeId`, 2, 'ERROR', row.clientRowId));
    if (row.normativeStatus === 'REVIEW') issues.push(issue('NORMATIVE_REVIEW', 'Норматив со статусом REVIEW требует подтверждения.', `${prefix}.normativeId`, 2, 'ERROR', row.clientRowId));
    if (row.normativeStatus === 'INACTIVE') issues.push(issue('NORMATIVE_INACTIVE', 'Неактивный норматив нельзя использовать для согласования.', `${prefix}.normativeId`, 2, 'ERROR', row.clientRowId));
    if (form.templateId === 'soil') {
      if (!text(row.sampleNumber)) issues.push(issue('SOIL_SAMPLE_REQUIRED', 'Укажите номер пробы.', `${prefix}.sampleNumber`, 2, 'ERROR', row.clientRowId));
      if (!text(row.samplingPlace || form.measurementPlace)) issues.push(issue('SOIL_PLACE_REQUIRED', 'Укажите место отбора пробы.', `${prefix}.samplingPlace`, 2, 'ERROR', row.clientRowId));
      const depth = text(row.samplingDepth).replace(',', '.');
      if (!depth || !Number.isFinite(Number(depth)) || Number(depth) < 0) issues.push(issue('SOIL_DEPTH_REQUIRED', 'Укажите корректную глубину отбора пробы.', `${prefix}.samplingDepth`, 2, 'ERROR', row.clientRowId));
    }
  });
  if (![form.temperature, form.humidity, form.pressure, form.windSpeed].some(hasValue)) issues.push(issue('ENVIRONMENT_EMPTY', 'Условия среды не заполнены. Проверьте, нужны ли они для протокола.', 'temperature', 1, 'WARNING'));
  return issues;
};

export const validateProtocolWizardStep = (form: ProtocolWizardForm, step: number): ProtocolValidationIssue[] => validateProtocolForSubmit(form).filter((item) => item.step === step);
export const validateForApproval = validateProtocolForSubmit;
