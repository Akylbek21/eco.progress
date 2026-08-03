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
import EnvironmentStep from './steps/EnvironmentStep';
import MethodsStep from './steps/MethodsStep';
import ResultsStep from './steps/ResultsStep';
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
import BasicDataStep from './steps/BasicDataStep';
import ExecutorDeviceStep from './steps/ExecutorDeviceStep';
import ProtocolCheckStep from './steps/ProtocolCheckStep';
import ProtocolSigningStep from './steps/ProtocolSigningStep';
import { useAuth } from '../../../contexts/AuthContext';
import { createProtocolCmsSignature, protocolSigningPhaseLabel, type ProtocolSigningPhase } from '../utils/protocolSigning';
import { validateDraft, validateForApproval } from '../utils/protocolWizardValidation';

const DRAFT_KEY = 'protocol-create-wizard-draft';
const DRAFT_VERSION = 2;
const steps = ['Основные данные', 'Исполнитель и прибор', 'Результаты', 'Проверка', 'Подписание'];
export const WATER_CONDITIONS_STEP_INDEX = 0;
const trimmed = (value: unknown) => String(value ?? '').trim();
const saveBlob = (blob: Blob, fileName: string) => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = fileName; link.click(); URL.revokeObjectURL(url); };
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
  if (/company|object|protocolDate|sampleDate|measurementDate|measurementTime|measurementPlace|environment|temperature|humidity|pressure|wind|testing|sourceNumber/i.test(field)) return 0;
  if (/laboratory|executor|device/i.test(field)) return 1;
  if (/measurements|results|normative|indicator|unit|method/i.test(field)) return 2;
  return 3;
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
  const { user } = useAuth();
  const draftKey = `${DRAFT_KEY}:${user?.id || 'anonymous'}:new:${DRAFT_VERSION}`;
  const { watch, getValues, setValue, reset, formState } = form;
  const queryClient = useQueryClient();
  const values = watch();
  const [step,setStep] = useState(0); const [maxVisited,setMaxVisited] = useState(0); const [error,setError] = useState(''); const [apiFailure,setApiFailure] = useState<ReturnType<typeof normalizeApiError> | null>(null); const [serverIssues,setServerIssues] = useState<WizardIssue[]>([]);
  const [closePrompt,setClosePrompt] = useState(false); const [draftPrompt,setDraftPrompt] = useState(false); const [pendingType,setPendingType] = useState<ProtocolTemplateId | null>(null); const [success,setSuccess] = useState<Protocol | null>(null);
  const [signPrompt, setSignPrompt] = useState(false);
  const [signingPhase, setSigningPhase] = useState<ProtocolSigningPhase>('IDLE');
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

  useEffect(() => { if (!open) { idempotencyKeyRef.current = null; submittedFingerprintRef.current = null; return; } const stored = sessionStorage.getItem(draftKey); setDraftPrompt(Boolean(stored)); if (!stored) { setValue('orderId', orderId); setValue('orderServiceItemId', orderServiceItemId); if (pekPrefill) Object.entries(pekPrefill).forEach(([key,value]) => { if (value !== undefined) setValue(key as FieldPath<ProtocolWizardForm>, value); }); } setError(''); setApiFailure(null); setSuccess(null); }, [draftKey, open, orderId, orderServiceItemId, pekPrefill, setValue]);
  useEffect(() => {
    if (!open || draftPrompt || success) return;
    let timer = 0;
    const subscription = watch((formValue) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const stored: StoredDraft = {
          version: DRAFT_VERSION,
          timestamp: new Date().toISOString(),
          step,
          form: formValue as ProtocolWizardForm,
          idempotencyKey: idempotencyKeyRef.current,
          payloadFingerprint: submittedFingerprintRef.current,
        };
        sessionStorage.setItem(draftKey, JSON.stringify(stored));
      }, 1000);
    });
    return () => { window.clearTimeout(timer); subscription.unsubscribe(); };
  }, [draftKey,draftPrompt,open,step,success,watch]);
  useEffect(() => {
    const defaultLaboratory = defaultLaboratoryQuery.data;
    if (!open || !defaultLaboratory?.active || getValues('laboratoryId')) return;
    setValue('laboratoryId', String(defaultLaboratory.id), { shouldDirty: false });
  }, [defaultLaboratoryQuery.data, getValues, open, setValue]);
  useEffect(() => {
    if (!open || getValues('executorId') || !user?.id) return;
    const currentEmployee = executorOptions.find((item) => String(item.userId || '') === String(user.id));
    if (currentEmployee) setValue('executorId', String(currentEmployee.executorId), { shouldDirty: false });
  }, [executorOptions, getValues, open, setValue, user?.id]);
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
    if (!values.companyId) result.push({ message:'Выберите компанию.',step:0 });
    if (!values.objectId) result.push({ message:'Выберите зарегистрированный объект компании.',step:0 });
    else if (!selectedObject || selectedObject.virtual || selectedObject.isVirtual || selectedObject.persisted === false) result.push({ message:'Перед созданием протокола сохраните объект компании.',step:0,field:'objectId' });
    if (!values.laboratoryId) result.push({ message:'Выберите лабораторию.',step:1 });
    if (!values.executorId) result.push({ message:'Выберите исполнителя лаборатории.',step:1 });
    else if (!selectedExecutor || selectedExecutor.active === false || String(selectedExecutor.laboratoryId) !== String(values.laboratoryId)) result.push({ message:'Выберите исполнителя выбранной лаборатории.',step:1 });
    if (!values.defaultMeasurementDeviceId) result.push({ message:'Выберите действующий прибор.',step:1,field:'defaultMeasurementDeviceId' });
    if (!values.protocolDate) result.push({ message:'Укажите дату протокола.',step:0 });
    if (!values.sampleDate) result.push({ message:'Укажите дату отбора пробы.',step:0 });
    if (!values.measurementDate) result.push({ message:'Укажите дату измерения.',step:0 });
    if (!values.testingStartDate) result.push({ message:'Укажите дату начала испытаний.',step:0 });
    if (!values.testingEndDate) result.push({ message:'Укажите дату завершения испытаний.',step:0 });
    if (!values.measurementTime) result.push({ message:'Укажите время измерения.',step:0 });
    if (!trimmed(values.measurementPlace)) result.push({ message:'Укажите место измерения.',step:0 });
    if (trimmed(values.sourceNumber).replace(/[\u0000-\u001F\u007F]/g, '').length > 80) result.push({ message:'Номер источника должен содержать не более 80 символов',step:0,field:'sourceNumber' });
    if (values.testingStartDate && values.testingEndDate && values.testingEndDate < values.testingStartDate) result.push({ message:'Дата завершения испытаний не может быть раньше даты начала.',step:0 });
    if (values.sampleDate && values.measurementDate && values.measurementDate < values.sampleDate) result.push({ message:'Дата измерения не может быть раньше даты отбора.',step:0 });
    if (isWaterProtocolType(values.templateId) && !values.waterType) result.push({ message:'Выберите тип воды',step:WATER_CONDITIONS_STEP_INDEX,field:'waterType' });
    if (isWaterProtocolType(values.templateId) && !values.waterUseCategory) result.push({ message:'Выберите категорию водопользования',step:WATER_CONDITIONS_STEP_INDEX,field:'waterUseCategory' });
    validateDraft(values).forEach((issue) => result.push({
      message: issue.message,
      step: 2,
      field: issue.field as FieldPath<ProtocolWizardForm>,
    }));
    const rows = (values.results || []).filter((row) => trimmed(row?.indicatorName) || trimmed(row?.value) || trimmed(row?.textValue));
    rows.forEach((row,index) => { const device = devices.find((item) => String(item.id) === row.measurementDeviceId); if (!row.measurementDeviceId) result.push({ message:`Строка ${index + 1}: выберите прибор.`,step:2 }); else if (!device || !isDeviceValidForDate(device,values.measurementDate)) result.push({ message:`Строка ${index + 1}: срок поверки прибора истёк или прибор неактивен.`,step:2 }); if (!trimmed(row.testingMethodNd || row.methodDocument || values.testingMethodNd)) result.push({ message:`Строка ${index + 1}: укажите методику испытаний.`,step:2,field:`results.${index}.testingMethodNd` as FieldPath<ProtocolWizardForm> }); });
    if (!trimmed(values.testingMethodNd)) result.push({ message:'Укажите НД на метод испытаний.',step:2 });
    return result.map((item, index) => ({
      ...item,
      code: `WIZARD_${item.field ? String(item.field).replace(/[^a-z0-9]+/gi, '_').toUpperCase() : `${item.step}_${index}`}`,
      fieldPath: item.field ? String(item.field) : '',
      severity: 'ERROR',
    }));
  }, [devices,selectedExecutor,selectedObject,values]);
  const approvalIssues = useMemo<WizardIssue[]>(() => {
    const draftKeys = new Set(validateDraft(values).map((issue) => `${issue.field}:${issue.message}`));
    const extras = validateForApproval(values)
      .filter((issue) => !draftKeys.has(`${issue.field}:${issue.message}`))
      .map((issue, index) => ({
        code: `APPROVAL_${index}_${issue.field.replace(/[^a-z0-9]+/gi, '_').toUpperCase()}`,
        step: 2,
        field: issue.field as FieldPath<ProtocolWizardForm>,
        fieldPath: issue.field,
        severity: 'ERROR' as const,
        message: issue.message,
      }));
    return [...issues, ...extras];
  }, [issues, values]);
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
  const canSaveDraft = submitPayloadResult.valid
    && issues.length === 0
    && formState.isValid
    && Object.keys(formState.errors).length === 0
    && !requiredLookupsLoading
    && !mutation.isPending;
  const canCreate = canSaveDraft && approvalIssues.length === 0;
  const canContinue = step === 0
    ? Boolean(values.templateId && values.companyId && values.objectId && values.protocolDate && trimmed(values.measurementPlace))
    : step === 1
      ? Boolean(values.laboratoryId && values.executorId && values.defaultMeasurementDeviceId)
      : step === 2
        ? !issues.some((item) => item.step === 2)
        : step === steps.length - 1 ? canCreate : true;
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
  const requestClose = () => { if (mutation.isPending) return; if (formState.isDirty || sessionStorage.getItem(draftKey)) setClosePrompt(true); else onClose(); };
  const restoreDraft = () => {
    try {
      const raw = JSON.parse(sessionStorage.getItem(draftKey) || '') as Partial<StoredDraft> & { form?: ProtocolWizardForm };
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
        sessionStorage.setItem(draftKey, JSON.stringify({
          version: DRAFT_VERSION,
          timestamp: new Date().toISOString(),
          step: restoredStep,
          form: migratedForm,
          idempotencyKey: idempotencyKeyRef.current,
          payloadFingerprint: submittedFingerprintRef.current,
        } satisfies StoredDraft));
      }
    } catch {
      sessionStorage.removeItem(draftKey);
      reset(createWizardDefaults());
      idempotencyKeyRef.current = null;
      submittedFingerprintRef.current = null;
    }
    setDraftPrompt(false);
  };
  const newDraft = () => { sessionStorage.removeItem(draftKey); idempotencyKeyRef.current = null; submittedFingerprintRef.current = null; submittedPayloadRef.current = null; reset(normalizeProtocolWizardForm({ ...(pekPrefill || {}), orderId, orderServiceItemId })); setStep(0); setMaxVisited(0); setDraftPrompt(false); };
  const saveDraft = () => {
    sessionStorage.setItem(draftKey, JSON.stringify({
      version: DRAFT_VERSION,
      timestamp: new Date().toISOString(),
      step,
      form: getValues(),
      idempotencyKey: idempotencyKeyRef.current,
      payloadFingerprint: submittedFingerprintRef.current,
    } satisfies StoredDraft));
  };
  const createProtocol = async (signAfterCreate = false) => {
    if (mutation.isPending) return;
    if (!acquireQuickCreateLock(submittingRef)) return;
    setError('');
    setApiFailure(null);
    setServerIssues([]);
    form.clearErrors();
    try {
      const blockingIssues = signAfterCreate ? approvalIssues : issues;
      if (blockingIssues.length) {
        const firstIssue = blockingIssues[0];
        setServerIssues(blockingIssues);
        setStep(firstIssue.step);
        setError(signAfterCreate ? 'Перед подписанием подтвердите нормативы.' : 'Проверьте обязательные поля черновика.');
        if (firstIssue.field) form.setError(firstIssue.field, { type: 'validate', message: firstIssue.message });
        return;
      }
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
      sessionStorage.setItem(draftKey, JSON.stringify({
        version: DRAFT_VERSION,
        timestamp: new Date().toISOString(),
        step,
        form: getValues(),
        idempotencyKey: attempt.idempotencyKey,
        payloadFingerprint: attempt.payloadFingerprint,
      } satisfies StoredDraft));
      let created = await mutation.mutateAsync({
        payload,
        idempotencyKey: attempt.idempotencyKey,
      });
      if (!created.id) throw new Error('Backend не вернул идентификатор созданного протокола.');
      if (signAfterCreate) {
        setSigningPhase('LOADING_DOCUMENT');
        created = await protocolService.calculateProtocol(created.id, created.version);
        created = await protocolService.checkNormatives(created.id, created.version);
        const file = await protocolService.downloadPdf(created.id);
        const cmsSignatureBase64 = await createProtocolCmsSignature(file.blob, setSigningPhase);
        setSigningPhase('VERIFYING_SIGNATURE');
        created = await protocolService.signProtocol(created.id, { cmsSignatureBase64 });
        setSigningPhase('SIGNED');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['protocols'] }),
        queryClient.invalidateQueries({ queryKey: ['protocol-statistics'] }),
      ]);
      sessionStorage.removeItem(draftKey);
      idempotencyKeyRef.current = null;
      submittedFingerprintRef.current = null;
      submittedPayloadRef.current = null;
      if (signAfterCreate || created.syncWarning) setSuccess(created);
      else onCreated(created);
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
      const signingError = signAfterCreate && /ncalayer|websocket|socket|certificate|сертификат/i.test(normalized.message);
      setError(mappedIssues.length
        ? ''
        : signingError
          ? 'Не удалось подключиться к NCALayer. Запустите NCALayer и повторите.'
          : normalized.resultIndex === undefined
            ? errorResolution.message
            : `Строка ${normalized.resultIndex + 1}: ${errorResolution.message}`);
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
      else if (normalized.resultIndex !== undefined) setStep(2);
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
  const content = step === 0 ? <div className="space-y-5"><BasicDataStep templates={templates} companies={companies} objects={objects} lockedCompanyId={lockedPekCompanyId} onCompanyChange={changeCompany} /><details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-bold text-eco-800">Условия и методики</summary><div className="mt-5 space-y-6"><EnvironmentStep weatherLoading={weatherQuery.isFetching} weatherMessage={weatherMessage} onRefresh={() => void weatherQuery.refetch()} waterTypeOptions={waterTypeOptions} waterUseCategoryOptions={waterUseCategoryOptions} /><MethodsStep /></div></details></div> : step === 1 ? <ExecutorDeviceStep laboratories={laboratories} employees={executorOptions} devices={devices} onLaboratoryChange={changeLaboratory} /> : step === 2 ? <ResultsStep devices={devices} /> : step === 3 ? <ProtocolCheckStep issues={approvalIssues} onGoTo={goToIssue} /> : <ProtocolSigningStep companies={companies} objects={objects} employees={executorOptions} />;
  const requestCode = apiFailure?.requestCode || apiFailure?.traceId || apiFailure?.requestId;
  const debugPanel = import.meta.env.DEV && step === 4 ? (
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

  return <FormProvider {...form}><Modal open={open} onClose={requestClose} size="wizard" closeOnBackdrop={false} loading={mutation.isPending} contentClassName="!overflow-hidden !p-0 sm:!p-0"><div className="flex h-full min-h-0 flex-col"><ProtocolWizardHeader step={step} total={steps.length} title={steps[step]} submitting={mutation.isPending} onClose={requestClose} /><ProtocolWizardSteps steps={steps} current={step} maxVisited={maxVisited} onSelect={setStep} /><main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{apiFailure && <QuickCreateErrorPanel error={apiFailure} message={error || apiFailure.message} pending={mutation.isPending} onRetry={() => void createProtocol(false)} onReview={() => setStep(3)} onCopyCode={copyErrorCode} onCopyTechnicalInfo={copyTechnicalInfo} />}{!apiFailure && error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><h3 className="font-black">Проверьте данные</h3><p className="mt-1 font-semibold">{error}</p></div>}{serverIssues.length > 0 && <div className="mb-4"><WizardValidationSummary issues={serverIssues} onGoTo={goToIssue} />{requestCode && <p className="mt-2 text-xs text-slate-600">Код обращения: {requestCode}</p>}</div>}{debugPanel}{success ? <div className="grid min-h-80 place-items-center text-center"><div><h3 className="text-2xl font-black text-emerald-800">Протокол №{success.protocolNumber || success.number || success.id} создан{success.signedAt ? ' и подписан' : ''}</h3>{success.syncWarning && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{success.syncWarning}</p>}<p className="mt-4 text-slate-600">{success.signedAt ? <>Подписал: <strong>{user?.name || user?.email}</strong></> : 'Черновик сохранён'}</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Button type="button" variant="secondary" onClick={() => onCreated(success)}>Открыть созданный протокол</Button></div></div></div> : content}</main>{!success && <ProtocolWizardFooter step={step} total={steps.length} submitting={mutation.isPending} retrying={Boolean(apiFailure)} canContinue={canContinue} canSaveDraft={canSaveDraft} onBack={() => { setError(''); setStep((current) => Math.max(0,current - 1)); }} onNext={goNext} onCreate={() => setSignPrompt(true)} onSaveDraft={() => void createProtocol(false)} />}</div></Modal>
    <Modal open={signPrompt} onClose={() => !mutation.isPending && setSignPrompt(false)} closeOnBackdrop={false} size="sm" title="Подписание протокола" footer={<><Button type="button" variant="secondary" disabled={mutation.isPending} onClick={() => setSignPrompt(false)}>Отмена</Button><Button type="button" disabled={mutation.isPending} onClick={() => { setSignPrompt(false); void createProtocol(true); }}>{mutation.isPending ? 'Подписание…' : 'Продолжить'}</Button></>}><p className="text-sm text-slate-700">Убедитесь, что NCALayer запущен, затем нажмите «Продолжить».</p>{signingPhase !== 'IDLE' && <div className="mt-4 rounded-xl bg-eco-50 p-3 text-sm font-bold text-eco-900">{protocolSigningPhaseLabel[signingPhase]}</div>}</Modal>
    <Modal open={draftPrompt && open} onClose={() => {}} closeOnBackdrop={false} size="sm" title="Найдена незавершённая форма протокола" footer={<><Button type="button" variant="secondary" onClick={newDraft}>Начать заново</Button><Button type="button" onClick={restoreDraft}>Продолжить</Button></>}><p className="text-sm text-slate-600">Продолжить заполнение временного черновика из текущей сессии?</p></Modal>
    <Modal open={closePrompt} onClose={() => setClosePrompt(false)} closeOnBackdrop={false} size="sm" title="Закрыть создание протокола?" footer={<><Button type="button" variant="secondary" onClick={() => setClosePrompt(false)}>Продолжить заполнение</Button><Button type="button" onClick={() => { setClosePrompt(false); onClose(); }}>Закрыть</Button><Button type="button" variant="danger" onClick={() => { sessionStorage.removeItem(draftKey); reset(createWizardDefaults()); setClosePrompt(false); onClose(); }}>Очистить и закрыть</Button></>}><p className="text-sm text-slate-600">Введённые данные сохранены как временный черновик и будут доступны до завершения текущей сессии.</p></Modal>
    <Modal open={Boolean(pendingType)} onClose={() => setPendingType(null)} closeOnBackdrop={false} size="sm" title="Изменить тип протокола?" footer={<><Button type="button" variant="secondary" onClick={() => setPendingType(null)}>Отмена</Button><Button type="button" variant="danger" onClick={applyTypeChange}>Изменить тип</Button></>}><p className="text-sm text-slate-600">При изменении типа результаты, приборы и нормативы будут очищены.</p></Modal>
  </FormProvider>;
};
export default CreateProtocolWizardModal;
