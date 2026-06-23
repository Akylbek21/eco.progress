import { Download, Eye, FilePenLine, FileText, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import ProtocolStatusBadge from './ProtocolStatusBadge';
import type { Protocol } from '../../types/protocols';
import { templateName } from '../../data/protocolTemplates';

type ProtocolListProps = {
  protocols: Protocol[];
  loading?: boolean;
  onOpen: (protocol: Protocol) => void;
  onDelete: (protocol: Protocol) => void;
  onDownloadPdf: (protocol: Protocol) => void | Promise<void>;
  onDownloadDocx: (protocol: Protocol) => void | Promise<void>;
};

const SkeletonRows = () => (
  <>
    {Array.from({ length: 5 }).map((_, index) => (
      <tr key={index} className="animate-pulse border-t border-slate-100">
        {Array.from({ length: 8 }).map((__, cell) => (
          <td key={cell} className="px-4 py-4">
            <div className="h-4 rounded bg-slate-100" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

const ProtocolList = ({ protocols, loading = false, onOpen, onDelete, onDownloadPdf, onDownloadDocx }: ProtocolListProps) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="overflow-x-auto">
      <table className="min-w-[1120px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Номер протокола</th>
            <th className="px-4 py-3">Шаблон</th>
            <th className="px-4 py-3">Организация</th>
            <th className="px-4 py-3">Объект</th>
            <th className="px-4 py-3">Дата протокола</th>
            <th className="px-4 py-3">Исполнитель</th>
            <th className="px-4 py-3">Статус</th>
            <th className="px-4 py-3 text-right">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? <SkeletonRows /> : protocols.map((protocol) => (
            <tr key={protocol.id} className="hover:bg-slate-50">
              <td className="px-4 py-4 font-bold text-slate-900">{protocol.protocolNumber || protocol.number || '-'}</td>
              <td className="px-4 py-4 text-slate-700">{protocol.templateName || templateName(protocol.templateId)}</td>
              <td className="px-4 py-4 text-slate-700">{protocol.companySnapshot?.companyName || protocol.organization?.organizationName || '-'}</td>
              <td className="px-4 py-4 text-slate-700">{protocol.companySnapshot?.objectName || protocol.organization?.objectName || '-'}</td>
              <td className="px-4 py-4 text-slate-700">{protocol.protocolDate || '-'}</td>
              <td className="px-4 py-4 text-slate-700">{protocol.executor || '-'}</td>
              <td className="px-4 py-4"><ProtocolStatusBadge status={protocol.status} /></td>
              <td className="px-4 py-4">
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" className="px-3" title="Открыть" onClick={() => onOpen(protocol)}>
                    {protocol.status === 'SIGNED' || protocol.status === 'REPLACED' || protocol.status === 'CANCELLED' ? <Eye className="h-4 w-4" /> : <FilePenLine className="h-4 w-4" />}
                  </Button>
                  {['APPROVED', 'SIGNED', 'REPLACED'].includes(protocol.status) && (
                    <>
                      <Button type="button" variant="secondary" className="px-3" title="Скачать PDF" onClick={() => onDownloadPdf(protocol)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="secondary" className="px-3" title="Скачать DOCX" onClick={() => onDownloadDocx(protocol)}>
                        <FileText className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {protocol.status === 'DRAFT' && (
                    <Button type="button" variant="secondary" className="px-3 text-rose-700 hover:bg-rose-50" title="Удалить" onClick={() => onDelete(protocol)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {!loading && protocols.length === 0 && (
      <div className="px-6 py-12 text-center">
        <p className="text-base font-bold text-slate-900">Протоколы не найдены</p>
        <p className="mt-1 text-sm text-slate-500">Создайте первый протокол или измените фильтры поиска.</p>
      </div>
    )}
  </div>
);

export default ProtocolList;
