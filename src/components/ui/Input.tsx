import { InputHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  icon?: ReactNode;
};

const Input = ({ label, icon, className, ...props }: InputProps) => {
  return (
    <label className="block text-sm text-slate-700">
      {label && <span className="mb-2 block font-medium">{label}</span>}
      <div className="relative">
        {icon && <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-eco-700">{icon}</span>}
        <input
          className={clsx(
            'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition-colors duration-200 focus:border-eco-500 focus:ring-2 focus:ring-eco-100',
            icon ? 'pl-12' : 'pl-4',
            className
          )}
          {...props}
        />
      </div>
    </label>
  );
};

export default Input;
