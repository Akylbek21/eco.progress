import type { Protocol } from '../../../types/protocols';
import { formatProtocolDateTime, humanHistoryAction } from './protocolDetailsModel';

const ProtocolHistoryTab = ({ protocol }: { protocol: Protocol }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-black">История действий</h2>
    {!protocol.history?.length ? <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">История действий пока пуста.</p> : <ol className="mt-5 space-y-4">{protocol.history.map((item) => <li key={item.id} className="relative border-l-2 border-eco-100 pl-5"><span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-eco-500" /><time className="text-xs font-semibold text-slate-500">{formatProtocolDateTime(item.createdAt)}</time><p className="mt-1 font-black text-slate-900">{humanHistoryAction(item)}</p><p className="text-sm text-slate-600">{item.actorName || 'Система'}</p>{item.comment && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Причина: {item.comment}</p>}</li>)}</ol>}
  </section>
);

export default ProtocolHistoryTab;
