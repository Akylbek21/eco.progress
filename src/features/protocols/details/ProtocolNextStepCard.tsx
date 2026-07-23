import { normalizeProtocolStatus } from '../../../config/protocolStatus';
import type { Protocol } from '../../../types/protocols';

type MissingItem = { label: string };
type Props = { protocol: Protocol; missing: MissingItem[] };

const ProtocolNextStepCard = ({ protocol, missing }: Props) => {
  const status = normalizeProtocolStatus(protocol.status);
  const revisionComment = [...(protocol.history || [])].reverse().find((item) => /REVISION|RETURN/i.test(item.action) && item.comment)?.comment;
  let title = 'Данные готовы';
  let text = 'Можно переходить к следующему этапу.';
  if (status === 'DRAFT') { title = missing.length ? `Нужно заполнить: ${missing.length}` : 'Черновик заполнен'; text = missing.length ? 'Исправьте недостающие данные перед проверкой.' : 'Проверьте результаты и выполните расчёт.'; }
  if (status === 'CALCULATED') { title = 'Расчёт выполнен'; text = 'Следующий этап — передать протокол руководителю на проверку.'; }
  if (status === 'READY') { title = 'Протокол подготовлен'; text = 'Проверьте данные перед дальнейшей передачей.'; }
  if (status === 'READY_FOR_APPROVAL') { title = 'Протокол отправлен руководителю'; text = 'Исполнителю ничего делать не нужно.'; }
  if (status === 'NEEDS_REVISION') { title = 'Нужно исправить'; text = revisionComment ? `Руководитель указал: «${revisionComment}»` : 'Исправьте замечания и повторно передайте протокол на проверку.'; }
  if (status === 'APPROVED') { title = 'Протокол утверждён'; text = 'Следующий этап — подписание.'; }
  if (status === 'SIGNED') { title = 'Протокол подписан'; text = 'Документ готов к скачиванию.'; }
  if (status === 'REPLACED') { title = 'Создана новая версия'; text = 'Этот протокол заменён и доступен только для просмотра.'; }
  if (status === 'CANCELLED') { title = 'Протокол отменён'; text = 'Редактирование недоступно.'; }
  if (status === 'ARCHIVED') { title = 'Протокол находится в архиве'; text = 'Доступны просмотр и скачивание документов.'; }
  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${missing.length && ['DRAFT', 'NEEDS_REVISION'].includes(status) ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-700">{text}</p>
      {missing.length > 0 && ['DRAFT', 'NEEDS_REVISION'].includes(status) && (
        <details className="mt-3 text-sm text-amber-950">
          <summary className="cursor-pointer font-bold">Показать, что нужно исправить</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">{missing.map((item) => <li key={item.label}>{item.label}</li>)}</ul>
        </details>
      )}
    </section>
  );
};

export default ProtocolNextStepCard;
