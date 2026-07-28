import { Link } from 'react-router-dom';
import type { Protocol } from '../../../types/protocols';

const ProtocolContextLinks = ({ protocol }: { protocol: Protocol }) => {
  const rows: Array<{ label: string; value: string | number; to?: string }> = [];
  const add = (label: string, value?: string | number, to?: string) => {
    if (value !== undefined && value !== '') rows.push({ label, value, to });
  };
  add('Заявка', protocol.orderId ? protocol.orderNumber || protocol.orderId : undefined, protocol.orderId ? `/staff/orders/${protocol.orderId}` : undefined);
  add('Программа ПЭК', protocol.pekProgramId, protocol.pekProgramId ? `/staff/pek/programs/${protocol.pekProgramId}` : undefined);
  add('Отчёт ПЭК', protocol.pekReportId, protocol.pekReportId ? `/staff/pek/reports/${protocol.pekReportId}` : undefined);
  add('Контрольный пункт', protocol.pekControlItemId, protocol.pekReportId && protocol.pekControlItemId ? `/staff/pek/reports/${protocol.pekReportId}?section=PROGRAM_EXECUTION&controlItemId=${protocol.pekControlItemId}` : undefined);
  add('Контрольное событие', protocol.pekControlEventId, protocol.pekReportId && protocol.pekControlEventId ? `/staff/pek/reports/${protocol.pekReportId}?section=PROGRAM_EXECUTION&controlEventId=${protocol.pekControlEventId}` : undefined);
  add('Точка мониторинга', protocol.monitoringPointId, protocol.pekReportId && protocol.monitoringPointId ? `/staff/pek/reports/${protocol.pekReportId}?section=PROGRAM_EXECUTION&monitoringPointId=${protocol.monitoringPointId}` : undefined);
  add('Источник выброса', protocol.emissionSourceId, protocol.pekReportId && protocol.emissionSourceId ? `/staff/pek/reports/${protocol.pekReportId}?section=EMISSIONS&emissionSourceId=${protocol.emissionSourceId}` : undefined);
  add('Выпуск воды', protocol.waterOutletId, protocol.pekReportId && protocol.waterOutletId ? `/staff/pek/reports/${protocol.pekReportId}?section=WATER&waterOutletId=${protocol.waterOutletId}` : undefined);
  if (!rows.length) return null;
  return (
    <section className="rounded-2xl border border-eco-200 bg-eco-50/50 p-5">
      <h2 className="font-black text-slate-950">Связи</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {rows.map((row) => row.to
          ? <Link key={row.label} to={row.to} className="rounded-full border border-eco-200 bg-white px-4 py-2 text-sm font-bold text-eco-800">{row.label}: {row.value}</Link>
          : <span key={row.label} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">{row.label}: {row.value}</span>)}
      </div>
    </section>
  );
};

export default ProtocolContextLinks;
