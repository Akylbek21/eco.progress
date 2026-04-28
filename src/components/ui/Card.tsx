import { ReactNode } from 'react';
import clsx from 'clsx';

type CardProps = {
  children: ReactNode;
  className?: string;
};

const Card = ({ children, className }: CardProps) => {
  return (
    <div className={clsx('rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/40', className)}>
      {children}
    </div>
  );
};

export default Card;
