import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProtocolStatusBadge from '../../../components/protocols/ProtocolStatusBadge';
import Button from '../../../components/ui/Button';
import { templateName } from '../../../data/protocolTemplates';
import type { Protocol, ProtocolAvailableActions } from '../../../types/protocols';
import ProtocolActionsMenu from './ProtocolActionsMenu';
import { formatProtocolDate } from './protocolDetailsModel';

type Props = {
  protocol: Protocol;
  actions: ProtocolAvailableActions;
  busy: boolean;
  primaryDisabled?: boolean;
  primaryLabel: string;
  onBack: () => void;
  onPrimary: () => void;
  onDocx: () => void;
  onGenerateDocx: () => void;
  onGeneratePdf: () => void;
  onCorrection: () => void;
  onReturnForRevision: () => void;
  onCancel: () => void;
  onArchive: () => void;
  onHistory: () => void;
};

const ProtocolHeader = ({ protocol, actions, busy, primaryDisabled = false, primaryLabel, onBack, onPrimary, ...menuActions }: Props) => (
  <header className="protocol-header border-b border-slate-300 bg-white px-2 py-3">
    <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-eco-700"><ArrowLeft className="h-4 w-4" /> К протоколам</button>
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-black text-slate-950 sm:text-2xl">Протокол № {protocol.protocolNumber || protocol.number || 'без номера'}</h1>
          <ProtocolStatusBadge status={protocol.status} publishedAt={protocol.publishedAt} />
        </div>
        <p className="mt-1 text-sm font-bold text-eco-800">{templateName(protocol.templateId, protocol.templateName)}</p>
        <p className="mt-1 max-w-5xl truncate text-xs text-slate-600">{protocol.companySnapshot.companyName || 'Компания не указана'} · Объект: {protocol.companySnapshot.objectName || 'не указан'} · {formatProtocolDate(protocol.protocolDate)}</p>
        {protocol.orderId && <p className="mt-2 text-sm"><span className="text-slate-500">Заявка № {protocol.orderNumber || protocol.orderId}</span> · <Link className="font-bold text-eco-700" to={`/staff/orders/${protocol.orderId}`}>Открыть заявку</Link></p>}
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        {primaryLabel && <Button type="button" className="hidden md:inline-flex" disabled={busy || primaryDisabled} onClick={onPrimary}>{primaryLabel}</Button>}
        <ProtocolActionsMenu protocol={protocol} actions={actions} busy={busy} {...menuActions} />
      </div>
    </div>
  </header>
);

export default ProtocolHeader;
