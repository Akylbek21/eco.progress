import { Check } from 'lucide-react';
import { lifecycleStage } from './protocolDetailsModel';

const stages = ['Создан', 'Заполнен', 'Проверка', 'Утверждение', 'Подписание'];

const ProtocolProgress = ({ status }: { status: string }) => {
  const current = lifecycleStage(status);
  return (
    <section aria-label="Этапы протокола" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <ol className="flex min-w-[580px] items-center">
        {stages.map((label, index) => (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className={`flex items-center gap-2 text-sm font-bold ${index === current ? 'text-eco-800' : index < current ? 'text-emerald-700' : 'text-slate-400'}`}>
              <span className={`grid h-7 w-7 place-items-center rounded-full ring-1 ${index === current ? 'bg-eco-600 text-white ring-eco-600' : index < current ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-slate-100 ring-slate-200'}`}>
                {index < current ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span>{label}</span>
            </div>
            {index < stages.length - 1 && <span className={`mx-3 h-px flex-1 ${index < current ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
          </li>
        ))}
      </ol>
    </section>
  );
};

export default ProtocolProgress;
