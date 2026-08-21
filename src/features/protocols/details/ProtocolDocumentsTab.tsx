import type { Protocol, ProtocolAvailableActions } from '../../../types/protocols';
import { formatProtocolDateTime } from './protocolDetailsModel';

type Props = {
  protocol: Protocol;
  busy: boolean;
  actions: ProtocolAvailableActions;
  onPreview: () => void;
  onGenerateDocx: () => void;
  onGeneratePdf: () => void;
  onDocx: () => void;
  onPdf: () => void;
  onSign: () => void;
};

const ProtocolDocumentsTab = ({
  protocol,
  busy,
  actions,
  onPreview,
  onGenerateDocx,
  onGeneratePdf,
  onDocx,
  onPdf,
  onSign,
}: Props) => {
  return (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-black">Документы протокола</h2>
        <p className="mt-1 text-sm text-slate-500">Версия документа: {protocol.version}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(actions.generatePreview || actions.downloadPdf) && <button type="button" disabled={busy} onClick={onPreview} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-50">{protocol.status === 'SIGNED' ? 'Просмотр' : 'Предварительный просмотр'}</button>}
        {!protocol.hasDocx && actions.generateDocx && <button type="button" disabled={busy} onClick={onGenerateDocx} className="rounded-xl bg-eco-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Сгенерировать DOCX</button>}
        {protocol.hasDocx && actions.regenerateDocx && <button type="button" disabled={busy} onClick={onGenerateDocx} className="rounded-xl border border-eco-600 px-4 py-2 text-sm font-bold text-eco-700 disabled:opacity-50">Перегенерировать DOCX</button>}
        {!protocol.hasPdf && actions.generatePdf && <button type="button" disabled={busy} onClick={onGeneratePdf} className="rounded-xl bg-eco-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Сгенерировать PDF</button>}
        {protocol.hasPdf && actions.regeneratePdf && <button type="button" disabled={busy} onClick={onGeneratePdf} className="rounded-xl border border-eco-600 px-4 py-2 text-sm font-bold text-eco-700 disabled:opacity-50">Перегенерировать PDF</button>}
      </div>
    </div>
    <div className="mt-5 divide-y divide-slate-100">
      <div className="flex items-center justify-between gap-4 py-4">
        <div>
          <h3 className="font-black">PDF</h3>
          <p className="mt-1 text-sm text-slate-500">{protocol.hasPdf ? `Сформирован · ${formatProtocolDateTime(protocol.updatedAt)}` : 'Документ ещё не сформирован.'}</p>
        </div>
        {actions.downloadPdf && <button type="button" disabled={busy} onClick={onPdf} className="font-bold text-eco-700">Скачать PDF</button>}
      </div>
      <div className="flex items-center justify-between gap-4 py-4">
        <div>
          <h3 className="font-black">DOCX</h3>
          <p className="mt-1 text-sm text-slate-500">{protocol.hasDocx ? `Сформирован · ${formatProtocolDateTime(protocol.updatedAt)}` : 'Документ ещё не сформирован.'}</p>
        </div>
        {actions.downloadDocx && <button type="button" disabled={busy} onClick={onDocx} className="font-bold text-eco-700">Скачать DOCX</button>}
      </div>
      <div className="flex items-center justify-between gap-4 py-4">
        <div>
          <h3 className="font-black">Подписи сотрудников</h3>
          <p className="mt-1 text-sm text-slate-500">Подписей: {protocol.signatureCount} из {protocol.maxSignatures}. Полный список показан в карточке протокола.</p>
        </div>
        {actions.sign && (
          <button type="button" disabled={busy} onClick={onSign} className="font-bold text-eco-700 disabled:cursor-not-allowed disabled:text-slate-400">
              {protocol.signedByCurrentUser ? 'Вы подписали' : 'Подписать ЭЦП'}
          </button>
        )}
      </div>
    </div>
  </section>
  );
};

export default ProtocolDocumentsTab;
