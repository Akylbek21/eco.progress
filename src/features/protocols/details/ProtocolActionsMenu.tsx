import { MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Protocol } from '../../../types/protocols';
import type { ProtocolPermissions } from '../../../utils/protocolPermissions';

type Props = {
  protocol: Protocol;
  permissions: ProtocolPermissions;
  busy: boolean;
  onDocx: () => void;
  onGenerate: () => void;
  onCorrection: () => void;
  onCancel: () => void;
  onArchive: () => void;
  onHistory: () => void;
};

const ProtocolActionsMenu = ({ protocol, permissions, busy, onDocx, onGenerate, onCorrection, onCancel, onArchive, onHistory }: Props) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const run = (action: () => void) => { setOpen(false); action(); };
  return (
    <div ref={wrapperRef} className="relative">
      <button type="button" disabled={busy} onClick={() => setOpen((value) => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50" aria-expanded={open}>
        <MoreHorizontal className="h-5 w-5" /> Ещё
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-xl">
          {permissions.canGenerate && !protocol.hasDocx && !protocol.hasPdf && <button type="button" onClick={() => run(onGenerate)} className="w-full rounded-lg px-3 py-2 text-left font-semibold hover:bg-slate-50">Сформировать документы</button>}
          {permissions.canDownload && protocol.hasDocx && <button type="button" onClick={() => run(onDocx)} className="w-full rounded-lg px-3 py-2 text-left font-semibold hover:bg-slate-50">Скачать DOCX</button>}
          {permissions.canCreateCorrection && <button type="button" onClick={() => run(onCorrection)} className="w-full rounded-lg px-3 py-2 text-left font-semibold hover:bg-slate-50">Создать исправленную версию</button>}
          <button type="button" onClick={() => run(onHistory)} className="w-full rounded-lg px-3 py-2 text-left font-semibold hover:bg-slate-50">Посмотреть историю</button>
          {permissions.canCancel && <button type="button" onClick={() => run(onCancel)} className="w-full rounded-lg px-3 py-2 text-left font-semibold text-rose-700 hover:bg-rose-50">Отменить протокол</button>}
          {permissions.canArchive && <button type="button" onClick={() => run(onArchive)} className="w-full rounded-lg px-3 py-2 text-left font-semibold text-rose-700 hover:bg-rose-50">Архивировать</button>}
        </div>
      )}
    </div>
  );
};

export default ProtocolActionsMenu;
