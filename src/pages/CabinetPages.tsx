import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, CreditCard, Download, FileSignature, FileText, LockKeyhole, RefreshCw, Send, Upload } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  AgreementResponseModal,
  ConfirmModal,
  PaymentModal,
  UploadDocumentModal,
  type AgreementResponseValues,
  type PaymentModalValues,
  type UploadDocumentValues,
} from '../components/modals';
import { useAuth } from '../contexts/AuthContext';
import { getClientOrders, getOrderById as fetchOrderById, createOrder, addComment, uploadDocument, signOrderContract, payOrderOnline, uploadQuarterDocument, respondLaboratoryMeasurementAgreement, sendPrimaryDocumentForReview, uploadLaboratoryPrimaryDocument, uploadPrimaryDocument, getNotifications } from '../services/orderService';
import { requestCompanyProfileChange } from '../services/crmWorkflowService';
import { getClientPayments, getClientDebts, getClientContracts } from '../services/paymentService';
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
import { useToast } from '../hooks/useToast';
import type { ClientPrimaryDocumentStatus, Contract, Debt, DocumentItem, LaboratoryPrimaryDocument, Order, OrderPrimaryDocument, Payment, RequestQuarter } from '../types';

type ClientSimpleStatus = 'Новая заявка' | 'На консультации' | 'Ожидаем документы' | 'Документы на проверке' | 'Договор и счет' | 'Ожидаем оплату' | 'Оплачено' | 'В работе' | 'На согласовании' | 'Завершено' | 'Отменено';
type ClientOrderTab = 'Обзор' | 'Договор и счет' | 'Первичные документы' | 'Документы' | 'Согласование' | 'Результат';
type ClientAgreementResponse = {
  id: string;
  requestId: string;
  sourceDocumentId: string;
  sourceDocumentTitle: string;
  fileName?: string;
  comment?: string;
  action: 'accepted' | 'signed' | 'sent_without_signature' | 'revision_requested';
  signed: boolean;
  signedAt?: string;
  sentAt: string;
};

const clientSimpleSteps: ClientSimpleStatus[] = ['Новая заявка', 'На консультации', 'Ожидаем документы', 'Договор и счет', 'Ожидаем оплату', 'В работе', 'На согласовании', 'Завершено'];

const clientSimpleStatus = (order: Order): ClientSimpleStatus => {
  if (order.status === 'Отменено') return 'Отменено';
  if (['Готово', 'Завершено'].includes(order.status)) return 'Завершено';
  if (['Проверка результата'].includes(order.status)) return 'На согласовании';
  if (isWorkOrderStatus(order.status) || ['annual_active'].includes(order.status)) return 'В работе';
  if (['Полностью оплачено', 'Передано специалисту'].includes(order.status)) return 'Оплачено';
  if (['Передано бухгалтеру', 'Ожидает счет', 'Счет отправлен', 'Ожидаем оплату', 'Частично оплачено', 'Счет на оплату'].includes(order.status)) return 'Ожидаем оплату';
  if (['КП', 'Договор', 'Подготовка КП', 'КП отправлено', 'КП согласовано', 'Подготовка договора', 'Договор отправлен', 'Ожидаем подпись договора', 'Договор подписан'].includes(order.status)) return 'Договор и счет';
  if (order.primaryDocuments?.some((doc) => doc.status === 'uploaded' || doc.status === 'under_review') || order.status === 'Документы на проверке') return 'Документы на проверке';
  if (order.primaryDocuments?.some((doc) => ['need_upload', 'needs_fix'].includes(doc.status)) || order.status === 'Ожидаем первичные документы') return 'Ожидаем документы';
  if (['Консультация', 'Анализ', 'Анализ заявки'].includes(order.status)) return 'На консультации';
  if (['Новая заявка', 'Связаться с клиентом'].includes(order.status)) return 'Новая заявка';
  return 'Новая заявка';
};

const badge = (status: ClientSimpleStatus) => {
  const tone =
    status === 'Завершено' ? 'bg-emerald-50 text-emerald-800' :
    status === 'Оплачено' ? 'bg-emerald-50 text-emerald-800' :
    status === 'Отменено' ? 'bg-rose-50 text-rose-800' :
    status === 'Ожидаем документы' ? 'bg-amber-50 text-amber-800' :
    status === 'Документы на проверке' ? 'bg-blue-50 text-blue-800' :
    status === 'Договор и счет' ? 'bg-indigo-50 text-indigo-800' :
    status === 'Ожидаем оплату' ? 'bg-orange-50 text-orange-800' :
    status === 'В работе' ? 'bg-eco-50 text-eco-800' :
    status === 'На согласовании' ? 'bg-purple-50 text-purple-800' :
    status === 'На консультации' ? 'bg-sky-50 text-sky-800' :
    'bg-sky-50 text-sky-800';
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{status}</span>;
};

const clientStatusText = (order: Order) => {
  const status = clientSimpleStatus(order);
  if (status === 'Новая заявка') return 'Мы получили заявку. Менеджер свяжется с вами для уточнения деталей.';
  if (status === 'На консультации') return 'Менеджер уточняет детали и подготавливает предложение.';
  if (status === 'Ожидаем документы') return 'Загрузите первичные документы внутри заявки, чтобы мы могли начать подготовку.';
  if (status === 'Документы на проверке') return 'Менеджер проверяет загруженные документы.';
  if (status === 'Договор и счет') return 'Готовятся договор и коммерческие документы.';
  if (status === 'Ожидаем оплату') return 'Счет отправлен. Оплатите услугу для начала работы.';
  if (status === 'Оплачено') return 'Оплата подтверждена. Заявка передается специалисту.';
  if (status === 'В работе') return 'Специалист выполняет работу по вашей заявке.';
  if (status === 'На согласовании') return 'Проверьте и подпишите документ от специалиста.';
  if (status === 'Завершено') return 'Работа завершена. Готовые документы доступны в заявке.';
  return 'Заявка отменена. При необходимости создайте новую заявку.';
};

const clientNextStep = (order: Order) => {
  const status = clientSimpleStatus(order);
  if (status === 'Ожидаем документы') return 'Загрузите первичные документы для начала работы.';
  if (status === 'Новая заявка') return 'Менеджер скоро свяжется с вами.';
  if (status === 'На консультации') return 'Ожидайте — менеджер подготовит предложение.';
  if (status === 'Документы на проверке') return 'Ожидайте проверки документов менеджером.';
  if (status === 'Договор и счет') return 'Проверьте договор и коммерческие условия.';
  if (status === 'Ожидаем оплату') return 'Оплатите счет для начала работы.';
  if (status === 'Оплачено') return 'Заявка передается специалисту.';
  if (status === 'В работе') return 'Ожидайте готовые документы от специалиста.';
  if (status === 'На согласовании') return 'Проверьте и подпишите документ.';
  if (status === 'Завершено') return 'Скачайте готовые документы в разделе “Результат”.';
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
    ['Договор и счет', orders.filter((o) => clientSimpleStatus(o) === 'Договор и счет').length],
    ['Договоров', contracts.length],
  ];
  return (
    <div>
      <Reveal>
        <div className="rounded-[24px] bg-eco-900 p-5 text-white shadow-xl shadow-eco-900/10 sm:p-7">
          <p className="text-sm text-white/65">Добро пожаловать</p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">{user?.name ?? 'Клиент ecoprogress.kz'}</h2>
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
  const toast = useToast();
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
  const [submitting, setSubmitting] = useState(false);
  const selectedOrderService = services.find((service) => service.id === selectedOrderServiceId) ?? services[0];
  const selectedBusinessCompany = getBusinessCompanyById(selectedOrderService?.businessCompanyId);
  const selectedWorkStage = getWorkStageLabel({
    service: `${selectedOrderService?.title ?? ''} ${selectedOrderItems.join(' ')}`,
    serviceId: selectedOrderService?.id,
    businessCompanyId: selectedOrderService?.businessCompanyId,
  });
  useEffect(() => {
    setSelectedOrderServiceId(serviceFromUrl);
    const service = services.find((item) => item.id === serviceFromUrl) ?? services[0];
    if (service) {
      setSelectedOrderItems(itemsFromUrl.map((index) => service.includes[index]).filter(Boolean));
    }
  }, [serviceFromUrl, itemsFromUrl]);
  const toggleOrderItem = (item: string) => {
    setSelectedOrderItems((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]));
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    try {
      setSubmitting(true);
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
      toast.success('Заявка создана', 'Менеджер получил вашу заявку и свяжется с вами.');
      navigate(`/cabinet/orders/${order.id}`);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as Error)?.message || 'Проверьте данные и попробуйте снова.';
      toast.error('Не удалось создать заявку', message);
    } finally {
      setSubmitting(false);
    }
  };
  if (!selectedOrderService) {
    return <div className="flex min-h-[400px] items-center justify-center"><LoadingSpinner /></div>;
  }
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
          <Input name="whatsapp" label="WhatsApp" icon={<FaWhatsapp size={18} aria-hidden="true" />} />
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
          <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
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
        <Button className="mt-6" disabled={submitting}>{submitting ? 'Отправляем...' : 'Отправить заявку на проверку'}</Button>
      </form>
    </Reveal>
  );
};

const Input = ({ name, label, type = 'text', defaultValue = '', required = false, icon }: { name: string; label: string; type?: string; defaultValue?: string; required?: boolean; icon?: ReactNode }) => (
  <label className="text-sm font-semibold text-slate-700">
    <span className="inline-flex items-center gap-1.5">{icon}{label}</span>
    <input name={name} type={type} required={required} defaultValue={defaultValue} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
  </label>
);

const StepTitle = ({ number, title }: { number: string; title: string }) => (
  <div className="mt-7 mb-4 flex items-center gap-3">
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-eco-900 text-sm font-bold text-white">{number}</span>
    <h3 className="text-lg font-bold text-eco-900">{title}</h3>
  </div>
);

export const CabinetOrderDetailsPage = ({ onNotify }: { onNotify?: (message: string) => void }) => {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [order, setOrder] = useState<Order | undefined>();
  const [activeTab, setActiveTab] = useState<ClientOrderTab>('Обзор');
  const load = () => id && fetchOrderById(id).then(setOrder);
  useEffect(() => { load(); }, [id]);
  if (!id) return <Navigate to="/cabinet/orders" replace />;
  if (!order) return <div className="flex min-h-[40vh] items-center justify-center"><LoadingSpinner /></div>;
  const serviceContract = getPrimaryContractForOrder(order);
  const errorMessage = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as Error)?.message || fallback;
  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get('comment') || '').trim();
    if (!text) {
      toast.error('Введите текст сообщения');
      return;
    }
    try {
      await addComment(order.id, text, 'client');
      toast.success('Сообщение отправлено', 'Сотрудник увидит ваше сообщение в заявке.');
      event.currentTarget.reset();
      load();
      queryClient.invalidateQueries({ queryKey: ['client-orders'] });
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось отправить сообщение.'));
    }
  };
  const submitClientDocument = async (values: UploadDocumentValues) => {
    if (!values.file?.name) {
      toast.error('Документ не загружен', 'Выберите файл и попробуйте снова.');
      return;
    }
    try {
      await uploadDocument(order.id, values.file, values.category || 'client');
      if (values.comment) await addComment(order.id, values.comment, 'client');
      toast.success('Документ загружен', 'Документ добавлен к заявке.');
      load();
      queryClient.invalidateQueries({ queryKey: ['client-orders'] });
    } catch (err) {
      toast.error('Документ не загружен', errorMessage(err, 'Выберите файл и попробуйте снова.'));
    }
  };
  const submitQuarterFile = async (quarter: RequestQuarter, values: UploadDocumentValues) => {
    if (!values.file) {
      toast.error('Документ не загружен', 'Выберите файл и попробуйте снова.');
      return;
    }
    try {
      await uploadQuarterDocument(order.id, quarter.id, values.file, values.category || 'client_data');
      toast.success('Документ загружен', 'Документ добавлен к кварталу.');
      load();
      queryClient.invalidateQueries({ queryKey: ['client-orders'] });
    } catch (err) {
      toast.error('Документ не загружен', errorMessage(err, 'Не удалось загрузить документ квартала.'));
    }
  };
  const submitPrimaryFile = async (document: OrderPrimaryDocument, values: UploadDocumentValues) => {
    if (!values.file?.name) {
      toast.error('Документ не загружен', 'Выберите файл и попробуйте снова.');
      return;
    }
    try {
      await uploadPrimaryDocument(order.id, document.id, values.file, values.comment);
      toast.success('Документ загружен', 'Документ добавлен к заявке.');
      load();
    } catch (err) {
      toast.error('Документ не загружен', errorMessage(err, 'Не удалось загрузить документ.'));
    }
  };
  const sendPrimaryDoc = async (document: OrderPrimaryDocument, comment = '') => {
    if (!document.fileName) {
      toast.error('Документ не загружен', 'Сначала загрузите файл.');
      return;
    }
    try {
      await sendPrimaryDocumentForReview(order.id, document.id, comment);
      toast.success('Документ отправлен на проверку', 'Менеджер проверит файл и оставит комментарий.');
      load();
    } catch (err) {
      toast.error('Нельзя отправить документ', errorMessage(err, 'Сначала загрузите файл.'));
    }
  };
  const sendAgreementResponse = async (sourceDocument: AgreementSourceDocument, values: AgreementResponseValues) => {
    const { file, action } = values;
    const signed = action === 'signed';
    const accepted = action === 'accepted';
    const commentText = values.comment;
    const label = action === 'revision_requested'
      ? `Документ "${sourceDocument.title}" отправлен на исправление`
      : accepted
      ? `Документ "${sourceDocument.title}" принят`
      : signed
      ? `Документ "${sourceDocument.title}" подписан`
      : `Документ "${sourceDocument.title}" отправлен без подписи`;
    try {
      await addComment(order.id, `${label}${commentText ? `: ${commentText}` : ''}`, 'client');
      if (file?.name) await uploadDocument(order.id, file, 'client');
      if (action === 'revision_requested') toast.success('Запрос отправлен', 'Специалист увидит ваш комментарий по результату.');
      else if (accepted) toast.success('Документ принят', 'Менеджер увидит ваш ответ.');
      else if (signed) toast.success('КП согласовано', 'Менеджер начнет подготовку договора.');
      else toast.success('Документ отправлен', 'Менеджер увидит ваш ответ.');
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось отправить ответ по документу.'));
    }
  };
  const submitLaboratoryPrimaryFile = async (event: FormEvent<HTMLFormElement>, document: LaboratoryPrimaryDocument) => {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get('file') as File | null;
    if (!file?.name) {
      toast.error('Документ не загружен', 'Выберите файл и попробуйте снова.');
      return;
    }
    try {
      await uploadLaboratoryPrimaryDocument(order.id, document.id, file.name);
      toast.success('Документ загружен', 'Документ добавлен к заявке.');
      event.currentTarget.reset();
      load();
    } catch (err) {
      toast.error('Документ не загружен', errorMessage(err, 'Не удалось загрузить документ.'));
    }
  };
  const acceptMeasurement = async () => {
    try {
      await respondLaboratoryMeasurementAgreement(order.id, { action: 'accept' });
      toast.success('Дата замера подтверждена', 'Лаборатория увидит ваше подтверждение.');
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось подтвердить дату замера.'));
    }
  };
  const requestMeasurementReschedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await respondLaboratoryMeasurementAgreement(order.id, {
        action: 'reschedule',
        rescheduleDate: String(form.get('rescheduleDate') || ''),
        rescheduleTime: String(form.get('rescheduleTime') || ''),
        comment: String(form.get('comment') || ''),
      });
      toast.success('Дата замера изменена', 'Лаборатория увидит предложенное время.');
      event.currentTarget.reset();
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось отправить перенос замера.'));
    }
  };
  const handleSign = async () => {
    try {
      await signOrderContract(order.id, order.signatureProvider || 'NCALayer / ЭЦП');
      toast.success('Договор подписан', 'Менеджер получил подписанный договор.');
      load();
      queryClient.invalidateQueries({ queryKey: ['client-orders'] });
    } catch (err) {
      toast.error('Не удалось подписать договор', errorMessage(err, 'Попробуйте снова или загрузите подписанный файл.'));
    }
  };
  const handlePay = async () => {
    try {
      await payOrderOnline(order.id, order.paymentMethod || 'Банковская карта');
      toast.success('Оплата подтверждена', 'Статус оплаты обновлен.');
      load();
      queryClient.invalidateQueries({ queryKey: ['client-orders'] });
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось выполнить оплату.'));
    }
  };
  const submitReceipt = async (values: PaymentModalValues) => {
    if (!values.file) {
      toast.error('Чек не загружен', 'Выберите файл чека.');
      return;
    }
    try {
      await uploadDocument(order.id, values.file, 'client');
      if (values.comment) await addComment(order.id, `Чек оплаты: ${values.comment}`, 'client');
      toast.success('Чек оплаты загружен', 'Бухгалтер проверит оплату.');
      load();
      queryClient.invalidateQueries({ queryKey: ['client-orders'] });
    } catch (err) {
      toast.error('Чек не загружен', errorMessage(err, 'Выберите файл чека.'));
    }
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
            {(['Обзор', 'Договор и счет', 'Первичные документы', 'Документы', 'Согласование', 'Результат'] as const).map((tab) => (
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

      {activeTab === 'Договор и счет' && (
        <ClientContractInvoicePanel order={order} onSign={handleSign} onPay={handlePay} onUploadReceipt={submitReceipt} serviceContract={serviceContract} />
      )}

      {activeTab === 'Первичные документы' && (
          <ClientPrimaryDocumentsPanel
            order={order}
            onUpload={submitPrimaryFile}
            onSend={sendPrimaryDoc}
        />
      )}

      {activeTab === 'Документы' && (
        <ClientDocumentsPanel order={order} onUpload={submitClientDocument} />
      )}

      {activeTab === 'Согласование' && (
          <ClientAgreementPanel
          order={order}
          onSend={sendAgreementResponse}
        />
      )}

      {activeTab === 'Результат' && <ClientResultPanel order={order} />}
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => <div className="rounded-2xl bg-eco-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-2 text-sm text-slate-800">{value || 'Не указано'}</p></div>;

const ClientDocumentsPanel = ({
  order,
  onUpload,
}: {
  order: Order;
  onUpload: (values: UploadDocumentValues) => void | Promise<void>;
}) => {
  const [uploadOpen, setUploadOpen] = useState(false);
  const documents = order.documents || [];
  return (
    <Reveal>
      <div className="rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-eco-900">Документы заявки</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Здесь хранятся обычные файлы по заявке.</p>
          </div>
          <Button type="button" onClick={() => setUploadOpen(true)}>
            <Upload size={16} className="mr-2" /> Загрузить документ
          </Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {documents.map((doc) => (
            <ClientDocumentCard key={doc.id} doc={doc} />
          ))}
          {!documents.length && (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 md:col-span-2">
              Документы пока не загружены.
            </div>
          )}
        </div>
        <UploadDocumentModal
          isOpen={uploadOpen}
          title="Загрузить документ"
          defaultCategory="client"
          categories={['client', 'other']}
          onClose={() => setUploadOpen(false)}
          onSubmit={onUpload}
        />
      </div>
    </Reveal>
  );
};

const ClientDocumentCard = ({ doc }: { doc: DocumentItem }) => {
  const href = doc.fileUrl || `/api/files/documents/${doc.id}`;
  return (
    <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <FileText size={20} className="shrink-0 text-eco-700" />
        <div className="min-w-0">
          <p className="break-words font-bold text-slate-900">{doc.name}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{doc.status} · {doc.uploadedAt}</p>
        </div>
      </div>
      <a href={href} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-eco-900 px-4 py-2 text-xs font-bold text-white">
        <FileText size={14} /> Открыть
      </a>
    </div>
  );
};

type AgreementSourceDocument = {
  id: string;
  title: string;
  fileName: string;
  comment?: string;
  status: string;
  uploadedBy: string;
  uploadedAt: string;
  section: string;
  needsSignature?: boolean;
  needsClientResponse?: boolean;
};

const getAgreementSourceDocuments = (order: Order): AgreementSourceDocument[] => {
  const resultDocs = order.resultDocuments
    .filter((doc) => doc.sentToClient || doc.needsSignature || doc.needsClientResponse || ['sent_to_client', 'published_to_client'].includes(doc.status))
    .map((doc) => ({
    id: `result-${doc.id}`,
    title: doc.name,
    fileName: doc.fileUrl || doc.name,
    comment: doc.staffComment || '',
    status: doc.status,
    uploadedBy: 'Сотрудник ecoprogress.kz',
    uploadedAt: doc.uploadedAt,
    section: 'Документ от сотрудника',
    needsSignature: doc.needsSignature,
    needsClientResponse: doc.needsClientResponse,
  }));
  const laboratoryDocs = (order.laboratoryResultDocuments || []).map((doc) => ({
    id: `laboratory-${doc.id}`,
    title: doc.name,
    fileName: doc.fileName || doc.name,
    comment: doc.comment || '',
    status: doc.status,
    uploadedBy: doc.uploadedBy || 'Лаборатория ecoprogress.kz',
    uploadedAt: doc.uploadedAt || doc.readyAt || 'Дата не указана',
    section: 'Лабораторный документ',
    needsSignature: false,
    needsClientResponse: true,
  }));
  return [...laboratoryDocs, ...resultDocs];
};

const ClientAgreementPanel = ({
  order,
  onSend,
}: {
  order: Order;
  onSend: (sourceDocument: AgreementSourceDocument, values: AgreementResponseValues) => void | Promise<void>;
}) => {
  const sourceDocuments = getAgreementSourceDocuments(order);
  const [selectedDocument, setSelectedDocument] = useState<AgreementSourceDocument | null>(null);

  return (
    <Reveal>
      <div className="rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-eco-900">Согласование</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Ознакомьтесь с документом от сотрудника, при необходимости загрузите ответный файл и отправьте его с подписью или без подписи.
            </p>
          </div>
          <span className="rounded-full bg-eco-50 px-4 py-2 text-sm font-bold text-eco-800">Документов: {sourceDocuments.length}</span>
        </div>

        <div className="mt-5 space-y-4">
          {sourceDocuments.map((doc) => (
              <div key={doc.id} className="rounded-[20px] border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{doc.title}</p>
                    <p className="mt-1 break-words text-sm text-slate-600">{doc.fileName}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">{doc.section} · {doc.uploadedBy} · {doc.uploadedAt}</p>
                    {(doc.needsSignature || doc.needsClientResponse) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {doc.needsSignature && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-800 ring-1 ring-indigo-100">Нужна подпись</span>}
                        {doc.needsClientResponse && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800 ring-1 ring-eco-100">Нужен ответ</span>}
                      </div>
                    )}
                    {doc.comment && <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">{doc.comment}</p>}
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800 ring-1 ring-eco-100">{doc.status}</span>
                </div>

                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-4">
                  <Button type="button" onClick={() => setSelectedDocument(doc)}>
                    <FileSignature size={16} />
                    Открыть согласование
                  </Button>
                </div>
              </div>
          ))}
          {!sourceDocuments.length && (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
              Документов на согласование пока нет. Когда сотрудник отправит документ, он появится здесь.
            </div>
          )}
        </div>
        <AgreementResponseModal
          isOpen={Boolean(selectedDocument)}
          documentName={selectedDocument?.title || ''}
          onClose={() => setSelectedDocument(null)}
          onSubmit={(values) => selectedDocument ? onSend(selectedDocument, values) : undefined}
        />
      </div>
    </Reveal>
  );
};

const primaryDocumentStatusLabels: Record<ClientPrimaryDocumentStatus, string> = {
  need_upload: 'Не загружен',
  uploaded: 'Загружен',
  sent: 'Отправлено',
  in_review: 'На проверке',
  under_review: 'На проверке',
  accepted: 'Принят',
  approved: 'Принят',
  needs_fix: 'На исправлении',
  rejected: 'Отклонён',
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
}: {
  order: Order;
  onUpload: (document: OrderPrimaryDocument, values: UploadDocumentValues) => void | Promise<void>;
  onSend: (document: OrderPrimaryDocument, comment?: string) => void | Promise<void>;
}) => {
  const documents = order.primaryDocuments || [];
  const requiredLeft = documents.filter((doc) => doc.required && doc.status !== 'accepted').length;
  const [uploadDoc, setUploadDoc] = useState<OrderPrimaryDocument | null>(null);
  const [sendDoc, setSendDoc] = useState<OrderPrimaryDocument | null>(null);

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

        <div className="mt-4 space-y-3">
          {documents.map((doc) => (
            <div key={doc.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 sm:px-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="min-w-0">
                  <p className="break-words font-bold text-slate-900">{doc.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{doc.required ? 'Обязательный документ' : 'Необязательный документ'}</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <div className="min-w-0 rounded-xl bg-white px-3 py-2">
                      <p className="text-[11px] font-bold uppercase text-slate-400">Файл</p>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-700">{doc.fileName || 'Не загружен'}</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <p className="text-[11px] font-bold uppercase text-slate-400">Дата загрузки</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{doc.uploadedAt || 'Нет'}</p>
                    </div>
                    <div className="min-w-0 rounded-xl bg-white px-3 py-2">
                      <p className="text-[11px] font-bold uppercase text-slate-400">Комментарий менеджера</p>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-700">{doc.managerComment || 'Нет'}</p>
                    </div>
                  </div>
                  {doc.clientComment && <p className="mt-2 break-words rounded-xl bg-white px-3 py-2 text-sm text-slate-600">Ваш комментарий: {doc.clientComment}</p>}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 lg:min-w-[250px] lg:flex-col lg:items-end">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${primaryDocumentStatusClass(doc.status)}`}>{primaryDocumentStatusLabels[doc.status]}</span>
                  {doc.status !== 'accepted' && (
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" className="px-4 py-2 text-xs" onClick={() => setUploadDoc(doc)}>
                        {doc.fileName ? 'Заменить' : 'Загрузить'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!doc.fileName || ['accepted', 'approved', 'in_review', 'under_review'].includes(doc.status)}
                        onClick={() => setSendDoc(doc)}
                      >
                        Отправить
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!documents.length && (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
              Менеджер пока не запросил документы. Когда список появится, вы сможете загрузить файлы здесь.
            </div>
          )}
        </div>

        <UploadDocumentModal
          isOpen={Boolean(uploadDoc)}
          title={uploadDoc?.fileName ? 'Заменить первичный документ' : 'Загрузить первичный документ'}
          defaultName={uploadDoc?.name || ''}
          defaultCategory="client"
          categories={['client']}
          onClose={() => setUploadDoc(null)}
          onSubmit={(values) => uploadDoc ? onUpload(uploadDoc, values) : undefined}
        />
        <ConfirmModal
          isOpen={Boolean(sendDoc)}
          title="Отправить документ на проверку?"
          description={sendDoc?.name}
          confirmText="Отправить"
          variant="success"
          onClose={() => setSendDoc(null)}
          onConfirm={async () => {
            if (sendDoc) await onSend(sendDoc, '');
            setSendDoc(null);
          }}
        />
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
  onUploadReceipt: (values: PaymentModalValues) => void | Promise<void>;
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
            <DocumentDownloadCard title="Договор" doc={contractDoc} fallbackLabel={serviceContract?.number || 'Договор пока не загружен'} ready={Boolean(contractDoc || serviceContract)} />
            <DocumentDownloadCard title="Счет" doc={invoiceDoc} fallbackLabel={order.invoiceNumber || 'Счет пока не выставлен'} ready={Boolean(invoiceDoc || order.invoiceNumber)} />
          </div>
          <div className="mt-5 rounded-2xl bg-eco-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Статус оплаты</p>
            <p className="mt-2 text-lg font-bold text-eco-900">{paymentText}</p>
          </div>
        </div>
        <div className="space-y-5">
          <OnlineOrderPanel order={order} onSign={onSign} onPay={onPay} />
          <ReceiptUploadCard order={order} onUploadReceipt={onUploadReceipt} />
        </div>
      </div>
    </Reveal>
  );
};

const ReceiptUploadCard = ({ order, onUploadReceipt }: { order: Order; onUploadReceipt: (values: PaymentModalValues) => void | Promise<void> }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[22px] bg-white p-5 shadow-sm">
      <h3 className="font-bold text-eco-900">Чек оплаты</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">Загрузите чек или платежное поручение через отдельное окно.</p>
      <Button type="button" className="mt-4 w-full" onClick={() => setOpen(true)}>Загрузить чек</Button>
      <PaymentModal
        isOpen={open}
        mode="client_receipt"
        totalAmount={order.totalAmount || order.contractAmount || 0}
        paidAmount={order.paidAmount || 0}
        remainingAmount={order.remainingAmount || 0}
        onClose={() => setOpen(false)}
        onSubmit={onUploadReceipt}
      />
    </div>
  );
};

const DocumentDownloadCard = ({ title, doc, fallbackLabel, ready }: { title: string; doc?: DocumentItem; fallbackLabel: string; ready: boolean }) => {
  const displayName = doc?.name || fallbackLabel;
  const downloadUrl = doc?.fileUrl || (doc?.id ? `/api/files/documents/${doc.id}` : undefined);
  return (
    <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <FileText className={ready ? 'text-eco-700' : 'text-slate-400'} size={20} />
        <div className="min-w-0">
          <p className="font-bold text-slate-900">{title}</p>
          <p className="mt-1 break-words text-sm text-slate-600">{displayName}</p>
        </div>
      </div>
      {downloadUrl ? (
        <a href={downloadUrl} download={displayName} className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold ${ready ? 'bg-eco-900 text-white' : 'pointer-events-none bg-slate-200 text-slate-500'}`}>
          <Download size={14} /> Скачать
        </a>
      ) : (
        <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-200 px-4 py-2 text-xs font-bold text-slate-500">
          <Download size={14} /> Скачать
        </span>
      )}
    </div>
  );
};

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
                <a href={doc.fileUrl || `/api/files/documents/${doc.id}`} download={doc.name} className="mt-3 inline-flex items-center gap-2 rounded-full bg-eco-900 px-4 py-2 text-xs font-bold text-white"><Download size={14} /> Скачать</a>
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

const ClientAnnualRequestPanel = ({ order, onUpload }: { order: Order; onUpload: (quarter: RequestQuarter, values: UploadDocumentValues) => void | Promise<void> }) => {
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

const ClientQuarterCard = ({ quarter, isCurrent, onUpload }: { quarter: RequestQuarter; isCurrent: boolean; onUpload: (quarter: RequestQuarter, values: UploadDocumentValues) => void | Promise<void> }) => {
  const paidPercent = quarter.plannedAmount > 0 ? Math.min(100, Math.round((quarter.paidAmount / quarter.plannedAmount) * 100)) : 0;
  const [uploadOpen, setUploadOpen] = useState(false);
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
      <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-3">
        <p className="mb-3 text-sm font-semibold text-slate-700">Загрузить данные именно для {quarter.quarterLabel.toLowerCase()}</p>
        <Button type="button" className="w-full" onClick={() => setUploadOpen(true)}>Загрузить документ квартала</Button>
      </div>
      <UploadDocumentModal
        isOpen={uploadOpen}
        title={`Документ: ${quarter.quarterLabel}`}
        defaultCategory="client_data"
        categories={['client_data', 'invoice', 'act', 'protocol', 'report', 'result', 'other']}
        onClose={() => setUploadOpen(false)}
        onSubmit={(values) => onUpload(quarter, values)}
      />
    </div>
  );
};

const OnlineOrderPanel = ({ order, onSign, onPay }: { order: Order; onSign: () => void; onPay: () => void }) => {
  const available = order.contractStatus === 'sent' || order.contractStatus === 'signed' || ['invoice_sent', 'awaiting_payment', 'pending', 'partial', 'paid', 'transferred_to_specialist'].includes(order.paymentStatus || '');
  const signed = order.contractStatus === 'signed';
  const paid = order.paymentStatus === 'paid' || order.paymentStatus === 'transferred_to_specialist';
  const [confirm, setConfirm] = useState<'sign' | 'pay' | null>(null);
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
          <Button disabled={signed} onClick={() => setConfirm('sign')} className="mt-4 w-full">{signed ? 'Подписано' : 'Подписать ЭЦП'}</Button>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            {paid ? <CheckCircle2 className="text-eco-600" size={20} /> : <CreditCard className="text-eco-700" size={20} />}
            <div>
              <p className="font-semibold text-slate-900">{paid ? 'Оплата получена' : 'Оплатить онлайн'}</p>
              <p className="mt-1 text-sm text-slate-600">{paid ? order.paidAt : `${order.paymentAmount || '150 000 ₸'} · ${order.paymentMethod || 'Банковская карта'}`}</p>
            </div>
          </div>
          <Button disabled={paid} onClick={() => setConfirm('pay')} className="mt-4 w-full">{paid ? 'Оплачено' : 'Перейти к оплате'}</Button>
        </div>
      </div>
      <ConfirmModal
        isOpen={confirm === 'sign'}
        title="Подписать договор?"
        description="После подтверждения договор будет отмечен как подписанный электронной подписью."
        confirmText="Подписать"
        variant="success"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await onSign();
          setConfirm(null);
        }}
      />
      <ConfirmModal
        isOpen={confirm === 'pay'}
        title="Перейти к оплате?"
        description="Система отправит запрос на онлайн-оплату по текущему счету."
        confirmText="Оплатить"
        variant="success"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await onPay();
          setConfirm(null);
        }}
      />
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
  const { data: contracts = [] } = useQuery({ queryKey: ['client-contracts'], queryFn: getClientContracts });
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
  const toast = useToast();
  const contracts = getContractsForClient(user);
  const submitChangeRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await requestCompanyProfileChange({
        companyName: String(form.get('companyName') || user?.companyName || ''),
        bin: String(form.get('bin') || user?.bin || ''),
        legalAddress: String(form.get('legalAddress') || user?.legalAddress || ''),
        contactPerson: String(form.get('contactPerson') || user?.name || ''),
        phone: String(form.get('phone') || user?.phone || ''),
        email: String(form.get('email') || user?.email || ''),
        whatsapp: String(form.get('whatsapp') || ''),
        comment: String(form.get('comment') || ''),
      });
      toast.success('Запрос отправлен', 'Менеджер проверит и подтвердит изменение данных.');
      event.currentTarget.reset();
    } catch (err) {
      toast.error('Запрос не отправлен', (err as Error)?.message || 'Попробуйте позже.');
    }
  };
  return (
    <Reveal>
      <div className="space-y-6">
        <div className="rounded-[22px] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-eco-900">{user?.type === 'individual' ? 'Профиль' : 'Данные компании'}</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">{Object.entries(user ?? {}).filter(([k]) => !['role', 'type', 'id'].includes(k)).map(([k, v]) => <Info key={k} label={k} value={String(v)} />)}</div>
        </div>
        <div className="rounded-[22px] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-eco-900">Запросить изменение данных</h2>
          <form onSubmit={submitChangeRequest} className="mt-5 grid gap-4 md:grid-cols-2">
            <InfoInput name="companyName" label="Название компании" defaultValue={user?.companyName || ''} />
            <InfoInput name="bin" label="БИН / ИИН" defaultValue={user?.bin || ''} />
            <InfoInput name="legalAddress" label="Юридический адрес" defaultValue={user?.legalAddress || ''} />
            <InfoInput name="contactPerson" label="Контактное лицо" defaultValue={user?.name || ''} />
            <InfoInput name="phone" label="Телефон" defaultValue={user?.phone || ''} />
            <InfoInput name="email" label="Email" defaultValue={user?.email || ''} />
            <InfoInput name="whatsapp" label="WhatsApp" />
            <label className="text-sm font-semibold text-slate-700 md:col-span-2">Комментарий<textarea name="comment" rows={3} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
            <Button>Отправить менеджеру</Button>
          </form>
        </div>
        <div className="rounded-[22px] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-eco-900">Договоры с ecoprogress.kz</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {contracts.map((contract) => <ClientContractCard key={contract.id} contract={contract} />)}
            {!contracts.length && <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Договоров пока нет</div>}
          </div>
        </div>
      </div>
    </Reveal>
  );
};

export const CabinetNotificationsPage = () => {
  const { data: notifications = [], isLoading } = useQuery({ queryKey: ['notifications'], queryFn: getNotifications });
  return (
    <PageList title="Уведомления">
      {isLoading && <LoadingSpinner />}
      {!isLoading && !notifications.length && <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Уведомлений пока нет</div>}
      {notifications.map((n) => (
        <div key={n.id} className="rounded-2xl bg-eco-50 p-4">
          <p className="font-semibold text-eco-900">{n.title}</p>
          <p className="mt-1 text-sm text-slate-600">{n.description}</p>
          <p className="mt-2 text-xs text-slate-400">{n.date}</p>
        </div>
      ))}
    </PageList>
  );
};

const InfoInput = ({ name, label, defaultValue = '' }: { name: string; label: string; defaultValue?: string }) => (
  <label className="text-sm font-semibold text-slate-700">
    {label}
    <input name={name} defaultValue={defaultValue} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
  </label>
);
