import clsx from 'clsx';

type StatusBadgeProps = {
  status: string;
};

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const color =
    status === 'Готово' || status === 'Завершено'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'Отменено'
      ? 'bg-rose-100 text-rose-800'
      : status === 'Счет на оплату'
      ? 'bg-amber-100 text-amber-800'
      : ['Проектирование', 'Лаборатория', 'Вывоз', 'Утилизация'].includes(status)
      ? 'bg-eco-100 text-eco-800'
      : 'bg-slate-100 text-slate-800';

  return (
    <span className={clsx('inline-flex rounded-full px-3 py-1 text-xs font-semibold', color)}>
      {status}
    </span>
  );
};

export default StatusBadge;
