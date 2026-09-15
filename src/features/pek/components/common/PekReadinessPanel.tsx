import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { PekReadiness, PekValidationIssue } from '../../api/pekContracts';

const sectionLabels: Record<string, string> = {
  GENERAL: 'Общие сведения', CONTROL_ITEMS: 'Позиции контроля', INDICATORS: 'Показатели',
  MONITORING: 'Производственный мониторинг', WASTE: 'Отходы', PERMITS: 'Разрешения',
  INTERNAL_INSPECTIONS: 'Внутренние проверки', MEASUREMENT_QA: 'Контроль качества измерений',
  EMERGENCY_PROCEDURES: 'Действия при аварийных ситуациях', RESPONSIBILITY: 'Структура ответственности',
  SOURCES: 'Источники выбросов', DOCUMENTS: 'Документы',
};
const issueLabels: Record<string, string> = {
  MONITORING_POINTS_REQUIRED: 'Добавьте точки мониторинга', ACTIVE_PERMIT_REQUIRED: 'Выберите действующее разрешение',
  UNMATCHED_SOURCES: 'Откройте источники', OPEN_EXCEEDANCES: 'Откройте превышения',
};

export default function PekReadinessPanel({ readiness, onIssueClick }: {
  readiness?: PekReadiness | null;
  onIssueClick?: (issue: PekValidationIssue) => void;
}) {
  if (!readiness) return <section className="rounded-2xl border bg-white p-5"><p className="font-bold">Готовность ещё не рассчитана</p><p className="mt-1 text-sm text-slate-500">После проверки здесь появятся фактический процент и список необходимых действий.</p></section>;
  const isBlocking = (issue: PekValidationIssue) => issue.blocking ?? issue.severity === 'BLOCKING';
  const blocking = readiness.issues.filter(isBlocking);
  const warnings = readiness.issues.filter((issue) => !isBlocking(issue));
  return <section className="border border-slate-300 bg-white" aria-label="Панель готовности">
    <div className="flex flex-wrap items-center gap-6 border-b border-slate-200 px-4 py-3"><div><h2 className="text-base font-black">Готовность: {readiness.completionPercent == null ? '—' : `${readiness.completionPercent}%`}</h2><p className="text-xs text-slate-600">{readiness.ready ? 'Проверка пройдена' : 'Требуется действие'}</p></div><div className="flex gap-4 text-xs"><span><b className="text-rose-700">{blocking.length}</b> ошибок</span><span><b className="text-amber-700">{warnings.length}</b> предупреждений</span></div>{readiness.ready ? <CheckCircle2 className="ml-auto h-5 w-5 text-emerald-700" aria-label="Готово" /> : <AlertCircle className="ml-auto h-5 w-5 text-rose-700" aria-label="Не готово" />}</div>
    {readiness.issues.length > 0 && <div className="divide-y divide-slate-200">{[...blocking, ...warnings].map((issue, index) => <button key={`${issue.code}-${issue.entityId || ''}-${index}`} type="button" onClick={() => onIssueClick?.(issue)} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-slate-50"><AlertTriangle className={`h-4 w-4 shrink-0 ${isBlocking(issue) ? 'text-rose-600' : 'text-amber-600'}`} /><span className="min-w-0 flex-1"><span className="font-semibold">{issue.message}</span><span className="block text-xs text-slate-500">{issue.section ? sectionLabels[issue.section] || 'Раздел программы' : 'Проверка программы'}{issue.field ? ` · ${issue.field}` : ''}</span></span><span className="shrink-0 text-xs font-bold text-eco-800">{issueLabels[issue.code] || 'Открыть'} →</span></button>)}</div>}
  </section>;
}
