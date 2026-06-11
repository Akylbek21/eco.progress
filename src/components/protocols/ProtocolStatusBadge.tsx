import clsx from 'clsx';
import type { ProtocolStatus } from '../../types/protocols';

export const protocolStatusLabels: Record<ProtocolStatus, string> = {
  DRAFT: 'Черновик',
  READY_FOR_APPROVAL: 'Готов к утверждению',
  APPROVED: 'Утвержден',
  SIGNED: 'Подписан',
  CANCELLED: 'Аннулирован',
  REPLACED: 'Заменен',
};

const protocolStatusClasses: Record<ProtocolStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-200',
  READY_FOR_APPROVAL: 'bg-amber-50 text-amber-800 ring-amber-200',
  APPROVED: 'bg-blue-50 text-blue-800 ring-blue-200',
  SIGNED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  CANCELLED: 'bg-rose-50 text-rose-800 ring-rose-200',
  REPLACED: 'bg-violet-50 text-violet-800 ring-violet-200',
};

const ProtocolStatusBadge = ({ status }: { status: ProtocolStatus }) => (
  <span className={clsx('inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1', protocolStatusClasses[status])}>
    {protocolStatusLabels[status]}
  </span>
);

export default ProtocolStatusBadge;
