import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type Order, type NotificationItem } from '../data/mockData';
import { getOrders, createOrder, getNotifications } from '../services/orderService';
import { services } from '../data/mockData';
import { documents, payments, notifications, clientProfile } from '../data/mockData';
import SectionTitle from '../components/ui/SectionTitle';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import StatusBadge from '../components/ui/StatusBadge';

const CabinetPage = ({ onNotify }: { onNotify: (message: string) => void }) => {
  const { data: orderList = [] } = useQuery<Order[]>({ queryKey: ['clientOrders'], queryFn: getOrders });
  const { data: notificationsList = [] } = useQuery<NotificationItem[]>({ queryKey: ['clientNotifications'], queryFn: getNotifications });
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    company: '',
    tin: '',
    service: services[0].title,
    comment: '',
  });
  const [created, setCreated] = useState(false);

  const counts = useMemo(
    () => ({
      total: orderList.length,
      inProgress: orderList.filter((item) => item.status === 'В работе').length,
      completed: orderList.filter((item) => item.status === 'Готово').length,
      awaiting: orderList.filter((item) => item.status === 'Ожидает документы').length,
    }),
    [orderList]
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const newOrder = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      service: form.service,
      company: form.company || 'Новая компания',
      createdAt: new Date().toLocaleDateString('ru-RU'),
      status: 'Новая' as const,
      manager: 'Менеджер',
    };
    await createOrder(newOrder);
    setCreated(true);
    onNotify('Заявка успешно отправлена и добавлена в список.');
    setForm({ ...form, comment: '' });
  };

  return (
    <div className="space-y-10">
      <section id="dashboard">
        <SectionTitle title="Панель клиента" subtitle="Dashboard" />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Всего заявок', value: counts.total },
            { label: 'В работе', value: counts.inProgress },
            { label: 'Завершенные', value: counts.completed },
            { label: 'Ожидают документы', value: counts.awaiting },
          ].map((item) => (
            <Card key={item.label} className="p-6">
              <p className="text-sm uppercase tracking-[0.24em] text-eco-700">{item.label}</p>
              <p className="mt-4 text-4xl font-semibold text-slate-900">{item.value}</p>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <Card className="p-6">
            <h3 className="text-xl font-semibold text-slate-900">Последние уведомления</h3>
            <div className="mt-5 space-y-4">
              {notificationsList.slice(0, 3).map((note) => (
                <div key={note.id} className="rounded-3xl bg-eco-50 p-4">
                  <p className="font-semibold text-slate-900">{note.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{note.description}</p>
                  <p className="mt-2 text-xs text-slate-500">{note.date}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-xl font-semibold text-slate-900">Последние заявки</h3>
            <div className="mt-5 space-y-4">
              {orderList.slice(0, 3).map((order) => (
                <div key={order.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{order.service}</p>
                      <p className="text-sm text-slate-500">{order.company}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-3 text-sm text-slate-500">#{order.id} • {order.createdAt}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section id="orders">
        <SectionTitle title="Мои заявки" subtitle="Список заявок" />
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr_0.7fr] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-xs uppercase tracking-[0.28em] text-slate-500 sm:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_0.8fr]">
            <span>Номер</span>
            <span>Услуга</span>
            <span>Дата</span>
            <span>Статус</span>
            <span>Специалист</span>
            <span>Действие</span>
          </div>
          <div className="space-y-3 px-6 py-4">
            {orderList.map((order) => (
              <div key={order.id} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr_0.7fr] items-center gap-4 rounded-3xl bg-eco-50 px-4 py-4 text-sm text-slate-700 sm:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_0.8fr]">
                <span className="font-semibold text-slate-900">{order.id}</span>
                <span>{order.service}</span>
                <span>{order.createdAt}</span>
                <span><StatusBadge status={order.status} /></span>
                <span>{order.manager}</span>
                <Button variant="ghost" className="px-4 py-2 text-xs">Подробнее</Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="create">
        <SectionTitle title="Создать заявку" subtitle="Новая заявка" />
        <Card>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="ФИО" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Иван Иванов" required />
              <Input label="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+7 (777) 123-45-67" required />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="example@mail.com" required />
              <Input label="Название компании" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="ООО «Пример»" required />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="БИН/ИИН" value={form.tin} onChange={(e) => setForm({ ...form, tin: e.target.value })} placeholder="123456789012" required />
              <Select label="Выберите услугу" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}>
                {services.map((service) => (
                  <option key={service.id} value={service.title}>{service.title}</option>
                ))}
              </Select>
            </div>
            <label className="block text-sm text-slate-700">
              Комментарий
              <textarea
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-eco-500 focus:ring-2 focus:ring-eco-100"
                rows={4}
                placeholder="Опишите задачу или вопросы"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Button type="submit">Отправить заявку</Button>
              {created && <div className="rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-800">Заявка отправлена. Мы свяжемся с вами.</div>}
            </div>
          </form>
        </Card>
      </section>

      <section id="documents">
        <SectionTitle title="Документы" subtitle="Загруженные файлы" />
        <div className="grid gap-4 md:grid-cols-2">
          {documents.map((doc) => (
            <Card key={doc.id} className="flex items-center justify-between gap-4 p-6">
              <div>
                <p className="text-sm font-semibold text-slate-900">{doc.name}</p>
                <p className="mt-1 text-sm text-slate-600">{doc.type}</p>
                <p className="mt-1 text-sm text-slate-500">{doc.uploadedAt}</p>
              </div>
              <Button variant="secondary">Скачать</Button>
            </Card>
          ))}
        </div>
      </section>

      <section id="payments">
        <SectionTitle title="История оплат" subtitle="Финансовые данные" />
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-xs uppercase tracking-[0.28em] text-slate-500">
            <span>Счет</span>
            <span>Услуга</span>
            <span>Сумма</span>
            <span>Дата</span>
            <span>Статус</span>
          </div>
          <div className="space-y-3 px-6 py-4">
            {payments.map((payment) => (
              <div key={payment.id} className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr] items-center gap-4 rounded-3xl bg-eco-50 px-4 py-4 text-sm text-slate-700">
                <span>{payment.invoice}</span>
                <span>{payment.service}</span>
                <span>{payment.amount}</span>
                <span>{payment.date}</span>
                <span>{payment.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="profile">
        <SectionTitle title="Профиль компании" subtitle="Данные клиента" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.24em] text-eco-700">Название</p>
              <p className="text-slate-900">{clientProfile.companyName}</p>
              <p className="text-sm uppercase tracking-[0.24em] text-eco-700">БИН/ИИН</p>
              <p className="text-slate-900">{clientProfile.tin}</p>
              <p className="text-sm uppercase tracking-[0.24em] text-eco-700">Адрес</p>
              <p className="text-slate-900">{clientProfile.address}</p>
            </div>
          </Card>
          <Card>
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.24em] text-eco-700">Телефон</p>
              <p className="text-slate-900">{clientProfile.phone}</p>
              <p className="text-sm uppercase tracking-[0.24em] text-eco-700">Email</p>
              <p className="text-slate-900">{clientProfile.email}</p>
              <p className="text-sm uppercase tracking-[0.24em] text-eco-700">Ответственное лицо</p>
              <p className="text-slate-900">{clientProfile.contactPerson}</p>
              <Button variant="secondary">Редактировать</Button>
            </div>
          </Card>
        </div>
      </section>

      <section id="notifications">
        <SectionTitle title="Уведомления" subtitle="Последние события" />
        <div className="space-y-4">
          {notifications.map((note) => (
            <Card key={note.id} className="p-6">
              <p className="font-semibold text-slate-900">{note.title}</p>
              <p className="mt-1 text-sm text-slate-600">{note.description}</p>
              <p className="mt-3 text-xs text-slate-500">{note.date}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CabinetPage;
