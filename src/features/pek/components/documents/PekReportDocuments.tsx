import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button } from '@mui/material';
import { useAuth } from '../../../../contexts/AuthContext';
import { createCmsSignatureWithNCALayer } from '../../../../services/ncalayer';
import type { PekBlobResult, PekDocumentVersion, PekReport } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekApi } from '../../api/pekService';
import { mapPekError } from '../../utils/pekErrorMapper';
import { handlePekMutationError } from '../../utils/pekMutationError';

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

const PekDocumentVersionRow = ({ version, busy, onDownload }: {
  version: PekDocumentVersion;
  busy: boolean;
  onDownload: (versionId: number, format: 'docx' | 'pdf') => void;
}) => <tr className="border-t">
  <td className="p-3 font-bold">v{version.version}</td>
  <td>{version.generatedAt || '—'}</td>
  <td>{version.generatedByName || (version.generatedById ? `Сотрудник №${version.generatedById}` : '—')}</td>
  <td>{version.stale ? 'Устаревшая версия' : 'Актуальная версия'}<div className="text-xs text-slate-500">Ревизия {version.sourceContentRevision} / {version.currentContentRevision}</div></td>
  <td>{version.hasDocx ? 'Есть' : 'Нет'}</td>
  <td>{version.hasPdf ? 'Есть' : 'Нет'}</td>
  <td><div className="flex flex-wrap gap-2">
    {version.hasDocx === true && <Button size="small" disabled={busy} onClick={() => onDownload(version.id, 'docx')}>Скачать DOCX</Button>}
    {version.hasPdf === true && <Button size="small" disabled={busy} onClick={() => onDownload(version.id, 'pdf')}>Скачать PDF</Button>}
  </div></td>
</tr>;

const PekReportDocuments = ({ report }: { report: PekReport }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const reportKey = pekKeys.report(report.id, undefined, user?.id);
  const versionsKey = pekKeys.reportDocuments(report.id, report.companyId, user?.id);
  const signaturesKey = pekKeys.reportSignatures(report.id, report.companyId, user?.id);
  const versions = useQuery({ queryKey: versionsKey, queryFn: ({ signal }) => pekApi.getReportDocumentVersions(report.id, signal) });
  const signatures = useQuery({ queryKey: signaturesKey, queryFn: ({ signal }) => pekApi.getReportSignatures(report.id, signal) });
  const sortedVersions = [...(versions.data || [])].sort((left, right) => right.version - left.version);
  const latestVersion = sortedVersions[0];
  const documentIsStale = latestVersion?.stale === true;

  const refreshReport = async () => {
    const actual = await pekApi.getReport(report.id);
    queryClient.setQueryData(reportKey, actual);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: versionsKey }),
      queryClient.invalidateQueries({ queryKey: signaturesKey }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportPackage(report.id, report.companyId, user?.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportsRoot(report.companyId, user?.id) }),
    ]);
    return actual;
  };

  const generate = useMutation({
    mutationFn: async (format: 'docx' | 'pdf') => {
      if (format === 'docx') await pekApi.generateReportDocx(report.id, report.version);
      else await pekApi.generateReportPdf(report.id, report.version);
      return refreshReport();
    },
    onError: (failure) => {
      void handlePekMutationError(failure, refreshReport);
    },
  });
  const download = useMutation({
    mutationFn: (format: 'docx' | 'pdf') => pekApi.downloadReportDocument(report.id, format),
    onSuccess: saveBlob,
    onError: (failure) => {
      void handlePekMutationError(failure, refreshReport);
    },
  });
  const downloadVersion = useMutation({
    mutationFn: ({ versionId, format }: { versionId: number; format: 'docx' | 'pdf' }) =>
      pekApi.downloadReportDocumentVersion(report.id, versionId, format),
    onSuccess: saveBlob,
  });
  const downloadCms = useMutation({
    mutationFn: (signatureId: number) => pekApi.downloadReportSignature(report.id, signatureId),
    onSuccess: saveBlob,
  });
  const sign = useMutation({
    mutationFn: async () => {
      const pdf = await pekApi.downloadReportDocument(report.id, 'pdf');
      const cms = await createCmsSignatureWithNCALayer(await blobToBase64(pdf.blob));
      await pekApi.signReportDocument(report.id, report.version, cms);
      return refreshReport();
    },
    onError: (failure) => {
      void handlePekMutationError(failure, refreshReport);
    },
  });

  const canGenerateDocx = report.availableActions.generateDocument === true;
  const canGeneratePdf = report.availableActions.generateDocument === true;
  const canDownloadDocx = report.availableActions.downloadDocx === true && latestVersion?.hasDocx === true && !documentIsStale;
  const canDownloadPdf = report.availableActions.downloadPdf === true && latestVersion?.hasPdf === true && !documentIsStale;
  const canSign = report.availableActions.sign === true && latestVersion?.hasPdf === true && !documentIsStale;
  const hasActions = canGenerateDocx || canGeneratePdf || canDownloadDocx || canDownloadPdf || canSign;
  const busy = generate.isPending || download.isPending || downloadVersion.isPending || downloadCms.isPending || sign.isPending;
  const error = generate.error || download.error || downloadVersion.error || downloadCms.error || sign.error;
  const failure = error ? mapPekError(error) : null;

  return <section className="space-y-5 rounded-2xl border bg-white p-5">
    <div>
      <h2 className="font-black">Документы отчёта ПЭК</h2>
      <p className="text-sm text-slate-500">Формирование, скачивание и подписание выполняются на сервере.</p>
    </div>
    {documentIsStale && <Alert severity="warning">Документ устарел. Сформируйте его заново.</Alert>}
    {failure && <Alert severity="error"><strong>{failure.code}</strong>: {failure.message}{Object.entries(failure.fieldErrors).map(([field, message]) => <div key={field}>{field}: {message}</div>)}</Alert>}
    {versions.isError && <Alert severity="error" action={<Button size="small" onClick={() => void versions.refetch()}>Повторить</Button>}>Не удалось загрузить версии документов.</Alert>}
    {signatures.isError && <Alert severity="error" action={<Button size="small" onClick={() => void signatures.refetch()}>Повторить</Button>}>Не удалось загрузить подписи.</Alert>}
    <div className="flex flex-wrap gap-2">
      {canGenerateDocx && <Button variant="outlined" disabled={busy} onClick={() => generate.mutate('docx')}>{documentIsStale ? 'Пересформировать DOCX' : 'Сформировать DOCX'}</Button>}
      {canGeneratePdf && <Button variant="contained" disabled={busy} onClick={() => generate.mutate('pdf')}>{documentIsStale ? 'Пересформировать PDF' : 'Сформировать PDF'}</Button>}
      {canDownloadDocx && <Button variant="outlined" disabled={busy} onClick={() => download.mutate('docx')}>Скачать DOCX</Button>}
      {canDownloadPdf && <Button variant="outlined" disabled={busy} onClick={() => download.mutate('pdf')}>Скачать PDF</Button>}
      {canSign && <Button color="success" variant="contained" disabled={busy} onClick={() => sign.mutate()}>Подписать</Button>}
    </div>
    {!hasActions && <Alert severity="info">Для текущего статуса отчёта backend не разрешил действий с документами.</Alert>}
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-slate-50 text-left"><tr><th className="p-3">Версия</th><th>Дата генерации</th><th>Автор</th><th>Статус</th><th>DOCX</th><th>PDF</th><th>Скачивание</th></tr></thead>
        <tbody>{versions.isLoading ? <tr><td className="p-4 text-slate-500" colSpan={7}>Загрузка версий…</td></tr> : sortedVersions.map((version) => <PekDocumentVersionRow key={version.id} version={version} busy={busy} onDownload={(versionId, format) => downloadVersion.mutate({ versionId, format })} />)}</tbody>
      </table>
      {!versions.isLoading && !versions.isError && !sortedVersions.length && <p className="p-4 text-sm text-slate-500">Документы ещё не сформированы.</p>}
    </div>
    <div>
      <h3 className="font-bold">Подписи</h3>
      {signatures.isLoading ? <p className="mt-2 text-sm text-slate-500">Загрузка подписей…</p> : !signatures.data?.length ? <p className="mt-2 text-sm text-slate-500">Подписей пока нет.</p> : <div className="mt-2 overflow-x-auto rounded-xl border"><table className="w-full min-w-[820px] text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Подписант</th><th>Дата подписания</th><th>Сертификат</th><th>Организация</th><th>Статус</th><th>Файл</th></tr></thead><tbody>{signatures.data.map((signature) => <tr key={signature.id} className="border-t"><td className="p-3 font-semibold">{signature.certificateCn || signature.certificateSubject || `Сотрудник №${signature.signerUserId}`}</td><td>{signature.signedAt || '—'}</td><td>{signature.certificateSerial || signature.certificateSubject || '—'}</td><td>{signature.certificateOrganization || '—'}</td><td>{signature.verified ? 'Подпись проверена' : 'Не подтверждена'}</td><td><Button size="small" disabled={busy} onClick={() => downloadCms.mutate(signature.id)}>Скачать CMS / ЭЦП</Button></td></tr>)}</tbody></table></div>}
    </div>
  </section>;
};

export default PekReportDocuments;
