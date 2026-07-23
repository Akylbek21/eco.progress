import type { Protocol, ProtocolResult } from '../../../types/protocols';
import { complianceClass, complianceLabel, resultDeviceName, resultIndicator, resultNormative, resultValue } from './protocolDetailsModel';

type Props = { protocol: Protocol; editable: boolean; onEdit: () => void };
const unit = (row: ProtocolResult) => String(row.unit || row.values.unit || '');
const comparison = (row: ProtocolResult) => ({ LESS_OR_EQUAL: '≤', GREATER_OR_EQUAL: '≥', EQUAL: '=', RANGE: '' }[String(row.comparisonType || row.values.comparisonType || '')] || '');
const status = (row: ProtocolResult) => row.internalStatus || row.checkStatus || row.calculationStatus;

const Details = ({ row }: { row: ProtocolResult }) => (
  <details className="mt-2 text-xs text-slate-600">
    <summary className="cursor-pointer font-bold text-eco-700">Подробнее</summary>
    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
      {[
        ['Код вещества', row.code || row.values.pollutantCode || row.values.code],
        ['CAS', row.pollutant?.cas || row.values.cas || row.values.casNumber],
        ['Формула', row.pollutant?.formula || row.values.formula || row.values.chemicalFormula],
        ['Место отбора', row.measurementPlace || row.values.samplingPlace],
        ['Методика', row.testingMethodNd || row.testingMethodDocument || row.testingMethod || row.values.testingMethodNd],
        ['Примечание', row.comment || row.values.note || row.values.notes],
      ].filter(([, value]) => value).map(([label, value]) => <div key={String(label)}><dt className="text-slate-400">{label}</dt><dd className="font-semibold text-slate-700">{String(value)}</dd></div>)}
    </dl>
  </details>
);

const ProtocolResultsTab = ({ protocol, editable, onEdit }: Props) => (
  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
      <div><h2 className="text-lg font-black">Результаты измерений</h2><p className="mt-1 text-sm text-slate-500">{protocol.results.length ? `${protocol.results.length} показателей` : 'Результаты ещё не добавлены.'}</p></div>
      {editable && <button type="button" onClick={onEdit} className="rounded-xl border border-eco-200 px-4 py-2 text-sm font-bold text-eco-800 hover:bg-eco-50">Изменить</button>}
    </div>
    {!protocol.results.length ? <p className="p-8 text-center text-sm text-slate-500">Добавьте результаты измерений, чтобы продолжить работу.</p> : (
      <>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">№</th><th className="px-4 py-3">Показатель</th><th className="px-4 py-3 text-right">Результат</th><th className="px-4 py-3 text-right">Норматив</th><th className="px-4 py-3">Статус</th><th className="px-4 py-3">Прибор</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{protocol.results.map((row, index) => <tr key={row.id || index} className="align-top"><td className="px-4 py-4 font-bold">{index + 1}</td><td className="px-4 py-4 font-semibold">{resultIndicator(row)}<Details row={row} /></td><td className="px-4 py-4 text-right font-bold">{resultValue(row)} {unit(row)}</td><td className="px-4 py-4 text-right">{comparison(row)} {resultNormative(row)} {unit(row)}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${complianceClass(status(row))}`}>{complianceLabel(status(row))}</span></td><td className="px-4 py-4">{resultDeviceName(protocol, row)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="space-y-3 p-4 md:hidden">{protocol.results.map((row, index) => <article key={row.id || index} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-slate-400">Показатель {index + 1}</p><h3 className="mt-1 font-black">{resultIndicator(row)}</h3></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${complianceClass(status(row))}`}>{complianceLabel(status(row))}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Результат</dt><dd className="font-bold">{resultValue(row)} {unit(row)}</dd></div><div><dt className="text-slate-500">Норматив</dt><dd className="font-semibold">{comparison(row)} {resultNormative(row)} {unit(row)}</dd></div><div className="col-span-2"><dt className="text-slate-500">Прибор</dt><dd className="font-semibold">{resultDeviceName(protocol, row)}</dd></div></dl><Details row={row} /></article>)}</div>
      </>
    )}
  </section>
);

export default ProtocolResultsTab;
