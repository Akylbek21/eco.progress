import { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'success';
  children: ReactNode;
};

const Button = ({ variant = 'primary', children, className, ...props }: ButtonProps) => {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-all duration-200',
        'shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eco-700',
        {
          'bg-eco-600 text-white hover:bg-eco-700': variant === 'primary',
          'bg-white text-eco-800 border border-eco-300 hover:bg-eco-50': variant === 'secondary',
          'bg-transparent text-eco-800 hover:bg-eco-100': variant === 'ghost',
          'bg-eco-200 text-eco-900 hover:bg-eco-300': variant === 'success',
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
