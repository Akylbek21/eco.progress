import { ReactNode } from 'react';

const EmptyState = ({ children }: { children: ReactNode }) => {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600 shadow-sm">
      <p className="text-lg font-semibold text-slate-900">Пусто пока</p>
      <p className="mt-3 max-w-xl mx-auto text-sm leading-6">{children}</p>
    </div>
  );
};

export default EmptyState;
