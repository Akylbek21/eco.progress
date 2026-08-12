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
import { hasProtocolPermission } from '../utils/protocolActions';
import { saveProtocolWizardDraft } from '../api/saveProtocolWizardDraft';
import { mapProtocolToWizardForm } from '../mappers/protocolWizardDraftMapper';
import { applyProtocolApiErrorsToForm } from '../utils/protocolFormErrors';
import { validateProtocolForSubmit, validateProtocolWizardStep } from '../utils/protocolWizardValidation';
import ProtocolWizardHeader from './ProtocolWizardHeader';
import ProtocolWizardSteps from './ProtocolWizardSteps';
import ProtocolWizardFooter from './ProtocolWizardFooter';
import BasicDataStep from './steps/BasicDataStep';
import ExecutorDeviceStep from './steps/ExecutorDeviceStep';
import EnvironmentStep from './steps/EnvironmentStep';
import MethodsStep from './steps/MethodsStep';
import ResultsStep from './steps/ResultsStep';
import ProtocolCheckStep from './steps/ProtocolCheckStep';
import ProtocolSigningStep from './steps/ProtocolSigningStep';
import type { CreateProtocolWizardModalProps } from './CreateProtocolWizardModal';
import {
  createWizardDefaults,
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
  writeLocalProtocolDraft,
  type LocalProtocolDraftEnvelope,
} from '../utils/protocolDraftRecovery';

const steps = ['Основные сведения', 'Условия', 'Показатели и результаты', 'Проверка', 'Завершение'];
type SaveState = 'idle' | 'local' | 'creating' | 'created' | 'saving' | 'saved' | 'error' | 'conflict';
const unavailableLaboratoryMessage = 'Выбранная лаборатория не найдена или больше не активна. Выберите лабораторию повторно.';

const CreateProtocolWizardModalV2 = ({ open, onClose, onCreated, orderId = '', orderServiceItemId = '', pekPrefill }: CreateProtocolWizardModalProps) => {
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
  const [newProtocolConfirm, setNewProtocolConfirm] = useState(false);
  const [serverIssues, setServerIssues] = useState<Array<{ code: string; step: number; field?: FieldPath<ProtocolWizardForm>; fieldPath: string; severity: 'ERROR'; message: string }>>([]);
  const initialCreateStarted = useRef(false);
  const idempotencyKeyRef = useRef(createProtocolDraftIdempotencyKey());
  const lastSavedFingerprintRef = useRef('');
  const lastFailedFingerprintRef = useRef('');
  const bufferKey = localProtocolDraftKey(user?.id ?? 'anonymous', serverDraft?.id ?? null);
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
  const waterTemplate = templates.find((item) => isWaterProtocolType(item.id));
  const waterOptions = useMemo(() => getWaterProtocolOptions(waterTemplate), [waterTemplate]);

  useEffect(() => {
    if (!open) return;
    initialCreateStarted.current = false;
    idempotencyKeyRef.current = createProtocolDraftIdempotencyKey();
    lastSavedFingerprintRef.current = '';
    lastFailedFingerprintRef.current = '';
    setServerDraft(null);
    setSaveState('idle');
    setGeneralError('');
    setStep(0);
    setMaxVisited(0);
    form.reset(normalizeProtocolWizardForm({ ...(pekPrefill ?? {}), orderId, orderServiceItemId }));
    setRecoveryCandidate(user?.id ? findLatestLocalProtocolDraft(sessionStorage, user.id) : null);
    setRecoveryServer(null);
  }, [form, open, orderId, orderServiceItemId, prefillKey, user?.id]);
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
      });
      if (!serverDraft && saveState === 'idle') setSaveState('local');
    }, 700);
    return () => window.clearTimeout(timer);
  }, [bufferKey, form, open, recoveryCandidate, saveState, serverDraft, step, values, user?.id]);

  const saveMutation = useMutation({
    mutationFn: (snapshot: ProtocolWizardForm) => saveProtocolWizardDraft(snapshot, serverDraft, idempotencyKeyRef.current),
    onMutate: () => { setSaveState(serverDraft ? 'saving' : 'creating'); setGeneralError(''); setServerIssues([]); },
    onSuccess: async ({ protocol, resultIdsByClientRowId }, snapshot) => {
      const created = !serverDraft;
      if (created) sessionStorage.removeItem(localProtocolDraftKey(user?.id ?? 'anonymous', null));
      setServerDraft(protocol);
      const liveRows = form.getValues('results');
      liveRows.forEach((row, index) => {
        const serverResultId = resultIdsByClientRowId.get(row.clientRowId);
        if (serverResultId) form.setValue(`results.${index}.serverResultId`, serverResultId, { shouldDirty: false });
      });
      const savedSnapshot: ProtocolWizardForm = {
        ...snapshot,
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

  const canSaveServerDraft = Boolean(values.templateId && values.companyId);
  const canAutoCreateDraft = Boolean(
    canSaveServerDraft
    && values.objectId
    && !invalidLaboratorySelection
    && (!values.laboratoryId || laboratoriesQuery.isSuccess),
  );
  useEffect(() => {
    if (!open || recoveryCandidate || serverDraft || !canAutoCreateDraft || initialCreateStarted.current || saveMutation.isPending || conflict) return;
    const timer = window.setTimeout(() => {
      if (initialCreateStarted.current) return;
      initialCreateStarted.current = true;
      saveMutation.mutate(form.getValues());
    }, 800);
    return () => window.clearTimeout(timer);
  }, [canAutoCreateDraft, conflict, form, open, recoveryCandidate, saveMutation, serverDraft]);
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
  const blockingIssues = approvalIssues.filter((issue) => issue.severity === 'ERROR');
  const currentStepErrors = validateProtocolWizardStep(values, step).filter((issue) => issue.severity === 'ERROR');

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
    // The next screen is the validation summary. Let the user open it even
    // when result rows are incomplete; completion remains blocked there.
    if (step === 2) {
      setStep(3);
      setMaxVisited((visited) => Math.max(visited, 3));
      return;
    }
    if (step === 3 && blockingIssues.length) {
      const first = blockingIssues[0];
      goToIssue(first.step, first.field);
      return;
    }
    if (currentStepErrors.length) {
      const first = currentStepErrors[0];
      goToIssue(first.step, first.field as FieldPath<ProtocolWizardForm>);
      return;
    }
    if (step === 3 && serverDraft && hasProtocolPermission(serverDraft, 'canCheckNormatives')) {
      try {
        const saved = await save();
        if (saved) setServerDraft(await protocolService.checkNormatives(saved.protocol.id, saved.protocol.version));
      } catch { return; }
    }
    setStep((current) => { const value = Math.min(steps.length - 1, current + 1); setMaxVisited((visited) => Math.max(visited, value)); return value; });
  };
  const complete = async () => {
    if (blockingIssues.length) {
      const first = blockingIssues[0];
      goToIssue(first.step, first.field);
      return;
    }
    try {
      const saved = await save();
      if (saved) {
        await queryClient.invalidateQueries({ queryKey: protocolQueryKeys.lists(scope) });
        sessionStorage.removeItem(localProtocolDraftKey(user?.id ?? 'anonymous', null));
        sessionStorage.removeItem(localProtocolDraftKey(user?.id ?? 'anonymous', saved.protocol.id));
        onCreated(saved.protocol);
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
    initialCreateStarted.current = Boolean(current);
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
  };
  const restoreRecovery = async () => {
    if (!recoveryCandidate) return;
    const envelope = recoveryCandidate.envelope;
    if (!envelope.protocolId) {
      applyRecoveredDraft(envelope, null);
      return;
    }
    try {
      const current = await protocolService.getProtocol(envelope.protocolId);
      if (envelope.backendVersion !== null && current.version > envelope.backendVersion) {
        setRecoveryServer(current);
        return;
      }
      applyRecoveredDraft(envelope, current);
    } catch {
      applyRecoveredDraft(envelope, null);
      setGeneralError('Серверный черновик не найден. Открыта локальная аварийная копия.');
    }
  };
  const deleteRecovery = () => {
    if (recoveryCandidate) sessionStorage.removeItem(recoveryCandidate.key);
    setRecoveryCandidate(null);
    setRecoveryServer(null);
  };
  const startNewProtocol = () => {
    sessionStorage.removeItem(bufferKey);
    idempotencyKeyRef.current = createProtocolDraftIdempotencyKey();
    initialCreateStarted.current = false;
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

  const content = step === 0
    ? <BasicDataStep templates={templates} companies={companies} objects={objects} companyLocked={Boolean(serverDraft)} onStartNew={() => setNewProtocolConfirm(true)} onCompanyChange={(id) => { form.setValue('companyId', id, { shouldDirty: true }); form.setValue('objectId', '', { shouldDirty: true }); }} />
    : step === 1
      ? <div className="space-y-7"><ExecutorDeviceStep laboratories={laboratories} employees={employees} devices={devices} onLaboratoryChange={(id) => { form.setValue('laboratoryId', id, { shouldDirty: true }); form.setValue('executorId', '', { shouldDirty: true }); }} /><EnvironmentStep weatherLoading={weather.loading} weatherMessage={weather.message} onRefresh={() => void weather.refresh()} waterTypeOptions={waterOptions.waterTypes} waterUseCategoryOptions={waterOptions.waterUseCategories} /><MethodsStep /></div>
      : step === 2
        ? <ResultsStep devices={devices} onSuggestChangeType={() => setStep(0)} />
        : step === 3
          ? <ProtocolCheckStep issues={[...approvalIssues, ...serverIssues]} onGoTo={goToIssue} />
          : <ProtocolSigningStep companies={companies} objects={objects} employees={employees} />;

  return <FormProvider {...form}>
    <Modal open={open} onClose={() => !saveMutation.isPending && onClose()} size="wizard" closeOnBackdrop={false} loading={saveMutation.isPending} contentClassName="!overflow-hidden !p-0 sm:!p-0">
      <div className="flex h-full min-h-0 flex-col">
        <ProtocolWizardHeader step={step} total={steps.length} title={steps[step]} submitting={saveMutation.isPending} onClose={onClose} />
        <ProtocolWizardSteps steps={steps} current={step} maxVisited={maxVisited} onSelect={setStep} />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {serverDraft && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Серверный черновик №{serverDraft.protocolNumber || serverDraft.id}, версия {serverDraft.version}</div>}
          {generalError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">{generalError}</div>}
          {content}
        </main>
        <ProtocolWizardFooter step={step} total={steps.length} submitting={saveMutation.isPending} retrying={saveState === 'error'} canContinue={step === 2 || (currentStepErrors.length === 0 && (step < steps.length - 1 || blockingIssues.length === 0))} canSaveDraft={canSaveServerDraft} saveState={saveState === 'local' ? 'Локальная копия сохранена' : saveState === 'creating' ? 'Создание серверного черновика…' : saveState === 'created' ? 'Черновик сохранён на сервере' : saveState === 'saving' ? 'Сохранение изменений…' : saveState === 'saved' ? 'Изменения сохранены' : saveState === 'conflict' ? 'Конфликт версий' : saveState === 'error' ? 'Не удалось сохранить' : undefined} onBack={() => setStep((current) => Math.max(0, current - 1))} onNext={() => void next()} onCreate={() => void complete()} onSaveDraft={() => void save()} />
      </div>
    </Modal>
    <Modal open={conflict} onClose={() => setConflict(false)} closeOnBackdrop={false} size="sm" title="Протокол изменён другим сотрудником" footer={<><Button type="button" variant="secondary" onClick={() => { writeLocalProtocolDraft(sessionStorage, { schemaVersion: LOCAL_PROTOCOL_DRAFT_SCHEMA_VERSION, userId: String(user?.id ?? 'anonymous'), protocolId: serverDraft?.id ?? null, backendVersion: serverDraft?.version ?? null, idempotencyKey: idempotencyKeyRef.current, currentStep: step, formValues: form.getValues(), savedAt: new Date().toISOString(), hasUnsavedChanges: true }); setConflict(false); }}>Сохранить локальную копию</Button><Button type="button" onClick={() => void loadLatest()}>Загрузить актуальную версию</Button></>}><p className="text-sm text-slate-700">Данные не были перезаписаны. Выберите, сохранить ли введённые данные локально или загрузить актуальную серверную версию.</p></Modal>
    <Modal open={Boolean(recoveryCandidate) && !recoveryServer} onClose={() => {}} closeOnBackdrop={false} size="sm" title="Найдена несохранённая копия протокола" footer={<><Button type="button" variant="secondary" onClick={deleteRecovery}>Удалить копию</Button><Button type="button" onClick={() => void restoreRecovery()}>Восстановить</Button></>}><p className="text-sm text-slate-700">Сохранено: {recoveryCandidate ? new Date(recoveryCandidate.envelope.savedAt).toLocaleString('ru-RU') : '—'}</p></Modal>
    <Modal open={Boolean(recoveryCandidate && recoveryServer)} onClose={() => {}} closeOnBackdrop={false} size="sm" title="Черновик был изменён на сервере" footer={<><Button type="button" variant="secondary" onClick={deleteRecovery}>Удалить локальную копию</Button><Button type="button" variant="secondary" onClick={() => { if (recoveryCandidate && recoveryServer) applyRecoveredDraft(recoveryCandidate.envelope, recoveryServer, true); }}>Открыть локальную копию для сравнения</Button><Button type="button" onClick={() => { if (recoveryServer) { if (recoveryCandidate) sessionStorage.removeItem(recoveryCandidate.key); setServerDraft(recoveryServer); form.reset(mapProtocolToWizardForm(recoveryServer)); setRecoveryCandidate(null); setRecoveryServer(null); } }}>Загрузить серверную версию</Button></>}><p className="text-sm text-slate-700">Серверная версия новее локальной. Автоматическое объединение результатов не выполняется.</p></Modal>
    <Modal open={newProtocolConfirm} onClose={() => setNewProtocolConfirm(false)} closeOnBackdrop={false} size="sm" title="Начать новый протокол?" footer={<><Button type="button" variant="secondary" onClick={() => setNewProtocolConfirm(false)}>Отмена</Button><Button type="button" onClick={startNewProtocol}>Начать новый протокол</Button></>}><p className="text-sm text-slate-700">Текущий серверный черновик останется в списке. Локальная аварийная копия этого мастера будет удалена.</p></Modal>
  </FormProvider>;
};

export default CreateProtocolWizardModalV2;
