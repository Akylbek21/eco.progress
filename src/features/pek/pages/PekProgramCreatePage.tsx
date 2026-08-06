import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { getCompanies, getCompanyObjects } from '../../../services/companyService';
import type { PekControlItem, PekIndicator, PekMeasure, PekProgramForm } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import PekLookupSelect from '../components/common/PekLookupSelect';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekState } from '../components/common/PekUi';
import { pekProgramDefaults } from '../forms/programDefaults';
import {
  mapProgramAutosaveToRequest,
  mapProgramCreateFormToRequest,
  mapProgramEditFormToRequest,
  mapProgramToForm,
} from '../mappers/programMappers';
import { loadPekDraft, pekDraftKey, removePekDraft, savePekDraft, type PekStoredDraft } from '../utils/pekDraftStorage';
import { mapPekError } from '../utils/pekErrorMapper';
import { pekProgramFormSchema } from '../validation/programSchema';

const steps = ['Основные сведения', 'План контроля', 'Мероприятия', 'Документы', 'Проверка'];
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
const stepForField = (field: string) => field.startsWith('controlItems') || field.startsWith('indicators') ? 1
  : field.startsWith('measures') ? 2
    : field.startsWith('documents') ? 3 : 0;

const PekProgramCreatePage = () => {
  const { programId } = useParams();
  const edit = Boolean(programId);
  const id = Number(programId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState(() => Math.min(steps.length - 1, Math.max(0, Number(searchParams.get('step')) || 0)));
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'offline' | 'error' | 'conflict'>('idle');
  const [conflictOpen, setConflictOpen] = useState(false);
  const [draftToRestore, setDraftToRestore] = useState<PekStoredDraft<PekProgramForm> | null>(null);
  const versionRef = useRef<number>(0);
  const hydratedProgramId = useRef<number>();
  const autosaveTimer = useRef<number>();
  const autosaveController = useRef<AbortController>();
  const autosaveSequence = useRef(0);
  const appliedAutosaveSequence = useRef(0);
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
    queryKey: pekKeys.program(id),
    queryFn: ({ signal }) => pekApi.getProgram(id, signal),
    enabled: edit && Number.isFinite(id),
  });
  const companies = useQuery({
    queryKey: ['pek', 'program-form', 'companies'],
    queryFn: ({ signal }) => getCompanies({ page: 0, size: 100, status: 'ACTIVE' }, signal),
  });
  const objects = useQuery({
    queryKey: ['pek', 'program-form', 'objects', companyId],
    queryFn: ({ signal }) => getCompanyObjects(String(companyId), false, signal),
    enabled: companyId > 0,
  });
  const assignees = useQuery({
    queryKey: pekKeys.assignees(['PEK_RESPONSIBLE']),
    queryFn: ({ signal }) => pekApi.getAssignees(['PEK_RESPONSIBLE'], signal),
  });
  const permits = useQuery({
    queryKey: pekKeys.permits(objectId),
    queryFn: ({ signal }) => pekApi.getObjectPermits(objectId, signal),
    enabled: objectId > 0,
  });
  const draftKey = useMemo(
    () => pekDraftKey('program', user?.id, programId, edit ? program.data?.version ?? 'loading' : 'new', companyId || 'none'),
    [companyId, edit, program.data?.version, programId, user?.id],
  );

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
      const saved = await pekApi.saveProgramDraft(id, versionRef.current, mapProgramAutosaveToRequest(value), controller.signal);
      return { saved, sequence };
    },
    retry: false,
    onMutate: () => setAutosaveState('saving'),
    onSuccess: ({ saved, sequence }) => {
      if (sequence < appliedAutosaveSequence.current) return;
      appliedAutosaveSequence.current = sequence;
      versionRef.current = saved.version;
      queryClient.setQueryData(pekKeys.program(id), saved);
      setAutosaveState('saved');
      void removePekDraft(draftKey);
    },
    onError: (error) => {
      if (axios.isCancel(error) || (error instanceof DOMException && error.name === 'AbortError')) return;
      if (mapPekError(error).status === 409) {
        setAutosaveState('conflict');
        setConflictOpen(true);
      } else {
        setAutosaveState('error');
      }
    },
  });

  useEffect(() => {
    const subscription = watch((partial) => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = window.setTimeout(() => {
        const value = { ...pekProgramDefaults, ...partial } as PekProgramForm;
        void savePekDraft(draftKey, value, edit ? versionRef.current : 'new');
        const payloadHash = JSON.stringify(mapProgramAutosaveToRequest(value));
        if (payloadHash === lastAutosaveHash.current) return;
        lastAutosaveHash.current = payloadHash;
        if (!navigator.onLine) {
          setAutosaveState('offline');
          return;
        }
        if (
          edit
          && program.data
          && ['DRAFT', 'RETURNED'].includes(program.data.status)
          && !autosave.isPending
        ) {
          autosave.mutate(value);
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

  const save = useMutation({
    mutationFn: (value: PekProgramForm) => edit
      ? pekApi.updateProgram(id, versionRef.current, mapProgramEditFormToRequest(value))
      : pekApi.createProgram(mapProgramCreateFormToRequest(value)),
    retry: false,
    onSuccess: async (saved) => {
      versionRef.current = saved.version;
      await removePekDraft(draftKey).catch(() => undefined);
      queryClient.setQueryData(pekKeys.program(saved.id), saved);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pekKeys.programs() }),
        queryClient.invalidateQueries({ queryKey: pekKeys.dashboard() }),
      ]);
      toast.success(edit ? 'Программа обновлена' : 'Программа создана');
      navigate(`/staff/pek/programs/${saved.id}`);
    },
    onError: (error) => {
      const mapped = mapPekError(error);
      if (mapped.status === 409) {
        setAutosaveState('conflict');
        setConflictOpen(true);
      }
      const firstField = Object.keys(mapped.fieldErrors)[0];
      Object.entries(mapped.fieldErrors).forEach(([field, message]) => form.setError(field as FieldPath<PekProgramForm>, { message }));
      if (firstField) {
        setStep(stepForField(firstField));
        window.setTimeout(() => form.setFocus(firstField as FieldPath<PekProgramForm>), 0);
      }
      toast.error(mapped.message);
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
      queryClient.setQueryData(pekKeys.program(saved.id), saved);
      await removePekDraft(draftKey).catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: pekKeys.programs() });
      setAutosaveState('saved');
      toast.success('Черновик программы сохранён');
      navigate(`/staff/pek/programs/${saved.id}/edit?step=1`, { replace: true });
    },
    onError: (error) => {
      setAutosaveState('error');
      const mapped = mapPekError(error);
      Object.entries(mapped.fieldErrors).forEach(([field, message]) => form.setError(field as FieldPath<PekProgramForm>, { message }));
      toast.error(mapped.message);
    },
  });

  if (program.isLoading) return <PekLoading />;
  if (program.isError) return <PekQueryError error={program.error} resource="Программа ПЭК" retry={() => void program.refetch()} />;
  if (edit && program.data?.readOnly) {
    return <PekState title="Программа доступна только для просмотра" message="Изменение этой программы сейчас недоступно." />;
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
  const validateHeader = (value: PekProgramForm) => {
    let message = '';
    if (!value.companyId) { form.setError('companyId', { message: 'Выберите компанию' }); message = 'Выберите компанию'; }
    else if (!value.objectId) { form.setError('objectId', { message: 'Выберите объект' }); message = 'Выберите объект'; }
    else if (!value.number.trim()) { form.setError('number', { message: 'Укажите номер' }); message = 'Укажите номер'; }
    else if (!value.name.trim()) { form.setError('name', { message: 'Укажите название' }); message = 'Укажите название'; }
    else if (!value.validFrom || !value.validUntil || value.validUntil < value.validFrom) { form.setError('validUntil', { message: 'Проверьте период программы' }); message = 'Проверьте период программы'; }
    return message;
  };

  const saveDraftNow = () => {
    const value = getValues();
    const message = validateHeader(value);
    if (message) { toast.error(message); return; }
    if (edit) autosave.mutate(value);
    else createServerDraft.mutate(value);
  };

  const nextStep = () => {
    const value = getValues();
    let message = '';
    if (step === 0) message = validateHeader(value);
    else if (step === 1 && value.controlItems.some((row) => !row.code.trim() || !row.name.trim() || !row.controlType || !row.frequencyType || (row.frequencyType === 'PER_EVENT' && !row.plannedCount))) message = 'Заполните обязательные поля каждой контрольной позиции';
    else if (step === 1 && value.indicators.some((row) => !row.controlItemClientId || !row.indicatorName.trim() || !row.unit || !row.comparisonType)) message = 'Заполните обязательные сведения каждого показателя';
    else if (step === 2 && value.measures.some((row) => !row.code?.trim() || !row.name.trim() || !row.responsibleUserId || !row.plannedEndDate)) message = 'Заполните код, название, ответственного и срок каждого мероприятия';
    if (message) { toast.error(message); return; }
    if (!edit && step === 0) {
      createServerDraft.mutate(value);
      return;
    }
    setStep((current) => current + 1);
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
    <ol className="grid gap-2 md:grid-cols-5">
      {steps.map((label, index) => <li key={label} className={`rounded-xl p-3 text-center text-xs font-bold ${index === step ? 'bg-eco-700 text-white' : 'bg-white'}`}>{index + 1}. {label}</li>)}
    </ol>
    <form onSubmit={submit}>
      <section className="rounded-2xl border bg-white p-5">
        {Object.keys(formState.errors).length > 0 && <div role="alert" aria-live="assertive" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Проверьте заполнение текущего раздела. Первая ошибка: {String(Object.values(formState.errors)[0]?.message || 'некорректные данные')}</div>}
        {step === 0 && <div className="grid gap-4 md:grid-cols-2">
          <label>Компания *<select {...register('companyId', { valueAsNumber: true })} disabled={edit} onChange={(event) => { setValue('companyId', Number(event.target.value), { shouldDirty: true }); setValue('objectId', 0); }} className={inputClass}><option value={0}>Выберите компанию</option>{companies.data?.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Объект *<select {...register('objectId', { valueAsNumber: true })} className={inputClass} disabled={edit || !companyId}><option value={0}>Выберите объект</option>{objects.data?.filter((item) => item.status !== 'ARCHIVED' && item.persisted !== false && item.isVirtual !== true).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Номер *<input {...register('number')} disabled={edit} className={inputClass} /></label>
          <label>Название *<input {...register('name')} className={inputClass} /></label>
          <label className="md:col-span-2">Описание<textarea {...register('description')} rows={3} className={inputClass} /></label>
          <label>Действует с *<input type="date" {...register('validFrom')} className={inputClass} /></label>
          <label>Действует до *<input type="date" {...register('validUntil')} className={inputClass} /></label>
          <PekLookupSelect label="Ответственный" value={watch('responsibleUserId')} options={assignees.data || []} loading={assignees.isLoading} error={assignees.isError} onRetry={() => void assignees.refetch()} onChange={(value) => setValue('responsibleUserId', value, { shouldDirty: true })} />
          {edit && <p className="text-xs text-slate-500 md:col-span-2">Компания, объект и номер фиксируются при создании программы.</p>}
          <div className="text-sm text-slate-600"><strong>Разрешительные документы</strong><p className="mt-2">{permits.isLoading ? 'Загрузка…' : permits.data?.length ? permits.data.map((item) => item.name).join(', ') : 'Для объекта нет доступных разрешительных документов'}</p></div>
          {Object.values(formState.errors).length > 0 && <p role="alert" className="md:col-span-2 text-sm text-rose-700">Проверьте обязательные поля программы.</p>}
        </div>}
        {step === 1 && <div className="space-y-4">
          <Button type="button" onClick={() => setValue('controlItems', [...controlItems, newControl(controlItems.length)], { shouldDirty: true })}>Добавить позицию</Button>
          {controlItems.map((row, index) => <article key={row.clientId} className="rounded-xl border p-4">
            <div className="mb-3 flex justify-between"><strong>Позиция {index + 1}</strong><button type="button" className="text-rose-700" onClick={() => setValue('controlItems', controlItems.filter((_, i) => i !== index), { shouldDirty: true })}>Удалить</button></div>
            <div className="grid gap-3 md:grid-cols-3">
              <TextField label="Код *" value={row.code} onChange={(value) => updateControl(index, { code: value })} />
              <TextField label="Название *" value={row.name} onChange={(value) => updateControl(index, { name: value })} />
              <TextField label="Раздел" value={row.sectionCode} onChange={(value) => updateControl(index, { sectionCode: value })} />
              <TextField label="Тип контроля *" value={row.controlType} onChange={(value) => updateControl(index, { controlType: value })} />
              <TextField label="Компонент среды" value={row.environmentComponent} onChange={(value) => updateControl(index, { environmentComponent: value })} />
              <TextField label="Периодичность *" value={row.frequencyType} onChange={(value) => updateControl(index, { frequencyType: value })} />
              <NumberField label="Значение периодичности" value={row.frequencyValue} onChange={(value) => updateControl(index, { frequencyValue: value })} />
              <NumberField label="Плановое количество" value={row.plannedCount} onChange={(value) => updateControl(index, { plannedCount: value })} />
              {row.frequencyType === 'PER_EVENT' && <p className="self-end text-sm text-slate-600">По событию — укажите ожидаемое количество измерений.</p>}
              <TextField label="Метод измерения" value={row.measurementMethod} onChange={(value) => updateControl(index, { measurementMethod: value })} />
              <TextField label="Метод отбора" value={row.samplingMethod} onChange={(value) => updateControl(index, { samplingMethod: value })} />
              <TextField label="Дата начала" type="date" value={row.startDate} onChange={(value) => updateControl(index, { startDate: value })} />
              <TextField label="Дата окончания" type="date" value={row.endDate} onChange={(value) => updateControl(index, { endDate: value })} />
              <PekLookupSelect label="Ответственный" value={row.responsibleUserId} options={assignees.data || []} loading={assignees.isLoading} error={assignees.isError} onRetry={() => void assignees.refetch()} onChange={(value) => updateControl(index, { responsibleUserId: value })} />
              <label className="flex items-center gap-2"><input type="checkbox" checked={row.mandatory} onChange={(event) => updateControl(index, { mandatory: event.target.checked })} />Обязательная</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={row.active} onChange={(event) => updateControl(index, { active: event.target.checked })} />Активна</label>
            </div>
          </article>)}
          {!controlItems.length && <PekState title="Позиции контроля не добавлены" />}
        </div>}
        {step === 1 && <div className="mt-6 space-y-4 border-t pt-5">
          <h2 className="text-lg font-black">Показатели</h2>
          <Button type="button" disabled={!controlItems.length} onClick={() => setValue('indicators', [...indicators, newIndicator(indicators.length, controlItems[0]?.clientId)], { shouldDirty: true })}>Добавить показатель</Button>
          {indicators.map((row, index) => <article key={row.clientId} className="rounded-xl border p-4">
            <div className="mb-3 flex justify-between"><strong>Показатель {index + 1}</strong><button type="button" className="text-rose-700" onClick={() => setValue('indicators', indicators.filter((_, i) => i !== index), { shouldDirty: true })}>Удалить</button></div>
            <div className="grid gap-3 md:grid-cols-3">
              <label>Позиция контроля<select value={row.controlItemClientId || ''} onChange={(event) => updateIndicator(index, { controlItemClientId: event.target.value, controlItemId: undefined })} className={inputClass}>{controlItems.map((item) => <option key={item.clientId} value={item.clientId}>{item.code || item.name || 'Без названия'}</option>)}</select></label>
              <TextField label="Код показателя" value={row.indicatorCode} onChange={(value) => updateIndicator(index, { indicatorCode: value })} />
              <TextField label="Название *" value={row.indicatorName} onChange={(value) => updateIndicator(index, { indicatorName: value })} />
              <TextField label="Единица *" value={row.unit} onChange={(value) => updateIndicator(index, { unit: value })} />
              <NumberField label="Норматив" value={row.normativeValue} onChange={(value) => updateIndicator(index, { normativeValue: value })} />
              <label>Условие сравнения *<select value={row.comparisonType || ''} onChange={(event) => updateIndicator(index, { comparisonType: event.target.value || null })} className={inputClass}><option value="">Выберите условие</option><option value="MAX">Не более</option><option value="MIN">Не менее</option><option value="RANGE">Диапазон</option><option value="EQUAL">Равно</option><option value="INFORMATIONAL">Информационный</option></select></label>
              <NumberField label="Минимум" value={row.minValue} onChange={(value) => updateIndicator(index, { minValue: value })} />
              <NumberField label="Максимум" value={row.maxValue} onChange={(value) => updateIndicator(index, { maxValue: value })} />
              <TextField label="Тип прибора" value={row.measurementDeviceType} onChange={(value) => updateIndicator(index, { measurementDeviceType: value })} />
              <label className="flex items-center gap-2"><input type="checkbox" checked={row.mandatory} onChange={(event) => updateIndicator(index, { mandatory: event.target.checked })} />Обязательный</label>
            </div>
          </article>)}
          {!indicators.length && <PekState title="Показатели не добавлены" />}
        </div>}
        {step === 2 && <div className="space-y-4">
          <Button type="button" onClick={() => setValue('measures', [...measures, newMeasure()], { shouldDirty: true })}>Добавить мероприятие</Button>
          {measures.map((row, index) => <article key={row.clientId} className="rounded-xl border p-4">
            <div className="mb-3 flex justify-between"><strong>Мероприятие {index + 1}</strong><button type="button" className="text-rose-700" onClick={() => setValue('measures', measures.filter((_, i) => i !== index), { shouldDirty: true })}>Удалить</button></div>
            <div className="grid gap-3 md:grid-cols-3">
              <TextField label="Код *" value={row.code} onChange={(value) => updateMeasure(index, { code: value })} />
              <TextField label="Название *" value={row.name} onChange={(value) => updateMeasure(index, { name: value })} />
              <TextField label="Описание" value={row.description} onChange={(value) => updateMeasure(index, { description: value })} />
              <TextField label="Начало" type="date" value={row.plannedStartDate} onChange={(value) => updateMeasure(index, { plannedStartDate: value })} />
              <TextField label="Срок *" type="date" value={row.plannedEndDate} onChange={(value) => updateMeasure(index, { plannedEndDate: value })} />
              <PekLookupSelect label="Ответственный *" value={row.responsibleUserId} options={assignees.data || []} loading={assignees.isLoading} error={assignees.isError} onRetry={() => void assignees.refetch()} onChange={(value) => updateMeasure(index, { responsibleUserId: value })} />
              <NumberField label="Бюджет" value={row.plannedBudget} onChange={(value) => updateMeasure(index, { plannedBudget: value })} />
              <TextField label="Валюта" value={row.currency} onChange={(value) => updateMeasure(index, { currency: value })} />
              <TextField label="Статус" value={row.status} onChange={(value) => updateMeasure(index, { status: value })} />
              <NumberField label="Выполнение, %" value={row.completionPercent} onChange={(value) => updateMeasure(index, { completionPercent: value })} />
              <TextField label="Результат" value={row.resultDescription} onChange={(value) => updateMeasure(index, { resultDescription: value })} />
            </div>
          </article>)}
          {!measures.length && <PekState title="Мероприятия не добавлены" />}
        </div>}
        {step === 3 && <PekState title={edit ? 'Документы загружаются в карточке программы' : 'Сначала сохраните программу'} message="После сохранения программы откроется карточка, где можно загрузить документы." />}
        {step === 4 && <div className="space-y-3">
          <h2 className="text-lg font-black">Проверка</h2>
          <p>Программа: <strong>{watch('number')} · {watch('name')}</strong></p>
          <p>Позиции контроля: <strong>{controlItems.length}</strong></p>
          <p>Показатели: <strong>{indicators.length}</strong></p>
          <p>Мероприятия: <strong>{measures.length}</strong></p>
          <p className="text-sm text-slate-500">Проверьте сведения перед сохранением. Пустые разделы будут сохранены без записей.</p>
        </div>}
      </section>
      <footer className="mt-4 flex flex-wrap justify-between gap-3">
        <Button type="button" variant="secondary" disabled={step === 0 || save.isPending} onClick={() => setStep((value) => value - 1)}>Назад</Button>
        <Button type="button" variant="secondary" disabled={autosave.isPending || createServerDraft.isPending || save.isPending} onClick={saveDraftNow}>
          {autosave.isPending || createServerDraft.isPending ? 'Сохранение…' : 'Сохранить черновик'}
        </Button>
        {step < steps.length - 1
          ? <Button type="button" onClick={nextStep}>Продолжить</Button>
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

export default PekProgramCreatePage;
