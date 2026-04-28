import clsx from 'clsx';

type StatusBadgeProps = {
  status: string;
};

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const color =
    status === 'Готово'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'Отменено'
      ? 'bg-rose-100 text-rose-800'
      : status === 'Ожидает документы'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-slate-100 text-slate-800';

  return (
    <span className={clsx('inline-flex rounded-full px-3 py-1 text-xs font-semibold', color)}>
      {status}
    </span>
  );
};

export default StatusBadge;
