import { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';
  children: ReactNode;
};

const Button = ({ variant = 'primary', children, className, ...props }: ButtonProps) => {
  return (
    <button
      className={clsx(
        'inline-flex min-h-11 min-w-0 max-w-full items-center justify-center rounded-full px-5 py-2.5 text-center text-sm font-semibold leading-snug transition-all duration-200',
        'shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eco-700',
        'active:translate-y-px',
        'disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none',
        {
          'bg-eco-600 text-white hover:bg-eco-700': variant === 'primary',
          'bg-white text-eco-800 border border-eco-300 hover:bg-eco-50': variant === 'secondary',
          'bg-transparent text-eco-800 hover:bg-eco-100': variant === 'ghost',
          'bg-eco-200 text-eco-900 hover:bg-eco-300': variant === 'success',
          'border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100 focus-visible:outline-rose-600': variant === 'danger',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
