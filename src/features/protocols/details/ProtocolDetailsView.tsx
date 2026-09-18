import { useEffect, useState } from 'react';
import type { Protocol, ProtocolAvailableActions } from '../../../types/protocols';
import ProtocolDocumentsTab from './ProtocolDocumentsTab';
import ProtocolHeader from './ProtocolHeader';
import ProtocolHistoryTab from './ProtocolHistoryTab';
import ProtocolMainDataTab from './ProtocolMainDataTab';
import ProtocolNextStepCard from './ProtocolNextStepCard';
import ProtocolProgress from './ProtocolProgress';
import ProtocolResultsTab from './ProtocolResultsTab';
import ProtocolSignaturesCard from './ProtocolSignaturesCard';
import ProtocolContextLinks from './ProtocolContextLinks';
import ProtocolImmutableBanner from './ProtocolImmutableBanner';
import ProtocolSamplingActsTab from './ProtocolSamplingActsTab';
import { resolveProtocolPrimaryAction, type ProtocolDetailsTab, type ProtocolEditSection } from './protocolDetailsModel';
import { protocolTransitionBlockers } from '../utils/protocolActions';

type MissingItem = { label: string };
type Props = {
  protocol: Protocol;
  actions: ProtocolAvailableActions;
  missing: MissingItem[];
  workflowErrors: string[];
  busy: boolean;
  signing: boolean;
  onBack: () => void;
  onEdit: (section: ProtocolEditSection) => void;
  onCalculate: () => void;
  onCheckNormatives: () => void;
  onReady: () => void;
  onApprove: () => void;
  onSign: () => void;
  onPublish: () => void;
  onPreview: () => void;
  onGenerateDocx: () => void;
  onGeneratePdf: () => void;
  onDocx: () => void;
  onPdf: () => void;
  onCorrection: () => void;
  onReturnForRevision: () => void;
  onCancel: () => void;
  onArchive: () => void;
  onReplacement: () => void;
  initialTab?: ProtocolDetailsTab;
};

const baseTabs: Array<{ key: ProtocolDetailsTab; label: string }> = [
  { key: 'results', label: 'Результаты' },
  { key: 'main', label: 'Основные данные' },
  { key: 'documents', label: 'Документы' },
  { key: 'sampling-acts', label: 'Акты отбора' },
  { key: 'history', label: 'История' },
];

const blockerEditSection = (fieldPath?: string, message?: string): ProtocolEditSection => {
  const target = `${fieldPath || ''} ${message || ''}`.toLowerCase();
  if (/executor|laboratory|исполнител|лаборатор/.test(target)) return 'laboratory';
  if (/^results\b|result|результат/.test(target)) return 'results';
  if (/method|метод|нормативн.*документ|\bнд\b/.test(target)) return 'methods';
  if (/organization|company|customer|object|организац|заказчик|объект/.test(target)) return 'organization';
  if (/environment|temperature|humidity|pressure|wind|услови|температур|влажност|давлен|ветер/.test(target)) return 'environment';
  return 'general';
};

const ProtocolDetailsView = ({ protocol, actions, missing: _missing, workflowErrors, busy, signing, onBack, onEdit, onCalculate, onCheckNormatives, onReady, onApprove, onSign, onPublish, onPreview, onGenerateDocx, onGeneratePdf, onDocx, onPdf, onCorrection, onReturnForRevision, onCancel, onArchive, onReplacement, initialTab = 'results' }: Props) => {
  const [activeTab, setActiveTab] = useState<ProtocolDetailsTab>(initialTab);
  const tabs = actions.viewAudit ? baseTabs : baseTabs.filter((tab) => tab.key !== 'history');
  useEffect(() => {
    setActiveTab(initialTab === 'history' && !actions.viewAudit ? 'results' : initialTab);
  }, [initialTab, actions.viewAudit]);
  const primary = resolveProtocolPrimaryAction(protocol);
  const transitionAction = primary.key === 'ready' ? 'sendToApproval' : primary.key === 'approve' || primary.key === 'sign' ? primary.key : null;
  const allTransitionBlockers = Array.from(new Map(
    (['sendToApproval', 'approve', 'sign'] as const)
      .flatMap((action) => protocolTransitionBlockers(protocol, action))
      .map((blocker) => [blocker.code, blocker]),
  ).values());
  const primaryBlockers = transitionAction ? protocolTransitionBlockers(protocol, transitionAction) : [];
  const primaryBlocked = primaryBlockers.length > 0;
  const signBlocked = protocolTransitionBlockers(protocol, 'sign').length > 0;
  const effectiveActions = signBlocked ? { ...actions, sign: false } : actions;
  const nextStepMissing = Array.from(new Set(
    (protocol.actionBlockers || protocol.blockingReasons || []).map((item) => item.message.trim()).filter(Boolean),
  )).map((label) => ({ label }));
  const runPrimary = () => {
    if (primary.key === 'edit') onEdit('results');
    else if (primary.key === 'calculate') onCalculate();
    else if (primary.key === 'checkNormatives') onCheckNormatives();
    else if (primary.key === 'ready') onReady();
    else if (primary.key === 'approve') onApprove();
    else if (primary.key === 'sign') onSign();
    else if (primary.key === 'publish') onPublish();
    else if (primary.key === 'pdf') onPdf();
    else if (primary.key === 'replacement') onReplacement();
    else if (primary.key === 'review') setActiveTab('results');
  };
  return (
    <div className="protocol-workspace space-y-3 pb-24">
      <ProtocolHeader protocol={protocol} actions={actions} busy={busy} primaryDisabled={primaryBlocked} primaryLabel={primary.label} onBack={onBack} onPrimary={runPrimary} onDocx={onDocx} onGenerateDocx={onGenerateDocx} onGeneratePdf={onGeneratePdf} onCorrection={onCorrection} onReturnForRevision={onReturnForRevision} onCancel={onCancel} onArchive={onArchive} onHistory={() => setActiveTab('history')} />
      <ProtocolProgress status={protocol.status} />
      <div className="protocol-summary-grid grid gap-3 xl:grid-cols-[1fr_1.3fr_0.72fr]">
        <section className="protocol-summary-card border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2"><h2 className="font-black">Основные данные</h2>{actions.edit && <button type="button" className="text-xs font-bold text-eco-700" onClick={() => onEdit('general')}>Изменить</button>}</div>
          <dl className="grid grid-cols-[8rem_minmax(0,1fr)] text-sm">
            <dt>Версия</dt><dd>v{protocol.version}</dd>
            <dt>Дата создания</dt><dd>{new Date(protocol.createdAt).toLocaleDateString('ru-RU')}</dd>
            <dt>Ответственный</dt><dd>{protocol.executor || protocol.laboratory.executorName || '—'}</dd>
            <dt>Результаты</dt><dd>{protocol.results.length}</dd>
          </dl>
        </section>
        <ProtocolNextStepCard protocol={protocol} missing={nextStepMissing} />
        <ProtocolSignaturesCard protocol={protocol} actions={effectiveActions} signing={signing} onSign={onSign} />
      </div>
      <ProtocolContextLinks protocol={protocol} />
      <ProtocolImmutableBanner protocol={protocol} />
      {workflowErrors.length > 0 && <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><h2 className="font-black text-rose-900">Не удалось выполнить действие</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-800">{workflowErrors.map((item) => <li key={item}>{item}</li>)}</ul></section>}
      {allTransitionBlockers.length > 0 && <section role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-black text-amber-900">Действие заблокировано backend</h2><ul className="mt-2 space-y-2 text-sm text-amber-800">{allTransitionBlockers.map((item, index) => <li key={`${item.code}-${index}`} className="flex flex-wrap items-center justify-between gap-2"><span>{item.message}</span>{actions.edit && (item.fieldPath || item.step !== undefined) && <button type="button" className="font-bold underline" onClick={() => onEdit(blockerEditSection(item.fieldPath, item.message))}>Перейти к полю</button>}</li>)}</ul></section>}
      <nav aria-label="Разделы протокола" className="overflow-x-auto border-b border-slate-200">
        <div className="flex min-w-max gap-1">{tabs.map((tab) => <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`border-b-2 px-4 py-3 text-sm font-bold ${activeTab === tab.key ? 'border-eco-600 text-eco-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{tab.label}</button>)}</div>
      </nav>
      {activeTab === 'results' && <ProtocolResultsTab protocol={protocol} editable={actions.edit} onEdit={() => onEdit('results')} />}
      {activeTab === 'main' && <ProtocolMainDataTab protocol={protocol} editable={actions.edit} onEdit={onEdit} />}
      {activeTab === 'documents' && <ProtocolDocumentsTab protocol={protocol} busy={busy} actions={effectiveActions} onPreview={onPreview} onGenerateDocx={onGenerateDocx} onGeneratePdf={onGeneratePdf} onDocx={onDocx} onPdf={onPdf} onSign={onSign} />}
      {activeTab === 'sampling-acts' && <ProtocolSamplingActsTab protocol={protocol} editable={actions.edit} />}
      {activeTab === 'history' && actions.viewAudit && <ProtocolHistoryTab protocol={protocol} />}
      {primary.label && <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:hidden"><button type="button" disabled={busy || primaryBlocked} onClick={runPrimary} className="min-h-12 w-full rounded-xl bg-eco-600 px-4 font-bold text-white disabled:opacity-50">{primary.label}</button></div>}
    </div>
  );
};

export default ProtocolDetailsView;
