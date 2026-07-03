import { useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../ui/Button';
import { accreditationState } from '../../services/laboratorySettingsService';
import type { LaboratoryEmployee, ProtocolLaboratorySnapshot } from '../../types/protocols';

type Props = {
  value: ProtocolLaboratorySnapshot;
  employees: LaboratoryEmployee[];
  readOnly: boolean;
  loading?: boolean;
  canOpenSettings?: boolean;
  onExecutorChange: (employee: LaboratoryEmployee) => void;
  onRefresh?: () => void;
};

const ProtocolLaboratoryForm = ({ value, employees, readOnly, loading = false, canOpenSettings = false, onExecutorChange, onRefresh }: Props) => {
  const [details, setDetails] = useState(false);
  const certificate = accreditationState(value.accreditationValidUntil);
  const configured = Boolean(value.laboratoryName && value.accreditationNumber);
  const selectedExecutorId = employees.find((employee) =>
    String(employee.id) === String(value.executorId)
    || String(employee.userId || '') === String(value.executorId)
  )?.id || value.executorId || '';
  const rows: Array<[string, string | undefined]> = [
    ['Юридическое название', value.legalName],
    ['БИН', value.bin],
    ['Адрес', value.laboratoryAddress],
    ['Телефон', value.phone],
    ['Email', value.email],
    ['Дата выдачи аттестата', value.accreditationIssuedAt],
    ['Директор', value.director],
    ['Snapshot сформирован', value.capturedAt],
    ['Стандартное примечание', value.standardNote],
  ];

  if (!configured) return (
    <section className="inline-flex max-w-full flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <div>
        <p className="font-bold text-amber-950">Данные лаборатории не заполнены. Без этих данных протокол нельзя выпустить.</p>
        <p className="mt-0.5">Реквизиты не были получены от backend.</p>
      </div>
      {canOpenSettings && <Link to="/staff/settings/laboratory" className="inline-flex rounded-lg bg-eco-700 px-3 py-2 text-sm font-bold text-white">Заполнить в настройках</Link>}
      {!readOnly && onRefresh && <Button type="button" variant="secondary" disabled={loading} onClick={onRefresh}>Обновить из настроек</Button>}
    </section>
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Лаборатория</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Snapshot, возвращённый backend для этого протокола.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {certificate.status === 'VALID' && <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Аттестат действует</span>}
          {certificate.status === 'EXPIRING' && <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800"><AlertTriangle className="h-4 w-4" /> Скоро закончится</span>}
          {certificate.status === 'EXPIRED' && <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800"><AlertTriangle className="h-4 w-4" /> Аттестат истёк</span>}
          {!readOnly && onRefresh && <Button type="button" variant="secondary" disabled={loading} onClick={onRefresh}><RefreshCw className="h-4 w-4" /> Обновить данные лаборатории</Button>}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['Лаборатория', value.laboratoryName],
          ['Аттестат', value.accreditationNumber],
          ['Действителен до', value.accreditationValidUntil],
          ['Заведующий', value.laboratoryHead || 'Не выбран'],
        ].map(([label, content]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-800">{content || '—'}</p></div>)}
        <label className="rounded-xl text-xs font-bold uppercase text-slate-400">Исполнитель
          <select
            value={selectedExecutorId}
            disabled={readOnly}
            onChange={(event) => {
              const employee = employees.find((item) => String(item.id) === event.target.value);
              if (employee) onExecutorChange(employee);
            }}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold normal-case text-slate-800 disabled:bg-slate-100"
          >
            {!value.executorId && <option value="">{value.executor || 'Выберите исполнителя'}</option>}
            {employees.filter((item) => item.active).map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName} · {employee.position || 'сотрудник'}</option>)}
          </select>
        </label>
      </div>

      {!value.laboratoryHead && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">В snapshot не выбран заведующий лабораторией.</div>}
      {certificate.status === 'EXPIRED' && <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">Подписание заблокировано до обновления действующего аттестата и данных протокола.</div>}
      <button type="button" onClick={() => setDetails((current) => !current)} className="mt-4 text-sm font-bold text-eco-700">{details ? 'Скрыть подробности' : 'Подробнее'}</button>
      {details && <dl className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, content]) => <div key={label}><dt className="text-xs font-bold uppercase text-slate-400">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{content || '—'}</dd></div>)}
      </dl>}
    </section>
  );
};

export default ProtocolLaboratoryForm;
