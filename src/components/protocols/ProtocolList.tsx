import { Archive, Download, Edit3, Eye, RotateCw } from 'lucide-react';
import ProtocolStatusBadge from './ProtocolStatusBadge';
import NormativeStatusBadge from './NormativeStatusBadge';
import type { Protocol } from '../../types/protocols';
import { templateName } from '../../data/protocolTemplates';
import { canArchiveProtocol, canCreateCorrection, canDownloadProtocol, canEditProtocol } from '../../utils/protocolPermissions';

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

const ProtocolList = ({ protocols, role, loading = false, busyId, onOpen, onArchive, onReplace, onDownload }: Props) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1750px] table-fixed text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-36 px-4 py-3">Номер</th><th className="w-28 px-4 py-3">Дата</th><th className="w-52 px-4 py-3">Компания</th><th className="w-52 px-4 py-3">Объект</th><th className="w-44 px-4 py-3">Тип</th><th className="w-52 px-4 py-3">Лаборатория</th><th className="w-44 px-4 py-3">Исполнитель</th><th className="w-36 px-4 py-3">Статус</th><th className="w-36 px-4 py-3">Соответствие</th><th className="w-20 px-4 py-3">Версия</th><th className="w-28 px-4 py-3">Документы</th><th className="w-28 px-4 py-3">Изменён</th><th className="w-56 px-4 py-3 text-right">Действия</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? Array.from({ length: 8 }).map((_, row) => <tr key={row} className="h-16 animate-pulse">{Array.from({ length: 13 }).map((__, cell) => <td key={cell} className="px-4 py-3"><div className="h-4 rounded bg-slate-100" /></td>)}</tr>) : protocols.map((protocol) => {
            const user = { role };
            const busy = busyId === protocol.id;
            return <tr key={protocol.id} tabIndex={0} onClick={() => onOpen(protocol)} onKeyDown={(event) => { if (event.key === 'Enter') onOpen(protocol); }} className={`cursor-pointer align-top hover:bg-slate-50 focus:bg-eco-50 focus:outline-none ${protocol.status === 'ARCHIVED' ? 'bg-slate-50/80 text-slate-600' : ''}`}>
              <td className="truncate px-4 py-4 font-bold text-slate-900">{protocol.protocolNumber || protocol.number || '—'}</td><td className="px-4 py-4">{formatDate(protocol.protocolDate)}</td><td className="truncate px-4 py-4" title={protocol.companySnapshot?.companyName}>{protocol.companySnapshot?.companyName || '—'}</td><td className="truncate px-4 py-4" title={protocol.companySnapshot?.objectName}>{protocol.companySnapshot?.objectName || '—'}</td><td className="px-4 py-4">{templateName(protocol.templateId, protocol.templateName)}</td><td className="truncate px-4 py-4">{protocol.laboratory?.laboratoryName || '—'}</td><td className="truncate px-4 py-4">{protocol.executor || protocol.laboratory?.executor || '—'}</td><td className="px-4 py-4"><ProtocolStatusBadge status={protocol.status} /></td><td className="px-4 py-4"><NormativeStatusBadge status={protocol.complianceResult} /></td><td className="px-4 py-4">{protocol.version ?? '—'}</td><td className="px-4 py-4">{[protocol.hasDocx && 'DOCX', protocol.hasPdf && 'PDF'].filter(Boolean).join(' · ') || '—'}</td><td className="px-4 py-4">{formatDate(protocol.updatedAt)}</td>
              <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}><div className="flex justify-end gap-2"><button type="button" className={`${iconButton} text-eco-800 ring-eco-200`} aria-label={`${canEditProtocol(user, protocol) ? 'Изменить' : 'Открыть'} протокол ${protocol.protocolNumber}`} onClick={() => onOpen(protocol)}>{canEditProtocol(user, protocol) ? <Edit3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>{canDownloadProtocol(user, protocol) && protocol.hasDocx && <button type="button" disabled={busy} className={`${iconButton} text-eco-800 ring-eco-200`} aria-label={`Скачать DOCX ${protocol.protocolNumber}`} onClick={() => onDownload(protocol, 'docx')}><Download className="h-4 w-4" /></button>}{canDownloadProtocol(user, protocol) && protocol.hasPdf && <button type="button" disabled={busy} className={`${iconButton} text-blue-800 ring-blue-200`} aria-label={`Скачать PDF ${protocol.protocolNumber}`} onClick={() => onDownload(protocol, 'pdf')}><Download className="h-4 w-4" /></button>}{canCreateCorrection(user, protocol) && <button type="button" className={`${iconButton} text-violet-800 ring-violet-200`} aria-label={`Создать исправленную версию ${protocol.protocolNumber}`} onClick={() => onReplace(protocol)}><RotateCw className="h-4 w-4" /></button>}{canArchiveProtocol(user, protocol) && <button type="button" className={`${iconButton} text-rose-700 ring-rose-200`} aria-label={`Архивировать протокол ${protocol.protocolNumber}`} onClick={() => onArchive(protocol)}><Archive className="h-4 w-4" /></button>}</div></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </div>
);

export default ProtocolList;
