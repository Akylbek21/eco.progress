import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
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
import { loadPekDraft, pekDraftKey, removePekDraft, savePekDraft } from '../utils/pekDraftStorage';
import { mapPekError } from '../utils/pekErrorMapper';
import { pekProgramFormSchema } from '../validation/programSchema';

const steps = ['Основные данные', 'Позиции контроля', 'Показатели', 'Мероприятия', 'Документы', 'Проверка и сохранение'];
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

const PekProgramCreatePage = () => {
  const { programId } = useParams();
  const edit = Boolean(programId);
  const id = Number(programId);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
  const [conflictOpen, setConflictOpen] = useState(false);
  const versionRef = useRef<number>(0);
  const hydratedProgramId = useRef<number>();
  const autosaveTimer = useRef<number>();

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
    () => pekDraftKey('program', user?.id, programId, edit ? program.data?.version ?? 'loading' : 'new'),
    [edit, program.data?.version, programId, user?.id],
  );

  useEffect(() => {
    if (!program.data) return;
    versionRef.current = program.data.version;
    if (hydratedProgramId.current === program.data.id) return;
    hydratedProgramId.current = program.data.id;
    reset(mapProgramToForm(program.data));
  }, [program.data, reset]);

  useEffect(() => {
    if (edit) return;
    let active = true;
    void loadPekDraft<PekProgramForm>(draftKey, 'new').then((draft) => {
      if (active && draft?.form) reset({ ...pekProgramDefaults, ...draft.form });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [draftKey, edit, reset]);

  const autosave = useMutation({
    mutationFn: (value: PekProgramForm) =>
      pekApi.saveProgramDraft(id, versionRef.current, mapProgramAutosaveToRequest(value)),
    retry: false,
    onMutate: () => setAutosaveState('saving'),
    onSuccess: (saved) => {
      versionRef.current = saved.version;
      queryClient.setQueryData(pekKeys.program(id), saved);
      setAutosaveState('saved');
      void removePekDraft(draftKey);
    },
    onError: (error) => {
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
      toast.error(mapped.message);
    },
  });

  if (program.isLoading) return <PekLoading />;
  if (program.isError) return <PekQueryError error={program.error} resource="Программа ПЭК" retry={() => void program.refetch()} />;
  if (edit && program.data?.readOnly) {
    return <PekState title="Программа доступна только для просмотра" message="Backend вернул readOnly=true. Редактирование отключено." />;
  }

  const submit = form.handleSubmit((value) => {
    const parsed = pekProgramFormSchema.safeParse(value);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Проверьте поля программы');
      setStep(0);
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

  return <div className="space-y-5">
    <PekPageHeader
      title={edit ? 'Редактирование программы ПЭК' : 'Создание программы ПЭК'}
      description={`Шаг ${step + 1} из ${steps.length} · ${steps[step]}`}
      actions={<span className="text-sm font-semibold text-slate-600" role="status">
        {autosaveState === 'saving' && 'Сохранение…'}
        {autosaveState === 'saved' && 'Сохранено'}
        {autosaveState === 'error' && <><span className="text-rose-700">Ошибка autosave</span> <button type="button" className="underline" onClick={() => autosave.mutate(getValues())}>Повторить</button></>}
        {autosaveState === 'conflict' && <span className="text-rose-700">Конфликт версии</span>}
      </span>}
    />
    <ol className="grid gap-2 md:grid-cols-6">
      {steps.map((label, index) => <li key={label} className={`rounded-xl p-3 text-center text-xs font-bold ${index === step ? 'bg-eco-700 text-white' : 'bg-white'}`}>{index + 1}. {label}</li>)}
    </ol>
    <form onSubmit={submit}>
      <section className="rounded-2xl border bg-white p-5">
        {step === 0 && <div className="grid gap-4 md:grid-cols-2">
          <label>Компания *<select {...register('companyId', { valueAsNumber: true })} disabled={edit} onChange={(event) => { setValue('companyId', Number(event.target.value), { shouldDirty: true }); setValue('objectId', 0); }} className={inputClass}><option value={0}>Выберите компанию</option>{companies.data?.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Объект *<select {...register('objectId', { valueAsNumber: true })} className={inputClass} disabled={edit || !companyId}><option value={0}>Выберите объект</option>{objects.data?.filter((item) => item.status !== 'ARCHIVED' && item.persisted !== false && item.isVirtual !== true).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Номер *<input {...register('number')} disabled={edit} className={inputClass} /></label>
          <label>Название *<input {...register('name')} className={inputClass} /></label>
          <label className="md:col-span-2">Описание<textarea {...register('description')} rows={3} className={inputClass} /></label>
          <label>Действует с *<input type="date" {...register('validFrom')} className={inputClass} /></label>
          <label>Действует до *<input type="date" {...register('validUntil')} className={inputClass} /></label>
          <PekLookupSelect label="Ответственный" value={watch('responsibleUserId')} options={assignees.data || []} loading={assignees.isLoading} error={assignees.isError} onRetry={() => void assignees.refetch()} onChange={(value) => setValue('responsibleUserId', value, { shouldDirty: true })} />
          {edit && <p className="text-xs text-slate-500 md:col-span-2">Текущий backend не разрешает менять компанию, объект и номер через EditProgramRequest.</p>}
          <div className="text-sm text-slate-600"><strong>Разрешительные документы</strong><p className="mt-2">{permits.isLoading ? 'Загрузка…' : permits.data?.length ? permits.data.map((item) => item.name).join(', ') : 'Для объекта нет доступных разрешительных документов'}</p></div>
          {Object.values(formState.errors).length > 0 && <p role="alert" className="md:col-span-2 text-sm text-rose-700">Проверьте обязательные поля программы.</p>}
        </div>}
        {step === 1 && <div className="space-y-4">
          <Button type="button" onClick={() => setValue('controlItems', [...controlItems, newControl(controlItems.length)], { shouldDirty: true })}>Добавить позицию</Button>
          {controlItems.map((row, index) => <article key={row.clientId} className="rounded-xl border p-4">
            <div className="mb-3 flex justify-between"><strong>Позиция {index + 1}</strong><button type="button" className="text-rose-700" onClick={() => setValue('controlItems', controlItems.filter((_, i) => i !== index), { shouldDirty: true })}>Удалить</button></div>
            <div className="grid gap-3 md:grid-cols-3">
              <TextField label="Код" value={row.code} onChange={(value) => updateControl(index, { code: value })} />
              <TextField label="Название" value={row.name} onChange={(value) => updateControl(index, { name: value })} />
              <TextField label="Раздел" value={row.sectionCode} onChange={(value) => updateControl(index, { sectionCode: value })} />
              <TextField label="Тип контроля" value={row.controlType} onChange={(value) => updateControl(index, { controlType: value })} />
              <TextField label="Компонент среды" value={row.environmentComponent} onChange={(value) => updateControl(index, { environmentComponent: value })} />
              <NumberField label="Точка мониторинга ID" value={row.monitoringPointId} onChange={(value) => updateControl(index, { monitoringPointId: value })} />
              <NumberField label="Источник выбросов ID" value={row.emissionSourceId} onChange={(value) => updateControl(index, { emissionSourceId: value })} />
              <NumberField label="Выпуск воды ID" value={row.waterOutletId} onChange={(value) => updateControl(index, { waterOutletId: value })} />
              <NumberField label="Источник отходов ID" value={row.wasteSourceId} onChange={(value) => updateControl(index, { wasteSourceId: value })} />
              <NumberField label="Лаборатория ID" value={row.laboratoryId} onChange={(value) => updateControl(index, { laboratoryId: value })} />
              <TextField label="Периодичность" value={row.frequencyType} onChange={(value) => updateControl(index, { frequencyType: value })} />
              <NumberField label="Значение периодичности" value={row.frequencyValue} onChange={(value) => updateControl(index, { frequencyValue: value })} />
              <NumberField label="Плановое количество" value={row.plannedCount} onChange={(value) => updateControl(index, { plannedCount: value })} />
              <TextField label="Метод измерения" value={row.measurementMethod} onChange={(value) => updateControl(index, { measurementMethod: value })} />
              <TextField label="Метод отбора" value={row.samplingMethod} onChange={(value) => updateControl(index, { samplingMethod: value })} />
              <TextField label="Дата начала" type="date" value={row.startDate} onChange={(value) => updateControl(index, { startDate: value })} />
              <TextField label="Дата окончания" type="date" value={row.endDate} onChange={(value) => updateControl(index, { endDate: value })} />
              <NumberField label="Ответственный ID" value={row.responsibleUserId} onChange={(value) => updateControl(index, { responsibleUserId: value })} />
              <label className="flex items-center gap-2"><input type="checkbox" checked={row.mandatory} onChange={(event) => updateControl(index, { mandatory: event.target.checked })} />Обязательная</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={row.active} onChange={(event) => updateControl(index, { active: event.target.checked })} />Активна</label>
            </div>
          </article>)}
          {!controlItems.length && <PekState title="Позиции контроля не добавлены" />}
        </div>}
        {step === 2 && <div className="space-y-4">
          <Button type="button" disabled={!controlItems.length} onClick={() => setValue('indicators', [...indicators, newIndicator(indicators.length, controlItems[0]?.clientId)], { shouldDirty: true })}>Добавить показатель</Button>
          {indicators.map((row, index) => <article key={row.clientId} className="rounded-xl border p-4">
            <div className="mb-3 flex justify-between"><strong>Показатель {index + 1}</strong><button type="button" className="text-rose-700" onClick={() => setValue('indicators', indicators.filter((_, i) => i !== index), { shouldDirty: true })}>Удалить</button></div>
            <div className="grid gap-3 md:grid-cols-3">
              <label>Позиция контроля<select value={row.controlItemClientId || ''} onChange={(event) => updateIndicator(index, { controlItemClientId: event.target.value, controlItemId: undefined })} className={inputClass}>{controlItems.map((item) => <option key={item.clientId} value={item.clientId}>{item.code || item.name || 'Без названия'}</option>)}</select></label>
              <NumberField label="Показатель ID" value={row.indicatorId} onChange={(value) => updateIndicator(index, { indicatorId: value })} />
              <TextField label="Код показателя" value={row.indicatorCode} onChange={(value) => updateIndicator(index, { indicatorCode: value })} />
              <TextField label="Название" value={row.indicatorName} onChange={(value) => updateIndicator(index, { indicatorName: value })} />
              <TextField label="Единица" value={row.unit} onChange={(value) => updateIndicator(index, { unit: value })} />
              <NumberField label="Норматив ID" value={row.normativeId} onChange={(value) => updateIndicator(index, { normativeId: value })} />
              <NumberField label="Норматив" value={row.normativeValue} onChange={(value) => updateIndicator(index, { normativeValue: value })} />
              <TextField label="Тип сравнения" value={row.comparisonType} onChange={(value) => updateIndicator(index, { comparisonType: value })} />
              <NumberField label="Минимум" value={row.minValue} onChange={(value) => updateIndicator(index, { minValue: value })} />
              <NumberField label="Максимум" value={row.maxValue} onChange={(value) => updateIndicator(index, { maxValue: value })} />
              <NumberField label="Методология ID" value={row.methodologyId} onChange={(value) => updateIndicator(index, { methodologyId: value })} />
              <TextField label="Тип прибора" value={row.measurementDeviceType} onChange={(value) => updateIndicator(index, { measurementDeviceType: value })} />
              <label className="flex items-center gap-2"><input type="checkbox" checked={row.mandatory} onChange={(event) => updateIndicator(index, { mandatory: event.target.checked })} />Обязательный</label>
            </div>
          </article>)}
          {!indicators.length && <PekState title="Показатели не добавлены" />}
        </div>}
        {step === 3 && <div className="space-y-4">
          <Button type="button" onClick={() => setValue('measures', [...measures, newMeasure()], { shouldDirty: true })}>Добавить мероприятие</Button>
          {measures.map((row, index) => <article key={row.clientId} className="rounded-xl border p-4">
            <div className="mb-3 flex justify-between"><strong>Мероприятие {index + 1}</strong><button type="button" className="text-rose-700" onClick={() => setValue('measures', measures.filter((_, i) => i !== index), { shouldDirty: true })}>Удалить</button></div>
            <div className="grid gap-3 md:grid-cols-3">
              <TextField label="Код" value={row.code} onChange={(value) => updateMeasure(index, { code: value })} />
              <TextField label="Название" value={row.name} onChange={(value) => updateMeasure(index, { name: value })} />
              <TextField label="Описание" value={row.description} onChange={(value) => updateMeasure(index, { description: value })} />
              <TextField label="Начало" type="date" value={row.plannedStartDate} onChange={(value) => updateMeasure(index, { plannedStartDate: value })} />
              <TextField label="Окончание" type="date" value={row.plannedEndDate} onChange={(value) => updateMeasure(index, { plannedEndDate: value })} />
              <NumberField label="Ответственный ID" value={row.responsibleUserId} onChange={(value) => updateMeasure(index, { responsibleUserId: value })} />
              <NumberField label="Бюджет" value={row.plannedBudget} onChange={(value) => updateMeasure(index, { plannedBudget: value })} />
              <TextField label="Валюта" value={row.currency} onChange={(value) => updateMeasure(index, { currency: value })} />
              <TextField label="Статус" value={row.status} onChange={(value) => updateMeasure(index, { status: value })} />
              <NumberField label="Выполнение, %" value={row.completionPercent} onChange={(value) => updateMeasure(index, { completionPercent: value })} />
              <TextField label="Результат" value={row.resultDescription} onChange={(value) => updateMeasure(index, { resultDescription: value })} />
            </div>
          </article>)}
          {!measures.length && <PekState title="Мероприятия не добавлены" />}
        </div>}
        {step === 4 && <PekState title={edit ? 'Документы загружаются в карточке программы' : 'Сначала сохраните программу'} message="Backend требует ID программы для загрузки документа. После сохранения откроется карточка с drag-and-drop загрузкой." />}
        {step === 5 && <div className="space-y-3">
          <h2 className="text-lg font-black">Проверка</h2>
          <p>Программа: <strong>{watch('number')} · {watch('name')}</strong></p>
          <p>Позиции контроля: <strong>{controlItems.length}</strong></p>
          <p>Показатели: <strong>{indicators.length}</strong></p>
          <p>Мероприятия: <strong>{measures.length}</strong></p>
          <p className="text-sm text-slate-500">Пустые коллекции будут переданы как `[]` и очищены на backend. Autosave коллекции не отправляет.</p>
        </div>}
      </section>
      <footer className="mt-4 flex justify-between">
        <Button type="button" variant="secondary" disabled={step === 0 || save.isPending} onClick={() => setStep((value) => value - 1)}>Назад</Button>
        {step < steps.length - 1
          ? <Button type="button" onClick={() => setStep((value) => value + 1)}>Продолжить</Button>
          : <Button type="submit" disabled={save.isPending} aria-busy={save.isPending}>{save.isPending ? 'Сохранение…' : 'Сохранить программу'}</Button>}
      </footer>
    </form>
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
        <div className="rounded-xl bg-slate-50 p-3"><strong>Backend</strong><p>Будет загружена свежая версия сущности.</p></div>
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
