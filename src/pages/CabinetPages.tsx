import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import { payments, services, statusDescriptions, type Order } from '../data/mockData';
import { addComment, createOrder, getClientOrders, getOrderById, uploadDocument } from '../services/orderService';
import { getCurrentUser } from '../services/authService';

const badge = (status: string) => <span className="rounded-full bg-eco-50 px-3 py-1 text-xs font-bold text-eco-800">{status}</span>;

const useClientOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const refresh = () => getClientOrders(getCurrentUser()).then(setOrders);
  useEffect(() => { refresh(); }, []);
  return { orders, refresh };
};

export const CabinetDashboardPage = () => {
  const { orders } = useClientOrders();
  const stats = [
    ['Всего заявок', orders.length],
    ['В работе', orders.filter((o) => ['В обработке', 'В работе', 'На проверке'].includes(o.status)).length],
    ['Ожидают документы', orders.filter((o) => o.status === 'Ожидает документы').length],
    ['Завершены', orders.filter((o) => ['Готово', 'Завершено'].includes(o.status)).length],
  ];
  return (
    <div>
      <Reveal><h2 className="text-3xl font-bold text-eco-900">Обзор кабинета</h2></Reveal>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {stats.map(([label, value], index) => (
          <Reveal key={String(label)} delay={index * 0.04}><div className="rounded-[20px] bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-eco-900">{value}</p></div></Reveal>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Reveal><Panel title="Последние заявки">{orders.slice(0, 4).map((order) => <OrderRow key={order.id} order={order} />)}</Panel></Reveal>
        <Reveal delay={0.06}><Panel title="Последние уведомления">{['Комментарий специалиста добавлен', 'Документ готов к скачиванию', 'Статус заявки обновлен'].map((item) => <p key={item} className="rounded-2xl bg-eco-50 p-4 text-sm text-slate-700">{item}</p>)}</Panel></Reveal>
      </div>
    </div>
  );
};

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="rounded-[22px] bg-white p-6 shadow-sm"><h3 className="mb-4 text-xl font-bold text-eco-900">{title}</h3><div className="space-y-3">{children}</div></div>;

const OrderRow = ({ order }: { order: Order }) => (
  <Link to={`/cabinet/orders/${order.id}`} className="flex items-center justify-between gap-4 rounded-2xl bg-eco-50 p-4 hover:bg-eco-100">
    <div><p className="font-semibold text-slate-900">{order.id}</p><p className="text-sm text-slate-600">{order.service}</p></div>
    {badge(order.status)}
  </Link>
);

export const CabinetOrdersPage = () => {
  const { orders } = useClientOrders();
  return <PageList title="Заявки">{orders.map((order) => <OrderRow key={order.id} order={order} />)}</PageList>;
};

const PageList = ({ title, children }: { title: string; children: React.ReactNode }) => <Reveal><div className="rounded-[22px] bg-white p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-bold text-eco-900">{title}</h2><Link to="/cabinet/orders/new"><Button>Новая заявка</Button></Link></div><div className="space-y-3">{children}</div></div></Reveal>;

export const CabinetNewOrderPage = ({ onNotify }: { onNotify?: (message: string) => void }) => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const serviceId = String(form.get('serviceId'));
    const service = services.find((item) => item.id === serviceId) ?? services[0];
    const file = form.get('file') as File | null;
    const order = await createOrder({
      user,
      contactPerson: String(form.get('contactPerson')),
      phone: String(form.get('phone')),
      email: String(form.get('email')),
      companyName: String(form.get('companyName')),
      bin: String(form.get('bin')),
      serviceId,
      service: service.title,
      urgency: String(form.get('urgency')),
      comment: String(form.get('comment')),
      fileName: file?.name,
    });
    onNotify?.('Заявка создана. Специалист ECOPROGRESS GROUP скоро свяжется с вами.');
    navigate(`/cabinet/orders/${order.id}`);
  };
  return (
    <Reveal>
      <form onSubmit={submit} className="rounded-[24px] bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-eco-900">Новая заявка</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Input name="contactPerson" label="Контактное лицо" defaultValue={user?.name} />
          <Input name="phone" label="Телефон" defaultValue={user?.phone} />
          <Input name="email" label="Email" type="email" defaultValue={user?.email} />
          <Input name="companyName" label="Название компании" defaultValue={user?.companyName ?? user?.name} />
          <Input name="bin" label="БИН" defaultValue={user?.bin} />
          <label className="text-sm font-semibold text-slate-700">Услуга<select name="serviceId" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">{services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700">Срочность<select name="urgency" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"><option>Стандартная</option><option>Срочно</option><option>Не срочно</option></select></label>
          <label className="text-sm font-semibold text-slate-700">Прикрепить файл<input name="file" type="file" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        </div>
        <label className="mt-4 block text-sm font-semibold text-slate-700">Комментарий<textarea name="comment" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={4} /></label>
        <Button className="mt-6">Отправить заявку</Button>
      </form>
    </Reveal>
  );
};

const Input = ({ name, label, type = 'text', defaultValue = '' }: { name: string; label: string; type?: string; defaultValue?: string }) => <label className="text-sm font-semibold text-slate-700">{label}<input name={name} type={type} required defaultValue={defaultValue} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>;

export const CabinetOrderDetailsPage = ({ onNotify }: { onNotify?: (message: string) => void }) => {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | undefined>();
  const load = () => id && getOrderById(id).then(setOrder);
  useEffect(() => { load(); }, [id]);
  if (!id) return <Navigate to="/cabinet/orders" replace />;
  if (!order) return <div className="rounded-2xl bg-white p-6">Загрузка заявки...</div>;
  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await addComment(order.id, String(form.get('comment')), 'client', getCurrentUser()?.name ?? 'Клиент');
    onNotify?.('Комментарий добавлен');
    event.currentTarget.reset();
    load();
  };
  const submitFile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get('file') as File | null;
    if (file?.name) await uploadDocument(order.id, file.name, 'client');
    onNotify?.('Документ загружен');
    event.currentTarget.reset();
    load();
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Reveal>
        <div className="rounded-[24px] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold text-eco-900">{order.id}</h2><p className="mt-1 text-slate-600">{order.service}</p></div>{badge(order.status)}</div>
          <p className="mt-4 rounded-2xl bg-eco-50 p-4 text-sm text-slate-700">{statusDescriptions[order.status]}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Info label="Дата создания" value={order.createdAt} />
            <Info label="Срочность" value={order.urgency} />
            <Info label="Комментарий клиента" value={order.comment} />
            <Info label="Ответственный" value={order.manager} />
          </div>
          <Section title="Документы клиента" items={order.documents.map((d) => d.name)} />
          <Section title="Документы ECOPROGRESS GROUP" items={order.resultDocuments.map((d) => d.name)} />
          <Section title="Комментарии сотрудника" items={order.comments.filter((c) => c.visibility === 'client').map((c) => `${c.author}: ${c.text}`)} />
          <Section title="История заявки" items={order.history.map((h) => `${h.createdAt} - ${h.text}`)} />
        </div>
      </Reveal>
      <Reveal direction="left">
        <div className="space-y-5">
          <form onSubmit={submitFile} className="rounded-[22px] bg-white p-5 shadow-sm"><h3 className="font-bold text-eco-900">Загрузить документ</h3><input name="file" type="file" required className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3" /><Button className="mt-4 w-full">Загрузить</Button></form>
          <form onSubmit={submitComment} className="rounded-[22px] bg-white p-5 shadow-sm"><h3 className="font-bold text-eco-900">Написать комментарий</h3><textarea name="comment" required className="input-focus mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={4} /><Button className="mt-4 w-full">Отправить</Button></form>
        </div>
      </Reveal>
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => <div className="rounded-2xl bg-eco-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-2 text-sm text-slate-800">{value || 'Не указано'}</p></div>;

const Section = ({ title, items }: { title: string; items: string[] }) => <div className="mt-6"><h3 className="font-bold text-eco-900">{title}</h3><div className="mt-3 space-y-2">{items.length ? items.map((item) => <div key={item} className="rounded-2xl bg-eco-50 p-3 text-sm text-slate-700">{item}</div>) : <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">Пока нет данных</div>}</div></div>;

export const CabinetDocumentsPage = () => {
  const { orders } = useClientOrders();
  const docs = orders.flatMap((o) => [...o.documents, ...o.resultDocuments]);
  return <PageList title="Документы">{docs.map((doc) => <div key={doc.id} className="rounded-2xl bg-eco-50 p-4 text-sm">{doc.name} · {doc.status}</div>)}</PageList>;
};

export const CabinetPaymentsPage = () => <PageList title="Оплаты">{payments.map((p) => <div key={p.id} className="rounded-2xl bg-eco-50 p-4 text-sm">{p.invoice} · {p.service} · {p.amount} · {p.status}</div>)}</PageList>;

export const CabinetCompanyPage = () => {
  const user = getCurrentUser();
  return <Reveal><div className="rounded-[22px] bg-white p-6 shadow-sm"><h2 className="text-2xl font-bold text-eco-900">{user?.type === 'individual' ? 'Профиль' : 'Данные компании'}</h2><div className="mt-5 grid gap-4 md:grid-cols-2">{Object.entries(user ?? {}).filter(([k]) => !['role', 'type', 'id'].includes(k)).map(([k, v]) => <Info key={k} label={k} value={String(v)} />)}</div></div></Reveal>;
};

export const CabinetNotificationsPage = () => <PageList title="Уведомления">{['Заявка создана', 'Статус обновлен', 'Документ готов'].map((n) => <div key={n} className="rounded-2xl bg-eco-50 p-4 text-sm">{n}</div>)}</PageList>;
