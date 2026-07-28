import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Button from '../../../../components/ui/Button';
import type { PekAvailableAction, PekReviewComment, PekSectionCode } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekService } from '../../api/pekService';
import { mapPekError } from '../../utils/pekErrorMapper';

const sections: Array<{ value: PekSectionCode; label: string }> = [
  { value: 'GENERAL', label: 'Общие сведения' },
  { value: 'PROGRAM_EXECUTION', label: 'Выполнение программы' },
  { value: 'EMISSIONS', label: 'Выбросы' },
  { value: 'CALCULATED_CONTROL', label: 'Расчётный контроль' },
  { value: 'WATER', label: 'Вода и сбросы' },
  { value: 'WASTE', label: 'Отходы' },
  { value: 'IMPACT_MONITORING', label: 'Мониторинг воздействия' },
  { value: 'ENVIRONMENTAL_ACTIONS', label: 'Мероприятия' },
  { value: 'EXCEEDANCES', label: 'Превышения' },
  { value: 'DOCUMENTS', label: 'Документы' },
  { value: 'REVIEW', label: 'Проверка' },
];

const PekReviewPanel = ({ reportId, version, comments, actions, onNavigate }: {
  reportId: number;
  version: number;
  comments: PekReviewComment[];
  actions: PekAvailableAction[];
  onNavigate: (comment: PekReviewComment) => void;
}) => {
  const client = useQueryClient();
  const [text, setText] = useState('');
  const [sectionCode, setSectionCode] = useState<PekSectionCode>('GENERAL');
  const [mandatory, setMandatory] = useState(true);
  const [error, setError] = useState('');
  const canAdd = actions.some((action) => action.code === 'ADD_REVIEW_COMMENT' && action.enabled);
  const canResolve = actions.some((action) => action.code === 'RESOLVE_REVIEW_COMMENT' && action.enabled);
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: pekKeys.comments(reportId) }),
    client.invalidateQueries({ queryKey: pekKeys.report(reportId) }),
    client.invalidateQueries({ queryKey: pekKeys.history(reportId) }),
  ]);
  const create = useMutation({
    mutationFn: () => pekService.createReviewComment(reportId, { version, text: text.trim(), sectionCode, mandatory }),
    retry: false,
    onSuccess: async () => {
      setText('');
      setError('');
      await refresh();
    },
    onError: (failure) => setError(mapPekError(failure).message),
  });
  const resolve = useMutation({
    mutationFn: (commentId: number) => pekService.resolveReviewComment(reportId, commentId, { version }),
    retry: false,
    onSuccess: refresh,
    onError: (failure) => setError(mapPekError(failure).message),
  });

  return <section className="mt-4 border-t pt-4">
    <h2 className="font-black">Замечания проверяющего</h2>
    <div className="mt-3 space-y-2">
      {comments.map((comment) => <article key={comment.id} className="rounded-xl border p-3 text-sm">
        <button type="button" onClick={() => onNavigate(comment)} className="w-full text-left">
          <strong>{comment.mandatory ? 'Обязательное замечание' : 'Комментарий'}</strong>
          <p className="mt-1">{comment.text}</p>
          <p className="mt-1 text-xs text-slate-500">{comment.author?.name || 'Проверяющий'} · {comment.createdAt}</p>
        </button>
        {comment.status !== 'RESOLVED' && canResolve && <Button type="button" variant="secondary" className="mt-2" disabled={resolve.isPending} onClick={() => resolve.mutate(comment.id)}>Закрыть замечание</Button>}
      </article>)}
      {!comments.length && <p className="text-sm text-slate-500">Открытых замечаний нет</p>}
    </div>
    {canAdd && <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3">
      <label className="text-sm font-bold">Раздел<select value={sectionCode} onChange={(event) => setSectionCode(event.target.value as PekSectionCode)} className="mt-1 w-full rounded-xl border p-2">{sections.map((section) => <option key={section.value} value={section.value}>{section.label}</option>)}</select></label>
      <label className="text-sm font-bold">Текст замечания<textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border p-2" /></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={mandatory} onChange={(event) => setMandatory(event.target.checked)} />Обязательное</label>
      <Button type="button" disabled={!text.trim() || create.isPending} onClick={() => create.mutate()}>Добавить замечание</Button>
    </div>}
    {error && <p role="alert" className="mt-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
  </section>;
};

export default PekReviewPanel;
