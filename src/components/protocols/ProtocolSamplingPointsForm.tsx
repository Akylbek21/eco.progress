import { MapPin, Plus, Trash2 } from 'lucide-react';
import type { ProtocolResult, ProtocolSamplingPoint } from '../../types/protocols';

type Props = {
  points: ProtocolSamplingPoint[];
  results: ProtocolResult[];
  disabled?: boolean;
  onChange: (points: ProtocolSamplingPoint[]) => void;
  onSave: () => void;
};

const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100';

const createClientPointId = () => globalThis.crypto?.randomUUID?.()
  || `sampling-point-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const ProtocolSamplingPointsForm = ({ points, results, disabled = false, onChange, onSave }: Props) => {
  const addPoint = () => onChange([
    ...points,
    {
      clientPointId: createClientPointId(),
      name: `Место отбора ${points.length + 1}`,
      description: '',
      latitude: null,
      longitude: null,
      sortOrder: points.length,
    },
  ]);

  const updatePoint = (index: number, patch: Partial<ProtocolSamplingPoint>) => {
    onChange(points.map((point, pointIndex) => pointIndex === index ? { ...point, ...patch } : point));
  };

  const removePoint = (index: number) => {
    const point = points[index];
    const identifiers = [point.id, point.clientPointId].filter((value) => value !== undefined && value !== null).map(String);
    const isUsed = results.some((result) => result.samplingPointId != null && identifiers.includes(String(result.samplingPointId)));
    if (isUsed) return;
    onChange(points.filter((_, pointIndex) => pointIndex !== index).map((item, sortOrder) => ({ ...item, sortOrder })));
  };

  const canSave = points.length > 0 && points.every((point) => point.name.trim());

  return (
    <section aria-labelledby="protocol-sampling-points-title" className="rounded-2xl border border-eco-200 bg-eco-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="protocol-sampling-points-title" className="flex items-center gap-2 text-base font-black text-slate-950">
            <MapPin className="h-5 w-5 text-eco-700" />Места отбора
          </h3>
          <p className="mt-1 text-sm text-slate-600">Добавьте точку протокола, затем сохраните её — после этого она появится в списке результатов.</p>
        </div>
        <button type="button" disabled={disabled} onClick={addPoint} className="inline-flex items-center gap-2 rounded-xl bg-eco-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-eco-800 disabled:opacity-50">
          <Plus className="h-4 w-4" />Добавить место отбора
        </button>
      </div>

      {!points.length && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">В протоколе нет мест отбора. Добавьте и сохраните хотя бы одно место перед результатами.</p>}

      <div className="mt-4 space-y-3">
        {points.map((point, index) => {
          const identifiers = [point.id, point.clientPointId].filter((value) => value !== undefined && value !== null).map(String);
          const isUsed = results.some((result) => result.samplingPointId != null && identifiers.includes(String(result.samplingPointId)));
          return <article key={String(point.id || point.clientPointId || index)} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <strong className="text-sm text-slate-800">Точка {index + 1}</strong>
              <button type="button" aria-label={`Удалить точку ${index + 1}`} title={isUsed ? 'Точка используется в результатах' : 'Удалить точку'} disabled={disabled || isUsed} onClick={() => removePoint(index)} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm font-semibold">Название *<input value={point.name} disabled={disabled} onChange={(event) => updatePoint(index, { name: event.target.value })} className={inputClass} placeholder="Например: ТК-01 — Северная" /></label>
              <label className="text-sm font-semibold">Описание<input value={point.description || ''} disabled={disabled} onChange={(event) => updatePoint(index, { description: event.target.value })} className={inputClass} placeholder="Ориентир или условия отбора" /></label>
              <label className="text-sm font-semibold">Широта<input type="number" step="any" min="-90" max="90" value={point.latitude ?? ''} disabled={disabled} onChange={(event) => updatePoint(index, { latitude: event.target.value === '' ? null : Number(event.target.value) })} className={inputClass} placeholder="43.301000" /></label>
              <label className="text-sm font-semibold">Долгота<input type="number" step="any" min="-180" max="180" value={point.longitude ?? ''} disabled={disabled} onChange={(event) => updatePoint(index, { longitude: event.target.value === '' ? null : Number(event.target.value) })} className={inputClass} placeholder="76.900000" /></label>
            </div>
          </article>;
        })}
      </div>

      {points.length > 0 && <div className="mt-4 flex justify-end"><button type="button" disabled={disabled || !canSave} onClick={onSave} className="rounded-xl border border-eco-700 bg-white px-4 py-2.5 text-sm font-bold text-eco-800 hover:bg-eco-50 disabled:opacity-50">Сохранить места отбора</button></div>}
    </section>
  );
};

export default ProtocolSamplingPointsForm;
