import clsx from 'clsx';

type BadgeProps = {
  children: string;
  variant?: 'neutral' | 'success' | 'outline';
};

const Badge = ({ children, variant = 'neutral' }: BadgeProps) => {
  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em]',
        {
          'bg-eco-100 text-eco-800': variant === 'neutral',
          'bg-emerald-100 text-emerald-700': variant === 'success',
          'border border-slate-200 bg-white text-slate-700': variant === 'outline',
        }
      )}
    >
      {children}
    </span>
  );
};

export default Badge;
