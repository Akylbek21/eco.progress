import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { pekKeys } from '../api/pekQueryKeys';
import { pekService } from '../api/pekService';
import { retryPekQuery } from '../utils/pekQueryPolicy';

export const usePekCollection = (reportId: number, enabled: boolean) => {
  const client = useQueryClient();
  const terminalRunRef = useRef<number | null>(null);
  const query = useQuery({
    queryKey: pekKeys.collection(reportId),
    queryFn: ({ signal }) => pekService.getLatestCollectionRun(reportId, signal),
    enabled,
    retry: retryPekQuery,
    refetchInterval: (state) => ['CREATED', 'RUNNING'].includes(state.state.data?.status || '') ? 1500 : false,
  });
  useEffect(() => {
    const run = query.data;
    if (!run || ['CREATED', 'RUNNING'].includes(run.status) || terminalRunRef.current === run.id) return;
    terminalRunRef.current = run.id;
    void Promise.all([
      client.invalidateQueries({ queryKey: pekKeys.report(reportId) }),
      client.invalidateQueries({ queryKey: pekKeys.issues(reportId) }),
      client.invalidateQueries({ queryKey: pekKeys.planFact(reportId) }),
      client.invalidateQueries({ queryKey: pekKeys.unmatched(reportId) }),
      client.invalidateQueries({ queryKey: pekKeys.exceedances(reportId) }),
      client.invalidateQueries({ queryKey: pekKeys.history(reportId) }),
      client.invalidateQueries({ queryKey: pekKeys.dashboard() }),
    ]);
  }, [client, query.data, reportId]);
  const collect = useMutation({
    mutationKey: ['pek', 'collect', reportId],
    mutationFn: (version: number) => pekService.collectReport(reportId, { version }),
    retry: false,
    onSuccess: async (run) => {
      client.setQueryData(pekKeys.collection(reportId), run);
      await client.invalidateQueries({ queryKey: pekKeys.report(reportId) });
    },
  });
  return { ...query, collect };
};
