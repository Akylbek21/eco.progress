import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Archive, Edit3, Plus, RefreshCw } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';
import { archiveMeasurementDevice, createMeasurementDevice, getMeasurementDevices, updateMeasurementDevice } from '../services/measurementDeviceService';
import type { MeasurementDevice, MeasurementDeviceStatus } from '../types/protocols';

const statuses: MeasurementDeviceStatus[] = ['VALID', 'EXPIRING', 'EXPIRED', 'ARCHIVED'];

const statusLabels: Record<MeasurementDeviceStatus, string> = {
  VALID: 'Поверка действует',
  EXPIRING: 'Скоро истекает',
  EXPIRED: 'Поверка истекла',
  ARCHIVED: 'Архивный',
};

const emptyDevice: Omit<MeasurementDevice, 'id'> = {
  name: '',
  model: '',
  serialNumber: '',
  verificationCertificateNumber: '',
  verificationDate: '',
  verificationValidUntil: '',
  units: '',
  status: 'VALID',
  archived: false,
};

const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';

const MeasurementDevicesPage = () => {
  const toast = useToast();
  const [items, setItems] = useState<MeasurementDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<MeasurementDevice | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await getMeasurementDevices());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить средства измерений');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => items.filter((item) => !status || item.status === status), [items, status]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get('name') || ''),
      model: String(form.get('model') || ''),
      serialNumber: String(form.get('serialNumber') || ''),
      verificationCertificateNumber: String(form.get('verificationCertificateNumber') || ''),
      verificationDate: String(form.get('verificationDate') || ''),
      verificationValidUntil: String(form.get('verificationValidUntil') || ''),
      units: String(form.get('units') || ''),
      status: String(form.get('status') || 'VALID') as MeasurementDeviceStatus,
      archived: form.get('archived') === 'on',
    };

    try {
      if (editing) await updateMeasurementDevice(editing.id, payload);
      else await createMeasurementDevice(payload);
      toast.success(editing ? 'Средство измерений обновлено' : 'Средство измерений создано');
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (submitError) {
      toast.error('Не удалось сохранить средство измерений', submitError instanceof Error ? submitError.message : undefined);
    }
  };

  const archive = async (item: MeasurementDevice) => {
    if (!window.confirm(`Архивировать прибор "${item.name}"?`)) return;
    try {
      await archiveMeasurementDevice(item.id);
      toast.success('Средство измерений архивировано');
      await load();
    } catch (archiveError) {
      toast.error('Не удалось архивировать средство измерений', archiveError instanceof Error ? archiveError.message : undefined);
    }
  };

  const defaults = editing || emptyDevice;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-eco-700">Справочники</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Средства измерений</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="h-4 w-4" /> Создать прибор</Button>
          <Button type="button" variant="secondary" onClick={load}><RefreshCw className="h-4 w-4" /> Обновить</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full max-w-sm rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100">
          <option value="">Все статусы поверки</option>
          {statuses.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}
        </select>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1040px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Модель</th>
                <th className="px-4 py-3">Заводской номер</th>
                <th className="px-4 py-3">Свидетельство поверки</th>
                <th className="px-4 py-3">Дата поверки</th>
                <th className="px-4 py-3">Дата окончания</th>
                <th className="px-4 py-3">Единицы</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? Array.from({ length: 4 }).map((_, index) => (
                <tr key={index} className="animate-pulse">{Array.from({ length: 9 }).map((__, cell) => <td key={cell} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td>)}</tr>
              )) : filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-bold text-slate-900">{item.name}</td>
                  <td className="px-4 py-4">{item.model || '-'}</td>
                  <td className="px-4 py-4">{item.serialNumber || '-'}</td>
                  <td className="px-4 py-4">{item.verificationCertificateNumber || '-'}</td>
                  <td className="px-4 py-4">{item.verificationDate || '-'}</td>
                  <td className="px-4 py-4">{item.verificationValidUntil || '-'}</td>
                  <td className="px-4 py-4">{item.units || '-'}</td>
                  <td className="px-4 py-4">{statusLabels[item.status]}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="secondary" className="px-3" onClick={() => { setEditing(item); setModalOpen(true); }}><Edit3 className="h-4 w-4" /></Button>
                      <Button type="button" variant="secondary" className="px-3" onClick={() => archive(item)}><Archive className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && <p className="px-6 py-10 text-center text-sm font-semibold text-slate-500">Средства измерений не найдены.</p>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Редактировать прибор' : 'Создать прибор'} size="xl">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {[
            ['name', 'Название'],
            ['model', 'Модель'],
            ['serialNumber', 'Заводской номер'],
            ['verificationCertificateNumber', 'Номер свидетельства поверки'],
            ['units', 'Единицы измерения'],
          ].map(([name, label]) => (
            <label key={name} className="space-y-1.5 text-sm font-semibold text-slate-700">
              <span>{label}</span>
              <input name={name} defaultValue={String(defaults[name as keyof typeof defaults] || '')} className={inputClass} />
            </label>
          ))}
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            <span>Дата поверки</span>
            <input name="verificationDate" type="date" defaultValue={defaults.verificationDate} className={inputClass} />
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            <span>Дата окончания поверки</span>
            <input name="verificationValidUntil" type="date" defaultValue={defaults.verificationValidUntil} className={inputClass} />
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            <span>Статус</span>
            <select name="status" defaultValue={defaults.status} className={inputClass}>
              {statuses.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input name="archived" type="checkbox" defaultChecked={defaults.archived} className="h-4 w-4 rounded border-slate-300 text-eco-700" /> Архивный
          </label>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Отмена</Button>
            <Button type="submit">Сохранить</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MeasurementDevicesPage;
