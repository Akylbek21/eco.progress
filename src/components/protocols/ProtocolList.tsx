import { Download, Eye, FilePenLine, FileText, RotateCcw, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import ProtocolStatusBadge from './ProtocolStatusBadge';
import NormativeStatusBadge from './NormativeStatusBadge';
import type { Protocol } from '../../types/protocols';
import { subtypeName, templateName } from '../../data/protocolTemplates';

type Props = {
  protocols: Protocol[];
  loading?: boolean;
  onOpen: (protocol: Protocol) => void;
  onPreview: (protocol: Protocol) => void | Promise<void>;
  onDelete: (protocol: Protocol) => void;
  onReplace: (protocol: Protocol) => void | Promise<void>;
  onDownloadPdf: (protocol: Protocol) => void | Promise<void>;
  onDownloadDocx: (protocol: Protocol) => void | Promise<void>;
};

const ProtocolList = ({ protocols, loading = false, onOpen, onPreview, onDelete, onReplace, onDownloadPdf, onDownloadDocx }: Props) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="overflow-x-auto">
      <table className="min-w-[1660px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Номер</th>
            <th className="px-4 py-3">Дата</th>
            <th className="px-4 py-3">Компания</th>
            <th className="px-4 py-3">Объект</th>
            <th className="px-4 py-3">Тип</th>
            <th className="px-4 py-3">Подтип</th>
            <th className="px-4 py-3">Статус</th>
            <th className="px-4 py-3">Соответствие</th>
            <th className="px-4 py-3">Исполнитель</th>
            <th className="px-4 py-3">Создан</th>
            <th className="px-4 py-3 text-right">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? Array.from({ length: 5 }).map((_, row) => (
            <tr key={row} className="animate-pulse">{Array.from({ length: 11 }).map((__, cell) => <td key={cell} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td>)}</tr>
          )) : protocols.map((protocol) => (
            <tr key={protocol.id} className="hover:bg-slate-50">
              <td className="px-4 py-4 font-bold text-slate-900">{protocol.protocolNumber || protocol.number || '—'}</td>
              <td className="px-4 py-4">{protocol.protocolDate || '—'}</td>
              <td className="px-4 py-4">{protocol.companySnapshot?.companyName || protocol.organization?.organizationName || '—'}</td>
              <td className="px-4 py-4">{protocol.companySnapshot?.objectName || protocol.organization?.objectName || '—'}</td>
              <td className="px-4 py-4">{templateName(protocol.templateId, protocol.templateName)}</td>
              <td className="px-4 py-4">{protocol.templateId === 'physical_factors' ? subtypeName(protocol.subtype) : '—'}</td>
              <td className="px-4 py-4"><ProtocolStatusBadge status={protocol.status} /></td>
              <td className="px-4 py-4"><NormativeStatusBadge status={protocol.complianceResult as any} /></td>
              <td className="px-4 py-4">{protocol.executor || protocol.laboratory?.executor || '—'}</td>
              <td className="px-4 py-4">{protocol.createdAt || '—'}</td>
              <td className="px-4 py-4">
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" className="px-3" title={protocol.status === 'DRAFT' ? 'Редактировать' : 'Открыть'} onClick={() => onOpen(protocol)}>
                    {protocol.status === 'DRAFT' ? <FilePenLine className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button type="button" variant="secondary" className="px-3" title="Предпросмотр" onClick={() => onPreview(protocol)}><Eye className="h-4 w-4" /></Button>
                  <Button type="button" variant="secondary" className="px-3" title="Скачать DOCX" onClick={() => onDownloadDocx(protocol)}><FileText className="h-4 w-4" /></Button>
                  <Button type="button" variant="secondary" className="px-3" title="Скачать PDF" onClick={() => onDownloadPdf(protocol)}><Download className="h-4 w-4" /></Button>
                  {protocol.status === 'DRAFT' && <Button type="button" variant="secondary" className="px-3 text-rose-700 hover:bg-rose-50" title="Удалить черновик" onClick={() => onDelete(protocol)}><Trash2 className="h-4 w-4" /></Button>}
                  {protocol.status === 'SIGNED' && <Button type="button" variant="secondary" className="px-3" title="Создать исправленную версию" onClick={() => onReplace(protocol)}><RotateCcw className="h-4 w-4" /></Button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {!loading && protocols.length === 0 && <div className="px-6 py-12 text-center text-sm font-semibold text-slate-500">Протоколы не найдены.</div>}
  </div>
);

export default ProtocolList;
