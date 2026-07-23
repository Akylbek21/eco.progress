import { useState } from 'react';
import type { Protocol } from '../../../types/protocols';
import type { ProtocolPermissions } from '../../../utils/protocolPermissions';
import ProtocolDocumentsTab from './ProtocolDocumentsTab';
import ProtocolHeader from './ProtocolHeader';
import ProtocolHistoryTab from './ProtocolHistoryTab';
import ProtocolMainDataTab from './ProtocolMainDataTab';
import ProtocolNextStepCard from './ProtocolNextStepCard';
import ProtocolProgress from './ProtocolProgress';
import ProtocolResultsTab from './ProtocolResultsTab';
import { resolveProtocolPrimaryAction, type ProtocolDetailsTab, type ProtocolEditSection } from './protocolDetailsModel';

type MissingItem = { label: string };
type Props = {
  protocol: Protocol;
  role?: string;
  permissions: ProtocolPermissions;
  missing: MissingItem[];
  workflowErrors: string[];
  busy: boolean;
  onBack: () => void;
  onEdit: (section: ProtocolEditSection) => void;
  onReady: () => void;
  onApprove: () => void;
  onReturn: () => void;
  onSign: () => void;
  onGenerate: () => void;
  onDocx: () => void;
  onPdf: () => void;
  onCorrection: () => void;
  onCancel: () => void;
  onArchive: () => void;
  onReplacement: () => void;
};

const tabs: Array<{ key: ProtocolDetailsTab; label: string }> = [
  { key: 'results', label: 'Результаты' },
  { key: 'main', label: 'Основные данные' },
  { key: 'documents', label: 'Документы' },
  { key: 'history', label: 'История' },
];

const ProtocolDetailsView = ({ protocol, role, permissions, missing, workflowErrors, busy, onBack, onEdit, onReady, onApprove, onReturn, onSign, onGenerate, onDocx, onPdf, onCorrection, onCancel, onArchive, onReplacement }: Props) => {
  const [activeTab, setActiveTab] = useState<ProtocolDetailsTab>('results');
  const primary = resolveProtocolPrimaryAction(protocol, role);
  const runPrimary = () => {
    if (primary.key === 'edit') onEdit('results');
    else if (primary.key === 'ready') onReady();
    else if (primary.key === 'approve') onApprove();
    else if (primary.key === 'sign') onSign();
    else if (primary.key === 'pdf') onPdf();
    else if (primary.key === 'replacement') onReplacement();
    else if (primary.key === 'review') setActiveTab('results');
  };
  return (
    <div className="space-y-4 pb-24">
      <ProtocolHeader protocol={protocol} permissions={permissions} busy={busy} primaryLabel={primary.label} onBack={onBack} onPrimary={runPrimary} onReturn={onReturn} onDocx={onDocx} onGenerate={onGenerate} onCorrection={onCorrection} onCancel={onCancel} onArchive={onArchive} onHistory={() => setActiveTab('history')} />
      <ProtocolProgress status={protocol.status} />
      <ProtocolNextStepCard protocol={protocol} missing={missing} />
      {workflowErrors.length > 0 && <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><h2 className="font-black text-rose-900">Не удалось выполнить действие</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-800">{workflowErrors.map((item) => <li key={item}>{item}</li>)}</ul></section>}
      <nav aria-label="Разделы протокола" className="overflow-x-auto border-b border-slate-200">
        <div className="flex min-w-max gap-1">{tabs.map((tab) => <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`border-b-2 px-4 py-3 text-sm font-bold ${activeTab === tab.key ? 'border-eco-600 text-eco-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{tab.label}</button>)}</div>
      </nav>
      {activeTab === 'results' && <ProtocolResultsTab protocol={protocol} editable={permissions.canSave} onEdit={() => onEdit('results')} />}
      {activeTab === 'main' && <ProtocolMainDataTab protocol={protocol} editable={permissions.canSave} onEdit={onEdit} />}
      {activeTab === 'documents' && <ProtocolDocumentsTab protocol={protocol} busy={busy} canGenerate={permissions.canGenerate} canSign={permissions.canSign} onGenerate={onGenerate} onDocx={onDocx} onPdf={onPdf} onSign={onSign} />}
      {activeTab === 'history' && <ProtocolHistoryTab protocol={protocol} />}
      {primary.label && <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:hidden"><button type="button" disabled={busy} onClick={runPrimary} className="min-h-12 w-full rounded-xl bg-eco-600 px-4 font-bold text-white disabled:opacity-50">{primary.label}</button></div>}
    </div>
  );
};

export default ProtocolDetailsView;
