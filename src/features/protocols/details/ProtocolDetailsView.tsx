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
  { key: 'history', label: 'История' },
];

const ProtocolDetailsView = ({ protocol, actions, missing, workflowErrors, busy, signing, onBack, onEdit, onCalculate, onCheckNormatives, onReady, onApprove, onSign, onPublish, onPreview, onGenerateDocx, onGeneratePdf, onDocx, onPdf, onCorrection, onReturnForRevision, onCancel, onArchive, onReplacement, initialTab = 'results' }: Props) => {
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
  const nextStepMissing = Array.from(new Set([
    ...missing.map((item) => item.label),
    ...(protocol.blockingReasons || []).map((item) => item.message.trim()).filter(Boolean),
  ])).map((label) => ({ label }));
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
    <div className="space-y-4 pb-24">
      <ProtocolHeader protocol={protocol} actions={actions} busy={busy} primaryDisabled={primaryBlocked} primaryLabel={primary.label} onBack={onBack} onPrimary={runPrimary} onDocx={onDocx} onGenerateDocx={onGenerateDocx} onGeneratePdf={onGeneratePdf} onCorrection={onCorrection} onReturnForRevision={onReturnForRevision} onCancel={onCancel} onArchive={onArchive} onHistory={() => setActiveTab('history')} />
      <ProtocolProgress status={protocol.status} />
      <ProtocolNextStepCard protocol={protocol} missing={nextStepMissing} />
      <ProtocolContextLinks protocol={protocol} />
      <ProtocolImmutableBanner protocol={protocol} />
      <ProtocolSignaturesCard protocol={protocol} actions={effectiveActions} signing={signing} onSign={onSign} />
      {actions.publish && (
        <div className="flex justify-end">
          <button type="button" disabled={busy} onClick={onPublish} className="min-h-11 rounded-xl bg-eco-600 px-4 text-sm font-bold text-white disabled:opacity-50">
            Опубликовать для клиента
          </button>
        </div>
      )}
      {workflowErrors.length > 0 && <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><h2 className="font-black text-rose-900">Не удалось выполнить действие</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-800">{workflowErrors.map((item) => <li key={item}>{item}</li>)}</ul></section>}
      {allTransitionBlockers.length > 0 && <section role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-black text-amber-900">Действие заблокировано backend</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">{allTransitionBlockers.map((item) => <li key={item.code}>{item.message}</li>)}</ul></section>}
      <nav aria-label="Разделы протокола" className="overflow-x-auto border-b border-slate-200">
        <div className="flex min-w-max gap-1">{tabs.map((tab) => <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`border-b-2 px-4 py-3 text-sm font-bold ${activeTab === tab.key ? 'border-eco-600 text-eco-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{tab.label}</button>)}</div>
      </nav>
      {activeTab === 'results' && <ProtocolResultsTab protocol={protocol} editable={actions.edit} onEdit={() => onEdit('results')} />}
      {activeTab === 'main' && <ProtocolMainDataTab protocol={protocol} editable={actions.edit} onEdit={onEdit} />}
      {activeTab === 'documents' && <ProtocolDocumentsTab protocol={protocol} busy={busy} actions={effectiveActions} onPreview={onPreview} onGenerateDocx={onGenerateDocx} onGeneratePdf={onGeneratePdf} onDocx={onDocx} onPdf={onPdf} onSign={onSign} />}
      {activeTab === 'history' && actions.viewAudit && <ProtocolHistoryTab protocol={protocol} />}
      {primary.label && <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:hidden"><button type="button" disabled={busy || primaryBlocked} onClick={runPrimary} className="min-h-12 w-full rounded-xl bg-eco-600 px-4 font-bold text-white disabled:opacity-50">{primary.label}</button></div>}
    </div>
  );
};

export default ProtocolDetailsView;
