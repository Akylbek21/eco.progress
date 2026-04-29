import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileSignature,
  FileText,
  MessageSquare,
  Upload,
  UserCheck,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import { clients, notifications, services, statusDescriptions, type Order, type OrderStatus } from '../data/mockData';
import { addComment, assignManager, getOrderById, getOrders, sendContractAndInvoice, updateOrderStatus, uploadDocument } from '../services/staffOrderService';

const statuses: OrderStatus[] = ['Новая', 'В обработке', 'Ожидает документы', 'В работе', 'На проверке', 'Готово', 'Завершено', 'Отменено'];

const useOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const refresh = () => getOrders().then(setOrders);
  useEffect(() => { refresh(); }, []);
  return { orders, refresh };
};

const statusClass = (status: string) => {
  if (status === 'Новая') return 'bg-sky-50 text-sky-800';
  if (status === 'Ожидает документы') return 'bg-amber-50 text-amber-800';
  if (status === 'Готово' || status === 'Завершено') return 'bg-emerald-50 text-emerald-800';
  if (status === 'Отменено') return 'bg-rose-50 text-rose-800';
  return 'bg-eco-50 text-eco-800';
};

const badge = (status: string) => <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(status)}`}>{status}</span>;

const onlineState = (order: Order) => {
  if (order.paymentStatus === 'paid' && order.contractStatus === 'signed') return { label: 'Подписано и оплачено', tone: 'bg-emerald-50 text-emerald-800' };
  if (order.contractStatus === 'signed') return { label: 'Договор подписан', tone: 'bg-emerald-50 text-emerald-800' };
  if (order.paymentStatus === 'paid') return { label: 'Оплата получена', tone: 'bg-emerald-50 text-emerald-800' };
  if (order.contractStatus === 'sent' || order.paymentStatus === 'pending') return { label: 'Ждет клиента', tone: 'bg-amber-50 text-amber-800' };
  return { label: 'Нужно проверить', tone: 'bg-slate-100 text-slate-700' };
};

const contractState = (order: Order) => {
  if (order.contractStatus === 'signed') return { title: 'Договор подписан', text: order.signedAt || 'Клиент подписал договор', tone: 'border-emerald-200 bg-emerald-50 text-emerald-900' };
  if (order.contractStatus === 'sent') return { title: 'Договор отправлен', text: order.signatureProvider || 'Ожидается подпись клиента', tone: 'border-amber-200 bg-amber-50 text-amber-900' };
  return { title: 'Договор не отправлен', text: 'Проверьте заявку и отправьте договор клиенту', tone: 'border-slate-200 bg-slate-50 text-slate-700' };
};

const paymentState = (order: Order) => {
  if (order.paymentStatus === 'paid') return { title: 'Оплата получена', text: order.paidAt || order.paymentAmount || 'Счет оплачен', tone: 'border-emerald-200 bg-emerald-50 text-emerald-900' };
  if (order.paymentStatus === 'pending') return { title: 'Счет выставлен', text: `${order.paymentAmount || 'Сумма указана'} · ${order.paymentMethod || 'Онлайн-оплата'}`, tone: 'border-amber-200 bg-amber-50 text-amber-900' };
  return { title: 'Счет не выставлен', text: 'После проверки отправьте счет клиенту', tone: 'border-slate-200 bg-slate-50 text-slate-700' };
};

const nextStep = (order: Order) => {
  if (order.status === 'Новая') return 'Проверить заявку';
  if (!order.contractStatus || order.contractStatus === 'not_sent') return 'Отправить договор и счет';
  if (order.contractStatus === 'sent' && order.paymentStatus !== 'paid') return 'Ожидать подпись и оплату';
  if (order.contractStatus === 'signed' && order.paymentStatus === 'paid') return 'Передать в работу';
  if (order.status === 'Готово') return 'Закрыть заявку';
  return 'Вести заявку';
};

export const StaffDashboardPage = () => {
  const { orders } = useOrders();
  const stats = [
    ['Новые', orders.filter((o) => o.status === 'Новая').length, 'Нужно первично проверить'],
    ['Без счета', orders.filter((o) => !o.contractStatus || o.contractStatus === 'not_sent').length, 'Нужно отправить договор'],
    ['Ждут клиента', orders.filter((o) => o.contractStatus === 'sent' || o.paymentStatus === 'pending').length, 'Подпись или оплата'],
    ['В работе', orders.filter((o) => ['В обработке', 'В работе', 'На проверке'].includes(o.status)).length, 'Активные заявки'],
    ['Готово', orders.filter((o) => ['Готово', 'Завершено'].includes(o.status)).length, 'Можно закрывать'],
  ];

  return (
    <div>
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-eco-500">Рабочая очередь</p>
            <h2 className="mt-2 text-3xl font-bold text-eco-900">Кабинет сотрудника</h2>
          </div>
          <Link to="/staff/orders"><Button>Открыть все заявки</Button></Link>
        </div>
      </Reveal>

      <div className="mt-6 grid gap-4 md:grid-cols-5">
        {stats.map(([label, count, hint], index) => (
          <Reveal key={label} delay={index * 0.04}>
            <div className="rounded-[20px] bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-bold text-eco-900">{count}</p>
              <p className="mt-2 text-xs text-slate-500">{hint}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <StaffPanel title="Заявки, которые требуют действия">
          {orders.slice(0, 6).map((order) => <OrderLine key={order.id} order={order} />)}
        </StaffPanel>
        <StaffPanel title="Как работать с заявкой">
          {[
            'Откройте новую заявку и проверьте данные клиента.',
            'Если данных не хватает, запросите документы или напишите клиенту.',
            'Когда все понятно, отправьте договор и счет.',
            'После подписи и оплаты передайте заявку в работу.',
          ].map((item, index) => (
            <div key={item} className="flex gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-eco-900 text-xs font-bold text-white">{index + 1}</span>
              <span className="pt-1 text-slate-700">{item}</span>
            </div>
          ))}
        </StaffPanel>
      </div>
    </div>
  );
};

const StaffPanel = ({ title, children }: { title: string; children: ReactNode }) => (
  <Reveal>
    <div className="rounded-[22px] bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-xl font-bold text-eco-900">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  </Reveal>
);

const OrderLine = ({ order }: { order: Order }) => {
  const online = onlineState(order);
  return (
    <Link to={`/staff/orders/${order.id}`} className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-eco-50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{order.id} · {order.clientName}</p>
          <p className="mt-1 text-sm text-slate-600">{order.companyName || 'Физическое лицо'} · {order.service}</p>
          <p className="mt-2 text-xs font-semibold text-eco-700">{nextStep(order)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {badge(order.status)}
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${online.tone}`}>{online.label}</span>
        </div>
      </div>
    </Link>
  );
};

export const StaffOrdersPage = () => {
  const { orders } = useOrders();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Все');
  const [service, setService] = useState('Все');
  const filtered = useMemo(() => orders
    .filter((o) => status === 'Все' || o.status === status)
    .filter((o) => service === 'Все' || o.service === service)
    .filter((o) => `${o.id} ${o.clientName} ${o.companyName} ${o.service}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.id.localeCompare(a.id)), [orders, q, status, service]);

  return (
    <Reveal>
      <div className="rounded-[22px] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-eco-900">Заявки клиентов</h2>
            <p className="mt-1 text-sm text-slate-500">Фильтруйте очередь и открывайте заявку для проверки, счета и договора.</p>
          </div>
          <p className="rounded-full bg-eco-50 px-4 py-2 text-sm font-semibold text-eco-800">Найдено: {filtered.length}</p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по номеру, клиенту или услуге" className="input-focus rounded-2xl border border-slate-200 px-4 py-3" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-focus rounded-2xl border border-slate-200 px-4 py-3"><option>Все</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
          <select value={service} onChange={(e) => setService(e.target.value)} className="input-focus rounded-2xl border border-slate-200 px-4 py-3"><option>Все</option>{services.map((s) => <option key={s.id}>{s.title}</option>)}</select>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-slate-500">
              <tr><th className="p-3">Заявка</th><th>Клиент</th><th>Услуга</th><th>Дата</th><th>Статус</th><th>Онлайн</th><th>Следующий шаг</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const online = onlineState(order);
                return (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="p-3 font-semibold text-slate-900">{order.id}</td>
                    <td><p>{order.clientName}</p><p className="text-xs text-slate-500">{order.companyName}</p></td>
                    <td>{order.service}</td>
                    <td>{order.createdAt}</td>
                    <td>{badge(order.status)}</td>
                    <td><span className={`rounded-full px-3 py-1 text-xs font-bold ${online.tone}`}>{online.label}</span></td>
                    <td className="font-semibold text-slate-700">{nextStep(order)}</td>
                    <td><Link to={`/staff/orders/${order.id}`} className="font-bold text-eco-700">Открыть</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Reveal>
  );
};

export const StaffOrderDetailsPage = ({ onNotify }: { onNotify?: (message: string) => void }) => {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | undefined>();
  const load = () => id && getOrderById(id).then(setOrder);
  useEffect(() => { load(); }, [id]);
  if (!id) return <Navigate to="/staff/orders" replace />;
  if (!order) return <div className="rounded-2xl bg-white p-6">Загрузка заявки...</div>;

  const changeStatus = async (status: OrderStatus) => {
    await updateOrderStatus(order.id, status);
    onNotify?.('Статус заявки обновлен');
    load();
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>, visibility: 'client' | 'internal') => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await addComment(order.id, String(form.get('comment')), visibility);
    onNotify?.('Комментарий добавлен');
    event.currentTarget.reset();
    load();
  };

  const submitDoc = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get('file') as File | null;
    if (file?.name) await uploadDocument(order.id, file.name, 'result');
    onNotify?.('Документ загружен');
    event.currentTarget.reset();
    load();
  };

  const submitManager = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await assignManager(order.id, String(new FormData(event.currentTarget).get('manager')));
    onNotify?.('Ответственный назначен');
    load();
  };

  const submitContractAndInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const contract = form.get('contract') as File | null;
    await sendContractAndInvoice(order.id, {
      amount: String(form.get('amount')),
      paymentMethod: String(form.get('paymentMethod')),
      signatureProvider: String(form.get('signatureProvider')),
      contractFileName: contract?.name,
    });
    await updateOrderStatus(order.id, 'В обработке');
    onNotify?.('Договор и счет отправлены клиенту');
    event.currentTarget.reset();
    load();
  };

  const online = onlineState(order);

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="rounded-[24px] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link to="/staff/orders" className="text-sm font-semibold text-eco-700">← Все заявки</Link>
              <h2 className="mt-3 text-2xl font-bold text-eco-900">{order.id}</h2>
              <p className="mt-1 text-slate-600">{order.service}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {badge(order.status)}
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${online.tone}`}>{online.label}</span>
            </div>
          </div>
          <p className="mt-4 rounded-2xl bg-eco-50 p-4 text-sm text-slate-700">{statusDescriptions[order.status]}</p>
          <Workflow order={order} />
          <OrderReadiness order={order} />
        </div>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <Reveal>
          <div className="space-y-6">
            <Section title="Проверка заявки" icon={<ClipboardCheck size={20} />}>
              <ReviewChecklist order={order} />
              <Grid items={{ 'Дата создания': order.createdAt, Статус: order.status, Срочность: order.urgency, 'Комментарий клиента': order.comment }} />
            </Section>
            <Section title="Клиент" icon={<UserCheck size={20} />}>
              <Grid items={{ 'Тип клиента': order.clientType === 'company' ? 'Юрлицо / ИП' : 'Физлицо', 'Контактное лицо': order.contactPerson, Телефон: order.phone, Email: order.email }} />
            </Section>
            <Section title="Компания" icon={<FileText size={20} />}>
              <Grid items={{ Компания: order.companyName, БИН: order.bin, 'Тип организации': order.organizationType, 'Юридический адрес': order.legalAddress }} />
            </Section>
            <Section title="Документы" icon={<Upload size={20} />}>
              <List title="От клиента" items={order.documents.map((d) => `${d.name} · ${d.status} · ${d.uploadedAt}`)} />
              <List title="От ECOPROGRESS" items={order.resultDocuments.map((d) => `${d.name} · ${d.status} · ${d.uploadedAt}`)} />
            </Section>
            <Section title="История и комментарии" icon={<MessageSquare size={20} />}>
              <List title="Сообщения клиенту" items={order.comments.filter((c) => c.visibility === 'client').map((c) => `${c.createdAt}: ${c.text}`)} />
              <List title="Внутренние заметки" items={order.comments.filter((c) => c.visibility === 'internal').map((c) => `${c.createdAt}: ${c.text}`)} />
              <List title="История заявки" items={order.history.map((h) => `${h.createdAt}: ${h.text}`)} />
            </Section>
          </div>
        </Reveal>

        <Reveal direction="left">
          <div className="space-y-5">
            <Action title="Следующий шаг" icon={<CheckCircle2 size={20} />}>
              <p className="rounded-2xl bg-eco-50 p-4 text-sm font-semibold text-eco-900">{nextStep(order)}</p>
              <div className="mt-4 grid gap-3">
                <Button onClick={() => changeStatus('В обработке')} variant="secondary" className="w-full">Взять в обработку</Button>
                <Button onClick={() => changeStatus('Ожидает документы')} variant="secondary" className="w-full">Запросить документы</Button>
                <Button onClick={() => changeStatus('В работе')} className="w-full">Передать в работу</Button>
              </div>
            </Action>

            <Action title="Статус и ответственный" icon={<UserCheck size={20} />}>
              <label className="text-sm font-semibold text-slate-700">Статус
                <select value={order.status} onChange={(e) => changeStatus(e.target.value as OrderStatus)} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">{statuses.map((s) => <option key={s}>{s}</option>)}</select>
              </label>
              <form onSubmit={submitManager} className="mt-4">
                <label className="text-sm font-semibold text-slate-700">Ответственный
                  <input name="manager" defaultValue={order.manager} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
                </label>
                <Button className="mt-4 w-full">Сохранить</Button>
              </form>
            </Action>

            <Action title="Договор и счет" icon={<FileSignature size={20} />}>
              <p className="text-sm leading-6 text-slate-600">После проверки отправьте клиенту договор на подпись и счет на оплату. Только после этого клиент увидит кнопки ЭЦП и оплаты.</p>
              <form onSubmit={submitContractAndInvoice} className="mt-4 space-y-4">
                <Field label="Сумма к оплате"><input name="amount" required defaultValue={order.paymentAmount || '150 000 ₸'} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
                <Field label="Способ оплаты"><select name="paymentMethod" defaultValue={order.paymentMethod || 'Банковская карта'} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3"><option>Банковская карта</option><option>Kaspi Pay</option><option>Счет на оплату</option></select></Field>
                <Field label="Подписание"><select name="signatureProvider" defaultValue={order.signatureProvider || 'NCALayer / ЭЦП'} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3"><option>NCALayer / ЭЦП</option><option>Kaspi ID</option><option>SMS-подтверждение</option></select></Field>
                <Field label="Файл договора"><input name="contract" type="file" className="w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
                <Button className="w-full">{order.contractStatus === 'sent' || order.contractStatus === 'signed' ? 'Отправить заново' : 'Отправить клиенту'}</Button>
              </form>
            </Action>

            <Action title="Сообщение клиенту" icon={<MessageSquare size={20} />}>
              <form onSubmit={(event) => submitComment(event, 'client')}>
                <textarea name="comment" required placeholder="Напишите, что нужно уточнить или что отправлено клиенту" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" rows={3} />
                <Button className="mt-4 w-full">Отправить</Button>
              </form>
            </Action>

            <Action title="Внутренняя заметка" icon={<Bell size={20} />}>
              <form onSubmit={(event) => submitComment(event, 'internal')}>
                <textarea name="comment" required placeholder="Заметка видна только сотрудникам" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" rows={3} />
                <Button variant="secondary" className="mt-4 w-full">Добавить заметку</Button>
              </form>
            </Action>

            <Action title="Готовый документ" icon={<CreditCard size={20} />}>
              <form onSubmit={submitDoc}>
                <input name="file" type="file" required className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
                <Button className="mt-4 w-full">Загрузить результат</Button>
              </form>
            </Action>

            <Button onClick={() => changeStatus('Завершено')} className="w-full">Завершить заявку</Button>
          </div>
        </Reveal>
      </div>
    </div>
  );
};

const Workflow = ({ order }: { order: Order }) => {
  const steps = [
    ['Заявка', true],
    ['Проверка', order.status !== 'Новая'],
    ['Договор и счет', order.contractStatus === 'sent' || order.contractStatus === 'signed'],
    ['Подпись и оплата', order.contractStatus === 'signed' || order.paymentStatus === 'paid'],
  ] as const;
  return (
    <div className="mt-5 grid gap-3 md:grid-cols-4">
      {steps.map(([label, done], index) => (
        <div key={label} className={`rounded-2xl border p-4 ${done ? 'border-eco-200 bg-eco-50' : 'border-slate-200 bg-slate-50'}`}>
          <p className="text-xs font-semibold uppercase text-slate-500">Шаг {index + 1}</p>
          <p className="mt-2 font-bold text-slate-900">{label}</p>
        </div>
      ))}
    </div>
  );
};

const OrderReadiness = ({ order }: { order: Order }) => {
  const contract = contractState(order);
  const payment = paymentState(order);
  return (
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      <div className={`rounded-2xl border p-4 ${contract.tone}`}>
        <div className="flex items-start gap-3">
          <FileSignature size={20} />
          <div>
            <p className="font-bold">{contract.title}</p>
            <p className="mt-1 text-sm opacity-80">{contract.text}</p>
          </div>
        </div>
      </div>
      <div className={`rounded-2xl border p-4 ${payment.tone}`}>
        <div className="flex items-start gap-3">
          <CreditCard size={20} />
          <div>
            <p className="font-bold">{payment.title}</p>
            <p className="mt-1 text-sm opacity-80">{payment.text}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReviewChecklist = ({ order }: { order: Order }) => {
  const items = [
    ['Контакты клиента', Boolean(order.contactPerson && order.phone && order.email)],
    ['Данные компании', order.clientType === 'individual' || Boolean(order.companyName && order.bin)],
    ['Услуга и срочность', Boolean(order.service && order.urgency)],
    ['Документы клиента', order.documents.length > 0],
  ] as const;
  return (
    <div className="mb-4 grid gap-3 md:grid-cols-2">
      {items.map(([label, done]) => (
        <div key={label} className={`flex items-center gap-3 rounded-2xl border p-4 text-sm ${done ? 'border-emerald-100 bg-emerald-50 text-emerald-900' : 'border-amber-100 bg-amber-50 text-amber-900'}`}>
          <CheckCircle2 size={18} />
          <span className="font-semibold">{label}</span>
          <span className="ml-auto text-xs font-bold">{done ? 'OK' : 'Проверить'}</span>
        </div>
      ))}
    </div>
  );
};

const Action = ({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) => (
  <div className="rounded-[22px] bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center gap-3 text-eco-900">
      {icon}
      <h3 className="font-bold">{title}</h3>
    </div>
    {children}
  </div>
);

const Section = ({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) => (
  <div className="rounded-[22px] bg-white p-6 shadow-sm">
    <div className="mb-4 flex items-center gap-3 text-eco-900">
      {icon}
      <h3 className="text-xl font-bold">{title}</h3>
    </div>
    {children}
  </div>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block text-sm font-semibold text-slate-700">
    {label}
    <div className="mt-2">{children}</div>
  </label>
);

const Grid = ({ items }: { items: Record<string, string> }) => (
  <div className="grid gap-3 md:grid-cols-2">
    {Object.entries(items).map(([key, value]) => (
      <div key={key} className="rounded-2xl bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase text-slate-500">{key}</p>
        <p className="mt-2 text-sm text-slate-800">{value || 'Не указано'}</p>
      </div>
    ))}
  </div>
);

const List = ({ title, items }: { title: string; items: string[] }) => (
  <div className="mt-4 first:mt-0">
    <h4 className="font-semibold text-slate-900">{title}</h4>
    <div className="mt-3 space-y-2">
      {items.length ? items.map((item) => <p key={item} className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{item}</p>) : <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">Пока нет данных</p>}
    </div>
  </div>
);

export const StaffClientsPage = () => (
  <SimpleStaffPage title="Клиенты">
    {clients.map((client) => <p key={client.id} className="rounded-2xl bg-slate-50 p-4">{client.name} · {client.contact} · заявок: {client.orders}</p>)}
  </SimpleStaffPage>
);

export const StaffDocumentsPage = () => {
  const { orders } = useOrders();
  return (
    <SimpleStaffPage title="Документы">
      {orders.flatMap((order) => [...order.documents, ...order.resultDocuments]).map((doc) => <p key={doc.id} className="rounded-2xl bg-slate-50 p-4">{doc.name} · {doc.status}</p>)}
    </SimpleStaffPage>
  );
};

export const StaffNotificationsPage = () => (
  <SimpleStaffPage title="Уведомления">
    {notifications.map((notification) => <p key={notification.id} className="rounded-2xl bg-slate-50 p-4">{notification.title} · {notification.date}</p>)}
  </SimpleStaffPage>
);

export const StaffProfilePage = () => (
  <SimpleStaffPage title="Профиль">
    <p className="rounded-2xl bg-slate-50 p-4">Менеджер по работе с клиентами · manager@ecoprogress.kz</p>
  </SimpleStaffPage>
);

const SimpleStaffPage = ({ title, children }: { title: string; children: ReactNode }) => (
  <Reveal>
    <div className="rounded-[22px] bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-2xl font-bold text-eco-900">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  </Reveal>
);
