import clsx from 'clsx';
import type { ProtocolInternalStatus } from '../../types/protocols';

export const normativeStatusLabels: Record<ProtocolInternalStatus, string> = {
  NORMAL: 'Норма',
  EXCEEDED: 'Превышение',
  BELOW_REQUIRED: 'Ниже нормы',
  NORMATIVE_NOT_FOUND: 'Норматив не найден',
  UNIT_MISMATCH: 'Единица не совпадает',
  EMPTY_RESULT: 'Нет результата',
  INFO: 'Информационно',
};

const normativeStatusClasses: Record<ProtocolInternalStatus, string> = {
  NORMAL: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  EXCEEDED: 'bg-rose-50 text-rose-800 ring-rose-200',
  BELOW_REQUIRED: 'bg-orange-50 text-orange-800 ring-orange-200',
  NORMATIVE_NOT_FOUND: 'bg-amber-50 text-amber-800 ring-amber-200',
  UNIT_MISMATCH: 'bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200',
  EMPTY_RESULT: 'bg-slate-100 text-slate-700 ring-slate-200',
  INFO: 'bg-blue-50 text-blue-800 ring-blue-200',
};

const NormativeStatusBadge = ({ status }: { status?: ProtocolInternalStatus }) => {
  if (!status) return <span className="text-xs font-medium text-slate-400">-</span>;

  return (
    <span className={clsx('inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1', normativeStatusClasses[status])}>
      {normativeStatusLabels[status]}
    </span>
  );
};

export default NormativeStatusBadge;
