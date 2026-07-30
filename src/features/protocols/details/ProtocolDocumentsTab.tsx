import type { Protocol } from '../../../types/protocols';
import { formatProtocolDateTime } from './protocolDetailsModel';

type Props = {
  protocol: Protocol;
  busy: boolean;
  canGenerate: boolean;
  canDownload: boolean;
  canSign: boolean;
  onGenerate: () => void;
  onDocx: () => void;
  onPdf: () => void;
  onSign: () => void;
};

const ProtocolDocumentsTab = ({
  protocol,
  busy,
  canGenerate,
  canDownload,
  canSign,
  onGenerate,
  onDocx,
  onPdf,
  onSign,
}: Props) => {
  const generationLocked = ['SIGNED', 'PUBLISHED', 'REPLACED', 'CANCELLED', 'ARCHIVED'].includes(protocol.status);
  return (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-black">Документы протокола</h2>
        <p className="mt-1 text-sm text-slate-500">Версия документа: {protocol.version}</p>
      </div>
      {canGenerate && !generationLocked && (!protocol.hasDocx || !protocol.hasPdf) && (
        <button type="button" disabled={busy} onClick={onGenerate} className="rounded-xl bg-eco-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          Сформировать DOCX и PDF
        </button>
      )}
    </div>
    <div className="mt-5 divide-y divide-slate-100">
      <div className="flex items-center justify-between gap-4 py-4">
        <div>
          <h3 className="font-black">PDF</h3>
          <p className="mt-1 text-sm text-slate-500">{protocol.hasPdf ? `Сформирован · ${formatProtocolDateTime(protocol.updatedAt)}` : 'Документ ещё не сформирован.'}</p>
        </div>
        {canDownload && protocol.hasPdf && <button type="button" disabled={busy} onClick={onPdf} className="font-bold text-eco-700">Скачать</button>}
      </div>
      <div className="flex items-center justify-between gap-4 py-4">
        <div>
          <h3 className="font-black">DOCX</h3>
          <p className="mt-1 text-sm text-slate-500">{protocol.hasDocx ? `Сформирован · ${formatProtocolDateTime(protocol.updatedAt)}` : 'Документ ещё не сформирован.'}</p>
        </div>
        {canDownload && protocol.hasDocx && <button type="button" disabled={busy} onClick={onDocx} className="font-bold text-eco-700">Скачать</button>}
      </div>
      <div className="flex items-center justify-between gap-4 py-4">
        <div>
          <h3 className="font-black">Подписи сотрудников</h3>
          <p className="mt-1 text-sm text-slate-500">Подписей: {protocol.signatureCount} из {protocol.maxSignatures}. Полный список показан в карточке протокола.</p>
        </div>
        {canSign && (
          <button type="button" disabled={busy} onClick={onSign} className="font-bold text-eco-700 disabled:cursor-not-allowed disabled:text-slate-400">
            {protocol.signedByCurrentUser ? 'Вы подписали' : 'Подписать'}
          </button>
        )}
      </div>
    </div>
  </section>
  );
};

export default ProtocolDocumentsTab;
