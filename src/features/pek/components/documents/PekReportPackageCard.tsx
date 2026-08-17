import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Chip, CircularProgress } from '@mui/material';
import { CheckCircle, CircleAlert, CircleDashed, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import type { PekBlobResult, PekPackageDocumentStatus, PekReport } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekApi } from '../../api/pekService';
import { mapPekError } from '../../utils/pekErrorMapper';
import PekQueryError from '../common/PekQueryError';

const missingFieldLabels: Record<string, string> = {
  laboratory: 'лабораторию', laboratoryId: 'лабораторию',
  controlPoints: 'точки контроля', monitoringPoints: 'точки контроля',
  normatives: 'нормативы', normativeIds: 'нормативы',
  responsible: 'ответственного', responsibleUserId: 'ответственного',
};
const friendlyMissingField = (field: string) => missingFieldLabels[field] || missingFieldLabels[field.split('.').pop() || ''] || field;
const saveBlob = ({ blob, filename }: PekBlobResult) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
const statusUi: Record<PekPackageDocumentStatus, { label: string; className: string; icon: typeof CheckCircle }> = {
  NOT_READY: { label: 'Не готов', className: 'text-slate-500', icon: CircleDashed },
  READY: { label: 'Готов', className: 'text-emerald-700', icon: CheckCircle },
  GENERATING: { label: 'Формируется', className: 'text-blue-700', icon: LoaderCircle },
  ERROR: { label: 'Ошибка', className: 'text-rose-700', icon: CircleAlert },
};
const backendAction = (packageActions: Record<string, boolean> | undefined, reportActions: Record<string, boolean>, action: string) =>
  packageActions?.[action] === true || (packageActions?.[action] === undefined && reportActions[action] === true);

const PekReportPackageCard = ({ report }: { report: PekReport }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = pekKeys.reportPackage(report.id, report.companyId, user?.id);
  const packageQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => pekApi.getReportPackage(report.id, signal),
    refetchInterval: (query) => query.state.data?.status === 'GENERATING' || query.state.data?.documents.some((document) => document.status === 'GENERATING') ? 2_000 : false,
  });
  const generate = useMutation({
    mutationFn: () => pekApi.generateReportPackage(report.id),
    onSuccess: async () => {
      await packageQuery.refetch();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: pekKeys.report(report.id, undefined, user?.id) }),
        queryClient.invalidateQueries({ queryKey: pekKeys.reportDocuments(report.id, report.companyId, user?.id) }),
      ]);
    },
  });
  const downloadZip = useMutation({ mutationFn: () => pekApi.downloadReportPackage(report.id), onSuccess: saveBlob });
  const downloadFile = useMutation({
    mutationFn: ({ url, filename }: { url: string; filename: string }) => pekApi.downloadReportPackageFile(report.id, url, filename),
    onSuccess: saveBlob,
  });
  const data = packageQuery.data;
  const failure = generate.error || downloadZip.error || downloadFile.error;
  const mappedFailure = failure ? mapPekError(failure) : null;
  const missingFields = [...new Set([...(data?.missingFields || []), ...(mappedFailure?.missingFields || [])].map(friendlyMissingField))];
  const canGenerate = backendAction(data?.availableActions, report.availableActions, 'generatePackage');
  const canDownloadPackage = backendAction(data?.availableActions, report.availableActions, 'downloadPackage');
  const generated = data?.downloadAvailable === true || data?.status === 'READY' || Boolean(data?.generatedAt);
  const busy = generate.isPending || downloadZip.isPending || downloadFile.isPending;

  return <section className="space-y-5 rounded-2xl border bg-white p-5">
    <div><h2 className="text-lg font-black">Комплект документов ПЭК</h2><p className="text-sm text-slate-500">Полный комплект формируется backend из отчёта и связанных протоколов.</p></div>
    {packageQuery.isLoading ? <div className="flex items-center gap-2 text-sm text-slate-500"><CircularProgress size={18} /> Загружаем состав комплекта…</div>
      : packageQuery.isError ? <PekQueryError error={packageQuery.error} resource="комплект документов ПЭК" retry={() => void packageQuery.refetch()} />
        : !data?.documents.length ? <Alert severity="info">Backend пока не включил документы в комплект. Добавьте направления мониторинга в программу.</Alert>
          : <div className="divide-y rounded-xl border">{data.documents.map((document) => {
          const documentStatus = document.status;
          const statusConfig = statusUi[documentStatus];
          const StatusIcon = statusConfig.icon;
          return <div key={document.code} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3"><StatusIcon className={`mt-0.5 h-5 w-5 shrink-0 ${statusConfig.className} ${documentStatus === 'GENERATING' ? 'animate-spin' : ''}`} /><div><p className="font-bold text-slate-900">{document.name || document.code}</p><p className={`text-xs font-semibold ${statusConfig.className}`}>{statusConfig.label}{document.errorMessage ? ` · ${document.errorMessage}` : ''}</p>{document.protocolId ? <Link className="mt-1 inline-flex text-xs font-bold text-eco-700" to={`/staff/protocols/${document.protocolId}`}>Открыть протокол {document.protocolNumber || ''}</Link> : null}</div></div>
            <div className="flex flex-wrap items-center gap-2">{document.formats.map((fileFormat) => {
              const file = document.files.find((candidate) => candidate.format === fileFormat);
              const fileCanDownload = file?.availableActions.download === true || (file?.availableActions.download === undefined && document.availableActions.download === true);
              return file?.status === 'READY' && file.downloadUrl && fileCanDownload
                ? <Button key={fileFormat} size="small" variant="outlined" disabled={busy} onClick={() => downloadFile.mutate({ url: file.downloadUrl!, filename: file.filename || `${document.code.toLowerCase()}.${fileFormat.toLowerCase()}` })}>{fileFormat}</Button>
                : <Chip key={fileFormat} size="small" label={fileFormat} variant="outlined" />;
            })}</div>
          </div>;
        })}</div>}
    {missingFields.length > 0 && <Alert severity="warning"><strong>Для формирования комплекта заполните:</strong><ul className="mt-2 list-disc pl-5">{missingFields.map((field) => <li key={field}>{field}</li>)}</ul></Alert>}
    {mappedFailure && <Alert severity="error">{mappedFailure.message}</Alert>}
    {data?.version != null || data?.generatedAt || data?.generatedBy || data?.generatedByName ? <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3"><div><span className="text-slate-500">Версия</span><p className="font-bold">{data.version != null ? `v${data.version}` : '—'}</p></div><div><span className="text-slate-500">Дата генерации</span><p className="font-bold">{data.generatedAt ? new Date(data.generatedAt).toLocaleString('ru-RU') : '—'}</p></div><div><span className="text-slate-500">Сформировал</span><p className="font-bold">{data.generatedBy?.name || data.generatedByName || '—'}</p></div></div> : null}
    <div className="flex flex-wrap gap-2">
      {canGenerate && <Button variant="contained" disabled={busy || missingFields.length > 0 || data?.status === 'GENERATING'} onClick={() => generate.mutate()}>{generate.isPending || data?.status === 'GENERATING' ? 'Формирование…' : 'Сформировать комплект ПЭК'}</Button>}
      {generated && canDownloadPackage && <Button variant="outlined" disabled={busy} onClick={() => downloadZip.mutate()}>Скачать ZIP</Button>}
    </div>
    {!canGenerate && !generated && !packageQuery.isLoading && !packageQuery.isError && <Alert severity="info">Для текущего отчёта backend не разрешил формирование комплекта.</Alert>}
  </section>;
};

export default PekReportPackageCard;
