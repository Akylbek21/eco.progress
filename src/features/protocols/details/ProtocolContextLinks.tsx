import { Link } from 'react-router-dom';
import type { Protocol } from '../../../types/protocols';

const ProtocolContextLinks = ({ protocol }: { protocol: Protocol }) => {
  const rows: Array<{ label: string; value: string | number; to?: string }> = [];
  const add = (label: string, value?: string | number, to?: string) => {
    if (value !== undefined && value !== '') rows.push({ label, value, to });
  };
  add('Заявка', protocol.orderId ? protocol.orderNumber || protocol.orderId : undefined, protocol.orderId ? `/staff/orders/${protocol.orderId}` : undefined);
  const pekLinks = protocol.pekLinks || protocol.pekConnections || [];
  add('Исправление протокола №', protocol.replacesProtocolId);
  add('Заменён исправлением №', protocol.replacedByProtocolId);
  if (!rows.length && !pekLinks.length) return null;

  return (
    <section className="rounded-2xl border border-eco-200 bg-eco-50/50 p-5">
      <h2 className="font-black text-slate-950">Связь с ПЭК</h2>
      {pekLinks.length > 0 && <div className="mt-3 space-y-3">{pekLinks.map((pek, index) => {
        const query = new URLSearchParams({
          tab: 'sources',
          protocolId: String(protocol.id),
          ...(pek.controlItemId ? { controlItemId: String(pek.controlItemId) } : {}),
          ...(pek.monitoringPointId ? { monitoringPointId: String(pek.monitoringPointId) } : {}),
          ...(pek.programIndicatorId ? { programIndicatorId: String(pek.programIndicatorId) } : {}),
        });
        return <article key={`${pek.id || pek.reportId || pek.programId}-${index}`} className="rounded-xl border bg-white p-4 text-sm">
          <p><strong>Программа:</strong> {pek.programNumber || `Программа №${pek.programId}`}</p>
          <p><strong>Отчёт:</strong> {pek.reportId ? pek.reportName || pek.reportPeriod || `Отчёт №${pek.reportId}` : 'ещё не сформирован'}</p>
          <p><strong>Контроль:</strong> {pek.controlItemName || pek.controlItemId || '—'}</p>
          <p><strong>Точка:</strong> {pek.monitoringPointName || pek.monitoringPointId || '—'}</p>
          {pek.programIndicatorId && <p><strong>Показатель:</strong> {pek.programIndicatorId}</p>}
          {pek.reportId && <Link className="mt-3 inline-block font-bold text-eco-700" to={`/staff/pek/reports/${pek.reportId}?${query}`}>Открыть отчёт ПЭК</Link>}
        </article>;
      })}</div>}
      <div className="mt-3 flex flex-wrap gap-2">
        {rows.map((row) => row.to
          ? <Link key={row.label} to={row.to} className="rounded-full border border-eco-200 bg-white px-4 py-2 text-sm font-bold text-eco-800">{row.label}: {row.value}</Link>
          : <span key={row.label} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">{row.label}: {row.value}</span>)}
      </div>
    </section>
  );
};

export default ProtocolContextLinks;
