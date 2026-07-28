import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { pekKeys } from '../api/pekQueryKeys';
import { pekService } from '../api/pekService';
import { PekLoading, PekPageHeader, PekState } from '../components/common/PekUi';
import PekHistoryTimeline from '../components/sections/PekHistoryTimeline';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const PekHistoryPage = ({ entity }: { entity: 'program' | 'report' }) => {
  const params = useParams();
  const rawId = entity === 'program' ? params.programId : params.reportId;
  const id = Number(rawId);
  const query = useQuery({
    queryKey: entity === 'program' ? pekKeys.programHistory(id) : pekKeys.history(id),
    queryFn: ({ signal }) => entity === 'program'
      ? pekService.getProgramHistory(id, signal)
      : pekService.getHistory(id, signal),
    enabled: Number.isInteger(id) && id > 0,
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  const back = entity === 'program' ? `/staff/pek/programs/${id}` : `/staff/pek/reports/${id}`;

  return <div className="space-y-5">
    <PekPageHeader
      title={entity === 'program' ? 'История программы ПЭК' : 'История отчёта ПЭК'}
      description="Аудит значимых действий загружается с backend и не изменяется на frontend."
      actions={<Link className="rounded-full border px-5 py-2 text-sm font-bold" to={back}>Вернуться к карточке</Link>}
    />
    {query.isLoading
      ? <PekLoading />
      : query.isError
        ? <PekState title="Не удалось загрузить историю" retry={() => void query.refetch()} />
        : <section className="rounded-2xl border bg-white p-5"><PekHistoryTimeline items={query.data || []} /></section>}
  </div>;
};

export default PekHistoryPage;
