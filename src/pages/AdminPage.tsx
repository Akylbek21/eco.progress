import { useMemo, useState } from 'react';
import SectionTitle from '../components/ui/SectionTitle';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import StatusBadge from '../components/ui/StatusBadge';
import { orders as ordersData, clients, services, news, employees } from '../data/mockData';
import { changeOrderStatus } from '../services/orderService';

const statusOptions = ['Все', 'Новая', 'В обработке', 'Ожидает документы', 'В работе', 'Готово', 'Отменено'];

const AdminPage = ({ onNotify }: { onNotify: (message: string) => void }) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Все');
  const [localOrders, setLocalOrders] = useState(ordersData);

  const filteredOrders = useMemo(
    () =>
      localOrders.filter((order) => {
        const matchesSearch = [order.id, order.service, order.company, order.manager]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesStatus = statusFilter === 'Все' || order.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [localOrders, query, statusFilter]
  );

  const handleStatusChange = async (orderId: string, status: string) => {
    const updated = await changeOrderStatus(orderId, status as any);
    if (updated) {
      setLocalOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: updated.status } : order)));
      onNotify(`Статус заявки ${orderId} изменен на ${status}.`);
    }
  };

  return (
    <div className="space-y-10">
      <section id="orders">
        <SectionTitle title="Заявки клиентов" subtitle="Управление заявками" />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <Input label="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="По номеру, услуге или клиенту" />
          <Select label="Статус" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {statusOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
        </div>
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-xs uppercase tracking-[0.28em] text-slate-500">
            <span>Номер</span>
            <span>Услуга</span>
            <span>Компания</span>
            <span>Дата</span>
            <span>Статус</span>
            <span>Действие</span>
          </div>
          <div className="space-y-3 px-6 py-4">
            {filteredOrders.map((order) => (
              <div key={order.id} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_1fr] items-center gap-4 rounded-3xl bg-eco-50 px-4 py-4 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">{order.id}</span>
                <span>{order.service}</span>
                <span>{order.company}</span>
                <span>{order.createdAt}</span>
                <StatusBadge status={order.status} />
                <Select value={order.status} onChange={(e) => handleStatusChange(order.id, e.target.value)}>
                  {statusOptions.slice(1).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="clients">
        <SectionTitle title="Клиенты" subtitle="Контактная база" />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id}>
              <p className="text-sm uppercase tracking-[0.24em] text-eco-700">{client.status}</p>
              <h3 className="mt-3 text-xl font-semibold text-slate-900">{client.name}</h3>
              <p className="mt-2 text-slate-600">Контакт: {client.contact}</p>
              <p className="mt-3 text-sm text-slate-500">Заявок: {client.orders}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="services">
        <SectionTitle title="Услуги" subtitle="Список услуг" />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => (
            <Card key={service.id}>
              <p className="mb-3 text-3xl">{service.icon}</p>
              <h3 className="text-xl font-semibold text-slate-900">{service.title}</h3>
              <p className="mt-3 text-slate-600">{service.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="news">
        <SectionTitle title="Новости" subtitle="Контент" />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {news.map((item) => (
            <Card key={item.id}>
              <p className="text-sm uppercase tracking-[0.24em] text-eco-700">{item.category}</p>
              <h3 className="mt-3 text-xl font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-3 text-sm text-slate-600">{item.excerpt}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="employees">
        <SectionTitle title="Сотрудники" subtitle="Команда" />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {employees.map((employee) => (
            <Card key={employee.id}>
              <h3 className="text-xl font-semibold text-slate-900">{employee.name}</h3>
              <p className="mt-2 text-sm text-eco-700">{employee.position}</p>
              <p className="mt-3 text-sm text-slate-600">{employee.summary}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminPage;
