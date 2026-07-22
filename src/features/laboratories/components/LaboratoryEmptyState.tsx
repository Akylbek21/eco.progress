export const LaboratoryEmptyState = ({ filtered = false }: { filtered?: boolean }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
    {filtered ? 'По заданным фильтрам лаборатории не найдены.' : 'Лаборатории ещё не созданы.'}
  </div>
);
