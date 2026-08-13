import { useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, FileCheck2, FileSignature, Upload } from 'lucide-react';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { normalizeApiError } from '../services/apiHelpers';
import { createCmsSignatureWithNCALayer } from '../services/ncalayer';
import { signatureDocumentService, type DownloadedSignatureFile, type SignatureDocument } from '../services/signatureDocumentService';

const queryKey = ['staff-signature-documents'] as const;
const date = (value?: string) => value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';

const saveFile = ({ blob, fileName }: DownloadedSignatureFile) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const openFile = ({ blob }: DownloadedSignatureFile) => {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Не удалось подготовить файл для подписания.'));
  reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
  reader.readAsDataURL(blob);
});

export default function SignatureDocumentsPage() {
  const toast = useToast();
  const client = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busyId, setBusyId] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);

  const documents = useQuery({
    queryKey: [...queryKey, page, size],
    queryFn: ({ signal }) => signatureDocumentService.list(page, size, signal),
    placeholderData: keepPreviousData,
  });
  const upload = useMutation({
    mutationFn: (file: File) => signatureDocumentService.upload(file),
    onSuccess: async () => {
      setPage(0);
      await client.invalidateQueries({ queryKey });
      toast.success('Документ загружен');
      if (fileInput.current) fileInput.current.value = '';
    },
    onError: (error) => toast.error(normalizeApiError(error, 'Не удалось загрузить документ.').message),
  });

  const run = async (document: SignatureDocument, action: 'open' | 'download' | 'sign' | 'package') => {
    setBusyId(document.id);
    try {
      if (action === 'open') openFile(await signatureDocumentService.downloadOriginal(document));
      if (action === 'download') saveFile(await signatureDocumentService.downloadOriginal(document));
      if (action === 'package') saveFile(await signatureDocumentService.downloadSignedPackage(document));
      if (action === 'sign') {
        const prepared = await signatureDocumentService.prepareSigning(document);
        if (!prepared.signingSessionId || !prepared.documentId || !prepared.sha256) throw new Error('Сервер вернул неполные данные для подписания.');
        const content = await signatureDocumentService.downloadSigningContent(prepared);
        const cmsBase64 = await createCmsSignatureWithNCALayer(await blobToBase64(content));
        await signatureDocumentService.submitSignature({ ...prepared, cmsBase64 });
        await client.invalidateQueries({ queryKey });
        toast.success('Документ подписан');
      }
    } catch (error) {
      toast.error(normalizeApiError(error, 'Операция не выполнена.').message);
    } finally {
      setBusyId('');
    }
  };

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-sm font-bold uppercase tracking-wider text-eco-700">Внутренние документы</p><h2 className="mt-1 text-3xl font-black text-slate-950">Подписание документов</h2></div>
      <input ref={fileInput} type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); }} />
      <Button type="button" disabled={upload.isPending} onClick={() => fileInput.current?.click()}><Upload size={18} /> {upload.isPending ? 'Загрузка…' : 'Загрузить документ'}</Button>
    </header>

    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {documents.isLoading ? <div className="flex min-h-48 items-center justify-center"><LoadingSpinner /></div> : documents.isError ? <div className="p-6 text-sm font-semibold text-rose-700">{normalizeApiError(documents.error, 'Не удалось загрузить список.').message} <button className="ml-2 underline" onClick={() => documents.refetch()}>Повторить</button></div> : !documents.data?.items.length ? <div className="p-12 text-center"><FileCheck2 className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-semibold text-slate-600">Документов пока нет</p></div> : <div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Название', 'Файл', 'Дата загрузки', 'Статус', 'Дата подписи', 'Действия'].map((item) => <th key={item} className="px-4 py-3 font-bold">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{documents.data.items.map((document) => { const busy = busyId === document.id; return <tr key={document.id}><td className="px-4 py-4 font-bold text-slate-900">{document.name}</td><td className="px-4 py-4 text-slate-600">{document.fileName}</td><td className="px-4 py-4 text-slate-600">{date(document.uploadedAt)}</td><td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${document.status === 'SIGNED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{document.status === 'SIGNED' ? 'Подписан' : 'Не подписан'}</span></td><td className="px-4 py-4 text-slate-600">{date(document.signedAt)}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => void run(document, 'open')}><Eye size={16} /> Открыть</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => void run(document, 'download')}><Download size={16} /> Скачать</Button>{document.status === 'UNSIGNED' && <Button type="button" disabled={busy} onClick={() => void run(document, 'sign')}><FileSignature size={16} /> Подписать ЭЦП</Button>}{document.status === 'SIGNED' && <Button type="button" variant="secondary" disabled={busy} onClick={() => void run(document, 'package')}><Download size={16} /> Скачать подписанный ZIP</Button>}</div></td></tr>; })}</tbody></table></div>}
      {documents.data && documents.data.totalElements > 0 && <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600">Страница {documents.data.page + 1} из {Math.max(documents.data.totalPages, 1)} · всего {documents.data.totalElements}</p><div className="flex items-center gap-2"><label className="text-sm text-slate-600">На странице <select value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }} className="ml-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label><Button type="button" variant="secondary" disabled={!documents.data.hasPrevious || documents.isFetching} onClick={() => setPage((value) => Math.max(0, value - 1))}>Назад</Button><Button type="button" variant="secondary" disabled={!documents.data.hasNext || documents.isFetching} onClick={() => setPage((value) => value + 1)}>Далее</Button></div></footer>}
    </section>
  </div>;
}
