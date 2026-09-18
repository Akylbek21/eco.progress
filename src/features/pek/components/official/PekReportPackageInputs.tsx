import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, MenuItem, TextField } from '@mui/material';
import type { PekEmissionBalanceRequest, PekMeasureExecutionRequest, PekReport, PekReportGeneralUpdate } from '../../api/pekContracts';
import { pekApi } from '../../api/pekService';
import { mapPekError } from '../../utils/pekErrorMapper';

const numberOrNull = (value: string) => value === '' ? null : Number(value);
const saveBlob = ({ blob, filename }: Awaited<ReturnType<typeof pekApi.downloadOperationExplanation>>) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
};

export default function PekReportPackageInputs({ report }: { report: PekReport }) {
  const queryClient = useQueryClient();
  const editable = report.availableActions.edit === true;
  const [general, setGeneral] = useState<PekReportGeneralUpdate>({});
  const measures = useQuery({ queryKey: ['pek', 'report', report.id, 'measure-executions'], queryFn: ({ signal }) => pekApi.getMeasureExecutions(report.id, signal) });
  const balances = useQuery({ queryKey: ['pek', 'report', report.id, 'emission-balances'], queryFn: ({ signal }) => pekApi.getEmissionBalances(report.id, signal) });
  const [measureRows, setMeasureRows] = useState<PekMeasureExecutionRequest[]>([]);
  const [balanceRows, setBalanceRows] = useState<PekEmissionBalanceRequest[]>([]);
  useEffect(() => setGeneral({
    actualCapacity: report.actualCapacity,
    actualCapacityUnit: report.actualCapacityUnit,
    performedStudies: report.explanatoryNote?.performedStudies,
    monitoringResultsSummary: report.explanatoryNote?.monitoringResultsSummary,
    exceedancesSummary: report.explanatoryNote?.exceedancesSummary,
    measuresTaken: report.explanatoryNote?.measuresTaken,
    conclusion: report.explanatoryNote?.conclusion,
    operationStatus: report.operationStatus?.status as PekReportGeneralUpdate['operationStatus'] || 'OPERATING',
    operationStatusReason: report.operationStatus?.reason,
  }), [report]);
  useEffect(() => setMeasureRows((measures.data || []).map(({ measureId, actualAmount, completionPercent, status, note, nonCompletionReason }) => ({ measureId, actualAmount, completionPercent, status, note, nonCompletionReason }))), [measures.data]);
  useEffect(() => setBalanceRows((balances.data || []).map(({ emissionSourceId, substanceCode, withoutTreatmentTons, capturedTons, utilizedTons, increaseReason }) => ({ emissionSourceId, substanceCode, withoutTreatmentTons, capturedTons, utilizedTons, increaseReason }))), [balances.data]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['pek'] });
  const saveGeneral = useMutation({ mutationFn: () => pekApi.updateReportGeneral(report.id, report.version, general), onSuccess: refresh });
  const saveMeasures = useMutation({ mutationFn: () => pekApi.saveMeasureExecutions(report.id, report.version, measureRows), onSuccess: refresh });
  const saveBalances = useMutation({ mutationFn: () => pekApi.saveEmissionBalances(report.id, report.version, balanceRows), onSuccess: refresh });
  const uploadExplanation = useMutation({ mutationFn: (file: File) => pekApi.uploadOperationExplanation(report.id, report.version, file), onSuccess: refresh });
  const downloadExplanation = useMutation({ mutationFn: () => pekApi.downloadOperationExplanation(report.id), onSuccess: saveBlob });
  const error = saveGeneral.error || saveMeasures.error || saveBalances.error || uploadExplanation.error || downloadExplanation.error;
  const setGeneralField = <K extends keyof PekReportGeneralUpdate>(key: K, value: PekReportGeneralUpdate[K]) => setGeneral((current) => ({ ...current, [key]: value }));
  const notOperating = general.operationStatus !== 'OPERATING';
  return <div className="space-y-5">
    {error && <Alert severity="error">{mapPekError(error).message}</Alert>}
    <section className="space-y-4 rounded-2xl border bg-white p-5">
      <div><h2 className="font-black">Сведения отчётного периода</h2><p className="text-sm text-slate-500">Статус работы объекта и разделы пояснительной записки.</p></div>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="Фактическая мощность" value={general.actualCapacity || ''} disabled={!editable} onChange={(event) => setGeneralField('actualCapacity', event.target.value || null)} />
        <TextField label="Единица мощности" value={general.actualCapacityUnit || ''} disabled={!editable} onChange={(event) => setGeneralField('actualCapacityUnit', event.target.value || null)} />
        <TextField select label="Работа объекта" value={general.operationStatus || 'OPERATING'} disabled={!editable} onChange={(event) => setGeneralField('operationStatus', event.target.value as PekReportGeneralUpdate['operationStatus'])}><MenuItem value="OPERATING">Работал</MenuItem><MenuItem value="NOT_OPERATING">Не работал</MenuItem><MenuItem value="TEMPORARILY_SUSPENDED">Временно остановлен</MenuItem></TextField>
        <TextField label="Причина простоя" value={general.operationStatusReason || ''} required={notOperating} disabled={!editable || !notOperating} onChange={(event) => setGeneralField('operationStatusReason', event.target.value || null)} />
        {[['performedStudies', 'Проведённые исследования'], ['monitoringResultsSummary', 'Результаты мониторинга'], ['exceedancesSummary', 'Превышения'], ['measuresTaken', 'Принятые меры'], ['conclusion', 'Заключение']].map(([key, label]) => <TextField key={key} className="md:col-span-2" multiline minRows={2} label={label} value={String(general[key as keyof PekReportGeneralUpdate] || '')} disabled={!editable} onChange={(event) => setGeneralField(key as keyof PekReportGeneralUpdate, event.target.value || null)} />)}
      </div>
      {notOperating && <div className="flex flex-wrap items-center gap-3"><Button component="label" variant="outlined" disabled={!editable || uploadExplanation.isPending}>Прикрепить пояснение<input hidden type="file" accept="application/pdf" onChange={(event) => event.target.files?.[0] && uploadExplanation.mutate(event.target.files[0])} /></Button>{report.operationStatus?.explanationFileAttached && <Button onClick={() => downloadExplanation.mutate()}>Скачать {report.operationStatus.explanationFileName || 'пояснение'}</Button>}</div>}
      {editable && <Button variant="contained" disabled={saveGeneral.isPending || (notOperating && !general.operationStatusReason?.trim())} onClick={() => saveGeneral.mutate()}>Сохранить сведения</Button>}
    </section>
    <section className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-black">Выполнение природоохранных мероприятий</h2>{measures.isLoading ? <p>Загрузка…</p> : !measures.data?.length ? <p className="text-sm text-slate-500">В программе нет мероприятий.</p> : <div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-sm"><thead><tr><th>Мероприятие</th><th>План</th><th>Факт</th><th>Выполнение, %</th><th>Статус</th><th>Причина невыполнения</th></tr></thead><tbody>{measures.data.map((row, index) => <tr key={row.measureId} className="border-t"><td className="p-2"><b>{row.code}</b> {row.name}</td><td>{row.plannedAmount ?? '—'} {row.currency}</td><td><input className="w-28 rounded border p-2" type="number" disabled={!editable} value={measureRows[index]?.actualAmount ?? ''} onChange={(event) => setMeasureRows((current) => current.map((item, i) => i === index ? { ...item, actualAmount: numberOrNull(event.target.value) } : item))} /></td><td><input className="w-24 rounded border p-2" type="number" min="0" max="100" disabled={!editable} value={measureRows[index]?.completionPercent ?? ''} onChange={(event) => setMeasureRows((current) => current.map((item, i) => i === index ? { ...item, completionPercent: numberOrNull(event.target.value) } : item))} /></td><td><input className="rounded border p-2" disabled={!editable} value={measureRows[index]?.status || ''} onChange={(event) => setMeasureRows((current) => current.map((item, i) => i === index ? { ...item, status: event.target.value || null } : item))} /></td><td><input className="min-w-64 rounded border p-2" disabled={!editable} value={measureRows[index]?.nonCompletionReason || ''} onChange={(event) => setMeasureRows((current) => current.map((item, i) => i === index ? { ...item, nonCompletionReason: event.target.value || null } : item))} /></td></tr>)}</tbody></table></div>}{editable && measureRows.length > 0 && <Button variant="contained" disabled={saveMeasures.isPending} onClick={() => saveMeasures.mutate()}>Сохранить выполнение</Button>}</section>
    <section className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-black">Баланс выбросов</h2>{balances.isLoading ? <p>Загрузка…</p> : !balances.data?.length ? <p className="text-sm text-slate-500">Строки выбросов отсутствуют.</p> : <div className="overflow-x-auto"><table className="min-w-[1100px] w-full text-sm"><thead><tr><th>Источник / вещество</th><th>Без очистки, т</th><th>Уловлено, т</th><th>Утилизировано, т</th><th>Причина увеличения</th></tr></thead><tbody>{balances.data.map((row, index) => <tr key={`${row.emissionSourceId}-${row.substanceCode}`} className="border-t"><td className="p-2"><b>{row.sourceCode}</b> {row.sourceName}<br />{row.substanceName}</td>{(['withoutTreatmentTons', 'capturedTons', 'utilizedTons'] as const).map((key) => <td key={key}><input className="w-28 rounded border p-2" type="number" disabled={!editable} value={balanceRows[index]?.[key] ?? ''} onChange={(event) => setBalanceRows((current) => current.map((item, i) => i === index ? { ...item, [key]: numberOrNull(event.target.value) } : item))} /></td>)}<td><input className="min-w-72 rounded border p-2" required={row.increaseReasonRequired} disabled={!editable} value={balanceRows[index]?.increaseReason || ''} onChange={(event) => setBalanceRows((current) => current.map((item, i) => i === index ? { ...item, increaseReason: event.target.value || null } : item))} /></td></tr>)}</tbody></table></div>}{editable && balanceRows.length > 0 && <Button variant="contained" disabled={saveBalances.isPending} onClick={() => saveBalances.mutate()}>Сохранить баланс</Button>}</section>
  </div>;
}
