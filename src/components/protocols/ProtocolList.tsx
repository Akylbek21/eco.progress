import ProtocolStatusBadge from './ProtocolStatusBadge';
import NormativeStatusBadge from './NormativeStatusBadge';
import type { Protocol } from '../../types/protocols';
import { subtypeName, templateName } from '../../data/protocolTemplates';

type Props = {
  protocols: Protocol[];
  loading?: boolean;
  onOpen: (protocol: Protocol) => void;
  onPreview: (protocol: Protocol) => void | Promise<void>;
  onCopy: (protocol: Protocol) => void | Promise<void>;
  onDelete: (protocol: Protocol) => void;
  onReplace: (protocol: Protocol) => void | Promise<void>;
  onDownloadPdf: (protocol: Protocol) => void | Promise<void>;
  onDownloadDocx: (protocol: Protocol) => void | Promise<void>;
};

const ProtocolList = ({ protocols, loading = false, onOpen, onPreview, onCopy, onDelete, onReplace, onDownloadPdf, onDownloadDocx }: Props) => (
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
                <select
                  aria-label={`Действия с протоколом ${protocol.protocolNumber || protocol.number || ''}`}
                  defaultValue=""
                  className="ml-auto block w-full max-w-[140px] rounded-lg border border-eco-300 bg-white px-2 py-2 text-xs font-semibold text-eco-800 outline-none hover:bg-eco-50 focus:border-eco-500 focus:ring-2 focus:ring-eco-100"
                  onChange={(event) => {
                    const action = event.target.value;
                    event.target.value = '';
                    if (action === 'open') onOpen(protocol);
                    if (action === 'preview') void onPreview(protocol);
                    if (action === 'copy') void onCopy(protocol);
                    if (action === 'docx') void onDownloadDocx(protocol);
                    if (action === 'pdf') void onDownloadPdf(protocol);
                    if (action === 'delete') onDelete(protocol);
                    if (action === 'replace') void onReplace(protocol);
                  }}
                >
                  <option value="" disabled>Выберите…</option>
                  <option value="open">{protocol.status === 'DRAFT' ? 'Изменить' : 'Открыть'}</option>
                  <option value="preview">Предпросмотр</option>
                  <option value="copy">Создать копию</option>
                  <option value="docx">Скачать DOCX</option>
                  <option value="pdf">Скачать PDF</option>
                  <option value="delete">Удалить протокол</option>
                  {protocol.status === 'SIGNED' && <option value="replace">Исправленная версия</option>}
                </select>
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
