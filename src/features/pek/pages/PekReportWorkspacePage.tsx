import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekState, PekStatusBadge } from '../components/common/PekUi';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const tabs = [
  { key: 'overview', label: 'Обзор' },
  { key: 'plan-fact', label: 'План/факт' },
  { key: 'sources', label: 'Источники и протоколы' },
  { key: 'unmatched', label: 'Несопоставленные' },
  { key: 'exceedances', label: 'Превышения' },
  { key: 'actions', label: 'Корректирующие действия' },
  { key: 'documents', label: 'Документы' },
  { key: 'history', label: 'История' },
] as const;

type TabKey = typeof tabs[number]['key'];

const unavailableCopy: Partial<Record<TabKey, { title: string; message: string }>> = {
  'plan-fact': { title: 'План/факт пока не сформирован', message: 'Данные появятся здесь после подключения расчёта выполнения программы.' },
  unmatched: { title: 'Сопоставление результатов пока недоступно', message: 'Результаты не будут подменяться локальными предположениями.' },
  exceedances: { title: 'Сведения о превышениях пока недоступны', message: 'В этом разделе будут показаны только подтверждённые результаты измерений.' },
  actions: { title: 'Корректирующие действия пока недоступны', message: 'Мероприятия появятся после сохранения их в отчёте.' },
  documents: { title: 'Документы отчёта пока недоступны', message: 'Документы программы остаются доступны в карточке программы ПЭК.' },
  history: { title: 'История отчёта пока недоступна', message: 'Здесь должна отображаться фактическая история действий сотрудников.' },
};

const PekReportWorkspacePage = () => {
  const id = Number(useParams().reportId);
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab') as TabKey | null;
  const tab = tabs.some((item) => item.key === requestedTab) ? requestedTab as TabKey : 'overview';
  const report = useQuery({
    queryKey: pekKeys.report(id),
    queryFn: ({ signal }) => pekApi.getReport(id, signal),
    enabled: Number.isSafeInteger(id) && id > 0,
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  const program = useQuery({
    queryKey: pekKeys.program(report.data?.programId || 'pending'),
    queryFn: ({ signal }) => pekApi.getProgram(report.data!.programId, signal),
    enabled: Boolean(report.data?.programId),
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });

  if (report.isLoading) return <PekLoading />;
  if (report.isError || !report.data) {
    return <PekQueryError error={report.error} resource="отчёт ПЭК" retry={() => void report.refetch()} />;
  }

  const item = report.data;
  const setTab = (nextTab: TabKey) => {
    const next = new URLSearchParams(params);
    nextTab === 'overview' ? next.delete('tab') : next.set('tab', nextTab);
    setParams(next, { replace: true });
  };

  return <div className="space-y-5">
    <PekPageHeader
      title={`Отчёт ПЭК за ${item.periodStart} — ${item.periodEnd}`}
      description={`${item.company?.name || 'Компания не указана'} · ${item.object?.name || 'Объект не указан'}`}
      actions={<PekStatusBadge status={item.status} />}
    />
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Разделы отчёта">
      {tabs.map(({ key, label }) => <button key={key} type="button" onClick={() => setTab(key)} className={`whitespace-nowrap px-4 py-3 font-bold ${tab === key ? 'border-b-2 border-eco-600 text-eco-800' : 'text-slate-500'}`}>{label}</button>)}
    </nav>
    {tab === 'overview' && <div className="space-y-4">
      <section className="grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Период" value={`${item.periodStart} — ${item.periodEnd}`} />
        <Info label="Программа" value={program.data ? `${program.data.number} · ${program.data.name}` : 'Загрузка…'} />
        <Info label="Связано протоколов" value={item.linkedProtocolCount} />
        <Info label="Последний сбор" value={item.lastCollectedAt || 'Сбор ещё не выполнялся'} />
        <Info label="Ответственный" value={item.responsibleUser?.name || 'Не назначен'} />
        <Info label="Версия" value={item.version} />
      </section>
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-black">Готовность отчёта</h2>
        <p className="mt-2 text-sm text-slate-600">Готовность ещё не рассчитана. Отправка на проверку появится только после подтверждённой проверки отчёта.</p>
        <Link className="mt-4 inline-flex font-bold text-eco-700" to={`/staff/pek/programs/${item.programId}`}>Открыть программу ПЭК</Link>
      </section>
    </div>}
    {tab === 'sources' && <section className="rounded-2xl border bg-white p-5">
      <h2 className="font-black">Фактически связанные протоколы</h2>
      <p className="mt-1 text-sm text-slate-600">Здесь отображаются только номера, возвращённые после сбора данных отчёта.</p>
      {item.linkedProtocolNumbers.length
        ? <ul className="mt-4 divide-y rounded-xl border">{item.linkedProtocolNumbers.map((number) => <li key={number} className="px-4 py-3 font-semibold">Протокол № {number}</li>)}</ul>
        : <div className="mt-4"><PekState title="Связанные протоколы не найдены" message="Общий список протоколов не используется как замена фактическим связям отчёта." /></div>}
    </section>}
    {tab !== 'overview' && tab !== 'sources' && unavailableCopy[tab] && <PekState {...unavailableCopy[tab]!} />}
  </div>;
};

const Info = ({ label, value }: { label: string; value: string | number }) => <div><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;

export default PekReportWorkspacePage;
