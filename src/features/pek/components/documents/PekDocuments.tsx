import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Button from '../../../../components/ui/Button';
import { useToast } from '../../../../hooks/useToast';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekService } from '../../api/pekService';
import { asPekRecord } from '../../api/pekMappers';
import { mapPekError } from '../../utils/pekErrorMapper';

const categories = [
  ['PROGRAM', 'Программа'],
  ['PERMIT', 'Разрешение'],
  ['PROTOCOL', 'Протокол'],
  ['ACT', 'Акт'],
  ['CONTRACT', 'Договор'],
  ['WASTE', 'Отходы'],
  ['CORRECTIVE_ACTION', 'Корректирующее действие'],
  ['RECEIPT', 'Квитанция'],
  ['OTHER', 'Прочее'],
] as const;

const PekDocuments = ({ reportId, version, data, readOnly }: {
  reportId: number;
  version: number;
  data: Record<string, unknown>;
  readOnly: boolean;
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('OTHER');
  const toast = useToast();
  const client = useQueryClient();
  const raw = Array.isArray(data.documents) ? data.documents : Array.isArray(data.items) ? data.items : [];
  const documents = raw.map(asPekRecord);
  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Выберите файл');
      const body = new FormData();
      body.append('file', file);
      body.append('category', category);
      body.append('version', String(version));
      return pekService.uploadReportDocument(reportId, body);
    },
    retry: false,
    onSuccess: async () => {
      setFile(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: pekKeys.section(reportId, 'DOCUMENTS') }),
        client.invalidateQueries({ queryKey: pekKeys.report(reportId) }),
        client.invalidateQueries({ queryKey: pekKeys.issues(reportId) }),
        client.invalidateQueries({ queryKey: pekKeys.history(reportId) }),
      ]);
      toast.success('Документ загружен');
    },
    onError: (failure) => toast.error(mapPekError(failure).message),
  });

  return <div className="space-y-4">
    {!readOnly && <section className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <label className="text-sm font-bold">Категория<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full rounded-xl border p-3">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-bold">Файл<input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} className="mt-1 w-full rounded-xl border p-3" /></label>
      <Button type="button" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>{upload.isPending ? 'Загрузка…' : 'Загрузить'}</Button>
    </section>}
    <div className="space-y-2">
      {documents.map((document, index) => {
        const name = String(document.name || document.fileName || `Документ ${index + 1}`);
        const url = typeof document.downloadUrl === 'string' ? document.downloadUrl : '';
        return <article key={String(document.id || index)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
          <div><strong>{name}</strong><p className="text-xs text-slate-500">{String(document.categoryLabel || document.category || 'Документ')} · версия {String(document.version || 1)}</p></div>
          {url && <a href={url} className="rounded-full border px-4 py-2 text-sm font-bold">Скачать</a>}
        </article>;
      })}
      {!documents.length && <p className="text-slate-500">Документы не загружены</p>}
    </div>
  </div>;
};

export default PekDocuments;
