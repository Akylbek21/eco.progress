import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Chip } from '@mui/material';
import { useAuth } from '../../../../contexts/AuthContext';
import { createCmsSignatureWithNCALayer } from '../../../../services/ncalayer';
import type { PekBlobResult, PekDocumentVersion, PekReport, PekReportDocumentFormat, PekReportDocumentKind } from '../../api/pekContracts';
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
const previewBlob = ({ blob }: PekBlobResult) => {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Не удалось прочитать официальный PDF отчёта для подписи.'));
  reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
  reader.readAsDataURL(blob);
});

type DocumentPanelConfig = {
  kind: PekReportDocumentKind;
  title: string;
  description: string;
  formats: PekReportDocumentFormat[];
  previewFormats: PekReportDocumentFormat[];
  generateAction: string;
  downloadAction: string;
  previewAction: string;
};
const versionFormatAvailable = (version: PekDocumentVersion, format: PekReportDocumentFormat) =>
  format === 'docx' ? version.hasDocx : format === 'pdf' ? version.hasPdf : version.hasXlsx;

const ReportDocumentPanel = ({ report, config }: { report: PekReport; config: DocumentPanelConfig }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const versionsKey = pekKeys.reportDocuments(report.id, config.kind, report.companyId, user?.id);
  const versions = useQuery({ queryKey: versionsKey, queryFn: ({ signal }) => pekApi.getReportDocumentVersions(report.id, config.kind, signal) });
  const sortedVersions = [...(versions.data || [])].sort((left, right) => right.version - left.version);
  const latest = sortedVersions[0];
  const refresh = async () => {
    const actual = await pekApi.getReport(report.id);
    queryClient.setQueryData(pekKeys.report(report.id, undefined, user?.id), actual);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: versionsKey }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportsRoot(report.companyId, user?.id) }),
    ]);
    return actual;
  };
  const generate = useMutation({
    mutationFn: (format: PekReportDocumentFormat) => pekApi.generateReportDocument(report.id, config.kind, format, report.version),
    retry: false,
    onSuccess: refresh,
    onError: (error) => { void handlePekMutationError(error, refresh); },
  });
  const download = useMutation({ mutationFn: (format: PekReportDocumentFormat) => pekApi.downloadReportDocument(report.id, config.kind, format), onSuccess: saveBlob });
  const preview = useMutation({ mutationFn: (format: PekReportDocumentFormat) => pekApi.downloadReportDocument(report.id, config.kind, format, true), onSuccess: previewBlob });
  const downloadVersion = useMutation({
    mutationFn: ({ versionId, format }: { versionId: number; format: PekReportDocumentFormat }) => pekApi.downloadReportDocumentVersion(report.id, config.kind, versionId, format),
    onSuccess: saveBlob,
  });
  const busy = generate.isPending || download.isPending || preview.isPending || downloadVersion.isPending;
  const failure = generate.error || download.error || preview.error || downloadVersion.error;
  const canGenerate = report.availableActions[config.generateAction] === true;
  const canDownload = report.availableActions[config.downloadAction] === true && Boolean(latest && !latest.stale);
  const canPreview = report.availableActions[config.previewAction] === true && Boolean(latest && !latest.stale);

  return <section className="space-y-4 rounded-2xl border bg-white p-5">
    <div><h2 className="font-black">{config.title}</h2><p className="text-sm text-slate-500">{config.description}</p></div>
    {latest?.stale && <Alert severity="warning">Документ устарел после изменения данных программы или отчёта. Сформируйте новую версию.</Alert>}
    {failure && <Alert severity="error">{mapPekError(failure).message}</Alert>}
    <div className="flex flex-wrap gap-2">
      {config.formats.map((format) => canGenerate && <Button key={`generate-${format}`} variant={format === 'pdf' ? 'contained' : 'outlined'} disabled={busy} onClick={() => generate.mutate(format)}>Сформировать {format.toUpperCase()}</Button>)}
      {config.previewFormats.map((format) => canPreview && latest && versionFormatAvailable(latest, format) && <Button key={`preview-${format}`} variant="outlined" disabled={busy} onClick={() => preview.mutate(format)}>Preview {format.toUpperCase()}</Button>)}
      {config.formats.map((format) => canDownload && latest && versionFormatAvailable(latest, format) && <Button key={`download-${format}`} variant="outlined" disabled={busy} onClick={() => download.mutate(format)}>Скачать {format.toUpperCase()}</Button>)}
    </div>
    {!canGenerate && !canDownload && !canPreview && <Alert severity="info">Для текущего статуса backend не разрешил действия с этим типом документа.</Alert>}
    {versions.isError && <Alert severity="error" action={<Button size="small" onClick={() => void versions.refetch()}>Повторить</Button>}>Не удалось загрузить версии документа.</Alert>}
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-slate-50 text-left"><tr><th className="p-3">Версия</th><th>Создан</th><th>Форма</th><th>НПА</th><th>Ревизия данных</th><th>Статус</th><th>Файлы</th></tr></thead>
        <tbody>{sortedVersions.map((version) => <tr key={version.id} className="border-t">
          <td className="p-3 font-bold">v{version.version}</td><td>{version.generatedAt || '—'}<div className="text-xs text-slate-500">{version.generatedByName || '—'}</div></td>
          <td>{version.templateVersion || '—'}</td><td>{version.regulationVersion || '—'}</td><td>{version.sourceContentRevision} / {version.currentContentRevision}</td>
          <td><Chip size="small" color={version.stale ? 'warning' : 'success'} label={version.stale ? 'Устарел' : 'Актуален'} /></td>
          <td><div className="flex flex-wrap gap-1">{config.formats.map((format) => versionFormatAvailable(version, format) && <Button key={format} size="small" disabled={busy} onClick={() => downloadVersion.mutate({ versionId: version.id, format })}>{format.toUpperCase()}</Button>)}</div></td>
        </tr>)}</tbody>
      </table>
      {!versions.isLoading && !versions.isError && !sortedVersions.length && <p className="p-4 text-sm text-slate-500">Версии ещё не сформированы.</p>}
    </div>
  </section>;
};

const OfficialSignatures = ({ report }: { report: PekReport }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = pekKeys.reportSignatures(report.id, report.companyId, user?.id);
  const signatures = useQuery({ queryKey: key, queryFn: ({ signal }) => pekApi.getReportSignatures(report.id, signal) });
  const downloadCms = useMutation({ mutationFn: (id: number) => pekApi.downloadReportSignature(report.id, id), onSuccess: saveBlob });
  const sign = useMutation({
    mutationFn: async () => {
      const pdf = await pekApi.downloadReportDocument(report.id, 'OFFICIAL', 'pdf');
      const cms = await createCmsSignatureWithNCALayer(await blobToBase64(pdf.blob));
      return pekApi.signReportDocument(report.id, report.version, cms);
    }, retry: false,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: key }); },
  });
  return <section className="space-y-3 rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-black">Подписи официального отчёта</h2><p className="text-sm text-slate-500">ЭЦП относится только к нормативному документу.</p></div>{report.availableActions.signOfficialDocument === true && <Button color="success" variant="contained" disabled={sign.isPending} onClick={() => sign.mutate()}>Подписать официальный PDF</Button>}</div>
    {sign.error && <Alert severity="error">{mapPekError(sign.error).message}</Alert>}
    {!signatures.data?.length ? <p className="text-sm text-slate-500">Подписей пока нет.</p> : <div className="space-y-2">{signatures.data.map((signature) => <div key={signature.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"><span>{signature.certificateCn || signature.certificateSubject || `Сотрудник №${signature.signerUserId}`} · {signature.signedAt}</span><Button size="small" onClick={() => downloadCms.mutate(signature.id)}>Скачать CMS</Button></div>)}</div>}
  </section>;
};

const PekReportDocuments = ({ report }: { report: PekReport }) => <div className="space-y-5">
  <Alert severity="info">Версии формы и НПА ниже зафиксированы при создании каждой версии документа и не заменяются текущими значениями отчёта.</Alert>
  <ReportDocumentPanel report={report} config={{ kind: 'OFFICIAL', title: 'Официальный отчёт ПЭК', description: 'Нормативный документ для представления в уполномоченный орган.', formats: ['docx', 'pdf'], previewFormats: ['pdf'], generateAction: 'generateOfficialDocument', downloadAction: 'downloadOfficialDocument', previewAction: 'previewOfficialDocument' }} />
  <ReportDocumentPanel report={report} config={{ kind: 'INTERNAL_ANALYTICAL', title: 'Внутренний аналитический отчёт', description: 'CRM-аналитика для внутренней работы; не является официальной формой ПЭК.', formats: ['pdf', 'xlsx'], previewFormats: ['pdf'], generateAction: 'generateInternalAnalyticalReport', downloadAction: 'downloadInternalAnalyticalReport', previewAction: 'previewInternalAnalyticalReport' }} />
  <OfficialSignatures report={report} />
</div>;

export default PekReportDocuments;
