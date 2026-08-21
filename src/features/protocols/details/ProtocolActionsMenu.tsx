import { MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Protocol, ProtocolAvailableActions } from '../../../types/protocols';

type Props = {
  protocol: Protocol;
  actions: ProtocolAvailableActions;
  busy: boolean;
  onDocx: () => void;
  onGenerateDocx: () => void;
  onGeneratePdf: () => void;
  onCorrection: () => void;
  onReturnForRevision: () => void;
  onCancel: () => void;
  onArchive: () => void;
  onHistory: () => void;
};

const ProtocolActionsMenu = ({ protocol, actions, busy, onDocx, onGenerateDocx, onGeneratePdf, onCorrection, onReturnForRevision, onCancel, onArchive, onHistory }: Props) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hasActions = (protocol.hasDocx ? actions.regenerateDocx : actions.generateDocx)
    || (protocol.hasPdf ? actions.regeneratePdf : actions.generatePdf)
    || actions.downloadDocx || actions.createCorrection || actions.returnToDraft
    || actions.returnForRevision || actions.viewAudit || actions.cancel || actions.archive;
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const run = (action: () => void) => { setOpen(false); action(); };
  if (!hasActions) return null;
  return (
    <div ref={wrapperRef} className="relative">
      <button type="button" disabled={busy} onClick={() => setOpen((value) => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50" aria-expanded={open}>
        <MoreHorizontal className="h-5 w-5" /> Ещё
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-xl">
          {((protocol.hasDocx && actions.regenerateDocx) || (!protocol.hasDocx && actions.generateDocx)) && <button type="button" onClick={() => run(onGenerateDocx)} className="w-full rounded-lg px-3 py-2 text-left font-semibold hover:bg-slate-50">{protocol.hasDocx ? 'Перегенерировать DOCX' : 'Сгенерировать DOCX'}</button>}
          {((protocol.hasPdf && actions.regeneratePdf) || (!protocol.hasPdf && actions.generatePdf)) && <button type="button" onClick={() => run(onGeneratePdf)} className="w-full rounded-lg px-3 py-2 text-left font-semibold hover:bg-slate-50">{protocol.hasPdf ? 'Перегенерировать PDF' : 'Сгенерировать PDF'}</button>}
          {actions.downloadDocx && <button type="button" onClick={() => run(onDocx)} className="w-full rounded-lg px-3 py-2 text-left font-semibold hover:bg-slate-50">Скачать DOCX</button>}
          {actions.createCorrection && <button type="button" onClick={() => run(onCorrection)} className="w-full rounded-lg px-3 py-2 text-left font-semibold hover:bg-slate-50">Создать исправленную версию</button>}
          {(actions.returnToDraft || actions.returnForRevision) && <button type="button" onClick={() => run(onReturnForRevision)} className="w-full rounded-lg px-3 py-2 text-left font-semibold text-amber-800 hover:bg-amber-50">{actions.returnToDraft ? 'Вернуть в черновик' : 'Вернуть на доработку'}</button>}
          {actions.viewAudit && <button type="button" onClick={() => run(onHistory)} className="w-full rounded-lg px-3 py-2 text-left font-semibold hover:bg-slate-50">Посмотреть историю</button>}
          {actions.cancel && <button type="button" onClick={() => run(onCancel)} className="w-full rounded-lg px-3 py-2 text-left font-semibold text-rose-700 hover:bg-rose-50">Отменить протокол</button>}
          {actions.archive && <button type="button" onClick={() => run(onArchive)} className="w-full rounded-lg px-3 py-2 text-left font-semibold text-rose-700 hover:bg-rose-50">Архивировать</button>}
        </div>
      )}
    </div>
  );
};

export default ProtocolActionsMenu;
