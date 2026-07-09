import clsx from 'clsx';
import type { ProtocolStatus } from '../../types/protocols';

export const protocolStatusLabels: Record<ProtocolStatus, string> = {
  DRAFT: 'Черновик',
  CALCULATED: 'Рассчитан',
  READY: 'Готов',
  NEEDS_REVISION: 'На доработке',
  RETURNED: 'Возвращен',
  CORRECTION: 'Исправление',
  READY_FOR_APPROVAL: 'На утверждении',
  APPROVED: 'Утвержден',
  SIGNED: 'Подписан',
  ARCHIVED: 'В архиве',
  CANCELLED: 'Аннулирован',
  REPLACED: 'Заменен',
};

const classes: Record<ProtocolStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-200',
  CALCULATED: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
  READY: 'bg-amber-50 text-amber-800 ring-amber-200',
  NEEDS_REVISION: 'bg-orange-50 text-orange-800 ring-orange-200',
  RETURNED: 'bg-orange-50 text-orange-800 ring-orange-200',
  CORRECTION: 'bg-violet-50 text-violet-800 ring-violet-200',
  READY_FOR_APPROVAL: 'bg-amber-50 text-amber-800 ring-amber-200',
  APPROVED: 'bg-blue-50 text-blue-800 ring-blue-200',
  SIGNED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  ARCHIVED: 'bg-slate-100 text-slate-700 ring-slate-200',
  CANCELLED: 'bg-rose-50 text-rose-800 ring-rose-200',
  REPLACED: 'bg-violet-50 text-violet-800 ring-violet-200',
};

const ProtocolStatusBadge = ({ status }: { status: ProtocolStatus }) => (
  <span className={clsx('inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1', classes[status])}>
    {protocolStatusLabels[status]}
  </span>
);

export default ProtocolStatusBadge;
