import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, CircularProgress } from '@mui/material';
import { useAuth } from '../../../../contexts/AuthContext';
import type { PekBlobResult, PekReport } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekApi } from '../../api/pekService';
import { mapPekError } from '../../utils/pekErrorMapper';
import PekQueryError from '../common/PekQueryError';

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

const missingFieldLabels: Record<string, string> = {
  laboratoryId: 'лабораторию',
  responsibleUserId: 'ответственного',
  controlItemIds: 'объекты контроля',
};
const friendlyMissingField = (field: string) => missingFieldLabels[field] || field;

const PekReportPackageCard = ({ report }: { report: PekReport }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = pekKeys.reportPackage(report.id, report.companyId, user?.id);
  const packageQuery = useQuery({ queryKey, queryFn: ({ signal }) => pekApi.getReportPackage(report.id, signal) });
  const generate = useMutation({
    mutationFn: () => pekApi.generateReportPackage(report.id, report.version),
    onSuccess: async () => {
      await Promise.all([
        packageQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: pekKeys.report(report.id, undefined, user?.id) }),
        queryClient.invalidateQueries({ queryKey: pekKeys.reportDocuments(report.id, report.companyId, user?.id) }),
      ]);
    },
    onError: async (error) => {
      const mapped = mapPekError(error);
      if (mapped.status === 409 || mapped.status === 412) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: pekKeys.report(report.id, undefined, user?.id) }),
          packageQuery.refetch(),
        ]);
      }
    },
  });
  const download = useMutation({ mutationFn: () => pekApi.downloadReportPackage(report.id), onSuccess: saveBlob });

  if (packageQuery.isLoading) return <section className="rounded-2xl border bg-white p-5"><div className="flex items-center gap-2 text-sm text-slate-500"><CircularProgress size={18} /> Загрузка комплекта ПЭК…</div></section>;
  if (packageQuery.isError) return <section className="rounded-2xl border bg-white p-5"><PekQueryError error={packageQuery.error} resource="комплект ПЭК" retry={() => void packageQuery.refetch()} /></section>;

  if (!packageQuery.data) {
    const canGenerate = report.availableActions.generatePackage === true;
    return <section className="space-y-4 rounded-2xl border bg-white p-5">
      <div><h2 className="text-lg font-black">Комплект документов ПЭК</h2><p className="text-sm text-slate-500">Комплект ещё не сформирован.</p></div>
      {generate.error && <Alert severity="error">{mapPekError(generate.error).message}</Alert>}
      {canGenerate && <Button variant="contained" disabled={generate.isPending} onClick={() => generate.mutate()}>{generate.isPending ? 'Формирование…' : 'Сформировать комплект ПЭК'}</Button>}
    </section>;
  }

  const data = packageQuery.data;
  const failure = generate.error || download.error;
  const mappedFailure = failure ? mapPekError(failure) : null;
  const missingFields = [...new Set([...(data.missingFields || []), ...(mappedFailure?.missingFields || [])])].map(friendlyMissingField);
  const canGenerate = data.availableActions.generatePackage === true;
  const canDownload = data.availableActions.downloadPackage === true;
  const busy = generate.isPending || download.isPending;

  return <section className="space-y-5 rounded-2xl border bg-white p-5">
    <div><h2 className="text-lg font-black">Комплект документов ПЭК</h2><p className="text-sm text-slate-500">Комплект сформирован на основе ревизии данных отчёта.</p></div>
    {mappedFailure && <Alert severity="error">{mappedFailure.message}</Alert>}
    {missingFields.length > 0 && <Alert severity="warning"><strong>Для формирования комплекта заполните:</strong><ul className="mt-2 list-disc pl-5">{missingFields.map((field) => <li key={field}>{field}</li>)}</ul></Alert>}

    <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-4">
      <div><span className="text-slate-500">Версия документа</span><p className="font-bold">v{data.documentVersion}</p></div>
      <div><span className="text-slate-500">Ревизия данных</span><p className="font-bold">{data.sourceContentRevision}</p></div>
      <div><span className="text-slate-500">Дата генерации</span><p className="font-bold">{data.generatedAt ? new Date(data.generatedAt).toLocaleString('ru-RU') : '—'}</p></div>
      <div><span className="text-slate-500">Сформировал</span><p className="font-bold">{typeof data.generatedBy === 'string' ? data.generatedBy : typeof data.generatedBy === 'number' ? `Сотрудник №${data.generatedBy}` : data.generatedBy?.name || '—'}</p></div>
    </div>

    <div><h3 className="font-bold">Файлы</h3>{data.files.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{data.files.map((file) => <li key={file}>{file}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">Файлы ещё не сформированы.</p>}</div>

    <div className="flex flex-wrap gap-2">
      {canGenerate && <Button variant="contained" disabled={busy || missingFields.length > 0} onClick={() => generate.mutate()}>Сформировать комплект ПЭК</Button>}
      {canDownload && <Button variant="outlined" disabled={busy || !data.downloadAvailable} onClick={() => download.mutate()}>Скачать ZIP</Button>}
    </div>
  </section>;
};

export default PekReportPackageCard;
