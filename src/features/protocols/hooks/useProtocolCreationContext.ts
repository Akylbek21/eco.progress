import { useQuery } from '@tanstack/react-query';
import protocolService from '../../../services/protocolService';

export const protocolCreationContextKey = (
  companyId: string,
  objectId: string,
  date: string,
) => ['protocol-creation-context', companyId, objectId, date] as const;

export const useProtocolCreationContext = ({
  companyId,
  objectId,
  date,
  enabled = true,
}: {
  companyId: string;
  objectId: string;
  date: string;
  enabled?: boolean;
}) => useQuery({
  queryKey: protocolCreationContextKey(companyId, objectId, date),
  queryFn: ({ signal }) => protocolService.getProtocolCreationContext({ companyId, objectId, date }, signal),
  enabled: enabled && Boolean(companyId && objectId),
  retry: false,
});
