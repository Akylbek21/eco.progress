import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, CreditCard, FileSignature, LockKeyhole } from 'lucide-react';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import { getBusinessCompanyById, services, type Contract, type Debt, type Order, type Payment, type QuarterDocument, type RequestQuarter } from '../data/mockData';
import { addComment, createOrder, getClientOrders, getOrderById, payOrderOnline, signOrderContract, uploadAnnualQuarterDocument, uploadDocument } from '../services/orderService';
import { getFinanceContracts, getFinanceDebts, getFinancePayments } from '../services/paymentService';
import { getCurrentUser } from '../services/authService';
import {
  contractStatusClass,
  formatContractDaysLeft,
  formatIsoDate,
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

const badge = (status: string) => {
  const label = status === 'annual_active' ? 'Активна по годовому договору' : status;
  return <span className="rounded-full bg-eco-50 px-3 py-1 text-xs font-bold text-eco-800">{label}</span>;
};

const clientStepLabel = (order: Order, status: string) => {
  if (status === 'annual_active') return 'Годовое обслуживание';
  if (status === getOrderWorkStageLabel(order)) return 'Выполнение работ';
  if (status === 'КП') return 'КП';
  return status;
};

const clientSteps = (order: Order) => getWorkflowForOrder(order)
  .filter((status) => status !== 'Завершено')
  .map((status) => clientStepLabel(order, status));

const clientStage = (order: Order) => {
  if (order.status === 'Отменено') return 0;
  if (order.status === 'Завершено') return clientSteps(order).length - 1;
  return Math.max(0, getWorkflowForOrder(order).filter((status) => status !== 'Завершено').indexOf(order.status));
};

const clientStatusText = (order: Order) => {
  if (order.status === 'Консультация') return 'Заявка получена. Специалист уточняет задачу и первичные данные.';
  if (order.status === 'Анализ') return 'Специалист анализирует исходные данные, сроки и состав работ.';
  if (order.status === 'КП') return 'Готовим коммерческое предложение с составом работ и стоимостью.';
  if (order.status === 'Договор') return 'Договор готовится или ожидает подписания.';
  if (order.status === 'Счет на оплату') return 'Счет выставлен. После оплаты заявка перейдет к выполнению работ.';
  if (isWorkOrderStatus(order.status)) return `Работы выполняются. Внутренний этап: ${getOrderWorkStageLabel(order)}.`;
  if (order.status === 'Проверка результата') return 'Готовые материалы проходят внутреннюю проверку качества.';
  if (order.status === 'Готово' || order.status === 'Завершено') return 'Работа завершена. Результат доступен в документах заявки.';
  if (order.status === 'Отменено') return 'Заявка отменена. При необходимости создайте новую заявку.';
  return getOrderStatusDefinition(order.status).description;
};

const ClientStatusPath = ({ order }: { order: Order }) => {
  const current = clientStage(order);
  const steps = clientSteps(order);
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
      {steps.map((step, index) => (
        <div key={step} className={`rounded-2xl border p-3 text-xs font-semibold ${index <= current ? 'border-accent bg-eco-50 text-eco-900' : 'border-slate-200 bg-white text-slate-500'}`}>
          {step}
        </div>
      ))}
    </div>
  );
};

const useClientOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const refresh = () => getClientOrders(getCurrentUser()).then(setOrders);
  useEffect(() => { refresh(); }, []);
  return { orders, refresh };
};

export const CabinetDashboardPage = () => {
  const { orders } = useClientOrders();
  const user = getCurrentUser();
  const contracts = getContractsForClient(user);
  const nearestContract = [...contracts].sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())[0];
  const stats = [
    ['Активные заявки', orders.filter((o) => !['Готово', 'Завершено', 'Отменено'].includes(o.status)).length],
    ['Документы', orders.reduce((sum, order) => sum + order.documents.length + order.resultDocuments.length, 0)],
    ['Ожидает оплаты', orders.filter((o) => o.paymentStatus === 'pending').length],
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
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/72">Здесь вы видите заявки, документы, договоры, оплату и комментарии специалиста.</p>
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
      {badge(order.status)}
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
  const user = getCurrentUser();
  const serviceFromUrl = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const serviceId = params.get('service') ?? '';
    return services.some((service) => service.id === serviceId) ? serviceId : services[0]?.id ?? '';
  }, [location.search]);
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
      user,
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
  const [order, setOrder] = useState<Order | undefined>();
  const load = () => id && getOrderById(id).then(setOrder);
  useEffect(() => { load(); }, [id]);
  if (!id) return <Navigate to="/cabinet/orders" replace />;
  if (!order) return <div className="rounded-2xl bg-white p-6">Загрузка заявки...</div>;
  const serviceContract = getPrimaryContractForOrder(order);
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
  const submitQuarterFile = async (event: FormEvent<HTMLFormElement>, quarter: RequestQuarter) => {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get('file') as File | null;
    if (file?.name) {
      await uploadAnnualQuarterDocument(order.id, quarter.id, {
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        documentType: 'client_data',
        uploadedByRole: 'client',
        uploadedByName: getCurrentUser()?.name || 'Клиент',
      });
      onNotify?.('Документ квартала загружен');
    }
    event.currentTarget.reset();
    load();
  };
  const handleSign = async () => {
    await signOrderContract(order.id, order.signatureProvider || 'NCALayer / ЭЦП');
    onNotify?.('Договор подписан электронной подписью');
    load();
  };
  const handlePay = async () => {
    await payOrderOnline(order.id, order.paymentMethod || 'Банковская карта');
    onNotify?.('Оплата прошла онлайн');
    load();
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Reveal>
        <div className="rounded-[24px] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 className="text-2xl font-bold text-eco-900">{order.id}</h2><p className="mt-1 break-words text-slate-600">{order.service}</p></div>{badge(order.status)}</div>
          <p className="mt-4 rounded-2xl bg-eco-50 p-4 text-sm leading-6 text-slate-700">{clientStatusText(order)}</p>
          <ClientStatusPath order={order} />
          {isAnnualRequest(order) && <ClientAnnualRequestPanel order={order} onUpload={submitQuarterFile} />}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Info label="Компания-исполнитель" value={order.businessCompanyName || getBusinessCompanyById(order.businessCompanyId).name} />
            {serviceContract && <Info label="Договор клиента" value={`${serviceContract.number} · ${formatContractDaysLeft(serviceContract)}`} />}
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
          <OnlineOrderPanel order={order} onSign={handleSign} onPay={handlePay} />
          <form onSubmit={submitFile} className="rounded-[22px] bg-white p-5 shadow-sm"><h3 className="font-bold text-eco-900">Загрузить документ</h3><input name="file" type="file" required className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3" /><Button className="mt-4 w-full">Загрузить</Button></form>
          <form onSubmit={submitComment} className="rounded-[22px] bg-white p-5 shadow-sm"><h3 className="font-bold text-eco-900">Написать комментарий</h3><textarea name="comment" required className="input-focus mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={4} /><Button className="mt-4 w-full">Отправить</Button></form>
        </div>
      </Reveal>
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => <div className="rounded-2xl bg-eco-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-2 text-sm text-slate-800">{value || 'Не указано'}</p></div>;

const ClientAnnualRequestPanel = ({ order, onUpload }: { order: Order; onUpload: (event: FormEvent<HTMLFormElement>, quarter: RequestQuarter) => void }) => {
  const progress = getAnnualRequestProgress(order);
  const debt = getAnnualRequestDebtSummary(order);
  const currentQuarter = getCurrentQuarterForRequest(order);
  const warnings = getAnnualRequestWarnings(order).filter((warning) => !warning.includes('бухгалтер'));

  return (
    <div className="mt-6 rounded-[22px] border border-eco-100 bg-eco-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-eco-900">Годовое обслуживание</h3>
          <p className="mt-1 text-sm text-slate-600">{order.annualPeriodStart} - {order.annualPeriodEnd}</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800 ring-1 ring-eco-100">Выполнено {progress.completed}/{progress.total}</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Info label="Текущий квартал" value={currentQuarter?.quarterLabel || 'Нет'} />
        <Info label="Остаток к оплате" value={formatCurrency(debt.totalDebt)} />
        <Info label="Ближайший срок" value={debt.nextDue || 'Нет'} />
      </div>
      {warnings.length > 0 && (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {warnings.map((warning) => <p key={warning} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-amber-800">{warning}</p>)}
        </div>
      )}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {(order.quarters || []).map((quarter) => (
          <ClientQuarterCard key={quarter.id} quarter={quarter} isCurrent={currentQuarter?.id === quarter.id} onUpload={onUpload} />
        ))}
      </div>
    </div>
  );
};

const ClientQuarterCard = ({ quarter, isCurrent, onUpload }: { quarter: RequestQuarter; isCurrent: boolean; onUpload: (event: FormEvent<HTMLFormElement>, quarter: RequestQuarter) => void }) => (
  <div className={`rounded-[20px] border bg-white p-4 ${isCurrent ? 'border-eco-300' : 'border-slate-200'}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h4 className="font-bold text-eco-900">{quarter.quarterLabel}</h4>
        <p className="mt-1 text-sm text-slate-500">{quarter.periodStart} - {quarter.periodEnd}</p>
      </div>
      {isCurrent && <span className="rounded-full bg-eco-900 px-2 py-1 text-[11px] font-bold text-white">Текущий квартал</span>}
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      <Info label="Работы" value={quarter.workStatus === 'completed' ? 'Выполнено' : quarter.workStatus === 'in_progress' ? 'В работе' : quarter.workStatus === 'waiting_client_data' ? 'Ожидаем данные' : 'Запланировано'} />
      <div className="rounded-2xl bg-eco-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Оплата</p><span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${getPaymentStatusColor(quarter.paymentStatus)}`}>{getPaymentStatusLabel(quarter.paymentStatus)}</span></div>
      <Info label="Сумма" value={formatCurrency(quarter.plannedAmount)} />
      <Info label="Остаток" value={formatCurrency(quarter.remainingAmount)} />
    </div>
    <Section title="Документы квартала" items={quarter.documents.map((doc) => doc.name)} />
    <Section title="Результаты квартала" items={quarter.results.map((result) => result.title)} />
    <form onSubmit={(event) => onUpload(event, quarter)} className="mt-4">
      <input name="file" type="file" required className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
      <Button type="submit" className="mt-3 w-full">Загрузить данные по кварталу</Button>
    </form>
  </div>
);

const OnlineOrderPanel = ({ order, onSign, onPay }: { order: Order; onSign: () => void; onPay: () => void }) => {
  const available = order.contractStatus === 'sent' || order.contractStatus === 'signed' || order.paymentStatus === 'pending' || order.paymentStatus === 'paid';
  const signed = order.contractStatus === 'signed';
  const paid = order.paymentStatus === 'paid';
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
  const docs = orders.flatMap((o) => [...o.documents, ...o.resultDocuments]);
  return <PageList title="Документы">{docs.map((doc) => <div key={doc.id} className="rounded-2xl bg-eco-50 p-4 text-sm">{doc.name} · {doc.status}</div>)}</PageList>;
};

const CabinetPaymentsPageLegacy = () => {
  const { orders } = useClientOrders();
  const payments: Array<{ id: string; invoice: string; service: string; amount: string; status: string }> = [];
  const onlinePayments = orders.map((order) => ({
    id: order.id,
    invoice: `Онлайн-счет ${order.id}`,
    service: order.service,
    amount: order.paymentStatus === 'not_sent' || !order.paymentStatus ? 'Не выставлен' : order.paymentAmount || 'Не выставлен',
    status: order.paymentStatus === 'paid' ? 'Оплачено онлайн' : order.paymentStatus === 'pending' ? 'Ожидает онлайн-оплаты' : 'Счет еще не выставлен',
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
  const [financePayments, setFinancePayments] = useState<Payment[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);

  useEffect(() => {
    getFinancePayments().then(setFinancePayments);
    getFinanceContracts().then(setContracts);
    getFinanceDebts().then(setDebts);
  }, []);

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
      {oneTimePayments.map((payment) => (
        <div key={payment.id} className="rounded-2xl bg-eco-50 p-4 text-sm">
          <p className="font-bold text-eco-900">{payment.invoiceNumber} · {payment.serviceName}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <Info label="Сумма" value={formatCurrency(payment.totalAmount)} />
            <Info label="Оплачено" value={formatCurrency(payment.paidAmount)} />
            <Info label="Остаток" value={formatCurrency(payment.remainingAmount)} />
            <Info label="Статус" value={getPaymentStatusLabel(payment.paymentStatus)} />
          </div>
        </div>
      ))}

      {annualContracts.flatMap((contract) =>
        (contract.quarterlySchedule || []).map((quarter) => (
          <div key={quarter.id} className="rounded-2xl bg-eco-50 p-4 text-sm">
            <p className="font-bold text-eco-900">{contract.contractNumber} · {quarter.quarterLabel}</p>
            <p className="mt-1 text-slate-600">{quarter.periodStart} - {quarter.periodEnd}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">
              <Info label="Сумма" value={formatCurrency(quarter.plannedAmount)} />
              <Info label="Оплачено" value={formatCurrency(quarter.paidAmount)} />
              <Info label="Остаток" value={formatCurrency(quarter.remainingAmount)} />
              <Info label="Срок" value={quarter.dueDate || 'Нет'} />
              <Info label="Статус" value={getPaymentStatusLabel(quarter.paymentStatus)} />
            </div>
          </div>
        ))
      )}

      {clientDebts.length > 0 && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm">
          <p className="font-bold text-rose-900">Задолженность</p>
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
  const user = getCurrentUser();
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
