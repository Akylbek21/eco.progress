import { FlaskConical, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { Protocol } from '../../types/protocols';
import { getProtocolResultColumns, subtypeName, templateName } from '../../data/protocolTemplates';

type Props = {
  open: boolean;
  loading?: boolean;
  previewUrl?: string;
  protocol?: Protocol | null;
  draft?: boolean;
  onClose: () => void;
};

const value = (raw: unknown) => raw === undefined || raw === null || raw === '' ? '—' : String(raw);

const ProtocolPreviewModal = ({ open, loading = false, protocol, draft = false, onClose }: Props) => {
  if (!open) return null;
  const landscape = protocol?.templateId === 'industrial_emissions';
  const columns = protocol ? getProtocolResultColumns(protocol.templateId, protocol.subtype) : [];

  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950/80">
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-4 py-3 text-white sm:px-6">
        <div>
          <p className="text-sm font-bold">Официальный предпросмотр</p>
          <p className="text-xs text-white/60">{landscape ? 'Альбомный A4' : 'Книжный A4'} · макет без юридической силы</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-white/10" aria-label="Закрыть предпросмотр"><X className="h-5 w-5" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-8">
        {loading && <div className="mx-auto flex h-80 max-w-5xl items-center justify-center bg-white text-sm font-semibold text-slate-500">Формирование предпросмотра…</div>}
        {!loading && protocol && (
          <article className={`relative mx-auto min-h-[1120px] bg-white p-8 text-[11px] leading-snug text-slate-950 shadow-2xl sm:p-12 ${landscape ? 'w-[1120px] min-w-[1120px]' : 'w-[794px] min-w-[794px]'}`}>
            {draft && <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"><span className="-rotate-12 text-8xl font-black uppercase tracking-[0.2em] text-slate-100">Черновик</span></div>}
            <header className="relative grid grid-cols-[90px_1fr_180px] items-center border-b-2 border-slate-900 pb-4">
              <div className="flex h-16 w-16 items-center justify-center border-2 border-emerald-800 text-emerald-800"><FlaskConical className="h-9 w-9" /></div>
              <div className="text-center">
                <p className="text-sm font-black uppercase">{protocol.laboratory.laboratoryName}</p>
                <p className="mt-1">{protocol.laboratory.laboratoryAddress}</p>
                <p className="mt-1 font-bold">Аттестат аккредитации № {protocol.laboratory.accreditationNumber}</p>
              </div>
              <div className="border border-slate-700 p-2 text-center">
                <p className="font-bold">Форма</p>
                <p>{templateName(protocol.templateId)}</p>
                <p className="mt-1">Редакция 01</p>
              </div>
            </header>

            <section className="relative mt-7 text-center">
              <h1 className="text-xl font-black uppercase tracking-wide">Протокол испытаний</h1>
              <p className="mt-2 text-base font-bold">№ {protocol.protocolNumber} от {protocol.protocolDate}</p>
              {protocol.subtype && <p className="mt-1 font-bold">{subtypeName(protocol.subtype)}</p>}
            </section>

            <section className="relative mt-7 grid grid-cols-2 border border-slate-800">
              {[
                ['Заказчик', protocol.companySnapshot.companyName],
                ['БИН', protocol.companySnapshot.bin],
                ['Адрес заказчика', protocol.companySnapshot.actualAddress || protocol.companySnapshot.legalAddress],
                ['Объект испытаний', protocol.companySnapshot.objectName],
                ['Адрес объекта', protocol.companySnapshot.objectAddress],
                ['Наименование продукции', protocol.organization.productName],
                ['Основание испытаний', protocol.organization.testingBasis],
                ['Цель испытаний', protocol.testing.testingPurpose],
                ['Дата отбора', protocol.testing.samplingDate],
                ['Период испытаний', `${protocol.testing.testingStartDate || '—'} — ${protocol.testing.testingEndDate || '—'}`],
              ].map(([label, content]) => (
                <div key={label} className="grid grid-cols-[150px_1fr] border-b border-r border-slate-500 p-2">
                  <span className="font-bold">{label}</span><span>{value(content)}</span>
                </div>
              ))}
            </section>

            <section className="relative mt-6">
              <h2 className="mb-2 text-center text-sm font-black uppercase">Результаты испытаний</h2>
              <table className="w-full border-collapse">
                <thead>
                  <tr>{columns.map((column) => <th key={column.key} className="border border-slate-800 bg-slate-100 px-1.5 py-2 font-bold">{column.label}</th>)}</tr>
                </thead>
                <tbody>
                  {protocol.results.map((row) => (
                    <tr key={row.id}>{columns.map((column) => <td key={column.key} className="border border-slate-700 px-1.5 py-2 text-center">{value(row.values[column.key])}</td>)}</tr>
                  ))}
                  {!protocol.results.length && <tr><td colSpan={columns.length || 1} className="border border-slate-700 p-8 text-center text-slate-500">Результаты не внесены</td></tr>}
                </tbody>
              </table>
            </section>

            <section className="relative mt-6 grid grid-cols-2 gap-5">
              <div className="border border-slate-700 p-3">
                <p className="font-bold">Условия окружающей среды</p>
                <p className="mt-2">Температура: {value(protocol.environment?.temperature)} °C</p>
                <p>Влажность: {value(protocol.environment?.humidity)} %</p>
                <p>Давление: {value(protocol.environment?.pressureKpa)} кПа</p>
                <p>Скорость ветра: {value(protocol.environment?.windSpeed)} м/с</p>
              </div>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-[130px_1fr]"><span className="font-bold">Исполнитель:</span><span className="border-b border-slate-700">{protocol.laboratory.executor}</span></div>
                <div className="grid grid-cols-[130px_1fr]"><span className="font-bold">Заведующий ИЛ:</span><span className="border-b border-slate-700">{protocol.laboratory.laboratoryHead}</span></div>
              </div>
            </section>

            <footer className="absolute bottom-8 left-12 right-12 border-t border-slate-700 pt-3 text-[9px]">
              <p>Результаты испытаний относятся только к представленным объектам и пробам. Частичное воспроизведение протокола без письменного разрешения испытательной лаборатории не допускается.</p>
              <p className="mt-1 font-bold text-rose-700">Демонстрационный макет. Не является официальным документом.</p>
            </footer>
          </article>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default ProtocolPreviewModal;
