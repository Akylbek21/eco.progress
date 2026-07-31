import { Archive, Download, Edit3, Eye, RotateCw } from 'lucide-react';
import ProtocolStatusBadge from './ProtocolStatusBadge';
import NormativeStatusBadge from './NormativeStatusBadge';
import type { Protocol } from '../../types/protocols';
import { templateName } from '../../data/protocolTemplates';
import { getProtocolPermissions } from '../../utils/protocolPermissions';

type Props = {
  protocols: Protocol[];
  role?: string;
  loading?: boolean;
  busyId?: string;
  onOpen: (protocol: Protocol) => void;
  onArchive: (protocol: Protocol) => void;
  onReplace: (protocol: Protocol) => void;
  onDownload: (protocol: Protocol, kind: 'pdf' | 'docx') => void;
};

const formatDate = (value?: string) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString('ru-RU') : '—';
const iconButton = 'inline-flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 transition hover:bg-eco-50 disabled:cursor-not-allowed disabled:opacity-50';

const ProtocolList = ({ protocols, role, loading = false, busyId, onOpen, onArchive, onReplace, onDownload }: Props) => {
  const actions = (protocol: Protocol) => {
    const permissions = getProtocolPermissions(protocol, role);
    const busy = busyId === protocol.id;
    return <div className="flex flex-wrap justify-end gap-2">
      <button type="button" className={`${iconButton} text-eco-800 ring-eco-200`} aria-label={`${permissions.canEdit ? 'Изменить' : 'Открыть'} протокол ${protocol.protocolNumber}`} onClick={() => onOpen(protocol)}>{permissions.canEdit ? <Edit3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
      {permissions.canDownload && protocol.hasDocx && <button type="button" disabled={busy} className={`${iconButton} text-eco-800 ring-eco-200`} aria-label={`Скачать DOCX ${protocol.protocolNumber}`} onClick={() => onDownload(protocol, 'docx')}><Download className="h-4 w-4" /></button>}
      {permissions.canDownload && protocol.hasPdf && <button type="button" disabled={busy} className={`${iconButton} text-blue-800 ring-blue-200`} aria-label={`Скачать PDF ${protocol.protocolNumber}`} onClick={() => onDownload(protocol, 'pdf')}><Download className="h-4 w-4" /></button>}
      {permissions.canReplace && <button type="button" className={`${iconButton} text-violet-800 ring-violet-200`} aria-label={`Создать исправленную версию ${protocol.protocolNumber}`} onClick={() => onReplace(protocol)}><RotateCw className="h-4 w-4" /></button>}
      {permissions.canArchive && <button type="button" className={`${iconButton} text-rose-700 ring-rose-200`} aria-label={`Архивировать протокол ${protocol.protocolNumber}`} onClick={() => onArchive(protocol)}><Archive className="h-4 w-4" /></button>}
    </div>;
  };

  if (loading) return <div className="space-y-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}</div>;

  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="space-y-3 p-3 md:hidden">
      {protocols.map((protocol) => <article key={protocol.id} className="rounded-xl border border-slate-200 p-4" onClick={() => onOpen(protocol)}>
        <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-950">{protocol.protocolNumber || '—'}</p><p className="text-sm text-slate-500">{formatDate(protocol.protocolDate)} · {templateName(protocol.templateId, protocol.templateName)}</p></div><ProtocolStatusBadge status={protocol.status} /></div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-slate-500">Компания</dt><dd>{protocol.companySnapshot.companyName || '—'}</dd></div><div><dt className="text-slate-500">Объект</dt><dd>{protocol.companySnapshot.objectName || '—'}</dd></div><div><dt className="text-slate-500">Лаборатория</dt><dd>{protocol.laboratory.laboratoryName || '—'}</dd></div><div><dt className="text-slate-500">Подписи</dt><dd>{protocol.signatureCount}/{protocol.maxSignatures}</dd></div></dl>
        <div className="mt-4" onClick={(event) => event.stopPropagation()}>{actions(protocol)}</div>
      </article>)}
    </div>
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[1480px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Номер</th><th className="px-3 py-3">Дата</th><th className="px-3 py-3">Тип</th><th className="px-3 py-3">Компания</th><th className="px-3 py-3">Объект</th><th className="px-3 py-3">Лаборатория</th><th className="px-3 py-3">Исполнитель</th><th className="px-3 py-3">Статус</th><th className="px-3 py-3">Соответствие</th><th className="px-3 py-3">Подписи</th><th className="px-3 py-3">Документы</th><th className="px-3 py-3">Публикация</th><th className="px-3 py-3 text-right">Действия</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{protocols.map((protocol) => <tr key={protocol.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpen(protocol)}>
          <td className="px-3 py-4 font-bold">{protocol.protocolNumber || '—'}</td><td className="px-3 py-4">{formatDate(protocol.protocolDate)}</td><td className="px-3 py-4">{templateName(protocol.templateId, protocol.templateName)}</td><td className="max-w-40 truncate px-3 py-4">{protocol.companySnapshot.companyName || '—'}</td><td className="max-w-40 truncate px-3 py-4">{protocol.companySnapshot.objectName || '—'}</td><td className="max-w-40 truncate px-3 py-4">{protocol.laboratory.laboratoryName || '—'}</td><td className="max-w-36 truncate px-3 py-4">{protocol.executor || protocol.laboratory.executor || '—'}</td><td className="px-3 py-4"><ProtocolStatusBadge status={protocol.status} /></td><td className="px-3 py-4"><NormativeStatusBadge status={protocol.complianceResult} /></td><td className="px-3 py-4">{protocol.signatureCount}/{protocol.maxSignatures}</td><td className="px-3 py-4">{[protocol.hasDocx && 'DOCX', protocol.hasPdf && 'PDF'].filter(Boolean).join(' · ') || '—'}</td><td className="px-3 py-4">{protocol.publishedAt ? formatDate(protocol.publishedAt) : '—'}</td><td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>{actions(protocol)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
};

export default ProtocolList;
