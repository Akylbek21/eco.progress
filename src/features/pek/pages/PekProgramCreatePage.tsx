import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../hooks/useToast';
import type { PekControlItem, PekIndicator, PekMeasure, PekProgramForm, PekValidationIssue } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { commitPekProgramMutation } from '../api/pekProgramCache';
import { pekApi } from '../api/pekService';
import PekLookupSelect from '../components/common/PekLookupSelect';
import PekCompanyObjectFilters from '../components/common/PekCompanyObjectFilters';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekState } from '../components/common/PekUi';
import { pekProgramDefaults } from '../forms/programDefaults';
import {
  mapProgramAutosaveToRequest,
  mapProgramCreateFormToRequest,
  mapProgramEditFormToRequest,
  mapSavedProgramToForm,
  mapProgramToForm,
} from '../mappers/programMappers';
import { mergeAssigneesWithCompanyStaff } from '../mappers/responseMappers';
import { loadPekDraft, pekDraftKey, removePekDraft, savePekDraft, type PekStoredDraft } from '../utils/pekDraftStorage';
import { mapPekError } from '../utils/pekErrorMapper';
import { pekProgramFormSchema } from '../validation/programSchema';
import {
  comparisonTypeOptions,
  pekActionStatusOptions,
  pekControlTypeOptions,
  pekPeriodicityOptions,
} from '../model/pekDictionaries';
import type { ComparisonType, PekActionStatus, PekControlType, PekPeriodicity } from '../api/pekContracts';
import PekProgramStructuredSections from '../components/sections/PekProgramStructuredSections';
import NormativeSelectorModal from '../../protocols/components/components/NormativeSelectorModal';
import PekControlSourceSelect, { PekControlSourceSummary } from '../components/inventory/PekControlSourceSelect';
import type { NormativeRecord, ProtocolTemplateId } from '../../../types/protocols';
import { getLaboratories } from '../../laboratories/api/laboratoryService';
import { getMeasurementDevicesPage } from '../../../services/measurementDeviceService';
import { getUsers } from '../../../services/adminUserService';
import PekReadinessPanel from '../components/common/PekReadinessPanel';

const steps = [
  'Сведения об объекте',
  'КАТО / БИН / ОКЭД',
  'Категория и мощность',
  'Характеристика производства',
  'Производственный мониторинг',
  'Точки контроля',
  'Показатели',
  'Внутренние проверки',
  'Контроль качества измерений',
  'Аварийные процедуры',
  'Ответственность',
  'Разрешительные документы',
  'Проверка готовности',
];
const inputClass = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2';
const clientId = (prefix: string) =>
  `${prefix}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;

const newControl = (sortOrder: number): PekControlItem => ({
  clientId: clientId('control'),
  code: '',
  name: '',
  mandatory: true,
  sortOrder,
  active: true,
  controlMethod: 'INSTRUMENTAL',
  samplingRequired: true,
});
const newIndicator = (sortOrder: number, controlItemClientId?: string): PekIndicator => ({
  clientId: clientId('indicator'),
  controlItemClientId,
  indicatorName: '',
  mandatory: true,
  sortOrder,
});
const newMeasure = (): PekMeasure => ({
  clientId: clientId('measure'),
  name: '',
  status: 'PLANNED',
  completionPercent: 0,
  currency: 'KZT',
});
const stepForField = (field: string) => field.startsWith('controlItems') ? 5
  : field.startsWith('indicators') ? 6
    : field.startsWith('measures') ? 10
      : field.startsWith('kato') || field.startsWith('bin') || field.startsWith('oked') ? 1
          : field.startsWith('environmentalCategory') || field.startsWith('designCapacity') || field.startsWith('designCapacityUnit') ? 2
          : field.startsWith('productionCharacteristics') ? 3
            : field.startsWith('monitoringScope') ? 4
              : field.startsWith('permitIds') ? 11
                      : field.startsWith('readinessNotes') ? 12 : 0;

const stepForReadinessIssue = (issue: PekValidationIssue) => {
  switch (issue.section) {
    case 'CONTROL_ITEMS':
    case 'MONITORING':
    case 'SOURCES': return 5;
    case 'INDICATORS': return 6;
    case 'INTERNAL_INSPECTIONS': return 7;
    case 'MEASUREMENT_QA': return 8;
    case 'EMERGENCY_PROCEDURES': return 9;
    case 'RESPONSIBILITY': return 10;
    case 'PERMITS':
    case 'DOCUMENTS': return 11;
    default: return 0;
  }
};

const PekProgramCreatePage = () => {
  const { programId } = useParams();
  const edit = Boolean(programId);
  const id = Number(programId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routeCompanyId = Number(searchParams.get('companyId')) || undefined;
  const programDetailKey = pekKeys.programDetail(routeCompanyId, id);
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState(() => Math.min(steps.length - 1, Math.max(0, Number(searchParams.get('step')) || 0)));
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'offline' | 'error' | 'conflict'>('idle');
  const [conflictOpen, setConflictOpen] = useState(false);
  const [draftToRestore, setDraftToRestore] = useState<PekStoredDraft<PekProgramForm> | null>(null);
  const [normativeIndicatorIndex, setNormativeIndicatorIndex] = useState<number | null>(null);
  const [expandedControlId, setExpandedControlId] = useState<string | null>(null);
  const versionRef = useRef<number>(0);
  const hydratedProgramId = useRef<number>();
  const autosaveTimer = useRef<number>();
  const autosaveController = useRef<AbortController>();
  const autosaveSequence = useRef(0);
  const appliedAutosaveSequence = useRef(0);
  const autosavePendingRef = useRef(false);
  const autosaveCompletionRef = useRef<Promise<void> | null>(null);
  const manualSavePendingRef = useRef(false);
  const queuedAutosave = useRef<PekProgramForm>();
  const lastAutosaveHash = useRef('');

  const form = useForm<PekProgramForm>({
    defaultValues: pekProgramDefaults,
    mode: 'onBlur',
  });
  const { register, watch, setValue, getValues, reset, formState } = form;
  const companyId = watch('companyId');
  const objectId = watch('objectId');
  const controlItems = watch('controlItems');
  const indicators = watch('indicators');
  const measures = watch('measures');

  const program = useQuery({
    queryKey: programDetailKey,
    queryFn: ({ signal }) => pekApi.getProgram(id, signal),
    enabled: edit && Number.isFinite(id),
  });
  const assignees = useQuery({
    queryKey: pekKeys.assignees(companyId, ['PEK_RESPONSIBLE'], user?.id),
    queryFn: ({ signal }) => pekApi.getAssignees(companyId, ['PEK_RESPONSIBLE'], signal),
    enabled: companyId > 0,
  });
  const companyStaff = useQuery({
    queryKey: pekKeys.companyStaff(companyId, user?.id),
    queryFn: ({ signal }) => pekApi.getCompanyStaff(companyId, signal),
    enabled: companyId > 0,
  });
  const readiness = useQuery({
    queryKey: pekKeys.programReadiness(id, user?.id, program.data?.contentRevision),
    queryFn: ({ signal }) => pekApi.getProgramReadiness(id, signal),
    enabled: edit && Number.isFinite(id) && step === steps.length - 1,
  });
  const systemUsers = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
    enabled: companyId > 0,
  });
  const responsibleOptions = [...new Map([
    ...mergeAssigneesWithCompanyStaff(assignees.data, companyStaff.data),
    ...(systemUsers.data || [])
      .filter((employee) => employee.role !== 'CLIENT' && employee.status.toLowerCase() === 'active')
      .map((employee) => ({
        id: employee.id,
        name: employee.fullName?.trim() || employee.name,
        description: employee.position || employee.email,
        status: 'ACTIVE',
        role: employee.role,
      })),
  ].map((employee) => [Number(employee.id), employee])).values()];
  const responsibleLoading = !responsibleOptions.length && (assignees.isLoading || companyStaff.isLoading || systemUsers.isLoading);
  const responsibleError = !responsibleOptions.length && assignees.isError && companyStaff.isError && systemUsers.isError;
  const permits = useQuery({
    queryKey: pekKeys.permits(objectId, user?.id),
    queryFn: ({ signal }) => pekApi.getPermits(objectId, signal),
    enabled: objectId > 0,
  });
  const laboratories = useQuery({
    queryKey: ['laboratories', 'pek-program-form', `user:${user?.id ?? 'anonymous'}`],
    queryFn: ({ signal }) => getLaboratories({ page: 0, size: 100, status: 'ACTIVE' }, signal),
  });
  const measurementDevices = useQuery({
    queryKey: ['measurement-devices', 'pek-program-form', `user:${user?.id ?? 'anonymous'}`],
    queryFn: ({ signal }) => getMeasurementDevicesPage({ page: 0, size: 500, sort: 'name,asc' }, signal),
  });
  const deviceTypeLookup = useQuery({ queryKey: ['pek', 'lookups', 'device-types'], queryFn: ({ signal }) => pekApi.getDeviceTypes(signal) });
  const samplingMethods = useQuery({ queryKey: ['pek', 'lookups', 'methods', 'SAMPLING'], queryFn: ({ signal }) => pekApi.getMethods('SAMPLING', signal) });
  const measurementMethods = useQuery({ queryKey: ['pek', 'lookups', 'methods', 'MEASUREMENT'], queryFn: ({ signal }) => pekApi.getMethods('MEASUREMENT', signal) });
  const measurementDeviceTypes = useMemo(() => Array.from(new Set([
    ...(deviceTypeLookup.data || []).map((item) => item.name),
    ...(measurementDevices.data?.content || []).map((device) => device.deviceType || device.name),
  ].filter(Boolean))).sort((left, right) => left.localeCompare(right, 'ru')), [deviceTypeLookup.data, measurementDevices.data]);
  const draftKey = useMemo(
    () => pekDraftKey('program', user?.id, programId, edit ? program.data?.version ?? 'loading' : 'new', companyId || 'none'),
    [companyId, edit, program.data?.version, programId, user?.id],
  );
  const activePermits = useMemo(() => (permits.data || []).filter((permit) => permit.effectivelyActive && permit.companyId === companyId && permit.objectId === objectId), [companyId, objectId, permits.data]);

  useEffect(() => {
    if (!program.data) return;
    versionRef.current = program.data.version;
    if (hydratedProgramId.current === program.data.id) return;
    hydratedProgramId.current = program.data.id;
    reset(mapProgramToForm(program.data));
  }, [program.data, reset]);

  useEffect(() => {
    if (edit && !program.data) return;
    let active = true;
    const backendVersion = edit ? program.data?.version ?? 'loading' : 'new';
    void loadPekDraft<PekProgramForm>(draftKey, backendVersion).then((draft) => {
      if (active && draft?.form) setDraftToRestore(draft);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [draftKey, edit, program.data]);

  const autosave = useMutation({
    mutationFn: async (value: PekProgramForm) => {
      autosaveController.current?.abort();
      const controller = new AbortController();
      autosaveController.current = controller;
      const sequence = ++autosaveSequence.current;
      const request = pekApi.saveProgramDraft(id, versionRef.current, mapProgramAutosaveToRequest(value), controller.signal);
      const completion = request.then((saved) => {
        if (sequence >= appliedAutosaveSequence.current) {
          appliedAutosaveSequence.current = sequence;
          versionRef.current = saved.version;
        }
      }).then(() => undefined, () => undefined);
      autosaveCompletionRef.current = completion;
      try {
        const saved = await request;
        return { saved, sequence };
      } finally {
        await completion;
        if (autosaveCompletionRef.current === completion) autosaveCompletionRef.current = null;
      }
    },
    retry: false,
    onMutate: () => {
      autosavePendingRef.current = true;
      setAutosaveState('saving');
    },
    onSuccess: ({ saved, sequence }) => {
      if (sequence < appliedAutosaveSequence.current) return;
      appliedAutosaveSequence.current = sequence;
      versionRef.current = saved.version;
      queryClient.setQueryData(programDetailKey, saved);
      setAutosaveState('saved');
      void removePekDraft(draftKey);
    },
    onError: (error) => {
      if (axios.isCancel(error) || (error instanceof DOMException && error.name === 'AbortError')) return;
      queuedAutosave.current = undefined;
      if (mapPekError(error).status === 409) {
        setAutosaveState('conflict');
        setConflictOpen(true);
      } else {
        setAutosaveState('error');
      }
    },
    onSettled: () => {
      autosavePendingRef.current = false;
    },
  });

  useEffect(() => {
    if (manualSavePendingRef.current || autosavePendingRef.current || autosave.isPending || !queuedAutosave.current) return;
    const next = queuedAutosave.current;
    queuedAutosave.current = undefined;
    autosavePendingRef.current = true;
    autosave.mutate(next);
  }, [autosave.isPending]);

  useEffect(() => {
    const subscription = watch((partial) => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = window.setTimeout(() => {
        const value = { ...pekProgramDefaults, ...partial } as PekProgramForm;
        void savePekDraft(draftKey, value, edit ? versionRef.current : 'new');
        if (manualSavePendingRef.current) return;
        const payloadHash = JSON.stringify(mapProgramAutosaveToRequest(value));
        if (payloadHash === lastAutosaveHash.current) return;
        if (!navigator.onLine) {
          setAutosaveState('offline');
          return;
        }
        if (
          edit
          && program.data
          && program.data.availableActions.edit === true
        ) {
          lastAutosaveHash.current = payloadHash;
          if (autosavePendingRef.current) queuedAutosave.current = value;
          else {
            autosavePendingRef.current = true;
            autosave.mutate(value);
          }
        }
      }, 1500);
    });
    return () => {
      subscription.unsubscribe();
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
      autosaveController.current?.abort();
    };
  }, [autosave, draftKey, edit, program.data, watch]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!['saving', 'error', 'conflict'].includes(autosaveState)) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [autosaveState]);

  const prepareFullSave = async () => {
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = undefined;
    }
    queuedAutosave.current = undefined;
    const inFlightAutosave = autosaveCompletionRef.current;
    if (inFlightAutosave) await inFlightAutosave;
    queuedAutosave.current = undefined;
  };

  const handleSaveError = (error: unknown) => {
    const mapped = mapPekError(error);
    if (mapped.status === 409 || mapped.status === 412) {
      setAutosaveState('conflict');
      setConflictOpen(true);
    } else {
      setAutosaveState('error');
    }
    const firstField = Object.keys(mapped.fieldErrors)[0];
    Object.entries(mapped.fieldErrors).forEach(([field, message]) => form.setError(field as FieldPath<PekProgramForm>, { message }));
    if (firstField) {
      setStep(stepForField(firstField));
      window.setTimeout(() => form.setFocus(firstField as FieldPath<PekProgramForm>), 0);
    }
    toast.error(mapped.message);
  };

  const save = useMutation({
    mutationFn: async (value: PekProgramForm) => {
      if (edit) {
        await prepareFullSave();
        return pekApi.updateProgram(id, versionRef.current, mapProgramEditFormToRequest(value));
      }
      return pekApi.createProgram(mapProgramCreateFormToRequest(value));
    },
    retry: false,
    onMutate: () => {
      manualSavePendingRef.current = true;
      setAutosaveState('saving');
    },
    onSuccess: async (saved) => {
      versionRef.current = saved.version;
      await removePekDraft(draftKey).catch(() => undefined);
      await commitPekProgramMutation(
        queryClient,
        edit ? routeCompanyId : saved.company?.id ?? companyId,
        saved,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pekKeys.dashboard({}, user?.id) }),
      ]);
      toast.success(edit ? 'Программа обновлена' : 'Программа создана');
      navigate(`/staff/pek/programs/${saved.id}?companyId=${saved.company?.id ?? companyId ?? routeCompanyId ?? ''}`);
    },
    onError: handleSaveError,
    onSettled: () => {
      manualSavePendingRef.current = false;
    },
  });

  const saveDraft = useMutation({
    mutationFn: async (value: PekProgramForm) => {
      await prepareFullSave();
      return pekApi.updateProgram(id, versionRef.current, mapProgramEditFormToRequest(value));
    },
    retry: false,
    onMutate: () => {
      manualSavePendingRef.current = true;
      setAutosaveState('saving');
    },
    onSuccess: async (saved, submitted) => {
      versionRef.current = saved.version;
      const savedForm = mapSavedProgramToForm(saved, submitted);
      lastAutosaveHash.current = JSON.stringify(mapProgramAutosaveToRequest(savedForm));
      reset(savedForm);
      await removePekDraft(draftKey).catch(() => undefined);
      await commitPekProgramMutation(queryClient, routeCompanyId ?? saved.company?.id ?? companyId, saved);
      await queryClient.invalidateQueries({ queryKey: pekKeys.dashboard({}, user?.id) });
      setAutosaveState('saved');
      toast.success('Черновик сохранён');
    },
    onError: handleSaveError,
    onSettled: () => {
      manualSavePendingRef.current = false;
    },
  });

  const createServerDraft = useMutation({
    mutationFn: (value: PekProgramForm) => pekApi.createProgram(mapProgramCreateFormToRequest({
      ...value,
      controlItems: [],
      indicators: [],
      measures: [],
    })),
    retry: false,
    onMutate: () => setAutosaveState('saving'),
    onSuccess: async (saved) => {
      versionRef.current = saved.version;
      await commitPekProgramMutation(queryClient, saved.company?.id ?? companyId, saved);
      await removePekDraft(draftKey).catch(() => undefined);
      setAutosaveState('saved');
      toast.success('Программа создана');
      navigate(`/staff/pek/programs/${saved.id}?companyId=${saved.company?.id ?? companyId}`, { replace: true });
    },
    onError: (error) => {
      setAutosaveState('error');
      const mapped = mapPekError(error);
      Object.entries(mapped.fieldErrors).forEach(([field, message]) => form.setError(field as FieldPath<PekProgramForm>, { message }));
      toast.error(mapped.message);
    },
  });

  const validateHeader = (value: PekProgramForm) => {
    let message = '';
    if (!value.companyId) { form.setError('companyId', { message: 'Выберите компанию' }); message = 'Выберите компанию'; }
    else if (!value.objectId) { form.setError('objectId', { message: 'Выберите объект' }); message = 'Выберите объект'; }
    else if (!value.number.trim()) { form.setError('number', { message: 'Укажите номер' }); message = 'Укажите номер'; }
    else if (!value.name.trim()) { form.setError('name', { message: 'Укажите название' }); message = 'Укажите название'; }
    else if (!value.validFrom || !value.validUntil || value.validUntil < value.validFrom) { form.setError('validUntil', { message: 'Проверьте период программы' }); message = 'Проверьте период программы'; }
    return message;
  };

  if (program.isLoading) return <PekLoading />;
  if (program.isError) return <PekQueryError error={program.error} resource="Программа ПЭК" retry={() => void program.refetch()} />;
  if (edit && program.data?.availableActions.edit !== true) {
    return <PekState title="Программа доступна только для просмотра" message="Изменение этой программы сейчас недоступно." />;
  }

  if (!edit) {
    const create = form.handleSubmit((value) => {
      const message = validateHeader(value);
      if (message) {
        toast.error(message);
        return;
      }
      createServerDraft.mutate(value);
    });

    return <div className="mx-auto max-w-4xl space-y-4">
      <PekPageHeader
        title="Создание программы ПЭК"
        description="Укажите основные сведения. Остальные разделы заполняются в рабочем пространстве программы."
      />
      <form onSubmit={create} className="border border-slate-300 bg-white p-4 sm:p-5">
        {createServerDraft.isError && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Не удалось создать программу. Проверьте поля и повторите попытку.</div>}
        <div className="grid gap-3 md:grid-cols-2">
          <input type="hidden" {...register('companyId', { valueAsNumber: true })} />
          <input type="hidden" {...register('objectId', { valueAsNumber: true })} />
          <PekCompanyObjectFilters
            companyId={companyId || undefined}
            objectId={objectId || undefined}
            required
            onCompanyChange={(value) => {
              setValue('companyId', Number(value) || 0, { shouldDirty: true, shouldValidate: true });
              setValue('objectId', 0, { shouldDirty: true, shouldValidate: true });
            }}
            onObjectChange={(value) => setValue('objectId', Number(value) || 0, { shouldDirty: true, shouldValidate: true })}
          />
          <label>Номер *<input {...register('number')} className={inputClass} />{formState.errors.number && <span className="mt-1 block text-xs text-rose-700">{formState.errors.number.message}</span>}</label>
          <label>Название *<input {...register('name')} className={inputClass} />{formState.errors.name && <span className="mt-1 block text-xs text-rose-700">{formState.errors.name.message}</span>}</label>
          <label>Период с *<input type="date" {...register('validFrom')} className={inputClass} /></label>
          <label>Период по *<input type="date" {...register('validUntil')} className={inputClass} />{formState.errors.validUntil && <span className="mt-1 block text-xs text-rose-700">{formState.errors.validUntil.message}</span>}</label>
        </div>
        <p className="mt-3 text-xs text-slate-500">Реквизиты объекта, категория, мощность, нормативная версия и ответственный подтянутся автоматически после создания.</p>
        <div className="mt-5 flex justify-end">
          <Button type="submit" disabled={createServerDraft.isPending}>{createServerDraft.isPending ? 'Создание…' : 'Создать программу'}</Button>
        </div>
      </form>
    </div>;
  }

  const submit = form.handleSubmit((value) => {
    const parsed = pekProgramFormSchema.safeParse(value);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => form.setError(issue.path.join('.') as FieldPath<PekProgramForm>, { message: issue.message }));
      toast.error(parsed.error.issues[0]?.message || 'Проверьте поля программы');
      setStep(stepForField(parsed.error.issues[0]?.path.join('.') || ''));
      return;
    }
    save.mutate(value);
  });
  const updateControl = (index: number, patch: Partial<PekControlItem>) =>
    setValue('controlItems', controlItems.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row), { shouldDirty: true });
  const updateIndicator = (index: number, patch: Partial<PekIndicator>) =>
    setValue('indicators', indicators.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row), { shouldDirty: true });
  const updateMeasure = (index: number, patch: Partial<PekMeasure>) =>
    setValue('measures', measures.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row), { shouldDirty: true });

  const saveDraftNow = () => {
    const value = getValues();
    const message = validateHeader(value);
    if (message) { toast.error(message); return; }
    if (edit) saveDraft.mutate(value);
    else createServerDraft.mutate(value);
  };

  const nextStep = () => {
    const value = getValues();
    let message = '';
    if (step === 0) message = validateHeader(value);
    else if (step === 1 && (!value.kato?.trim() || !/^\d{12}$/.test(value.bin?.trim() || '') || !value.oked?.trim())) message = 'Заполните КАТО, ОКЭД и БИН из 12 цифр';
    else if (step === 2 && (!value.environmentalCategory || !value.designCapacity?.trim() || !value.designCapacityUnit?.trim())) message = 'Укажите категорию, проектную мощность и единицу измерения';
    else if (step === 3 && !value.productionCharacteristics?.trim()) message = 'Заполните характеристику производственных процессов';
    else if (step === 4 && !value.monitoringScope?.trim()) message = 'Опишите организацию производственного мониторинга';
    else if (step === 5 && !value.controlItems.length) message = 'Добавьте хотя бы одну позицию контроля';
    else if (step === 5 && value.controlItems.some((row) => !row.code.trim() || !row.name.trim() || !row.controlType || !row.frequencyType || (row.frequencyType === 'PER_EVENT' && !row.plannedCount))) message = 'Заполните обязательные поля, периодичность и плановое количество каждой позиции';
    else if (step === 6 && !value.indicators.length) message = 'Добавьте хотя бы один показатель';
    else if (step === 6 && value.indicators.some((row) => !row.controlItemClientId || !row.indicatorName.trim() || !row.unit || !row.comparisonType)) message = 'Заполните обязательные сведения каждого показателя';
    else if (step === 10 && value.measures.some((row) => !row.code?.trim() || !row.name.trim() || !row.responsibleUserId || !row.plannedEndDate)) message = 'Заполните код, название, ответственного и срок каждого мероприятия';
    if (message) { toast.error(message); return; }
    if (!edit && step === 0) {
      createServerDraft.mutate(value);
      return;
    }
    saveDraft.mutate(value, {
      onSuccess: () => setStep((current) => current + 1),
    });
  };
  const normativeTemplate = (indicatorIndex: number): ProtocolTemplateId => {
    const indicator = indicators[indicatorIndex];
    const control = controlItems.find((item) => item.clientId === indicator?.controlItemClientId);
    if (control?.controlType === 'SOIL') return 'soil';
    if (control?.controlType === 'WATER_INTAKE' || control?.controlType === 'WASTEWATER') return 'water';
    if (control?.controlType === 'PHYSICAL_FACTOR') return 'noise_vibration';
    return 'ambient_air';
  };
  const chooseNormative = (records: NormativeRecord[]) => {
    const record = records[0];
    if (normativeIndicatorIndex == null || !record) return;
    const numeric = (value: string | number | null | undefined) => {
      if (value == null || value === '') return null;
      const parsed = Number(String(value).replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    };
    const numericValue = numeric(record.normativeValue)
      ?? numeric(record.limitValue)
      ?? numeric(record.value)
      ?? numeric(record.maxOneTimeValue);
    const comparisonType = (record.comparisonType || 'LESS_OR_EQUAL') as ComparisonType;
    const rangeMinimum = numeric(record.minValue ?? record.min);
    const rangeMaximum = numeric(record.maxValue ?? record.max);
    updateIndicator(normativeIndicatorIndex, {
      normativeId: Number(record.id),
      indicatorId: Number(record.id),
      indicatorCode: record.code || record.pollutantCode || '',
      indicatorName: record.indicator || record.indicatorName || record.name || '',
      unit: record.unit || '',
      comparisonType,
      normativeValue: numericValue,
      minValue: comparisonType === 'GREATER_OR_EQUAL'
        ? rangeMinimum ?? numericValue
        : ['RANGE', 'BETWEEN'].includes(comparisonType) ? rangeMinimum : null,
      maxValue: comparisonType === 'LESS_OR_EQUAL'
        ? rangeMaximum ?? numericValue
        : ['RANGE', 'BETWEEN'].includes(comparisonType) ? rangeMaximum ?? numericValue : null,
      normativeDocument: record.normativeDocument || record.sourceDocumentName || record.sourceDocumentCode || null,
      normativeRevision: record.documentDate || null,
      normativeSource: 'PERMIT',
      manualNormativeReason: null,
    });
    setNormativeIndicatorIndex(null);
  };

  return <div className="space-y-5">
    <PekPageHeader
      title={edit ? 'Редактирование программы ПЭК' : 'Создание программы ПЭК'}
      description={`Шаг ${step + 1} из ${steps.length} · ${steps[step]}`}
      actions={<span className="text-sm font-semibold text-slate-600" role="status">
        {autosaveState === 'saving' && 'Сохранение…'}
        {autosaveState === 'saved' && 'Сохранено'}
        {autosaveState === 'offline' && <span className="text-amber-700">Нет соединения · черновик сохранён локально</span>}
        {autosaveState === 'error' && <><span className="text-rose-700">Не удалось сохранить</span> <button type="button" className="underline" onClick={saveDraftNow}>Повторить</button></>}
        {autosaveState === 'conflict' && <span className="text-rose-700">Программа изменена другим сотрудником</span>}
      </span>}
    />
    <nav aria-label="Шаги программы ПЭК">
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((label, index) => <li key={label}>
          <button
            type="button"
            aria-current={index === step ? 'step' : undefined}
            disabled={save.isPending || saveDraft.isPending || createServerDraft.isPending}
            onClick={() => setStep(index)}
            className={`h-full w-full rounded-xl p-3 text-center text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eco-700 disabled:cursor-wait disabled:opacity-60 ${index === step ? 'bg-eco-700 text-white' : 'bg-white hover:bg-eco-50 hover:text-eco-800'}`}
          >{index + 1}. {label}</button>
        </li>)}
      </ol>
    </nav>
    <form onSubmit={submit}>
      <section className="rounded-2xl border bg-white p-5">
        {Object.keys(formState.errors).length > 0 && <div role="alert" aria-live="assertive" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Проверьте заполнение текущего раздела. Первая ошибка: {String(Object.values(formState.errors)[0]?.message || 'некорректные данные')}</div>}
        {step === 0 && <div className="grid gap-4 md:grid-cols-2">
          <input type="hidden" {...register('companyId', { valueAsNumber: true })} />
          <input type="hidden" {...register('objectId', { valueAsNumber: true })} />
          <PekCompanyObjectFilters
            companyId={companyId || undefined}
            objectId={objectId || undefined}
            companyDisabled={edit}
            objectDisabled={edit}
            required
            onCompanyChange={(value) => {
              setValue('companyId', Number(value) || 0, { shouldDirty: true, shouldValidate: true });
              setValue('objectId', 0, { shouldDirty: true, shouldValidate: true });
            }}
            onObjectChange={(value) => setValue('objectId', Number(value) || 0, { shouldDirty: true, shouldValidate: true })}
          />
          <label>Номер *<input {...register('number')} disabled={edit} className={inputClass} /></label>
          <label>Название *<input {...register('name')} className={inputClass} /></label>
          <label className="md:col-span-2">Описание<textarea {...register('description')} rows={3} className={inputClass} /></label>
          <label className="md:col-span-2">Сведения об объекте и его местоположении *<textarea {...register('facilityInformation')} rows={5} className={inputClass} placeholder="Назначение объекта, адрес, границы площадки, режим работы и основные источники воздействия" /></label>
          <label>Действует с *<input type="date" {...register('validFrom')} className={inputClass} /></label>
          <label>Действует до *<input type="date" {...register('validUntil')} className={inputClass} /></label>
          <PekLookupSelect label="Ответственный" value={watch('responsibleUserId')} options={responsibleOptions} loading={responsibleLoading} error={responsibleError} onRetry={() => void Promise.all([assignees.refetch(), companyStaff.refetch(), systemUsers.refetch()])} onChange={(value) => setValue('responsibleUserId', value, { shouldDirty: true })} />
          {edit && <p className="text-xs text-slate-500 md:col-span-2">Компания, объект и номер фиксируются при создании программы.</p>}
          <div className="text-sm text-slate-600"><strong>Действующие разрешительные документы</strong><p className="mt-2">{permits.isLoading ? 'Загрузка…' : activePermits.length ? activePermits.map((item) => `${item.type} № ${item.number}`).join(', ') : 'Для объекта нет действующих разрешительных документов'}</p></div>
          {Object.values(formState.errors).length > 0 && <p role="alert" className="md:col-span-2 text-sm text-rose-700">Проверьте обязательные поля программы.</p>}
        </div>}
        {step === 1 && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label>КАТО *<input {...register('kato')} className={inputClass} inputMode="numeric" /></label>
          <label>БИН оператора *<input {...register('bin')} className={inputClass} inputMode="numeric" maxLength={12} /></label>
          <label>ОКЭД *<input {...register('oked')} className={inputClass} /></label>
          <p className="md:col-span-3 text-sm text-slate-500">Реквизиты относятся к оператору и конкретному объекту, для которого разрабатывается программа.</p>
        </div>}
        {step === 2 && <div className="grid gap-4 md:grid-cols-2">
          <label>Категория объекта *<select {...register('environmentalCategory')} className={inputClass}><option value="">Выберите категорию</option><option value="I">I категория</option><option value="II">II категория</option></select></label>
          <label>Проектная мощность *<input {...register('designCapacity')} className={inputClass} placeholder="Например, 150 000" /></label>
          <label>Единица проектной мощности *<input {...register('designCapacityUnit')} className={inputClass} placeholder="Например, м³/сут или т/год" /></label>
          <p className="text-sm text-slate-500 md:col-span-2">Фактическая мощность указывается отдельно в каждом отчёте ПЭК за соответствующий период.</p>
        </div>}
        {step === 3 && <label className="block">Характеристика производственных и технологических процессов *<textarea {...register('productionCharacteristics')} rows={12} className={inputClass} placeholder="Технологические линии, сырьё, продукция, оборудование, источники эмиссий, водопользование и образование отходов" /></label>}
        {step === 4 && <label className="block">Организация производственного мониторинга *<textarea {...register('monitoringScope')} rows={12} className={inputClass} placeholder="Компоненты среды, наблюдения, лаборатории, сбор и хранение результатов мониторинга" /></label>}
        {step === 5 && <div className="space-y-4">
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3 shadow-sm">
            <div className="flex items-center gap-3"><Button type="button" onClick={() => { const created = newControl(controlItems.length); setValue('controlItems', [...controlItems, created], { shouldDirty: true }); setExpandedControlId(created.clientId || null); }}>Добавить позицию</Button><span className="text-sm text-slate-500">Всего: {controlItems.length}</span></div>
            {expandedControlId && <button type="button" className="text-sm font-bold text-eco-700 underline" onClick={() => setExpandedControlId(null)}>Свернуть все</button>}
          </div>
          {controlItems.map((row, index) => {
            const controlKey = row.clientId || `control-${row.id ?? index}`;
            const expanded = expandedControlId === controlKey;
            const complete = Boolean(row.code.trim() && row.name.trim() && row.controlType && row.frequencyType && (row.frequencyType !== 'PER_EVENT' || row.plannedCount));
            const controlTypeLabel = pekControlTypeOptions.find((option) => option.value === row.controlType)?.label || 'Тип не выбран';
            return <article key={controlKey} className={`overflow-hidden rounded-xl border ${expanded ? 'border-eco-400 shadow-sm' : 'border-slate-200'}`}>
            <div className="flex items-center gap-3 bg-white p-3">
              <button type="button" aria-expanded={expanded} onClick={() => setExpandedControlId(expanded ? null : controlKey)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-black">{index + 1}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-black">{row.name || 'Позиция без названия'}{row.code ? ` · ${row.code}` : ''}</span><span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{controlTypeLabel}</span><span>·</span><PekControlSourceSummary programId={edit ? id : undefined} value={row} /></span></span>
                <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{complete ? 'Заполнено' : 'Требует заполнения'}</span>
                <span className="shrink-0 text-lg text-slate-500" aria-hidden="true">{expanded ? '▴' : '▾'}</span>
              </button>
              <button type="button" className="shrink-0 text-sm text-rose-700" onClick={() => { setValue('controlItems', controlItems.filter((_, i) => i !== index), { shouldDirty: true }); if (expanded) setExpandedControlId(null); }}>Удалить</button>
            </div>
            {expanded && <div className="border-t bg-slate-50/40 p-4"><div className="grid gap-3 md:grid-cols-3">
              <TextField label="Код *" value={row.code} onChange={(value) => updateControl(index, { code: value })} />
              <TextField label="Название *" value={row.name} onChange={(value) => updateControl(index, { name: value })} />
              <PekControlSourceSelect programId={edit ? id : undefined} value={row} onChange={patch => updateControl(index, patch)} />
              <label>Лаборатория<select value={row.laboratoryId || ''} onChange={(event) => updateControl(index, { laboratoryId: event.target.value ? Number(event.target.value) : null })} className={inputClass}><option value="">Не выбрана</option>{laboratories.data?.content.map((laboratory) => <option key={laboratory.id} value={laboratory.id}>{laboratory.name}</option>)}</select></label>
              <SelectField label="Тип контроля *" value={row.controlType} options={pekControlTypeOptions} onChange={(value) => updateControl(index, { controlType: value as PekControlType })} />
              <SelectField label="Периодичность *" value={row.frequencyType} options={pekPeriodicityOptions} onChange={(value) => updateControl(index, { frequencyType: value as PekPeriodicity })} />
              <NumberField label="Значение периодичности" value={row.frequencyValue} onChange={(value) => updateControl(index, { frequencyValue: value })} />
              <NumberField label="Плановое количество" value={row.plannedCount} onChange={(value) => updateControl(index, { plannedCount: value })} />
              {row.frequencyType === 'PER_EVENT' && <p className="self-end text-sm text-slate-600">По событию — укажите ожидаемое количество измерений.</p>}
              <details className="rounded-xl border bg-white p-3 md:col-span-3"><summary className="cursor-pointer font-bold text-slate-700">Дополнительные сведения: методы, сроки и ответственный</summary><div className="mt-4 grid gap-3 md:grid-cols-3"><TextField label="Раздел" value={row.sectionCode} onChange={(value) => updateControl(index, { sectionCode: value })} /><TextField label="Компонент среды" value={row.environmentComponent} onChange={(value) => updateControl(index, { environmentComponent: value })} /><label>Способ контроля<select className={inputClass} value={row.controlMethod || ''} onChange={(event) => updateControl(index, { controlMethod: event.target.value as PekControlItem['controlMethod'] })}>{['INSTRUMENTAL', 'AUTOMATIC', 'CALCULATION', 'VISUAL'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Метод измерения<select className={inputClass} value={row.measurementMethodId || ''} onChange={(event) => { const selected = measurementMethods.data?.find((item) => item.id === Number(event.target.value)); updateControl(index, { measurementMethodId: selected?.id || null, measurementMethodName: selected?.name || null, measurementMethod: selected?.name || null }); }}><option value="">Не выбран</option>{measurementMethods.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Метод отбора<select className={inputClass} value={row.samplingMethodId || ''} onChange={(event) => { const selected = samplingMethods.data?.find((item) => item.id === Number(event.target.value)); updateControl(index, { samplingMethodId: selected?.id || null, samplingMethodName: selected?.name || null, samplingMethod: selected?.name || null }); }}><option value="">Не выбран</option>{samplingMethods.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="flex items-center gap-2"><input type="checkbox" checked={row.samplingRequired === true} onChange={(event) => updateControl(index, { samplingRequired: event.target.checked })} />Требуется отбор проб</label><TextField label="Дата начала" type="date" value={row.startDate} onChange={(value) => updateControl(index, { startDate: value })} /><TextField label="Дата окончания" type="date" value={row.endDate} onChange={(value) => updateControl(index, { endDate: value })} /><PekLookupSelect label="Ответственный" value={row.responsibleUserId} options={responsibleOptions} loading={responsibleLoading} error={responsibleError} onRetry={() => void Promise.all([assignees.refetch(), companyStaff.refetch(), systemUsers.refetch()])} onChange={(value) => updateControl(index, { responsibleUserId: value })} /><label className="flex items-center gap-2"><input type="checkbox" checked={row.mandatory} onChange={(event) => updateControl(index, { mandatory: event.target.checked })} />Обязательная</label><label className="flex items-center gap-2"><input type="checkbox" checked={row.active} onChange={(event) => updateControl(index, { active: event.target.checked })} />Активна</label></div></details>
            </div>
          </div>}
          </article>;})}
          {!controlItems.length && <PekState title="Позиции контроля не добавлены" />}
        </div>}
        {step === 6 && <div className="space-y-4">
          <h2 className="text-lg font-black">Показатели</h2>
          <Button type="button" disabled={!controlItems.length} onClick={() => setValue('indicators', [...indicators, newIndicator(indicators.length, controlItems[0]?.clientId)], { shouldDirty: true })}>Добавить показатель</Button>
          {indicators.map((row, index) => <article key={row.clientId} className="rounded-xl border p-4">
            <div className="mb-3 flex justify-between"><strong>Показатель {index + 1}</strong><button type="button" className="text-rose-700" onClick={() => setValue('indicators', indicators.filter((_, i) => i !== index), { shouldDirty: true })}>Удалить</button></div>
            <div className="grid gap-3 md:grid-cols-3">
              <label>Позиция контроля<select value={row.controlItemClientId || ''} onChange={(event) => updateIndicator(index, { controlItemClientId: event.target.value, controlItemId: undefined })} className={inputClass}>{controlItems.map((item) => <option key={item.clientId} value={item.clientId}>{item.name || item.code || 'Без названия'}{item.name && item.code ? ` (${item.code})` : ''}</option>)}</select></label>
               <div className="md:col-span-2"><Button type="button" variant="secondary" onClick={() => setNormativeIndicatorIndex(index)}>Выбрать из справочника</Button></div>
               {row.normativeId ? <div className="rounded-xl border bg-slate-50 p-3 md:col-span-3"><strong>{row.indicatorName}</strong><p>{row.comparisonType === 'LESS_OR_EQUAL' ? '≤ ' : ''}{row.normativeValue ?? '—'} {row.unit || ''}</p><p className="mt-2 text-xs text-slate-500">Документ: {row.normativeDocument || '—'}<br />Редакция: {row.normativeRevision || '—'}</p><p className="mt-2 text-xs font-semibold text-eco-800">После сохранения backend зафиксирует snapshot норматива; он отображается только для чтения.</p></div> : <p className="text-sm text-amber-700 md:col-span-3">Выберите показатель и норматив из справочника.</p>}
              <NumberField label="Нижняя граница нормы" value={row.minValue} onChange={(value) => updateIndicator(index, { minValue: value })} />
               <NumberField label="Верхняя граница нормы" value={row.maxValue} onChange={(value) => updateIndicator(index, { maxValue: value })} />
               {!row.normativeId && <TextField label="Причина ручного норматива *" value={row.manualNormativeReason || ''} onChange={(value) => updateIndicator(index, { manualNormativeReason: value, normativeSource: value.trim() ? 'MANUAL' : 'NONE' })} />}
              <label>Тип прибора<select value={row.measurementDeviceType || ''} disabled={measurementDevices.isLoading} onChange={(event) => updateIndicator(index, { measurementDeviceType: event.target.value || null })} className={inputClass}>
                <option value="">{measurementDevices.isLoading ? 'Загрузка средств измерений…' : 'Выберите тип прибора'}</option>
                {row.measurementDeviceType && !measurementDeviceTypes.includes(row.measurementDeviceType) && <option value={row.measurementDeviceType}>{row.measurementDeviceType}</option>}
                {measurementDeviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={row.mandatory} onChange={(event) => updateIndicator(index, { mandatory: event.target.checked })} />Обязательный</label>
            </div>
          </article>)}
          {!indicators.length && <PekState title="Показатели не добавлены" />}
        </div>}
        {step === 7 && program.data && <PekProgramStructuredSections program={program.data} section="internal-inspections" />}
        {step === 8 && program.data && <PekProgramStructuredSections program={program.data} section="measurement-qa" />}
        {step === 9 && program.data && <PekProgramStructuredSections program={program.data} section="emergency-procedures" />}
        {step === 10 && <div className="space-y-4">
          {program.data && <PekProgramStructuredSections program={program.data} section="responsibilities" />}
          <Button type="button" onClick={() => setValue('measures', [...measures, newMeasure()], { shouldDirty: true })}>Добавить мероприятие</Button>
          {measures.map((row, index) => <article key={row.clientId} className="rounded-xl border p-4">
            <div className="mb-3 flex justify-between"><strong>Мероприятие {index + 1}</strong><button type="button" className="text-rose-700" onClick={() => setValue('measures', measures.filter((_, i) => i !== index), { shouldDirty: true })}>Удалить</button></div>
            <div className="grid gap-3 md:grid-cols-3">
              <TextField label="Код *" value={row.code} onChange={(value) => updateMeasure(index, { code: value })} />
              <TextField label="Название *" value={row.name} onChange={(value) => updateMeasure(index, { name: value })} />
              <TextField label="Описание" value={row.description} onChange={(value) => updateMeasure(index, { description: value })} />
              <TextField label="Начало" type="date" value={row.plannedStartDate} onChange={(value) => updateMeasure(index, { plannedStartDate: value })} />
              <TextField label="Срок *" type="date" value={row.plannedEndDate} onChange={(value) => updateMeasure(index, { plannedEndDate: value })} />
              <PekLookupSelect label="Ответственный *" value={row.responsibleUserId} options={responsibleOptions} loading={responsibleLoading} error={responsibleError} onRetry={() => void Promise.all([assignees.refetch(), companyStaff.refetch(), systemUsers.refetch()])} onChange={(value) => updateMeasure(index, { responsibleUserId: value })} />
              <NumberField label="Бюджет" value={row.plannedBudget} onChange={(value) => updateMeasure(index, { plannedBudget: value })} />
              <TextField label="Валюта" value={row.currency} onChange={(value) => updateMeasure(index, { currency: value })} />
              <SelectField label="Статус" value={row.status} options={pekActionStatusOptions} onChange={(value) => updateMeasure(index, { status: value as PekActionStatus })} />
              <NumberField label="Выполнение, %" value={row.completionPercent} onChange={(value) => updateMeasure(index, { completionPercent: value })} />
              <TextField label="Результат" value={row.resultDescription} onChange={(value) => updateMeasure(index, { resultDescription: value })} />
            </div>
          </article>)}
          {!measures.length && <PekState title="Мероприятия не добавлены" />}
        </div>}
        {step === 11 && <div className="space-y-4"><h2 className="text-lg font-black">Экологические разрешения</h2><p className="text-sm text-slate-600">Выберите документы, относящиеся к этой программе.</p>{permits.isLoading ? <PekLoading /> : !activePermits.length ? <PekState title="Действующие документы не найдены" message="Сохраните черновик, добавьте разрешение в разделе «Разрешительные документы», затем вернитесь к программе." /> : <div className="space-y-2">{activePermits.map((permit) => <label key={permit.id} className="flex items-start gap-3 rounded-xl border p-3"><input type="checkbox" checked={(watch('permitIds') || []).includes(permit.id)} onChange={(event) => { const current = watch('permitIds') || []; setValue('permitIds', event.target.checked ? [...current, permit.id] : current.filter((permitId) => permitId !== permit.id), { shouldDirty: true }); }} /><span><strong>{permit.type} № {permit.number}</strong><span className="block text-sm text-slate-500">Выдано: {permit.issuedAt || '—'} · действует до {permit.validTo} · {permit.status === 'ACTIVE' ? 'Действует' : permit.status}</span></span></label>)}</div>}<p className="text-sm text-slate-500">Показываются только разрешения выбранной компании и объекта.</p></div>}
        {step === 12 && <div className="space-y-3">
          <h2 className="text-lg font-black">Проверка готовности программы</h2>
          <p>Программа: <strong>{watch('number')} · {watch('name')}</strong></p>
          <p>Позиции контроля: <strong>{controlItems.length}</strong></p>
          <p>Показатели: <strong>{indicators.length}</strong></p>
          <p>Мероприятия: <strong>{measures.length}</strong></p>
          <p>Разрешительных документов: <strong>{watch('permitIds')?.length || 0}</strong></p>
          <label className="block">Примечание к готовности<textarea {...register('readinessNotes')} rows={4} className={inputClass} /></label>
          {readiness.isLoading && <PekLoading />}
          {readiness.isError && <PekQueryError error={readiness.error} resource="проверку готовности" retry={() => void readiness.refetch()} />}
          {readiness.data && <PekReadinessPanel readiness={{ ...readiness.data, completionPercent: readiness.data.progressPercent }} onIssueClick={(issue) => setStep(stepForReadinessIssue(issue))} />}
          <p className="text-sm text-slate-500">Готовность рассчитывается по сохранённым данным. Нажмите на замечание, чтобы перейти к нужному разделу.</p>
        </div>}
      </section>
      <NormativeSelectorModal open={normativeIndicatorIndex != null} templateId={normativeIndicatorIndex == null ? '' : normativeTemplate(normativeIndicatorIndex)} onClose={() => setNormativeIndicatorIndex(null)} onAdd={chooseNormative} onManual={() => toast.error('Ручной норматив доступен только при поддержке причины backend-контрактом.')} />
      <footer className="mt-4 flex flex-wrap justify-between gap-3">
        <Button type="button" variant="secondary" disabled={step === 0 || save.isPending || saveDraft.isPending} onClick={() => setStep((value) => value - 1)}>Назад</Button>
        <Button type="button" variant="secondary" disabled={saveDraft.isPending || createServerDraft.isPending || save.isPending} onClick={saveDraftNow}>
          {saveDraft.isPending || createServerDraft.isPending ? 'Сохранение…' : 'Сохранить черновик'}
        </Button>
        {step < steps.length - 1
          ? <Button type="button" disabled={saveDraft.isPending || save.isPending} onClick={nextStep}>{saveDraft.isPending ? 'Сохранение…' : 'Продолжить'}</Button>
          : <Button type="submit" disabled={save.isPending} aria-busy={save.isPending}>{save.isPending ? 'Сохранение…' : 'Сохранить программу'}</Button>}
      </footer>
    </form>
    <Modal
      open={Boolean(draftToRestore)}
      title="Найден локальный черновик"
      description={draftToRestore ? `Сохранён ${new Date(draftToRestore.savedAt).toLocaleString('ru-RU')}. Выберите, какие данные продолжить редактировать.` : undefined}
      onClose={() => setDraftToRestore(null)}
      footer={<>
        <Button variant="secondary" onClick={() => setDraftToRestore(null)}>Продолжить с серверной версией</Button>
        <Button variant="secondary" onClick={() => { void removePekDraft(draftKey); setDraftToRestore(null); }}>Удалить черновик</Button>
        <Button onClick={() => { if (draftToRestore) reset({ ...pekProgramDefaults, ...draftToRestore.form }); setDraftToRestore(null); }}>Восстановить</Button>
      </>}
    ><p className="text-sm text-slate-600">Черновик принадлежит текущему пользователю, компании и версии сущности. Автоматически серверные данные не перезаписываются.</p></Modal>
    <Modal
      open={conflictOpen}
      title="Программа изменена другим пользователем"
      description="Локальные изменения сохранены в аварийном черновике. Загрузите актуальную версию и сравните данные перед повторным сохранением."
      onClose={() => setConflictOpen(false)}
      footer={<>
        <Button variant="secondary" onClick={() => setConflictOpen(false)}>Оставить мои данные</Button>
        <Button onClick={() => {
          void program.refetch().then((result) => {
            if (result.data) {
              versionRef.current = result.data.version;
              reset(mapProgramToForm(result.data));
            }
            setConflictOpen(false);
          });
        }}>Загрузить актуальную версию</Button>
      </>}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-amber-50 p-3"><strong>Локально</strong><p>Версия {versionRef.current}; изменения сохранены в local draft.</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><strong>Актуальная версия</strong><p>Будет загружена последняя сохранённая версия программы.</p></div>
      </div>
    </Modal>
  </div>;
};

const TextField = ({ label, value, type = 'text', onChange }: {
  label: string;
  value?: string | null;
  type?: string;
  onChange: (value: string) => void;
}) => <label>{label}<input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} className={inputClass} /></label>;

const NumberField = ({ label, value, onChange }: {
  label: string;
  value?: number | null;
  onChange: (value: number | null) => void;
}) => <label>{label}<input type="number" value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} className={inputClass} /></label>;

const SelectField = <T extends string>({ label, value, options, onChange }: {
  label: string;
  value?: string | null;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) => <label>{label}<select value={value || ''} onChange={(event) => onChange(event.target.value as T)} className={inputClass}>
  <option value="">Выберите значение</option>
  {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
</select></label>;

export default PekProgramCreatePage;
