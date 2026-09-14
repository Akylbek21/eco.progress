import { AlertTriangle, CheckCircle2, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import Button from '../../../../components/ui/Button';
import type { PekAvailableAction } from '../../api/pekContracts';
import { labelPekStatus } from '../../utils/pekLabels';

export const PekStatusBadge = ({ status }: { status: string }) => (
  <span className="inline-flex whitespace-nowrap border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700">
    {labelPekStatus(status)}
  </span>
);

export const PekPageHeader = ({ title, description, actions }: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) => (
  <header className="pek-page-header border-b border-slate-300 bg-white px-3 py-3">
    <div className="pek-page-header-copy min-w-0">
      <h1 className="text-xl font-black text-slate-950">{title}</h1>
      {description && <p className="mt-1 text-xs text-slate-600">{description}</p>}
    </div>
    {actions && <div className="pek-page-header-actions flex max-w-full flex-wrap items-center gap-1.5 [&>div]:shrink-0 [&>button]:shrink-0">{actions}</div>}
  </header>
);

export const PekLoading = () => (
  <div aria-busy="true" className="grid gap-3">
    {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-200" />)}
  </div>
);

export const PekState = ({ title, message, retry }: {
  title: string;
  message?: string;
  retry?: () => void;
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
    <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
    <h2 className="mt-3 text-lg font-bold">{title}</h2>
    {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
    {retry && <Button className="mt-4" type="button" onClick={retry}>Повторить</Button>}
  </section>
);

export const PekReadiness = ({ value }: { value?: number | null; valid?: boolean }) => (
  <div className="min-w-28 whitespace-nowrap">
    <div className="flex justify-between text-xs font-semibold">
      <span>Готовность</span>
      <span>{value === undefined || value === null ? '—' : `${value}%`}</span>
    </div>
    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
      <div className="h-full bg-eco-600" style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} />
    </div>
  </div>
);

export const PekPrimaryAction = ({ action, pending, onClick }: {
  action?: PekAvailableAction;
  pending?: boolean;
  onClick: (action: PekAvailableAction) => void;
}) => {
  if (!action) return null;
  return <div>
    <Button
      type="button"
      disabled={!action.enabled || pending}
      aria-busy={pending}
      onClick={() => onClick(action)}
    >
      {pending
        ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Выполнение…</>
        : action.label}
    </Button>
    {!action.enabled && action.disabledReason && (
      <p className="mt-1 max-w-xs text-xs text-amber-700">{action.disabledReason}</p>
    )}
  </div>;
};

export const PekSuccessState = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center gap-2 text-sm font-semibold text-eco-700">
    <CheckCircle2 className="h-4 w-4" />{children}
  </span>
);
