import type { ProtocolWizardForm } from '../components/wizardTypes';
import { PROTOCOL_TEMPLATES } from './protocolTemplates';

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
const validDate = (value: unknown) => {
  const normalized = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false;
  const [year, month, day] = normalized.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

export const validateDraft = (form: ProtocolWizardForm): ProtocolValidationIssue[] => {
  const issues: ProtocolValidationIssue[] = [];
  if (form.templateId === 'ambient_air') {
    if (!form.samplingPoints.length) issues.push(issue('SAMPLING_POINT_REQUIRED', 'Добавьте хотя бы одно место отбора.', 'samplingPoints', 2));
    const names = new Set<string>();
    form.samplingPoints.forEach((point, index) => {
      const name = text(point.name);
      if (!name) issues.push(issue('SAMPLING_POINT_NAME_REQUIRED', 'Укажите название места отбора.', `samplingPoints.${index}.name`, 2));
      if (name && names.has(name.toLocaleLowerCase('ru-RU'))) issues.push(issue('SAMPLING_POINT_NAME_DUPLICATE', `Название места отбора «${name}» повторяется.`, `samplingPoints.${index}.name`, 2));
      names.add(name.toLocaleLowerCase('ru-RU'));
      if (hasValue(point.latitude) && (!Number.isFinite(Number(point.latitude)) || Number(point.latitude) < -90 || Number(point.latitude) > 90)) issues.push(issue('SAMPLING_POINT_LATITUDE_INVALID', 'Широта должна быть от −90 до 90.', `samplingPoints.${index}.latitude`, 2));
      if (hasValue(point.longitude) && (!Number.isFinite(Number(point.longitude)) || Number(point.longitude) < -180 || Number(point.longitude) > 180)) issues.push(issue('SAMPLING_POINT_LONGITUDE_INVALID', 'Долгота должна быть от −180 до 180.', `samplingPoints.${index}.longitude`, 2));
    });
  }
  const populatedRows = form.results.filter((row) => text(row.indicatorName) || hasValue(row.value) || hasValue(row.textValue));
  if (!populatedRows.length) return [issue('RESULT_REQUIRED', 'Добавьте минимум одну строку результата.', 'results', 2)];
  form.results.forEach((row, index) => {
    if (!text(row.indicatorName) && !hasValue(row.value) && !hasValue(row.textValue)) return;
    const prefix = `results.${index}`;
    if (form.templateId === 'ambient_air' && !text(row.samplingPointId)) issues.push(issue('RESULT_SAMPLING_POINT_REQUIRED', 'Выберите место отбора для результата.', `${prefix}.samplingPointId`, 2, 'ERROR', row.clientRowId));
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
  if (!validDate(form.protocolDate)) issues.push(issue('PROTOCOL_DATE_REQUIRED', 'Укажите корректную дату протокола.', 'protocolDate', 0));
  if (!validDate(form.measurementDate)) issues.push(issue('MEASUREMENT_DATE_REQUIRED', 'Укажите корректную дату измерения.', 'measurementDate', 0));
  if (form.templateId && PROTOCOL_TEMPLATES[form.templateId]?.requiresSample && !validDate(form.sampleDate)) issues.push(issue('SAMPLE_DATE_REQUIRED', 'Укажите корректную дату отбора пробы.', 'sampleDate', 0));
  if (!validDate(form.testingStartDate)) issues.push(issue('TESTING_START_DATE_REQUIRED', 'Укажите дату начала испытаний.', 'testingStartDate', 0));
  if (!validDate(form.testingEndDate)) issues.push(issue('TESTING_END_DATE_REQUIRED', 'Укажите дату окончания испытаний.', 'testingEndDate', 0));
  if (validDate(form.testingStartDate) && validDate(form.testingEndDate) && form.testingEndDate < form.testingStartDate) issues.push(issue('TESTING_DATE_RANGE_INVALID', 'Дата окончания испытаний не может быть раньше даты начала.', 'testingEndDate', 0));
  if (validDate(form.sampleDate) && validDate(form.measurementDate) && form.measurementDate < form.sampleDate) issues.push(issue('MEASUREMENT_BEFORE_SAMPLING', 'Дата измерения не может быть раньше даты отбора.', 'measurementDate', 0));
  if (!text(form.measurementPlace)) issues.push(issue('MEASUREMENT_PLACE_REQUIRED', 'Укажите место измерения или отбора.', 'measurementPlace', 0));
  if (!form.laboratoryId) issues.push(issue('LABORATORY_REQUIRED', 'Выберите лабораторию.', 'laboratoryId', 1));
  if (!form.executorId) issues.push(issue('EXECUTOR_REQUIRED', 'Выберите исполнителя.', 'executorId', 1));
  if (form.templateId === 'water') {
    if (!form.waterType) issues.push(issue('WATER_TYPE_REQUIRED', 'Выберите тип воды.', 'waterType', 1));
    if (!form.waterUseCategory) issues.push(issue('WATER_USE_REQUIRED', 'Выберите категорию водопользования.', 'waterUseCategory', 1));
  }
  if (form.templateId === 'microclimate') {
    if (!text(form.season)) issues.push(issue('MICROCLIMATE_SEASON_REQUIRED', 'Укажите сезон.', 'season', 1));
    if (!text(form.workCategory)) issues.push(issue('MICROCLIMATE_WORK_CATEGORY_REQUIRED', 'Укажите категорию работ.', 'workCategory', 1));
    if (!text(form.workplaceType)) issues.push(issue('MICROCLIMATE_WORKPLACE_REQUIRED', 'Укажите тип рабочего места.', 'workplaceType', 1));
    if (!text(form.roomType)) issues.push(issue('MICROCLIMATE_ROOM_REQUIRED', 'Укажите тип помещения.', 'roomType', 1));
    if (!text(form.normLevel)) issues.push(issue('MICROCLIMATE_NORM_LEVEL_REQUIRED', 'Укажите уровень нормирования.', 'normLevel', 1));
  }
  if (form.templateId === 'lighting') {
    if (!text(form.roomType)) issues.push(issue('LIGHTING_ROOM_REQUIRED', 'Укажите тип помещения.', 'roomType', 1));
    if (!text(form.workplaceType)) issues.push(issue('LIGHTING_WORKPLACE_REQUIRED', 'Укажите тип рабочего места.', 'workplaceType', 1));
    if (!text(form.lightingType)) issues.push(issue('LIGHTING_TYPE_REQUIRED', 'Укажите тип освещения.', 'lightingType', 1));
    if (!text(form.visualWorkCategory)) issues.push(issue('LIGHTING_VISUAL_CATEGORY_REQUIRED', 'Укажите разряд зрительной работы.', 'visualWorkCategory', 1));
    if (!text(form.normLevel)) issues.push(issue('LIGHTING_NORM_LEVEL_REQUIRED', 'Укажите уровень нормирования.', 'normLevel', 1));
  }
  if (form.templateId === 'noise_vibration') {
    const factorTypes = new Set(form.results.map((row) => text(row.factorType).toUpperCase()).filter(Boolean));
    if (!text(form.workplaceType)) issues.push(issue('PHYSICAL_WORKPLACE_REQUIRED', 'Укажите тип рабочего места.', 'workplaceType', 1));
    if (!text(form.roomType)) issues.push(issue('PHYSICAL_ROOM_REQUIRED', 'Укажите тип помещения.', 'roomType', 1));
    if ((factorTypes.has('NOISE') || factorTypes.has('NOISE_VIBRATION')) && !text(form.noiseType)) issues.push(issue('NOISE_TYPE_REQUIRED', 'Укажите тип шума.', 'noiseType', 1));
  }
  form.results.forEach((row, index) => {
    if (!text(row.indicatorName) && !hasValue(row.value) && !hasValue(row.textValue)) return;
    const prefix = `results.${index}`;
    const effectiveDeviceId = row.measurementDeviceId || form.defaultMeasurementDeviceId;
    if (!effectiveDeviceId) issues.push(issue('DEVICE_REQUIRED', 'Выберите прибор для показателя.', `${prefix}.measurementDeviceId`, 2, 'ERROR', row.clientRowId));
    const manualConfirmed = row.normativeSource === 'MANUAL' && (
      row.comparisonType === 'RANGE'
        ? hasValue(row.normativeMin) && hasValue(row.normativeMax)
        : hasValue(row.normativeValue)
    );
    const directoryConfirmed = row.normativeSource === 'DIRECTORY' && Number(row.normativeId) > 0;
    if (!manualConfirmed && !directoryConfirmed) issues.push(issue('NORMATIVE_REQUIRED', 'Выберите или укажите норматив перед согласованием.', `${prefix}.normativeId`, 2, 'ERROR', row.clientRowId));
    if (row.normativeStatus === 'REVIEW') issues.push(issue('NORMATIVE_REVIEW', 'Норматив со статусом REVIEW требует подтверждения.', `${prefix}.normativeId`, 2, 'ERROR', row.clientRowId));
    if (row.normativeStatus === 'INACTIVE') issues.push(issue('NORMATIVE_INACTIVE', 'Неактивный норматив нельзя использовать для согласования.', `${prefix}.normativeId`, 2, 'ERROR', row.clientRowId));
    if (directoryConfirmed && row.normativeStatus !== 'ACTIVE') issues.push(issue('NORMATIVE_NOT_ACTIVE', 'Для завершения выберите активный норматив.', `${prefix}.normativeId`, 2, 'ERROR', row.clientRowId));
    if (row.normativeSource === 'MANUAL' && !text(row.manualNormativeReason)) issues.push(issue('MANUAL_NORMATIVE_REASON_REQUIRED', 'Укажите причину использования ручного норматива.', `${prefix}.manualNormativeReason`, 2, 'ERROR', row.clientRowId));
    if (form.templateId === 'soil') {
      if (!text(row.sampleNumber)) issues.push(issue('SOIL_SAMPLE_REQUIRED', 'Укажите номер пробы.', `${prefix}.sampleNumber`, 2, 'ERROR', row.clientRowId));
      if (!text(row.samplingPlace || form.measurementPlace)) issues.push(issue('SOIL_PLACE_REQUIRED', 'Укажите место отбора пробы.', `${prefix}.samplingPlace`, 2, 'ERROR', row.clientRowId));
      const depth = text(row.samplingDepth).replace(',', '.');
      if (!depth || !Number.isFinite(Number(depth)) || Number(depth) < 0) issues.push(issue('SOIL_DEPTH_REQUIRED', 'Укажите корректную глубину отбора пробы.', `${prefix}.samplingDepth`, 2, 'ERROR', row.clientRowId));
    }
    if (form.templateId === 'water') {
      if (!text(row.sampleNumber)) issues.push(issue('WATER_SAMPLE_REQUIRED', 'Укажите номер пробы.', `${prefix}.sampleNumber`, 2, 'ERROR', row.clientRowId));
      if (!text(row.samplingPlace || form.measurementPlace)) issues.push(issue('WATER_PLACE_REQUIRED', 'Укажите место отбора пробы.', `${prefix}.samplingPlace`, 2, 'ERROR', row.clientRowId));
    }
  });
  if (![form.temperature, form.humidity, form.pressure, form.windSpeed].some(hasValue)) issues.push(issue('ENVIRONMENT_EMPTY', 'Условия среды не заполнены. Проверьте, нужны ли они для протокола.', 'temperature', 1, 'WARNING'));
  return issues;
};

export const validateProtocolWizardStep = (form: ProtocolWizardForm, step: number): ProtocolValidationIssue[] => validateProtocolForSubmit(form).filter((item) => item.step === step);
export const validateForApproval = validateProtocolForSubmit;
