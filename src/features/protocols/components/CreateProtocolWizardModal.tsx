import { useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm, type FieldPath } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { getActiveCompanies, getCompanyObject, getCompanyObjects } from '../../../services/companyService';
import { getActiveLaboratories, getDefaultLaboratory, getLaboratoryEmployees } from '../../../services/laboratorySettingsService';
import { getAvailableMeasurementDevices } from '../../../services/measurementDeviceService';
import { normalizeApiError } from '../../../services/apiHelpers';
import protocolService from '../../../services/protocolService';
import type { Protocol, ProtocolTemplateId } from '../../../types/protocols';
import type { QuickCreateProtocolRequest } from '../api/protocolContracts';
import { isDeviceValidForDate } from '../../../utils/protocolDevices';
import { normalizeProtocolError } from '../../../utils/protocolError';
import { getWaterProtocolOptions, isWaterProtocolType } from '../../../config/protocolWater';
import {
  buildQuickCreatePayload,
  QuickCreateValidationError,
} from '../mappers/mapProtocolWizardToRequest';
import {
  acquireQuickCreateLock,
  prepareQuickCreateAttempt,
  releaseQuickCreateLock,
} from '../utils/quickCreateSubmission';
import {
  buildQuickCreateTechnicalReport,
  resolveQuickCreateApiError,
} from '../utils/quickCreateError';
import ProtocolWizardFooter from './ProtocolWizardFooter';
import ProtocolWizardHeader from './ProtocolWizardHeader';
import ProtocolWizardSteps from './ProtocolWizardSteps';
import CompanyObjectStep from './steps/CompanyObjectStep';
import EnvironmentStep from './steps/EnvironmentStep';
import LaboratoryExecutorStep from './steps/LaboratoryExecutorStep';
import MeasurementDetailsStep from './steps/MeasurementDetailsStep';
import MethodsStep from './steps/MethodsStep';
import ProtocolTypeStep from './steps/ProtocolTypeStep';
import ResultsStep from './steps/ResultsStep';
import ReviewStep from './steps/ReviewStep';
import {
  CHEMICAL_TYPES,
  createWizardDefaults,
  emptyWizardResult,
  normalizeProtocolWizardForm,
  type LaboratoryExecutorOption,
  type ProtocolWizardForm,
} from './wizardTypes';
import WizardValidationSummary, { type WizardIssue } from './components/WizardValidationSummary';
import QuickCreateErrorPanel from './components/QuickCreateErrorPanel';

const DRAFT_KEY = 'protocol-create-wizard-draft';
const DRAFT_VERSION = 2;
const steps = ['Тип протокола','Компания и объект','Лаборатория','Даты и место','Условия среды','Результаты','Методики','Проверка','Создание'];
export const WATER_CONDITIONS_STEP_INDEX = 4;
const trimmed = (value: unknown) => String(value ?? '').trim();
type StoredDraft = {
  version: number;
  timestamp: string;
  step: number;
  form: ProtocolWizardForm;
  idempotencyKey: string | null;
  payloadFingerprint: string | null;
};
export type ProtocolPekPrefill = Partial<Pick<ProtocolWizardForm, 'companyId' | 'objectId' | 'pekProgramId' | 'pekControlItemId' | 'pekControlEventId' | 'pekReportId' | 'monitoringPointId' | 'emissionSourceId' | 'waterOutletId' | 'measurementDate' | 'measurementPlace'>>;
export type CreateProtocolWizardModalProps = { open: boolean; onClose: () => void; onCreated: (protocol: Protocol) => void; orderId?: string; orderServiceItemId?: string; pekPrefill?: ProtocolPekPrefill };

export const getFieldName = (path: string) => {
  const parts = path.split('.');
  return parts[parts.length - 1] ?? path;
};

export const normalizeQuickCreateFieldPath = (path: string): string => {
  const normalized = path
    .replace(/^header\./, '')
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/^measurements\./, 'results.')
    .replace(/^conditions\.waterType$/, 'waterType')
    .replace(/^conditions\.waterUseCategory$/, 'waterUseCategory')
    .replace(/^environment\.temperature$/, 'temperature')
    .replace(/^environment\.humidity$/, 'humidity')
    .replace(/^environment\.pressureKpa$/, 'pressure')
    .replace(/^environment\.windSpeed$/, 'windSpeed');
  return normalized;
};

const protocolFieldErrorMessages: Record<string, string> = {
  waterType: 'Выберите тип воды',
  waterUseCategory: 'Выберите категорию водопользования',
};

export const resolveWizardStepByField = (field: string) => {
  const normalized = field.toLowerCase();
  if (normalized.includes('watertype') || normalized.includes('waterusecategory') || normalized.includes('conditions')) {
    return WATER_CONDITIONS_STEP_INDEX;
  }
  if (/^template/i.test(field)) return 0;
  if (/company|object/i.test(field)) return 1;
  if (/laboratory|executor/i.test(field)) return 2;
  if (/protocolDate|sampleDate|measurementDate|measurementTime|measurementPlace|testing|sourceNumber/i.test(field)) return 3;
  if (/environment|temperature|humidity|pressure|wind/i.test(field)) return 4;
  if (/measurements|results|normative|device|indicator|unit/i.test(field)) return 5;
  return 6;
};

export const backendWizardIssues = (fieldErrors: Record<string, string>): WizardIssue[] =>
  Object.entries(fieldErrors).map(([rawField, message]) => {
    const field = normalizeQuickCreateFieldPath(rawField);
    const match = field.match(/(?:measurements|results)(?:\.|\[)(\d+)/i);
    const prefix = match ? `Строка ${Number(match[1]) + 1}: ` : '';
    const fieldName = getFieldName(field);
    const friendlyMessage = protocolFieldErrorMessages[fieldName] || message;
    if (import.meta.env.DEV && protocolFieldErrorMessages[fieldName]) {
      console.warn('[protocol wizard] Backend field error', { field, message });
    }
    return {
      code: `BACKEND_${rawField.replace(/[^a-z0-9]+/gi, '_').toUpperCase()}`,
      step: resolveWizardStepByField(field),
      field: field as FieldPath<ProtocolWizardForm>,
      fieldPath: field,
      severity: 'ERROR' as const,
      message: `${prefix}${friendlyMessage}`,
    };
  });

const CreateProtocolWizardModal = ({ open, onClose, onCreated, orderId = '', orderServiceItemId = '', pekPrefill }: CreateProtocolWizardModalProps) => {
  const form = useForm<ProtocolWizardForm>({ defaultValues: createWizardDefaults(), mode: 'onChange' });
  const { watch, getValues, setValue, reset, formState } = form;
  const queryClient = useQueryClient();
  const values = watch();
  const [step,setStep] = useState(0); const [maxVisited,setMaxVisited] = useState(0); const [error,setError] = useState(''); const [apiFailure,setApiFailure] = useState<ReturnType<typeof normalizeApiError> | null>(null); const [serverIssues,setServerIssues] = useState<WizardIssue[]>([]);
  const [closePrompt,setClosePrompt] = useState(false); const [draftPrompt,setDraftPrompt] = useState(false); const [pendingType,setPendingType] = useState<ProtocolTemplateId | null>(null); const [success,setSuccess] = useState<Protocol | null>(null);
  const submittingRef = useRef(false); const titleRef = useRef<HTMLElement | null>(null); const idempotencyKeyRef = useRef<string | null>(null); const submittedFingerprintRef = useRef<string | null>(null); const submittedPayloadRef = useRef<QuickCreateProtocolRequest | null>(null);
  const lockedPekCompanyId = pekPrefill?.companyId ? String(pekPrefill.companyId) : undefined;
  const automaticWeatherRef = useRef<Partial<Record<'temperature' | 'humidity' | 'pressure' | 'windSpeed', string>>>({});
  const typesQuery = useQuery({ queryKey: ['protocol-types'], queryFn: () => protocolService.getProtocolTypes(), enabled: open });
  const companiesQuery = useQuery({ queryKey: ['companies','protocol-wizard'], queryFn: ({ signal }) => getActiveCompanies(signal), enabled: open });
  const laboratoriesQuery = useQuery({ queryKey: ['laboratories','protocol-wizard'], queryFn: ({ signal }) => getActiveLaboratories(signal), enabled: open });
  const defaultLaboratoryQuery = useQuery({ queryKey: ['laboratories','default'], queryFn: ({ signal }) => getDefaultLaboratory(signal), enabled: open, retry: false });
  const devicesQuery = useQuery({
    queryKey: ['measurement-devices','available',values.laboratoryId,values.measurementDate,values.templateId],
    queryFn: () => getAvailableMeasurementDevices({
      laboratoryId: values.laboratoryId,
      measurementDate: values.measurementDate,
      templateId: values.templateId,
    }),
    enabled: open && Boolean(values.laboratoryId && values.measurementDate && values.templateId),
  });
  const objectsQuery = useQuery({ queryKey: ['company-objects',values.companyId], queryFn: ({ signal }) => getCompanyObjects(values.companyId,false,signal), enabled: open && Boolean(values.companyId) });
  const objectDetailsQuery = useQuery({ queryKey: ['company-object', values.companyId, values.objectId], queryFn: ({ signal }) => getCompanyObject(values.companyId, values.objectId, signal), enabled: open && Boolean(values.companyId && values.objectId) });
  const employeesQuery = useQuery({ queryKey: ['laboratory-employees',values.laboratoryId], queryFn: ({ signal }) => getLaboratoryEmployees(values.laboratoryId,{ signal }), enabled: open && Boolean(values.laboratoryId) });
  const templates = typesQuery.data || []; const companies = companiesQuery.data || []; const laboratories = laboratoriesQuery.data || [];
  const waterTemplate = templates.find((item) => isWaterProtocolType(item.id));
  const { waterTypes: waterTypeOptions, waterUseCategories: waterUseCategoryOptions } = useMemo(
    () => getWaterProtocolOptions(waterTemplate),
    [waterTemplate],
  );
  const allObjects = objectsQuery.data || [];
  const objects = allObjects.filter((item) => item.status === 'ACTIVE' && !item.virtual && !item.isVirtual);
  const employees = (employeesQuery.data || []).filter((item) => item.active);
  const executorOptions = useMemo<LaboratoryExecutorOption[]>(() => employees.map((item) => ({
    executorId: item.id,
    laboratoryEmployeeId: item.id,
    userId: item.userId ?? undefined,
    fullName: item.fullName,
    laboratoryId: item.laboratoryId,
    active: item.active,
  })), [employees]);
  const devices = (devicesQuery.data || []).filter((item) => !['EXPIRED','ARCHIVED','INACTIVE','OUT_OF_SERVICE'].includes(String(item.status || '').toUpperCase()));
  const selectedObject = allObjects.find((item) => String(item.id) === String(values.objectId));
  const selectedExecutor = executorOptions.find((item) => String(item.executorId) === String(values.executorId));
  const weatherCoordinates = objectDetailsQuery.data?.coordinates || selectedObject?.coordinates || '';
  const weatherDate = values.sampleDate || values.measurementDate;
  const weatherQuery = useQuery({
    queryKey: ['protocol-weather', values.objectId, weatherDate, values.measurementTime, weatherCoordinates],
    queryFn: ({ signal }) => protocolService.getWeatherConditions({
      objectId: values.objectId,
      coordinates: weatherCoordinates || undefined,
      date: weatherDate,
      time: values.measurementTime || '12:00',
      signal,
    }),
    enabled: Boolean(open && values.objectId && weatherDate && (values.measurementTime || '12:00')),
    retry: false,
  });

  useEffect(() => { if (!open) { idempotencyKeyRef.current = null; submittedFingerprintRef.current = null; return; } const stored = sessionStorage.getItem(DRAFT_KEY); setDraftPrompt(Boolean(stored)); if (!stored) { setValue('orderId', orderId); setValue('orderServiceItemId', orderServiceItemId); if (pekPrefill) Object.entries(pekPrefill).forEach(([key,value]) => { if (value !== undefined) setValue(key as FieldPath<ProtocolWizardForm>, value); }); } setError(''); setApiFailure(null); setSuccess(null); }, [open, orderId, orderServiceItemId, pekPrefill, setValue]);
  useEffect(() => {
    if (!open || draftPrompt || success) return;
    const subscription = watch((formValue) => {
      const stored: StoredDraft = {
        version: DRAFT_VERSION,
        timestamp: new Date().toISOString(),
        step,
        form: formValue as ProtocolWizardForm,
        idempotencyKey: idempotencyKeyRef.current,
        payloadFingerprint: submittedFingerprintRef.current,
      };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(stored));
    });
    return () => subscription.unsubscribe();
  }, [draftPrompt,open,step,success,watch]);
  useEffect(() => {
    const defaultLaboratory = defaultLaboratoryQuery.data;
    if (!open || !defaultLaboratory?.active || getValues('laboratoryId')) return;
    setValue('laboratoryId', String(defaultLaboratory.id), { shouldDirty: false });
  }, [defaultLaboratoryQuery.data, getValues, open, setValue]);
  useEffect(() => { if (!open) return; window.requestAnimationFrame(() => { titleRef.current = document.getElementById('wizard-step-title'); titleRef.current?.focus(); }); }, [open,step]);
  useEffect(() => {
    if (step !== WATER_CONDITIONS_STEP_INDEX || !isWaterProtocolType(values.templateId)) return;
    if (!values.waterType) form.setError('waterType', { type: 'required', message: 'Выберите тип воды' });
    else form.clearErrors('waterType');
    if (!values.waterUseCategory) form.setError('waterUseCategory', { type: 'required', message: 'Выберите категорию водопользования' });
    else form.clearErrors('waterUseCategory');
  }, [form, step, values.templateId, values.waterType, values.waterUseCategory]);
  useEffect(() => { if (import.meta.env.DEV && values.sampleDate && values.sampleDate !== values.measurementDate) console.warn('[Protocol wizard] Отдельное хранение sampleDate должно быть подтверждено QuickCreateProtocolRequest.'); }, [values.measurementDate,values.sampleDate]);
  useEffect(() => {
    const weather = weatherQuery.data;
    if (!weather) return;
    if (!weather.available || weather.status !== 'LOADED') {
      setValue('environmentSource', 'MANUAL', { shouldDirty: false });
      return;
    }
    const nextValues = {
      temperature: weather.temperature == null ? '' : String(weather.temperature),
      humidity: weather.humidity == null ? '' : String(weather.humidity),
      pressure: weather.pressureKpa == null && weather.pressure == null ? '' : String(weather.pressureKpa ?? weather.pressure),
      windSpeed: weather.windSpeed == null ? '' : String(weather.windSpeed),
    };
    setValue('environmentSource', weather.source || 'API', { shouldDirty: false });
    setValue('environmentDataSource', weather.dataSource || '', { shouldDirty: false });
    setValue('environmentObservedAt', weather.observedAt || weather.weatherObservedAt || '', { shouldDirty: false });
    (Object.entries(nextValues) as Array<[keyof typeof nextValues, string]>).forEach(([field, nextValue]) => {
      if (!nextValue) return;
      const currentValue = getValues(field);
      const previousAutomaticValue = automaticWeatherRef.current[field];
      if (!currentValue || currentValue === previousAutomaticValue) setValue(field, nextValue, { shouldDirty: false });
      automaticWeatherRef.current[field] = nextValue;
    });
  }, [getValues, setValue, weatherQuery.data]);

  const issues = useMemo<WizardIssue[]>(() => {
    const result: Array<{ message: string; step: number; field?: FieldPath<ProtocolWizardForm> }> = [];
    if (!values.templateId) result.push({ message:'Выберите тип протокола.',step:0 });
    if (!values.companyId) result.push({ message:'Выберите компанию.',step:1 });
    if (!values.objectId) result.push({ message:'Выберите зарегистрированный объект компании.',step:1 });
    else if (!selectedObject || selectedObject.virtual || selectedObject.isVirtual || selectedObject.persisted === false) result.push({ message:'Перед созданием протокола сохраните объект компании.',step:1,field:'objectId' });
    if (!values.laboratoryId) result.push({ message:'Выберите лабораторию.',step:2 });
    if (!values.executorId) result.push({ message:'Выберите исполнителя лаборатории.',step:2 });
    else if (!selectedExecutor || selectedExecutor.active === false || String(selectedExecutor.laboratoryId) !== String(values.laboratoryId)) result.push({ message:'Выберите исполнителя выбранной лаборатории.',step:2 });
    if (!values.protocolDate) result.push({ message:'Укажите дату протокола.',step:3 });
    if (!values.sampleDate) result.push({ message:'Укажите дату отбора пробы.',step:3 });
    if (!values.measurementDate) result.push({ message:'Укажите дату измерения.',step:3 });
    if (!values.testingStartDate) result.push({ message:'Укажите дату начала испытаний.',step:3 });
    if (!values.testingEndDate) result.push({ message:'Укажите дату завершения испытаний.',step:3 });
    if (!values.measurementTime) result.push({ message:'Укажите время измерения.',step:3 });
    if (!trimmed(values.measurementPlace)) result.push({ message:'Укажите место измерения.',step:3 });
    if (trimmed(values.sourceNumber).replace(/[\u0000-\u001F\u007F]/g, '').length > 80) result.push({ message:'Номер источника должен содержать не более 80 символов',step:3,field:'sourceNumber' });
    if (values.testingStartDate && values.testingEndDate && values.testingEndDate < values.testingStartDate) result.push({ message:'Дата завершения испытаний не может быть раньше даты начала.',step:3 });
    if (values.sampleDate && values.measurementDate && values.measurementDate < values.sampleDate) result.push({ message:'Дата измерения не может быть раньше даты отбора.',step:4 });
    if (isWaterProtocolType(values.templateId) && !values.waterType) result.push({ message:'Выберите тип воды',step:WATER_CONDITIONS_STEP_INDEX,field:'waterType' });
    if (isWaterProtocolType(values.templateId) && !values.waterUseCategory) result.push({ message:'Выберите категорию водопользования',step:WATER_CONDITIONS_STEP_INDEX,field:'waterUseCategory' });
    const rows = (values.results || []).filter((row) =>
      trimmed(row?.indicatorName) || trimmed(row?.value) || trimmed(row?.textValue));
    if (!rows.length) result.push({ message:'Добавьте минимум одну строку результата.',step:5 });
    rows.forEach((row,index) => {
      if (!row.normativeId && !row.normativeRecordId) {
        result.push({
          message: `Строка ${index + 1}: выберите показатель через поиск нормативов.`,
          step: 5,
        });
      }
    });
    rows.forEach((row,index) => { if (!trimmed(row.indicatorName)) result.push({ message:`Строка ${index + 1}: укажите показатель.`,step:5 }); if (!trimmed(row.value) && !trimmed(row.textValue)) result.push({ message:`Строка ${index + 1}: укажите результат.`,step:5 }); if ((trimmed(row.value) || trimmed(row.textValue)) && !trimmed(row.unit)) result.push({ message:`Строка ${index + 1}: укажите единицу измерения.`,step:5 }); if (trimmed(row.unit) && /^[-+]?\d+(?:[.,]\d+)?$/.test(trimmed(row.unit))) result.push({ message:`Строка ${index + 1}: единица измерения не может быть нормативным значением.`,step:5 }); if (values.templateId && CHEMICAL_TYPES.has(values.templateId) && !trimmed(row.pollutantCode)) result.push({ message:`Строка ${index + 1}: укажите код загрязняющего вещества.`,step:5 }); if (values.templateId && !CHEMICAL_TYPES.has(values.templateId) && !trimmed(row.factorCode || row.factorType)) result.push({ message:`Строка ${index + 1}: укажите тип физического фактора.`,step:5 }); const device = devices.find((item) => String(item.id) === row.measurementDeviceId); if (!row.measurementDeviceId) result.push({ message:`Строка ${index + 1}: выберите прибор.`,step:5 }); else if (!device || !isDeviceValidForDate(device,values.measurementDate)) result.push({ message:`Строка ${index + 1}: срок поверки прибора истёк или прибор неактивен.`,step:5 }); if (!trimmed(row.testingMethodNd || row.methodDocument || values.testingMethodNd)) result.push({ message:`Строка ${index + 1}: укажите методику испытаний.`,step:6,field:`results.${index}.testingMethodNd` as FieldPath<ProtocolWizardForm> }); });
    if (!trimmed(values.testingMethodNd)) result.push({ message:'Укажите НД на метод испытаний.',step:6 });
    return result.map((item, index) => ({
      ...item,
      code: `WIZARD_${item.field ? String(item.field).replace(/[^a-z0-9]+/gi, '_').toUpperCase() : `${item.step}_${index}`}`,
      fieldPath: item.field ? String(item.field) : '',
      severity: 'ERROR',
    }));
  }, [devices,selectedExecutor,selectedObject,values]);
  const submitPayloadResult = useMemo(() => {
    try {
      const payload = buildQuickCreatePayload(values, {
        selectedObject,
        selectedExecutor,
        validateSelections: true,
        validationMode: 'submit',
      });
      return { valid: true as const, payload, error: null };
    } catch (payloadError) {
      return {
        valid: false as const,
        payload: null,
        error: payloadError instanceof Error ? payloadError.message : 'Проверьте обязательные поля',
      };
    }
  }, [selectedExecutor, selectedObject, values]);

  const mutation = useMutation({
    mutationFn: ({ payload, idempotencyKey }: {
      payload: QuickCreateProtocolRequest;
      idempotencyKey: string;
    }) => protocolService.quickCreateProtocol({ payload, idempotencyKey }),
    retry: false,
  });
  const requiredLookupsLoading = companiesQuery.isFetching
    || objectsQuery.isFetching
    || laboratoriesQuery.isFetching
    || defaultLaboratoryQuery.isFetching
    || employeesQuery.isFetching
    || devicesQuery.isFetching;
  const canCreate = submitPayloadResult.valid
    && issues.length === 0
    && formState.isValid
    && Object.keys(formState.errors).length === 0
    && !requiredLookupsLoading
    && !mutation.isPending;
  const canContinue = step === 0 ? Boolean(values.templateId) : step === 1 ? Boolean(values.companyId) : step === steps.length - 1 ? canCreate : true;
  const applyWaterTypeTransition = (current: ProtocolWizardForm['templateId'], next: ProtocolTemplateId) => {
    if (isWaterProtocolType(current) && !isWaterProtocolType(next)) {
      setValue('waterType', '', { shouldDirty: true });
      setValue('waterUseCategory', '', { shouldDirty: true });
      form.clearErrors(['waterType', 'waterUseCategory']);
      setServerIssues((currentIssues) => currentIssues.filter((issue) => issue.field !== 'waterType' && issue.field !== 'waterUseCategory'));
    }
  };
  const chooseType = (next: ProtocolTemplateId) => {
    const current = getValues('templateId');
    const dependentFilled = getValues('results').some((row) => row.indicatorName || row.value || row.normativeId || row.measurementDeviceId);
    if (current && current !== next && dependentFilled) { setPendingType(next); return; }
    applyWaterTypeTransition(current, next);
    setValue('templateId',next,{ shouldDirty:true });
  };
  const applyTypeChange = () => { if (!pendingType) return; const current = getValues('templateId'); applyWaterTypeTransition(current,pendingType); setValue('templateId',pendingType,{ shouldDirty:true }); setValue('results',[],{ shouldDirty:true }); setValue('formCode',''); setValue('appendixNumber',''); setValue('temperature',''); setValue('humidity',''); setValue('pressure',''); setValue('windSpeed',''); setValue('windDirection',''); setValue('weatherConditions',''); setPendingType(null); };
  const changeCompany = (id: string) => { if (lockedPekCompanyId && id !== lockedPekCompanyId) return; setValue('companyId',id,{ shouldDirty:true }); setValue('objectId','',{ shouldDirty:true }); setValue('customer','',{ shouldDirty:true }); setValue('basis','',{ shouldDirty:true }); };
  const changeLaboratory = (id: string) => { setValue('laboratoryId',id,{ shouldDirty:true }); setValue('executorId','',{ shouldDirty:true }); getValues('results').forEach((_,index) => setValue(`results.${index}.measurementDeviceId`,'',{ shouldDirty:true })); };
  const goNext = () => { if (!canContinue) { setError(issues.find((item) => item.step === step)?.message || 'Исправьте ошибки текущего шага.'); return; } setError(''); setStep((current) => { const next = Math.min(steps.length - 1,current + 1); setMaxVisited((visited) => Math.max(visited,next)); return next; }); };
  const requestClose = () => { if (mutation.isPending) return; if (formState.isDirty || sessionStorage.getItem(DRAFT_KEY)) setClosePrompt(true); else onClose(); };
  const restoreDraft = () => {
    try {
      const raw = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '') as Partial<StoredDraft> & { form?: ProtocolWizardForm };
      if (!raw.form) throw new Error('Некорректный черновик');
      const defaults = createWizardDefaults();
      const migratedForm = normalizeProtocolWizardForm({
        ...raw.form,
        ...(pekPrefill || {}),
        orderId: orderId || raw.form.orderId || '',
        orderServiceItemId: orderServiceItemId || raw.form.orderServiceItemId || '',
        printVisibility: { ...defaults.printVisibility, ...raw.form.printVisibility },
        results: (raw.form.results || []).map((row) => ({ ...emptyWizardResult(), ...row })),
      });
      reset(migratedForm);
      const restoredStep = Math.min(Number(raw.step) || 0, steps.length - 1);
      setStep(restoredStep);
      setMaxVisited(restoredStep);
      idempotencyKeyRef.current = typeof raw.idempotencyKey === 'string' ? raw.idempotencyKey : null;
      submittedFingerprintRef.current = typeof raw.payloadFingerprint === 'string' ? raw.payloadFingerprint : null;
      if (raw.version !== DRAFT_VERSION) {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
          version: DRAFT_VERSION,
          timestamp: new Date().toISOString(),
          step: restoredStep,
          form: migratedForm,
          idempotencyKey: idempotencyKeyRef.current,
          payloadFingerprint: submittedFingerprintRef.current,
        } satisfies StoredDraft));
      }
    } catch {
      sessionStorage.removeItem(DRAFT_KEY);
      reset(createWizardDefaults());
      idempotencyKeyRef.current = null;
      submittedFingerprintRef.current = null;
    }
    setDraftPrompt(false);
  };
  const newDraft = () => { sessionStorage.removeItem(DRAFT_KEY); idempotencyKeyRef.current = null; submittedFingerprintRef.current = null; submittedPayloadRef.current = null; reset(normalizeProtocolWizardForm({ ...(pekPrefill || {}), orderId, orderServiceItemId })); setStep(0); setMaxVisited(0); setDraftPrompt(false); };
  const saveDraft = () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
      version: DRAFT_VERSION,
      timestamp: new Date().toISOString(),
      step,
      form: getValues(),
      idempotencyKey: idempotencyKeyRef.current,
      payloadFingerprint: submittedFingerprintRef.current,
    } satisfies StoredDraft));
  };
  const createProtocol = async () => {
    if (mutation.isPending) return;
    if (!acquireQuickCreateLock(submittingRef)) return;
    setError('');
    setApiFailure(null);
    setServerIssues([]);
    form.clearErrors();
    try {
      const payload = buildQuickCreatePayload(getValues(), {
        selectedObject,
        selectedExecutor,
        validateSelections: true,
        validationMode: 'submit',
      });
      const attempt = prepareQuickCreateAttempt(payload, {
        idempotencyKey: idempotencyKeyRef.current,
        payloadFingerprint: submittedFingerprintRef.current,
      });
      idempotencyKeyRef.current = attempt.idempotencyKey;
      submittedFingerprintRef.current = attempt.payloadFingerprint;
      submittedPayloadRef.current = payload;
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        version: DRAFT_VERSION,
        timestamp: new Date().toISOString(),
        step,
        form: getValues(),
        idempotencyKey: attempt.idempotencyKey,
        payloadFingerprint: attempt.payloadFingerprint,
      } satisfies StoredDraft));
      const created = await mutation.mutateAsync({
        payload,
        idempotencyKey: attempt.idempotencyKey,
      });
      if (!created.id) throw new Error('Backend не вернул идентификатор созданного протокола.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['protocols'] }),
        queryClient.invalidateQueries({ queryKey: ['protocol-statistics'] }),
      ]);
      sessionStorage.removeItem(DRAFT_KEY);
      idempotencyKeyRef.current = null;
      submittedFingerprintRef.current = null;
      submittedPayloadRef.current = null;
      setSuccess(created);
      window.setTimeout(() => onCreated(created),400);
    } catch (requestError) {
      if (requestError instanceof QuickCreateValidationError) {
        form.setError(requestError.field as FieldPath<ProtocolWizardForm>, {
          type: 'validate',
          message: requestError.message,
        });
        setError(requestError.message);
        const targetStep = resolveWizardStepByField(requestError.field);
        setStep(targetStep);
        window.requestAnimationFrame(() => {
          form.setFocus(requestError.field as FieldPath<ProtocolWizardForm>);
          document.querySelector<HTMLElement>(`[name="${requestError.field}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        return;
      }
      const normalized = normalizeProtocolError(requestError);
      const apiError = normalizeApiError(requestError,'Не удалось создать протокол.');
      const errorResolution = resolveQuickCreateApiError(apiError);
      setApiFailure(apiError);
      if (errorResolution.existingProtocolId) {
        try {
          const existingProtocol = await protocolService.getProtocol(errorResolution.existingProtocolId);
          setSuccess(existingProtocol);
          window.setTimeout(() => onCreated(existingProtocol), 400);
          return;
        } catch {
          // The conflict itself is still shown when the referenced protocol cannot be loaded.
        }
      }
      const mappedIssues = backendWizardIssues(apiError.fieldErrors);
      Object.entries(apiError.fieldErrors).forEach(([rawPath, message]) => {
        const path = normalizeQuickCreateFieldPath(rawPath) as FieldPath<ProtocolWizardForm>;
        form.setError(path, { type: 'server', message });
      });
      if (errorResolution.field) {
        form.setError(errorResolution.field, { type: 'server', message: errorResolution.message });
        mappedIssues.unshift({
          code: `API_${errorResolution.field.toUpperCase()}`,
          step: resolveWizardStepByField(errorResolution.field),
          field: errorResolution.field,
          fieldPath: errorResolution.field,
          severity: 'ERROR',
          message: errorResolution.message,
        });
      }
      setServerIssues(mappedIssues);
      if (errorResolution.resetIdempotencyKey) {
        idempotencyKeyRef.current = null;
        submittedFingerprintRef.current = null;
      }
      setError(mappedIssues.length ? '' : normalized.resultIndex === undefined ? errorResolution.message : `Строка ${normalized.resultIndex + 1}: ${errorResolution.message}`);
      if (mappedIssues.length) {
        const firstIssue = mappedIssues[0];
        setStep(firstIssue.step);
        if (firstIssue.field) {
          window.requestAnimationFrame(() => {
            form.setFocus(firstIssue.field as FieldPath<ProtocolWizardForm>);
            document.querySelector<HTMLElement>(`[name="${firstIssue.field}"]`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          });
        }
      }
      else if (normalized.resultIndex !== undefined) setStep(5);
    } finally {
      releaseQuickCreateLock(submittingRef);
    }
  };
  const copyErrorCode = async () => {
    const code = apiFailure?.requestCode || apiFailure?.traceId || apiFailure?.requestId;
    if (!code || !navigator.clipboard) return;
    await navigator.clipboard.writeText(code);
  };
  const copyTechnicalInfo = async () => {
    if (!apiFailure || !navigator.clipboard) return;
    await navigator.clipboard.writeText(JSON.stringify(
      buildQuickCreateTechnicalReport(
        apiFailure,
        submittedPayloadRef.current,
        idempotencyKeyRef.current,
      ),
      null,
      2,
    ));
  };
  const weatherMessage = weatherQuery.isError
    ? 'Автоматические погодные данные не получены. Заполните условия среды вручную'
    : weatherQuery.data?.warning
    ? weatherQuery.data.warning
    : values.objectId && !objectDetailsQuery.isFetching && !weatherCoordinates
    ? 'У объекта не указаны координаты. Используются координаты города по умолчанию'
    : weatherQuery.data ? `Условия загружены автоматически${weatherQuery.data.dataSource ? ` · ${weatherQuery.data.dataSource}` : ''}.` : '';
  const goToIssue = (targetStep: number, field?: WizardIssue['field']) => {
    setStep(targetStep);
    setMaxVisited((visited) => Math.max(visited, targetStep));
    if (!field) return;
    window.requestAnimationFrame(() => {
      const escapedField = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(field)
        : field.replace(/["\\]/g, '\\$&');
      const element = document.getElementById(field)
        || document.querySelector<HTMLElement>(`[name="${escapedField}"]`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.focus();
      form.setFocus(field);
    });
  };
  const content = step === 0 ? <ProtocolTypeStep templates={templates} onSelect={chooseType} /> : step === 1 ? <CompanyObjectStep companies={companies} objects={objects} loading={objectsQuery.isFetching} lockedCompanyId={lockedPekCompanyId} onCompanyChange={changeCompany} /> : step === 2 ? <LaboratoryExecutorStep laboratories={laboratories} employees={executorOptions} loading={employeesQuery.isFetching} error={employeesQuery.isError} onLaboratoryChange={changeLaboratory} /> : step === 3 ? <MeasurementDetailsStep /> : step === 4 ? <EnvironmentStep weatherLoading={weatherQuery.isFetching} weatherMessage={weatherMessage} onRefresh={() => void weatherQuery.refetch()} waterTypeOptions={waterTypeOptions} waterUseCategoryOptions={waterUseCategoryOptions} /> : step === 5 ? <ResultsStep devices={devices} /> : step === 6 ? <MethodsStep /> : <ReviewStep final={step === 8} apiPayloadValid={submitPayloadResult.valid} companies={companies} objects={objects} laboratories={laboratories} employees={employees} issues={issues} onGoTo={goToIssue} waterTypeOptions={waterTypeOptions} waterUseCategoryOptions={waterUseCategoryOptions} />;
  const requestCode = apiFailure?.requestCode || apiFailure?.traceId || apiFailure?.requestId;
  const debugPanel = import.meta.env.DEV && step === 8 ? (
    <details className="mb-4 rounded-xl border border-slate-300 bg-slate-950 p-4 text-xs text-slate-100">
      <summary className="cursor-pointer font-bold">Debug: нормализованный quick-create payload</summary>
      <pre className="mt-3 overflow-auto whitespace-pre-wrap">{JSON.stringify({
        valid: submitPayloadResult.valid,
        missingRequiredFields: issues.map((issue) => issue.message),
        idempotencyKey: idempotencyKeyRef.current
          ? `${idempotencyKeyRef.current.slice(0, 8)}…`
          : null,
        payload: submitPayloadResult.payload,
      }, null, 2)}</pre>
    </details>
  ) : null;

  return <FormProvider {...form}><Modal open={open} onClose={requestClose} size="wizard" closeOnBackdrop={false} loading={mutation.isPending} contentClassName="!overflow-hidden !p-0 sm:!p-0"><div className="flex h-full min-h-0 flex-col"><ProtocolWizardHeader step={step} total={steps.length} title={steps[step]} submitting={mutation.isPending} onClose={requestClose} /><ProtocolWizardSteps steps={steps} current={step} maxVisited={maxVisited} onSelect={setStep} /><main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{apiFailure && <QuickCreateErrorPanel error={apiFailure} message={error || apiFailure.message} pending={mutation.isPending} onRetry={createProtocol} onReview={() => setStep(7)} onCopyCode={copyErrorCode} onCopyTechnicalInfo={copyTechnicalInfo} />}{!apiFailure && error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><h3 className="font-black">Ошибка проверки данных</h3><p className="mt-1 font-semibold">{error}</p></div>}{serverIssues.length > 0 && <div className="mb-4"><WizardValidationSummary issues={serverIssues} onGoTo={goToIssue} />{requestCode && <p className="mt-2 text-xs text-slate-600">Код обращения: {requestCode}</p>}</div>}{debugPanel}{success ? <div className="grid min-h-72 place-items-center text-center"><div><h3 className="text-2xl font-black text-emerald-800">Протокол успешно создан</h3><p className="mt-3">Номер: {success.protocolNumber || success.number || success.id}</p><p>Статус: {success.status}</p></div></div> : content}</main>{!success && <ProtocolWizardFooter step={step} total={steps.length} submitting={mutation.isPending} retrying={Boolean(apiFailure)} canContinue={canContinue} onBack={() => { setError(''); setStep((current) => Math.max(0,current - 1)); }} onNext={goNext} onCreate={createProtocol} onSaveDraft={saveDraft} />}</div></Modal>
    <Modal open={draftPrompt && open} onClose={() => {}} closeOnBackdrop={false} size="sm" title="Найдена незавершённая форма протокола" footer={<><Button type="button" variant="secondary" onClick={newDraft}>Начать заново</Button><Button type="button" onClick={restoreDraft}>Продолжить</Button></>}><p className="text-sm text-slate-600">Продолжить заполнение временного черновика из текущей сессии?</p></Modal>
    <Modal open={closePrompt} onClose={() => setClosePrompt(false)} closeOnBackdrop={false} size="sm" title="Закрыть создание протокола?" footer={<><Button type="button" variant="secondary" onClick={() => setClosePrompt(false)}>Продолжить заполнение</Button><Button type="button" onClick={() => { setClosePrompt(false); onClose(); }}>Закрыть</Button><Button type="button" variant="danger" onClick={() => { sessionStorage.removeItem(DRAFT_KEY); reset(createWizardDefaults()); setClosePrompt(false); onClose(); }}>Очистить и закрыть</Button></>}><p className="text-sm text-slate-600">Введённые данные сохранены как временный черновик и будут доступны до завершения текущей сессии.</p></Modal>
    <Modal open={Boolean(pendingType)} onClose={() => setPendingType(null)} closeOnBackdrop={false} size="sm" title="Изменить тип протокола?" footer={<><Button type="button" variant="secondary" onClick={() => setPendingType(null)}>Отмена</Button><Button type="button" variant="danger" onClick={applyTypeChange}>Изменить тип</Button></>}><p className="text-sm text-slate-600">При изменении типа результаты, приборы и нормативы будут очищены.</p></Modal>
  </FormProvider>;
};
export default CreateProtocolWizardModal;
