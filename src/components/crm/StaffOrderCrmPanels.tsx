import { FormEvent, ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Send } from 'lucide-react';
import Button from '../ui/Button';
import type { Order, WasteRemoval } from '../../types';
import { formatCurrency } from '../../utils/payments';

type PanelProps = {
  order: Order;
  canEdit?: boolean;
};

type OfferPanelProps = PanelProps & {
  onCreate: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onStatus: (status: string) => void | Promise<void>;
};

export const CommercialOfferPanel = ({ order, canEdit = false, onCreate, onStatus }: OfferPanelProps) => (
  <Panel title="КП">
    <InfoGrid items={{
      Статус: commercialOfferStatus(order),
      Сумма: order.offerAmount ? formatCurrency(order.offerAmount) : 'Не указана',
      Срок: order.deadline || 'Не указан',
      Файл: order.resultDocuments.find((doc) => doc.name.toLowerCase().includes('кп'))?.name || 'Не загружен',
    }} />
    {canEdit && (
      <form onSubmit={onCreate} className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Сумма"><input name="amount" type="number" min="0" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Срок выполнения"><input name="deadline" type="date" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="PDF"><input name="file" type="file" accept="application/pdf" className="w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Комментарий"><input name="comment" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <div className="flex flex-wrap gap-3 md:col-span-2">
          <Button>Создать КП</Button>
          <Button type="button" variant="secondary" onClick={() => onStatus('sent_to_client')}>Отправить клиенту</Button>
          <Button type="button" variant="secondary" onClick={() => onStatus('approved')}>Согласовано</Button>
          <Button type="button" variant="secondary" onClick={() => onStatus('rejected')}>Отказ</Button>
        </div>
      </form>
    )}
  </Panel>
);

type ContractPanelProps = PanelProps & {
  onSendContract: (form: HTMLFormElement) => void | Promise<void>;
};

export const ContractDetailsPanel = ({ order, canEdit = false, onSendContract }: ContractPanelProps) => (
  <Panel title="Договор">
    <InfoGrid items={{
      Номер: order.contractId || 'Не создан',
      Дата: order.signedAt || 'Не указана',
      Сумма: order.contractAmount ? formatCurrency(order.contractAmount) : 'Не указана',
      Статус: contractStatus(order),
      Период: [order.contractPeriodStart, order.contractPeriodEnd].filter(Boolean).join(' - ') || 'Не указан',
      Файл: order.contractFileName || 'Не загружен',
    }} />
    {canEdit && (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSendContract(event.currentTarget);
        }}
        className="mt-5 grid gap-4 md:grid-cols-2"
      >
        <Field label="Номер договора"><input name="number" required defaultValue={order.contractId || ''} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Дата договора"><input name="contractDate" type="date" required className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Сумма"><input name="amount" type="number" min="0" required defaultValue={order.contractAmount || ''} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Тип договора">
          <select name="type" defaultValue={order.contractType === 'annual_quarterly' ? 'annual' : 'one_time'} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3">
            <option value="one_time">Разовый</option>
            <option value="annual">Годовой</option>
            <option value="quarterly">Квартальный</option>
            <option value="laboratory">Лабораторные услуги</option>
            <option value="projecting">Проектирование</option>
            <option value="waste">Вывоз отходов</option>
            <option value="complex">Комплексный</option>
          </select>
        </Field>
        <Field label="Дата начала"><input name="startDate" type="date" required defaultValue={order.contractPeriodStart || ''} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Дата окончания"><input name="endDate" type="date" required defaultValue={order.contractPeriodEnd || ''} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Файл договора"><input name="file" type="file" required accept="application/pdf" className="w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">Комментарий<textarea name="comment" rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <div className="md:col-span-2">
          <Button>Отправить договор клиенту</Button>
        </div>
      </form>
    )}
  </Panel>
);

type PaymentPanelProps = PanelProps & {
  canConfirm?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onPaymentStatusSubmit: (values: {
    status: 'not_paid' | 'partial' | 'paid' | 'debt';
    amount: string;
    paidAt: string;
    method: string;
    comment: string;
  }) => void | Promise<void>;
};

const invoicePaymentStatusText = (order: Order) => {
  const remaining = order.remainingAmount ?? 0;
  const due = order.dueDate ? new Date(order.dueDate) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (due) due.setHours(0, 0, 0, 0);
  const overdue = Boolean(due && !Number.isNaN(due.getTime()) && due.getTime() < today.getTime() && remaining > 0);
  if (order.paymentStatus === 'debt' || order.paymentStatus === ('overdue' as never) || overdue) return 'Просрочено / долг';
  if (order.paymentStatus === 'paid') return 'Полная оплата';
  if (order.paymentStatus === 'partial') return 'Частичная оплата';
  if (order.paymentStatus === 'pending' || order.paymentStatus === 'awaiting_payment' || order.paymentStatus === 'invoice_sent') return 'Ожидает оплаты';
  return 'Не оплачено';
};

export const InvoicePaymentPanel = ({ order, canEdit = false, canConfirm = false, onSubmit, onPaymentStatusSubmit }: PaymentPanelProps) => {
  const total = order.totalAmount || order.contractAmount || order.offerAmount || 0;
  const paid = order.paidAmount || 0;
  const remaining = order.remainingAmount ?? Math.max(0, total - paid);
  const [paymentStatus, setPaymentStatus] = useState<'not_paid' | 'partial' | 'paid' | 'debt'>(
    order.paymentStatus === 'paid' ? 'paid' : order.paymentStatus === 'partial' ? 'partial' : order.paymentStatus === 'debt' ? 'debt' : 'not_paid',
  );
  const defaultMethod = order.paymentMethod || 'bank_transfer';
  return (
    <Panel title="Счет и оплата">
      <InfoGrid items={{
        Договор: order.contractId || 'Нет',
        'Сумма договора': formatCurrency(total),
        'Номер счета': order.invoiceNumber || 'Не указан',
        'Дата счета': order.invoiceDate || order.invoiceSentAt || 'Не указана',
        'Статус оплаты': invoicePaymentStatusText(order),
        Оплачено: formatCurrency(paid),
        Остаток: formatCurrency(remaining),
        Комментарий: order.accountantComment || order.paymentComment || 'Нет',
      }} />
      {canEdit && (
        <div className="mt-5 space-y-5">
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
            <Field label="Номер счета"><input name="invoiceNumber" defaultValue={order.invoiceNumber || ''} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
            <Field label="Сумма счета"><input name="invoiceAmount" type="number" min="0" defaultValue={total || ''} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
            <Field label="Дата счета"><input name="invoiceDate" type="date" defaultValue={order.invoiceDate || ''} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
            <Field label="Срок оплаты"><input name="dueDate" type="date" defaultValue={order.dueDate || ''} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
            <Field label="Файл счета"><input name="invoiceFile" type="file" accept="application/pdf" className="w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
            <Field label="Способ оплаты">
              <select name="paymentMethod" defaultValue={defaultMethod} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3">
                <option value="bank_transfer">Банковский перевод</option>
                <option value="card">Карта</option>
                <option value="cash">Наличные</option>
                <option value="other">Другое</option>
              </select>
            </Field>
            <label className="text-sm font-semibold text-slate-700 md:col-span-2">Комментарий бухгалтера<textarea name="accountantComment" rows={3} defaultValue={order.accountantComment || order.paymentComment || ''} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
            <div className="md:col-span-2"><Button>Отправить счет клиенту</Button></div>
          </form>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              onPaymentStatusSubmit({
                status: paymentStatus,
                amount: String(form.get('partialAmount') || ''),
                paidAt: String(form.get('paidAt') || ''),
                method: String(form.get('paymentMethod') || defaultMethod),
                comment: String(form.get('paymentComment') || ''),
              });
            }}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Статус оплаты">
                <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as typeof paymentStatus)} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3">
                  <option value="not_paid">Не оплачено</option>
                  <option value="partial">Частичная оплата</option>
                  <option value="paid">Полная оплата</option>
                  <option value="debt">Просрочено / долг</option>
                </select>
              </Field>
              {paymentStatus !== 'partial' && <input type="hidden" name="paymentMethod" value={defaultMethod} />}
              {paymentStatus === 'partial' && (
                <>
                  <Field label="Сумма частичной оплаты"><input name="partialAmount" type="number" min="0" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
                  <Field label="Дата оплаты"><input name="paidAt" type="date" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
                  <Field label="Способ оплаты">
                    <select name="paymentMethod" defaultValue={defaultMethod} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3">
                      <option value="bank_transfer">Банковский перевод</option>
                      <option value="card">Карта</option>
                      <option value="cash">Наличные</option>
                      <option value="other">Другое</option>
                    </select>
                  </Field>
                  <label className="text-sm font-semibold text-slate-700 md:col-span-2">Комментарий<textarea name="paymentComment" rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
                </>
              )}
            </div>
            <Button type="submit" disabled={!canConfirm} className="mt-4">Применить оплату</Button>
          </form>
        </div>
      )}
      {!canConfirm && <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Подтвердить оплату может только бухгалтер или администратор.</p>}
    </Panel>
  );
};

type WastePanelProps = PanelProps & {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export const WasteRemovalPanel = ({ order, canEdit = false, onSubmit }: WastePanelProps) => (
  <Panel title="Вывоз / Утилизация">
    <InfoGrid items={{
      Статус: wasteStatus(order),
      Адрес: order.objectAddress || order.legalAddress || 'Не указан',
      Услуга: order.service,
      Ответственный: order.assignedEcologist || order.manager || 'Не назначен',
    }} />
    {canEdit && (
      <form onSubmit={onSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Тип отходов"><input name="wasteType" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Объем"><input name="volume" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Класс опасности"><input name="hazardClass" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Адрес вывоза"><input name="pickupAddress" defaultValue={order.objectAddress || order.legalAddress || ''} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Дата вывоза"><input name="pickupDate" type="date" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Транспорт"><input name="transport" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Водитель / исполнитель"><input name="driverOrExecutor" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Статус вывоза">
          <select name="status" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3">
            <option value="not_assigned">Не назначено</option>
            <option value="data_check">Проверка данных</option>
            <option value="date_agreement">Дата согласуется</option>
            <option value="visit_scheduled">Выезд назначен</option>
            <option value="removed">Вывоз выполнен</option>
            <option value="act_uploaded">Акт загружен</option>
            <option value="result_sent">Результат отправлен</option>
            <option value="completed">Завершено</option>
          </select>
        </Field>
        <Field label="Акт"><input name="act" type="file" className="w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <Field label="Фото"><input name="photos" type="file" multiple accept="image/*" className="w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">Комментарий<textarea name="comment" rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <Button>Сохранить этап</Button>
      </form>
    )}
  </Panel>
);

type AgreementPanelProps = PanelProps & {
  onSendDocument: (documentId: string, payload: { comment?: string; needsSignature: boolean; needsClientResponse: boolean; dueDate?: string }) => void | Promise<void>;
};

export const StaffAgreementPanel = ({ order, canEdit = false, onSendDocument }: AgreementPanelProps) => {
  const [documentId, setDocumentId] = useState('');
  const documents = [...(order.documents || []), ...(order.resultDocuments || [])];
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!documentId) return;
    return onSendDocument(documentId, {
      comment: String(form.get('comment') || ''),
      needsSignature: form.get('needsSignature') === 'on',
      needsClientResponse: form.get('needsClientResponse') === 'on',
      dueDate: String(form.get('dueDate') || ''),
    });
  };
  return (
    <Panel title="Согласование">
      <div className="space-y-3">
        {documents.map((doc) => (
          <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
            <div>
              <p className="font-bold text-slate-900">{doc.name}</p>
              <p className="mt-1 text-sm text-slate-500">{doc.status}</p>
            </div>
            <div className="flex gap-2">
              <a href={doc.fileUrl || `/api/files/documents/${doc.id}`} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-eco-800">Скачать</a>
              {canEdit && <button type="button" onClick={() => setDocumentId(doc.id)} className="inline-flex items-center gap-2 rounded-full bg-eco-900 px-3 py-2 text-xs font-bold text-white"><Send size={14} /> Отправить клиенту</button>}
            </div>
          </div>
        ))}
        {!documents.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Документов для согласования пока нет.</p>}
      </div>
      {documentId && canEdit && (
        <form onSubmit={submit} className="mt-5 grid gap-4 rounded-2xl bg-slate-50 p-4">
          <p className="font-bold text-eco-900">Отправить документ клиенту</p>
          <textarea name="comment" rows={3} placeholder="Комментарий клиенту" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" />
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input name="needsSignature" type="checkbox" className="accent-[#38C7BA]" /> Нужна подпись</label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input name="needsClientResponse" type="checkbox" className="accent-[#38C7BA]" /> Нужен ответ</label>
            <label className="text-sm font-semibold text-slate-700">Срок ответа<input name="dueDate" type="date" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
          </div>
          <div className="flex gap-3">
            <Button>Отправить клиенту</Button>
            <Button type="button" variant="secondary" onClick={() => setDocumentId('')}>Отмена</Button>
          </div>
        </form>
      )}
    </Panel>
  );
};

export const ResultPanel = ({ order }: PanelProps) => (
  <Panel title="Результат">
    <div className="grid gap-3 md:grid-cols-3">
      <StatusCheck label="Результат загружен" done={order.resultDocuments.length > 0} />
      <StatusCheck label="Документ отправлен клиенту" done={order.resultDocuments.some((doc) => /отправ|sent|готов/i.test(doc.status))} />
      <StatusCheck label="Заявка готова" done={['Готово', 'Завершено'].includes(order.status)} />
    </div>
    <div className="mt-5 space-y-3">
      {order.resultDocuments.map((doc) => (
        <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
          <div>
            <p className="font-bold text-slate-900">{doc.name}</p>
            <p className="mt-1 text-sm text-slate-500">{doc.status} · {doc.uploadedAt}</p>
          </div>
          <a href={doc.fileUrl || `/api/files/documents/${doc.id}`} className="rounded-full bg-eco-900 px-3 py-2 text-xs font-bold text-white">Скачать</a>
        </div>
      ))}
    </div>
  </Panel>
);

export const FinalChecklistPanel = ({ order }: PanelProps) => {
  const financeClosed = ['paid', 'transferred_to_specialist'].includes(order.paymentStatus || '');
  const noDebt = (order.remainingAmount || 0) <= 0 && !(order.quarters || []).some((quarter) => quarter.remainingAmount > 0);
  const items = [
    ['результат загружен', order.resultDocuments.length > 0],
    ['документ отправлен клиенту', order.resultDocuments.some((doc) => /отправ|sent|готов/i.test(doc.status))],
    ['клиент принял / подписал', order.contractStatus === 'signed' || order.crmContractStatus === 'signed'],
    ['оплата закрыта', financeClosed],
    ['нет активного долга', noDebt],
    ['все внутренние задачи завершены', !order.comments.some((comment) => comment.visibility === 'internal' && /todo|задач|сделать/i.test(comment.text))],
  ] as const;
  const canClose = items.every(([, done]) => done);
  return (
    <Panel title="Финальная проверка">
      <div className="grid gap-3 md:grid-cols-2">
        {items.map(([label, done]) => <StatusCheck key={label} label={label} done={done} />)}
      </div>
      {!canClose && <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Закрытие заявки доступно после выполнения всех пунктов.</p>}
      {canClose && <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Заявку можно закрыть.</p>}
    </Panel>
  );
};

export const ClientInfoPanel = ({ order }: PanelProps) => (
  <Panel title="Клиент">
    <InfoGrid items={{
      Клиент: order.clientName,
      Компания: order.companyName || order.clientName,
      'БИН / ИИН': order.bin || 'Не указан',
      Телефон: order.phone || 'Не указан',
      WhatsApp: order.whatsapp || 'Не указан',
      Email: order.email || 'Не указан',
      Город: ('city' in order ? String(order.city || '') : '') || 'Не указан',
      'Юридический адрес': order.legalAddress || 'Не указан',
    }} />
    <div className="mt-5 flex flex-wrap gap-3">
      <Link to={`/staff/clients/${encodeURIComponent(order.companyName || order.clientId)}`} className="rounded-full bg-eco-900 px-4 py-2 text-sm font-bold text-white">Карточка клиента</Link>
      <Link to="/staff/orders/new" className="rounded-full bg-eco-50 px-4 py-2 text-sm font-bold text-eco-800">Создать заявку</Link>
      <Link to="/staff/payments" className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">Оплаты клиента</Link>
    </div>
  </Panel>
);

const commercialOfferStatus = (order: Order) => {
  if (order.status === 'Подготовка КП') return 'Готовится';
  if (order.status === 'КП отправлено') return 'Отправлено клиенту';
  if (order.status === 'КП согласовано') return 'Согласовано';
  return order.offerAmount ? 'Готовится' : 'Не создано';
};

const contractStatus = (order: Order) => {
  if (order.crmContractStatus === 'waiting_signature') return 'Ожидает подписи';
  if (order.crmContractStatus === 'signed' || order.contractStatus === 'signed') return 'Подписан клиентом';
  if (order.crmContractStatus === 'sent_to_client' || order.contractStatus === 'sent') return 'Отправлен клиенту';
  if (order.crmContractStatus === 'rejected') return 'Требует исправления';
  return order.contractId ? 'Готовится' : 'Не создан';
};

const wasteStatus = (order: Order) => {
  if (order.status === 'Вывоз' || order.status === 'Утилизация') return 'Проверка данных';
  if (order.status === 'Проверка результата') return 'Результат отправлен';
  if (['Готово', 'Завершено'].includes(order.status)) return 'Завершено';
  return 'Не назначено';
};

const Panel = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="rounded-[22px] bg-white p-5 shadow-sm sm:p-6">
    <h3 className="text-xl font-bold text-eco-900">{title}</h3>
    <div className="mt-5">{children}</div>
  </section>
);

const InfoGrid = ({ items }: { items: Record<string, string | number> }) => (
  <div className="grid gap-3 md:grid-cols-3">
    {Object.entries(items).map(([label, value]) => (
      <div key={label} className="rounded-2xl bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
        <p className="mt-2 break-words font-bold text-slate-900">{value || 'Нет'}</p>
      </div>
    ))}
  </div>
);

const StatusCheck = ({ label, done }: { label: string; done: boolean }) => (
  <div className={`flex items-center gap-3 rounded-2xl p-4 ${done ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50 text-slate-700'}`}>
    <CheckCircle2 size={18} className={done ? 'text-emerald-600' : 'text-slate-400'} />
    <span className="text-sm font-semibold">{label}</span>
  </div>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="text-sm font-semibold text-slate-700">
    {label}
    <div className="mt-2">{children}</div>
  </label>
);
