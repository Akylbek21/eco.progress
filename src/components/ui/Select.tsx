import { SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
};

const Select = ({ label, className, children, ...props }: SelectProps) => {
  return (
    <label className="block text-sm text-slate-700">
      {label && <span className="mb-2 block font-medium">{label}</span>}
      <select
        className={clsx(
          'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors duration-200 focus:border-eco-500 focus:ring-2 focus:ring-eco-100',
          className
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
};

export default Select;
