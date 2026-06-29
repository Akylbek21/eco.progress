import { useEffect, useRef, useState } from 'react';
import { Archive, CloudSun, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import type { ProtocolEnvironmentalConditions, WeatherConditions, WeatherConditionsStatus } from '../../types/protocols';

type ObjectOption = { id: string; name: string };
type WeatherSelection = { objectId: string; date: string; time: string; signal?: AbortSignal };
type Props = {
  value: ProtocolEnvironmentalConditions;
  measurementDate: string;
  measurementTime: string;
  objectId: string;
  objectName: string;
  objectOptions?: ObjectOption[];
  readOnly: boolean;
  loading?: boolean;
  onSelectionChange: (value: { objectId: string; date: string; time: string }) => void;
  onRequestConditions: (selection: WeatherSelection) => Promise<WeatherConditions | void>;
  onChange: (value: ProtocolEnvironmentalConditions) => void;
};

const today = () => new Date().toISOString().slice(0, 10);
const DEFAULT_WEATHER_TIME = '12:00';
const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';
const statusLabels: Record<WeatherConditionsStatus, string> = {
  IDLE: 'Сохранённые условия',
  LOADING: 'Загрузка условий…',
  LOADED: 'Условия загружены',
  API_UNAVAILABLE: 'Погодный API недоступен',
  COORDINATES_MISSING: 'У объекта отсутствуют координаты',
  MANUAL: 'Введено вручную',
};
const formatDateTime = (value?: string) => {
  if (!value) return 'Не указано';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU');
};

const ProtocolEnvironmentForm = ({
  value, measurementDate, objectId, objectName, objectOptions = [], readOnly, loading = false,
  onSelectionChange, onRequestConditions, onChange,
}: Props) => {
  const [selection, setSelection] = useState({ objectId, date: measurementDate, time: DEFAULT_WEATHER_TIME });
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const initialRender = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const mainFields: Array<[keyof ProtocolEnvironmentalConditions, string]> = [
    ['temperature', 'Температура, °C'], ['humidity', 'Влажность, %'], ['pressureKpa', 'Давление, кПа'], ['windSpeed', 'Скорость ветра, м/с'],
  ];

  useEffect(() => {
    setSelection({ objectId, date: measurementDate, time: DEFAULT_WEATHER_TIME });
  }, [objectId, measurementDate]);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    if (readOnly || !selection.objectId || !selection.date || !selection.time) return;
    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      onRequestConditions({ ...selection, signal: controller.signal }).catch(() => undefined);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [selection.objectId, selection.date, selection.time, readOnly]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const updateSelection = (patch: Partial<typeof selection>) => {
    const next = { ...selection, ...patch, time: DEFAULT_WEATHER_TIME };
    setSelection(next);
    onSelectionChange(next);
  };
  const refresh = () => {
    if (!selection.objectId || !selection.date || !selection.time) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    onRequestConditions({ ...selection, signal: controller.signal }).catch(() => undefined);
  };
  const openEdit = () => {
    setDraft(value);
    setReason('');
    setError('');
    setEditOpen(true);
  };
  const save = () => {
    if (!reason.trim()) return setError('Укажите причину ручного изменения.');
    onChange({
      ...value,
      ...draft,
      status: 'MANUAL',
      source: 'MANUAL',
      dataSource: 'Введено сотрудником',
      observedAt: new Date().toISOString(),
      manualChangeReason: reason.trim(),
    });
    setEditOpen(false);
  };
  const isArchive = Boolean(selection.date && selection.date < today());
  const isLoading = loading || value.status === 'LOADING';

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><CloudSun className="h-5 w-5 text-eco-700" /> Условия среды</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
              <span>{statusLabels[value.status || 'IDLE']}</span>
              {isArchive && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 font-bold text-sky-800"><Archive className="h-3.5 w-3.5" /> Архивные погодные данные</span>}
            </div>
          </div>
          {!readOnly && <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={isLoading || !selection.objectId || !selection.date || !selection.time} onClick={refresh}><RefreshCw className="h-4 w-4" /> Получить погоду</Button>
            <Button type="button" variant="secondary" disabled={isLoading} onClick={openEdit}>Ввести вручную</Button>
          </div>}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Дата замера</span><input type="date" max={today()} disabled={readOnly} value={selection.date} onChange={(event) => updateSelection({ date: event.target.value })} className={inputClass} /></label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            <span>Время замера</span>
            <input type="time" readOnly disabled value={DEFAULT_WEATHER_TIME} className={inputClass} />
            <span className="block text-xs font-semibold text-slate-500">Погодные данные автоматически берутся на 12:00</span>
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>Место / объект</span>
            {objectOptions.length > 1
              ? <select disabled={readOnly} value={selection.objectId} onChange={(event) => updateSelection({ objectId: event.target.value })} className={inputClass}>{objectOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              : <input readOnly value={objectOptions.find((item) => item.id === selection.objectId)?.name || objectName || 'Объект не указан'} className={`${inputClass} bg-slate-100`} />}
          </label>
        </div>

        {isLoading ? <div className="mt-4 grid animate-pulse grid-cols-2 gap-4 lg:grid-cols-4">
          {mainFields.map(([, label]) => <div key={label}><div className="mb-2 h-4 w-28 rounded bg-slate-100" /><div className="h-11 rounded-xl bg-slate-100" /></div>)}
        </div> : <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {mainFields.map(([key, label]) => <label key={key} className="space-y-1.5 text-sm font-semibold text-slate-700"><span>{label}</span><input readOnly value={value[key] || ''} className={`${inputClass} bg-slate-100`} /></label>)}
        </div>}

        <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
          <div><p className="text-xs font-bold uppercase text-slate-400">Источник данных</p><p className="mt-1 font-semibold text-slate-700">{value.dataSource || (value.source === 'MANUAL' ? 'Введено сотрудником' : 'Погодный сервис')}</p></div>
          <div><p className="text-xs font-bold uppercase text-slate-400">Фактическое время погодной записи</p><p className="mt-1 font-semibold text-slate-700">{formatDateTime(value.observedAt)}</p></div>
          {value.manualChangeReason && <div className="sm:col-span-2"><p className="text-xs font-bold uppercase text-slate-400">Причина ручного изменения</p><p className="mt-1 font-semibold text-amber-800">{value.manualChangeReason}</p></div>}
        </div>
      </section>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Ручное изменение условий" size="md">
        <div className="grid gap-4 sm:grid-cols-2">
          {mainFields.map(([key, label]) => <label key={key} className="space-y-1.5 text-sm font-semibold text-slate-700"><span>{label}</span><input type="number" step="any" value={draft[key] || ''} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} className={inputClass} /></label>)}
          <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2"><span>Причина изменения *</span><textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} />{error && <span className="block text-rose-700">{error}</span>}</label>
        </div>
        <div className="mt-5 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>Отмена</Button><Button type="button" onClick={save}>Сохранить</Button></div>
      </Modal>
    </>
  );
};

export default ProtocolEnvironmentForm;
