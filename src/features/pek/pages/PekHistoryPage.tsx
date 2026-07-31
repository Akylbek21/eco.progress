import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader } from '../components/common/PekUi';
import PekHistoryTimeline from '../components/sections/PekHistoryTimeline';

const PekHistoryPage = () => {
  const id = Number(useParams().programId);
  const history = useQuery({
    queryKey: pekKeys.programHistory(id),
    queryFn: ({ signal }) => pekApi.getProgramHistory(id, signal),
    enabled: Number.isFinite(id),
  });
  return <div className="space-y-5">
    <PekPageHeader title="История программы ПЭК" actions={<Link to={`/staff/pek/programs/${id}`} className="rounded-full border px-4 py-2 font-bold">К программе</Link>} />
    <section className="rounded-2xl border bg-white p-5">
      {history.isLoading
        ? <PekLoading />
        : history.isError
          ? <PekQueryError error={history.error} resource="История программы" retry={() => void history.refetch()} />
          : <PekHistoryTimeline items={history.data || []} />}
    </section>
  </div>;
};

export default PekHistoryPage;
