import { ReactNode } from 'react';
import clsx from 'clsx';

type CardProps = {
  children: ReactNode;
  className?: string;
};

const Card = ({ children, className }: CardProps) => {
  return (
    <div className={clsx('min-w-0 overflow-hidden rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6', className)}>
      {children}
    </div>
  );
};

export default Card;
