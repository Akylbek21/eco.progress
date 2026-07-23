import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProtocolStatusBadge from '../../../components/protocols/ProtocolStatusBadge';
import Button from '../../../components/ui/Button';
import { templateName } from '../../../data/protocolTemplates';
import type { Protocol } from '../../../types/protocols';
import type { ProtocolPermissions } from '../../../utils/protocolPermissions';
import ProtocolActionsMenu from './ProtocolActionsMenu';
import { formatProtocolDate } from './protocolDetailsModel';

type Props = {
  protocol: Protocol;
  permissions: ProtocolPermissions;
  busy: boolean;
  primaryLabel: string;
  onBack: () => void;
  onPrimary: () => void;
  onReturn: () => void;
  onDocx: () => void;
  onGenerate: () => void;
  onCorrection: () => void;
  onCancel: () => void;
  onArchive: () => void;
  onHistory: () => void;
};

const ProtocolHeader = ({ protocol, permissions, busy, primaryLabel, onBack, onPrimary, onReturn, ...menuActions }: Props) => (
  <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-eco-700"><ArrowLeft className="h-4 w-4" /> К протоколам</button>
    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">Протокол № {protocol.protocolNumber || protocol.number || 'без номера'}</h1>
          <ProtocolStatusBadge status={protocol.status} />
        </div>
        <p className="mt-2 text-lg font-bold text-eco-800">{templateName(protocol.templateId, protocol.templateName)}</p>
        <p className="mt-2 text-sm text-slate-600">{protocol.companySnapshot.companyName || 'Компания не указана'} · Объект: {protocol.companySnapshot.objectName || 'не указан'} · {formatProtocolDate(protocol.protocolDate)}</p>
        {protocol.orderId && <p className="mt-2 text-sm"><span className="text-slate-500">Заявка № {protocol.orderNumber || protocol.orderId}</span> · <Link className="font-bold text-eco-700" to={`/staff/orders/${protocol.orderId}`}>Открыть заявку</Link></p>}
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        {permissions.canReturn && <Button type="button" variant="secondary" disabled={busy} onClick={onReturn}>Вернуть на исправление</Button>}
        {primaryLabel && <Button type="button" className="hidden md:inline-flex" disabled={busy} onClick={onPrimary}>{primaryLabel}</Button>}
        <ProtocolActionsMenu protocol={protocol} permissions={permissions} busy={busy} {...menuActions} />
      </div>
    </div>
  </header>
);

export default ProtocolHeader;
