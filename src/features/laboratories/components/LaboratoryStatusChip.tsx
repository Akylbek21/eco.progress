import type { Laboratory } from '../../../types/laboratories';

export const LaboratoryStatusChip = ({ laboratory }: { laboratory: Pick<Laboratory, 'active' | 'isDefault'> }) => (
  <span className={`rounded-full px-2 py-1 text-xs font-bold ${laboratory.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
    {laboratory.active ? 'Активная' : 'Неактивная'}{laboratory.isDefault ? ' · по умолчанию' : ''}
  </span>
);
