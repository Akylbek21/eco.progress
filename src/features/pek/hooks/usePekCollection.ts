import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pekKeys } from '../api/pekQueryKeys';
import { pekService } from '../api/pekService';

export const usePekCollection = (reportId: number, enabled: boolean) => {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: pekKeys.collection(reportId),
    queryFn: ({ signal }) => pekService.getLatestCollectionRun(reportId, signal),
    enabled,
    retry: false,
    refetchInterval: (state) => ['PENDING', 'RUNNING'].includes(state.state.data?.status || '') ? 1500 : false,
  });
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
