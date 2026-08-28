import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import CreateProtocolWizardModalV2 from '../features/protocols/components/CreateProtocolWizardModalV2';
import { useAuth } from '../contexts/AuthContext';
import { protocolQueryKeys, protocolScope } from '../features/protocols/hooks/queryKeys';
import { hasProtocolAction } from '../features/protocols/utils/protocolActions';

export default function ProtocolCreatePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const pekReportId = params.get('pekReportId') || '';
  return <CreateProtocolWizardModalV2
    open
    orderId={params.get('orderId') || ''}
    orderServiceItemId={params.get('orderServiceItemId') || ''}
    pekPrefill={{ companyId: params.get('companyId') || '', objectId: params.get('objectId') || '', pekProgramId: params.get('pekProgramId') || '', pekControlItemId: params.get('pekControlItemId') || '', pekControlEventId: params.get('pekControlEventId') || '', pekReportId, monitoringPointId: params.get('monitoringPointId') || '', programIndicatorId: params.get('programIndicatorId') || '', emissionSourceId: params.get('emissionSourceId') || '', waterOutletId: params.get('waterOutletId') || '', measurementDate: params.get('measurementDate') || undefined, measurementPlace: params.get('measurementPlace') || undefined }}
    onClose={() => navigate('/staff/protocols')}
    onCreated={(protocol) => {
      void queryClient.invalidateQueries({ queryKey: protocolQueryKeys.all(protocolScope(user?.id)) });
      if (protocol.orderId) void queryClient.invalidateQueries({ queryKey: ['order', String(protocol.orderId)] });
      const navigation = new URLSearchParams();
      if (pekReportId) { navigation.set('pekReportId', pekReportId); navigation.set('returnTo', `/staff/pek/reports/${pekReportId}?tab=sources`); }
      navigate(hasProtocolAction(protocol, 'view') ? `/staff/protocols/${protocol.id}${navigation.size ? `?${navigation}` : ''}` : '/staff/protocols');
    }}
  />;
}
