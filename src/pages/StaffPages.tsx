import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import { clients, notifications, services, statusDescriptions, type Order, type OrderStatus } from '../data/mockData';
import { addComment, assignManager, getOrderById, getOrders, updateOrderStatus, uploadDocument } from '../services/staffOrderService';

const statuses: OrderStatus[] = ['Новая', 'В обработке', 'Ожидает документы', 'В работе', 'На проверке', 'Готово', 'Завершено', 'Отменено'];

const useOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const refresh = () => getOrders().then(setOrders);
  useEffect(() => { refresh(); }, []);
  return { orders, refresh };
};

const badge = (status: string) => <span className="rounded-full bg-eco-50 px-3 py-1 text-xs font-bold text-eco-800">{status}</span>;

export const StaffDashboardPage = () => {
  const { orders } = useOrders();
  const stats = ['Новая', 'В обработке', 'Ожидает документы', 'В работе', 'Готово'].map((status) => [status, orders.filter((o) => o.status === status).length]);
  return (
    <div>
      <Reveal><h2 className="text-3xl font-bold text-eco-900">Dashboard менеджера</h2></Reveal>
      <div className="mt-6 grid gap-4 md:grid-cols-5">{stats.map(([label, count], i) => <Reveal key={label} delay={i * 0.04}><div className="rounded-[20px] bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-eco-900">{count}</p></div></Reveal>)}</div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2"><StaffPanel title="Последние заявки">{orders.slice(0, 5).map((o) => <OrderLine key={o.id} order={o} />)}</StaffPanel><StaffPanel title="Последние уведомления">{notifications.filter((n) => n.role === 'MANAGER' || n.role === 'ALL').map((n) => <p key={n.id} className="rounded-2xl bg-slate-50 p-4 text-sm">{n.title}</p>)}</StaffPanel></div>
    </div>
  );
};

const StaffPanel = ({ title, children }: { title: string; children: React.ReactNode }) => <Reveal><div className="rounded-[22px] bg-white p-6 shadow-sm"><h3 className="mb-4 text-xl font-bold text-eco-900">{title}</h3><div className="space-y-3">{children}</div></div></Reveal>;

const OrderLine = ({ order }: { order: Order }) => <Link to={`/staff/orders/${order.id}`} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 hover:bg-eco-50"><div><p className="font-semibold text-slate-900">{order.id} · {order.clientName}</p><p className="text-sm text-slate-600">{order.companyName || 'Физическое лицо'} · {order.service}</p></div>{badge(order.status)}</Link>;

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
        <h2 className="text-2xl font-bold text-eco-900">Заявки клиентов</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" className="input-focus rounded-2xl border border-slate-200 px-4 py-3" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-focus rounded-2xl border border-slate-200 px-4 py-3"><option>Все</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
          <select value={service} onChange={(e) => setService(e.target.value)} className="input-focus rounded-2xl border border-slate-200 px-4 py-3"><option>Все</option>{services.map((s) => <option key={s.id}>{s.title}</option>)}</select>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-slate-500"><tr><th className="p-3">Номер</th><th>Клиент</th><th>Компания</th><th>Услуга</th><th>Дата</th><th>Статус</th><th>Ответственный</th><th></th></tr></thead>
            <tbody>{filtered.map((o) => <tr key={o.id} className="border-t border-slate-100"><td className="p-3 font-semibold">{o.id}</td><td>{o.clientName}</td><td>{o.companyName}</td><td>{o.service}</td><td>{o.createdAt}</td><td>{badge(o.status)}</td><td>{o.manager}</td><td><Link to={`/staff/orders/${o.id}`} className="font-bold text-eco-700">Открыть</Link></td></tr>)}</tbody>
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
  if (!order) return <div className="rounded-2xl bg-white p-6">Загрузка...</div>;

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

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Reveal>
        <div className="rounded-[24px] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap justify-between gap-4"><div><h2 className="text-2xl font-bold text-eco-900">{order.id}</h2><p className="mt-1 text-slate-600">{order.service}</p></div>{badge(order.status)}</div>
          <p className="mt-4 rounded-2xl bg-eco-50 p-4 text-sm">{statusDescriptions[order.status]}</p>
          <Grid title="Основная информация" items={{ 'Дата создания': order.createdAt, Статус: order.status, Срочность: order.urgency, 'Комментарий клиента': order.comment }} />
          <Grid title="Информация о клиенте" items={{ 'Тип клиента': order.clientType === 'company' ? 'Юрлицо / ИП' : 'Физлицо', 'Контактное лицо': order.contactPerson, Телефон: order.phone, Email: order.email }} />
          <Grid title="Данные компании" items={{ Компания: order.companyName, БИН: order.bin, 'Тип организации': order.organizationType, 'Юридический адрес': order.legalAddress }} />
          <List title="Документы клиента" items={order.documents.map((d) => `${d.name} · ${d.uploadedAt}`)} />
          <List title="Документы ECOPROGRESS GROUP" items={order.resultDocuments.map((d) => `${d.name} · ${d.status} · ${d.uploadedAt}`)} />
          <List title="Комментарии клиенту" items={order.comments.filter((c) => c.visibility === 'client').map((c) => `${c.createdAt}: ${c.text}`)} />
          <List title="Внутренние комментарии" items={order.comments.filter((c) => c.visibility === 'internal').map((c) => `${c.createdAt}: ${c.text}`)} />
          <List title="История заявки" items={order.history.map((h) => `${h.createdAt}: ${h.text}`)} />
        </div>
      </Reveal>
      <Reveal direction="left">
        <div className="space-y-5">
          <Action title="Изменить статус"><select value={order.status} onChange={(e) => changeStatus(e.target.value as OrderStatus)} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3">{statuses.map((s) => <option key={s}>{s}</option>)}</select></Action>
          <form onSubmit={submitManager} className="rounded-[22px] bg-white p-5 shadow-sm"><h3 className="font-bold text-eco-900">Назначить ответственного</h3><input name="manager" defaultValue={order.manager} className="input-focus mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3" /><Button className="mt-4 w-full">Назначить</Button></form>
          <form onSubmit={(e) => submitComment(e, 'client')} className="rounded-[22px] bg-white p-5 shadow-sm"><h3 className="font-bold text-eco-900">Комментарий клиенту</h3><textarea name="comment" required className="input-focus mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={3} /><Button className="mt-4 w-full">Добавить</Button></form>
          <form onSubmit={(e) => submitComment(e, 'internal')} className="rounded-[22px] bg-white p-5 shadow-sm"><h3 className="font-bold text-eco-900">Внутренний комментарий</h3><textarea name="comment" required className="input-focus mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={3} /><Button className="mt-4 w-full">Добавить</Button></form>
          <form onSubmit={submitDoc} className="rounded-[22px] bg-white p-5 shadow-sm"><h3 className="font-bold text-eco-900">Загрузить готовый документ</h3><input name="file" type="file" required className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3" /><Button className="mt-4 w-full">Загрузить</Button></form>
          <Button onClick={() => changeStatus('Ожидает документы')} variant="secondary" className="w-full">Запросить дополнительные документы</Button>
          <Button onClick={() => changeStatus('Завершено')} className="w-full">Завершить заявку</Button>
        </div>
      </Reveal>
    </div>
  );
};

const Action = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="rounded-[22px] bg-white p-5 shadow-sm"><h3 className="mb-4 font-bold text-eco-900">{title}</h3>{children}</div>;
const Grid = ({ title, items }: { title: string; items: Record<string, string> }) => <div className="mt-6"><h3 className="font-bold text-eco-900">{title}</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{Object.entries(items).map(([k, v]) => <div key={k} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">{k}</p><p className="mt-2 text-sm">{v || 'Не указано'}</p></div>)}</div></div>;
const List = ({ title, items }: { title: string; items: string[] }) => <div className="mt-6"><h3 className="font-bold text-eco-900">{title}</h3><div className="mt-3 space-y-2">{items.length ? items.map((i) => <p key={i} className="rounded-2xl bg-slate-50 p-3 text-sm">{i}</p>) : <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">Пока нет данных</p>}</div></div>;

export const StaffClientsPage = () => <SimpleStaffPage title="Клиенты">{clients.map((c) => <p key={c.id} className="rounded-2xl bg-slate-50 p-4">{c.name} · {c.contact} · заявок: {c.orders}</p>)}</SimpleStaffPage>;
export const StaffDocumentsPage = () => { const { orders } = useOrders(); return <SimpleStaffPage title="Документы">{orders.flatMap((o) => [...o.documents, ...o.resultDocuments]).map((d) => <p key={d.id} className="rounded-2xl bg-slate-50 p-4">{d.name} · {d.status}</p>)}</SimpleStaffPage>; };
export const StaffNotificationsPage = () => <SimpleStaffPage title="Уведомления">{notifications.map((n) => <p key={n.id} className="rounded-2xl bg-slate-50 p-4">{n.title} · {n.date}</p>)}</SimpleStaffPage>;
export const StaffProfilePage = () => <SimpleStaffPage title="Профиль"><p className="rounded-2xl bg-slate-50 p-4">Менеджер по работе с клиентами · manager@ecoprogress.kz</p></SimpleStaffPage>;

const SimpleStaffPage = ({ title, children }: { title: string; children: React.ReactNode }) => <Reveal><div className="rounded-[22px] bg-white p-6 shadow-sm"><h2 className="mb-5 text-2xl font-bold text-eco-900">{title}</h2><div className="space-y-3">{children}</div></div></Reveal>;
