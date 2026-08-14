import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button } from '@mui/material';
import { useAuth } from '../../../../contexts/AuthContext';
import { createCmsSignatureWithNCALayer } from '../../../../services/ncalayer';
import type { PekBlobResult, PekReport } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekApi } from '../../api/pekService';
import { mapPekError } from '../../utils/pekErrorMapper';

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

const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Не удалось прочитать PDF отчёта для подписи.'));
  reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
  reader.readAsDataURL(blob);
});

const actionEnabled = (report: PekReport, ...names: string[]) =>
  names.some((name) => report.availableActions[name] === true);

const PekReportDocuments = ({ report }: { report: PekReport }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const reportKey = pekKeys.report(report.id, undefined, user?.id);
  const versionsKey = pekKeys.reportDocuments(report.id, report.companyId, user?.id);
  const signaturesKey = pekKeys.reportSignatures(report.id, report.companyId, user?.id);
  const versions = useQuery({ queryKey: versionsKey, queryFn: ({ signal }) => pekApi.getReportDocumentVersions(report.id, signal) });
  const signatures = useQuery({ queryKey: signaturesKey, queryFn: ({ signal }) => pekApi.getReportSignatures(report.id, signal) });
  const [staleVersionIds, setStaleVersionIds] = useState<number[]>([]);
  const sortedVersions = [...(versions.data || [])].sort((left, right) => right.version - left.version);
  const latestVersionId = sortedVersions[0]?.id;

  const refreshReport = async () => {
    const actual = await pekApi.getReport(report.id);
    queryClient.setQueryData(reportKey, actual);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: versionsKey }),
      queryClient.invalidateQueries({ queryKey: signaturesKey }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportsRoot(report.companyId, user?.id) }),
    ]);
    return actual;
  };

  const generate = useMutation({
    mutationFn: async (format: 'docx' | 'pdf') => {
      if (format === 'docx') await pekApi.generateReportDocx(report.id);
      else await pekApi.generateReportPdf(report.id);
      return refreshReport();
    },
    onError: (failure) => {
      const mapped = mapPekError(failure);
      if (mapped.status === 409 || mapped.status === 412) void refreshReport();
    },
  });
  const download = useMutation({
    mutationFn: (format: 'docx' | 'pdf') => pekApi.downloadReportDocument(report.id, format),
    onSuccess: saveBlob,
    onError: (failure) => {
      const mapped = mapPekError(failure);
      if (/STALE|OUTDATED/i.test(mapped.code || '') && latestVersionId) {
        setStaleVersionIds((current) => current.includes(latestVersionId) ? current : [...current, latestVersionId]);
      }
      if (mapped.status === 409 || mapped.status === 412) void refreshReport();
    },
  });
  const sign = useMutation({
    mutationFn: async () => {
      const pdf = await pekApi.downloadReportDocument(report.id, 'pdf');
      const cms = await createCmsSignatureWithNCALayer(await blobToBase64(pdf.blob));
      await pekApi.signReportDocument(report.id, cms);
      return refreshReport();
    },
    onError: (failure) => {
      const mapped = mapPekError(failure);
      if (mapped.status === 409 || mapped.status === 412) void refreshReport();
    },
  });

  const canGenerateDocx = actionEnabled(report, 'generateDocx', 'generateDocument');
  const canGeneratePdf = actionEnabled(report, 'generatePdf', 'generateDocument');
  const canDownloadDocx = report.availableActions.downloadDocx === true;
  const canDownloadPdf = report.availableActions.downloadPdf === true;
  const canSign = report.availableActions.sign === true;
  const hasActions = canGenerateDocx || canGeneratePdf || canDownloadDocx || canDownloadPdf || canSign;
  const busy = generate.isPending || download.isPending || sign.isPending;
  const error = generate.error || download.error || sign.error;
  const failure = error ? mapPekError(error) : null;

  return <section className="space-y-5 rounded-2xl border bg-white p-5">
    <div>
      <h2 className="font-black">Документы отчёта ПЭК</h2>
      <p className="text-sm text-slate-500">Формирование, скачивание и подписание выполняются на сервере.</p>
    </div>
    {failure && <Alert severity="error"><strong>{failure.code}</strong>: {failure.message}{Object.entries(failure.fieldErrors).map(([field, message]) => <div key={field}>{field}: {message}</div>)}</Alert>}
    {versions.isError && <Alert severity="error" action={<Button size="small" onClick={() => void versions.refetch()}>Повторить</Button>}>Не удалось загрузить версии документов.</Alert>}
    {signatures.isError && <Alert severity="error" action={<Button size="small" onClick={() => void signatures.refetch()}>Повторить</Button>}>Не удалось загрузить подписи.</Alert>}
    <div className="flex flex-wrap gap-2">
      {canGenerateDocx && <Button variant="outlined" disabled={busy} onClick={() => generate.mutate('docx')}>Сформировать DOCX</Button>}
      {canGeneratePdf && <Button variant="contained" disabled={busy} onClick={() => generate.mutate('pdf')}>Сформировать PDF</Button>}
      {canDownloadDocx && <Button variant="outlined" disabled={busy} onClick={() => download.mutate('docx')}>Скачать DOCX</Button>}
      {canDownloadPdf && <Button variant="outlined" disabled={busy} onClick={() => download.mutate('pdf')}>Скачать PDF</Button>}
      {canSign && <Button color="success" variant="contained" disabled={busy} onClick={() => sign.mutate()}>Подписать</Button>}
    </div>
    {!hasActions && <Alert severity="info">Для текущего статуса отчёта backend не разрешил действий с документами.</Alert>}
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-slate-50 text-left"><tr><th className="p-3">Версия</th><th>Дата генерации</th><th>Автор</th><th>Статус</th><th>DOCX</th><th>PDF</th><th>Скачивание</th></tr></thead>
        <tbody>{versions.isLoading ? <tr><td className="p-4 text-slate-500" colSpan={7}>Загрузка версий…</td></tr> : sortedVersions.map((version) => { const stale = version.stale === true || /STALE|OUTDATED/i.test(version.status || '') || staleVersionIds.includes(version.id); return <tr key={version.id} className="border-t"><td className="p-3 font-bold">v{version.version}</td><td>{version.generatedAt || '—'}</td><td>{version.generatedByName || (version.generatedBy ? `Сотрудник №${version.generatedBy}` : '—')}</td><td>{stale ? 'Устарел' : version.status || (version.id === latestVersionId ? 'Актуальная' : 'Архивная')}</td><td>{version.hasDocx ? 'Есть' : 'Нет'}</td><td>{version.hasPdf ? 'Есть' : 'Нет'}</td><td><div className="flex gap-2">{version.id === latestVersionId && !stale && version.hasDocx && canDownloadDocx && <Button size="small" disabled={busy} onClick={() => download.mutate('docx')}>Скачать DOCX</Button>}{version.id === latestVersionId && !stale && version.hasPdf && canDownloadPdf && <Button size="small" disabled={busy} onClick={() => download.mutate('pdf')}>Скачать PDF</Button>}</div></td></tr>; })}</tbody>
      </table>
      {!versions.isLoading && !versions.isError && !sortedVersions.length && <p className="p-4 text-sm text-slate-500">Документы ещё не сформированы.</p>}
    </div>
    <div>
      <h3 className="font-bold">Подписи</h3>
      {signatures.isLoading ? <p className="mt-2 text-sm text-slate-500">Загрузка подписей…</p> : !signatures.data?.length ? <p className="mt-2 text-sm text-slate-500">Подписей пока нет.</p> : <div className="mt-2 overflow-x-auto rounded-xl border"><table className="w-full min-w-[820px] text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Подписант</th><th>Дата подписания</th><th>Сертификат</th><th>Организация</th><th>Статус</th></tr></thead><tbody>{signatures.data.map((signature) => <tr key={signature.id} className="border-t"><td className="p-3 font-semibold">{signature.certificateCn || signature.certificateSubject || `Сотрудник №${signature.signerUserId}`}</td><td>{signature.signedAt || '—'}</td><td>{signature.certificateSerial || signature.certificateSubject || '—'}</td><td>{signature.certificateOrganization || '—'}</td><td>{signature.verified ? 'Подпись проверена' : 'Не подтверждена'}</td></tr>)}</tbody></table></div>}
    </div>
  </section>;
};

export default PekReportDocuments;
