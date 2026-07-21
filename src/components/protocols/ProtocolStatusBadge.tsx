import clsx from 'clsx';
import { normalizeProtocolStatus, protocolStatusConfig } from '../../config/protocolStatus';
import type { ProtocolStatus } from '../../types/protocols';

export const protocolStatusLabels = Object.fromEntries(
  Object.entries(protocolStatusConfig).map(([status, config]) => [status, config.label]),
) as Record<ProtocolStatus, string>;

const classes = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  info: 'bg-blue-50 text-blue-800 ring-blue-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  danger: 'bg-rose-50 text-rose-800 ring-rose-200',
};

const ProtocolStatusBadge = ({ status }: { status: ProtocolStatus | string }) => {
  const normalized = normalizeProtocolStatus(status);
  const config = protocolStatusConfig[normalized];
  return <span className={clsx('inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1', classes[config.color])}>{config.label}</span>;
};

export default ProtocolStatusBadge;
