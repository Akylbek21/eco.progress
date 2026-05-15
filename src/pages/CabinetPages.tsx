import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, CreditCard, Download, FileSignature, FileText, LockKeyhole, RefreshCw, Upload, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { getClientOrders, getOrderById as fetchOrderById, createOrder, addComment, uploadDocument, signOrderContract, payOrderOnline, uploadQuarterDocument, deletePrimaryDocumentFile, respondLaboratoryMeasurementAgreement, sendPrimaryDocumentsForReview, uploadLaboratoryPrimaryDocument, uploadPrimaryDocument } from '../services/orderService';
import { getClientPayments, getClientDebts, getFinanceContracts } from '../services/paymentService';
import { getServices } from '../services/serviceService';
import {
  contractStatusClass,
  formatContractDaysLeft,
  formatIsoDate,
  getBusinessCompanyById,
  getContractDisplayStatus,
  getContractProgress,
  getContractsForClient,
  getOrderStatusDefinition,
  getOrderWorkStageLabel,
  getPrimaryContractForOrder,
  getWorkflowForOrder,
  getWorkStageLabel,
  isWorkOrderStatus,
} from '../utils/crm';
import { getAnnualRequestDebtSummary, getAnnualRequestProgress, getAnnualRequestWarnings, getCurrentQuarterForRequest, isAnnualRequest } from '../utils/annualRequests';
import { formatCurrency, getPaymentStatusColor, getPaymentStatusLabel } from '../utils/payments';
import type { ClientPrimaryDocumentStatus, Contract, Debt, LaboratoryPrimaryDocument, Order, OrderPrimaryDocument, Payment, RequestQuarter } from '../types';

type ClientSimpleStatus = 'Заявка принята' | 'Ожидаем документы' | 'Договор и оплата' | 'В работе' | 'Готово' | 'Отменено';

const clientSimpleSteps: ClientSimpleStatus[] = ['Заявка принята', 'Ожидаем документы', 'Договор и оплата', 'В работе', 'Готово'];

const clientSimpleStatus = (order: Order): ClientSimpleStatus => {
  if (order.status === 'Отменено') return 'Отменено';
  if (['Готово', 'Завершено'].includes(order.status)) return 'Готово';
  if (order.primaryDocuments?.some((doc) => ['need_upload', 'needs_fix'].includes(doc.status)) || order.status === 'Ожидаем первичные документы') return 'Ожидаем документы';
  if (['Передано бухгалтеру', 'Ожидает счет', 'Счет отправлен', 'Ожидаем оплату', 'Частично оплачено', 'Полностью оплачено', 'Договор отправлен', 'Ожидаем подпись договора', 'Договор подписан', 'Передано специалисту'].includes(order.status)) return 'Договор и оплата';
  if (isWorkOrderStatus(order.status) || ['annual_active', 'Проверка результата'].includes(order.status)) return 'В работе';
  return 'Заявка принята';
};

const badge = (status: ClientSimpleStatus) => {
  const tone =
    status === 'Готово' ? 'bg-emerald-50 text-emerald-800' :
    status === 'Отменено' ? 'bg-rose-50 text-rose-800' :
    status === 'Ожидаем документы' ? 'bg-amber-50 text-amber-800' :
    status === 'Договор и оплата' ? 'bg-indigo-50 text-indigo-800' :
    status === 'В работе' ? 'bg-eco-50 text-eco-800' :
    'bg-sky-50 text-sky-800';
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{status}</span>;
};

const clientStatusText = (order: Order) => {
  const status = clientSimpleStatus(order);
  if (status === 'Заявка принята') return 'Мы получили заявку. Менеджер проверит данные и сообщит следующий шаг.';
  if (status === 'Ожидаем документы') return 'Загрузите первичные документы внутри заявки, чтобы мы могли начать подготовку.';
  if (status === 'Договор и оплата') return 'Проверьте договор и счет. Если требуется, загрузите чек оплаты.';
  if (status === 'В работе') return 'Работа выполняется. Готовые документы появятся в разделе результата.';
  if (status === 'Готово') return 'Работа завершена. Готовые документы доступны в заявке.';
  return 'Заявка отменена. При необходимости создайте новую заявку.';
};

const clientNextStep = (order: Order) => {
  const status = clientSimpleStatus(order);
  if (status === 'Ожидаем документы') return 'Загрузите первичные документы для начала работы.';
  if (status === 'Договор и оплата') return 'Проверьте договор, счет и при необходимости загрузите чек оплаты.';
  if (status === 'В работе') return 'Ожидайте готовые документы, мы добавим их в результат.';
  if (status === 'Готово') return 'Скачайте готовые документы в разделе “Результат”.';
  if (status === 'Отменено') return 'Создайте новую заявку, если услуга снова нужна.';
  return 'Ожидайте сообщение менеджера.';
};

const ClientStatusPath = ({ order }: { order: Order }) => {
  const simpleStatus = clientSimpleStatus(order);
  const current = simpleStatus === 'Отменено' ? -1 : clientSimpleSteps.indexOf(simpleStatus);
  const steps = simpleStatus === 'Отменено' ? ['Отменено'] : clientSimpleSteps;
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {steps.map((step, index) => (
        <div key={step} className={`rounded-2xl border p-3 text-xs font-semibold ${index <= current ? 'border-accent bg-eco-50 text-eco-900' : 'border-slate-200 bg-white text-slate-500'}`}>
          {step}
        </div>
      ))}
    </div>
  );
};

const useClientOrders = () => {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({ queryKey: ['client-orders'], queryFn: getClientOrders });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['client-orders'] });
  return { orders, refresh, isLoading };
};

export const CabinetDashboardPage = () => {
  const { orders, isLoading } = useClientOrders();
  const { user } = useAuth();
  const contracts = getContractsForClient(user);
  if (isLoading) return <div className="flex min-h-[40vh] items-center justify-center"><LoadingSpinner /></div>;
  const nearestContract = [...contracts].sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())[0];
  const stats = [
    ['Активные заявки', orders.filter((o) => !['Готово', 'Завершено', 'Отменено'].includes(o.status)).length],
    ['Нужны документы', orders.filter((o) => clientSimpleStatus(o) === 'Ожидаем документы').length],
    ['Договор и оплата', orders.filter((o) => clientSimpleStatus(o) === 'Договор и оплата').length],
    ['Договоров', contracts.length],
  ];
  return (
    <div>
      <Reveal>
        <div className="rounded-[24px] bg-eco-900 p-5 text-white shadow-xl shadow-eco-900/10 sm:p-7">
          <p className="text-sm text-white/65">Добро пожаловать</p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">{user?.name ?? 'Клиент ECOPROGRESS GROUP'}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/72">Здесь видно главное: статус заявки, какие документы нужны, договор, счет и готовый результат.</p>
            </div>
            <Link to="/cabinet/orders/new"><Button className="w-full bg-accent text-eco-900 hover:bg-accent/90 sm:w-auto">Создать новую заявку</Button></Link>
          </div>
        </div>
      </Reveal>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {stats.map(([label, value], index) => (
          <Reveal key={String(label)} delay={index * 0.04}><div className="rounded-[20px] bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-eco-900">{value}</p></div></Reveal>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Reveal><Panel title="Последние заявки">{orders.slice(0, 4).map((order) => <OrderRow key={order.id} order={order} />)}</Panel></Reveal>
        <Reveal delay={0.06}>
          <Panel title="Договоры сопровождения">
            {nearestContract && <ClientContractCard contract={nearestContract} />}
            {contracts.slice(0, 3).filter((contract) => contract.id !== nearestContract?.id).map((contract) => <ClientContractCard key={contract.id} contract={contract} compact />)}
            {!contracts.length && <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Договоров пока нет</div>}
          </Panel>
        </Reveal>
      </div>
    </div>
  );
};

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="rounded-[22px] bg-white p-6 shadow-sm"><h3 className="mb-4 text-xl font-bold text-eco-900">{title}</h3><div className="space-y-3">{children}</div></div>;

const ClientContractCard = ({ contract, compact = false }: { contract: ReturnType<typeof getContractsForClient>[number]; compact?: boolean }) => {
  const progress = getContractProgress(contract);
  return (
    <div className="rounded-2xl bg-eco-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-eco-900">{contract.title}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{contract.number} · {getBusinessCompanyById(contract.businessCompanyId).name}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${contractStatusClass(contract)}`}>{getContractDisplayStatus(contract)}</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
        <span className="font-bold text-eco-900">{formatContractDaysLeft(contract)}</span>
        {!compact && <span className="text-slate-600">до {formatIsoDate(contract.endsAt)}</span>}
      </div>
    </div>
  );
};

const OrderRow = ({ order }: { order: Order }) => (
  <Link to={`/cabinet/orders/${order.id}`} className="block rounded-2xl bg-eco-50 p-4 hover:bg-eco-100">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0"><p className="font-semibold text-slate-900">{order.id}</p><p className="mt-1 break-words text-sm text-slate-600">{order.service}</p></div>
      {badge(clientSimpleStatus(order))}
    </div>
    <p className="mt-3 text-sm leading-6 text-slate-600">{clientStatusText(order)}</p>
    <ClientStatusPath order={order} />
  </Link>
);

export const CabinetOrdersPage = () => {
  const { orders } = useClientOrders();
  return <PageList title="Заявки">{orders.map((order) => <OrderRow key={order.id} order={order} />)}</PageList>;
};

const PageList = ({ title, children }: { title: string; children: React.ReactNode }) => <Reveal><div className="rounded-[22px] bg-white p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-bold text-eco-900">{title}</h2><Link to="/cabinet/orders/new"><Button>Новая заявка</Button></Link></div><div className="space-y-3">{children}</div></div></Reveal>;

export const CabinetNewOrderPage = ({ onNotify }: { onNotify?: (message: string) => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: getServices });
  const serviceFromUrl = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const serviceId = params.get('service') ?? '';
    return services.some((service) => service.id === serviceId) ? serviceId : services[0]?.id ?? '';
  }, [location.search, services]);
  const itemsFromUrl = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (params.get('items') ?? '').split(',').map(Number).filter((index) => Number.isInteger(index) && index >= 0);
  }, [location.search]);
  const [selectedOrderServiceId, setSelectedOrderServiceId] = useState<string>(serviceFromUrl);
  const [selectedOrderItems, setSelectedOrderItems] = useState<string[]>([]);
  const selectedOrderService = services.find((service) => service.id === selectedOrderServiceId) ?? services[0];
  const selectedBusinessCompany = getBusinessCompanyById(selectedOrderService.businessCompanyId);
  const selectedWorkStage = getWorkStageLabel({
    service: `${selectedOrderService.title} ${selectedOrderItems.join(' ')}`,
    serviceId: selectedOrderService.id,
    businessCompanyId: selectedOrderService.businessCompanyId,
  });
  useEffect(() => {
    setSelectedOrderServiceId(serviceFromUrl);
    const service = services.find((item) => item.id === serviceFromUrl) ?? services[0];
    setSelectedOrderItems(itemsFromUrl.map((index) => service.includes[index]).filter(Boolean));
  }, [serviceFromUrl, itemsFromUrl]);
  const toggleOrderItem = (item: string) => {
    setSelectedOrderItems((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]));
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('file') as File | null;
    const extraText = [
      `Тип клиента: ${String(form.get('clientKind'))}`,
      `Город: ${String(form.get('city') || 'не указан')}`,
      `WhatsApp: ${String(form.get('whatsapp') || 'не указан')}`,
    ].join('\n');
    const selectedItemsText = selectedOrderItems.length > 0 ? `\n\nВыбранные работы:\n${selectedOrderItems.map((item) => `- ${item}`).join('\n')}` : '';
    const order = await createOrder({
      contactPerson: String(form.get('contactPerson')),
      phone: String(form.get('phone')),
      email: String(form.get('email')),
      companyName: String(form.get('companyName')),
      bin: String(form.get('bin')),
      serviceId: selectedOrderService.id,
      service: selectedOrderItems.length > 0 ? `${selectedOrderService.title}: ${selectedOrderItems.join('; ')}` : selectedOrderService.title,
      urgency: String(form.get('urgency')),
      comment: `${String(form.get('comment'))}\n\n${extraText}${selectedItemsText}`,
      fileName: file?.name,
    });
    onNotify?.('Заявка создана. Сотрудник проверит данные и отправит договор со счетом.');
    navigate(`/cabinet/orders/${order.id}`);
  };
  return (
    <Reveal>
      <form onSubmit={submit} className="rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-2xl font-bold text-eco-900">Новая заявка</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Заполните то, что знаете. Если не уверены, выберите “Не знаю” и специалист поможет.</p>
        <StepTitle number="1" title="Кто вы?" />
        <div className="grid gap-3 sm:grid-cols-3">
          {['Физическое лицо', 'ИП', 'ТОО / компания'].map((item) => <label key={item} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700"><input name="clientKind" type="radio" defaultChecked={item === 'ТОО / компания'} className="mr-2 accent-[#38C7BA]" />{item}</label>)}
        </div>
        <StepTitle number="2" title="Что нужно?" />
        <div className="rounded-2xl border border-eco-100 bg-eco-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-eco-900">Направление услуги</p>
            <p className="text-sm font-semibold text-eco-600">Выбрано работ: {selectedOrderItems.length}</p>
          </div>
          <div className="mt-4 rounded-2xl border border-eco-100 bg-white p-4 text-sm text-slate-700">
            <p className="font-bold text-eco-900">Заявка будет направлена в {selectedBusinessCompany.name}</p>
            <p className="mt-1 leading-6 text-slate-600">{selectedBusinessCompany.description}</p>
          </div>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Направление
            <select
              value={selectedOrderServiceId}
              onChange={(event) => {
                setSelectedOrderServiceId(event.target.value);
                setSelectedOrderItems([]);
              }}
              className="input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              {services.map((service) => (
                <option key={service.id} value={service.id}>{service.title}</option>
              ))}
            </select>
          </label>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {selectedOrderService.includes.map((item) => (
              <label key={item} className={`flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4 text-sm transition ${selectedOrderItems.includes(item) ? 'border-accent ring-2 ring-accent/20' : 'border-slate-200 hover:border-eco-200'}`}>
                <input
                  type="checkbox"
                  checked={selectedOrderItems.includes(item)}
                  onChange={() => toggleOrderItem(item)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#38C7BA]"
                />
                <span className="leading-6 text-slate-700">{item}</span>
              </label>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 rounded-2xl bg-white p-4 text-sm font-semibold text-slate-700"><input type="checkbox" className="accent-[#38C7BA]" />Не знаю, нужна помощь специалиста</label>
        </div>
        <StepTitle number="3" title="Данные" />
        <div className="grid gap-4 md:grid-cols-2">
          <Input name="contactPerson" label="Контактное лицо *" defaultValue={user?.name} required />
          <Input name="phone" label="Телефон *" defaultValue={user?.phone} required />
          <Input name="whatsapp" label="WhatsApp" />
          <Input name="email" label="Email *" type="email" defaultValue={user?.email} required />
          <Input name="companyName" label="Название компании" defaultValue={user?.companyName ?? user?.name} />
          <Input name="bin" label="БИН / ИИН" defaultValue={user?.bin} />
          <Input name="city" label="Город" defaultValue={user?.city} />
          <label className="text-sm font-semibold text-slate-700">Срочность<select name="urgency" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"><option>Стандартная</option><option>Срочно</option><option>Не срочно</option></select></label>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">БИН/ИИН можно не заполнять, если вы пока хотите только консультацию.</p>
        <StepTitle number="4" title="Комментарий и документы" />
        <label className="block text-sm font-semibold text-slate-700">Короткое описание задачи<textarea name="comment" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={4} placeholder="Например: нужно вывезти строительные отходы или подготовить документы для объекта" /></label>
        <label className="mt-4 block text-sm font-semibold text-slate-700">Прикрепить файл, если есть<input name="file" type="file" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
        <StepTitle number="5" title="Подтверждение" />
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold text-eco-900">Порядок работы по заявке</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-9">
            {['Консультация', 'Анализ', 'КП', 'Договор', 'Счет на оплату', selectedWorkStage, 'Проверка результата', 'Готово', 'Завершено'].map((step, index) => (
              <div key={step} className="rounded-2xl bg-eco-50 p-3 text-xs font-semibold text-eco-900">
                <span className="mr-2 text-slate-500">{index + 1}.</span>{step}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-3 rounded-2xl border border-eco-100 bg-eco-50 p-4 text-sm text-slate-700 md:grid-cols-3">
          <div className="flex items-center gap-3"><FileSignature size={18} className="text-eco-700" />Сотрудник проверит заявку</div>
          <div className="flex items-center gap-3"><CreditCard size={18} className="text-eco-700" />Счет появится после проверки</div>
          <div className="flex items-center gap-3"><LockKeyhole size={18} className="text-eco-700" />Статусы сохраняются в кабинете</div>
        </div>
        <label className="mt-4 flex items-start gap-3 text-sm text-slate-600">
          <input required type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300" />
          <span>Согласен отправить заявку на проверку. Договор и счет будут доступны после обработки сотрудником.</span>
        </label>
        <Button className="mt-6">Отправить заявку на проверку</Button>
      </form>
    </Reveal>
  );
};

const Input = ({ name, label, type = 'text', defaultValue = '', required = false }: { name: string; label: string; type?: string; defaultValue?: string; required?: boolean }) => <label className="text-sm font-semibold text-slate-700">{label}<input name={name} type={type} required={required} defaultValue={defaultValue} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>;

const StepTitle = ({ number, title }: { number: string; title: string }) => (
  <div className="mt-7 mb-4 flex items-center gap-3">
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-eco-900 text-sm font-bold text-white">{number}</span>
    <h3 className="text-lg font-bold text-eco-900">{title}</h3>
  </div>
);

export const CabinetOrderDetailsPage = ({ onNotify }: { onNotify?: (message: string) => void }) => {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<Order | undefined>();
  const [activeTab, setActiveTab] = useState<'Обзор' | 'Документы' | 'Договор и счет' | 'Результат'>('Обзор');
  const load = () => id && fetchOrderById(id).then(setOrder);
  useEffect(() => { load(); }, [id]);
  if (!id) return <Navigate to="/cabinet/orders" replace />;
  if (!order) return <div className="flex min-h-[40vh] items-center justify-center"><LoadingSpinner /></div>;
  const serviceContract = getPrimaryContractForOrder(order);
  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await addComment(order.id, String(form.get('comment')), 'client');
    onNotify?.('Комментарий добавлен');
    event.currentTarget.reset();
    load();
    queryClient.invalidateQueries({ queryKey: ['client-orders'] });
  };
  const submitFile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get('file') as File | null;
    if (file) await uploadDocument(order.id, file);
    onNotify?.('Документ загружен');
    event.currentTarget.reset();
    load();
    queryClient.invalidateQueries({ queryKey: ['client-orders'] });
  };
  const submitQuarterFile = async (event: FormEvent<HTMLFormElement>, quarter: RequestQuarter) => {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get('file') as File | null;
    if (file) {
      await uploadQuarterDocument(order.id, quarter.id, file, 'client_data');
      onNotify?.('Документ квартала загружен');
    }
    event.currentTarget.reset();
    load();
    queryClient.invalidateQueries({ queryKey: ['client-orders'] });
  };
  const submitPrimaryFile = async (event: FormEvent<HTMLFormElement>, document: OrderPrimaryDocument) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('file') as File | null;
    if (file?.name) {
      await uploadPrimaryDocument(order.id, document.id, file.name, String(form.get('comment') || ''));
      onNotify?.(document.fileName ? 'Файл заменен' : 'Документ загружен');
    }
    event.currentTarget.reset();
    load();
  };
  const sendPrimaryDocs = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await sendPrimaryDocumentsForReview(order.id, String(form.get('comment') || ''));
    onNotify?.('Документы отправлены менеджеру на проверку');
    event.currentTarget.reset();
    load();
  };
  const deletePrimaryFile = async (document: OrderPrimaryDocument) => {
    await deletePrimaryDocumentFile(order.id, document.id);
    onNotify?.('Файл удален');
    load();
  };
  const submitLaboratoryPrimaryFile = async (event: FormEvent<HTMLFormElement>, document: LaboratoryPrimaryDocument) => {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get('file') as File | null;
    if (file?.name) {
      await uploadLaboratoryPrimaryDocument(order.id, document.id, file.name);
      onNotify?.(document.fileName ? 'Файл заменен' : 'Документ загружен');
    }
    event.currentTarget.reset();
    load();
  };
  const acceptMeasurement = async () => {
    await respondLaboratoryMeasurementAgreement(order.id, { action: 'accept' });
    onNotify?.('Дата замера подтверждена');
    load();
  };
  const requestMeasurementReschedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await respondLaboratoryMeasurementAgreement(order.id, {
      action: 'reschedule',
      rescheduleDate: String(form.get('rescheduleDate') || ''),
      rescheduleTime: String(form.get('rescheduleTime') || ''),
      comment: String(form.get('comment') || ''),
    });
    onNotify?.('Вариант другой даты отправлен');
    event.currentTarget.reset();
    load();
  };
  const handleSign = async () => {
    await signOrderContract(order.id, order.signatureProvider || 'NCALayer / ЭЦП');
    onNotify?.('Договор подписан электронной подписью');
    load();
    queryClient.invalidateQueries({ queryKey: ['client-orders'] });
  };
  const handlePay = async () => {
    await payOrderOnline(order.id, order.paymentMethod || 'Банковская карта');
    onNotify?.('Оплата прошла онлайн');
    load();
    queryClient.invalidateQueries({ queryKey: ['client-orders'] });
  };
  return (
    <div className="space-y-6">
      <Reveal>
        <div className="rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-500">Заявка №{order.id.replace('ORD-', '')}</p>
              <h2 className="mt-1 break-words text-2xl font-bold text-eco-900">{order.service}</h2>
            </div>
            {badge(clientSimpleStatus(order))}
          </div>
          <ClientStatusPath order={order} />
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {(['Обзор', 'Документы', 'Договор и счет', 'Результат'] as const).map((tab) => (
              <button
                type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeTab === tab ? 'bg-eco-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-eco-50 hover:text-eco-900'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {activeTab === 'Обзор' && (
        <Reveal>
          <div className="rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Info label="Номер заявки" value={order.id} />
              <Info label="Услуга" value={order.service} />
              <Info label="Статус" value={clientSimpleStatus(order)} />
              <Info label="Менеджер" value={order.manager || 'Назначается'} />
            </div>
            <div className="mt-5 rounded-2xl bg-eco-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Следующий шаг</p>
              <p className="mt-2 text-lg font-bold text-eco-900">{clientNextStep(order)}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{clientStatusText(order)}</p>
            </div>
          </div>
        </Reveal>
      )}

      {activeTab === 'Документы' && (
        <ClientPrimaryDocumentsPanel
          order={order}
          onUpload={submitPrimaryFile}
          onSend={sendPrimaryDocs}
          onDelete={deletePrimaryFile}
        />
      )}

      {activeTab === 'Договор и счет' && (
        <ClientContractInvoicePanel order={order} onSign={handleSign} onPay={handlePay} onUploadReceipt={submitFile} serviceContract={serviceContract} />
      )}

      {activeTab === 'Результат' && <ClientResultPanel order={order} />}
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => <div className="rounded-2xl bg-eco-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-2 text-sm text-slate-800">{value || 'Не указано'}</p></div>;

const primaryDocumentStatusLabels: Record<ClientPrimaryDocumentStatus, string> = {
  need_upload: 'Нужно загрузить',
  sent: 'Отправлено',
  in_review: 'На проверке',
  accepted: 'Принято',
  needs_fix: 'Нужно исправить',
};

const primaryDocumentStatusClass = (status: ClientPrimaryDocumentStatus) => {
  if (status === 'accepted') return 'bg-emerald-50 text-emerald-800 ring-emerald-100';
  if (status === 'needs_fix') return 'bg-rose-50 text-rose-800 ring-rose-100';
  if (status === 'in_review') return 'bg-indigo-50 text-indigo-800 ring-indigo-100';
  if (status === 'sent') return 'bg-sky-50 text-sky-800 ring-sky-100';
  return 'bg-amber-50 text-amber-800 ring-amber-100';
};

const ClientPrimaryDocumentsPanel = ({
  order,
  onUpload,
  onSend,
  onDelete,
}: {
  order: Order;
  onUpload: (event: FormEvent<HTMLFormElement>, document: OrderPrimaryDocument) => void;
  onSend: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (document: OrderPrimaryDocument) => void;
}) => {
  const documents = order.primaryDocuments || [];
  const requiredLeft = documents.filter((doc) => doc.required && doc.status !== 'accepted').length;
  const canSend = documents.some((doc) => doc.fileName && ['sent', 'needs_fix'].includes(doc.status));

  return (
    <Reveal>
      <div className="rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-eco-900">Первичные документы для работы</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Загружайте документы прямо в эту заявку. Принятые документы удалить нельзя.
            </p>
          </div>
          <span className="rounded-full bg-eco-50 px-4 py-2 text-sm font-bold text-eco-800">Осталось: {requiredLeft}</span>
        </div>

        <div className="mt-5 space-y-4">
          {documents.map((doc) => (
            <div key={doc.id} className="rounded-[20px] border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{doc.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{doc.required ? 'Обязательный документ' : 'Необязательный документ'}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${primaryDocumentStatusClass(doc.status)}`}>{primaryDocumentStatusLabels[doc.status]}</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Info label="Файл" value={doc.fileName || 'Не загружен'} />
                <Info label="Дата загрузки" value={doc.uploadedAt || 'Нет'} />
                <Info label="Комментарий менеджера" value={doc.managerComment || 'Нет'} />
              </div>
              {doc.clientComment && <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">Ваш комментарий: {doc.clientComment}</p>}
              {doc.status !== 'accepted' && (
                <form onSubmit={(event) => onUpload(event, doc)} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <input name="file" type="file" required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3" />
                  <input name="comment" placeholder="Комментарий к документу" defaultValue={doc.clientComment || ''} className="input-focus w-full rounded-2xl border border-slate-200 bg-white px-4 py-3" />
                  <Button type="submit" className="whitespace-nowrap">{doc.fileName ? 'Заменить файл' : 'Загрузить'}</Button>
                </form>
              )}
              {doc.fileName && doc.status !== 'accepted' && (
                <button type="button" onClick={() => onDelete(doc)} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-rose-700">
                  <X size={16} /> Удалить файл
                </button>
              )}
            </div>
          ))}
          {!documents.length && (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
              Менеджер пока не запросил документы. Когда список появится, вы сможете загрузить файлы здесь.
            </div>
          )}
        </div>

        {documents.length > 0 && (
          <form onSubmit={onSend} className="mt-5 rounded-[20px] border border-eco-100 bg-eco-50 p-4">
            <label className="text-sm font-semibold text-slate-700">Комментарий менеджеру</label>
            <textarea name="comment" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={3} placeholder="Например: загрузили все документы, просим проверить" />
            <Button type="submit" disabled={!canSend} className="mt-3 w-full sm:w-auto">
              <Upload size={16} className="mr-2" /> Отправить документы
            </Button>
          </form>
        )}
      </div>
    </Reveal>
  );
};

const ClientContractInvoicePanel = ({
  order,
  onSign,
  onPay,
  onUploadReceipt,
  serviceContract,
}: {
  order: Order;
  onSign: () => void;
  onPay: () => void;
  onUploadReceipt: (event: FormEvent<HTMLFormElement>) => void;
  serviceContract?: ReturnType<typeof getPrimaryContractForOrder>;
}) => {
  const contractDoc = order.documents.find((doc) => doc.name.toLowerCase().includes('договор')) || order.resultDocuments.find((doc) => doc.name.toLowerCase().includes('договор'));
  const invoiceDoc = order.resultDocuments.find((doc) => doc.type === 'invoice' || doc.name.toLowerCase().includes('счет') || doc.name.toLowerCase().includes('счёт'));
  const paymentText = order.paymentStatus === 'paid' || order.paymentStatus === 'transferred_to_specialist'
    ? 'Оплата получена'
    : order.paymentStatus === 'partial'
    ? 'Оплачено частично'
    : ['invoice_sent', 'awaiting_payment', 'pending'].includes(order.paymentStatus || '')
    ? 'Ожидаем оплату'
    : 'Счет пока не выставлен';

  return (
    <Reveal>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-xl font-bold text-eco-900">Договор и счет</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <DocumentDownloadCard title="Договор" docName={contractDoc?.name || serviceContract?.number || 'Договор пока не загружен'} ready={Boolean(contractDoc || serviceContract)} />
            <DocumentDownloadCard title="Счет" docName={invoiceDoc?.name || order.invoiceNumber || 'Счет пока не выставлен'} ready={Boolean(invoiceDoc || order.invoiceNumber)} />
          </div>
          <div className="mt-5 rounded-2xl bg-eco-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Статус оплаты</p>
            <p className="mt-2 text-lg font-bold text-eco-900">{paymentText}</p>
          </div>
        </div>
        <div className="space-y-5">
          <OnlineOrderPanel order={order} onSign={onSign} onPay={onPay} />
          <form onSubmit={onUploadReceipt} className="rounded-[22px] bg-white p-5 shadow-sm">
            <h3 className="font-bold text-eco-900">Загрузить чек оплаты</h3>
            <input name="file" type="file" required className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3" />
            <Button className="mt-4 w-full">Загрузить чек</Button>
          </form>
        </div>
      </div>
    </Reveal>
  );
};

const DocumentDownloadCard = ({ title, docName, ready }: { title: string; docName: string; ready: boolean }) => (
  <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-4">
    <div className="flex items-start gap-3">
      <FileText className={ready ? 'text-eco-700' : 'text-slate-400'} size={20} />
      <div className="min-w-0">
        <p className="font-bold text-slate-900">{title}</p>
        <p className="mt-1 break-words text-sm text-slate-600">{docName}</p>
      </div>
    </div>
    <a href="#download" className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold ${ready ? 'bg-eco-900 text-white' : 'pointer-events-none bg-slate-200 text-slate-500'}`}>
      <Download size={14} /> Скачать
    </a>
  </div>
);

const ClientResultPanel = ({ order }: { order: Order }) => {
  const ready = ['Готово', 'Завершено'].includes(order.status);
  const results = ready ? order.resultDocuments.filter((doc) => doc.type === 'result') : [];
  return (
    <Reveal>
      <div className="rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-xl font-bold text-eco-900">Результат</h3>
        {results.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {results.map((doc) => (
              <div key={doc.id} className="rounded-[20px] bg-eco-50 p-4">
                <p className="font-bold text-slate-900">{doc.name}</p>
                <p className="mt-1 text-sm text-slate-500">Дата готовности: {doc.uploadedAt}</p>
                <p className="mt-2 text-sm text-slate-600">{doc.status}</p>
                <a href={`#${doc.id}`} download={doc.name} className="mt-3 inline-flex items-center gap-2 rounded-full bg-eco-900 px-4 py-2 text-xs font-bold text-white"><Download size={14} /> Скачать</a>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            Работа еще выполняется. Когда документы будут готовы, они появятся здесь.
          </div>
        )}
      </div>
    </Reveal>
  );
};

const clientQuarterWorkLabel = (quarter: RequestQuarter) => {
  if (quarter.workStatus === 'completed') return 'Работы выполнены';
  if (quarter.workStatus === 'in_progress') return 'Работы идут';
  if (quarter.workStatus === 'waiting_client_data') return 'Нужны данные от клиента';
  if (quarter.workStatus === 'blocked_by_debt') return 'Ожидаем оплату';
  if (quarter.workStatus === 'ready_to_start') return 'Готово к старту';
  return 'Запланировано';
};

const clientPaymentLabel = (remainingAmount: number, paymentStatus: RequestQuarter['paymentStatus']) => {
  if (remainingAmount <= 0 || paymentStatus === 'paid') return 'Оплачено';
  if (paymentStatus === 'partial') return 'Оплачено частично';
  if (paymentStatus === 'overdue') return 'Есть просрочка';
  return 'Ожидает оплаты';
};

const clientQuarterHelpText = (quarter: RequestQuarter) => {
  if (quarter.workStatus === 'waiting_client_data') return 'Загрузите документы или данные по этому кварталу.';
  if (quarter.remainingAmount > 0) return 'После оплаты квартальный этап продолжится по графику.';
  if (quarter.workStatus === 'completed') return 'Результат квартала можно посмотреть ниже.';
  return 'Следите за статусом работ и документами квартала.';
};

const ClientAnnualRequestPanel = ({ order, onUpload }: { order: Order; onUpload: (event: FormEvent<HTMLFormElement>, quarter: RequestQuarter) => void }) => {
  const progress = getAnnualRequestProgress(order);
  const debt = getAnnualRequestDebtSummary(order);
  const currentQuarter = getCurrentQuarterForRequest(order);
  const warnings = getAnnualRequestWarnings(order).filter((warning) => !warning.includes('бухгалтер'));
  const quarters = useMemo(() => [...(order.quarters || [])].sort((a, b) => a.quarter - b.quarter), [order.quarters]);
  const [selectedQuarterId, setSelectedQuarterId] = useState<string>();
  const selectedQuarter = quarters.find((quarter) => quarter.id === selectedQuarterId) || quarters[0];

  useEffect(() => {
    if (!quarters.length) {
      setSelectedQuarterId(undefined);
      return;
    }
    if (!selectedQuarterId || !quarters.some((quarter) => quarter.id === selectedQuarterId)) {
      setSelectedQuarterId(quarters[0].id);
    }
  }, [quarters, selectedQuarterId]);

  return (
    <div className="mt-6 rounded-[22px] border border-eco-100 bg-eco-50/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-eco-900">Годовой договор: 4 квартала</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Заявка активна весь год. Каждый квартал идет как отдельный этап: работы, счет, оплата, документы и результат.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800 ring-1 ring-eco-100">Готово {progress.completed} из {progress.total}</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Info label="Период договора" value={`${order.annualPeriodStart || 'Не указан'} - ${order.annualPeriodEnd || 'Не указан'}`} />
        <Info label="Сейчас идет" value={currentQuarter?.quarterLabel || 'Нет активного квартала'} />
        <Info label="Кварталы" value={`${progress.completed} выполнено, ${Math.max(progress.total - progress.completed, 0)} в работе/плане`} />
        <Info label="Осталось оплатить" value={formatCurrency(debt.totalDebt)} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {['1. Подписываем годовой договор', '2. Работаем по кварталам', '3. Счет и оплата отдельно за квартал', '4. Результат загружается в нужный квартал'].map((item) => (
          <div key={item} className="rounded-2xl bg-white p-4 text-sm font-semibold leading-6 text-slate-700 ring-1 ring-eco-100">{item}</div>
        ))}
      </div>
      {warnings.length > 0 && (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {warnings.map((warning) => <p key={warning} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-amber-800">{warning}</p>)}
        </div>
      )}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {quarters.map((quarter) => (
          <button
            type="button"
            key={quarter.id}
            onClick={() => setSelectedQuarterId(quarter.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
              selectedQuarter?.id === quarter.id
                ? 'bg-eco-900 text-white shadow-lg shadow-eco-900/10'
                : 'bg-white text-slate-600 ring-1 ring-eco-100 hover:bg-eco-100 hover:text-eco-900'
            }`}
          >
            {quarter.quarterLabel}
          </button>
        ))}
      </div>
      {selectedQuarter ? (
        <div className="mt-4">
          <ClientQuarterCard quarter={selectedQuarter} isCurrent={currentQuarter?.id === selectedQuarter.id} onUpload={onUpload} />
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-500">Кварталы пока не сформированы</div>
      )}
    </div>
  );
};

const ClientQuarterCard = ({ quarter, isCurrent, onUpload }: { quarter: RequestQuarter; isCurrent: boolean; onUpload: (event: FormEvent<HTMLFormElement>, quarter: RequestQuarter) => void }) => {
  const paidPercent = quarter.plannedAmount > 0 ? Math.min(100, Math.round((quarter.paidAmount / quarter.plannedAmount) * 100)) : 0;
  return (
    <div className={`rounded-[20px] border bg-white p-4 ${isCurrent ? 'border-eco-300 shadow-sm' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="shrink-0 text-eco-700" />
            <h4 className="font-bold text-eco-900">{quarter.quarterLabel} договора</h4>
          </div>
          <p className="mt-1 text-sm text-slate-500">{quarter.periodStart} - {quarter.periodEnd}</p>
        </div>
        {isCurrent && <span className="rounded-full bg-eco-900 px-2 py-1 text-[11px] font-bold text-white">Текущий квартал</span>}
      </div>
      <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">{clientQuarterHelpText(quarter)}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Info label="Работы по кварталу" value={clientQuarterWorkLabel(quarter)} />
        <div className="rounded-2xl bg-eco-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Оплата за квартал</p>
          <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${getPaymentStatusColor(quarter.paymentStatus)}`}>
            {clientPaymentLabel(quarter.remainingAmount, quarter.paymentStatus)}
          </span>
        </div>
        <Info label="Сумма квартала" value={formatCurrency(quarter.plannedAmount)} />
        <Info label="Осталось оплатить" value={formatCurrency(quarter.remainingAmount)} />
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs font-semibold text-slate-500">
          <span>Оплачено</span>
          <span>{paidPercent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-accent" style={{ width: `${paidPercent}%` }} />
        </div>
      </div>
      <Section title="Что загружено по кварталу" items={quarter.documents.map((doc) => doc.name)} />
      <Section title="Результат квартала" items={quarter.results.map((result) => result.title)} />
      <form onSubmit={(event) => onUpload(event, quarter)} className="mt-4 rounded-2xl border border-dashed border-slate-200 p-3">
        <p className="mb-3 text-sm font-semibold text-slate-700">Загрузить данные именно для {quarter.quarterLabel.toLowerCase()}</p>
        <input name="file" type="file" required className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
        <Button type="submit" className="mt-3 w-full">Загрузить документ квартала</Button>
      </form>
    </div>
  );
};

const OnlineOrderPanel = ({ order, onSign, onPay }: { order: Order; onSign: () => void; onPay: () => void }) => {
  const available = order.contractStatus === 'sent' || order.contractStatus === 'signed' || ['invoice_sent', 'awaiting_payment', 'pending', 'partial', 'paid', 'transferred_to_specialist'].includes(order.paymentStatus || '');
  const signed = order.contractStatus === 'signed';
  const paid = order.paymentStatus === 'paid' || order.paymentStatus === 'transferred_to_specialist';
  if (!available) {
    return (
      <div className="rounded-[22px] bg-white p-5 shadow-sm">
        <h3 className="font-bold text-eco-900">Онлайн-оформление</h3>
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <LockKeyhole className="text-slate-500" size={20} />
            <div>
              <p className="font-semibold text-slate-900">Ожидает проверки сотрудником</p>
              <p className="mt-1 text-sm text-slate-600">После проверки здесь появятся договор для подписи и счет на онлайн-оплату.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-[22px] bg-white p-5 shadow-sm">
      <h3 className="font-bold text-eco-900">Онлайн-оформление</h3>
      <div className="mt-4 space-y-3">
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            {signed ? <CheckCircle2 className="text-eco-600" size={20} /> : <FileSignature className="text-eco-700" size={20} />}
            <div>
              <p className="font-semibold text-slate-900">{signed ? 'Договор подписан' : 'Подписать договор'}</p>
              <p className="mt-1 text-sm text-slate-600">{signed ? order.signedAt : order.signatureProvider || 'NCALayer / ЭЦП'}</p>
            </div>
          </div>
          <Button disabled={signed} onClick={onSign} className="mt-4 w-full">{signed ? 'Подписано' : 'Подписать ЭЦП'}</Button>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            {paid ? <CheckCircle2 className="text-eco-600" size={20} /> : <CreditCard className="text-eco-700" size={20} />}
            <div>
              <p className="font-semibold text-slate-900">{paid ? 'Оплата получена' : 'Оплатить онлайн'}</p>
              <p className="mt-1 text-sm text-slate-600">{paid ? order.paidAt : `${order.paymentAmount || '150 000 ₸'} · ${order.paymentMethod || 'Банковская карта'}`}</p>
            </div>
          </div>
          <Button disabled={paid} onClick={onPay} className="mt-4 w-full">{paid ? 'Оплачено' : 'Перейти к оплате'}</Button>
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, items }: { title: string; items: string[] }) => <div className="mt-6"><h3 className="font-bold text-eco-900">{title}</h3><div className="mt-3 space-y-2">{items.length ? items.map((item) => <div key={item} className="rounded-2xl bg-eco-50 p-3 text-sm text-slate-700">{item}</div>) : <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">Пока нет данных</div>}</div></div>;

export const CabinetDocumentsPage = () => {
  const { orders } = useClientOrders();
  const docs = orders.flatMap((order) => [
    ...(order.primaryDocuments || []).map((doc) => ({ id: doc.id, orderId: order.id, name: doc.name, status: primaryDocumentStatusLabels[doc.status], file: doc.fileName || 'Файл не загружен' })),
    ...order.documents.map((doc) => ({ id: doc.id, orderId: order.id, name: doc.name, status: doc.status, file: doc.name })),
    ...order.resultDocuments.map((doc) => ({ id: doc.id, orderId: order.id, name: doc.name, status: doc.status, file: doc.name })),
  ]);
  return (
    <PageList title="Документы">
      {docs.map((doc) => (
        <Link key={doc.id} to={`/cabinet/orders/${doc.orderId}`} className="block rounded-2xl bg-eco-50 p-4 text-sm hover:bg-eco-100">
          <p className="font-bold text-slate-900">{doc.name}</p>
          <p className="mt-1 text-slate-600">{doc.orderId} · {doc.status} · {doc.file}</p>
        </Link>
      ))}
      {!docs.length && <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Документов пока нет</div>}
    </PageList>
  );
};

const CabinetPaymentsPageLegacy = () => {
  const { orders } = useClientOrders();
  const payments: Array<{ id: string; invoice: string; service: string; amount: string; status: string }> = [];
  const onlinePayments = orders.map((order) => ({
    id: order.id,
    invoice: `Онлайн-счет ${order.id}`,
    service: order.service,
    amount: order.paymentStatus === 'not_sent' || !order.paymentStatus ? 'Не выставлен' : order.paymentAmount || 'Не выставлен',
    status: order.paymentStatus === 'paid' || order.paymentStatus === 'transferred_to_specialist' ? 'Оплачено' : ['invoice_sent', 'awaiting_payment', 'pending', 'partial'].includes(order.paymentStatus || '') ? 'Ожидает оплаты' : 'Счет еще не выставлен',
  }));
  return (
    <PageList title="Оплаты">
      {[...onlinePayments, ...payments].map((p) => (
        <div key={p.id} className="rounded-2xl bg-eco-50 p-4 text-sm">{p.invoice} · {p.service} · {p.amount} · {p.status}</div>
      ))}
    </PageList>
  );
};

export const CabinetPaymentsPage = () => {
  const { orders } = useClientOrders();
  const { data: financePayments = [] } = useQuery({ queryKey: ['client-payments'], queryFn: getClientPayments });
  const { data: contracts = [] } = useQuery({ queryKey: ['client-contracts'], queryFn: getFinanceContracts });
  const { data: debts = [] } = useQuery({ queryKey: ['client-debts'], queryFn: getClientDebts });

  const requestIds = new Set(orders.map((order) => order.id));
  const annualContracts = contracts.filter((contract) =>
    requestIds.has(contract.requestId) || orders.some((order) => order.contractId === contract.id)
  );
  const oneTimePayments = financePayments.filter((payment) =>
    requestIds.has(payment.requestId) &&
    !annualContracts.some((contract) => contract.requestId === payment.requestId)
  );
  const clientDebts = debts.filter((debt) => requestIds.has(debt.requestId) && debt.status !== 'closed');

  return (
    <PageList title="Оплаты">
      <div className="rounded-2xl border border-eco-100 bg-eco-50 p-4 text-sm leading-6 text-slate-700">
        <p className="font-bold text-eco-900">Как читать оплаты</p>
        <p className="mt-1">Разовая заявка оплачивается одним счетом. Годовой договор делится на 4 квартальных счета: каждый квартал имеет свою сумму, срок, оплату и остаток.</p>
      </div>

      {oneTimePayments.map((payment) => (
        <div key={payment.id} className="rounded-2xl bg-eco-50 p-4 text-sm">
          <p className="font-bold text-eco-900">Разовая оплата: {payment.invoiceNumber}</p>
          <p className="mt-1 text-slate-600">{payment.serviceName}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <Info label="Сумма" value={formatCurrency(payment.totalAmount)} />
            <Info label="Оплачено" value={formatCurrency(payment.paidAmount)} />
            <Info label="Остаток" value={formatCurrency(payment.remainingAmount)} />
            <Info label="Статус" value={getPaymentStatusLabel(payment.paymentStatus)} />
          </div>
        </div>
      ))}

      {annualContracts.map((contract) => {
        const quarters = contract.quarterlySchedule || [];
        const total = quarters.reduce((sum, quarter) => sum + quarter.plannedAmount, 0);
        const paid = quarters.reduce((sum, quarter) => sum + quarter.paidAmount, 0);
        const remaining = quarters.reduce((sum, quarter) => sum + quarter.remainingAmount, 0);
        return (
          <div key={contract.id} className="rounded-2xl border border-eco-100 bg-white p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-eco-900">Годовой договор: {contract.contractNumber}</p>
                <p className="mt-1 text-slate-600">4 квартальных счета по договору. Оплата каждого квартала считается отдельно.</p>
              </div>
              <span className="rounded-full bg-eco-50 px-3 py-1 text-xs font-bold text-eco-800 ring-1 ring-eco-100">
                Осталось {formatCurrency(remaining)}
              </span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Info label="Сумма договора" value={formatCurrency(total)} />
              <Info label="Оплачено" value={formatCurrency(paid)} />
              <Info label="Остаток" value={formatCurrency(remaining)} />
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {quarters.map((quarter) => (
                <div key={quarter.id} className="rounded-2xl bg-eco-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-eco-900">{quarter.quarterLabel}</p>
                      <p className="mt-1 text-slate-600">{quarter.periodStart} - {quarter.periodEnd}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${getPaymentStatusColor(quarter.paymentStatus)}`}>
                      {clientPaymentLabel(quarter.remainingAmount, quarter.paymentStatus)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Info label="Сумма квартала" value={formatCurrency(quarter.plannedAmount)} />
                    <Info label="Осталось" value={formatCurrency(quarter.remainingAmount)} />
                    <Info label="Оплачено" value={formatCurrency(quarter.paidAmount)} />
                    <Info label="Срок оплаты" value={quarter.dueDate || 'Нет'} />
                  </div>
                </div>
              ))}
              {!quarters.length && <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Квартальные счета пока не сформированы</div>}
            </div>
          </div>
        );
      })}

      {clientDebts.length > 0 && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm">
          <p className="font-bold text-rose-900">Что осталось оплатить</p>
          <p className="mt-1 text-rose-800">Здесь показаны только ваши открытые долги по счетам.</p>
          <div className="mt-3 space-y-2">
            {clientDebts.map((debt) => (
              <div key={debt.id} className="rounded-xl bg-white p-3">
                {debt.contractNumber} {debt.quarterLabel || ''} · {formatCurrency(debt.remainingAmount)} · {debt.dueDate || 'срок не указан'}
              </div>
            ))}
          </div>
        </div>
      )}

      {!oneTimePayments.length && !annualContracts.length && !clientDebts.length && (
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Платежей пока нет</div>
      )}
    </PageList>
  );
};

export const CabinetCompanyPage = () => {
  const { user } = useAuth();
  const contracts = getContractsForClient(user);
  return (
    <Reveal>
      <div className="space-y-6">
        <div className="rounded-[22px] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-eco-900">{user?.type === 'individual' ? 'Профиль' : 'Данные компании'}</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">{Object.entries(user ?? {}).filter(([k]) => !['role', 'type', 'id'].includes(k)).map(([k, v]) => <Info key={k} label={k} value={String(v)} />)}</div>
        </div>
        <div className="rounded-[22px] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-eco-900">Договоры с ECOPROGRESS GROUP</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {contracts.map((contract) => <ClientContractCard key={contract.id} contract={contract} />)}
            {!contracts.length && <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Договоров пока нет</div>}
          </div>
        </div>
      </div>
    </Reveal>
  );
};

export const CabinetNotificationsPage = () => <PageList title="Уведомления">{['Заявка создана', 'Статус обновлен', 'Документ готов'].map((n) => <div key={n} className="rounded-2xl bg-eco-50 p-4 text-sm">{n}</div>)}</PageList>;
