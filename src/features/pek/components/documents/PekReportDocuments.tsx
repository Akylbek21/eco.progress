import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button } from '@mui/material';
import { useAuth } from '../../../../contexts/AuthContext';
import { createCmsSignatureWithNCALayer } from '../../../../services/ncalayer';
import type { PekBlobResult, PekReport } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekApi } from '../../api/pekService';
import { mapPekError } from '../../utils/pekErrorMapper';
import { canGenerateDocument, canSignReport, canUsePekPermission } from '../../permissions/pekAccess';

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
  const latestVersion = sortedVersions[0];
  const documentIsStale = latestVersion?.stale === true || latestVersion?.status === 'STALE' || (latestVersionId != null && staleVersionIds.includes(latestVersionId));

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
    onSuccess: () => setStaleVersionIds([]),
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
      if (mapped.code === 'PEK_DOCUMENT_STALE' && latestVersionId) {
        setStaleVersionIds((current) => current.includes(latestVersionId) ? current : [...current, latestVersionId]);
      }
      if (mapped.status === 409 || mapped.status === 412) void refreshReport();
    },
  });
  const downloadCms = useMutation({
    mutationFn: (signatureFileId: string | number) => pekApi.downloadReportSignature(report.id, signatureFileId),
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
      const mapped = mapPekError(failure);
      if (mapped.code === 'PEK_DOCUMENT_STALE' && latestVersionId) {
        setStaleVersionIds((current) => current.includes(latestVersionId) ? current : [...current, latestVersionId]);
      }
      if (mapped.status === 409 || mapped.status === 412) void refreshReport();
    },
  });

  const canGenerateDocx = canGenerateDocument(user, report);
  const canGeneratePdf = canGenerateDocument(user, report);
  const canDownloadDocx = canUsePekPermission(user, 'PEK_VIEW') && latestVersion?.hasDocx === true;
  const canDownloadPdf = canUsePekPermission(user, 'PEK_VIEW') && latestVersion?.hasPdf === true;
  const canSign = canSignReport(user, report) && latestVersion?.hasPdf === true;
  const hasActions = canGenerateDocx || canGeneratePdf || canDownloadDocx || canDownloadPdf || canSign;
  const busy = generate.isPending || download.isPending || downloadCms.isPending || sign.isPending;
  const error = generate.error || download.error || downloadCms.error || sign.error;
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
      {canDownloadDocx && <Button variant="outlined" disabled={busy || documentIsStale} onClick={() => download.mutate('docx')}>Скачать DOCX</Button>}
      {canDownloadPdf && <Button variant="outlined" disabled={busy || documentIsStale} onClick={() => download.mutate('pdf')}>Скачать PDF</Button>}
      {canSign && <Button color="success" variant="contained" disabled={busy || documentIsStale} onClick={() => sign.mutate()}>Подписать</Button>}
    </div>
    {!hasActions && <Alert severity="info">Для текущего статуса отчёта backend не разрешил действий с документами.</Alert>}
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-slate-50 text-left"><tr><th className="p-3">Версия</th><th>Дата генерации</th><th>Автор</th><th>Статус</th><th>DOCX</th><th>PDF</th><th>Скачивание</th></tr></thead>
        <tbody>{versions.isLoading ? <tr><td className="p-4 text-slate-500" colSpan={7}>Загрузка версий…</td></tr> : sortedVersions.map((version) => { const stale = version.stale === true || version.status === 'STALE' || staleVersionIds.includes(version.id); return <tr key={version.id} className="border-t"><td className="p-3 font-bold">v{version.version}</td><td>{version.generatedAt || '—'}</td><td>{version.generatedByName || (version.generatedBy ? `Сотрудник №${version.generatedBy}` : '—')}</td><td>{stale ? 'Устарел' : version.status || '—'}</td><td>{version.hasDocx ? 'Есть' : 'Нет'}</td><td>{version.hasPdf ? 'Есть' : 'Нет'}</td><td><span className="text-slate-500">Скачивание исторической версии не поддерживается backend</span></td></tr>; })}</tbody>
      </table>
      {!versions.isLoading && !versions.isError && !sortedVersions.length && <p className="p-4 text-sm text-slate-500">Документы ещё не сформированы.</p>}
    </div>
    <div>
      <h3 className="font-bold">Подписи</h3>
      {signatures.isLoading ? <p className="mt-2 text-sm text-slate-500">Загрузка подписей…</p> : !signatures.data?.length ? <p className="mt-2 text-sm text-slate-500">Подписей пока нет.</p> : <div className="mt-2 overflow-x-auto rounded-xl border"><table className="w-full min-w-[820px] text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Подписант</th><th>Дата подписания</th><th>Сертификат</th><th>Организация</th><th>Статус</th><th>Файл</th></tr></thead><tbody>{signatures.data.map((signature) => <tr key={signature.id} className="border-t"><td className="p-3 font-semibold">{signature.certificateCn || signature.certificateSubject || `Сотрудник №${signature.signerUserId}`}</td><td>{signature.signedAt || '—'}</td><td>{signature.certificateSerial || signature.certificateSubject || '—'}</td><td>{signature.certificateOrganization || '—'}</td><td>{signature.verified ? 'Подпись проверена' : 'Не подтверждена'}</td><td>{signature.signatureFileId && <Button size="small" disabled={busy} onClick={() => downloadCms.mutate(signature.signatureFileId!)}>Скачать CMS / ЭЦП</Button>}</td></tr>)}</tbody></table></div>}
    </div>
  </section>;
};

export default PekReportDocuments;
