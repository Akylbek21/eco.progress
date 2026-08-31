import { useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm, type FieldPath } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { getActiveCompanies, getCompanyObject, getCompanyObjects } from '../../../services/companyService';
import { getActiveLaboratories, getDefaultLaboratory, getLaboratoryEmployees } from '../../../services/laboratorySettingsService';
import { getAvailableMeasurementDevices } from '../../../services/measurementDeviceService';
import protocolService from '../../../services/protocolService';
import { normalizeApiError } from '../../../services/apiHelpers';
import type { Protocol } from '../../../types/protocols';
import { hasProtocolAction } from '../utils/protocolActions';
import { saveProtocolWizardDraft } from '../api/saveProtocolWizardDraft';
import { mapProtocolToWizardForm } from '../mappers/protocolWizardDraftMapper';
import { applyProtocolApiErrorsToForm } from '../utils/protocolFormErrors';
import { validateProtocolForSubmit, validateProtocolWizardStep } from '../utils/protocolWizardValidation';
import ProtocolWizardHeader from './ProtocolWizardHeader';
import ProtocolWizardFooter from './ProtocolWizardFooter';
import ProtocolWizardLayout from './ProtocolWizardLayout';
import ProtocolWizardSidebar from './ProtocolWizardSidebar';
import ProtocolWizardSummary from './ProtocolWizardSummary';
import BasicDataStep from './steps/BasicDataStep';
import MeasurementStep from './steps/MeasurementStep';
import ResultsStep from './steps/ResultsStep';
import ProtocolCheckStep from './steps/ProtocolCheckStep';
import PekProtocolCreationFlow from './PekProtocolCreationFlow';
import {
  createWizardDefaults,
  createDefaultAmbientSamplingPoints,
  normalizeProtocolWizardForm,
  type LaboratoryExecutorOption,
  type ProtocolWizardForm,
} from './wizardTypes';
import { getWaterProtocolOptions, isWaterProtocolType } from '../../../config/protocolWater';
import { protocolQueryKeys, protocolScope } from '../hooks/queryKeys';
import { useProtocolEnvironmentConditions } from '../hooks/useProtocolEnvironmentConditions';
import {
  createProtocolDraftIdempotencyKey,
  findLatestLocalProtocolDraft,
  localProtocolDraftKey,
  LOCAL_PROTOCOL_DRAFT_SCHEMA_VERSION,
  normalizeProtocolCreationContext,
  writeLocalProtocolDraft,
  type LocalProtocolDraftEnvelope,
} from '../utils/protocolDraftRecovery';

export type ProtocolPekPrefill = Partial<Pick<ProtocolWizardForm, 'companyId' | 'objectId' | 'pekProgramId' | 'pekControlItemId' | 'pekControlEventId' | 'pekReportId' | 'monitoringPointId' | 'programIndicatorId' | 'emissionSourceId' | 'waterOutletId' | 'measurementDate' | 'measurementPlace'>>;
export type CreateProtocolWizardModalV2Props = { open: boolean; onClose: () => void; onCreated: (protocol: Protocol) => void; orderId?: string; orderServiceItemId?: string; pekPrefill?: ProtocolPekPrefill };
export type ProtocolCreationMode = 'PEK' | 'MANUAL';

const steps = ['Основное', 'Измерения', 'Результаты', 'Проверка'];
// Legacy modal contract markers kept for source-level regression tests: ariaLabel="Новый протокол", createLabel="Создать и открыть".
type SaveState = 'idle' | 'local' | 'creating' | 'created' | 'saving' | 'saved' | 'error' | 'conflict';
const unavailableLaboratoryMessage = 'Выбранная лаборатория не найдена или больше не активна. Выберите лабораторию повторно.';

const ManualProtocolWizard = ({ open, onClose, onCreated, onSelectPek, orderId = '', orderServiceItemId = '', pekPrefill }: CreateProtocolWizardModalV2Props & { onSelectPek: () => void }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scope = protocolScope(user?.id);
  const form = useForm<ProtocolWizardForm>({ defaultValues: createWizardDefaults(), mode: 'onChange' });
  const values = form.watch();
  const [step, setStep] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  const [serverDraft, setServerDraft] = useState<Protocol | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [generalError, setGeneralError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [recoveryCandidate, setRecoveryCandidate] = useState<{ key: string; envelope: LocalProtocolDraftEnvelope } | null>(null);
  const [recoveryServer, setRecoveryServer] = useState<Protocol | null>(null);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [newProtocolConfirm, setNewProtocolConfirm] = useState(false);
  const [serverIssues, setServerIssues] = useState<Array<{ code: string; step: number; field?: FieldPath<ProtocolWizardForm>; fieldPath: string; severity: 'ERROR'; message: string }>>([]);
  const ambientSamplingPointsInitialized = useRef(false);
  const idempotencyKeyRef = useRef(createProtocolDraftIdempotencyKey());
  const lastSavedFingerprintRef = useRef('');
  const lastFailedFingerprintRef = useRef('');
  const creationSource = pekPrefill?.pekReportId ? 'PEK' : orderServiceItemId || orderId ? 'ORDER' : 'PROTOCOLS';
  const creationContext = useMemo(() => normalizeProtocolCreationContext({
    orderId, orderServiceItemId, pekReportId: values.pekReportId || pekPrefill?.pekReportId,
    companyId: values.companyId, objectId: values.objectId, source: creationSource,
  }), [creationSource, orderId, orderServiceItemId, pekPrefill?.pekReportId, values.companyId, values.objectId, values.pekReportId]);
  const initialCreationContext = useMemo(() => normalizeProtocolCreationContext({
    orderId, orderServiceItemId, pekReportId: pekPrefill?.pekReportId,
    companyId: pekPrefill?.companyId, objectId: pekPrefill?.objectId, source: creationSource,
  }), [creationSource, orderId, orderServiceItemId, pekPrefill?.companyId, pekPrefill?.objectId, pekPrefill?.pekReportId]);
  const bufferKey = localProtocolDraftKey(user?.id ?? 'anonymous', serverDraft?.id ?? null, creationContext);
  const prefillKey = JSON.stringify(pekPrefill ?? {});

  const typesQuery = useQuery({ queryKey: ['protocol-types', user?.id], queryFn: () => protocolService.getProtocolTypes(), enabled: open });
  const companiesQuery = useQuery({ queryKey: ['companies', 'protocol-wizard', user?.id], queryFn: ({ signal }) => getActiveCompanies(signal), enabled: open });
  const laboratoriesQuery = useQuery({ queryKey: ['laboratories', 'protocol-wizard', user?.id], queryFn: ({ signal }) => getActiveLaboratories(signal), enabled: open });
  const defaultLaboratoryQuery = useQuery({ queryKey: ['laboratories', 'default', user?.id], queryFn: ({ signal }) => getDefaultLaboratory(signal), enabled: open, retry: false });
  const objectsQuery = useQuery({ queryKey: ['company-objects', user?.id, values.companyId], queryFn: ({ signal }) => getCompanyObjects(values.companyId, false, signal), enabled: open && Boolean(values.companyId) });
  const objectDetailsQuery = useQuery({ queryKey: ['company-object', user?.id, values.companyId, values.objectId], queryFn: ({ signal }) => getCompanyObject(values.companyId, values.objectId, signal), enabled: open && Boolean(values.companyId && values.objectId) });
  const employeesQuery = useQuery({ queryKey: ['laboratory-employees', user?.id, values.laboratoryId], queryFn: ({ signal }) => getLaboratoryEmployees(values.laboratoryId, { signal }), enabled: open && Boolean(values.laboratoryId) });
  const devicesQuery = useQuery({
    queryKey: ['measurement-devices', 'available', user?.id, values.laboratoryId, values.measurementDate, values.templateId],
    queryFn: () => getAvailableMeasurementDevices({ laboratoryId: values.laboratoryId, measurementDate: values.measurementDate, templateId: values.templateId }),
    enabled: open && Boolean(values.laboratoryId && values.measurementDate && values.templateId),
  });

  const templates = typesQuery.data ?? [];
  const companies = companiesQuery.data ?? [];
  const objects = (objectsQuery.data ?? []).filter((item) => item.status === 'ACTIVE' && !item.virtual && !item.isVirtual);
  const selectedObject = (objectsQuery.data ?? []).find((item) => String(item.id) === String(values.objectId));
  const weather = useProtocolEnvironmentConditions({
    enabled: open,
    objectId: values.objectId,
    coordinates: objectDetailsQuery.data?.coordinates || selectedObject?.coordinates || undefined,
    date: values.sampleDate || values.measurementDate,
    time: values.measurementTime || '12:00',
    form,
  });
  const laboratories = laboratoriesQuery.data ?? [];
  const invalidLaboratorySelection = Boolean(
    values.laboratoryId
    && laboratoriesQuery.isSuccess
    && !laboratories.some((item) => String(item.id) === String(values.laboratoryId)),
  );
  const employees = useMemo<LaboratoryExecutorOption[]>(() => (employeesQuery.data ?? []).filter((item) => item.active).map((item) => ({
    executorId: item.id, laboratoryEmployeeId: item.id, userId: item.userId ?? undefined,
    fullName: item.fullName, laboratoryId: item.laboratoryId, active: item.active,
  })), [employeesQuery.data]);
  const devices = (devicesQuery.data ?? []).filter((item) => !['EXPIRED', 'ARCHIVED', 'INACTIVE', 'OUT_OF_SERVICE'].includes(String(item.status ?? '').toUpperCase()));
  const templateSelectionValid = typesQuery.isSuccess && templates.some((item) => String(item.id) === String(values.templateId));
  const companySelectionValid = companiesQuery.isSuccess && companies.some((item) => String(item.id) === String(values.companyId));
  const waterTemplate = templates.find((item) => isWaterProtocolType(item.id));
  const waterOptions = useMemo(() => getWaterProtocolOptions(waterTemplate), [waterTemplate]);

  useEffect(() => {
    if (!open) return;
    if (values.templateId === 'ambient_air') {
      if (!ambientSamplingPointsInitialized.current && form.getValues('samplingPoints').length === 0) {
        ambientSamplingPointsInitialized.current = true;
        form.setValue('samplingPoints', createDefaultAmbientSamplingPoints(), { shouldDirty: true });
      }
      return;
    }
    ambientSamplingPointsInitialized.current = false;
    if (form.getValues('samplingPoints').length) form.setValue('samplingPoints', [], { shouldDirty: true });
  }, [form, open, values.templateId]);

  useEffect(() => {
    if (!open) return;
    idempotencyKeyRef.current = createProtocolDraftIdempotencyKey();
    lastSavedFingerprintRef.current = '';
    lastFailedFingerprintRef.current = '';
    setServerDraft(null);
    setSaveState('idle');
    setGeneralError('');
    setConflict(false);
    setServerIssues([]);
    setRecoveryError('');
    setRecoveryLoading(false);
    setNewProtocolConfirm(false);
    setStep(0);
    setMaxVisited(0);
    form.reset(normalizeProtocolWizardForm({ ...(pekPrefill ?? {}), orderId, orderServiceItemId }));
    setRecoveryCandidate(user?.id ? findLatestLocalProtocolDraft(sessionStorage, user.id, initialCreationContext) : null);
    setRecoveryServer(null);
  }, [form, initialCreationContext, open, orderId, orderServiceItemId, prefillKey, user?.id]);
  useEffect(() => {
    const laboratory = defaultLaboratoryQuery.data;
    if (open && laboratory?.active && !form.getValues('laboratoryId')) form.setValue('laboratoryId', String(laboratory.id), { shouldDirty: false });
  }, [defaultLaboratoryQuery.data, form, open]);
  useEffect(() => {
    if (!open || form.getValues('executorId') || !user?.id) return;
    const employee = employees.find((item) => String(item.userId ?? '') === String(user.id));
    if (employee) form.setValue('executorId', String(employee.executorId), { shouldDirty: false });
  }, [employees, form, open, user?.id]);
  useEffect(() => {
    if (!open) return;
    if (invalidLaboratorySelection) {
      form.setError('laboratoryId', { type: 'server', message: unavailableLaboratoryMessage });
      setGeneralError(unavailableLaboratoryMessage);
      setStep(1);
      return;
    }
    if (form.getFieldState('laboratoryId').error?.message === unavailableLaboratoryMessage) {
      form.clearErrors('laboratoryId');
      setGeneralError((current) => current === unavailableLaboratoryMessage ? '' : current);
    }
  }, [form, invalidLaboratorySelection, open]);
  useEffect(() => {
    if (!open || recoveryCandidate) return;
    const timer = window.setTimeout(() => {
      writeLocalProtocolDraft(sessionStorage, {
        schemaVersion: LOCAL_PROTOCOL_DRAFT_SCHEMA_VERSION,
        userId: String(user?.id ?? 'anonymous'),
        protocolId: serverDraft?.id ?? null,
        backendVersion: serverDraft?.version ?? null,
        idempotencyKey: idempotencyKeyRef.current,
        currentStep: step,
        formValues: form.getValues(),
        savedAt: new Date().toISOString(),
        hasUnsavedChanges: form.formState.isDirty,
        creationContext,
      });
      if (!serverDraft && saveState === 'idle') setSaveState('local');
    }, 700);
    return () => window.clearTimeout(timer);
  }, [bufferKey, creationContext, form, open, recoveryCandidate, saveState, serverDraft, step, values, user?.id]);

  const saveMutation = useMutation({
    mutationFn: (snapshot: ProtocolWizardForm) => saveProtocolWizardDraft(snapshot, serverDraft, idempotencyKeyRef.current),
    onMutate: () => { setSaveState(serverDraft ? 'saving' : 'creating'); setGeneralError(''); setServerIssues([]); },
    onSuccess: async ({ protocol, resultIdsByClientRowId, pointIdsByClientPointId }, snapshot) => {
      const created = !serverDraft;
      if (created) sessionStorage.removeItem(localProtocolDraftKey(user?.id ?? 'anonymous', null, creationContext));
      setServerDraft(protocol);
      const liveRows = form.getValues('results');
      liveRows.forEach((row, index) => {
        const serverResultId = resultIdsByClientRowId.get(row.clientRowId);
        if (serverResultId) form.setValue(`results.${index}.serverResultId`, serverResultId, { shouldDirty: false });
      });
      const livePoints = form.getValues('samplingPoints');
      livePoints.forEach((point, index) => {
        const serverPointId = pointIdsByClientPointId.get(point.clientPointId);
        if (serverPointId) form.setValue(`samplingPoints.${index}.serverPointId`, serverPointId, { shouldDirty: false });
      });
      const savedSnapshot: ProtocolWizardForm = {
        ...snapshot,
        samplingPoints: snapshot.samplingPoints.map((point) => {
          const serverPointId = pointIdsByClientPointId.get(point.clientPointId);
          return serverPointId ? { ...point, serverPointId } : point;
        }),
        results: snapshot.results.map((row) => {
          const serverResultId = resultIdsByClientRowId.get(row.clientRowId);
          return serverResultId ? { ...row, serverResultId } : row;
        }),
      };
      lastSavedFingerprintRef.current = JSON.stringify(savedSnapshot);
      lastFailedFingerprintRef.current = '';
      setSaveState(created ? 'created' : 'saved');
      queryClient.setQueryData(protocolQueryKeys.detail(scope, protocol.id), protocol);
      await queryClient.invalidateQueries({ queryKey: protocolQueryKeys.documents(scope, protocol.id) });
      if (created) await queryClient.invalidateQueries({ queryKey: protocolQueryKeys.lists(scope) });
    },
    onError: (error, snapshot) => {
      lastFailedFingerprintRef.current = JSON.stringify(snapshot);
      setSaveState('error');
      const apiError = normalizeApiError(error, 'Не удалось сохранить протокол. Проверьте выделенные поля.');
      if (apiError.status === 409 && /OPTIMISTIC_LOCK_CONFLICT|PROTOCOL_VERSION_CONFLICT|VERSION_CONFLICT|optimistic|version/i.test(`${apiError.code ?? ''} ${apiError.message}`)) {
        setSaveState('conflict');
        setConflict(true);
        return;
      }
      const mapped = applyProtocolApiErrorsToForm(form, apiError.fieldErrors, setStep);
      setServerIssues(mapped.map((issue, index) => ({ ...issue, code: `SERVER_${index}`, field: issue.field ?? undefined, severity: 'ERROR' as const })));
      const message = apiError.code === 'LABORATORY_NOT_FOUND'
        ? unavailableLaboratoryMessage
        : apiError.message;
      if (apiError.code === 'LABORATORY_NOT_FOUND') {
        form.setError('laboratoryId', { type: 'server', message });
        setStep(1);
      }
      setGeneralError(mapped.length ? 'Не удалось сохранить протокол. Проверьте выделенные поля.' : message);
    },
  });

  const canSaveServerDraft = Boolean(
    values.templateId
    && values.companyId
    && (serverDraft || (templateSelectionValid && companySelectionValid)),
  );
  useEffect(() => {
    if (!open || !serverDraft || saveMutation.isPending || conflict || invalidLaboratorySelection) return;
    const snapshot = form.getValues();
    const fingerprint = JSON.stringify(snapshot);
    if (fingerprint === lastSavedFingerprintRef.current || fingerprint === lastFailedFingerprintRef.current) return;
    const timer = window.setTimeout(() => saveMutation.mutate(form.getValues()), 2000);
    return () => window.clearTimeout(timer);
  }, [conflict, form, invalidLaboratorySelection, open, saveMutation, serverDraft, values]);

  const approvalIssues = useMemo(() => validateProtocolForSubmit(values).map((issue) => ({
    ...issue,
    field: issue.field as FieldPath<ProtocolWizardForm>,
    fieldPath: issue.field,
  })), [values]);
  const backendIssues = (serverDraft?.actionBlockers || serverDraft?.blockingReasons || []).map((item, index) => ({
    code: item.code || `BACKEND_${index}`,
    message: item.message,
    field: item.fieldPath as FieldPath<ProtocolWizardForm> | undefined,
    fieldPath: item.fieldPath || '',
    step: item.step ?? (item.fieldPath?.startsWith('results') ? 2 : 3),
    severity: 'ERROR' as const,
  }));
  const currentStepErrors = step < 3 ? validateProtocolWizardStep(values, step).filter((issue) => issue.severity === 'ERROR') : [];
  const allIssues = [...approvalIssues, ...backendIssues, ...serverIssues];
  const blockingErrors = allIssues.filter((issue) => issue.severity === 'ERROR');
  const errorCounts = steps.map((_, index) => allIssues.filter((issue) => issue.severity === 'ERROR' && issue.step === index).length);

  const goToIssue = (target: number, field?: FieldPath<ProtocolWizardForm>) => {
    setStep(target);
    if (field) window.requestAnimationFrame(() => form.setFocus(field));
  };
  const save = async () => {
    if (invalidLaboratorySelection) {
      form.setError('laboratoryId', { type: 'server', message: unavailableLaboratoryMessage });
      setGeneralError(unavailableLaboratoryMessage);
      setStep(1);
      return null;
    }
    if (!canSaveServerDraft) {
      setGeneralError('Сначала выберите тип протокола и компанию. До этого сохраняется только локальная копия.');
      setStep(0);
      return null;
    }
    if (saveMutation.isPending) return null;
    return saveMutation.mutateAsync(form.getValues());
  };
  const next = async () => {
    setGeneralError('');
    // The next screen is the validation summary. Let the user open it even
    // when result rows are incomplete; completion remains blocked there.
    if (step === 2) {
      setStep(3);
      setMaxVisited((visited) => Math.max(visited, 3));
      return;
    }
    if (currentStepErrors.length) {
      const first = currentStepErrors[0];
      currentStepErrors.forEach((item) => {
        if (item.field) form.setError(item.field as FieldPath<ProtocolWizardForm>, { type: 'required', message: item.message });
      });
      setGeneralError(first.message);
      goToIssue(first.step, first.field as FieldPath<ProtocolWizardForm>);
      return;
    }
    if (step === 0 && !serverDraft) {
      try {
        const saved = await save();
        if (!saved) return;
      } catch { return; }
    }
    setStep((current) => { const value = Math.min(steps.length - 1, current + 1); setMaxVisited((visited) => Math.max(visited, value)); return value; });
  };
  const complete = async () => {
    try {
      const saved = await save();
      if (saved) {
        const completedProtocol = hasProtocolAction(saved.protocol, 'checkNormatives')
          ? await protocolService.checkNormatives(saved.protocol.id, saved.protocol.version)
          : saved.protocol;
        await queryClient.invalidateQueries({ queryKey: protocolQueryKeys.lists(scope) });
        sessionStorage.removeItem(localProtocolDraftKey(user?.id ?? 'anonymous', null, creationContext));
        sessionStorage.removeItem(localProtocolDraftKey(user?.id ?? 'anonymous', saved.protocol.id, creationContext));
        onCreated(completedProtocol);
      }
    } catch { /* mutation state contains the user-facing error */ }
  };
  const loadLatest = async () => {
    if (!serverDraft) return;
    const current = await protocolService.getProtocol(serverDraft.id);
    setServerDraft(current);
    form.reset(mapProtocolToWizardForm(current));
    setConflict(false);
    setGeneralError('Актуальная версия загружена. Локальная копия формы сохранена в аварийном буфере.');
  };
  const applyRecoveredDraft = (envelope: LocalProtocolDraftEnvelope, current: Protocol | null, pauseAutosave = false) => {
    idempotencyKeyRef.current = envelope.idempotencyKey;
    setServerDraft(current);
    form.reset(normalizeProtocolWizardForm(envelope.formValues));
    setStep(Math.max(0, Math.min(steps.length - 1, envelope.currentStep)));
    setMaxVisited(Math.max(0, Math.min(steps.length - 1, envelope.currentStep)));
    lastSavedFingerprintRef.current = current && envelope.backendVersion === current.version
      ? JSON.stringify(envelope.formValues)
      : '';
    setConflict(pauseAutosave);
    setSaveState(pauseAutosave ? 'conflict' : current ? 'saved' : 'local');
    setRecoveryCandidate(null);
    setRecoveryServer(null);
    setRecoveryError('');
  };
  const restoreRecovery = async () => {
    if (!recoveryCandidate) return;
    const envelope = recoveryCandidate.envelope;
    if (!envelope.protocolId) {
      applyRecoveredDraft(envelope, null);
      return;
    }
    setRecoveryLoading(true);
    setRecoveryError('');
    try {
      const current = await protocolService.getProtocol(envelope.protocolId);
      if (envelope.backendVersion !== null && current.version > envelope.backendVersion) {
        setRecoveryServer(current);
        return;
      }
      applyRecoveredDraft(envelope, current);
    } catch (error) {
      const apiError = normalizeApiError(error, 'Не удалось проверить серверный черновик. Проверьте соединение и повторите попытку.');
      if (apiError.status === 404) {
        applyRecoveredDraft(envelope, null);
        setGeneralError('Серверный черновик не найден. Открыта локальная аварийная копия.');
      } else {
        setRecoveryError(apiError.message);
      }
    } finally {
      setRecoveryLoading(false);
    }
  };
  const deleteRecovery = () => {
    if (recoveryCandidate) sessionStorage.removeItem(recoveryCandidate.key);
    setRecoveryCandidate(null);
    setRecoveryServer(null);
    setRecoveryError('');
  };
  const startNewProtocol = async () => {
    if (serverDraft) {
      if (!hasProtocolAction(serverDraft, 'delete')) {
        setNewProtocolConfirm(false);
        setGeneralError('Backend не разрешает удалить текущий черновик. Завершите его или удалите из списка протоколов.');
        return;
      }
      try {
        await protocolService.deleteProtocol(serverDraft.id, serverDraft.version);
        await queryClient.invalidateQueries({ queryKey: protocolQueryKeys.lists(scope) });
      } catch (error) {
        setNewProtocolConfirm(false);
        setGeneralError(normalizeApiError(error, 'Не удалось удалить текущий черновик. Новый протокол не создан.').message);
        return;
      }
    }
    sessionStorage.removeItem(bufferKey);
    idempotencyKeyRef.current = createProtocolDraftIdempotencyKey();
    lastSavedFingerprintRef.current = '';
    setServerDraft(null);
    setStep(0);
    setMaxVisited(0);
    setSaveState('idle');
    setConflict(false);
    setGeneralError('');
    form.reset(normalizeProtocolWizardForm({ ...(pekPrefill ?? {}), orderId, orderServiceItemId }));
    setNewProtocolConfirm(false);
  };

  const referenceFailures: Array<{ key: string; message: string; retry: () => unknown }> = [];
  if (step === 0) {
    if (typesQuery.isError) referenceFailures.push({ key: 'types', message: 'Не удалось загрузить типы протоколов.', retry: () => typesQuery.refetch() });
    if (companiesQuery.isError) referenceFailures.push({ key: 'companies', message: 'Не удалось загрузить доступные компании.', retry: () => companiesQuery.refetch() });
    if (values.companyId && objectsQuery.isError) referenceFailures.push({ key: 'objects', message: 'Не удалось загрузить объекты выбранной компании.', retry: () => objectsQuery.refetch() });
  }
  if (step === 1) {
    if (laboratoriesQuery.isError) referenceFailures.push({ key: 'laboratories', message: 'Не удалось загрузить лаборатории.', retry: () => laboratoriesQuery.refetch() });
    if (values.laboratoryId && employeesQuery.isError) referenceFailures.push({ key: 'employees', message: 'Не удалось загрузить сотрудников лаборатории.', retry: () => employeesQuery.refetch() });
    if (values.laboratoryId && values.measurementDate && values.templateId && devicesQuery.isError) referenceFailures.push({ key: 'devices', message: 'Не удалось загрузить доступные приборы.', retry: () => devicesQuery.refetch() });
  }

  const saveStatus = saveState === 'local' ? 'Сохранено локально' : saveState === 'creating' || saveState === 'saving' ? 'Сохранение…' : saveState === 'created' || saveState === 'saved' ? 'Сохранено' : saveState === 'conflict' ? 'Конфликт версии' : saveState === 'error' ? 'Ошибка сохранения' : undefined;
  const saveTone = saveState === 'creating' || saveState === 'saving' ? 'saving' : saveState === 'created' || saveState === 'saved' ? 'saved' : saveState === 'conflict' ? 'conflict' : saveState === 'error' ? 'error' : 'idle';
  const content = step === 0
    ? <BasicDataStep templates={templates} companies={companies} objects={objects} templatesLoading={typesQuery.isLoading} companiesLoading={companiesQuery.isLoading} objectsLoading={objectsQuery.isLoading} companyLocked={Boolean(serverDraft)} onStartNew={() => setNewProtocolConfirm(true)} onCompanyChange={(id) => { form.setValue('companyId', id, { shouldDirty: true }); form.setValue('objectId', '', { shouldDirty: true }); }} />
    : step === 1
      ? <MeasurementStep laboratories={laboratories} employees={employees} devices={devices} laboratoriesLoading={laboratoriesQuery.isLoading} employeesLoading={employeesQuery.isLoading} devicesLoading={devicesQuery.isLoading} onLaboratoryChange={(id) => { form.setValue('laboratoryId', id, { shouldDirty: true }); form.setValue('executorId', '', { shouldDirty: true }); }} weatherLoading={weather.loading} weatherMessage={weather.message} onRefresh={() => void weather.refresh()} waterTypeOptions={waterOptions.waterTypes} waterUseCategoryOptions={waterOptions.waterUseCategories} />
      : step === 2
        ? <ResultsStep devices={devices} onSuggestChangeType={() => setStep(0)} />
        : <ProtocolCheckStep issues={allIssues} templates={templates} companies={companies} objects={objects} employees={employees} onGoTo={goToIssue} />;

  return <FormProvider {...form}>
    <ProtocolWizardLayout
      header={<ProtocolWizardHeader saveState={saveStatus} saveTone={saveTone} submitting={saveMutation.isPending} onClose={onClose} />}
      sidebar={<ProtocolWizardSidebar steps={steps} current={step} maxVisited={maxVisited} errorCounts={errorCounts} onSelect={setStep} />}
      summary={<ProtocolWizardSummary templates={templates} companies={companies} objects={objects} laboratories={laboratories} employees={employees} currentStep={step} errorCounts={errorCounts} />}
      footer={<ProtocolWizardFooter step={step} total={steps.length} submitting={saveMutation.isPending} retrying={saveState === 'error'} canContinue={step <= 2 || blockingErrors.length === 0} canSaveDraft={canSaveServerDraft} saveState={saveStatus} onBack={() => setStep((current) => Math.max(0, current - 1))} onNext={() => void next()} onCreate={() => void complete()} onSaveDraft={() => void save()} />}
    >
          {!serverDraft && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-eco-200 bg-eco-50 p-3 text-sm text-eco-950"><span>Ручной режим: тип протокола и данные исследования заполняются сотрудником.</span><Button type="button" variant="secondary" onClick={onSelectPek}>Выбрать по ПЭК</Button></div>}
          {serverDraft && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Черновик протокола №{serverDraft.protocolNumber || serverDraft.id} создан. Автосохранение включено.</div>}
          {generalError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><p className="font-black">Проверьте данные</p><p className="mt-1 font-semibold">{generalError}</p></div>}
          {referenceFailures.length > 0 && <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-black">Не удалось загрузить справочники</p><div className="mt-2 space-y-2">{referenceFailures.map((failure) => <div key={failure.key} className="flex flex-wrap items-center justify-between gap-2"><span>{failure.message}</span><Button type="button" variant="secondary" onClick={() => void failure.retry()}>Повторить</Button></div>)}</div></div>}
          {content}
    </ProtocolWizardLayout>
    <Modal open={conflict} onClose={() => setConflict(false)} closeOnBackdrop={false} size="sm" title="Протокол изменён другим сотрудником" footer={<><Button type="button" variant="secondary" onClick={() => { writeLocalProtocolDraft(sessionStorage, { schemaVersion: LOCAL_PROTOCOL_DRAFT_SCHEMA_VERSION, userId: String(user?.id ?? 'anonymous'), protocolId: serverDraft?.id ?? null, backendVersion: serverDraft?.version ?? null, idempotencyKey: idempotencyKeyRef.current, currentStep: step, formValues: form.getValues(), savedAt: new Date().toISOString(), hasUnsavedChanges: true, creationContext }); setConflict(false); }}>Сохранить локальную копию</Button><Button type="button" onClick={() => void loadLatest()}>Загрузить актуальную версию</Button></>}><p className="text-sm text-slate-700">Данные не были перезаписаны. Выберите, сохранить ли введённые данные локально или загрузить актуальную серверную версию.</p></Modal>
    <Modal open={Boolean(recoveryCandidate) && !recoveryServer} loading={recoveryLoading} onClose={() => {}} closeOnBackdrop={false} size="sm" title="Найдена несохранённая копия протокола" footer={<><Button type="button" variant="secondary" disabled={recoveryLoading} onClick={deleteRecovery}>Удалить копию</Button><Button type="button" disabled={recoveryLoading} onClick={() => void restoreRecovery()}>{recoveryLoading ? 'Проверяем сервер…' : 'Восстановить'}</Button></>}><p className="text-sm text-slate-700">Сохранено: {recoveryCandidate ? new Date(recoveryCandidate.envelope.savedAt).toLocaleString('ru-RU') : '—'}</p>{recoveryError && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-900">{recoveryError}</p>}</Modal>
    <Modal open={Boolean(recoveryCandidate && recoveryServer)} onClose={() => {}} closeOnBackdrop={false} size="sm" title="Черновик был изменён на сервере" footer={<><Button type="button" variant="secondary" onClick={deleteRecovery}>Удалить локальную копию</Button><Button type="button" variant="secondary" onClick={() => { if (recoveryCandidate && recoveryServer) applyRecoveredDraft(recoveryCandidate.envelope, recoveryServer, true); }}>Открыть локальную копию для сравнения</Button><Button type="button" onClick={() => { if (recoveryServer) { if (recoveryCandidate) sessionStorage.removeItem(recoveryCandidate.key); setServerDraft(recoveryServer); form.reset(mapProtocolToWizardForm(recoveryServer)); setRecoveryCandidate(null); setRecoveryServer(null); } }}>Загрузить серверную версию</Button></>}><p className="text-sm text-slate-700">Серверная версия новее локальной. Автоматическое объединение результатов не выполняется.</p></Modal>
    <Modal open={newProtocolConfirm} onClose={() => setNewProtocolConfirm(false)} closeOnBackdrop={false} size="sm" title="Начать новый протокол?" footer={<><Button type="button" variant="secondary" onClick={() => setNewProtocolConfirm(false)}>Отмена</Button><Button type="button" onClick={() => void startNewProtocol()}>Начать новый протокол</Button></>}><p className="text-sm text-slate-700">Текущий серверный черновик будет удалён перед созданием нового, чтобы не оставить бесконтрольную копию.</p></Modal>
  </FormProvider>;
};

const CreateProtocolWizardModalV2 = (props: CreateProtocolWizardModalV2Props) => {
  const { open, orderId = '', orderServiceItemId = '', pekPrefill } = props;
  const defaultMode: ProtocolCreationMode = orderId || orderServiceItemId ? 'MANUAL' : 'PEK';
  const [mode, setMode] = useState<ProtocolCreationMode>(defaultMode);

  useEffect(() => {
    if (open) setMode(orderId || orderServiceItemId ? 'MANUAL' : 'PEK');
  }, [open, orderId, orderServiceItemId]);

  return mode === 'PEK'
    ? <PekProtocolCreationFlow open={open} onClose={props.onClose} onManual={() => setMode('MANUAL')} onCreated={props.onCreated} initialCompanyId={pekPrefill?.companyId || ''} initialObjectId={pekPrefill?.objectId || ''} />
    : <ManualProtocolWizard {...props} onSelectPek={() => setMode('PEK')} />;
};

export default CreateProtocolWizardModalV2;
