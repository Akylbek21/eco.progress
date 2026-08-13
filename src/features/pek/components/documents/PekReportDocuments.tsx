import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button } from '@mui/material';
import { useAuth } from '../../../../contexts/AuthContext';
import { createCmsSignatureWithNCALayer } from '../../../../services/ncalayer';
import type { PekBlobResult, PekReport } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekApi } from '../../api/pekService';
import PekQueryError from '../common/PekQueryError';
import { PekLoading, PekState } from '../common/PekUi';

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
  const versionsKey = pekKeys.reportDocuments(report.id, report.companyId, user?.id);
  const signaturesKey = pekKeys.reportSignatures(report.id, report.companyId, user?.id);
  const versions = useQuery({ queryKey: versionsKey, queryFn: ({ signal }) => pekApi.getReportDocumentVersions(report.id, signal) });
  const signatures = useQuery({ queryKey: signaturesKey, queryFn: ({ signal }) => pekApi.getReportSignatures(report.id, signal) });
  const [latest] = [...(versions.data || [])].sort((left, right) => right.version - left.version);
  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: versionsKey }),
    queryClient.invalidateQueries({ queryKey: signaturesKey }),
    queryClient.invalidateQueries({ queryKey: pekKeys.report(report.id, undefined, user?.id) }),
  ]);
  const generate = useMutation({
    mutationFn: (format: 'docx' | 'pdf') => format === 'docx' ? pekApi.generateReportDocx(report.id) : pekApi.generateReportPdf(report.id),
    onSuccess: refresh,
  });
  const download = useMutation({ mutationFn: (format: 'docx' | 'pdf') => pekApi.downloadReportDocument(report.id, format), onSuccess: saveBlob });
  const sign = useMutation({
    mutationFn: async () => {
      const pdf = await pekApi.downloadReportDocument(report.id, 'pdf');
      const cms = await createCmsSignatureWithNCALayer(await blobToBase64(pdf.blob));
      return pekApi.signReportDocument(report.id, cms);
    },
    onSuccess: refresh,
  });

  if (versions.isLoading || signatures.isLoading) return <PekLoading />;
  if (versions.isError) return <PekQueryError error={versions.error} resource="версии документов отчёта" retry={() => void versions.refetch()} />;
  if (signatures.isError) return <PekQueryError error={signatures.error} resource="подписи отчёта" retry={() => void signatures.refetch()} />;
  const busy = generate.isPending || download.isPending || sign.isPending;
  const error = generate.error || download.error || sign.error;
  return <section className="space-y-5 rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">Документы отчёта</h2><p className="text-sm text-slate-500">Версии DOCX/PDF и зарегистрированные ЭЦП</p></div><div className="flex flex-wrap gap-2">{report.availableActions.generateDocument === true && <><Button variant="outlined" disabled={busy} onClick={() => generate.mutate('docx')}>Сформировать DOCX</Button><Button variant="contained" disabled={busy} onClick={() => generate.mutate('pdf')}>Сформировать PDF</Button></>}{report.availableActions.sign === true && latest?.hasPdf && <Button color="success" variant="contained" disabled={busy} onClick={() => sign.mutate()}>Подписать ЭЦП</Button>}</div></div>
    {error && <Alert severity="error">{error instanceof Error ? error.message : 'Операция с документом не выполнена.'}</Alert>}
    {!versions.data?.length ? <PekState title="Документы ещё не сформированы" /> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Версия</th><th>Дата</th><th>Hash</th><th>Файлы</th></tr></thead><tbody>{versions.data.map((version) => <tr key={version.id} className="border-b"><td className="p-2">v{version.version}</td><td>{version.generatedAt || '—'}</td><td className="max-w-48 truncate font-mono text-xs">{version.contentHash || '—'}</td><td><div className="flex gap-2">{version.hasDocx && <Button size="small" disabled={busy || version.id !== latest?.id} onClick={() => download.mutate('docx')}>DOCX</Button>}{version.hasPdf && <Button size="small" disabled={busy || version.id !== latest?.id} onClick={() => download.mutate('pdf')}>PDF</Button>}</div></td></tr>)}</tbody></table></div>}
    <div><h3 className="font-bold">Подписи</h3>{!signatures.data?.length ? <p className="mt-2 text-sm text-slate-500">Подписей пока нет.</p> : <ul className="mt-2 space-y-2">{signatures.data.map((signature) => <li key={signature.id} className="rounded-xl bg-slate-50 p-3 text-sm"><strong>{signature.certificateCn || signature.certificateSubject || `Сотрудник №${signature.signerUserId}`}</strong> · {signature.signedAt} · {signature.verified ? 'подпись проверена' : 'проверка не подтверждена'}</li>)}</ul>}</div>
  </section>;
};

export default PekReportDocuments;
