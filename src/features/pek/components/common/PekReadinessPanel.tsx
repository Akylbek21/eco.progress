import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { PekReadiness, PekValidationIssue } from '../../api/pekContracts';

export default function PekReadinessPanel({ readiness, onIssueClick }: {
  readiness?: PekReadiness | null;
  onIssueClick?: (issue: PekValidationIssue) => void;
}) {
  if (!readiness) return <section className="rounded-2xl border bg-white p-5"><p className="font-bold">Готовность ещё не рассчитана</p><p className="mt-1 text-sm text-slate-500">После проверки здесь появятся фактический процент и список необходимых действий.</p></section>;
  const actionLabels: Record<string, string> = { MONITORING_POINTS_REQUIRED: 'Добавить точки мониторинга', ACTIVE_PERMIT_REQUIRED: 'Выбрать разрешение', UNMATCHED_SOURCES: 'Открыть источники', OPEN_EXCEEDANCES: 'Открыть превышения' };
  const blocking = readiness.issues.filter((issue) => issue.severity === 'BLOCKING');
  const warnings = readiness.issues.filter((issue) => issue.severity !== 'BLOCKING');
  return <section className="rounded-2xl border bg-white p-5" aria-label="Панель готовности">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Готовность: {readiness.completionPercent == null ? '—' : `${readiness.completionPercent}%`}</h2><p className="text-sm text-slate-600">{readiness.ready ? 'Можно переходить к следующему этапу' : `Блокирующих проблем: ${blocking.length}`}</p></div>{readiness.ready ? <CheckCircle2 className="text-emerald-700" aria-label="Готово" /> : <AlertCircle className="text-rose-700" aria-label="Не готово" />}</div>
    {readiness.issues.length > 0 && <ul className="mt-4 space-y-2">{[...blocking, ...warnings].map((issue, index) => <li key={`${issue.code}-${issue.entityId || ''}-${index}`}><button type="button" onClick={() => onIssueClick?.(issue)} className={`flex w-full items-start gap-2 rounded-xl border p-3 text-left ${issue.severity === 'BLOCKING' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}><span aria-hidden>{issue.severity === 'BLOCKING' ? '🔴' : '🟠'}</span><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>{issue.severity === 'BLOCKING' ? 'Блокирует отправку' : 'Предупреждение'}</strong><span className="block text-sm">{issue.message}</span>{issue.section && <span className="text-xs text-slate-500">Раздел: {issue.section}{issue.field ? ` · поле: ${issue.field}` : ''}</span>}{actionLabels[issue.code] && <span className="mt-2 block font-bold text-eco-800">{actionLabels[issue.code]} →</span>}</span></button></li>)}</ul>}
  </section>;
}
