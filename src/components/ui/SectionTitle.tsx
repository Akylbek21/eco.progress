import { ReactNode } from 'react';

type SectionTitleProps = {
  title: string;
  subtitle?: string;
};

const SectionTitle = ({ title, subtitle }: SectionTitleProps) => {
  return (
    <div className="mb-8 max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-eco-700">{subtitle ?? 'ECOPROGRESS GROUP'}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
    </div>
  );
};

export default SectionTitle;
