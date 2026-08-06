import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { MoreHorizontal } from 'lucide-react';
import ProtocolStatusBadge from './ProtocolStatusBadge';
import type { Protocol } from '../../types/protocols';
import { templateName } from '../../data/protocolTemplates';
import { hasProtocolPermission } from '../../features/protocols/utils/protocolActions';
import { normalizeProtocolStatus } from '../../config/protocolStatus';

type Props = {
  protocols: Protocol[];
  role?: string;
  loading?: boolean;
  busyId?: string;
  onOpen: (protocol: Protocol) => void;
  onSign: (protocol: Protocol) => void;
  onEdit: (protocol: Protocol) => void;
  onDelete: (protocol: Protocol) => void;
  onArchive: (protocol: Protocol) => void;
  onReplace: (protocol: Protocol) => void;
  onDownload: (protocol: Protocol, kind: 'pdf' | 'docx') => void;
};

const formatDate = (value?: string) => value && !Number.isNaN(new Date(value).getTime())
  ? new Date(value).toLocaleDateString('ru-RU')
  : '—';

const primaryLabel = (protocol: Protocol) => {
  const status = normalizeProtocolStatus(protocol.status);
  if (status === 'DRAFT') return 'Продолжить';
  if (hasProtocolPermission(protocol, 'canSign')) return 'Открыть';
  if (status === 'SIGNED' && protocol.hasPdf) return 'Скачать PDF';
  return 'Открыть';
};

const ProtocolRowActions = ({ protocol, busy, onOpen, onSign, onEdit, onDelete, onArchive, onReplace, onDownload }: {
  protocol: Protocol; busy: boolean; onOpen: Props['onOpen']; onSign: Props['onSign']; onEdit: Props['onEdit']; onDelete: Props['onDelete'];
  onArchive: Props['onArchive']; onReplace: Props['onReplace']; onDownload: Props['onDownload'];
}) => {
  const [open, setOpen] = useState(false);
  const primary = primaryLabel(protocol);
  const runPrimary = () => {
    if (primary === 'Скачать PDF') onDownload(protocol, 'pdf');
    else onOpen(protocol);
  };
  return <div className="flex items-center justify-end gap-2">
    <button type="button" disabled={busy} onClick={runPrimary} className="min-h-10 rounded-xl bg-eco-600 px-4 text-sm font-bold text-white disabled:opacity-50">{primary}</button>
    <div className="relative">
      <button type="button" aria-label={`Дополнительные действия ${protocol.protocolNumber || ''}`} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white"><MoreHorizontal className="h-5 w-5" /></button>
      {open && <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
        {hasProtocolPermission(protocol, 'canEdit') && <button type="button" onClick={() => { setOpen(false); onEdit(protocol); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50">Изменить</button>}
        {protocol.hasDocx && hasProtocolPermission(protocol, 'canView') && <button type="button" onClick={() => { setOpen(false); onDownload(protocol, 'docx'); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50">Скачать DOCX</button>}
        {hasProtocolPermission(protocol, 'canCreateCorrection') && <button type="button" onClick={() => { setOpen(false); onReplace(protocol); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50">Создать исправленную версию</button>}
        <button type="button" onClick={() => { setOpen(false); onOpen(protocol); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50">История</button>
        {hasProtocolPermission(protocol, 'canDelete') && <button type="button" onClick={() => { setOpen(false); onDelete(protocol); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50">Удалить</button>}
        {hasProtocolPermission(protocol, 'canArchive') && <button type="button" onClick={() => { setOpen(false); onArchive(protocol); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50">Архивировать</button>}
      </div>}
    </div>
  </div>;
};

const ProtocolList = ({ protocols, loading = false, busyId, onOpen, onSign, onEdit, onDelete, onArchive, onReplace, onDownload }: Props) => {
  const interactiveSelector = 'button, a, input, select, textarea, [role="button"], [role="menuitem"]';
  const isInteractiveTarget = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest(interactiveSelector));
  const openFromClick = <T extends HTMLElement,>(event: MouseEvent<T>, protocol: Protocol) => {
    if (!event.defaultPrevented && !isInteractiveTarget(event.target)) onOpen(protocol);
  };
  const openFromKeyboard = <T extends HTMLElement,>(event: KeyboardEvent<T>, protocol: Protocol) => {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onOpen(protocol);
  };

  if (loading) return <div className="space-y-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}</div>;
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="space-y-3 p-3 md:hidden">{protocols.map((protocol) => <article key={protocol.id} role="link" tabIndex={0} aria-label={`Открыть протокол ${protocol.protocolNumber || ''}`} onClick={(event) => openFromClick(event, protocol)} onKeyDown={(event) => openFromKeyboard(event, protocol)} className="cursor-pointer rounded-xl border border-slate-200 p-4 transition hover:border-eco-200 hover:bg-eco-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eco-600">
      <div className="flex items-start justify-between gap-3"><div><p className="font-bold">{protocol.protocolNumber || 'Без номера'}</p><p className="text-sm text-slate-500">{formatDate(protocol.protocolDate)} · {templateName(protocol.templateId, protocol.templateName)}</p></div><ProtocolStatusBadge status={protocol.status} /></div>
      <p className="mt-3 text-sm">{protocol.companySnapshot.companyName || 'Компания не указана'} · {protocol.companySnapshot.objectName || 'Объект не указан'}</p>
      <div className="mt-4"><ProtocolRowActions protocol={protocol} busy={busyId === protocol.id} onOpen={onOpen} onSign={onSign} onEdit={onEdit} onDelete={onDelete} onArchive={onArchive} onReplace={onReplace} onDownload={onDownload} /></div>
    </article>)}</div>
    <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1050px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">№ протокола</th><th className="px-4 py-3">Дата</th><th className="px-4 py-3">Компания</th><th className="px-4 py-3">Объект</th><th className="px-4 py-3">Тип</th><th className="px-4 py-3">Сотрудник</th><th className="px-4 py-3">Статус</th><th className="px-4 py-3 text-right">Действие</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{protocols.map((protocol) => <tr key={protocol.id} role="link" tabIndex={0} aria-label={`Открыть протокол ${protocol.protocolNumber || ''}`} onClick={(event) => openFromClick(event, protocol)} onKeyDown={(event) => openFromKeyboard(event, protocol)} className="cursor-pointer transition hover:bg-eco-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-eco-600"><td className="px-4 py-4 font-bold">{protocol.protocolNumber || '—'}</td><td className="px-4 py-4">{formatDate(protocol.protocolDate)}</td><td className="px-4 py-4">{protocol.companySnapshot.companyName || '—'}</td><td className="px-4 py-4">{protocol.companySnapshot.objectName || '—'}</td><td className="px-4 py-4">{templateName(protocol.templateId, protocol.templateName)}</td><td className="px-4 py-4">{protocol.executor || protocol.laboratory.executor || '—'}</td><td className="px-4 py-4"><ProtocolStatusBadge status={protocol.status} /></td><td className="px-4 py-3"><ProtocolRowActions protocol={protocol} busy={busyId === protocol.id} onOpen={onOpen} onSign={onSign} onEdit={onEdit} onDelete={onDelete} onArchive={onArchive} onReplace={onReplace} onDownload={onDownload} /></td></tr>)}</tbody>
    </table></div>
  </div>;
};

export default ProtocolList;
