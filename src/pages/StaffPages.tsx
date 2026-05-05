import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  Bell,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileSignature,
  FileText,
  History,
  Leaf,
  MessageSquare,
  Microscope,
  Send,
  StickyNote,
  Upload,
  UserCheck,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import { notifications, services, statusDescriptions, type DocumentItem, type EcologyStatus, type LaboratoryStatus, type MockUser, type Order, type OrderStatus, type PaymentStatus, type StaffContractStatus, type UserRole } from '../data/mockData';
import { addComment, assignManager, getOrderById, getOrders, sendContractAndInvoice, updateContractStatus, updateEcologyStatus, updateLaboratoryStatus, updateOrderStatus, updatePaymentStatus, uploadDocument } from '../services/staffOrderService';
import { getCurrentUser, logout } from '../services/authService';
import { canAccess, permissionsForRole, type Permission } from '../config/permissions';
import {
  buildCompanySummaries,
  companyKey,
  ecologyLabel,
  ecologyStatusClass,
  fallbackPaymentStatus,
  getNextCrmStep,
  getOrderCompanyName,
  laboratoryLabel,
  laboratoryStatusClass,
  orderStatuses,
  paymentStatusClass,
  paymentStatusLabels,
  paymentStatuses,
  statusClass,
} from '../utils/crm';

const useOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const refresh = () => getOrders().then(setOrders);
  useEffect(() => { refresh(); }, []);
  return { orders, refresh };
};

const badge = (status: string) => <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusClass(status)}`}>{status}</span>;
const paymentBadge = (status?: PaymentStatus) => {
  const paymentStatus = fallbackPaymentStatus(status);
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${paymentStatusClass(paymentStatus)}`}>{paymentStatusLabels[paymentStatus]}</span>;
};
const ecologyBadge = (status?: EcologyStatus) => <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${ecologyStatusClass(status)}`}>{ecologyLabel(status)}</span>;
const laboratoryBadge = (status?: LaboratoryStatus) => <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${laboratoryStatusClass(status)}`}>{laboratoryLabel(status)}</span>;

const onlineState = (order: Order) => {
  if (order.paymentStatus === 'paid' && order.contractStatus === 'signed') return { label: 'Подписано и оплачено', tone: 'bg-emerald-50 text-emerald-800' };
  if (order.contractStatus === 'signed') return { label: 'Договор подписан', tone: 'bg-emerald-50 text-emerald-800' };
  if (order.paymentStatus === 'paid') return { label: 'Оплата получена', tone: 'bg-emerald-50 text-emerald-800' };
  if (order.paymentStatus === 'partial') return { label: 'Частичная оплата', tone: 'bg-indigo-50 text-indigo-800' };
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
  if (order.paymentStatus === 'partial') return { title: 'Частичная оплата', text: order.paymentAmount || order.paymentComment || 'Оплата получена частично', tone: 'border-indigo-200 bg-indigo-50 text-indigo-900' };
  if (order.paymentStatus === 'pending') return { title: 'Счет выставлен', text: `${order.paymentAmount || 'Сумма указана'} · ${order.paymentMethod || 'Онлайн-оплата'}`, tone: 'border-amber-200 bg-amber-50 text-amber-900' };
  return { title: 'Счет не выставлен', text: 'Выставить счет', tone: 'border-slate-200 bg-slate-50 text-slate-700' };
};

const contractLabel = (status?: StaffContractStatus | Order['contractStatus']) => {
  if (status === 'signed') return 'Подписан';
  if (status === 'sent' || status === 'sent_to_client') return 'Отправлен клиенту';
  if (status === 'prepared') return 'Подготовлен';
  if (status === 'waiting_signature') return 'Ждёт подписи';
  if (status === 'rejected') return 'Отклонён';
  return 'Не создан';
};

const actionTypeLabel = (type?: string) => {
  const labels: Record<string, string> = {
    status_changed: 'Изменение статуса',
    payment_changed: 'Изменение оплаты',
    internal_note_added: 'Внутренняя заметка',
    client_message_added: 'Сообщение клиенту',
    contract_updated: 'Договор',
    document_ready: 'Готовность документа',
    manager_assigned: 'Ответственный',
    order_created: 'Создание заявки',
    document_uploaded: 'Документ',
  };
  return type ? labels[type] || type : 'Действие';
};

const staffRole = (): UserRole => {
  const role = getCurrentUser()?.role;
  return role && role !== 'CLIENT' ? role : 'MANAGER';
};

const roleTitle = (role: UserRole) => {
  const labels: Record<UserRole, string> = {
    CLIENT: 'Клиент',
    ADMIN: 'Админ',
    MANAGER: 'Менеджер',
    ACCOUNTANT: 'Бухгалтер',
    ECOLOGIST: 'Эколог',
    LABORATORY: 'Лаборатория',
  };
  return labels[role];
};

const roleAccess = (role: UserRole) => ({
  all: role === 'ADMIN',
  manager: canAccess(role, 'edit_order') || canAccess(role, 'send_messages'),
  finance: canAccess(role, 'edit_payment'),
  viewFinance: canAccess(role, 'view_payment'),
  ecology: canAccess(role, 'edit_ecology'),
  laboratory: canAccess(role, 'edit_laboratory'),
  messages: canAccess(role, 'send_messages'),
  notes: canAccess(role, 'add_internal_notes'),
});

const roleQuickActions = (role: UserRole) => {
  if (role === 'ACCOUNTANT') return ['Оплаты', 'Счета', 'Акты'];
  if (role === 'ECOLOGIST') return ['Новые задачи', 'Нужны данные', 'Заключение'];
  if (role === 'LABORATORY') return ['Образцы', 'Анализ', 'Результат'];
  if (role === 'ADMIN') return ['Все задачи', 'Заявки', 'Уведомления'];
  return ['Новые заявки', 'Ответить клиенту', 'Договор'];
};

const roleOrderFilter = (orders: Order[], role: UserRole) => {
  if (role === 'ACCOUNTANT') return orders.filter((order) => order.paymentStatus === 'pending' || order.contractStatus === 'sent' || Boolean(order.paymentAmount));
  if (role === 'ECOLOGIST') return orders.filter((order) => /эколог|отчет|документ|разреш/i.test(order.service));
  if (role === 'LABORATORY') return orders.filter((order) => /лаборатор|анализ|исслед/i.test(order.service));
  return orders;
};

const companyUrlKey = (key: string) => encodeURIComponent(key);

type StaffDocumentType = 'договор' | 'счёт' | 'акт' | 'экологический документ' | 'лабораторный результат' | 'заключение' | 'прочее';

type StaffDocument = DocumentItem & {
  company: string;
  orderId: string;
  orderService: string;
  docType: StaffDocumentType;
  uploadedBy: string;
};

const documentType = (doc: DocumentItem): StaffDocumentType => {
  const name = doc.name.toLowerCase();
  if (doc.type === 'invoice' || name.includes('счет') || name.includes('счёт')) return 'счёт';
  if (name.includes('договор')) return 'договор';
  if (name.includes('акт')) return 'акт';
  if (name.includes('лаборатор') || name.includes('анализ') || name.includes('протокол')) return 'лабораторный результат';
  if (name.includes('заключ')) return 'заключение';
  if (doc.type === 'result') return 'экологический документ';
  return 'прочее';
};

const collectDocuments = (orders: Order[]): StaffDocument[] =>
  orders.flatMap((order) =>
    [...order.documents, ...order.resultDocuments].map((doc) => ({
      ...doc,
      company: getOrderCompanyName(order),
      orderId: order.id,
      orderService: order.service,
      docType: documentType(doc),
      uploadedBy: doc.type === 'client' ? order.contactPerson || order.clientName : 'Сотрудник',
    }))
  );

const lastOrderDate = (orders: Order[]) => orders[0]?.createdAt || 'Нет заявок';

const PermissionDenied = ({ permission }: { permission: Permission }) => (
  <Reveal>
    <div className="rounded-[24px] bg-white p-8 text-center shadow-sm">
      <h2 className="text-2xl font-bold text-eco-900">Нет доступа</h2>
      <p className="mt-2 text-sm text-slate-600">{permission}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button type="button" variant="secondary" onClick={() => window.history.back()}>Назад</Button>
        <Link to="/staff"><Button>Главная</Button></Link>
      </div>
    </div>
  </Reveal>
);

export const StaffDashboardPage = () => {
  const { orders } = useOrders();
  const role = staffRole();
  if (!canAccess(role, 'view_orders')) return <PermissionDenied permission="view_orders" />;
  const user = getCurrentUser();
  const roleOrders = roleOrderFilter(orders, role);
  const [selectedCompany, setSelectedCompany] = useState('all');
  const companies = useMemo(() => buildCompanySummaries(orders), [orders]);
  const visibleOrders = useMemo(() => roleOrders
    .filter((order) => selectedCompany === 'all' || companyKey(getOrderCompanyName(order)) === selectedCompany)
    .sort((a, b) => b.id.localeCompare(a.id)), [roleOrders, selectedCompany]);
  const latestActions = orders.flatMap((order) => order.history.slice(0, 2).map((item) => ({ ...item, order }))).slice(0, 6);
  const roleNotifications = buildRoleNotifications(orders, role).slice(0, 5);
  const myTasks = buildMyTasks(orders, role);
  const stats = [
    ['Новые', orders.filter((o) => o.status === 'Новая').length],
    ['В работе', orders.filter((o) => ['В обработке', 'В работе', 'На проверке'].includes(o.status)).length],
    ['Ждут оплаты', orders.filter((o) => o.paymentStatus === 'pending' || o.paymentStatus === 'partial').length],
    ['Ждут эколога', orders.filter((o) => o.ecologyStatus === 'in_progress' || o.ecologyStatus === 'waiting_client_data').length],
    ['Ждут лабораторию', orders.filter((o) => ['waiting_samples', 'samples_received', 'analysis_in_progress'].includes(o.laboratoryStatus || '')).length],
    ['Готово', orders.filter((o) => ['Готово', 'Завершено'].includes(o.status)).length],
  ];

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-eco-900">{user?.name || 'Сотрудник'} · {roleTitle(role)}</h2>
          </div>
          <p className="rounded-full bg-white px-4 py-2 text-sm font-bold text-eco-800 shadow-sm">Сегодня: {myTasks.length} задач</p>
        </div>
      </Reveal>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {stats.map(([label, count], index) => (
          <Reveal key={label} delay={index * 0.04}>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-eco-900">{count}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-eco-900">Компании</h3>
            <button type="button" onClick={() => setSelectedCompany('all')} className="text-sm font-bold text-eco-700">Все</button>
          </div>
          <CompanyCards companies={companies} selectedCompany={selectedCompany} onSelect={setSelectedCompany} totalOrders={orders.length} />
        </div>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <StaffPanel title="Мои задачи">
          {myTasks.map((task) => (
            <Link key={task.id} to={`/staff/orders/${task.order.id}`} className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-eco-50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">{task.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{task.company} · {task.order.id}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">{task.deadline}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${task.priority === 'Высокий' ? 'bg-rose-50 text-rose-800' : 'bg-white text-eco-800'}`}>{task.priority}</span>
              </div>
              <span className="mt-3 inline-flex rounded-full bg-eco-900 px-3 py-2 text-xs font-bold text-white">Открыть</span>
            </Link>
          ))}
          {!myTasks.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Задач нет</p>}
        </StaffPanel>
        <div className="space-y-6">
          <StaffPanel title="Действия">
            {roleQuickActions(role).map((item, index) => (
              <Link key={item} to={index === 1 ? '/staff/documents' : '/staff/orders'} className="flex gap-3 rounded-2xl bg-slate-50 p-4 text-sm transition hover:bg-eco-50">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-eco-900 text-xs font-bold text-white">{index + 1}</span>
                <span className="pt-1 font-semibold text-slate-700">{item}</span>
              </Link>
            ))}
          </StaffPanel>
          <StaffPanel title="Уведомления">
            {roleNotifications.map((item) => <NotificationLine key={item.id} notification={item} />)}
          </StaffPanel>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <StaffPanel title="Заявки">
          {visibleOrders.slice(0, 7).map((order) => <OrderLine key={order.id} order={order} />)}
          {!visibleOrders.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Заявок нет</p>}
        </StaffPanel>
      </div>

      <StaffPanel title="Последние действия">
        {latestActions.map((item) => (
          <Link key={`${item.order.id}-${item.id}`} to={`/staff/orders/${item.order.id}`} className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-eco-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-slate-900">{actionTypeLabel(item.actionType)} · {item.order.id}</p>
              <span className="text-xs font-semibold text-slate-500">{item.createdAt}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{item.text}</p>
          </Link>
        ))}
        {!latestActions.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Действий нет</p>}
      </StaffPanel>
    </div>
  );
};

const buildRoleNotifications = (orders: Order[], role: UserRole) => {
  const generated = orders.flatMap((order) => {
    const items = [
      order.status === 'Новая' && { id: `${order.id}-new`, category: 'Новая заявка', title: `Новая заявка ${order.id}`, text: `${getOrderCompanyName(order)} · ${order.service}`, order },
      order.paymentStatus === 'pending' && { id: `${order.id}-pay`, category: 'Оплата', title: `Ожидает оплаты ${order.id}`, text: order.paymentAmount || 'Сумма не указана', order },
      order.resultDocuments.length > 0 && { id: `${order.id}-doc`, category: 'Документы', title: `Документы по ${order.id}`, text: getOrderCompanyName(order), order },
      /эколог|отчет|документ|разреш/i.test(order.service) && { id: `${order.id}-eco`, category: 'Эколог', title: `Экологическая обработка ${order.id}`, text: getNextCrmStep(order), order },
      /лаборатор|анализ|исслед/i.test(order.service) && { id: `${order.id}-lab`, category: 'Лаборатория', title: `Лабораторная задача ${order.id}`, text: getNextCrmStep(order), order },
    ].filter(Boolean);
    return items as Array<{ id: string; category: string; title: string; text: string; order: Order }>;
  });

  if (role === 'ACCOUNTANT') return generated.filter((item) => ['Оплата', 'Документы'].includes(item.category));
  if (role === 'ECOLOGIST') return generated.filter((item) => item.category === 'Эколог');
  if (role === 'LABORATORY') return generated.filter((item) => item.category === 'Лаборатория');
  if (role === 'MANAGER') return generated.filter((item) => ['Новая заявка', 'Документы', 'Эколог'].includes(item.category));
  return generated;
};

const buildMyTasks = (orders: Order[], role: UserRole) => roleOrderFilter(orders, role)
  .filter((order) => !['Готово', 'Завершено', 'Отменено'].includes(order.status))
  .slice(0, 6)
  .map((order, index) => ({
    id: `TASK-${order.id}`,
    title: getNextCrmStep(order),
    company: getOrderCompanyName(order),
    order,
    priority: index < 2 ? 'Высокий' : order.paymentStatus === 'pending' ? 'Средний' : 'Обычный',
    deadline: order.deadline || 'Сегодня',
  }));

const getOrderStage = (order: Order) => {
  if (order.paymentStatus === 'pending' || order.paymentStatus === 'partial') return 'Бухгалтерия';
  if (order.ecologyStatus === 'in_progress' || order.ecologyStatus === 'waiting_client_data') return 'Экология';
  if (['waiting_samples', 'samples_received', 'analysis_in_progress'].includes(order.laboratoryStatus || '')) return 'Лаборатория';
  if (order.status === 'Готово' || order.status === 'Завершено') return 'Готово';
  return 'Менеджер';
};

const NotificationLine = ({ notification }: { notification: { id: string; category: string; title: string; text: string; order?: Order } }) => (
  <Link to={notification.order ? `/staff/orders/${notification.order.id}` : '/staff/notifications'} className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-eco-50">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-bold text-slate-900">{notification.title}</p>
      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800">{notification.category}</span>
    </div>
    <p className="mt-2 text-sm text-slate-600">{notification.text}</p>
    <span className="mt-3 inline-flex rounded-full bg-eco-900 px-3 py-2 text-xs font-bold text-white">Открыть</span>
  </Link>
);

const StaffPanel = ({ title, children }: { title: string; children: ReactNode }) => (
  <Reveal>
    <div className="rounded-[20px] bg-white p-5 shadow-sm sm:rounded-[22px] sm:p-6">
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
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{order.id} · {getOrderCompanyName(order)}</p>
          <p className="mt-1 break-words text-sm text-slate-600">{order.service}</p>
          <p className="mt-2 text-xs font-semibold text-eco-700">Следующий шаг: {getNextCrmStep(order)}</p>
          <p className="mt-1 text-xs text-slate-500">Ответственный: {order.manager || 'Не назначен'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {badge(order.status)}
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${online.tone}`}>{online.label}</span>
        </div>
      </div>
      <span className="mt-3 inline-flex rounded-full bg-eco-900 px-3 py-2 text-xs font-bold text-white">Открыть</span>
    </Link>
  );
};

const CompanyCards = ({
  companies,
  selectedCompany,
  onSelect,
  totalOrders,
}: {
  companies: ReturnType<typeof buildCompanySummaries>;
  selectedCompany: string;
  onSelect: (key: string) => void;
  totalOrders: number;
}) => {
  const totals = companies.reduce(
    (acc, company) => ({
      active: acc.active + company.active,
      waiting: acc.waiting + company.waiting,
      completed: acc.completed + company.completed,
      paid: acc.paid + company.paid,
      pendingPayment: acc.pendingPayment + company.pendingPayment,
    }),
    { active: 0, waiting: 0, completed: 0, paid: 0, pendingPayment: 0 }
  );

  return (
    <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
      <button
        type="button"
        onClick={() => onSelect('all')}
        className={`min-w-[250px] rounded-[20px] border p-4 text-left transition ${
          selectedCompany === 'all' ? 'border-eco-400 bg-eco-900 text-white shadow-lg shadow-eco-900/15' : 'border-slate-200 bg-white text-slate-900 hover:border-eco-200'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold">Все</p>
          </div>
          <Building2 size={20} />
        </div>
        <CompanyMetrics total={totalOrders} active={totals.active} waiting={totals.waiting} completed={totals.completed} dark={selectedCompany === 'all'} />
        <p className="mt-3 text-xs font-semibold opacity-75">{totals.pendingPayment} ждёт оплаты</p>
      </button>

      {companies.map((company) => {
        const selected = selectedCompany === company.key;
        return (
          <button
            type="button"
            key={company.key}
            onClick={() => onSelect(company.key)}
            className={`min-w-[270px] rounded-[20px] border p-4 text-left transition ${
              selected ? 'border-eco-400 bg-white shadow-lg shadow-eco-900/10 ring-2 ring-eco-200' : 'border-slate-200 bg-white shadow-sm hover:border-eco-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mt-1 break-words text-lg font-bold text-eco-900">{company.name}</p>
              </div>
              <Building2 className={selected ? 'text-eco-700' : 'text-slate-400'} size={20} />
            </div>
            <CompanyMetrics total={company.total} active={company.active} waiting={company.waiting} completed={company.completed} />
            <p className="mt-3 text-xs font-semibold text-slate-500">
              {company.pendingPayment} ждёт оплаты{company.partialPayment ? ` · ${company.partialPayment} частично` : ''}
            </p>
          </button>
        );
      })}
    </div>
  );
};

const CompanyMetrics = ({ total, active, waiting, completed, dark = false }: { total: number; active: number; waiting: number; completed: number; dark?: boolean }) => (
  <div className="mt-4 grid grid-cols-4 gap-2 text-center">
    {[
      ['заявки', total],
      ['в работе', active],
      ['ждёт', waiting],
      ['готово', completed],
    ].map(([label, value]) => (
      <div key={String(label)} className={`rounded-2xl px-2 py-2 ${dark ? 'bg-white/10' : 'bg-slate-50'}`}>
        <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-eco-900'}`}>{value}</p>
        <p className={`text-[11px] font-semibold ${dark ? 'text-white/65' : 'text-slate-500'}`}>{label}</p>
      </div>
    ))}
  </div>
);

const crmTabs = ['Обзор', 'Оплата', 'Договор', 'Документы', 'Экология', 'Лаборатория', 'Сообщения', 'Заметки', 'История'] as const;
type CrmTab = typeof crmTabs[number];

export const StaffOrdersPage = () => {
  const { orders } = useOrders();
  const role = staffRole();
  if (!canAccess(role, 'view_orders')) return <PermissionDenied permission="view_orders" />;
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Все');
  const [payment, setPayment] = useState('Все');
  const [manager, setManager] = useState('Все');
  const [stage, setStage] = useState('Все');
  const [date, setDate] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('all');
  const companies = useMemo(() => buildCompanySummaries(orders), [orders]);
  const managers = useMemo(() => Array.from(new Set(orders.map((order) => order.manager || 'Не назначен'))).sort(), [orders]);
  const filtered = useMemo(() => orders
    .filter((o) => selectedCompany === 'all' || companyKey(getOrderCompanyName(o)) === selectedCompany)
    .filter((o) => status === 'Все' || o.status === status)
    .filter((o) => payment === 'Все' || fallbackPaymentStatus(o.paymentStatus) === payment)
    .filter((o) => manager === 'Все' || (o.manager || 'Не назначен') === manager)
    .filter((o) => stage === 'Все' || getOrderStage(o) === stage)
    .filter((o) => !date || o.createdAt.toLowerCase().includes(date.toLowerCase()))
    .filter((o) => `${o.id} ${o.clientName} ${getOrderCompanyName(o)} ${o.service}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.id.localeCompare(a.id)), [orders, q, selectedCompany, status, payment, manager, stage, date]);
  const activeCompany = selectedCompany === 'all' ? 'Все компании' : companies.find((company) => company.key === selectedCompany)?.name || 'Компания';

  return (
    <div className="space-y-6">
      <Reveal>
        <div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-eco-900">Заявки</h2>
            </div>
            <p className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-eco-800 shadow-sm">Роль: {roleTitle(role)}</p>
          </div>
          <CompanyCards companies={companies} selectedCompany={selectedCompany} onSelect={setSelectedCompany} totalOrders={orders.length} />
        </div>
      </Reveal>

      <Reveal>
        <div className="rounded-[20px] bg-white p-4 shadow-sm sm:rounded-[22px] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-eco-900">{activeCompany}</h3>
          </div>
          <p className="rounded-full bg-eco-50 px-4 py-2 text-sm font-semibold text-eco-800">Найдено: {filtered.length}</p>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-4 xl:grid-cols-8">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по номеру, компании, клиенту или услуге" className="input-focus min-w-0 rounded-2xl border border-slate-200 px-4 py-3" />
          <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="input-focus min-w-0 rounded-2xl border border-slate-200 px-4 py-3">
            <option value="all">Все компании</option>
            {companies.map((company) => <option key={company.key} value={company.key}>{company.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-focus min-w-0 rounded-2xl border border-slate-200 px-4 py-3"><option>Все</option>{orderStatuses.map((s) => <option key={s}>{s}</option>)}</select>
          <select value={payment} onChange={(e) => setPayment(e.target.value)} className="input-focus min-w-0 rounded-2xl border border-slate-200 px-4 py-3"><option>Все</option>{paymentStatuses.map((item) => <option key={item} value={item}>{paymentStatusLabels[item]}</option>)}</select>
          <select value={manager} onChange={(e) => setManager(e.target.value)} className="input-focus min-w-0 rounded-2xl border border-slate-200 px-4 py-3"><option>Все</option>{managers.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={stage} onChange={(e) => setStage(e.target.value)} className="input-focus min-w-0 rounded-2xl border border-slate-200 px-4 py-3"><option>Все</option>{['Менеджер', 'Бухгалтерия', 'Экология', 'Лаборатория', 'Готово'].map((item) => <option key={item}>{item}</option>)}</select>
          <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="Дата" className="input-focus min-w-0 rounded-2xl border border-slate-200 px-4 py-3" />
          <button type="button" onClick={() => { setQ(''); setStatus('Все'); setPayment('Все'); setManager('Все'); setStage('Все'); setDate(''); setSelectedCompany('all'); }} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-eco-800 transition hover:bg-eco-50">Сбросить</button>
        </div>
        <div className="mt-5 space-y-3 lg:hidden">
          {filtered.map((order) => <OrderLine key={order.id} order={order} />)}
        </div>
        <div className="mt-5 hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-slate-500">
              <tr><th className="p-3">№</th><th>Компания</th><th>Услуга</th><th>Статус</th><th>Оплата</th><th>Этап</th><th>Следующий шаг</th><th>Ответственный</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} className="border-t border-slate-100 align-top">
                  <td className="p-3 font-semibold text-slate-900">{order.id}</td>
                  <td className="py-3"><p className="font-semibold text-slate-900">{getOrderCompanyName(order)}</p></td>
                  <td className="py-3">{order.service}</td>
                  <td className="py-3">{badge(order.status)}</td>
                  <td className="py-3">{paymentBadge(order.paymentStatus)}</td>
                  <td className="py-3 text-sm text-slate-600">{getOrderStage(order)}</td>
                  <td className="py-3 font-semibold text-slate-700">{getNextCrmStep(order)}</td>
                  <td className="py-3 text-sm text-slate-600">{order.manager || 'Не назначен'}</td>
                  <td className="py-3"><Link to={`/staff/orders/${order.id}`} className="rounded-full bg-eco-900 px-3 py-2 text-xs font-bold text-white">Открыть</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </Reveal>
    </div>
  );
};

export const StaffOrderDetailsPage = ({ onNotify }: { onNotify?: (message: string) => void }) => {
  const { id } = useParams();
  const role = staffRole();
  const access = roleAccess(role);
  const [order, setOrder] = useState<Order | undefined>();
  const [activeTab, setActiveTab] = useState<CrmTab>('Обзор');
  const load = () => {
    if (id) getOrderById(id).then(setOrder);
  };
  useEffect(() => { load(); }, [id]);
  if (!id) return <Navigate to="/staff/orders" replace />;
  if (!order) return <div className="rounded-2xl bg-white p-6">Загрузка заявки...</div>;

  const changeStatus = async (status: OrderStatus) => {
    await updateOrderStatus(order.id, status);
    onNotify?.('Статус заявки обновлен');
    load();
  };

  const changePayment = async (paymentStatus: PaymentStatus, comment?: string) => {
    await updatePaymentStatus(order.id, paymentStatus, { comment });
    onNotify?.('Статус оплаты обновлен');
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

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await updatePaymentStatus(order.id, String(form.get('paymentStatus')) as PaymentStatus, {
      amount: String(form.get('amount') || ''),
      paidAt: String(form.get('paidAt') || ''),
      comment: String(form.get('comment') || ''),
      method: String(form.get('paymentMethod') || ''),
      invoiceNumber: String(form.get('invoiceNumber') || ''),
      actNumber: String(form.get('actNumber') || ''),
    });
    onNotify?.('Раздел оплаты сохранен');
    load();
  };

  const submitEcology = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await updateEcologyStatus(order.id, String(form.get('ecologyStatus')) as EcologyStatus, String(form.get('comment') || ''));
    onNotify?.('Экологический блок обновлен');
    load();
  };

  const submitLaboratory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await updateLaboratoryStatus(order.id, String(form.get('laboratoryStatus')) as LaboratoryStatus, String(form.get('comment') || ''));
    onNotify?.('Лабораторный блок обновлен');
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

  const markContract = async (status: StaffContractStatus, comment?: string) => {
    await updateContractStatus(order.id, status, comment);
    onNotify?.('Статус договора обновлен');
    load();
  };

  const online = onlineState(order);

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="rounded-[20px] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link to="/staff/orders" className="text-sm font-semibold text-eco-700">← Заявки</Link>
              <h2 className="mt-3 text-2xl font-bold text-eco-900">{order.id} · {getOrderCompanyName(order)}</h2>
              <p className="mt-1 break-words text-slate-600">Статус: {order.status}</p>
              <p className="mt-1 text-sm font-semibold text-eco-700">Следующий шаг: {getNextCrmStep(order)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {badge(order.status)}
              {paymentBadge(order.paymentStatus)}
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${online.tone}`}>{online.label}</span>
            </div>
          </div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {crmTabs.map((tab) => (
              <button
                type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                  activeTab === tab ? 'bg-eco-900 text-white shadow-lg shadow-eco-900/10' : 'bg-slate-100 text-slate-600 hover:bg-eco-50 hover:text-eco-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <Reveal>
          <div className="space-y-6">
            {activeTab === 'Обзор' && (
              <>
                <Section title="Обзор" icon={<ClipboardCheck size={20} />}>
                  <Grid items={{ Компания: getOrderCompanyName(order), Контакт: order.contactPerson || order.clientName, Телефон: order.phone, Услуга: order.service, Статус: order.status, 'Следующий шаг': getNextCrmStep(order), Ответственный: order.manager, Дедлайн: order.deadline || 'Нет' }} />
                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Оплата</p><div className="mt-2">{paymentBadge(order.paymentStatus)}</div></div>
                    <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Экология</p><div className="mt-2">{ecologyBadge(order.ecologyStatus)}</div></div>
                    <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Лаборатория</p><div className="mt-2">{laboratoryBadge(order.laboratoryStatus)}</div></div>
                    <InfoTile label="Документы" value={`${order.documents.length + order.resultDocuments.length} файлов`} />
                  </div>
                </Section>
              </>
            )}

            {activeTab === 'Оплата' && (
              <Section title="Оплата" icon={<CreditCard size={20} />}>
                <div className="mb-5 grid gap-3 md:grid-cols-4">
                  <InfoTile label="Статус" value={paymentStatusLabels[fallbackPaymentStatus(order.paymentStatus)]} />
                  <InfoTile label="Сумма" value={order.paymentAmount || 'Не указана'} />
                  <InfoTile label="Дата" value={order.paidAt || 'Нет'} />
                  <InfoTile label="Комментарий" value={order.paymentComment || 'Нет'} />
                </div>
                <form onSubmit={submitPayment} className="grid gap-4 md:grid-cols-2">
                  <Field label="Статус">
                    <select name="paymentStatus" disabled={!access.finance} defaultValue={fallbackPaymentStatus(order.paymentStatus)} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:bg-slate-100">{paymentStatuses.map((status) => <option key={status} value={status}>{paymentStatusLabels[status]}</option>)}</select>
                  </Field>
                  <Field label="Сумма">
                    <input name="amount" disabled={!access.finance} defaultValue={order.paymentAmount || ''} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
                  </Field>
                  <Field label="Дата">
                    <input name="paidAt" disabled={!access.finance} defaultValue={order.paidAt || ''} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
                  </Field>
                  <Field label="Счет">
                    <input name="invoiceNumber" disabled={!access.finance} defaultValue={order.invoiceNumber || ''} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
                  </Field>
                  <Field label="Акт">
                    <input name="actNumber" disabled={!access.finance} defaultValue={order.actNumber || ''} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
                  </Field>
                  <Field label="Метод">
                    <input name="paymentMethod" disabled={!access.finance} defaultValue={order.paymentMethod || ''} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
                  </Field>
                  <label className="md:col-span-2 text-sm font-semibold text-slate-700">Комментарий
                    <textarea name="comment" disabled={!access.finance} defaultValue={order.paymentComment || ''} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" rows={3} />
                  </label>
                  {access.finance && (
                    <div className="flex flex-wrap gap-3 md:col-span-2">
                      <Button>Сохранить</Button>
                      <Button type="button" variant="secondary" onClick={() => changePayment('pending', 'Ожидает оплаты')}>Ожидает оплаты</Button>
                      <Button type="button" variant="secondary" onClick={() => changePayment('partial', 'Частично оплачено')}>Частично оплачено</Button>
                      <Button type="button" variant="secondary" onClick={() => changePayment('paid', 'Оплачено')}>Оплачено</Button>
                    </div>
                  )}
                </form>
              </Section>
            )}

            {activeTab === 'Договор' && (
              <Section title="Договор" icon={<FileSignature size={20} />}>
                <div className="mb-5 grid gap-3 md:grid-cols-3">
                  <InfoTile label="Статус" value={contractLabel(order.crmContractStatus || order.contractStatus)} />
                  <InfoTile label="Подписание" value={order.signatureProvider || 'Не указано'} />
                  <InfoTile label="Дата" value={order.signedAt || 'Нет'} />
                </div>
                <form onSubmit={submitContractAndInvoice} className="grid gap-4 md:grid-cols-2">
                  <Field label="Сумма"><input name="amount" required defaultValue={order.paymentAmount || '150 000 ₸'} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
                  <Field label="Метод"><select name="paymentMethod" defaultValue={order.paymentMethod || 'Банковская карта'} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3"><option>Банковская карта</option><option>Kaspi Pay</option><option>Счет на оплату</option></select></Field>
                  <Field label="Подписание"><select name="signatureProvider" defaultValue={order.signatureProvider || 'NCALayer / ЭЦП'} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3"><option>NCALayer / ЭЦП</option><option>Kaspi ID</option><option>SMS-подтверждение</option></select></Field>
                  <Field label="Файл"><input name="contract" type="file" className="w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
                  <div className="flex flex-wrap gap-3 md:col-span-2">
                    <Button>Отправить</Button>
                    <Button type="button" variant="secondary" onClick={() => markContract('sent_to_client', 'Договор отправлен')}>Отправлен</Button>
                    <Button type="button" variant="secondary" onClick={() => markContract('signed', 'Договор подписан')}>Подписан</Button>
                  </div>
                </form>
              </Section>
            )}

            {activeTab === 'Документы' && (
              <Section title="Документы" icon={<Upload size={20} />}>
                <List title="От клиента" items={order.documents.map((d) => `${d.name} · ${d.status} · ${d.uploadedAt}`)} />
                <List title="От ECOPROGRESS" items={order.resultDocuments.map((d) => `${d.name} · ${d.status} · ${d.uploadedAt}`)} />
                <form onSubmit={submitDoc} className="mt-5 rounded-2xl border border-slate-200 p-4">
                  <Field label="Файл">
                    <input name="file" type="file" required disabled={!canAccess(role, 'edit_documents')} className="w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
                  </Field>
                  {canAccess(role, 'edit_documents') && <Button className="mt-4">Загрузить</Button>}
                </form>
              </Section>
            )}

            {activeTab === 'Экология' && (
              <Section title="Экология" icon={<Leaf size={20} />}>
                <div className="grid gap-3 md:grid-cols-3">
                  <InfoTile label="Статус" value={ecologyLabel(order.ecologyStatus)} />
                  <InfoTile label="Ответственный" value={order.assignedEcologist || 'Эколог ECOPROGRESS GROUP'} />
                  <InfoTile label="Готово" value={order.ecologyReadyAt || 'Нет'} />
                </div>
                <List title="Документы" items={order.resultDocuments.filter((doc) => documentType(doc) === 'экологический документ' || documentType(doc) === 'заключение').map((doc) => `${doc.name} · ${doc.status} · ${doc.uploadedAt}`)} />
                <form onSubmit={submitEcology} className="mt-5 grid gap-4 md:grid-cols-2">
                  <Field label="Статус">
                    <select name="ecologyStatus" disabled={!access.ecology} defaultValue={order.ecologyStatus || 'not_started'} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:bg-slate-100">
                      {(['not_started', 'in_progress', 'waiting_client_data', 'done'] as EcologyStatus[]).map((status) => <option key={status} value={status}>{ecologyLabel(status)}</option>)}
                    </select>
                  </Field>
                  <label className="text-sm font-semibold text-slate-700 md:col-span-2">Комментарий
                    <textarea name="comment" disabled={!access.ecology} defaultValue={order.ecologyComment || ''} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" rows={3} />
                  </label>
                  {access.ecology && <Button>Сохранить</Button>}
                </form>
                {access.ecology && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button type="button" variant="secondary" onClick={() => updateEcologyStatus(order.id, 'in_progress', 'Экология в работе').then(load)}>В работу</Button>
                    <Button type="button" variant="secondary" onClick={() => updateEcologyStatus(order.id, 'waiting_client_data', 'Нужны данные').then(load)}>Нужны данные</Button>
                    <Button type="button" onClick={() => updateEcologyStatus(order.id, 'done', 'Экология готова').then(load)}>Готово</Button>
                  </div>
                )}
              </Section>
            )}

            {activeTab === 'Лаборатория' && (
              <Section title="Лаборатория" icon={<Microscope size={20} />}>
                <div className="grid gap-3 md:grid-cols-3">
                  <InfoTile label="Статус" value={laboratoryLabel(order.laboratoryStatus)} />
                  <InfoTile label="Образцы" value={order.samplesReceivedAt || 'Нет'} />
                  <InfoTile label="Результат" value={order.laboratoryReadyAt || 'Нет'} />
                </div>
                <List title="Документы" items={order.resultDocuments.filter((doc) => documentType(doc) === 'лабораторный результат').map((doc) => `${doc.name} · ${doc.status} · ${doc.uploadedAt}`)} />
                {access.laboratory ? (
                  <form onSubmit={submitLaboratory} className="mt-5 grid gap-4 md:grid-cols-2">
                    <Field label="Статус">
                      <select name="laboratoryStatus" defaultValue={order.laboratoryStatus || 'not_assigned'} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3">
                        {(['not_assigned', 'waiting_samples', 'samples_received', 'analysis_in_progress', 'result_ready'] as LaboratoryStatus[]).map((status) => <option key={status} value={status}>{laboratoryLabel(status)}</option>)}
                      </select>
                    </Field>
                    <label className="text-sm font-semibold text-slate-700 md:col-span-2">Комментарий
                      <textarea name="comment" defaultValue={order.laboratoryComment || ''} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={3} />
                    </label>
                    <Button>Сохранить</Button>
                    <Button type="button" variant="secondary" onClick={() => updateLaboratoryStatus(order.id, 'samples_received', 'Образцы получены').then(load)}>Образцы получены</Button>
                    <Button type="button" variant="secondary" onClick={() => updateLaboratoryStatus(order.id, 'analysis_in_progress', 'Анализ в работе').then(load)}>Анализ в работе</Button>
                    <Button type="button" variant="secondary" onClick={() => updateLaboratoryStatus(order.id, 'result_ready', 'Результат готов').then(load)}>Результат готов</Button>
                  </form>
                ) : null}
              </Section>
            )}

            {activeTab === 'Сообщения' && (
              <Section title="Сообщения" icon={<Send size={20} />}>
                <List title="Сообщения" items={order.comments.filter((c) => c.visibility === 'client').map((c) => `${c.createdAt} · ${c.author}: ${c.text}`)} />
                {access.messages && (
                  <form onSubmit={(event) => submitComment(event, 'client')} className="mt-5">
                    <textarea name="comment" required placeholder="Сообщение" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" rows={4} />
                    <Button className="mt-4">Отправить</Button>
                  </form>
                )}
              </Section>
            )}

            {activeTab === 'Заметки' && (
              <Section title="Заметки" icon={<StickyNote size={20} />}>
                <List title="Заметки" items={order.comments.filter((c) => c.visibility === 'internal').map((c) => `${c.createdAt} · ${c.author}: ${c.text}`)} />
                <form onSubmit={(event) => submitComment(event, 'internal')} className="mt-5">
                  <textarea name="comment" required disabled={!access.notes} placeholder="Заметка" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" rows={4} />
                  {access.notes && <Button variant="secondary" className="mt-4">Добавить</Button>}
                </form>
              </Section>
            )}

            {activeTab === 'История' && (
              <Section title="История" icon={<History size={20} />}>
                <div className="space-y-3">
                  {order.history.length ? order.history.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.createdAt} · {roleTitle(item.actorRole || 'MANAGER')} · {actionTypeLabel(item.actionType)}
                      </p>
                      {(item.oldValue || item.newValue) ? (
                        <p className="mt-2 text-sm text-slate-700">{item.oldValue || '—'} → {item.newValue || '—'}</p>
                      ) : (
                        <p className="mt-2 text-sm text-slate-700">{item.text}</p>
                      )}
                      {item.comment && <p className="mt-2 text-sm text-slate-500">{item.comment}</p>}
                    </div>
                  )) : <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Пока нет действий</p>}
                </div>
              </Section>
            )}
          </div>
        </Reveal>

        <Reveal direction="left">
          <div className="space-y-5">
            <Action title="Следующий шаг" icon={<CheckCircle2 size={20} />}>
              <p className="rounded-2xl bg-eco-50 p-4 text-sm font-semibold text-eco-900">{getNextCrmStep(order)}</p>
              {access.manager && (
                <div className="mt-4 grid gap-3">
                  <Button onClick={() => changeStatus('В обработке')} variant="secondary" className="w-full">В работу</Button>
                  <Button onClick={() => changeStatus('Ожидает документы')} variant="secondary" className="w-full">Документы</Button>
                  <Button onClick={() => changeStatus('В работе')} className="w-full">Передать</Button>
                </div>
              )}
            </Action>

            {access.manager && (
              <Action title="Статус" icon={<UserCheck size={20} />}>
                <label className="text-sm font-semibold text-slate-700">Статус
                  <select value={order.status} onChange={(e) => changeStatus(e.target.value as OrderStatus)} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">{orderStatuses.map((s) => <option key={s}>{s}</option>)}</select>
                </label>
                <form onSubmit={submitManager} className="mt-4">
                  <label className="text-sm font-semibold text-slate-700">Ответственный
                    <input name="manager" defaultValue={order.manager} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
                  </label>
                  <Button className="mt-4 w-full">Сохранить</Button>
                </form>
              </Action>
            )}

            {access.finance && (
              <Action title="Оплата" icon={<CreditCard size={20} />}>
                <div className="mb-4">{paymentBadge(order.paymentStatus)}</div>
                <div className="grid gap-3">
                  <Button onClick={() => changePayment('paid', 'Оплачено')} className="w-full">Оплачено</Button>
                  <Button onClick={() => changePayment('pending', 'Ожидает оплаты')} variant="secondary" className="w-full">Ожидает оплаты</Button>
                </div>
              </Action>
            )}

            {(access.manager || access.finance) && (
              <Action title="Договор" icon={<FileSignature size={20} />}>
              <form onSubmit={submitContractAndInvoice} className="mt-4 space-y-4">
                <Field label="Сумма"><input name="amount" required defaultValue={order.paymentAmount || '150 000 ₸'} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
                <Field label="Метод"><select name="paymentMethod" defaultValue={order.paymentMethod || 'Банковская карта'} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3"><option>Банковская карта</option><option>Kaspi Pay</option><option>Счет на оплату</option></select></Field>
                <Field label="Подписание"><select name="signatureProvider" defaultValue={order.signatureProvider || 'NCALayer / ЭЦП'} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3"><option>NCALayer / ЭЦП</option><option>Kaspi ID</option><option>SMS-подтверждение</option></select></Field>
                <Field label="Файл"><input name="contract" type="file" className="w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
                <Button className="w-full">Отправить</Button>
              </form>
              </Action>
            )}

            {access.messages && (
              <Action title="Сообщение" icon={<MessageSquare size={20} />}>
                <form onSubmit={(event) => submitComment(event, 'client')}>
                  <textarea name="comment" required placeholder="Сообщение" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" rows={3} />
                  <Button className="mt-4 w-full">Отправить</Button>
                </form>
              </Action>
            )}

            {access.notes && (
              <Action title="Заметка" icon={<Bell size={20} />}>
                <form onSubmit={(event) => submitComment(event, 'internal')}>
                  <textarea name="comment" required placeholder="Заметка" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" rows={3} />
                  <Button variant="secondary" className="mt-4 w-full">Добавить</Button>
                </form>
              </Action>
            )}

            {canAccess(role, 'edit_documents') && (
              <Action title="Документ" icon={<CreditCard size={20} />}>
                <form onSubmit={submitDoc}>
                  <input name="file" type="file" required className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
                  <Button className="mt-4 w-full">Загрузить</Button>
                </form>
              </Action>
            )}

            {access.manager && <Button onClick={() => changeStatus('Завершено')} className="w-full">Готово</Button>}
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
    ['Данные компании', order.clientType === 'individual' || Boolean(getOrderCompanyName(order) && order.bin)],
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
  <div className="rounded-[20px] bg-white p-4 shadow-sm sm:rounded-[22px] sm:p-5">
    <div className="mb-4 flex items-center gap-3 text-eco-900">
      {icon}
      <h3 className="font-bold">{title}</h3>
    </div>
    {children}
  </div>
);

const Section = ({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) => (
  <div className="rounded-[20px] bg-white p-4 shadow-sm sm:rounded-[22px] sm:p-6">
    <div className="mb-4 flex items-center gap-3 text-eco-900">
      {icon}
      <h3 className="text-lg font-bold sm:text-xl">{title}</h3>
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

const InfoTile = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
    <p className="mt-2 break-words text-sm font-semibold text-slate-800">{value || 'Не указано'}</p>
  </div>
);

const Grid = ({ items }: { items: Record<string, string> }) => (
  <div className="grid gap-3 md:grid-cols-2">
    {Object.entries(items).map(([key, value]) => (
      <div key={key} className="min-w-0 rounded-2xl bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase text-slate-500">{key}</p>
        <p className="mt-2 break-words text-sm text-slate-800">{value || 'Не указано'}</p>
      </div>
    ))}
  </div>
);

const List = ({ title, items }: { title: string; items: string[] }) => (
  <div className="mt-4 first:mt-0">
    <h4 className="font-semibold text-slate-900">{title}</h4>
    <div className="mt-3 space-y-2">
      {items.length ? items.map((item) => <p key={item} className="break-words rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{item}</p>) : <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">Нет данных</p>}
    </div>
  </div>
);

export const StaffClientsPage = () => {
  const { orders } = useOrders();
  const { companyKey: selectedKeyParam } = useParams();
  const [q, setQ] = useState('');
  const selectedKey = selectedKeyParam ? decodeURIComponent(selectedKeyParam) : '';
  const companies = useMemo(() => buildCompanySummaries(orders), [orders]);
  const filteredCompanies = useMemo(() => companies.filter((company) => {
    const companyOrders = orders.filter((order) => companyKey(getOrderCompanyName(order)) === company.key);
    const last = [...companyOrders].sort((a, b) => b.id.localeCompare(a.id))[0];
    return `${company.name} ${last?.bin || ''} ${last?.contactPerson || last?.clientName || ''} ${last?.phone || ''}`.toLowerCase().includes(q.toLowerCase());
  }), [companies, orders, q]);
  const selectedCompany = companies.find((company) => company.key === selectedKey);
  const selectedOrders = selectedCompany ? orders.filter((order) => companyKey(getOrderCompanyName(order)) === selectedCompany.key) : [];
  const selectedDocs = collectDocuments(selectedOrders);
  const latestOrder = [...selectedOrders].sort((a, b) => b.id.localeCompare(a.id))[0];

  if (selectedCompany) {
    return (
      <div className="space-y-6">
        <Reveal>
          <div className="rounded-[22px] bg-white p-6 shadow-sm">
            <Link to="/staff/clients" className="text-sm font-bold text-eco-700">← Все компании</Link>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="mt-2 text-3xl font-bold text-eco-900">{selectedCompany.name}</h2>
                <p className="mt-2 text-sm text-slate-500">БИН: {latestOrder?.bin || 'Нет'} · {selectedCompany.active ? 'Активное' : 'На паузе'}</p>
              </div>
              <Link to="/staff/orders" className="rounded-full bg-eco-900 px-4 py-3 text-sm font-bold text-white">Заявки</Link>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <InfoTile label="Заявки" value={String(selectedCompany.total)} />
              <InfoTile label="Активные" value={String(selectedCompany.active)} />
              <InfoTile label="Завершенные" value={String(selectedCompany.completed)} />
              <InfoTile label="Последняя" value={lastOrderDate(selectedOrders)} />
            </div>
          </div>
        </Reveal>
        <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
          <div className="space-y-6">
            <Section title="Заявки" icon={<ClipboardList size={20} />}>
              {selectedOrders.map((order) => <OrderLine key={order.id} order={order} />)}
            </Section>
            <Section title="Документы" icon={<FileText size={20} />}>
              {selectedDocs.map((doc) => <DocumentLine key={doc.id} doc={doc} />)}
            </Section>
            <Section title="История" icon={<History size={20} />}>
              <List title="Действия" items={selectedOrders.flatMap((order) => order.history.map((item) => `${order.id} · ${item.createdAt}: ${item.text}`)).slice(0, 12)} />
            </Section>
          </div>
          <div className="space-y-6">
            <Section title="Контакты" icon={<UserCheck size={20} />}>
              <Grid items={{ 'БИН/ИИН': latestOrder?.bin || 'Не указан', 'Контактное лицо': latestOrder?.contactPerson || latestOrder?.clientName || 'Не указано', Телефон: latestOrder?.phone || 'Не указан', Email: latestOrder?.email || 'Не указан' }} />
            </Section>
            <Section title="Комментарии" icon={<MessageSquare size={20} />}>
              <List title="Комментарии" items={selectedOrders.flatMap((order) => order.comments.filter((comment) => comment.visibility === 'internal').map((comment) => `${order.id} · ${comment.createdAt}: ${comment.text}`)).slice(0, 10)} />
            </Section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Reveal>
      <div className="rounded-[22px] bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-3xl font-bold text-eco-900">Компании</h2>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск компании" className="input-focus mt-4 w-full max-w-xl rounded-2xl border border-slate-200 px-4 py-3" />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredCompanies.map((company) => {
            const companyOrders = orders.filter((order) => companyKey(getOrderCompanyName(order)) === company.key);
            const last = [...companyOrders].sort((a, b) => b.id.localeCompare(a.id))[0];
            return (
              <Link key={company.key} to={`/staff/clients/${companyUrlKey(company.key)}`} className="block rounded-[20px] border border-slate-100 bg-slate-50 p-5 transition hover:border-eco-200 hover:bg-eco-50">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-eco-900">{company.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{last?.contactPerson || last?.clientName || 'Контакт не указан'} · {last?.phone || 'Телефон не указан'}</p>
                    <p className="mt-1 text-sm text-slate-500">{last?.email || 'Email не указан'}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800">{company.active ? 'Активное' : 'На паузе'}</span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  <InfoTile label="БИН/ИИН" value={last?.bin || 'Нет'} />
                  <InfoTile label="Заявки" value={String(company.total)} />
                  <InfoTile label="Активные" value={String(company.active)} />
                  <InfoTile label="Завершенные" value={String(company.completed)} />
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-500">Последняя: {lastOrderDate(companyOrders)}</p>
              </Link>
            );
          })}
          {!filteredCompanies.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Компаний нет</p>}
        </div>
      </div>
    </Reveal>
  );
};

const DocumentLine = ({ doc }: { doc: StaffDocument }) => (
  <div className="rounded-2xl bg-slate-50 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="font-bold text-slate-900">{doc.name}</p>
        <p className="mt-1 text-sm text-slate-500">{doc.company} · заявка {doc.orderId}</p>
      </div>
      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800">{doc.docType}</span>
    </div>
    <p className="mt-2 text-sm text-slate-600">{doc.status} · {doc.uploadedAt} · {doc.uploadedBy}</p>
    <Link to={`/staff/orders/${doc.orderId}`} className="mt-3 inline-flex rounded-full bg-eco-900 px-3 py-2 text-xs font-bold text-white">Открыть</Link>
  </div>
);

export const StaffDocumentsPage = () => {
  const { orders } = useOrders();
  const [q, setQ] = useState('');
  const [company, setCompany] = useState('Все');
  const [type, setType] = useState('Все');
  const [status, setStatus] = useState('Все');
  const docs = useMemo(() => collectDocuments(orders), [orders]);
  const companies = useMemo(() => Array.from(new Set(docs.map((doc) => doc.company))).sort(), [docs]);
  const types = useMemo(() => Array.from(new Set(docs.map((doc) => doc.docType))).sort(), [docs]);
  const statuses = useMemo(() => Array.from(new Set(docs.map((doc) => doc.status))).sort(), [docs]);
  const filtered = useMemo(() => docs
    .filter((doc) => company === 'Все' || doc.company === company)
    .filter((doc) => type === 'Все' || doc.docType === type)
    .filter((doc) => status === 'Все' || doc.status === status)
    .filter((doc) => `${doc.name} ${doc.company} ${doc.orderId}`.toLowerCase().includes(q.toLowerCase())), [docs, company, type, status, q]);
  const grouped = useMemo(() => filtered.reduce<Record<string, StaffDocument[]>>((acc, doc) => {
    acc[doc.company] = [...(acc[doc.company] || []), doc];
    return acc;
  }, {}), [filtered]);

  return (
    <Reveal>
      <div className="rounded-[22px] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-eco-900">Документы</h2>
          </div>
          <p className="rounded-full bg-eco-50 px-4 py-2 text-sm font-bold text-eco-800">Найдено: {filtered.length}</p>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-5">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" className="input-focus rounded-2xl border border-slate-200 px-4 py-3" />
          <select value={company} onChange={(e) => setCompany(e.target.value)} className="input-focus rounded-2xl border border-slate-200 px-4 py-3"><option>Все</option>{companies.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input-focus rounded-2xl border border-slate-200 px-4 py-3"><option>Все</option>{types.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-focus rounded-2xl border border-slate-200 px-4 py-3"><option>Все</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
          <button type="button" onClick={() => { setQ(''); setCompany('Все'); setType('Все'); setStatus('Все'); }} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-eco-800 transition hover:bg-eco-50">Сбросить</button>
        </div>
        <div className="mt-6 space-y-5">
          {Object.entries(grouped).map(([companyName, items]) => (
            <div key={companyName} className="rounded-[20px] border border-slate-100 p-4">
              <h3 className="font-bold text-eco-900">{companyName}</h3>
              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                {items.map((doc) => <DocumentLine key={doc.id} doc={doc} />)}
              </div>
            </div>
          ))}
          {!filtered.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Документов нет</p>}
        </div>
      </div>
    </Reveal>
  );
};

export const StaffNotificationsPage = () => {
  const { orders } = useOrders();
  const role = staffRole();
  const generated = buildRoleNotifications(orders, role);
  return (
    <SimpleStaffPage title="Уведомления">
      {generated.map((item) => <NotificationLine key={item.id} notification={item} />)}
      {notifications.map((notification) => <p key={notification.id} className="rounded-2xl bg-slate-50 p-4">{notification.title} · {notification.date}</p>)}
    </SimpleStaffPage>
  );
};

export const StaffProfilePage = () => {
  const user = getCurrentUser();
  const role = staffRole();
  const sections = ['Главная', 'Заявки', 'Компании', 'Документы', 'Уведомления', 'Профиль'];
  const accessNames: Partial<Record<Permission, string>> = {
    view_orders: 'Заявки',
    view_companies: 'Компании',
    view_documents: 'Документы',
    view_payment: 'Оплата',
    edit_payment: 'Изменение оплаты',
    view_ecology: 'Экология',
    edit_ecology: 'Изменение экологии',
    view_laboratory: 'Лаборатория',
    edit_laboratory: 'Изменение лаборатории',
    send_messages: 'Сообщения',
    add_internal_notes: 'Заметки',
    view_action_history: 'История',
    manage_roles: 'Роли',
  };
  const accessList = Array.from(new Set([...sections, ...permissionsForRole(role).map((permission) => accessNames[permission]).filter(Boolean)]));
  return (
    <SimpleStaffPage title="Профиль">
      <Grid items={{ Имя: user?.name || 'Сотрудник', Роль: roleTitle(role), Email: user?.email || 'Нет', Телефон: user?.phone || 'Нет' }} />
      <div className="mt-5 rounded-2xl bg-slate-50 p-4">
        <h3 className="font-bold text-eco-900">Доступы</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {accessList.map((item) => item && <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800">{item}</span>)}
        </div>
      </div>
      <Link to="/staff/login" onClick={logout} className="mt-5 inline-flex rounded-full bg-eco-900 px-5 py-3 text-sm font-bold text-white">Выйти</Link>
    </SimpleStaffPage>
  );
};

const SimpleStaffPage = ({ title, children }: { title: string; children: ReactNode }) => (
  <Reveal>
    <div className="rounded-[22px] bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-2xl font-bold text-eco-900">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  </Reveal>
);
