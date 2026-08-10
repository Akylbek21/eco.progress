import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Button from '../../../../components/ui/Button';
import { useToast } from '../../../../hooks/useToast';
import type { PekProgramDocument } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekApi } from '../../api/pekService';
import { mapPekError } from '../../utils/pekErrorMapper';
import { useAuth } from '../../../../contexts/AuthContext';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_MIME = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/jpeg', 'image/png'];

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const PekProgramDocuments = ({ programId, version, documents, readOnly }: {
  programId: number;
  version: number;
  documents: PekProgramDocument[];
  readOnly: boolean;
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const controller = useRef<AbortController>();
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('OTHER');
  const [progress, setProgress] = useState(0);
  const [validationError, setValidationError] = useState('');

  const selectFile = (next: File | null) => {
    setValidationError('');
    if (!next) return setFile(null);
    if (!next.name.trim() || next.name.length > 255 || /[\\/]/.test(next.name)) {
      setValidationError('Недопустимое имя файла.');
      return;
    }
    if (next.size > MAX_FILE_SIZE) {
      setValidationError('Размер файла превышает 25 МБ.');
      return;
    }
    if (!ALLOWED_MIME.includes(next.type)) {
      setValidationError('Поддерживаются PDF, DOCX, XLSX, JPEG и PNG.');
      return;
    }
    setFile(next);
  };
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Выберите файл.');
      controller.current = new AbortController();
      return pekApi.uploadProgramDocument(programId, file, documentType, {
        signal: controller.current.signal,
        onUploadProgress: (event) => setProgress(event.total ? Math.round(event.loaded * 100 / event.total) : 0),
      });
    },
    retry: false,
    onSuccess: async () => {
      setFile(null);
      setProgress(0);
      await queryClient.invalidateQueries({ queryKey: pekKeys.program(programId, undefined, user?.id) });
      toast.success('Документ загружен');
    },
    onError: (error) => toast.error(mapPekError(error).message),
  });
  const download = useMutation({
    mutationFn: (document: PekProgramDocument) => pekApi.downloadProgramDocument(programId, document.id),
    onSuccess: (result) => saveBlob(result.blob, result.filename),
    onError: (error) => toast.error(mapPekError(error).message),
  });

  return <div className="space-y-4">
    {!readOnly && <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files[0] || null); }}
      className="rounded-2xl border-2 border-dashed border-slate-300 p-5"
    >
      <label className="block font-bold">Файл
        <input type="file" accept={ALLOWED_MIME.join(',')} onChange={(event) => selectFile(event.target.files?.[0] || null)} className="mt-2 block w-full" />
      </label>
      <p className="mt-2 text-sm text-slate-500">Перетащите файл сюда. Максимальный размер — 25 МБ.</p>
      <label className="mt-3 block font-bold">Тип документа<select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="PROGRAM">Программа</option><option value="PERMIT">Разрешительный документ</option><option value="METHODOLOGY">Методика</option><option value="OTHER">Другое</option></select></label>
      {file && <p className="mt-2 text-sm">Выбран: {file.name} · {(file.size / 1024 / 1024).toFixed(2)} МБ · {file.type}</p>}
      {validationError && <p role="alert" className="mt-2 text-sm text-rose-700">{validationError}</p>}
      {upload.isPending && <div className="mt-3"><p className="text-sm">Загрузка: {progress || '…'}{progress ? '%' : ''}</p><progress value={progress || undefined} max={100} className="w-full" /></div>}
      <div className="mt-3 flex gap-2">
        <Button type="button" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
          {upload.isError ? 'Повторить отправку' : 'Загрузить'}
        </Button>
        {upload.isPending && <Button type="button" variant="secondary" onClick={() => controller.current?.abort()}>Отменить</Button>}
      </div>
    </div>}
    <div className="space-y-2">
      {documents.map((document) => (
        <div key={document.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
          <div><strong>{document.originalFileName || document.fileName || `Документ №${document.id}`}</strong><p className="text-xs text-slate-500">{document.documentType || 'Тип не указан'} · {document.size == null ? 'размер не указан' : `${(document.size / 1024 / 1024).toFixed(2)} МБ`} · {document.contentType || 'MIME не указан'}</p></div>
          <button type="button" disabled={download.isPending} onClick={() => download.mutate(document)} className="font-bold text-eco-700">Скачать</button>
        </div>
      ))}
      {!documents.length && <p className="text-sm text-slate-500">Документы не загружены</p>}
    </div>
  </div>;
};

export default PekProgramDocuments;
