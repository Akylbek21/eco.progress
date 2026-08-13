import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button } from '@mui/material';
import { useAuth } from '../../../../contexts/AuthContext';
import { createCmsSignatureWithNCALayer } from '../../../../services/ncalayer';
import type { PekBlobResult, PekReport } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekApi } from '../../api/pekService';

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

  const refreshReport = async () => {
    const actual = await pekApi.getReport(report.id);
    queryClient.setQueryData(reportKey, actual);
    await queryClient.invalidateQueries({ queryKey: pekKeys.reportsRoot(report.companyId, user?.id) });
    return actual;
  };

  const generate = useMutation({
    mutationFn: async (format: 'docx' | 'pdf') => {
      if (format === 'docx') await pekApi.generateReportDocx(report.id);
      else await pekApi.generateReportPdf(report.id);
      return refreshReport();
    },
  });
  const download = useMutation({
    mutationFn: (format: 'docx' | 'pdf') => pekApi.downloadReportDocument(report.id, format),
    onSuccess: saveBlob,
  });
  const sign = useMutation({
    mutationFn: async () => {
      const pdf = await pekApi.downloadReportDocument(report.id, 'pdf');
      const cms = await createCmsSignatureWithNCALayer(await blobToBase64(pdf.blob));
      await pekApi.signReportDocument(report.id, cms);
      return refreshReport();
    },
  });

  const canGenerateDocx = actionEnabled(report, 'generateDocx', 'generateDocument');
  const canGeneratePdf = actionEnabled(report, 'generatePdf', 'generateDocument');
  const canDownloadDocx = actionEnabled(report, 'downloadDocx', 'downloadDocument');
  const canDownloadPdf = actionEnabled(report, 'downloadPdf', 'downloadDocument');
  const canSign = actionEnabled(report, 'sign');
  const hasActions = canGenerateDocx || canGeneratePdf || canDownloadDocx || canDownloadPdf || canSign;
  const busy = generate.isPending || download.isPending || sign.isPending;
  const error = generate.error || download.error || sign.error;

  return <section className="space-y-5 rounded-2xl border bg-white p-5">
    <div>
      <h2 className="font-black">Документы отчёта ПЭК</h2>
      <p className="text-sm text-slate-500">Формирование, скачивание и подписание выполняются на сервере.</p>
    </div>
    {error && <Alert severity="error">{error instanceof Error ? error.message : 'Операция с документом не выполнена.'}</Alert>}
    <div className="flex flex-wrap gap-2">
      {canGenerateDocx && <Button variant="outlined" disabled={busy} onClick={() => generate.mutate('docx')}>Сформировать DOCX</Button>}
      {canGeneratePdf && <Button variant="contained" disabled={busy} onClick={() => generate.mutate('pdf')}>Сформировать PDF</Button>}
      {canDownloadDocx && <Button variant="outlined" disabled={busy} onClick={() => download.mutate('docx')}>Скачать DOCX</Button>}
      {canDownloadPdf && <Button variant="outlined" disabled={busy} onClick={() => download.mutate('pdf')}>Скачать PDF</Button>}
      {canSign && <Button color="success" variant="contained" disabled={busy} onClick={() => sign.mutate()}>Подписать</Button>}
    </div>
    {!hasActions && <Alert severity="info">Для текущего статуса отчёта backend не разрешил действий с документами.</Alert>}
  </section>;
};

export default PekReportDocuments;
