import { CheckCircle2, Clock3, FileCheck2, MessageSquareText, UploadCloud } from 'lucide-react';
import Reveal from '../animations/Reveal';

const timeline = [
  { label: 'Заявка создана', done: true },
  { label: 'Документы получены', done: true },
  { label: 'В работе', done: true },
  { label: 'На проверке', done: false },
];

const EcoDashboardPreview = ({ compact = false }: { compact?: boolean }) => {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[32px] bg-accent/18 blur-2xl" />
      <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-white/92 p-4 shadow-2xl shadow-eco-900/18 backdrop-blur-xl sm:p-5">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-eco-500">Кабинет клиента</p>
            <h3 className="mt-1 text-lg font-bold text-eco-900">ORD-1012</h3>
          </div>
          <span className="rounded-full bg-accent/18 px-3 py-1 text-xs font-bold text-eco-800">В работе</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ['3', 'документа'],
            ['2', 'комментария'],
            ['5 дн.', 'до результата'],
          ].map(([value, label], index) => (
            <Reveal key={label} delay={index * 0.05} direction="scale">
              <div className="rounded-2xl bg-eco-50 p-4">
                <p className="text-2xl font-bold text-eco-900">{value}</p>
                <p className="mt-1 text-xs text-slate-500">{label}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex items-start gap-3">
            <FileCheck2 className="mt-0.5 text-eco-500" size={20} />
            <div>
              <p className="font-semibold text-slate-900">Экологическая отчетность</p>
              <p className="mt-1 text-sm leading-5 text-slate-500">Специалист проверяет исходные данные и готовит отчет.</p>
            </div>
          </div>
        </div>

        {!compact && (
          <>
            <div className="mt-5 space-y-3">
              {timeline.map((item, index) => (
                <Reveal key={item.label} delay={0.08 + index * 0.05}>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${item.done ? 'bg-eco-800 text-white' : 'bg-eco-50 text-eco-500'}`}>
                      {item.done ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
                    </span>
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                    {index < timeline.length - 1 && <span className="h-px flex-1 bg-slate-100" />}
                  </div>
                </Reveal>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-eco-900 p-4 text-white">
                <MessageSquareText size={18} />
                <p className="mt-3 text-sm font-semibold">Комментарий специалиста</p>
                <p className="mt-1 text-xs text-white/68">Нужна схема площадки для финальной проверки.</p>
              </div>
              <div className="rounded-2xl border border-dashed border-eco-300 bg-eco-50 p-4">
                <UploadCloud className="text-eco-500" size={18} />
                <p className="mt-3 text-sm font-semibold text-eco-900">Загрузить документ</p>
                <p className="mt-1 text-xs text-slate-500">PDF, DOCX или XLSX</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EcoDashboardPreview;
