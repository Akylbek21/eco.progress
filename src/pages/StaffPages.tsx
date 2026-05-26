import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Download,
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
  X,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import {
  CommentModal,
  ConfirmModal,
  ContractModal,
  CreateClientModal,
  PaymentModal,
  UploadDocumentModal,
  type CommentValues,
  type ContractModalValues,
  type CreateClientModalValues,
  type PaymentModalValues,
  type UploadDocumentValues,
} from '../components/modals';
import StaffNewOrderForm from '../components/crm/StaffNewOrderForm';
import {
  ClientInfoPanel,
  CommercialOfferPanel,
  ContractDetailsPanel,
  FinalChecklistPanel,
  InvoicePaymentPanel,
  ResultPanel,
  StaffAgreementPanel,
  WasteRemovalPanel,
} from '../components/crm/StaffOrderCrmPanels';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { addAnnualQuarterComment, addAnnualQuarterPayment, addAnnualQuarterResult, addComment, assignManager, completeAnnualRequest, createClient, createStaffOrder, getOrderById, getOrders, requestPrimaryDocument, saveLaboratoryMeasurementAgreement, sendContractAndInvoice, sendLaboratoryMeasurementAgreement, updateAnnualQuarterWorkStatus, updateContractStatus, updateEcologyStatus, updateLaboratoryMeasurementAgreementStatus, updateLaboratoryPrimaryDocumentStatus, updateLaboratoryResultDocumentStatus, updateLaboratoryStatus, updateOrderStatus, updatePaymentStatus, updatePrimaryDocumentStatus, uploadAnnualQuarterDocument, uploadDocument, uploadLaboratoryResultDocument } from '../services/staffOrderService';
import type { CreateClientPayload, StaffCreateOrderPayload } from '../services/staffOrderService';
import { createCommercialOffer, createStaffManualOrder, getStaffCalendar, getTasks, saveContractDetails, saveInvoicePayment, saveTask, saveWasteRemoval, sendDocumentToClient, updateTaskStatus } from '../services/crmWorkflowService';
import { getServices } from '../services/serviceService';
import { primaryDocumentTemplates } from '../services/orderService';
import { getBusinessCompanyById, statusDescriptions } from '../utils/crm';
import type { ClientPrimaryDocumentStatus, ClientContract, DocumentItem, EcologyStatus, LaboratoryMeasurementAgreementStatus, LaboratoryPrimaryDocumentStatus, LaboratoryResultDocument, LaboratoryResultDocumentStatus, LaboratoryStatus, User, Order, OrderPrimaryDocument, OrderStatus, PaymentMethod, PaymentStatus, QuarterDocument, QuarterNumber, QuarterResult, QuarterWorkStatus, RequestQuarter, StaffCalendarEvent, StaffContractStatus, UserRole } from '../types';
import { canAccess, permissionsForRole, type Permission } from '../config/permissions';
import {
  buildBusinessCompanySummaries,
  buildCompanySummaries,
  companyKey,
  contractStatusClass,
  ecologyLabel,
  ecologyStatusClass,
  fallbackPaymentStatus,
  formatContractDaysLeft,
  formatIsoDate,
  getContractDisplayStatus,
  getContractProgress,
  getContractsForOrder,
  getNextCrmStep,
  getNextOrderStatus,
  getOrderBusinessCompanyName,
  getOrderCompanyName,
  getOrderStatusDefinition,
  getOrderWorkStageLabel,
  getWorkflowForOrder,
  getOverallWorkflowStepIndex,
  getPrimaryContractForOrder,
  isWorkOrderStatus,
  accountantOrderStatuses,
  laboratoryLabel,
  laboratoryStatusClass,
  managerOrderStatuses,
  managerPaymentStatusLabel,
  orderStatuses,
  paymentStatusClass,
  paymentStatusLabels,
  paymentStatuses,
  statusClass,
  overallWorkflowSteps,
} from '../utils/crm';
import { canCompleteAnnualRequest, getAnnualRequestDebtSummary, getAnnualRequestProgress, getAnnualRequestWarnings, getCurrentQuarterForRequest, isAnnualRequest } from '../utils/annualRequests';
import { canAccessPayments, formatCurrency, getOverdueDays, getPaymentStatusColor, getPaymentStatusLabel, paymentMethodLabel } from '../utils/payments';
import {
  formatLaboratoryHistory,
  isLaboratoryOrder,
  laboratoryMeasurementStatusClass,
  laboratoryMeasurementStatusLabels,
  laboratoryPrimaryStatusClass,
  laboratoryPrimaryStatusLabels,
  laboratoryResultSectionLabels,
  laboratoryResultStatusClass,
  laboratoryResultStatusLabels,
} from '../utils/laboratory';

const useOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => {
    setLoading(true);
    setError(null);
    getOrders()
      .then(setOrders)
      .catch((err) => {
        console.error('Failed to load orders:', err);
        setError(err?.response?.status === 403 ? 'Нет доступа к заявкам' : 'Не удалось загрузить заявки');
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);
  return { orders, refresh, loading, error };
};

const badge = (status: string) => {
  const definition = orderStatuses.includes(status as OrderStatus) ? getOrderStatusDefinition(status as OrderStatus) : undefined;
  return <span className={`inline-flex max-w-full rounded-full px-3 py-1 text-left text-xs font-bold leading-snug ring-1 ${statusClass(status)}`}>{definition?.label || status}</span>;
};
const paymentBadge = (status?: PaymentStatus) => {
  const paymentStatus = fallbackPaymentStatus(status);
  return <span className={`inline-flex max-w-full rounded-full px-3 py-1 text-left text-xs font-bold leading-snug ring-1 ${paymentStatusClass(paymentStatus)}`}>{paymentStatusLabels[paymentStatus]}</span>;
};
const managerPaymentBadge = (order: Order) => {
  const label = managerPaymentStatusLabel(order);
  const tone =
    label === 'Полностью оплачено' || label === 'Передано специалисту' ? 'bg-emerald-50 text-emerald-800 ring-emerald-100' :
    label === 'Частично оплачено' ? 'bg-indigo-50 text-indigo-800 ring-indigo-100' :
    label === 'Ожидаем оплату' ? 'bg-amber-50 text-amber-800 ring-amber-100' :
    'bg-slate-100 text-slate-700 ring-slate-200';
  return <span className={`inline-flex max-w-full rounded-full px-3 py-1 text-left text-xs font-bold leading-snug ring-1 ${tone}`}>{label}</span>;
};
const moneyValue = (value?: string | number) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number(value.replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const orderFinance = (order: Order) => {
  const total = order.totalAmount || order.contractAmount || moneyValue(order.paymentAmount);
  const paid = order.paidAmount || (order.paymentStatus === 'paid' || order.paymentStatus === 'transferred_to_specialist' ? total : 0);
  const remaining = order.remainingAmount ?? Math.max(0, total - paid);
  const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  return { total, paid, remaining, percent };
};
const canTransferToSpecialist = (order: Order) => {
  const finance = orderFinance(order);
  const requiredPercent = order.paymentTerms === 'partial_allowed' ? order.minPrepaymentPercent ?? 50 : 100;
  return finance.total > 0 && finance.percent >= requiredPercent;
};
const requiredPrimaryDocumentsAccepted = (order: Order) => {
  const required = (order.primaryDocuments || []).filter((doc) => doc.required);
  return required.length > 0 && required.every((doc) => doc.status === 'accepted');
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
const ecologyBadge = (status?: EcologyStatus) => <span className={`inline-flex max-w-full rounded-full px-3 py-1 text-left text-xs font-bold leading-snug ring-1 ${ecologyStatusClass(status)}`}>{ecologyLabel(status)}</span>;
const laboratoryBadge = (status?: LaboratoryStatus) => <span className={`inline-flex max-w-full rounded-full px-3 py-1 text-left text-xs font-bold leading-snug ring-1 ${laboratoryStatusClass(status)}`}>{laboratoryLabel(status)}</span>;
const quarterNumbers = [1, 2, 3, 4] as const;
const toQuarterNumber = (value: FormDataEntryValue | null): QuarterNumber | undefined => {
  const quarter = Number(value);
  return quarterNumbers.includes(quarter as QuarterNumber) ? quarter as QuarterNumber : undefined;
};
const quarterWorkStatusLabels: Record<QuarterWorkStatus, string> = {
  planned: 'Запланировано',
  waiting_client_data: 'Ожидает данные клиента',
  ready_to_start: 'Готово к старту',
  in_progress: 'В работе',
  waiting_payment: 'Ожидает оплату',
  blocked_by_debt: 'Заблокировано долгом',
  completed: 'Выполнено',
};
const quarterWorkBadge = (status: QuarterWorkStatus) => {
  const tone =
    status === 'completed' ? 'bg-emerald-50 text-emerald-800 ring-emerald-100' :
    status === 'blocked_by_debt' ? 'bg-rose-50 text-rose-800 ring-rose-100' :
    status === 'waiting_payment' || status === 'waiting_client_data' ? 'bg-amber-50 text-amber-800 ring-amber-100' :
    status === 'in_progress' || status === 'ready_to_start' ? 'bg-eco-50 text-eco-800 ring-eco-100' :
    'bg-slate-100 text-slate-700 ring-slate-200';
  return <span className={`inline-flex max-w-full rounded-full px-3 py-1 text-left text-xs font-bold leading-snug ring-1 ${tone}`}>{quarterWorkStatusLabels[status]}</span>;
};

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

const paymentState = (order: Order, canViewFinance = false) => {
  if (!canViewFinance) {
    if (order.paymentStatus === 'paid') return { title: 'Оплата получена', text: 'Финансовые детали скрыты', tone: 'border-emerald-200 bg-emerald-50 text-emerald-900' };
    if (order.paymentStatus === 'partial') return { title: 'Частичная оплата', text: 'Финансовые детали скрыты', tone: 'border-indigo-200 bg-indigo-50 text-indigo-900' };
    if (order.paymentStatus === 'pending') return { title: 'Оплата ожидается', text: 'Финансовые детали скрыты', tone: 'border-amber-200 bg-amber-50 text-amber-900' };
    return { title: 'Оплата не выставлена', text: 'Финансовые детали скрыты', tone: 'border-slate-200 bg-slate-50 text-slate-700' };
  }
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

const useStaffRole = (): UserRole => {
  const { user } = useAuth();
  const role = user?.role;
  return role && role !== 'CLIENT' ? role : 'MANAGER';
};

const roleTitle = (role: UserRole) => {
  const labels: Record<UserRole, string> = {
    CLIENT: 'Клиент',
    ADMIN: 'Админ',
    DIRECTOR: 'Руководитель',
    HEAD: 'Руководитель',
    MANAGER: 'Менеджер',
    ACCOUNTANT: 'Бухгалтер',
    ECOLOGIST: 'Эколог',
    LABORATORY: 'Лаборатория',
    WASTE_SPECIALIST: 'Специалист по отходам',
  };
  return labels[role];
};

const roleAccess = (role: UserRole) => ({
  all: role === 'ADMIN',
  manager: canAccess(role, 'edit_order') || canAccess(role, 'send_messages'),
  finance: canAccess(role, 'edit_payment'),
  viewFinance: canAccessPayments(role),
  ecology: canAccess(role, 'edit_ecology'),
  laboratory: canAccess(role, 'edit_laboratory'),
  waste: canAccess(role, 'edit_waste'),
  messages: canAccess(role, 'send_messages'),
  notes: canAccess(role, 'add_internal_notes'),
});

const roleQuickActions = (role: UserRole) => {
  if (role === 'ACCOUNTANT') return ['Оплаты', 'Счета', 'Акты'];
  if (role === 'ECOLOGIST') return ['Новые задачи', 'Нужны данные', 'Заключение'];
  if (role === 'LABORATORY') return ['Образцы', 'Анализ', 'Результат'];
  if (role === 'WASTE_SPECIALIST') return ['Выезды', 'Акты', 'Фото'];
  if (role === 'DIRECTOR' || role === 'HEAD') return ['Все заявки', 'Оплаты', 'Контроль'];
  if (role === 'ADMIN') return ['Все задачи', 'Заявки', 'Уведомления'];
  return ['Новые заявки', 'Консультации', 'КП и договоры'];
};

const roleWorkplace = (role: UserRole) => {
  if (role === 'ACCOUNTANT') return {
    title: 'Рабочее место бухгалтера',
    text: 'В фокусе только счета, оплаты, акты и долги. Рабочие документы и этапы показаны как справка.',
    queueTitle: 'Оплаты и долги',
  };
  if (role === 'ECOLOGIST') return {
    title: 'Рабочее место эколога',
    text: 'В фокусе проектирование, данные от клиента, экологические документы и результат квартала.',
    queueTitle: 'Экологические задачи',
  };
  if (role === 'LABORATORY') return {
    title: 'Рабочее место лаборатории',
    text: 'В фокусе образцы, анализы, протоколы и загрузка лабораторного результата.',
    queueTitle: 'Лабораторные задачи',
  };
  if (role === 'WASTE_SPECIALIST') return {
    title: 'Рабочее место специалиста по отходам',
    text: 'В фокусе вывоз и утилизация: дата вывоза, транспорт, акт, фото и результат для клиента.',
    queueTitle: 'Выезды и утилизация',
  };
  if (role === 'DIRECTOR' || role === 'HEAD') return {
    title: 'Рабочее место руководителя',
    text: 'Виден полный поток заявок, клиентов, оплат, отчетов и сотрудников без технических настроек.',
    queueTitle: 'Контроль CRM',
  };
  if (role === 'ADMIN') return {
    title: 'Рабочее место администратора',
    text: 'Виден полный процесс: заявки, финансы, документы, роли и контроль исполнения.',
    queueTitle: 'Все активные задачи',
  };
  return {
    title: 'Рабочее место менеджера',
    text: 'В фокусе клиент, консультация, первичные документы, КП, договор и передача бухгалтеру. Оплатой управляет бухгалтерия.',
    queueTitle: 'Заявки менеджера',
  };
};

const managerStatusGroups: Array<{ title: string; statuses: OrderStatus[]; description: string }> = [
  { title: 'Новые заявки', statuses: ['Новая заявка'], description: 'Поступили и ждут первого действия менеджера.' },
  { title: 'Связаться с клиентом', statuses: ['Связаться с клиентом'], description: 'Нужно позвонить, написать или подтвердить запрос.' },
  { title: 'Консультации', statuses: ['Консультация'], description: 'Нужно провести консультацию и уточнить услугу.' },
  { title: 'Ожидаем первичные документы', statuses: ['Ожидаем первичные документы'], description: 'Клиент должен отправить исходные файлы и данные.' },
  { title: 'Анализ специалиста', statuses: ['Анализ заявки'], description: 'Специалист проверяет первичные документы, объект и требования.' },
  { title: 'Подготовка КП', statuses: ['Подготовка КП'], description: 'Нужно подготовить коммерческое предложение.' },
  { title: 'КП отправлено', statuses: ['КП отправлено'], description: 'КП отправлено клиенту и ждет согласования.' },
  { title: 'Подготовить договор', statuses: ['КП согласовано', 'Подготовка договора'], description: 'Пора собрать договор по согласованному КП.' },
  { title: 'Ожидаем подпись договора', statuses: ['Договор отправлен', 'Ожидаем подпись договора'], description: 'Договор отправлен, ждем подпись клиента.' },
  { title: 'Передано бухгалтеру', statuses: ['Передано бухгалтеру'], description: 'Менеджер закончил этап, оплату ведет бухгалтер.' },
];

const managerActionFlow: Array<{ label: string; target: OrderStatus; from: OrderStatus[]; contractStatus?: StaffContractStatus }> = [
  { label: 'Связался с клиентом', target: 'Связаться с клиентом', from: ['Новая заявка'] },
  { label: 'Назначить консультацию', target: 'Консультация', from: ['Новая заявка', 'Связаться с клиентом'] },
  { label: 'Запросить первичные документы', target: 'Ожидаем первичные документы', from: ['Консультация', 'Связаться с клиентом'] },
  { label: 'Передать специалисту на анализ', target: 'Анализ заявки', from: ['Консультация', 'Ожидаем первичные документы'] },
  { label: 'Подготовить КП', target: 'Подготовка КП', from: ['Анализ заявки'] },
  { label: 'Отправить КП клиенту', target: 'КП отправлено', from: ['Подготовка КП'] },
  { label: 'КП согласовано', target: 'КП согласовано', from: ['КП отправлено'] },
  { label: 'Подготовить договор', target: 'Подготовка договора', from: ['КП согласовано'] },
  { label: 'Договор отправлен', target: 'Договор отправлен', from: ['Подготовка договора'], contractStatus: 'sent_to_client' },
  { label: 'Ожидаем подпись договора', target: 'Ожидаем подпись договора', from: ['Договор отправлен'], contractStatus: 'waiting_signature' },
  { label: 'Договор подписан', target: 'Договор подписан', from: ['Договор отправлен', 'Ожидаем подпись договора'], contractStatus: 'signed' },
  { label: 'Передать бухгалтеру', target: 'Передано бухгалтеру', from: ['Договор подписан'] },
];

const accountantStatusGroups: Array<{ title: string; statuses: OrderStatus[]; description: string }> = [
  { title: 'Передано бухгалтеру', statuses: ['Передано бухгалтеру'], description: 'Новые заявки от менеджера, нужно проверить договор и сумму.' },
  { title: 'Выставить счет', statuses: ['Ожидает счет'], description: 'Пора сформировать счет и прикрепить его к заявке.' },
  { title: 'Счета отправлены', statuses: ['Счет отправлен'], description: 'Счет уже у клиента, дальше контроль оплаты.' },
  { title: 'Ожидаем оплату', statuses: ['Ожидаем оплату'], description: 'Нужно проверить поступление денег.' },
  { title: 'Частично оплачено', statuses: ['Частично оплачено'], description: 'Есть частичная оплата и остаток долга.' },
  { title: 'Полностью оплачено', statuses: ['Полностью оплачено'], description: 'Можно передавать заявку специалисту.' },
  { title: 'Есть задолженность', statuses: ['Частично оплачено', 'Ожидаем оплату'], description: 'Остаток оплаты требует контроля.' },
  { title: 'Готово к специалисту', statuses: ['Полностью оплачено', 'Частично оплачено'], description: 'Передача доступна, если условия оплаты выполнены.' },
];

const roleStats = (orders: Order[], role: UserRole): Array<[string, number]> => {
  if (role === 'ACCOUNTANT') return [
    ['Передано бухгалтеру', orders.filter((o) => o.status === 'Передано бухгалтеру').length],
    ['Выставить счет', orders.filter((o) => o.status === 'Ожидает счет').length],
    ['Ожидаем оплату', orders.filter((o) => ['Счет отправлен', 'Ожидаем оплату'].includes(o.status)).length],
    ['Есть задолженность', orders.filter((o) => orderFinance(o).remaining > 0 && ['partial', 'debt'].includes(fallbackPaymentStatus(o.paymentStatus))).length],
  ];
  if (role === 'ECOLOGIST') return [
    ['В проектировании', orders.filter((o) => o.status === 'Проектирование' || o.quarters?.some((quarter) => quarter.workStage === 'Проектирование')).length],
    ['Нужны данные', orders.filter((o) => o.ecologyStatus === 'waiting_client_data').length],
    ['В работе', orders.filter((o) => o.ecologyStatus === 'in_progress').length],
    ['Готово', orders.filter((o) => o.ecologyStatus === 'done').length],
  ];
  if (role === 'LABORATORY') return [
    ['Ждем образцы', orders.filter((o) => o.laboratoryStatus === 'waiting_samples').length],
    ['Образцы получены', orders.filter((o) => o.laboratoryStatus === 'samples_received').length],
    ['Анализ идет', orders.filter((o) => o.laboratoryStatus === 'analysis_in_progress').length],
    ['Результат готов', orders.filter((o) => o.laboratoryStatus === 'result_ready').length],
  ];
  if (role === 'WASTE_SPECIALIST') return [
    ['Вывоз / утилизация', orders.filter((o) => ['Вывоз', 'Утилизация'].includes(o.status) || /вывоз|утилизац|отход/i.test(o.service)).length],
    ['Назначить дату', orders.filter((o) => ['Вывоз', 'Утилизация'].includes(o.status)).length],
    ['Акты', orders.filter((o) => o.resultDocuments.some((doc) => /акт/i.test(doc.name))).length],
    ['Готово', orders.filter((o) => ['Готово', 'Завершено'].includes(o.status)).length],
  ];
  if (role === 'DIRECTOR' || role === 'HEAD') return [
    ['Все заявки', orders.length],
    ['В работе', orders.filter((o) => !isClosedOrder(o)).length],
    ['Оплачено', orders.filter((o) => fallbackPaymentStatus(o.paymentStatus) === 'paid').length],
    ['Долги', orders.filter((o) => orderFinance(o).remaining > 0).length],
  ];
  if (role === 'MANAGER') return [
    ['Новые', orders.filter((o) => o.status === 'Новая заявка').length],
    ['Связаться', orders.filter((o) => o.status === 'Связаться с клиентом').length],
    ['КП/договор', orders.filter((o) => ['Подготовка КП', 'КП отправлено', 'КП согласовано', 'Подготовка договора', 'Договор отправлен', 'Ожидаем подпись договора'].includes(o.status)).length],
    ['Передано бухгалтеру', orders.filter((o) => o.status === 'Передано бухгалтеру').length],
  ];
  return [
    ['Консультации', orders.filter((o) => o.status === 'Консультация').length],
    ['До оплаты', orders.filter((o) => ['Анализ', 'КП', 'Договор'].includes(o.status)).length],
    ['Ждут оплаты', orders.filter((o) => o.paymentStatus === 'pending' || o.paymentStatus === 'partial').length],
    ['В работе', orders.filter((o) => isWorkOrderStatus(o.status)).length],
    ['Проверка', orders.filter((o) => o.status === 'Проверка результата').length],
    ['Готово', orders.filter((o) => ['Готово', 'Завершено'].includes(o.status)).length],
  ];
};

const roleOrderFilter = (orders: Order[], role: UserRole) => {
  if (role === 'DIRECTOR' || role === 'HEAD') return orders;
  if (role === 'ACCOUNTANT') return orders.filter((order) => accountantOrderStatuses.includes(order.status) || ['awaiting_invoice', 'invoice_issued', 'invoice_sent', 'pending', 'awaiting_payment', 'partial', 'paid', 'debt'].includes(fallbackPaymentStatus(order.paymentStatus)) || order.quarters?.some((quarter) => quarter.remainingAmount > 0));
  if (role === 'ECOLOGIST') return orders.filter((order) => order.status === 'Проектирование' || order.quarters?.some((quarter) => quarter.workStage === 'Проектирование') || /эколог|отчет|документ|разреш|овос|ндв|пдв|пноолр/i.test(order.service));
  if (role === 'LABORATORY') return orders.filter((order) => order.status === 'Лаборатория' || order.quarters?.some((quarter) => quarter.workStage === 'Лаборатория') || /лаборатор|анализ|исслед|проб|замер/i.test(order.service));
  if (role === 'WASTE_SPECIALIST') return orders.filter((order) => ['Вывоз', 'Утилизация'].includes(order.status) || order.quarters?.some((quarter) => quarter.workStage === 'Вывоз' || quarter.workStage === 'Утилизация') || /вывоз|утилизац|отход|полигон|паспорт/i.test(order.service));
  if (role === 'MANAGER') return orders.filter((order) => managerOrderStatuses.includes(order.status));
  return orders;
};

type WorkTask = {
  id: string;
  title: string;
  reason: string;
  company: string;
  order: Order;
  priority: 'Срочно' | 'Важно' | 'План';
  deadline: string;
};

const isClosedOrder = (order: Order) => ['Готово', 'Завершено', 'Отменено'].includes(order.status);

const orderNeedsRole = (order: Order, role: UserRole) => {
  if (role === 'ADMIN') return !isClosedOrder(order);
  if (role === 'DIRECTOR' || role === 'HEAD') return !isClosedOrder(order) || orderFinance(order).remaining > 0;
  if (role === 'ACCOUNTANT') return accountantOrderStatuses.includes(order.status) && order.status !== 'Передано специалисту';
  if (role === 'ECOLOGIST') return order.status === 'Проектирование' || (order.status === 'Проверка результата' && order.ecologyStatus !== 'done') || Boolean(order.quarters?.some((quarter) => quarter.workStage === 'Проектирование' && quarter.workStatus !== 'completed'));
  if (role === 'LABORATORY') return (order.status === 'Лаборатория' && order.laboratoryStatus !== 'result_ready') || Boolean(order.quarters?.some((quarter) => quarter.workStage === 'Лаборатория' && quarter.workStatus !== 'completed'));
  if (role === 'WASTE_SPECIALIST') return ['Вывоз', 'Утилизация', 'Проверка результата'].includes(order.status) || Boolean(order.quarters?.some((quarter) => (quarter.workStage === 'Вывоз' || quarter.workStage === 'Утилизация') && quarter.workStatus !== 'completed'));
  if (role === 'MANAGER') return managerActionFlow.some((action) => action.from.includes(order.status));
  return !isClosedOrder(order);
};

const taskTitleForRole = (order: Order, role: UserRole) => {
  const paymentStatus = fallbackPaymentStatus(order.paymentStatus);
  if (role === 'ACCOUNTANT') {
    if (order.status === 'Передано бухгалтеру') return 'Выставить счет';
    if (order.status === 'Ожидает счет' || paymentStatus === 'awaiting_invoice') return 'Прикрепить счет';
    if (order.status === 'Счет отправлен' || paymentStatus === 'invoice_sent') return 'Ожидать оплату';
    if (order.status === 'Ожидаем оплату' || paymentStatus === 'pending' || paymentStatus === 'awaiting_payment') return 'Проверить оплату';
    if (order.status === 'Частично оплачено' || paymentStatus === 'partial') return canTransferToSpecialist(order) ? 'Передать специалисту' : 'Контролировать остаток';
    if (order.status === 'Полностью оплачено' || paymentStatus === 'paid') return 'Передать специалисту';
    return 'Финансовый контроль';
  }
  if (role === 'ECOLOGIST') {
    if (order.ecologyStatus === 'waiting_client_data') return 'Нужны данные';
    if (order.ecologyStatus === 'in_progress') return 'Заключение';
    return 'Взять экологию';
  }
  if (role === 'LABORATORY') {
    if (order.laboratoryStatus === 'waiting_samples') return 'Ждем образцы';
    if (order.laboratoryStatus === 'samples_received') return 'Начать анализ';
    if (order.laboratoryStatus === 'analysis_in_progress') return 'Загрузить результат';
    return 'Назначить анализ';
  }
  if (role === 'WASTE_SPECIALIST') {
    if (order.status === 'Проверка результата') return 'Отправить акт и результат';
    if (order.resultDocuments.some((doc) => /акт/i.test(doc.name))) return 'Завершить этап вывоза';
    return 'Назначить дату и транспорт';
  }
  return getNextCrmStep(order);
};

const taskReason = (order: Order) => `${getOrderStage(order)} · ${order.status}`;

const taskPriority = (order: Order, index: number): WorkTask['priority'] => {
  if (['Новая заявка', 'Связаться с клиентом', 'Консультация', 'Передано бухгалтеру', 'Ожидает счет', 'Ожидаем оплату'].includes(order.status) || order.status === 'Счет на оплату' || ['pending', 'awaiting_payment'].includes(fallbackPaymentStatus(order.paymentStatus)) || order.ecologyStatus === 'waiting_client_data') return 'Срочно';
  if (index < 3 || order.paymentStatus === 'partial' || order.laboratoryStatus === 'analysis_in_progress') return 'Важно';
  return 'План';
};

const companyUrlKey = (key: string) => encodeURIComponent(key);

type StaffDocumentType = 'договор' | 'счёт' | 'акт' | 'экологический документ' | 'лабораторный результат' | 'заключение' | 'прочее';

type StaffDocument = DocumentItem & {
  company: string;
  orderId: string;
  orderService: string;
  orderStatus: OrderStatus;
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
      orderStatus: order.status,
      docType: documentType(doc),
      uploadedBy: doc.type === 'client' ? order.contactPerson || order.clientName : 'Сотрудник',
    }))
  );

type EcoDocumentSection = 'overview' | 'projecting' | 'permit';
type EcoDocument = {
  id: string;
  requestId: string;
  section: EcoDocumentSection;
  documentType?: string;
  title?: string;
  fileName: string;
  comment?: string;
  status: string;
  uploadedBy: string;
  uploadedAt: string;
};
type EcoAction = {
  id: string;
  requestId: string;
  action: string;
  comment?: string;
  createdBy: string;
  createdAt: string;
};
type EcoRequestState = {
  requestId: string;
  workStatus: string;
};
type EcoTab = 'Обзор' | 'Проектирование' | 'Разрешение';

const ecoWorkStatuses = [
  'В работе у эколога',
  'Ожидаем документы от клиента',
  'Документы на проверке',
  'Требуется исправление',
  'Документы приняты',
  'Проектирование начато',
  'Проектирование завершено',
  'Передано на разрешение',
  'Работа завершена',
];
const ecoProjectDocumentTypes = [
  'Бланк инвентаризация',
  'Согласование предварительных материалов',
  'Скрининг',
  'Согласование о проведении организации общественных слушаний',
  'ОВОС отчет',
  'ОВОС',
  'Согласование ОС',
];
const ecoProjectDocumentStatuses = ['Черновик', 'На проверке', 'Требует исправления', 'Согласовано', 'Готово'];
const ecoPermitDocumentStatuses = ['Подготовка', 'На проверке', 'Отправлено', 'Принято', 'Требует исправления', 'Завершено'];

const todayLabel = () => new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const ecoDefaultStatus = (order: Order) => {
  if (order.ecologyStatus === 'waiting_client_data') return 'Ожидаем документы от клиента';
  if (order.ecologyStatus === 'done') return 'Работа завершена';
  if (order.ecologyStatus === 'in_progress' || order.status === 'Проектирование') return 'В работе у эколога';
  return 'Документы на проверке';
};
const isEcologyWorkspaceOrder = (order: Order) =>
  order.status === 'Проектирование' ||
  getOrderWorkStageLabel(order) === 'Проектирование' ||
  Boolean(order.quarters?.some((quarter) => quarter.workStage === 'Проектирование'));
const isLaboratoryWorkspaceOrder = (order: Order) =>
  order.status === 'Лаборатория' ||
  isLaboratoryOrder(order) ||
  Boolean(order.quarters?.some((quarter) => quarter.workStage === 'Лаборатория'));
const ecoStatusTone = (status: string) => {
  if (['Документы приняты', 'Проектирование завершено', 'Принято', 'Согласовано', 'Готово', 'Завершено', 'Работа завершена'].includes(status)) return 'bg-emerald-50 text-emerald-800 ring-emerald-100';
  if (['Требуется исправление', 'Требует исправления'].includes(status)) return 'bg-rose-50 text-rose-800 ring-rose-100';
  if (['Ожидаем документы от клиента', 'Подготовка', 'Черновик'].includes(status)) return 'bg-amber-50 text-amber-800 ring-amber-100';
  if (['На проверке', 'Документы на проверке', 'Отправлено', 'Передано на разрешение'].includes(status)) return 'bg-sky-50 text-sky-800 ring-sky-100';
  return 'bg-eco-50 text-eco-800 ring-eco-100';
};
const ecoBadge = (status: string) => <span className={`inline-flex max-w-full rounded-full px-3 py-1 text-xs font-bold leading-snug ring-1 ${ecoStatusTone(status)}`}>{status}</span>;
const ecoRequestStatus = (order: Order) => ecoDefaultStatus(order);

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

const EcologistRequestList = ({ orders, title = 'Заявки эколога', compact = false }: { orders: Order[]; title?: string; compact?: boolean }) => {
  return (
    <Reveal>
      <div className="rounded-[22px] bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className={`${compact ? 'text-2xl' : 'text-3xl'} font-bold text-eco-900`}>{title}</h2>
            <p className="mt-2 text-sm text-slate-600">Работа эколога ведется только внутри конкретной заявки.</p>
          </div>
          <p className="rounded-full bg-eco-50 px-4 py-2 text-sm font-bold text-eco-800">Всего: {orders.length}</p>
        </div>

        <div className="mt-5 hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="p-3">Заявка</th>
                <th>Клиент</th>
                <th>Услуга</th>
                <th>Статус</th>
                <th>Дата</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-slate-100 align-top">
                  <td className="p-3 font-bold text-slate-900">{order.id}</td>
                  <td className="py-3">
                    <p className="font-semibold text-slate-900">{getOrderCompanyName(order)}</p>
                    <p className="mt-1 text-xs text-slate-500">{order.contactPerson || order.clientName || 'Контакт не указан'}</p>
                  </td>
                  <td className="py-3 leading-snug text-slate-700">{order.service}</td>
                  <td className="py-3">{ecoBadge(ecoRequestStatus(order))}</td>
                  <td className="py-3 text-slate-600">{order.createdAt}</td>
                  <td className="py-3 text-right">
                    <Link to={`/staff/orders/${order.id}`} className="inline-flex rounded-full bg-eco-900 px-4 py-2 text-xs font-bold text-white">Открыть заявку</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-3 lg:hidden">
          {orders.map((order) => (
            <Link key={order.id} to={`/staff/orders/${order.id}`} className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-eco-50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{order.id} · {getOrderCompanyName(order)}</p>
                  <p className="mt-1 break-words text-sm text-slate-600">{order.service}</p>
                  <p className="mt-2 text-xs text-slate-500">Дата: {order.createdAt}</p>
                </div>
                {ecoBadge(ecoRequestStatus(order))}
              </div>
              <span className="mt-3 inline-flex rounded-full bg-eco-900 px-4 py-2 text-xs font-bold text-white">Открыть заявку</span>
            </Link>
          ))}
        </div>
        {!orders.length && <EmptyState text="Заявок для эколога пока нет" />}
      </div>
    </Reveal>
  );
};

export const StaffDashboardPage = () => {
  const { orders, error } = useOrders();
  const navigate = useNavigate();
  const role = useStaffRole();
  const { user } = useAuth();
  if (!canAccess(role, 'view_orders')) return <PermissionDenied permission="view_orders" />;
  const workplace = roleWorkplace(role);
  const roleOrders = roleOrderFilter(orders, role);
  const [selectedCompany, setSelectedCompany] = useState('all');
  const companies = useMemo(() => buildBusinessCompanySummaries(orders), [orders]);
  const visibleOrders = useMemo(() => roleOrders
    .filter((order) => selectedCompany === 'all' || order.businessCompanyId === selectedCompany)
    .sort((a, b) => b.id.localeCompare(a.id)), [roleOrders, selectedCompany]);
  const latestActions = orders.flatMap((order) => order.history.slice(0, 2).map((item) => ({ ...item, order }))).slice(0, 6);
  const roleNotifications = buildRoleNotifications(orders, role).slice(0, 5);
  const myTasks = buildMyTasks(orders, role);
  const expiringContracts: ClientContract[] = [];
  const stats = roleStats(roleOrders, role);

  if (role === 'ACCOUNTANT') {
    return (
      <AccountantDashboard
        orders={roleOrders}
        visibleOrders={visibleOrders}
        companies={companies}
        selectedCompany={selectedCompany}
        onSelectCompany={setSelectedCompany}
        onOpenCompany={(key) => navigate(key === 'all' ? '/staff/orders' : `/staff/orders/company/${key}`)}
        notifications={roleNotifications}
        tasks={myTasks}
        stats={stats}
        userName={user?.name || 'Бухгалтер'}
      />
    );
  }

  if (role === 'MANAGER') {
    return (
      <ManagerDashboard
        orders={roleOrders}
        visibleOrders={visibleOrders}
        companies={companies}
        selectedCompany={selectedCompany}
        onSelectCompany={setSelectedCompany}
        onOpenCompany={(key) => navigate(key === 'all' ? '/staff/orders' : `/staff/orders/company/${key}`)}
        notifications={roleNotifications}
        tasks={myTasks}
        stats={stats}
        userName={user?.name || 'Менеджер'}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-eco-900">{user?.name || 'Сотрудник'} · {roleTitle(role)}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{workplace.text}</p>
          </div>
          <p className="rounded-full bg-white px-4 py-2 text-sm font-bold text-eco-800 shadow-sm">Сегодня: {myTasks.length} задач</p>
          </div>
        </div>
      </Reveal>

      {error && (
        <Reveal>
          <div className="rounded-[24px] bg-rose-50 p-5 text-sm font-semibold text-rose-800 shadow-sm">{error}</div>
        </Reveal>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            <h3 className="text-xl font-bold text-eco-900">Компании-исполнители</h3>
            <button type="button" onClick={() => setSelectedCompany('all')} className="text-sm font-bold text-eco-700">Все</button>
          </div>
          <CompanyCards
            companies={companies}
            selectedCompany={selectedCompany}
            onSelect={setSelectedCompany}
            onOpenOrders={(key) => navigate(key === 'all' ? '/staff/orders' : `/staff/orders/company/${key}`)}
            totalOrders={orders.length}
          />
        </div>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <StaffPanel title={workplace.queueTitle}>
          {myTasks.map((task) => <WorkTaskCard key={task.id} task={task} />)}
          {!myTasks.length && <EmptyState text="Задач нет" />}
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
            {!roleNotifications.length && <EmptyState text="Уведомлений нет" />}
          </StaffPanel>
          {['ADMIN', 'MANAGER'].includes(role) && (
            <StaffPanel title="Сроки договоров">
              {expiringContracts.map((contract) => <StaffContractLine key={contract.id} contract={contract} />)}
              {!expiringContracts.length && <EmptyState text="Договоров нет" />}
            </StaffPanel>
          )}
        </div>
      </div>

      <StaffPanel title={role === 'ADMIN' ? 'Все заявки' : 'Мои заявки по роли'}>
        {visibleOrders.slice(0, 7).map((order) => <OrderLine key={order.id} order={order} />)}
        {!visibleOrders.length && <EmptyState text="Заявок нет" />}
      </StaffPanel>

      {role === 'ADMIN' && <StaffPanel title="Последние действия">
        {latestActions.map((item) => (
          <Link key={`${item.order.id}-${item.id}`} to={`/staff/orders/${item.order.id}`} className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-eco-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-slate-900">{actionTypeLabel(item.actionType)} · {item.order.id}</p>
              <span className="text-xs font-semibold text-slate-500">{item.createdAt}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{item.text}</p>
          </Link>
        ))}
        {!latestActions.length && <EmptyState text="Действий нет" />}
      </StaffPanel>}
    </div>
  );
};

const ManagerDashboard = ({
  orders,
  visibleOrders,
  companies,
  selectedCompany,
  onSelectCompany,
  onOpenCompany,
  notifications,
  tasks,
  stats,
  userName,
}: {
  orders: Order[];
  visibleOrders: Order[];
  companies: ReturnType<typeof buildBusinessCompanySummaries>;
  selectedCompany: string;
  onSelectCompany: (key: string) => void;
  onOpenCompany: (key: string) => void;
  notifications: ReturnType<typeof buildRoleNotifications>;
  tasks: WorkTask[];
  stats: Array<[string, number]>;
  userName: string;
}) => {
  const grouped = managerStatusGroups.map((group) => ({
    ...group,
    orders: visibleOrders.filter((order) => group.statuses.includes(order.status)),
  }));
  const newCount = orders.filter((order) => order.status === 'Новая заявка').length;

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-eco-900">{userName} · Менеджер</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Ведите заявку от поступления до передачи бухгалтеру: контакт, консультация, документы, анализ, КП и договор.
              </p>
            </div>
            <Link to="/staff/notifications" className="rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 ring-1 ring-amber-100">
              Новые заявки: {newCount}
            </Link>
          </div>
        </div>
      </Reveal>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            <h3 className="text-xl font-bold text-eco-900">Компании-исполнители</h3>
            <button type="button" onClick={() => onSelectCompany('all')} className="text-sm font-bold text-eco-700">Все</button>
          </div>
          <CompanyCards
            companies={companies}
            selectedCompany={selectedCompany}
            onSelect={onSelectCompany}
            onOpenOrders={onOpenCompany}
            totalOrders={orders.length}
          />
        </div>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <StaffPanel title="Рабочий процесс менеджера">
            <div className="grid gap-4 md:grid-cols-2">
              {grouped.map((group) => (
                <div key={group.title} className="rounded-[20px] border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{group.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{group.description}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800">{group.orders.length}</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {group.orders.slice(0, 3).map((order) => (
                      <Link key={`${group.title}-${order.id}`} to={`/staff/orders/${order.id}`} className="block rounded-2xl bg-white p-3 text-sm transition hover:bg-eco-50">
                        <p className="font-bold text-slate-900">{order.id} · {getOrderCompanyName(order)}</p>
                        <p className="mt-1 break-words text-xs text-slate-500">{order.service}</p>
                      </Link>
                    ))}
                    {!group.orders.length && <p className="rounded-2xl bg-white p-3 text-sm text-slate-500">Нет заявок</p>}
                  </div>
                </div>
              ))}
            </div>
          </StaffPanel>

          <StaffPanel title="Заявки менеджера">
            {visibleOrders.slice(0, 8).map((order) => <OrderLine key={order.id} order={order} />)}
            {!visibleOrders.length && <EmptyState text="Заявок нет" />}
          </StaffPanel>
        </div>

        <div className="space-y-6">
          <StaffPanel title="Что сделать сейчас">
            {tasks.map((task) => <WorkTaskCard key={task.id} task={task} />)}
            {!tasks.length && <EmptyState text="Срочных задач нет" />}
          </StaffPanel>
          <StaffPanel title="Уведомления">
            {notifications.map((item) => <NotificationLine key={item.id} notification={item} />)}
            {!notifications.length && <EmptyState text="Уведомлений нет" />}
          </StaffPanel>
        </div>
      </div>
    </div>
  );
};

const AccountantDashboard = ({
  orders,
  visibleOrders,
  companies,
  selectedCompany,
  onSelectCompany,
  onOpenCompany,
  notifications,
  tasks,
  stats,
  userName,
}: {
  orders: Order[];
  visibleOrders: Order[];
  companies: ReturnType<typeof buildBusinessCompanySummaries>;
  selectedCompany: string;
  onSelectCompany: (key: string) => void;
  onOpenCompany: (key: string) => void;
  notifications: ReturnType<typeof buildRoleNotifications>;
  tasks: WorkTask[];
  stats: Array<[string, number]>;
  userName: string;
}) => {
  const grouped = accountantStatusGroups.map((group) => ({
    ...group,
    orders: visibleOrders.filter((order) => {
      if (group.title === 'Есть задолженность') return orderFinance(order).remaining > 0 && ['partial', 'debt'].includes(fallbackPaymentStatus(order.paymentStatus));
      if (group.title === 'Готово к специалисту') return group.statuses.includes(order.status) && canTransferToSpecialist(order) && order.status !== 'Передано специалисту';
      return group.statuses.includes(order.status);
    }),
  }));
  const totalDebt = orders.reduce((sum, order) => sum + orderFinance(order).remaining, 0);

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-eco-900">{userName} · Бухгалтер</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Выставляйте счета, фиксируйте полную или частичную оплату и передавайте заявку специалисту только после выполнения условий оплаты.
              </p>
            </div>
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800 ring-1 ring-rose-100">
              Остаток по очереди: {formatCurrency(totalDebt)}
            </div>
          </div>
        </div>
      </Reveal>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            <h3 className="text-xl font-bold text-eco-900">Компании-исполнители</h3>
            <button type="button" onClick={() => onSelectCompany('all')} className="text-sm font-bold text-eco-700">Все</button>
          </div>
          <CompanyCards companies={companies} selectedCompany={selectedCompany} onSelect={onSelectCompany} onOpenOrders={onOpenCompany} totalOrders={orders.length} />
        </div>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <StaffPanel title="Финансовая очередь">
            <div className="grid gap-4 md:grid-cols-2">
              {grouped.map((group) => (
                <div key={group.title} className="rounded-[20px] border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{group.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{group.description}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800">{group.orders.length}</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {group.orders.slice(0, 3).map((order) => {
                      const finance = orderFinance(order);
                      return (
                        <Link key={`${group.title}-${order.id}`} to={`/staff/orders/${order.id}`} className="block rounded-2xl bg-white p-3 text-sm transition hover:bg-eco-50">
                          <p className="font-bold text-slate-900">{order.id} · {getOrderCompanyName(order)}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatCurrency(finance.paid)} / {formatCurrency(finance.total)} · остаток {formatCurrency(finance.remaining)}</p>
                        </Link>
                      );
                    })}
                    {!group.orders.length && <p className="rounded-2xl bg-white p-3 text-sm text-slate-500">Нет заявок</p>}
                  </div>
                </div>
              ))}
            </div>
          </StaffPanel>

          <StaffPanel title="Заявки бухгалтерии">
            {visibleOrders.slice(0, 8).map((order) => <OrderLine key={order.id} order={order} />)}
            {!visibleOrders.length && <EmptyState text="Заявок нет" />}
          </StaffPanel>
        </div>

        <div className="space-y-6">
          <StaffPanel title="Что сделать сейчас">
            {tasks.map((task) => <WorkTaskCard key={task.id} task={task} />)}
            {!tasks.length && <EmptyState text="Срочных задач нет" />}
          </StaffPanel>
          <StaffPanel title="Уведомления">
            {notifications.map((item) => <NotificationLine key={item.id} notification={item} />)}
            {!notifications.length && <EmptyState text="Уведомлений нет" />}
          </StaffPanel>
        </div>
      </div>
    </div>
  );
};

const buildRoleNotifications = (orders: Order[], role: UserRole) => {
  const generated = orders.flatMap((order) => {
    const items = [
      order.status === 'Новая заявка' && { id: `${order.id}-new-request`, category: 'Новая заявка', title: `Новая заявка ${order.id}`, text: `${getOrderCompanyName(order)} · ${order.phone}`, order },
      order.status === 'Связаться с клиентом' && { id: `${order.id}-contact`, category: 'Связаться', title: `Связаться с клиентом ${order.id}`, text: `${order.contactPerson || order.clientName} · ${order.phone}`, order },
      order.status === 'Консультация' && { id: `${order.id}-new`, category: 'Консультация', title: `Консультация ${order.id}`, text: `${getOrderCompanyName(order)} · ${order.service}`, order },
      order.status === 'Ожидаем первичные документы' && { id: `${order.id}-primary-docs`, category: 'Документы', title: `Ожидаем документы ${order.id}`, text: getOrderCompanyName(order), order },
      order.status === 'Подготовка КП' && { id: `${order.id}-offer`, category: 'КП', title: `Подготовить КП ${order.id}`, text: getOrderCompanyName(order), order },
      order.status === 'Ожидаем подпись договора' && { id: `${order.id}-contract-sign`, category: 'Договор', title: `Ожидаем подпись ${order.id}`, text: getOrderCompanyName(order), order },
      order.status === 'Передано бухгалтеру' && { id: `${order.id}-accounting-new`, category: 'Бухгалтерия', title: `Новая заявка на оплату ${order.id}`, text: `${getOrderCompanyName(order)} · ${order.paymentAmount || 'сумма не указана'}`, order },
      order.status === 'Ожидает счет' && { id: `${order.id}-invoice-needed`, category: 'Счет', title: `Выставить счет ${order.id}`, text: getOrderCompanyName(order), order },
      order.status === 'Счет отправлен' && { id: `${order.id}-invoice-sent`, category: 'Счет', title: `Счет отправлен ${order.id}`, text: 'Ожидаем оплату клиента', order },
      order.status === 'Частично оплачено' && { id: `${order.id}-partial`, category: 'Оплата', title: `Частичная оплата ${order.id}`, text: managerPaymentStatusLabel(order), order },
      order.paymentStatus === 'pending' && { id: `${order.id}-pay`, category: 'Оплата', title: `Ожидает оплаты ${order.id}`, text: order.paymentAmount || 'Сумма не указана', order },
      order.resultDocuments.length > 0 && { id: `${order.id}-doc`, category: 'Документы', title: `Документы по ${order.id}`, text: getOrderCompanyName(order), order },
      order.status === 'Проектирование' && { id: `${order.id}-eco`, category: 'Проектирование', title: `Проектирование ${order.id}`, text: getNextCrmStep(order), order },
      order.status === 'Лаборатория' && { id: `${order.id}-lab`, category: 'Лаборатория', title: `Лабораторная задача ${order.id}`, text: getNextCrmStep(order), order },
    ].filter(Boolean);
    return items as Array<{ id: string; category: string; title: string; text: string; order: Order }>;
  });

  if (role === 'ACCOUNTANT') return generated.filter((item) => ['Бухгалтерия', 'Счет', 'Оплата', 'Документы'].includes(item.category));
  if (role === 'ECOLOGIST') return generated.filter((item) => item.category === 'Проектирование');
  if (role === 'LABORATORY') return generated.filter((item) => item.category === 'Лаборатория');
  if (role === 'MANAGER') return generated.filter((item) => ['Новая заявка', 'Связаться', 'Консультация', 'Документы', 'КП', 'Договор'].includes(item.category));
  return generated;
};

const buildMyTasks = (orders: Order[], role: UserRole) => roleOrderFilter(orders, role)
  .filter((order) => orderNeedsRole(order, role))
  .sort((a, b) => Number(['Новая заявка', 'Связаться с клиентом', 'Консультация'].includes(b.status)) - Number(['Новая заявка', 'Связаться с клиентом', 'Консультация'].includes(a.status)) || b.id.localeCompare(a.id))
  .slice(0, 6)
  .map((order, index) => ({
    id: `TASK-${order.id}`,
    title: taskTitleForRole(order, role),
    reason: taskReason(order),
    company: getOrderBusinessCompanyName(order),
    order,
    priority: taskPriority(order, index),
    deadline: order.deadline || 'Сегодня',
  }));

const getOrderStage = (order: Order) => {
  if (order.status === 'annual_active') return getCurrentQuarterForRequest(order)?.workStage || 'Готово';
  if (accountantOrderStatuses.includes(order.status) || order.status === 'Счет на оплату') return 'Бухгалтерия';
  if (order.status === 'Проектирование') return 'Проектирование';
  if (order.status === 'Лаборатория') return 'Лаборатория';
  if (order.status === 'Вывоз') return 'Вывоз';
  if (order.status === 'Утилизация') return 'Утилизация';
  if (order.status === 'Проверка результата') return 'Проверка';
  if (order.status === 'Готово' || order.status === 'Завершено') return 'Готово';
  return 'Менеджер';
};

const NotificationLine = ({ notification }: { notification: { id: string; category: string; title: string; text: string; order?: Order } }) => {
  const [read, setRead] = useState(false);
  return (
    <div className={`rounded-2xl p-4 transition ${read ? 'bg-slate-50' : 'bg-eco-50 ring-1 ring-eco-100'}`}>
      <Link to={notification.order ? `/staff/orders/${notification.order.id}` : '/staff/notifications'} className="block">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold text-slate-900">{notification.title}</p>
          <div className="flex flex-wrap gap-2">
            {!read && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-800">Непрочитано</span>}
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800">{notification.category}</span>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600">{notification.text}</p>
      </Link>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to={notification.order ? `/staff/orders/${notification.order.id}` : '/staff/notifications'} className="inline-flex rounded-full bg-eco-900 px-3 py-2 text-xs font-bold text-white">Открыть</Link>
        {!read && <button type="button" onClick={() => setRead(true)} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-eco-800">Отметить прочитанным</button>}
      </div>
    </div>
  );
};

const StaffContractLine = ({ contract }: { contract: ClientContract }) => {
  const progress = getContractProgress(contract);
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-bold text-slate-900">{contract.companyName}</p>
          <p className="mt-1 text-sm text-slate-600">{contract.number} · {getBusinessCompanyById(contract.businessCompanyId).name}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${contractStatusClass(contract)}`}>{getContractDisplayStatus(contract)}</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
        <span className="font-bold text-eco-900">{formatContractDaysLeft(contract)}</span>
        <span className="text-slate-500">до {formatIsoDate(contract.endsAt)}</span>
      </div>
    </div>
  );
};

const StaffPanel = ({ title, children }: { title: string; children: ReactNode }) => (
  <Reveal>
    <div className="rounded-[20px] bg-white p-5 shadow-sm sm:rounded-[22px] sm:p-6">
      <h3 className="mb-4 text-xl font-bold text-eco-900">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  </Reveal>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
    {text}
  </div>
);

const WorkTaskCard = ({ task }: { task: WorkTask }) => {
  const priorityClass = task.priority === 'Срочно'
    ? 'bg-rose-50 text-rose-800'
    : task.priority === 'Важно'
      ? 'bg-amber-50 text-amber-800'
      : 'bg-white text-eco-800';

  return (
    <Link to={`/staff/orders/${task.order.id}`} className="block rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-eco-200 hover:bg-eco-50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold text-slate-900">{task.title}</p>
          <p className="mt-1 break-words text-sm text-slate-600">{task.company} · {task.order.id}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">{task.reason}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${priorityClass}`}>{task.priority}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-500">{task.deadline}</span>
        <span className="inline-flex rounded-full bg-eco-900 px-4 py-2 text-xs font-bold text-white">Открыть</span>
      </div>
    </Link>
  );
};

const OrderLine = ({ order }: { order: Order }) => {
  const online = onlineState(order);
  const manager = order.manager?.trim();
  const contract = getPrimaryContractForOrder(order);
  return (
    <Link to={`/staff/orders/${order.id}`} className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-eco-50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{order.id} · {getOrderBusinessCompanyName(order)}</p>
          {order.service && <p className="mt-1 break-words text-sm text-slate-600">{order.service}</p>}
          <p className="mt-1 text-xs text-slate-500">Клиент: {getOrderCompanyName(order)}</p>
          {contract && <p className="mt-1 text-xs font-semibold text-amber-700">Договор: {formatContractDaysLeft(contract)}</p>}
          <p className="mt-2 text-xs font-semibold text-eco-700">Следующий шаг: {getNextCrmStep(order)}</p>
          {manager && <p className="mt-1 text-xs text-slate-500">Ответственный: {manager}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {badge(order.status)}
          {managerOrderStatuses.includes(order.status) && managerPaymentBadge(order)}
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
  onOpenOrders,
  totalOrders,
}: {
  companies: ReturnType<typeof buildBusinessCompanySummaries> | ReturnType<typeof buildCompanySummaries>;
  selectedCompany: string;
  onSelect: (key: string) => void;
  onOpenOrders?: (key: string) => void;
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
        className={`min-w-[260px] rounded-[20px] border p-4 text-left transition ${
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
        {totals.pendingPayment > 0 && <p className="mt-3 text-xs font-semibold opacity-75">{totals.pendingPayment} ждёт оплаты</p>}
        {onOpenOrders && (
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onOpenOrders('all');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onOpenOrders('all');
              }
            }}
            className={`mt-4 inline-flex rounded-full px-4 py-2 text-xs font-bold ${selectedCompany === 'all' ? 'bg-white text-eco-900' : 'bg-eco-900 text-white'}`}
          >
            Открыть заявки
          </span>
        )}
      </button>

      {companies.map((company) => {
        const selected = selectedCompany === company.key;
        return (
          <button
            type="button"
            key={company.key}
            onClick={() => onSelect(company.key)}
            className={`min-w-[280px] rounded-[20px] border p-4 text-left transition ${
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
            {'description' in company && <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{company.description}</p>}
            {(company.pendingPayment > 0 || company.partialPayment > 0) && (
              <p className="mt-3 text-xs font-semibold text-slate-500">
                {company.pendingPayment > 0 && `${company.pendingPayment} ждёт оплаты`}{company.pendingPayment > 0 && company.partialPayment > 0 ? ' · ' : ''}{company.partialPayment > 0 && `${company.partialPayment} частично`}
              </p>
            )}
            {onOpenOrders && (
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenOrders(company.key);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenOrders(company.key);
                  }
                }}
                className="mt-4 inline-flex rounded-full bg-eco-900 px-4 py-2 text-xs font-bold text-white"
              >
                Открыть заявки
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

const CompanyMetrics = ({ total, active, waiting, completed, dark = false }: { total: number; active: number; waiting: number; completed: number; dark?: boolean }) => {
  const items = [
    ['заявки', total],
    active > 0 && ['в работе', active],
    waiting > 0 && ['ждёт', waiting],
    completed > 0 && ['готово', completed],
  ].filter(Boolean) as Array<[string, number]>;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map(([label, value]) => (
      <div key={String(label)} className={`rounded-2xl px-2 py-2 ${dark ? 'bg-white/10' : 'bg-slate-50'}`}>
        <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-eco-900'}`}>{value}</p>
        <p className={`text-[11px] font-semibold ${dark ? 'text-white/65' : 'text-slate-500'}`}>{label}</p>
      </div>
      ))}
    </div>
  );
};

const crmTabs = ['Обзор', 'Клиент', 'Обзор заявки', 'Документы', 'КП', 'Договор', 'Счет и оплата', 'Оплата', 'Работа специалиста', 'Проектирование', 'Разрешение', 'Экология', 'Лаборатория', 'Вывоз / Утилизация', 'Первичные документы', 'Согласование', 'Согласование замера', 'Протокол', '870 форма', 'База отчёт', 'Квартальный отчёт', 'Годовой отчёт', 'Полугодовой отчёт', 'Архив отчёт', 'Результат', 'Комментарии', 'Сообщения', 'Заметки', 'История'] as const;
type CrmTab = typeof crmTabs[number];

const workflowTabTarget = (order: Order): CrmTab => {
  const workStage = getOrderWorkStageLabel(order);
  if (workStage === 'Лаборатория') return 'Лаборатория';
  if (workStage === 'Проектирование') return 'Экология';
  return 'Документы';
};

const staffWorkflowTabs = (order: Order): Array<{ label: string; target: CrmTab }> => [
  { label: 'Консультация', target: 'Обзор' },
  { label: 'Анализ', target: 'Документы' },
  { label: 'КП', target: 'Договор' },
  { label: 'Договор', target: 'Договор' },
  { label: 'Счет на оплату', target: 'Оплата' },
  { label: getOrderWorkStageLabel(order), target: workflowTabTarget(order) },
  { label: 'Проверка результата', target: 'Документы' },
  { label: 'Готово', target: 'Документы' },
  { label: 'Завершено', target: 'Документы' },
];

const staffUtilityTabs: Array<{ label: string; target: CrmTab }> = [
  { label: 'Сообщения', target: 'Сообщения' },
  { label: 'Заметки', target: 'Заметки' },
  { label: 'История', target: 'История' },
];

const roleVisibleTabs = (role: UserRole, order: Order): CrmTab[] => {
  const tabsForOrder = (tabs: CrmTab[]) => isLaboratoryOrder(order) ? tabs.filter((tab) => tab !== 'Документы') : tabs;
  const workTabsForOrder = (): CrmTab[] => {
    if (isLaboratoryWorkspaceOrder(order)) return ['Первичные документы', 'Согласование замера', 'Протокол', '870 форма', 'База отчёт', 'Квартальный отчёт', 'Годовой отчёт', 'Полугодовой отчёт', 'Архив отчёт'];
    if (isEcologyWorkspaceOrder(order)) return ['Проектирование', 'Разрешение'];
    return [];
  };
  if (role === 'MANAGER' && managerOrderStatuses.includes(order.status)) return tabsForOrder(['Обзор', 'Клиент', 'Документы', 'КП', 'Договор', 'Согласование', 'Результат', 'Комментарии', 'История']);
  if (role === 'ACCOUNTANT') return tabsForOrder(['Обзор', 'Клиент', 'Договор', 'Счет и оплата', 'Документы', 'История']);
  if (role === 'LABORATORY' && isLaboratoryWorkspaceOrder(order)) return ['Обзор', 'Клиент', 'Документы', 'Лаборатория', 'Согласование', 'Результат', 'Комментарии', 'История'];
  if (role === 'WASTE_SPECIALIST') return ['Обзор', 'Клиент', 'Документы', 'Вывоз / Утилизация', 'Согласование', 'Результат', 'Комментарии', 'История'];
  if (role === 'ECOLOGIST' || role === 'LABORATORY') return ['Обзор', 'Клиент', 'Документы', ...workTabsForOrder(), 'Работа специалиста', 'Согласование', 'Результат', 'Комментарии', 'История'];
  if (role === 'ADMIN') {
    const workTabs: CrmTab[] = isLaboratoryWorkspaceOrder(order) ? ['Лаборатория'] : isEcologyWorkspaceOrder(order) ? ['Проектирование', 'Разрешение'] : [];
    return tabsForOrder(['Обзор', 'Клиент', 'Документы', 'КП', 'Договор', 'Счет и оплата', 'Работа специалиста', ...workTabs, 'Лаборатория', 'Вывоз / Утилизация', 'Согласование', 'Результат', 'Комментарии', 'История']);
  }
  if (role === 'DIRECTOR' || role === 'HEAD') return tabsForOrder(['Обзор', 'Клиент', 'Документы', 'КП', 'Договор', 'Счет и оплата', 'Работа специалиста', 'Лаборатория', 'Вывоз / Утилизация', 'Согласование', 'Результат', 'Комментарии', 'История']);
  return tabsForOrder(['Обзор', 'Клиент', 'Договор', 'Документы', 'Комментарии', 'История']);
};

const roleDefaultTab = (role: UserRole, order: Order): CrmTab => {
  if (role === 'MANAGER' && managerOrderStatuses.includes(order.status)) return ['Подготовка КП', 'КП отправлено', 'КП согласовано', 'Подготовка договора', 'Договор отправлен', 'Ожидаем подпись договора', 'Договор подписан'].includes(order.status) ? 'Договор' : 'Обзор';
  if (role === 'ACCOUNTANT') return 'Счет и оплата';
  if (role === 'WASTE_SPECIALIST') return 'Вывоз / Утилизация';
  if (role === 'ECOLOGIST' && isEcologyWorkspaceOrder(order)) return 'Обзор';
  if (role === 'LABORATORY' && isLaboratoryWorkspaceOrder(order)) return 'Лаборатория';
  if (isLaboratoryOrder(order)) return 'Лаборатория';
  if (['КП', 'Договор', 'Подготовка КП', 'КП отправлено', 'КП согласовано', 'Подготовка договора', 'Договор отправлен', 'Ожидаем подпись договора', 'Договор подписан'].includes(order.status)) return 'Договор';
  return 'Обзор';
};

const isStaffWorkflowTabActive = (order: Order, activeTab: CrmTab, label: string) => {
  const workStageLabel = getOrderWorkStageLabel(order);

  if (label === order.status) return true;
  if (label === workStageLabel && order.status === workStageLabel) return activeTab === workflowTabTarget(order);
  return false;
};

export const StaffOrdersPage = () => {
  const { orders, error } = useOrders();
  const { businessCompanyId } = useParams();
  const navigate = useNavigate();
  const role = useStaffRole();
  if (!canAccess(role, 'view_orders')) return <PermissionDenied permission="view_orders" />;
  const access = roleAccess(role);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Все');
  const [payment, setPayment] = useState('Все');
  const [manager, setManager] = useState('Все');
  const [stage, setStage] = useState('Все');
  const [date, setDate] = useState('');
  const [requestType, setRequestType] = useState('Все');
  const [quarterFilter, setQuarterFilter] = useState('Все');
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(businessCompanyId ?? 'all');
  useEffect(() => {
    setSelectedCompany(businessCompanyId ?? 'all');
  }, [businessCompanyId]);
  const selectBusinessCompany = (key: string) => {
    setSelectedCompany(key);
    navigate(key === 'all' ? '/staff/orders' : `/staff/orders/company/${key}`);
  };
  const companies = useMemo(() => buildBusinessCompanySummaries(orders), [orders]);
  const managers = useMemo(() => Array.from(new Set(orders.map((order) => order.manager || 'Не назначен'))).sort(), [orders]);
  const scopedOrders = useMemo(() => roleOrderFilter(orders, role), [orders, role]);
  if (role === 'ECOLOGIST') return <EcologistRequestList orders={scopedOrders} />;
  const statusOptions = role === 'MANAGER' ? managerOrderStatuses : role === 'ACCOUNTANT' ? accountantOrderStatuses : orderStatuses;
  const filtered = useMemo(() => scopedOrders
    .filter((o) => !onlyMyTasks || orderNeedsRole(o, role))
    .filter((o) => selectedCompany === 'all' || o.businessCompanyId === selectedCompany)
    .filter((o) => status === 'Все' || o.status === status)
    .filter((o) => payment === 'Все' || fallbackPaymentStatus(o.paymentStatus) === payment)
    .filter((o) => {
      if (requestType === 'Все') return true;
      if (requestType === 'Разовые') return o.contractType !== 'annual_quarterly';
      if (requestType === 'Годовые активные') return o.contractType === 'annual_quarterly' && o.status === 'annual_active';
      return o.contractType === 'annual_quarterly' && o.status === 'Завершено';
    })
    .filter((o) => {
      if (quarterFilter === 'Все') return true;
      if (o.contractType !== 'annual_quarterly') return false;
      if (quarterFilter === 'Текущий квартал') return Boolean(getCurrentQuarterForRequest(o));
      return o.quarters?.some((quarter) => quarter.quarterLabel === quarterFilter);
    })
    .filter((o) => manager === 'Все' || (o.manager || 'Не назначен') === manager)
    .filter((o) => stage === 'Все' || getOrderStage(o) === stage)
    .filter((o) => !date || o.createdAt.toLowerCase().includes(date.toLowerCase()))
    .filter((o) => `${o.id} ${o.clientName} ${getOrderCompanyName(o)} ${o.service}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(orderNeedsRole(b, role)) - Number(orderNeedsRole(a, role)) || b.id.localeCompare(a.id)), [scopedOrders, q, selectedCompany, status, payment, requestType, quarterFilter, manager, stage, date, onlyMyTasks, role]);
  const activeCompany = selectedCompany === 'all' ? 'Все компании-исполнители' : companies.find((company) => company.key === selectedCompany)?.name || 'Компания';
  return (
    <div className="space-y-6">
      <Reveal>
        <div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-eco-900">{role === 'ADMIN' ? 'Все заявки' : 'Заявки по моей роли'}</h2>
              <p className="mt-2 text-sm text-slate-600">{roleWorkplace(role).text}</p>
            </div>
            <p className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-eco-800 shadow-sm">Роль: {roleTitle(role)}</p>
          </div>
          <CompanyCards companies={companies} selectedCompany={selectedCompany} onSelect={selectBusinessCompany} totalOrders={orders.length} />
        </div>
      </Reveal>

      {error && (
        <Reveal>
          <div className="rounded-[24px] bg-rose-50 p-5 text-sm font-semibold text-rose-800 shadow-sm">{error}</div>
        </Reveal>
      )}

      <Reveal>
        <div className="rounded-[20px] bg-white p-4 shadow-sm sm:rounded-[22px] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-eco-900">{activeCompany}</h3>
            <p className="mt-1 text-sm text-slate-600">Список уже отфильтрован под роль: {roleTitle(role)}.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canAccess(role, 'create_order') && (
              <Link to="/staff/orders/new" className="rounded-full bg-eco-900 px-4 py-2 text-sm font-bold text-white shadow-sm">Создать заявку</Link>
            )}
            <button
              type="button"
              onClick={() => setOnlyMyTasks((value) => !value)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${onlyMyTasks ? 'bg-eco-900 text-white' : 'bg-eco-50 text-eco-800 hover:bg-eco-100'}`}
            >
              {onlyMyTasks ? 'Моя очередь' : 'Все доступные'}
            </button>
            <p className="rounded-full bg-eco-50 px-4 py-2 text-sm font-semibold text-eco-800">Найдено: {filtered.length}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-4 xl:grid-cols-8">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по номеру, компании, клиенту или услуге" className="input-focus min-w-0 rounded-2xl border border-slate-200 px-4 py-3" />
          <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="input-focus min-w-0 rounded-2xl border border-slate-200 px-4 py-3">
            <option value="all">Все компании-исполнители</option>
            {companies.map((company) => <option key={company.key} value={company.key}>{company.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-focus min-w-0 rounded-2xl border border-slate-200 px-4 py-3"><option>Все</option>{statusOptions.map((s) => <option key={s} value={s}>{getOrderStatusDefinition(s).label}</option>)}</select>
          {access.viewFinance && <select value={payment} onChange={(e) => setPayment(e.target.value)} className="input-focus min-w-0 rounded-2xl border border-slate-200 px-4 py-3"><option>Все</option>{paymentStatuses.map((item) => <option key={item} value={item}>{paymentStatusLabels[item]}</option>)}</select>}
          <select value={requestType} onChange={(e) => setRequestType(e.target.value)} className="input-focus min-w-0 rounded-2xl border border-slate-200 px-4 py-3">{['Все', 'Разовые', 'Годовые активные', 'Завершенные годовые'].map((item) => <option key={item}>{item}</option>)}</select>
          <select value={quarterFilter} onChange={(e) => setQuarterFilter(e.target.value)} className="input-focus min-w-0 rounded-2xl border border-slate-200 px-4 py-3">{['Все', '1 квартал', '2 квартал', '3 квартал', '4 квартал', 'Текущий квартал'].map((item) => <option key={item}>{item}</option>)}</select>
          {['ADMIN', 'MANAGER'].includes(role) && <select value={manager} onChange={(e) => setManager(e.target.value)} className="input-focus min-w-0 rounded-2xl border border-slate-200 px-4 py-3"><option>Все</option>{managers.map((item) => <option key={item}>{item}</option>)}</select>}
          {role === 'ADMIN' && <select value={stage} onChange={(e) => setStage(e.target.value)} className="input-focus min-w-0 rounded-2xl border border-slate-200 px-4 py-3"><option>Все</option>{['Менеджер', 'Бухгалтерия', 'Проектирование', 'Лаборатория', 'Вывоз', 'Утилизация', 'Проверка', 'Готово'].map((item) => <option key={item}>{item}</option>)}</select>}
          <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="Дата" className="input-focus min-w-0 rounded-2xl border border-slate-200 px-4 py-3" />
          <button type="button" onClick={() => { setQ(''); setStatus('Все'); setPayment('Все'); setRequestType('Все'); setQuarterFilter('Все'); setManager('Все'); setStage('Все'); setDate(''); setOnlyMyTasks(false); selectBusinessCompany('all'); }} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-eco-800 transition hover:bg-eco-50">Сбросить</button>
        </div>
        <div className="mt-5 space-y-3 lg:hidden">
          {filtered.map((order) => <OrderLine key={order.id} order={order} />)}
        </div>
        <div className="mt-5 hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1650px] text-left text-sm">
            <thead className="text-slate-500">
              <tr><th className="p-3">№</th><th>Тип</th><th>Компания-исполнитель</th><th>Клиент</th><th>Договор</th><th>Услуга</th><th>Статус</th><th>Квартал</th><th>Прогресс</th>{access.viewFinance && <th>Долг</th>}<th>Оплата</th><th>Этап</th><th>Следующий шаг</th><th>Ответственный</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <StaffOrderTableRow key={order.id} order={order} canViewFinance={access.viewFinance} managerView={role === 'MANAGER'} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </Reveal>
    </div>
  );
};

const StaffOrderTableRow = ({ order, canViewFinance, managerView = false }: { order: Order; canViewFinance: boolean; managerView?: boolean }) => {
  const contract = getPrimaryContractForOrder(order);
  const progress = getAnnualRequestProgress(order);
  const debt = getAnnualRequestDebtSummary(order);
  const currentQuarter = getCurrentQuarterForRequest(order);
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="p-3 font-semibold text-slate-900">{order.id}</td>
      <td className="py-3">
        {isAnnualRequest(order) ? <span className="inline-flex max-w-full rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold leading-snug text-cyan-800 ring-1 ring-cyan-100">Годовая</span> : <span className="inline-flex max-w-full rounded-full bg-slate-100 px-3 py-1 text-xs font-bold leading-snug text-slate-700 ring-1 ring-slate-200">Разовая</span>}
      </td>
      <td className="py-3"><p className="font-semibold leading-snug text-slate-900">{getOrderBusinessCompanyName(order)}</p></td>
      <td className="py-3"><p className="text-sm leading-snug text-slate-600">{getOrderCompanyName(order)}</p></td>
      <td className="py-3">
        {contract ? (
          <div>
            <p className="text-xs font-bold text-eco-900">{formatContractDaysLeft(contract)}</p>
            <p className="mt-1 text-xs text-slate-500">{contract.number}</p>
          </div>
        ) : <span className="text-xs text-slate-400">Нет</span>}
      </td>
      <td className="py-3 leading-snug">{order.service}</td>
      <td className="py-3">{badge(order.status)}</td>
      <td className="py-3 text-sm text-slate-600">{currentQuarter ? currentQuarter.quarterLabel : '-'}</td>
      <td className="py-3 text-sm font-semibold text-eco-800">{isAnnualRequest(order) ? `${progress.completed}/${progress.total}` : '-'}</td>
      {canViewFinance && <td className="py-3 text-sm font-semibold text-rose-700">{isAnnualRequest(order) && debt.totalDebt > 0 ? formatCurrency(debt.totalDebt) : '-'}</td>}
      <td className="py-3">{managerView ? managerPaymentBadge(order) : paymentBadge(order.paymentStatus)}</td>
      <td className="py-3 text-sm leading-snug text-slate-600">{getOrderStage(order)}</td>
      <td className="py-3 font-semibold leading-snug text-slate-700">{getNextCrmStep(order)}</td>
      <td className="py-3 text-sm leading-snug text-slate-600">{order.manager || 'Не назначен'}</td>
      <td className="py-3"><Link to={`/staff/orders/${order.id}`} className="inline-flex max-w-full justify-center rounded-full bg-eco-900 px-3 py-2 text-xs font-bold leading-snug text-white">Открыть</Link></td>
    </tr>
  );
};

export const StaffOrderDetailsPage = ({ onNotify }: { onNotify?: (message: string) => void }) => {
  const { id } = useParams();
  const role = useStaffRole();
  const { user } = useAuth();
  const toast = useToast();
  const access = roleAccess(role);
  const [order, setOrder] = useState<Order | undefined>();
  const [activeTab, setActiveTab] = useState<CrmTab>('Обзор');
  const load = () => {
    if (id) getOrderById(id).then(setOrder);
  };
  useEffect(() => { load(); }, [id]);
  const visibleTabs = useMemo(() => order ? roleVisibleTabs(role, order) : ['Обзор'] as CrmTab[], [role, order]);
  useEffect(() => {
    if (order && !visibleTabs.includes(activeTab)) setActiveTab(roleDefaultTab(role, order));
  }, [activeTab, order, role, visibleTabs]);
  if (!id) return <Navigate to="/staff/orders" replace />;
  if (!order) return <div className="rounded-2xl bg-white p-6">Загрузка заявки...</div>;
  const currentTab = visibleTabs.includes(activeTab) ? activeTab : roleDefaultTab(role, order);
  const errorMessage = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (err as Error)?.message || fallback;

  const changeStatus = async (status: OrderStatus) => {
    try {
      await updateOrderStatus(order.id, status);
      toast.success('Статус обновлен', `Новый статус: ${status}`);
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось обновить статус.'));
      throw err;
    }
  };
  const changePayment = async (paymentStatus: PaymentStatus, comment?: string) => {
    try {
      await updatePaymentStatus(order.id, paymentStatus, { comment });
      toast.success('Статус оплаты обновлен', paymentStatusLabels[paymentStatus]);
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось обновить оплату.'));
      throw err;
    }
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>, visibility: 'client' | 'internal') => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get('comment') || '').trim();
    if (!text) {
      toast.error('Введите текст сообщения');
      return;
    }
    try {
      await addComment(order.id, text, visibility);
      toast.success(visibility === 'client' ? 'Сообщение отправлено' : 'Заметка сохранена', visibility === 'client' ? 'Клиент увидит его в кабинете.' : 'Она видна только сотрудникам.');
      event.currentTarget.reset();
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось добавить комментарий.'));
    }
  };

  const submitQuickComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const visibility = access.messages ? String(form.get('visibility')) as 'client' | 'internal' : 'internal';
    const text = String(form.get('comment') || '').trim();
    if (!text) {
      toast.error('Введите текст сообщения');
      return;
    }
    try {
      await addComment(order.id, text, visibility);
      toast.success(visibility === 'client' ? 'Сообщение отправлено' : 'Заметка сохранена', visibility === 'client' ? 'Клиент увидит его в кабинете.' : 'Она видна только сотрудникам.');
      event.currentTarget.reset();
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось добавить комментарий.'));
    }
  };

  const submitDoc = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get('file') as File | null;
    if (!file?.name) {
      toast.error('Документ не загружен', 'Выберите файл и попробуйте снова.');
      return;
    }
    try {
      await uploadDocument(order.id, file, 'result');
      toast.success('Документ загружен', 'Документ добавлен к заявке.');
      event.currentTarget.reset();
      load();
    } catch (err) {
      toast.error('Документ не загружен', errorMessage(err, 'Не удалось загрузить документ.'));
    }
  };

  const submitManager = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await assignManager(order.id, String(new FormData(event.currentTarget).get('manager')));
      toast.success('Ответственный назначен', 'Изменение сохранено в заявке.');
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось назначить ответственного.'));
    }
  };

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!access.finance) {
      toast.warning('Действие недоступно', 'Финансовые действия доступны только бухгалтеру и администратору.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const status = String(form.get('paymentStatus') || 'partial') as PaymentStatus;
    const total = orderFinance(order).total || order.contractAmount || order.offerAmount || order.totalAmount || 0;
    const percentValue = Number(form.get('paymentPercent') || (status === 'paid' ? 100 : order.minPrepaymentPercent ?? 50));
    const paymentPercent = Math.min(Math.max(Number.isFinite(percentValue) ? percentValue : 0, 0), 100);
    const paidAmount = status === 'paid' ? total : Math.round((total * paymentPercent) / 100);
    const document = form.get('paymentDocument') as File | null;
    try {
      await updatePaymentStatus(order.id, String(form.get('paymentStatus')) as PaymentStatus, {
        amount: String(total || ''),
        totalAmount: total,
        paidAmount,
        paidAt: String(form.get('paidAt') || ''),
        comment: String(form.get('comment') || ''),
        invoiceFileName: document?.name || order.invoiceFileName || '',
        paymentTerms: status === 'partial' ? 'partial_allowed' : 'full_prepayment',
        minPrepaymentPercent: status === 'paid' ? 100 : paymentPercent,
      });
      toast.success(status === 'paid' ? 'Оплата закрыта полностью' : 'Частичная оплата сохранена', status === 'paid' ? 'Остаток по заявке равен 0.' : 'Остаток оплаты пересчитан.');
      load();
    } catch (err) {
      toast.error('Не удалось сохранить оплату', errorMessage(err, 'Проверьте данные и попробуйте снова.'));
    }
  };

  const submitPaymentValues = async (values: PaymentModalValues) => {
    if (!access.finance) {
      toast.warning('Действие недоступно', 'Финансовые действия доступны только бухгалтеру и администратору.');
      return;
    }
    const total = orderFinance(order).total || order.contractAmount || order.offerAmount || order.totalAmount || 0;
    const status: PaymentStatus = values.mode === 'full' ? 'paid' : 'partial';
    try {
      await updatePaymentStatus(order.id, status, {
        amount: String(total || ''),
        totalAmount: total,
        paidAmount: values.mode === 'full' ? total : values.amount,
        paidAt: values.date,
        comment: values.comment,
        invoiceFileName: values.file?.name || order.invoiceFileName || '',
        paymentTerms: status === 'partial' ? 'partial_allowed' : 'full_prepayment',
        minPrepaymentPercent: status === 'paid' ? 100 : Math.round((values.amount / Math.max(total, 1)) * 100),
      });
      toast.success(values.mode === 'full' ? 'Оплата закрыта полностью' : 'Частичная оплата сохранена', values.mode === 'full' ? 'Остаток по заявке равен 0.' : 'Остаток оплаты пересчитан.');
      load();
    } catch (err) {
      toast.error('Не удалось сохранить оплату', errorMessage(err, 'Проверьте данные и попробуйте снова.'));
      throw err;
    }
  };

  const submitEcology = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const status = String(form.get('ecologyStatus')) as EcologyStatus;
      await updateEcologyStatus(order.id, status, String(form.get('comment') || ''));
      toast.success('Статус обновлен', `Новый статус: ${ecologyLabel(status)}`);
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось обновить экологический блок.'));
    }
  };

  const submitLaboratory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const status = String(form.get('laboratoryStatus')) as LaboratoryStatus;
      await updateLaboratoryStatus(order.id, status, String(form.get('comment') || ''));
      toast.success('Статус обновлен', `Новый статус: ${laboratoryLabel(status)}`);
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось обновить лабораторный блок.'));
    }
  };

  const submitLaboratoryPrimaryStatus = async (event: FormEvent<HTMLFormElement>, documentId: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const status = String(form.get('status')) as LaboratoryPrimaryDocumentStatus;
      await updateLaboratoryPrimaryDocumentStatus(
        order.id,
        documentId,
        status,
        String(form.get('comment') || '')
      );
      toast.success('Статус обновлен', `Новый статус: ${laboratoryPrimaryStatusLabels[status]}`);
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось обновить статус документа.'));
    }
  };

  const submitMeasurementAgreement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await saveLaboratoryMeasurementAgreement(order.id, {
        measurementDate: String(form.get('measurementDate') || ''),
        measurementTime: String(form.get('measurementTime') || ''),
        address: String(form.get('address') || ''),
        companyName: String(form.get('companyName') || ''),
        contactPerson: String(form.get('contactPerson') || ''),
        phone: String(form.get('phone') || ''),
        measurementScope: String(form.get('measurementScope') || ''),
        comment: String(form.get('comment') || ''),
      });
      toast.success('Замер назначен', 'Клиент увидит дату и время замера.');
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось сохранить замер.'));
    }
  };

  const sendMeasurement = async () => {
    try {
      await sendLaboratoryMeasurementAgreement(order.id);
      toast.success('Дата отправлена клиенту', 'Клиент сможет подтвердить или попросить перенести.');
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось отправить дату замера.'));
      throw err;
    }
  };

  const changeMeasurementStatus = async (status: LaboratoryMeasurementAgreementStatus, comment?: string) => {
    try {
      await updateLaboratoryMeasurementAgreementStatus(order.id, status, comment);
      toast.success(status === 'completed' ? 'Замер отмечен как проведенный' : 'Статус замера обновлен', status === 'completed' ? 'Теперь можно загрузить протокол.' : laboratoryMeasurementStatusLabels[status]);
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось обновить статус замера.'));
      throw err;
    }
  };

  const submitLaboratoryResult = async (event: FormEvent<HTMLFormElement>, section: LaboratoryResultDocument['section']) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const files = form.getAll('file').filter((file): file is File => file instanceof File && Boolean(file.name));
    const quarter = toQuarterNumber(form.get('quarter'));
    if (!files.length) {
      toast.error('Документ не загружен', 'Выберите файл протокола или отчета.');
      return;
    }
    try {
      const baseName = String(form.get('name') || laboratoryResultSectionLabels[section]);
      const status = String(form.get('status') || 'ready') as LaboratoryResultDocumentStatus;
      for (const file of files) {
        await uploadLaboratoryResultDocument(order.id, {
          name: files.length > 1 ? `${baseName} - ${file.name}` : baseName,
          section,
          quarter,
          fileName: file.name,
          status,
          comment: String(form.get('comment') || ''),
        });
      }
      toast.success(section === 'protocol' ? 'Протокол загружен' : 'Результат загружен', status === 'published_to_client' ? 'Клиент сможет скачать результат.' : 'Теперь его можно опубликовать клиенту.');
      event.currentTarget.reset();
      load();
    } catch (err) {
      toast.error('Документ не загружен', errorMessage(err, 'Не удалось загрузить лабораторный результат.'));
    }
  };

  const changeLaboratoryResultStatus = async (documentId: string, status: LaboratoryResultDocumentStatus) => {
    try {
      await updateLaboratoryResultDocumentStatus(order.id, documentId, status);
      toast.success(status === 'published_to_client' ? 'Протокол опубликован' : 'Статус документа обновлен', status === 'published_to_client' ? 'Клиент сможет скачать результат.' : laboratoryResultStatusLabels[status]);
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось обновить документ.'));
      throw err;
    }
  };

  const submitContractAndInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!access.manager && !access.finance) {
      onNotify?.('Договор может редактировать менеджер, бухгалтер или администратор');
      return;
    }
    const form = new FormData(event.currentTarget);
    const contract = form.get('contract') as File | null;
    try {
      await sendContractAndInvoice(order.id, {
        amount: String(form.get('amount')),
        contractFileName: contract?.name,
        contractPeriodStart: String(form.get('contractPeriodStart') || ''),
        contractPeriodEnd: String(form.get('contractPeriodEnd') || ''),
        contractServiceNote: String(form.get('contractServiceNote') || ''),
        contractNote: String(form.get('contractNote') || ''),
      });
      toast.success('Договор отправлен клиенту', 'Клиент сможет скачать и подписать договор.');
      event.currentTarget.reset();
      load();
    } catch (err) {
      toast.error('Не удалось отправить договор', errorMessage(err, 'Проверьте номер, сумму и файл договора.'));
    }
  };

  const submitContractValues = async (values: ContractModalValues) => {
    if (!access.manager && !access.finance) {
      toast.warning('Действие недоступно', 'Договор может редактировать менеджер, бухгалтер или администратор.');
      return;
    }
    try {
      await sendContractAndInvoice(order.id, {
        amount: values.amount,
        contractFileName: values.file?.name,
        contractPeriodStart: values.periodStart,
        contractPeriodEnd: values.periodEnd,
        contractServiceNote: order.service,
        contractNote: values.comment,
      });
      toast.success('Договор отправлен клиенту', 'Клиент сможет скачать и подписать договор.');
      load();
    } catch (err) {
      toast.error('Не удалось отправить договор', errorMessage(err, 'Проверьте номер, сумму и файл договора.'));
      throw err;
    }
  };

  const markContract = async (status: StaffContractStatus, comment?: string) => {
    try {
      await updateContractStatus(order.id, status, comment);
      toast.success('Статус договора обновлен', contractLabel(status));
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось обновить статус договора.'));
      throw err;
    }
  };

  const performManagerAction = async (action: typeof managerActionFlow[number]) => {
    try {
      if (action.contractStatus) {
        await updateContractStatus(order.id, action.contractStatus, action.label);
      }
      await updateOrderStatus(order.id, action.target);
      if (action.target === 'Передано бухгалтеру') toast.success('Заявка передана бухгалтеру', 'Бухгалтер сможет выставить счет.');
      else if (action.target === 'КП отправлено') toast.success('КП отправлено клиенту', 'Клиент сможет скачать и согласовать КП.');
      else if (action.target === 'КП согласовано') toast.success('КП отмечено как согласованное', 'Теперь можно подготовить договор.');
      else toast.success('Статус обновлен', `Новый статус: ${action.target}`);
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, action.target === 'Передано бухгалтеру' ? 'Нельзя передать бухгалтеру.' : 'Не удалось выполнить действие.'));
      throw err;
    }
  };

  const markPrimaryDocument = async (documentId: string, status: ClientPrimaryDocumentStatus, comment = '') => {
    if ((status === 'needs_fix' || status === 'rejected') && !comment.trim()) {
      toast.error('Укажите причину', 'Комментарий обязателен при отклонении или исправлении документа.');
      return;
    }
    try {
      await updatePrimaryDocumentStatus(order.id, documentId, status, comment);
      if (status === 'accepted') toast.success('Документ принят', 'Клиент увидит, что документ принят.');
      else if (status === 'rejected') toast.success('Документ отклонен', 'Клиент увидит причину отклонения.');
      else toast.success('Запрос исправления отправлен', 'Клиент увидит ваш комментарий.');
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, 'Не удалось проверить документ.'));
    }
  };

  const submitRequestPrimaryDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const documentNames = form.getAll('documentNames').map(String).filter(Boolean);
    if (!documentNames.length) {
      toast.error('Не удалось отправить запрос', 'Выберите хотя бы один документ.');
      return;
    }
    try {
      await Promise.all(documentNames.map((documentName) =>
        requestPrimaryDocument(
          order.id,
          documentName,
          Boolean(form.get('required')),
          String(form.get('comment') || '')
        )
      ));
      toast.success('Запрос документов отправлен', 'Клиент увидит список документов в кабинете.');
      event.currentTarget.reset();
      load();
    } catch (err) {
      toast.error('Не удалось отправить запрос', errorMessage(err, 'Выберите хотя бы один документ.'));
    }
  };

  const setAccountantPayment = async (status: PaymentStatus, comment: string, paidAmount?: number) => {
    const finance = orderFinance(order);
    try {
      await updatePaymentStatus(order.id, status, {
        totalAmount: finance.total || order.contractAmount || order.offerAmount || 0,
        paidAmount: paidAmount ?? finance.paid,
        paidAt: new Date().toISOString().slice(0, 10),
        comment,
        invoiceNumber: order.invoiceNumber,
        invoiceFileName: order.invoiceFileName,
        paymentTerms: order.paymentTerms || 'full_prepayment',
        minPrepaymentPercent: order.minPrepaymentPercent ?? 100,
      });
      if (status === 'invoice_sent') toast.success('Счет выставлен', 'Клиент увидит счет в личном кабинете.');
      else if (status === 'paid') toast.success('Оплата подтверждена', 'Статус оплаты обновлен.');
      else if (status === 'partial') toast.success('Частичная оплата сохранена', 'Остаток оплаты пересчитан.');
      else if (status === 'transferred_to_specialist') toast.success('Заявка передана специалисту', 'Специалист может начать работу.');
      else toast.success('Статус оплаты обновлен', comment);
      load();
    } catch (err) {
      toast.error('Ошибка', errorMessage(err, status === 'transferred_to_specialist' ? 'Нельзя передать специалисту.' : 'Не удалось обновить оплату.'));
      throw err;
    }
  };

  const submitCommercialOffer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!access.manager) {
      toast.warning('Действие недоступно', 'КП может создавать менеджер или администратор.');
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      await createCommercialOffer(order.id, {
        amount: Number(form.get('amount') || order.offerAmount || 0),
        deadline: String(form.get('deadline') || ''),
        comment: String(form.get('comment') || ''),
        status: 'preparing',
        file: form.get('file') as File | null,
      });
      await updateOrderStatus(order.id, 'Подготовка КП');
      toast.success('КП сохранено', 'Коммерческое предложение готово к отправке клиенту.');
      load();
    } catch (err) {
      toast.error('КП не сохранено', errorMessage(err, 'Backend для КП пока может быть не подключен.'));
    }
  };

  const changeCommercialOfferStatus = async (status: string) => {
    const targetStatus: OrderStatus | undefined =
      status === 'sent_to_client' ? 'КП отправлено' :
      status === 'approved' ? 'КП согласовано' :
      status === 'rejected' ? 'Отменено' :
      'Подготовка КП';
    await updateOrderStatus(order.id, targetStatus);
    toast.success('Статус КП обновлен');
    load();
  };

  const submitFullContract = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!access.manager && !access.finance) {
      toast.warning('Действие недоступно', 'Договор может редактировать менеджер, бухгалтер или администратор.');
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      await saveContractDetails(order.id, {
        number: String(form.get('number') || ''),
        contractDate: String(form.get('contractDate') || ''),
        amount: Number(form.get('amount') || 0),
        type: String(form.get('type') || 'one_time') as never,
        startDate: String(form.get('startDate') || ''),
        endDate: String(form.get('endDate') || ''),
        comment: String(form.get('comment') || ''),
        file: form.get('file') as File | null,
        signedFile: form.get('signedFile') as File | null,
      });
      toast.success('Договор сохранен', 'Данные договора готовы для backend.');
      load();
    } catch (err) {
      toast.error('Договор не сохранен', errorMessage(err, 'Backend договора пока может быть не подключен.'));
    }
  };

  const submitInvoicePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!access.finance) {
      toast.warning('Действие недоступно', 'Счет и оплату редактирует бухгалтер или администратор.');
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      await saveInvoicePayment(order.id, {
        invoiceNumber: String(form.get('invoiceNumber') || ''),
        invoiceAmount: Number(form.get('invoiceAmount') || 0),
        invoiceDate: String(form.get('invoiceDate') || ''),
        dueDate: String(form.get('dueDate') || ''),
        accountantComment: String(form.get('accountantComment') || ''),
        invoiceFile: form.get('invoiceFile') as File | null,
        paymentOrder: form.get('paymentOrder') as File | null,
      });
      toast.success('Счет сохранен', 'Данные оплаты готовы для backend.');
      load();
    } catch (err) {
      toast.error('Счет не сохранен', errorMessage(err, 'Backend счета пока может быть не подключен.'));
    }
  };

  const submitWasteRemoval = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!access.waste && !access.all) {
      toast.warning('Действие недоступно', 'Вывоз ведет специалист по отходам или администратор.');
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      await saveWasteRemoval(order.id, {
        wasteType: String(form.get('wasteType') || ''),
        volume: String(form.get('volume') || ''),
        hazardClass: String(form.get('hazardClass') || ''),
        pickupAddress: String(form.get('pickupAddress') || ''),
        pickupDate: String(form.get('pickupDate') || ''),
        transport: String(form.get('transport') || ''),
        driverOrExecutor: String(form.get('driverOrExecutor') || ''),
        status: String(form.get('status') || 'data_check') as never,
        comment: String(form.get('comment') || ''),
        act: form.get('act') as File | null,
        photos: form.getAll('photos').filter((file): file is File => file instanceof File && Boolean(file.name)),
      });
      toast.success('Этап вывоза сохранен', 'Данные готовы для подключения backend.');
      load();
    } catch (err) {
      toast.error('Этап не сохранен', errorMessage(err, 'Backend вывоза пока может быть не подключен.'));
    }
  };

  const sendDocumentAgreement = async (
    documentId: string,
    payload: { comment?: string; needsSignature: boolean; needsClientResponse: boolean; dueDate?: string },
  ) => {
    try {
      await sendDocumentToClient(order.id, documentId, payload);
      toast.success(payload.needsSignature ? 'Документ отправлен на подпись' : 'Документ отправлен клиенту');
      load();
    } catch (err) {
      toast.error('Документ не отправлен', errorMessage(err, 'Backend согласования пока может быть не подключен.'));
    }
  };

  const online = onlineState(order);
  const serviceContracts = getContractsForOrder(order);
  const canAddComment = access.notes || access.messages;
  const workplace = roleWorkplace(role);
  const nextStatus = getNextOrderStatus(order);
  const canAdvanceWorkflow = Boolean(nextStatus) && (
    (access.manager && role !== 'MANAGER') ||
    (access.manager && role === 'MANAGER' && Boolean(nextStatus && managerOrderStatuses.includes(nextStatus) && order.status !== 'Передано бухгалтеру')) ||
    (access.finance && order.status === 'Счет на оплату') ||
    (access.finance && order.status === 'Передано бухгалтеру') ||
    (access.ecology && order.status === 'Проектирование') ||
    (access.laboratory && order.status === 'Лаборатория') ||
    (access.waste && ['Вывоз', 'Утилизация'].includes(order.status))
  );
  const advanceWorkflow = async () => {
    if (!nextStatus) return;
    await changeStatus(nextStatus);
  };
  const managerActions = role === 'MANAGER' && managerOrderStatuses.includes(order.status)
    ? managerActionFlow.filter((action) => action.from.includes(order.status))
    : [];
  const accountantActions = role === 'ACCOUNTANT' ? [
    order.status === 'Передано бухгалтеру' && { label: 'Выставить счет', onClick: () => setAccountantPayment('awaiting_invoice', 'Бухгалтер принял заявку и готовит счет'), variant: 'primary' as const },
    ['Передано бухгалтеру', 'Ожидает счет'].includes(order.status) && { label: 'Прикрепить счет', onClick: () => setActiveTab('Счет и оплата'), variant: 'secondary' as const },
    ['Ожидает счет'].includes(order.status) && { label: 'Отправить счет клиенту', onClick: () => setAccountantPayment('invoice_sent', 'Счет отправлен клиенту'), variant: 'primary' as const },
    ['Счет отправлен'].includes(order.status) && { label: 'Ожидаем оплату', onClick: () => setAccountantPayment('awaiting_payment', 'Ожидаем оплату по счету'), variant: 'secondary' as const },
    ['Счет отправлен', 'Ожидаем оплату', 'Частично оплачено'].includes(order.status) && { label: 'Отметить частичную оплату', onClick: () => setActiveTab('Счет и оплата'), variant: 'secondary' as const },
    ['Счет отправлен', 'Ожидаем оплату', 'Частично оплачено'].includes(order.status) && { label: 'Отметить полную оплату', onClick: () => setAccountantPayment('paid', 'Полная оплата подтверждена'), variant: 'success' as const },
    orderFinance(order).remaining > 0 && ['Ожидаем оплату', 'Частично оплачено'].includes(order.status) && { label: 'Отметить задолженность', onClick: () => setAccountantPayment('debt', 'Есть задолженность по оплате'), variant: 'secondary' as const },
    ['Частично оплачено', 'Полностью оплачено'].includes(order.status) && { label: 'Передать специалисту', onClick: () => setAccountantPayment('transferred_to_specialist', 'Заявка передана специалисту'), variant: 'success' as const, disabled: !canTransferToSpecialist(order) },
  ].filter(Boolean) as Array<{ label: string; onClick: () => void | Promise<void>; variant: 'primary' | 'secondary' | 'success'; disabled?: boolean }> : [];
  const suggestedActions = role === 'ACCOUNTANT' ? accountantActions : role === 'MANAGER' && managerOrderStatuses.includes(order.status) ? [
    ...managerActions.map((action) => ({
      label: action.label,
      onClick: () => performManagerAction(action),
      variant: action.target === 'Передано бухгалтеру' ? 'success' as const : 'primary' as const,
      disabled: action.target === 'Анализ заявки' && order.status === 'Ожидаем первичные документы' && !requiredPrimaryDocumentsAccepted(order),
    })),
    managerActions.length === 0 && order.status === 'Передано бухгалтеру' && { label: 'Открыть историю', onClick: () => setActiveTab('История'), variant: 'secondary' as const },
  ].filter(Boolean) as Array<{ label: string; onClick: () => void | Promise<void>; variant: 'primary' | 'secondary' | 'success'; disabled?: boolean }> : [
    canAdvanceWorkflow && nextStatus && { label: `Следующий этап: ${nextStatus}`, onClick: advanceWorkflow, variant: nextStatus === 'Завершено' ? 'success' as const : 'primary' as const },
    order.status === 'Счет на оплату' && fallbackPaymentStatus(order.paymentStatus) !== 'paid' && access.finance && { label: 'Проверить оплату', onClick: () => setActiveTab('Счет и оплата'), variant: 'primary' as const },
    ['КП', 'Подготовка КП', 'КП отправлено', 'КП согласовано'].includes(order.status) && access.manager && { label: 'Открыть КП', onClick: () => setActiveTab('КП'), variant: 'secondary' as const },
    ['Договор', 'Подготовка договора', 'Договор отправлен', 'Ожидаем подпись договора', 'Договор подписан'].includes(order.status) && access.manager && { label: 'Открыть договор', onClick: () => setActiveTab('Договор'), variant: 'secondary' as const },
    order.status === 'Проектирование' && access.ecology && { label: 'Открыть работу специалиста', onClick: () => setActiveTab('Работа специалиста'), variant: 'secondary' as const },
    order.status === 'Лаборатория' && access.laboratory && { label: 'Открыть лабораторию', onClick: () => setActiveTab('Лаборатория'), variant: 'secondary' as const },
    (order.status === 'Вывоз' || order.status === 'Утилизация' || order.status === 'Проверка результата') && (canAccess(role, 'edit_documents') || access.waste) && { label: 'Вывоз / утилизация', onClick: () => setActiveTab('Вывоз / Утилизация'), variant: 'secondary' as const },
  ].filter(Boolean) as Array<{ label: string; onClick: () => void | Promise<void>; variant: 'primary' | 'secondary' | 'success'; disabled?: boolean }>;

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="rounded-[20px] bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link to="/staff/orders" className="text-sm font-semibold text-eco-700">← Заявки</Link>
              <h2 className="mt-3 text-2xl font-bold text-eco-900">{order.id} · {getOrderBusinessCompanyName(order)}</h2>
              <p className="mt-1 text-sm text-slate-500">Клиент: {getOrderCompanyName(order)}</p>
              <p className="mt-1 break-words text-slate-600">Статус: {order.status}</p>
              <p className="mt-1 text-sm font-semibold text-eco-700">Следующий шаг: {getNextCrmStep(order)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {badge(order.status)}
              {role === 'MANAGER' ? managerPaymentBadge(order) : paymentBadge(order.paymentStatus)}
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${online.tone}`}>{online.label}</span>
            </div>
          </div>
          <div className="mt-5 rounded-2xl bg-eco-50 p-4 text-sm leading-6 text-slate-700">
            <p className="font-bold text-eco-900">{workplace.title}</p>
            <p className="mt-1">{workplace.text}</p>
          </div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {visibleTabs.map((tab) => (
              <button
                type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                  currentTab === tab ? 'bg-eco-900 text-white shadow-lg shadow-eco-900/10' : 'bg-slate-100 text-slate-600 hover:bg-eco-50 hover:text-eco-900'
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
            {currentTab === 'Обзор' && (
              <>
                <Section title="Обзор" icon={<ClipboardCheck size={20} />}>
                  {role === 'MANAGER' && <ManagerRequestCard order={order} />}
                  {(role === 'MANAGER' || role === 'ADMIN') && (
                    <ManagerPrimaryDocumentsPanel
                      order={order}
                      onStatus={markPrimaryDocument}
                      onRequest={submitRequestPrimaryDocument}
                    />
                  )}
                  <div className="mb-5">
                    <h4 className="font-semibold text-slate-900">Очередность выполнения заявки</h4>
                    <Workflow order={order} />
                  </div>
                  <Grid items={{ 'Компания-исполнитель': getOrderBusinessCompanyName(order), Клиент: getOrderCompanyName(order), Контакт: order.contactPerson || order.clientName, Телефон: order.phone, Услуга: order.service, Статус: order.status, 'Следующий шаг': getNextCrmStep(order), Ответственный: order.manager, Дедлайн: order.deadline || 'Нет' }} />
                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Оплата</p><div className="mt-2">{role === 'MANAGER' ? managerPaymentBadge(order) : paymentBadge(order.paymentStatus)}</div></div>
                    {isEcologyWorkspaceOrder(order) && <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Экология</p><div className="mt-2">{ecologyBadge(order.ecologyStatus)}</div></div>}
                    {isLaboratoryWorkspaceOrder(order) && <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Лаборатория</p><div className="mt-2">{laboratoryBadge(order.laboratoryStatus)}</div></div>}
                    <InfoTile label="Документы" value={`${order.documents.length + order.resultDocuments.length} файлов`} />
                  </div>
                  <div className="mt-5">
                    <h4 className="font-semibold text-slate-900">Договоры клиента по этому направлению</h4>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      {serviceContracts.map((contract) => <StaffContractLine key={contract.id} contract={contract} />)}
                      {!serviceContracts.length && <EmptyState text="Договор по этому направлению не найден" />}
                    </div>
                  </div>
                </Section>
              </>
            )}

            {currentTab === 'Обзор заявки' && (
              <LaboratoryRequestOverview order={order} />
            )}

            {currentTab === 'Клиент' && (
              <ClientInfoPanel order={order} />
            )}

            {currentTab === 'КП' && (
              <CommercialOfferPanel
                order={order}
                canEdit={access.manager || access.all}
                onCreate={submitCommercialOffer}
                onStatus={changeCommercialOfferStatus}
              />
            )}

            {currentTab === 'Счет и оплата' && (
              <InvoicePaymentPanel
                order={order}
                canEdit={access.finance || access.all}
                canConfirm={access.finance || access.all}
                onSubmit={submitInvoicePayment}
                onQuickStatus={async (status) => {
                  if (status === 'paid') await setAccountantPayment('paid', 'Полная оплата подтверждена');
                  else if (status === 'partial_paid') await setAccountantPayment('partial', 'Частичная оплата подтверждена');
                  else if (status === 'debt') await setAccountantPayment('debt', 'Есть задолженность по оплате');
                  else if (status === 'invoice_sent') await setAccountantPayment('invoice_sent', 'Счет отправлен клиенту');
                }}
              />
            )}

            {currentTab === 'Работа специалиста' && (
              <Section title="Работа специалиста" icon={<Leaf size={20} />}>
                <div className="grid gap-3 md:grid-cols-3">
                  <InfoTile label="Эколог" value={ecologyLabel(order.ecologyStatus)} />
                  <InfoTile label="Лаборатория" value={laboratoryLabel(order.laboratoryStatus)} />
                  <InfoTile label="Результат" value={order.resultDocuments.length ? 'Загружен' : 'Не загружен'} />
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {isEcologyWorkspaceOrder(order) && <Button type="button" variant="secondary" onClick={() => setActiveTab('Проектирование')}>Проектирование</Button>}
                  {isLaboratoryWorkspaceOrder(order) && <Button type="button" variant="secondary" onClick={() => setActiveTab('Лаборатория')}>Лаборатория</Button>}
                  <Button type="button" variant="secondary" onClick={() => setActiveTab('Результат')}>Результат</Button>
                </div>
              </Section>
            )}

            {currentTab === 'Вывоз / Утилизация' && (
              <WasteRemovalPanel
                order={order}
                canEdit={access.waste || access.all}
                onSubmit={submitWasteRemoval}
              />
            )}

            {currentTab === 'Согласование' && (
              <StaffAgreementPanel
                order={order}
                canEdit={access.manager || access.ecology || access.laboratory || access.waste || access.all}
                onSendDocument={sendDocumentAgreement}
              />
            )}

            {currentTab === 'Результат' && (
              <>
                <ResultPanel order={order} />
                <FinalChecklistPanel order={order} />
              </>
            )}

            {currentTab === 'Комментарии' && (
              <Section title="Комментарии" icon={<MessageSquare size={20} />}>
                <List title="Клиенту" items={order.comments.filter((c) => c.visibility === 'client').map((c) => `${c.createdAt} · ${c.author}: ${c.text}`)} />
                <List title="Внутренние" items={order.comments.filter((c) => c.visibility === 'internal').map((c) => `${c.createdAt} · ${c.author}: ${c.text}`)} />
                {canAddComment && (
                  <form onSubmit={(event) => submitComment(event, access.messages ? 'client' : 'internal')} className="mt-5">
                    <textarea name="comment" required placeholder="Комментарий" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" rows={4} />
                    <Button className="mt-4">Добавить</Button>
                  </form>
                )}
              </Section>
            )}

            {currentTab === 'Оплата' && (
              <Section title="Оплата" icon={<CreditCard size={20} />}>
                {!access.viewFinance && (
                  <div className="mb-5 grid gap-3 md:grid-cols-3">
                    <InfoTile label="Оплата" value={order.quarters?.some((quarter) => quarter.remainingAmount > 0) ? 'Есть задолженность' : fallbackPaymentStatus(order.paymentStatus) === 'paid' ? 'Оплачено' : 'Оплата ожидается'} />
                    <InfoTile label="Статус" value={paymentStatusLabels[fallbackPaymentStatus(order.paymentStatus)]} />
                    <InfoTile label="Доступ" value="Финансовые детали доступны администратору и бухгалтеру" />
                  </div>
                )}
                {access.viewFinance && (
                  <>
                    <div className="mb-5 grid gap-3 md:grid-cols-4">
                      <InfoTile label="Статус" value={paymentStatusLabels[fallbackPaymentStatus(order.paymentStatus)]} />
                      <InfoTile label="Сумма договора" value={formatCurrency(orderFinance(order).total)} />
                      <InfoTile label="Оплачено" value={formatCurrency(orderFinance(order).paid)} />
                      <InfoTile label="Остаток" value={formatCurrency(orderFinance(order).remaining)} />
                    </div>
                    <StaffPaymentActions order={order} onSubmit={submitPaymentValues} />
                  </>
                )}
              </Section>
            )}

            {currentTab === 'Договор' && (
              <ContractDetailsPanel
                order={order}
                canEdit={access.manager || access.finance || access.all}
                onSubmit={submitFullContract}
                onTransferToAccounting={async () => performManagerAction(managerActionFlow.find((action) => action.target === 'Передано бухгалтеру') || managerActionFlow[managerActionFlow.length - 1])}
              />
            )}

            {currentTab === 'Документы' && (
              <Section title="Документы" icon={<Upload size={20} />}>
                <List title="От клиента" items={order.documents.map((d) => `${d.name} · ${d.status} · ${d.uploadedAt}`)} />
                <List title="От ecoprogress.kz" items={order.resultDocuments.map((d) => `${d.name} · ${d.status} · ${d.uploadedAt}`)} />
                {canAccess(role, 'edit_documents') && <StaffUploadDocumentAction onSubmit={async (values) => {
                  if (values.file) await uploadDocument(order.id, {
                    file: values.file,
                    type: values.category || 'work_result',
                    title: values.name || values.file.name,
                    comment: values.comment,
                    sendToClient: values.sendToClient,
                    needsSignature: values.needsSignature,
                    needsClientResponse: values.needsClientResponse,
                    dueDate: values.dueDate,
                  });
                  onNotify?.('Документ загружен');
                  load();
                }} />}
              </Section>
            )}

            {currentTab === 'Экология' && (
              <Section title="Экология" icon={<Leaf size={20} />}>
                <div className="grid gap-3 md:grid-cols-3">
                  <InfoTile label="Статус" value={ecologyLabel(order.ecologyStatus)} />
                  <InfoTile label="Ответственный" value={order.assignedEcologist || 'Эколог ecoprogress.kz'} />
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

            {currentTab === 'Проектирование' && isEcologyWorkspaceOrder(order) && (
              <EcoWorkDocumentTab order={order} userName={user?.name || 'Администратор'} mode="projecting" onNotify={onNotify} />
            )}

            {currentTab === 'Разрешение' && isEcologyWorkspaceOrder(order) && (
              <EcoWorkDocumentTab order={order} userName={user?.name || 'Администратор'} mode="permit" onNotify={onNotify} />
            )}

            {currentTab === 'Первичные документы' && (
              <Section title="Первичные документы" icon={<Upload size={20} />}>
                <div className="space-y-4">
                  {(order.laboratoryPrimaryDocuments || []).map((doc) => (
                    <div key={doc.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900">{doc.name}</p>
                          <p className="mt-1 text-sm text-slate-500">{doc.fileName || 'Файл не загружен'}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${laboratoryPrimaryStatusClass(doc.status)}`}>{laboratoryPrimaryStatusLabels[doc.status]}</span>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-4">
                        <InfoTile label="Дата загрузки" value={doc.uploadedAt || 'Нет'} />
                        <InfoTile label="Кто загрузил" value={doc.uploadedBy || 'Нет'} />
                        <InfoTile label="Комментарий" value={doc.employeeComment || 'Нет'} />
                        <InfoTile label="Статус изменил" value={doc.statusChangedBy || 'Нет'} />
                      </div>
                      <form onSubmit={(event) => submitLaboratoryPrimaryStatus(event, doc.id)} className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto]">
                        <select name="status" defaultValue={doc.status} disabled={!access.manager && !access.laboratory} className="input-focus rounded-2xl border border-slate-200 px-4 py-3 disabled:bg-slate-100">
                          {(['not_uploaded', 'uploaded', 'in_review', 'approved', 'revision_required', 'not_required'] as LaboratoryPrimaryDocumentStatus[]).map((status) => <option key={status} value={status}>{laboratoryPrimaryStatusLabels[status]}</option>)}
                        </select>
                        <input name="comment" defaultValue={doc.employeeComment || ''} disabled={!access.manager && !access.laboratory} placeholder="Комментарий сотрудника" className="input-focus rounded-2xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" />
                        {(access.manager || access.laboratory) && <Button>Сохранить</Button>}
                      </form>
                      {doc.history?.length > 0 && <List title="История действий" items={formatLaboratoryHistory(doc.history)} />}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {currentTab === 'Согласование замера' && (
              <Section title="Согласование замера" icon={<CalendarDays size={20} />}>
                {order.laboratoryMeasurementAgreement && (
                  <>
                    <div className="mb-5 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase text-slate-500">Статус согласования</p>
                        <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${laboratoryMeasurementStatusClass(order.laboratoryMeasurementAgreement.status)}`}>{laboratoryMeasurementStatusLabels[order.laboratoryMeasurementAgreement.status]}</span>
                      </div>
                      <InfoTile label="Отправлено" value={order.laboratoryMeasurementAgreement.sentAt || 'Нет'} />
                      <InfoTile label="Ответ клиента" value={order.laboratoryMeasurementAgreement.acceptedAt || order.laboratoryMeasurementAgreement.rescheduleDate || 'Нет'} />
                    </div>
                    <form onSubmit={submitMeasurementAgreement} className="grid gap-4 md:grid-cols-2">
                      <Field label="Дата замера"><input name="measurementDate" type="date" defaultValue={order.laboratoryMeasurementAgreement.measurementDate} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
                      <Field label="Время замера"><input name="measurementTime" type="time" defaultValue={order.laboratoryMeasurementAgreement.measurementTime} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
                      <Field label="Адрес объекта"><input name="address" defaultValue={order.laboratoryMeasurementAgreement.address} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
                      <Field label="Ответственная фирма или лаборатория"><input name="companyName" defaultValue={order.laboratoryMeasurementAgreement.companyName} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
                      <Field label="Контактное лицо"><input name="contactPerson" defaultValue={order.laboratoryMeasurementAgreement.contactPerson} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
                      <Field label="Телефон"><input name="phone" defaultValue={order.laboratoryMeasurementAgreement.phone} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
                      <label className="text-sm font-semibold text-slate-700 md:col-span-2">Что нужно замерить
                        <textarea name="measurementScope" defaultValue={order.laboratoryMeasurementAgreement.measurementScope} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={3} />
                      </label>
                      <label className="text-sm font-semibold text-slate-700 md:col-span-2">Комментарий
                        <textarea name="comment" defaultValue={order.laboratoryMeasurementAgreement.comment} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={3} />
                      </label>
                      <div className="flex flex-wrap gap-3 md:col-span-2">
                        <Button>Сохранить</Button>
                        <Button type="button" variant="secondary" onClick={sendMeasurement}>Отправить клиенту на согласование</Button>
                        <Button type="button" variant="secondary" onClick={() => changeMeasurementStatus('confirmed', 'Замер согласован')}>Замер согласован</Button>
                        <Button type="button" variant="secondary" onClick={() => changeMeasurementStatus('completed', 'Замер проведён')}>Замер проведён</Button>
                        <Button type="button" variant="secondary" onClick={() => changeMeasurementStatus('cancelled', 'Замер отменён')}>Отменено</Button>
                      </div>
                    </form>
                    {order.laboratoryMeasurementAgreement.status === 'reschedule_requested' && (
                      <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                        Клиент предложил: {order.laboratoryMeasurementAgreement.rescheduleDate || 'дата не указана'} {order.laboratoryMeasurementAgreement.rescheduleTime || ''}. {order.laboratoryMeasurementAgreement.rescheduleComment || ''}
                      </div>
                    )}
                  </>
                )}
              </Section>
            )}

            {(['Протокол', '870 форма', 'База отчёт', 'Квартальный отчёт', 'Годовой отчёт', 'Полугодовой отчёт', 'Архив отчёт'] as CrmTab[]).includes(currentTab) && (
              <LaboratoryResultSection
                order={order}
                tab={currentTab}
                canEdit={access.laboratory}
                onUpload={submitLaboratoryResult}
                onStatus={changeLaboratoryResultStatus}
              />
            )}

            {currentTab === 'Лаборатория' && (
              isLaboratoryOrder(order) ? (
                <LaboratoryWorkspace
                  order={order}
                  canEdit={access.laboratory}
                  canEditLaboratoryStatus={access.laboratory}
                  onMeasurementSubmit={submitMeasurementAgreement}
                  onSendMeasurement={sendMeasurement}
                  onChangeMeasurementStatus={changeMeasurementStatus}
                  onUploadResult={submitLaboratoryResult}
                  onResultStatus={changeLaboratoryResultStatus}
                  onLaboratoryStatus={submitLaboratory}
                  onSetLaboratoryStatus={(status, comment) => updateLaboratoryStatus(order.id, status, comment).then(load)}
                  onAddComment={submitComment}
                />
              ) : (
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
              )
            )}

            {currentTab === 'Сообщения' && (
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

            {currentTab === 'Заметки' && (
              <Section title="Заметки" icon={<StickyNote size={20} />}>
                <List title="Заметки" items={order.comments.filter((c) => c.visibility === 'internal').map((c) => `${c.createdAt} · ${c.author}: ${c.text}`)} />
                <form onSubmit={(event) => submitComment(event, 'internal')} className="mt-5">
                  <textarea name="comment" required disabled={!access.notes} placeholder="Заметка" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3 disabled:bg-slate-100" rows={4} />
                  {access.notes && <Button variant="secondary" className="mt-4">Добавить</Button>}
                </form>
              </Section>
            )}

            {currentTab === 'История' && (
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
          <div className="sticky top-24 space-y-5 self-start">
            <Action title="Что сделать" icon={<CheckCircle2 size={20} />}>
              <p className="rounded-2xl bg-eco-50 p-4 text-sm font-semibold text-eco-900">{getNextCrmStep(order)}</p>
              <div className="mt-4 grid gap-3">
                {suggestedActions.map((action) => (
                  <StaffConfirmAction key={action.label} action={action} />
                ))}
              </div>
              {role === 'ACCOUNTANT' && !canTransferToSpecialist(order) && ['Частично оплачено', 'Полностью оплачено'].includes(order.status) && (
                <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                  Передача специалисту доступна после выполнения условий оплаты.
                </p>
              )}
              {canAddComment && (
                <StaffCommentAction
                  canSendClient={access.messages}
                  onSubmit={async (values) => {
                    await addComment(order.id, values.text, values.visibility);
                    onNotify?.('Комментарий добавлен');
                    load();
                  }}
                />
              )}
              {canAccess(role, 'edit_documents') && (
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <StaffUploadDocumentAction onSubmit={async (values) => {
                    if (values.file) await uploadDocument(order.id, {
                      file: values.file,
                      type: values.category || 'work_result',
                      title: values.name || values.file.name,
                      comment: values.comment,
                      sendToClient: values.sendToClient,
                      needsSignature: values.needsSignature,
                      needsClientResponse: values.needsClientResponse,
                      dueDate: values.dueDate,
                    });
                    onNotify?.('Документ загружен');
                    load();
                  }} />
                </div>
              )}
            </Action>
          </div>
        </Reveal>
      </div>
    </div>
  );
};

const EcologistRequestWorkspace = ({ order, userName, onNotify }: { order: Order; userName: string; onNotify?: (message: string) => void }) => {
  const [activeTab, setActiveTab] = useState<EcoTab>('Обзор');
  const [documents, setDocuments] = useState<EcoDocument[]>(() =>
    (order.resultDocuments || []).map((doc) => ({
      id: doc.id,
      requestId: order.id,
      section: 'overview' as EcoDocumentSection,
      fileName: doc.fileUrl || doc.name,
      status: doc.status,
      uploadedBy: 'Сотрудник',
      uploadedAt: doc.uploadedAt,
    }))
  );
  const [actions, setActions] = useState<EcoAction[]>(() =>
    (order.history || []).filter((h) => h.actorRole !== 'CLIENT').map((h) => ({
      id: h.id,
      requestId: order.id,
      action: h.text,
      comment: h.comment,
      createdBy: h.actorName || 'Система',
      createdAt: h.createdAt,
    }))
  );
  const [workStatus, setWorkStatus] = useState(() => ecoRequestStatus(order));

  const addAction = async (action: string, comment?: string) => {
    const nextAction: EcoAction = {
      id: `eco-action-${Date.now()}`,
      requestId: order.id,
      action,
      comment,
      createdBy: userName,
      createdAt: todayLabel(),
    };
    setActions((current) => [nextAction, ...current]);
    try {
      await addComment(order.id, `${action}${comment ? `: ${comment}` : ''}`, 'internal');
    } catch {
      onNotify?.('Не удалось сохранить заметку');
    }
  };

  const saveRequestDocuments = (nextDocuments: EcoDocument[]) => {
    setDocuments(nextDocuments);
  };

  const changeWorkStatus = async (status: string, comment?: string) => {
    setWorkStatus(status);
    addAction(`Статус работы изменен: ${status}`, comment);
    try {
      const ecologyStatus = status === 'Работа завершена' ? 'done' as const
        : status === 'Ожидаем документы от клиента' ? 'waiting_client_data' as const
        : 'in_progress' as const;
      await updateEcologyStatus(order.id, ecologyStatus, comment);
    } catch {
      onNotify?.('Не удалось обновить статус работы');
    }
    onNotify?.('Статус работы обновлен');
  };

  const submitStatus = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    changeWorkStatus(String(form.get('status')), String(form.get('comment') || ''));
    event.currentTarget.reset();
  };

  const submitClientComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const comment = String(form.get('comment') || '');
    if (!comment.trim()) return;
    await addComment(order.id, comment, 'client');
    addAction('Комментарий клиенту', comment);
    onNotify?.('Комментарий добавлен');
    event.currentTarget.reset();
  };

  const submitProjectDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('file') as File | null;
    if (!file?.name) return;
    const documentType = String(form.get('documentType') || ecoProjectDocumentTypes[0]);
    try {
      await uploadDocument(order.id, file, 'result');
    } catch {
      onNotify?.('Не удалось загрузить документ');
      return;
    }
    const nextDocument: EcoDocument = {
      id: `eco-doc-${Date.now()}`,
      requestId: order.id,
      section: 'projecting',
      documentType,
      fileName: file.name,
      comment: String(form.get('comment') || ''),
      status: 'Черновик',
      uploadedBy: userName,
      uploadedAt: todayLabel(),
    };
    saveRequestDocuments([nextDocument, ...documents]);
    addAction('Загружен проектный документ', `${documentType}: ${file.name}`);
    onNotify?.('Проектный документ загружен');
    event.currentTarget.reset();
  };

  const submitPermitDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('file') as File | null;
    if (!file?.name) return;
    const title = String(form.get('title') || '').trim() || file.name;
    try {
      await uploadDocument(order.id, file, 'result');
    } catch {
      onNotify?.('Не удалось загрузить документ');
      return;
    }
    const nextDocument: EcoDocument = {
      id: `eco-doc-${Date.now()}`,
      requestId: order.id,
      section: 'permit',
      title,
      fileName: file.name,
      comment: String(form.get('comment') || ''),
      status: 'Подготовка',
      uploadedBy: userName,
      uploadedAt: todayLabel(),
    };
    saveRequestDocuments([nextDocument, ...documents]);
    addAction('Загружен документ по разрешению', `${title}: ${file.name}`);
    onNotify?.('Документ по разрешению загружен');
    event.currentTarget.reset();
  };

  const changeDocumentStatus = (documentId: string, status: string) => {
    const nextDocuments = documents.map((doc) => doc.id === documentId ? { ...doc, status } : doc);
    saveRequestDocuments(nextDocuments);
    addAction(`Статус документа изменен: ${status}`, documents.find((doc) => doc.id === documentId)?.fileName);
    onNotify?.('Статус документа обновлен');
  };

  const projectDocuments = documents.filter((doc) => doc.section === 'projecting');
  const permitDocuments = documents.filter((doc) => doc.section === 'permit');
  const clientDocuments = [
    ...order.documents.map((doc) => ({
      id: doc.id,
      title: doc.name,
      fileName: doc.fileUrl || doc.name,
      status: doc.status,
      uploadedAt: doc.uploadedAt,
      uploadedBy: order.contactPerson || order.clientName || 'Клиент',
      comment: '',
    })),
    ...(order.primaryDocuments || []).map((doc) => ({
      id: doc.id,
      title: doc.name,
      fileName: doc.fileName || 'Файл не загружен',
      status: primaryDocumentStatusLabels[doc.status],
      uploadedAt: doc.uploadedAt || 'Нет',
      uploadedBy: order.contactPerson || order.clientName || 'Клиент',
      comment: doc.managerComment || doc.clientComment || '',
    })),
  ];

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="rounded-[22px] bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link to="/staff/orders" className="text-sm font-semibold text-eco-700">← Заявки эколога</Link>
              <h2 className="mt-3 text-2xl font-bold text-eco-900">{order.id} · {getOrderCompanyName(order)}</h2>
              <p className="mt-1 break-words text-sm text-slate-600">{order.service}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ecoBadge(workStatus)}
              {badge(order.status)}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <InfoTile label="Клиент" value={order.contactPerson || order.clientName || 'Не указано'} />
            <InfoTile label="Компания" value={getOrderCompanyName(order)} />
            <InfoTile label="Услуга" value={order.service} />
            <InfoTile label="Дата" value={order.createdAt} />
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto rounded-2xl bg-slate-100 p-1">
            {(['Обзор', 'Проектирование', 'Разрешение'] as EcoTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition ${activeTab === tab ? 'bg-eco-900 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-eco-900'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {activeTab === 'Обзор' && (
        <Reveal>
          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <Section title="Данные заявки" icon={<ClipboardList size={20} />}>
                <div className="grid gap-3 md:grid-cols-2">
                  <InfoTile label="Название компании" value={getOrderCompanyName(order)} />
                  <InfoTile label="БИН / ИИН" value={order.bin || 'Не указано'} />
                  <InfoTile label="Контактное лицо" value={order.contactPerson || order.clientName || 'Не указано'} />
                  <InfoTile label="Телефон" value={order.phone || 'Не указано'} />
                  <InfoTile label="Email" value={order.email || 'Не указано'} />
                  <InfoTile label="Текущий статус работы" value={workStatus} />
                </div>
              </Section>

              <Section title="Документы клиента" icon={<FileText size={20} />}>
                <div className="space-y-3">
                  {clientDocuments.map((doc) => (
                    <div key={doc.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900">{doc.title}</p>
                          <p className="mt-1 break-words text-sm text-slate-600">{doc.fileName}</p>
                          {doc.comment && <p className="mt-2 text-sm text-slate-500">{doc.comment}</p>}
                        </div>
                        {ecoBadge(doc.status)}
                      </div>
                      <p className="mt-3 text-xs font-semibold text-slate-500">{doc.uploadedBy} · {doc.uploadedAt}</p>
                    </div>
                  ))}
                  {!clientDocuments.length && <EmptyState text="Клиентские документы пока не загружены" />}
                </div>
              </Section>

              <Section title="Комментарии и история" icon={<History size={20} />}>
                <div className="space-y-3">
                  {order.comments.map((comment) => (
                    <div key={comment.id} className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm font-bold text-slate-900">{comment.author} · {comment.createdAt}</p>
                      <p className="mt-2 text-sm text-slate-700">{comment.text}</p>
                    </div>
                  ))}
                  {actions.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm font-bold text-slate-900">{item.createdAt} · {item.createdBy}</p>
                      <p className="mt-2 text-sm text-slate-700">{item.action}</p>
                      {item.comment && <p className="mt-1 text-sm text-slate-500">{item.comment}</p>}
                    </div>
                  ))}
                  {order.history.slice(0, 6).map((item) => (
                    <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm font-bold text-slate-900">{item.createdAt} · {actionTypeLabel(item.actionType)}</p>
                      <p className="mt-2 text-sm text-slate-700">{item.text}</p>
                    </div>
                  ))}
                  {!order.comments.length && !actions.length && !order.history.length && <EmptyState text="История по заявке пока пустая" />}
                </div>
              </Section>
            </div>

            <div className="space-y-6">
              <Action title="Действия эколога" icon={<CheckCircle2 size={20} />}>
                <div className="grid gap-3">
                  <Button type="button" onClick={() => changeWorkStatus('Документы приняты', 'Эколог принял документы')}>Принять документы</Button>
                  <Button type="button" variant="secondary" onClick={() => changeWorkStatus('Ожидаем документы от клиента', 'Запрошены недостающие документы')}>Запросить недостающие</Button>
                  <Button type="button" variant="secondary" onClick={() => changeWorkStatus('Требуется исправление', 'Запрошено исправление документов')}>Запросить исправление</Button>
                </div>
                <form onSubmit={submitStatus} className="mt-5 border-t border-slate-100 pt-5">
                  <label className="text-sm font-semibold text-slate-700">Статус работы</label>
                  <select name="status" defaultValue={workStatus} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">
                    {ecoWorkStatuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                  <textarea name="comment" placeholder="Комментарий к статусу" className="input-focus mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={3} />
                  <Button type="submit" className="mt-3 w-full">Изменить статус</Button>
                </form>
                <form onSubmit={submitClientComment} className="mt-5 border-t border-slate-100 pt-5">
                  <label className="text-sm font-semibold text-slate-700">Комментарий клиенту</label>
                  <textarea name="comment" required placeholder="Написать комментарий" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={4} />
                  <Button type="submit" variant="secondary" className="mt-3 w-full">Отправить комментарий</Button>
                </form>
              </Action>
            </div>
          </div>
        </Reveal>
      )}

      {activeTab === 'Проектирование' && (
        <Reveal>
          <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
            <Section title="Загрузка проектного документа" icon={<Upload size={20} />}>
              <form onSubmit={submitProjectDocument} className="space-y-4">
                <Field label="Тип документа">
                  <select name="documentType" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3">
                    {ecoProjectDocumentTypes.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </Field>
                <Field label="Файл">
                  <input name="file" type="file" required className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
                </Field>
                <label className="text-sm font-semibold text-slate-700">Замечание / комментарий к документу
                  <textarea name="comment" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={4} />
                </label>
                <Button type="submit" className="w-full">Загрузить документ</Button>
              </form>
            </Section>
            <EcoDocumentList documents={projectDocuments} statusOptions={ecoProjectDocumentStatuses} onStatusChange={changeDocumentStatus} emptyText="Проектные документы пока не загружены" />
          </div>
        </Reveal>
      )}

      {activeTab === 'Разрешение' && (
        <Reveal>
          <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
            <Section title="Загрузка документа по разрешению" icon={<Upload size={20} />}>
              <form onSubmit={submitPermitDocument} className="space-y-4">
                <Field label="Название документа">
                  <input name="title" required className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" />
                </Field>
                <Field label="Файл">
                  <input name="file" type="file" required className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
                </Field>
                <label className="text-sm font-semibold text-slate-700">Комментарий
                  <textarea name="comment" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={4} />
                </label>
                <Button type="submit" className="w-full">Загрузить документ</Button>
              </form>
            </Section>
            <EcoDocumentList documents={permitDocuments} statusOptions={ecoPermitDocumentStatuses} onStatusChange={changeDocumentStatus} emptyText="Документы по разрешению пока не загружены" />
          </div>
        </Reveal>
      )}
    </div>
  );
};

const EcoWorkDocumentTab = ({ order, userName, mode, onNotify }: { order: Order; userName: string; mode: 'projecting' | 'permit'; onNotify?: (message: string) => void }) => {
  const [documents, setDocuments] = useState<EcoDocument[]>([]);
  const sectionDocuments = documents.filter((doc) => doc.section === mode);

  const saveRequestDocuments = (nextRequestDocuments: EcoDocument[]) => {
    setDocuments(nextRequestDocuments);
  };

  const submitDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('file') as File | null;
    if (!file?.name) return;
    const title = String(form.get('title') || '').trim() || file.name;
    const documentType = String(form.get('documentType') || ecoProjectDocumentTypes[0]);
    try {
      await uploadDocument(order.id, file, 'result');
    } catch {
      onNotify?.('Не удалось загрузить документ');
      return;
    }
    const nextDocument: EcoDocument = {
      id: `eco-doc-${Date.now()}`,
      requestId: order.id,
      section: mode,
      documentType: mode === 'projecting' ? documentType : undefined,
      title: mode === 'permit' ? title : undefined,
      fileName: file.name,
      comment: String(form.get('comment') || ''),
      status: mode === 'projecting' ? 'Черновик' : 'Подготовка',
      uploadedBy: userName,
      uploadedAt: todayLabel(),
    };
    saveRequestDocuments([nextDocument, ...documents]);
    try {
      await addComment(order.id, `${mode === 'projecting' ? 'Загружен проектный документ' : 'Загружен документ по разрешению'}: ${mode === 'projecting' ? documentType : title}: ${file.name}`, 'internal');
    } catch {
      onNotify?.('Не удалось сохранить заметку');
    }
    onNotify?.(mode === 'projecting' ? 'Проектный документ загружен' : 'Документ по разрешению загружен');
    event.currentTarget.reset();
  };

  const changeDocumentStatus = (documentId: string, status: string) => {
    const nextDocuments = documents.map((doc) => doc.id === documentId ? { ...doc, status } : doc);
    saveRequestDocuments(nextDocuments);
    onNotify?.('Статус документа обновлен');
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <Section title={mode === 'projecting' ? 'Загрузка проектного документа' : 'Загрузка документа по разрешению'} icon={<Upload size={20} />}>
        <form onSubmit={submitDocument} className="space-y-4">
          {mode === 'projecting' ? (
            <Field label="Тип документа">
              <select name="documentType" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3">
                {ecoProjectDocumentTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Название документа">
              <input name="title" required className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" />
            </Field>
          )}
          <Field label="Файл">
            <input name="file" type="file" required className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </Field>
          <label className="text-sm font-semibold text-slate-700">{mode === 'projecting' ? 'Замечание / комментарий к документу' : 'Комментарий'}
            <textarea name="comment" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={4} />
          </label>
          <Button type="submit" className="w-full">Загрузить документ</Button>
        </form>
      </Section>
      <EcoDocumentList
        documents={sectionDocuments}
        statusOptions={mode === 'projecting' ? ecoProjectDocumentStatuses : ecoPermitDocumentStatuses}
        onStatusChange={changeDocumentStatus}
        emptyText={mode === 'projecting' ? 'Проектные документы пока не загружены' : 'Документы по разрешению пока не загружены'}
      />
    </div>
  );
};

const EcoDocumentList = ({ documents, statusOptions, onStatusChange, emptyText }: { documents: EcoDocument[]; statusOptions: string[]; onStatusChange: (documentId: string, status: string) => void; emptyText: string }) => (
  <Section title="Загруженные документы" icon={<FileText size={20} />}>
    <div className="space-y-3">
      {documents.map((doc) => (
        <div key={doc.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-slate-900">{doc.documentType || doc.title}</p>
              <p className="mt-1 break-words text-sm text-slate-600">{doc.fileName}</p>
              {doc.comment && <p className="mt-2 text-sm text-slate-500">{doc.comment}</p>}
            </div>
            {ecoBadge(doc.status)}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <InfoTile label="Кто загрузил" value={doc.uploadedBy} />
            <InfoTile label="Дата загрузки" value={doc.uploadedAt} />
            <Field label="Статус документа">
              <select value={doc.status} onChange={(event) => onStatusChange(doc.id, event.target.value)} className="input-focus w-full rounded-2xl border border-slate-200 bg-white px-4 py-3">
                {statusOptions.map((status) => <option key={status}>{status}</option>)}
              </select>
            </Field>
          </div>
        </div>
      ))}
      {!documents.length && <EmptyState text={emptyText} />}
    </div>
  </Section>
);

const Workflow = ({ order }: { order: Order }) => {
  const currentStep = getOverallWorkflowStepIndex(order);
  return (
    <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
      {overallWorkflowSteps.map((label, index) => {
        const done = index <= currentStep && order.status !== 'Отменено';
        const active = index === currentStep && order.status !== 'Отменено';
        return (
        <div key={label} className={`rounded-2xl border p-4 ${active ? 'border-eco-400 bg-eco-900 text-white' : done ? 'border-eco-200 bg-eco-50' : 'border-slate-200 bg-slate-50'}`}>
          <p className={`text-xs font-semibold uppercase ${active ? 'text-white/65' : 'text-slate-500'}`}>Шаг {index + 1}</p>
          <p className={`mt-2 font-bold ${active ? 'text-white' : 'text-slate-900'}`}>{label}</p>
        </div>
        );
      })}
    </div>
  );
};

const ManagerRequestCard = ({ order }: { order: Order }) => {
  const extra = order as Order & { whatsapp?: string; objectAddress?: string };
  const docs = [...order.documents, ...order.resultDocuments];

  return (
    <div className="mb-6 rounded-[22px] border border-eco-100 bg-eco-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-bold text-eco-900">Карточка заявки менеджера</h4>
          <p className="mt-1 text-sm text-slate-600">Контакты, документы, статус и история без финансового редактирования.</p>
        </div>
        {managerPaymentBadge(order)}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InfoTile label="Название компании" value={getOrderCompanyName(order)} />
        <InfoTile label="БИН / ИИН" value={order.bin || 'Не указано'} />
        <InfoTile label="Контактное лицо" value={order.contactPerson || order.clientName || 'Не указано'} />
        <InfoTile label="Телефон" value={order.phone || 'Не указано'} />
        <InfoTile label={<span className="inline-flex items-center gap-1.5"><FaWhatsapp className="text-[#25D366]" size={14} aria-hidden="true" /> WhatsApp</span>} value={extra.whatsapp || order.phone || 'Не указано'} />
        <InfoTile label="Email" value={order.email || 'Не указано'} />
        <InfoTile label="Адрес объекта" value={extra.objectAddress || order.legalAddress || 'Не указано'} />
        <InfoTile label="Выбранная услуга" value={order.service || 'Не указано'} />
        <InfoTile label="Текущий статус" value={getOrderStatusDefinition(order.status).label} />
      </div>
      <div className="mt-4 rounded-2xl bg-white p-4">
        <p className="text-xs font-semibold uppercase text-slate-500">Комментарий клиента</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">{order.comment || 'Комментарий не указан'}</p>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-4">
          <p className="font-bold text-slate-900">Загруженные документы</p>
          <div className="mt-3 space-y-2">
            {docs.map((doc) => (
              <p key={doc.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{doc.name} · {doc.status}</p>
            ))}
            {!docs.length && <p className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-500">Документы пока не загружены</p>}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <p className="font-bold text-slate-900">История действий</p>
          <div className="mt-3 space-y-2">
            {order.history.slice(0, 5).map((item) => (
              <p key={item.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{item.createdAt} · {item.text}</p>
            ))}
            {!order.history.length && <p className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-500">История пока пустая</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

const ManagerPrimaryDocumentsPanel = ({
  order,
  onStatus,
  onRequest,
}: {
  order: Order;
  onStatus: (documentId: string, status: ClientPrimaryDocumentStatus, comment?: string) => void | Promise<void>;
  onRequest: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) => {
  const docs = order.primaryDocuments || [];
  const requestedNames = new Set(docs.map((doc) => doc.name));
  return (
    <div className="mb-6 rounded-[22px] border border-slate-100 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-bold text-eco-900">Первичные документы клиента</h4>
          <p className="mt-1 text-sm text-slate-600">Запросите документы, проверьте загрузки и отправьте комментарий клиенту.</p>
        </div>
        <span className="rounded-full bg-eco-50 px-3 py-1 text-xs font-bold text-eco-800">{docs.filter((doc) => doc.status === 'accepted').length}/{docs.length} принято</span>
      </div>
      <div className="mt-4 space-y-3">
        {docs.map((doc) => (
          <ManagerPrimaryDocumentRow key={doc.id} doc={doc} onStatus={onStatus} />
        ))}
        {!docs.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Документы пока не запрошены</p>}
      </div>
      <form onSubmit={onRequest} className="mt-5 rounded-2xl bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-slate-900">Запросить документы</p>
            <p className="mt-1 text-sm text-slate-500">Можно выбрать сразу несколько пунктов.</p>
          </div>
          <label className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            <input name="required" type="checkbox" defaultChecked /> Обязательные
          </label>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {primaryDocumentTemplates.map((name) => {
            const alreadyRequested = requestedNames.has(name);
            return (
              <label
                key={name}
                className={`flex min-h-[48px] items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  alreadyRequested
                    ? 'cursor-not-allowed border-slate-200 bg-white/60 text-slate-400'
                    : 'cursor-pointer border-slate-200 bg-white text-slate-700 hover:border-eco-200 hover:bg-eco-50'
                }`}
              >
                <input name="documentNames" type="checkbox" value={name} disabled={alreadyRequested} />
                <span>{name}</span>
              </label>
            );
          })}
        </div>
        <label className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            onChange={(event) => {
              const form = event.currentTarget.form;
              form?.querySelectorAll<HTMLInputElement>('input[name="documentNames"]:not(:disabled)').forEach((input) => {
                input.checked = event.currentTarget.checked;
              });
            }}
          />
          Выбрать все незапрошенные
        </label>
        <input name="comment" placeholder="Комментарий для клиента" className="input-focus mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3" />
        <Button type="submit" className="mt-3 w-full">Запросить выбранные документы</Button>
      </form>
    </div>
  );
};

const ManagerPrimaryDocumentRow = ({
  doc,
  onStatus,
}: {
  doc: OrderPrimaryDocument;
  onStatus: (documentId: string, status: ClientPrimaryDocumentStatus, comment?: string) => void | Promise<void>;
}) => {
  const [comment, setComment] = useState(doc.managerComment || '');
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-slate-900">{doc.name}</p>
          <p className="mt-1 text-xs text-slate-500">{doc.required ? 'Обязательный' : 'Необязательный'} · {doc.fileName || 'Файл не загружен'}</p>
          {doc.uploadedAt && <p className="mt-1 text-xs text-slate-500">Загружен: {doc.uploadedAt}</p>}
          {doc.clientComment && <p className="mt-2 text-sm text-slate-600">Комментарий клиента: {doc.clientComment}</p>}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${primaryDocumentStatusClass(doc.status)}`}>{primaryDocumentStatusLabels[doc.status]}</span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Комментарий клиенту" className="input-focus rounded-2xl border border-slate-200 bg-white px-4 py-3" />
        <Button type="button" variant="secondary" disabled={!doc.fileName} onClick={() => onStatus(doc.id, 'accepted', comment)}>Принять документ</Button>
        <Button type="button" variant="secondary" disabled={!doc.fileName} onClick={() => onStatus(doc.id, 'needs_fix', comment)}>Запросить исправление</Button>
      </div>
    </div>
  );
};

const AccountantRequestCard = ({ order }: { order: Order }) => {
  const finance = orderFinance(order);
  const invoice = order.resultDocuments.find((doc) => doc.type === 'invoice');
  const requiredPercent = order.paymentTerms === 'partial_allowed' ? order.minPrepaymentPercent ?? 50 : 100;

  return (
    <div className="mb-6 rounded-[22px] border border-amber-100 bg-amber-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-bold text-eco-900">Карточка бухгалтера</h4>
          <p className="mt-1 text-sm text-slate-600">Счет, оплата, долг и передача специалисту после подтверждения оплаты.</p>
        </div>
        {paymentBadge(order.paymentStatus)}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InfoTile label="Название компании" value={getOrderCompanyName(order)} />
        <InfoTile label="БИН / ИИН" value={order.bin || 'Не указано'} />
        <InfoTile label="Контактное лицо" value={order.contactPerson || order.clientName || 'Не указано'} />
        <InfoTile label="Телефон" value={order.phone || 'Не указано'} />
        <InfoTile label="Email" value={order.email || 'Не указано'} />
        <InfoTile label="Услуга" value={order.service || 'Не указано'} />
        <InfoTile label="Сумма по КП" value={formatCurrency(order.offerAmount || finance.total)} />
        <InfoTile label="Сумма по договору" value={formatCurrency(order.contractAmount || finance.total)} />
        <InfoTile label="Условия оплаты" value={order.paymentTerms === 'partial_allowed' ? `Старт после ${requiredPercent}%` : '100% предоплата'} />
        <InfoTile label="Договор" value={contractLabel(order.crmContractStatus || order.contractStatus)} />
        <InfoTile label="Счет" value={order.invoiceFileName || invoice?.name || order.invoiceNumber || 'Не прикреплен'} />
        <InfoTile label="Оплаченная сумма" value={formatCurrency(finance.paid)} />
        <InfoTile label="Остаток долга" value={formatCurrency(finance.remaining)} />
        <InfoTile label="Процент оплаты" value={`${finance.percent}%`} />
        <InfoTile label="Готово к передаче" value={canTransferToSpecialist(order) ? 'Да' : 'Нет'} />
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
        <div className={`h-full ${finance.remaining > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${finance.percent}%` }} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-4">
          <p className="font-bold text-slate-900">История оплат</p>
          <div className="mt-3 space-y-2">
            {(order.paymentHistory || []).map((item) => (
              <p key={item.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {item.paymentDate} · {formatCurrency(item.paidAmount)} из {formatCurrency(item.totalAmount)} · остаток {formatCurrency(item.remainingAmount)}
              </p>
            ))}
            {!(order.paymentHistory || []).length && <p className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-500">Оплаты пока не зафиксированы</p>}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <p className="font-bold text-slate-900">Комментарии бухгалтера</p>
          <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{order.accountantComment || order.paymentComment || 'Комментариев нет'}</p>
        </div>
      </div>
    </div>
  );
};

const OrderReadiness = ({ order, canViewFinance = false }: { order: Order; canViewFinance?: boolean }) => {
  const contract = contractState(order);
  const payment = paymentState(order, canViewFinance);
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

type StaffSuggestedAction = {
  label: string;
  onClick: () => void | Promise<void>;
  variant: 'primary' | 'secondary' | 'success';
  disabled?: boolean;
};

const StaffConfirmAction = ({ action }: { action: StaffSuggestedAction }) => {
  const [open, setOpen] = useState(false);
  const isDanger = /отмен|отклон|долг/i.test(action.label);
  const isSuccess = action.variant === 'success' || /оплат|передать|готов|заверш/i.test(action.label);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} variant={action.variant} disabled={action.disabled} className="w-full">{action.label}</Button>
      <ConfirmModal
        isOpen={open}
        title={`${action.label}?`}
        description="Действие изменит состояние заявки или связанного процесса."
        confirmText={action.label}
        variant={isDanger ? 'danger' : isSuccess ? 'success' : 'default'}
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          await action.onClick();
          setOpen(false);
        }}
      />
    </>
  );
};

export const StaffNewOrderPage = ({ onNotify }: { onNotify?: (message: string) => void }) => {
  const role = useStaffRole();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  if (!canAccess(role, 'create_order')) return <PermissionDenied permission="create_order" />;
  const submit = async (payload: Parameters<typeof createStaffManualOrder>[0]) => {
    setLoading(true);
    try {
      const order = await createStaffManualOrder(payload);
      toast.success('Заявка создана', 'Статус: Новая заявка.');
      onNotify?.('Заявка создана');
      navigate(order?.id ? `/staff/orders/${order.id}` : '/staff/orders');
    } catch (err) {
      toast.error('Заявка не создана', (err as Error)?.message || 'Backend создания заявки пока может быть не подключен.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <SimpleStaffPage title="Новая заявка">
      <div className="rounded-2xl bg-eco-50 p-4 text-sm font-semibold text-eco-900">
        Создание заявки сотрудником для обращений из WhatsApp, Instagram, звонка или офлайн-канала.
      </div>
      <StaffNewOrderForm loading={loading} onSubmit={submit} />
    </SimpleStaffPage>
  );
};

const StaffPaymentActions = ({ order, onSubmit }: { order: Order; onSubmit: (values: PaymentModalValues) => void | Promise<void> }) => {
  const [mode, setMode] = useState<'partial' | 'full' | null>(null);
  const finance = orderFinance(order);
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-700">Действия с оплатой</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={() => setMode('partial')}>Отметить частичную оплату</Button>
        <Button type="button" onClick={() => setMode('full')}>Отметить полную оплату</Button>
      </div>
      <PaymentModal
        isOpen={Boolean(mode)}
        mode={mode || 'partial'}
        totalAmount={finance.total}
        paidAmount={finance.paid}
        remainingAmount={finance.remaining}
        onClose={() => setMode(null)}
        onSubmit={onSubmit}
      />
    </div>
  );
};

const StaffContractAction = ({ onSubmit }: { onSubmit: (values: ContractModalValues) => void | Promise<void> }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-700">Договор отправляется через модальное окно.</p>
      <Button type="button" className="mt-3" onClick={() => setOpen(true)}>Подготовить договор</Button>
      <ContractModal isOpen={open} onClose={() => setOpen(false)} onSubmit={onSubmit} />
    </div>
  );
};

const StaffUploadDocumentAction = ({ onSubmit }: { onSubmit: (values: UploadDocumentValues) => void | Promise<void> }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" className="w-full" onClick={() => setOpen(true)}>Загрузить документ</Button>
      <UploadDocumentModal
        isOpen={open}
        defaultCategory="work_result"
        allowSendToClient
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
      />
    </>
  );
};

const StaffCommentAction = ({ canSendClient, onSubmit }: { canSendClient: boolean; onSubmit: (values: CommentValues) => void | Promise<void> }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 border-t border-slate-100 pt-5">
      <Button type="button" variant="secondary" className="w-full" onClick={() => setOpen(true)}>Добавить комментарий</Button>
      <CommentModal
        isOpen={open}
        title="Комментарий по заявке"
        defaultVisibility={canSendClient ? 'internal' : 'internal'}
        onClose={() => setOpen(false)}
        onSubmit={(values) => onSubmit(canSendClient ? values : { ...values, visibility: 'internal' })}
      />
    </div>
  );
};

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

const InfoTile = ({ label, value }: { label: ReactNode; value: string }) => (
  <div className="min-w-0 overflow-hidden rounded-2xl bg-slate-50 p-4">
    <p className="text-xs font-semibold uppercase leading-snug text-slate-500">{label}</p>
    <p className="mt-2 break-words text-sm font-semibold leading-snug text-slate-800">{value || 'Не указано'}</p>
  </div>
);

const Grid = ({ items }: { items: Record<string, string> }) => (
  <div className="grid gap-3 md:grid-cols-2">
    {Object.entries(items).map(([key, value]) => (
      <div key={key} className="min-w-0 overflow-hidden rounded-2xl bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase leading-snug text-slate-500">{key}</p>
        <p className="mt-2 break-words text-sm leading-snug text-slate-800">{value || 'Не указано'}</p>
      </div>
    ))}
  </div>
);

const List = ({ title, items }: { title: string; items: string[] }) => (
  <div className="mt-4 first:mt-0">
    <h4 className="font-semibold text-slate-900">{title}</h4>
    <div className="mt-3 space-y-2">
      {items.length ? items.map((item) => <p key={item} className="overflow-hidden rounded-2xl bg-slate-50 p-3 text-sm leading-snug text-slate-700">{item}</p>) : <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">Нет данных</p>}
    </div>
  </div>
);

const ClientSentPrimaryDocuments = ({ order }: { order: Order }) => {
  const documents = (order.primaryDocuments || []).filter((doc) => Boolean(doc.fileName));

  if (!documents.length) {
    return (
      <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
        Клиент еще не отправил первичные документы по этой заявке.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => {
        const fileName = doc.fileName || doc.name;
        const downloadHref = doc.fileUrl || `/api/files/documents/${doc.id}`;

        return (
          <div key={doc.id} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-eco-50 text-eco-800">
                  <FileText size={18} />
                </span>
                <div className="min-w-0">
                  <p className="break-words font-bold text-slate-900">{doc.name}</p>
                  <p className="mt-1 break-words text-sm text-slate-600">{fileName}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{doc.uploadedAt ? `Загружено: ${doc.uploadedAt}` : 'Дата загрузки не указана'}</p>
                  {doc.clientComment && <p className="mt-2 break-words rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{doc.clientComment}</p>}
                </div>
              </div>
            </div>
            <a
              href={downloadHref}
              download={fileName}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-eco-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-eco-800"
            >
              <Download size={16} />
              Скачать
            </a>
          </div>
        );
      })}
    </div>
  );
};

const LaboratoryRequestOverview = ({ order }: { order: Order }) => {
  const laboratoryPrimaryDocuments = order.laboratoryPrimaryDocuments || [];
  const uploadedPrimaryDocuments = (order.primaryDocuments || []).filter((doc) => Boolean(doc.fileName));
  const clientDocuments = order.documents.filter((doc) => doc.type === 'client');
  const allClientDocuments = [
    ...uploadedPrimaryDocuments.map((doc) => ({
      id: `primary-${doc.id}`,
      name: doc.name,
      fileName: doc.fileName || doc.name,
      fileUrl: doc.fileUrl,
      uploadedAt: doc.uploadedAt || 'Дата не указана',
      status: doc.status,
      comment: doc.clientComment,
      source: 'Первичный документ',
    })),
    ...laboratoryPrimaryDocuments.filter((doc) => Boolean(doc.fileName)).map((doc) => ({
      id: `laboratory-primary-${doc.id}`,
      name: doc.name,
      fileName: doc.fileName || doc.name,
      fileUrl: doc.fileUrl,
      uploadedAt: doc.uploadedAt || 'Дата не указана',
      status: laboratoryPrimaryStatusLabels[doc.status],
      comment: doc.employeeComment,
      source: 'Первичный документ лаборатории',
    })),
    ...clientDocuments.map((doc) => ({
      id: `client-${doc.id}`,
      name: doc.name,
      fileName: doc.name,
      fileUrl: doc.fileUrl,
      uploadedAt: doc.uploadedAt || 'Дата не указана',
      status: doc.status,
      comment: '',
      source: 'Документ заявки',
    })),
  ];

  return (
    <div className="space-y-6">
      <Section title="Обзор заявки" icon={<ClipboardCheck size={20} />}>
        <Grid items={{
          Клиент: getOrderCompanyName(order),
          Услуга: order.service,
          Статус: order.status,
          Лаборатория: laboratoryLabel(order.laboratoryStatus),
        }} />
      </Section>

      <Section title="Первичные документы" icon={<Upload size={20} />}>
        <div className="space-y-3">
          {laboratoryPrimaryDocuments.length ? laboratoryPrimaryDocuments.map((doc) => (
            <div key={doc.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-bold text-slate-900">{doc.name}</p>
                  <p className="mt-1 break-words text-sm text-slate-600">{doc.fileName || 'Файл не загружен'}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${laboratoryPrimaryStatusClass(doc.status)}`}>{laboratoryPrimaryStatusLabels[doc.status]}</span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <InfoTile label="Дата загрузки" value={doc.uploadedAt || 'Нет'} />
                <InfoTile label="Кто загрузил" value={doc.uploadedBy || 'Нет'} />
                <InfoTile label="Комментарий" value={doc.employeeComment || 'Нет'} />
              </div>
            </div>
          )) : <EmptyState text="Первичные документы пока не загружены" />}
        </div>
      </Section>

      <Section title="Все документы от клиента" icon={<FileText size={20} />}>
        <div className="space-y-3">
          {allClientDocuments.length ? allClientDocuments.map((doc) => {
            const downloadHref = doc.fileUrl || `/api/files/documents/${doc.id}`;
            return (
              <div key={doc.id} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <p className="break-words font-bold text-slate-900">{doc.name}</p>
                  <p className="mt-1 break-words text-sm text-slate-600">{doc.fileName} · {doc.source}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{doc.uploadedAt} · {doc.status}</p>
                  {doc.comment && <p className="mt-2 break-words rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{doc.comment}</p>}
                </div>
                <a
                  href={downloadHref}
                  download={doc.fileName}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-eco-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-eco-800"
                >
                  <Download size={16} />
                  Скачать
                </a>
              </div>
            );
          }) : <EmptyState text="Клиент пока не отправил документы" />}
        </div>
      </Section>
    </div>
  );
};

const LaboratoryWorkspace = ({
  order,
  canEdit,
  canEditLaboratoryStatus,
  onMeasurementSubmit,
  onSendMeasurement,
  onChangeMeasurementStatus,
  onUploadResult,
  onResultStatus,
  onLaboratoryStatus,
  onSetLaboratoryStatus,
  onAddComment,
}: {
  order: Order;
  canEdit: boolean;
  canEditLaboratoryStatus: boolean;
  onMeasurementSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSendMeasurement: () => void;
  onChangeMeasurementStatus: (status: LaboratoryMeasurementAgreementStatus, comment?: string) => void;
  onUploadResult: (event: FormEvent<HTMLFormElement>, section: LaboratoryResultDocument['section']) => void;
  onResultStatus: (documentId: string, status: LaboratoryResultDocumentStatus) => void;
  onLaboratoryStatus: (event: FormEvent<HTMLFormElement>) => void;
  onSetLaboratoryStatus: (status: LaboratoryStatus, comment: string) => void;
  onAddComment: (event: FormEvent<HTMLFormElement>, visibility: 'client' | 'internal') => void;
}) => {
  return (
    <div className="space-y-6">
      <LaboratoryClientDocumentsSection
        order={order}
        canEdit={canEdit}
        onUpload={onUploadResult}
      />
    </div>
  );
};

const laboratoryTabToSection = (tab: CrmTab): LaboratoryResultDocument['section'] => {
  if (tab === '870 форма') return 'form_870';
  if (tab === 'База отчёт') return 'base_report';
  if (tab === 'Квартальный отчёт') return 'quarter_report';
  if (tab === 'Годовой отчёт') return 'annual_report';
  if (tab === 'Полугодовой отчёт') return 'half_year_report';
  if (tab === 'Архив отчёт') return 'archive_report';
  return 'protocol';
};

const laboratoryClientDocumentTypes: Array<{ section: LaboratoryResultDocument['section']; label: string }> = [
  { section: 'measurement', label: laboratoryResultSectionLabels.measurement },
  { section: 'protocol', label: laboratoryResultSectionLabels.protocol },
  { section: 'form_870', label: laboratoryResultSectionLabels.form_870 },
  { section: 'base_report', label: laboratoryResultSectionLabels.base_report },
  { section: 'quarter_report', label: laboratoryResultSectionLabels.quarter_report },
  { section: 'annual_report', label: laboratoryResultSectionLabels.annual_report },
  { section: 'half_year_report', label: laboratoryResultSectionLabels.half_year_report },
  { section: 'archive_report', label: laboratoryResultSectionLabels.archive_report },
];

const LaboratoryClientDocumentsSection = ({
  order,
  canEdit,
  onUpload,
}: {
  order: Order;
  canEdit: boolean;
  onUpload: (event: FormEvent<HTMLFormElement>, section: LaboratoryResultDocument['section']) => void;
}) => {
  const currentQuarter = getCurrentQuarterForRequest(order);
  const [selectedSection, setSelectedSection] = useState<LaboratoryResultDocument['section']>('measurement');
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterNumber>(currentQuarter?.quarter || 1);
  const selectedLabel = laboratoryResultSectionLabels[selectedSection];

  return (
    <Section title="Документы клиенту" icon={<FileText size={20} />}>
      {canEdit && (
        <form onSubmit={(event) => onUpload(event, selectedSection)} className="grid gap-4 rounded-2xl border border-dashed border-slate-200 p-4 lg:grid-cols-[1fr_280px]">
          <input type="hidden" name="status" value="published_to_client" />
          {selectedSection !== 'quarter_report' && <input type="hidden" name="quarter" value="" />}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Название документа">
              <input
                key={`document-name-${selectedSection}-${selectedQuarter}`}
                name="name"
                defaultValue={selectedSection === 'quarter_report' ? `${selectedLabel} ${selectedQuarter} квартал` : selectedLabel}
                className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
            </Field>
            <Field label="Файлы">
              <input name="file" type="file" multiple required className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
            </Field>
            {selectedSection === 'quarter_report' && (
              <Field label="Квартал">
                <select
                  name="quarter"
                  value={selectedQuarter}
                  onChange={(event) => setSelectedQuarter(toQuarterNumber(event.target.value) || 1)}
                  className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3"
                >
                  {quarterNumbers.map((quarter) => <option key={quarter} value={quarter}>{quarter} квартал</option>)}
                </select>
              </Field>
            )}
            <label className="text-sm font-semibold text-slate-700 md:col-span-2">Комментарий
              <textarea name="comment" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" rows={3} />
            </label>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-2xl bg-slate-50 p-4">
            <Field label="Тип документа">
              <select
                value={selectedSection}
                onChange={(event) => setSelectedSection(event.target.value as LaboratoryResultDocument['section'])}
                className="input-focus w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                {laboratoryClientDocumentTypes.map(({ section, label }) => <option key={section} value={section}>{label}</option>)}
              </select>
            </Field>
            <Button>
              <Send size={16} />
              Отправить
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
};

const LaboratoryQuarterlyReportSection = ({
  order,
  canEdit,
  onUpload,
  onStatus,
}: {
  order: Order;
  canEdit: boolean;
  onUpload: (event: FormEvent<HTMLFormElement>, section: LaboratoryResultDocument['section']) => void;
  onStatus: (documentId: string, status: LaboratoryResultDocumentStatus) => void;
}) => {
  const currentQuarter = getCurrentQuarterForRequest(order);
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterNumber>(currentQuarter?.quarter || 1);
  const section: LaboratoryResultDocument['section'] = 'quarter_report';
  const allDocuments = (order.laboratoryResultDocuments || []).filter((doc) => doc.section === section);
  const documents = allDocuments.filter((doc) => (doc.quarter || 1) === selectedQuarter);

  return (
    <Section title="Документы клиенту: Квартальный отчёт" icon={<FileText size={20} />}>
      <div className="grid gap-3 md:grid-cols-4">
        {quarterNumbers.map((quarter) => {
          const count = allDocuments.filter((doc) => (doc.quarter || 1) === quarter).length;
          return (
            <button
              key={quarter}
              type="button"
              onClick={() => setSelectedQuarter(quarter)}
              className={`rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${
                selectedQuarter === quarter
                  ? 'bg-eco-900 text-white shadow-lg shadow-eco-900/10'
                  : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-eco-50 hover:text-eco-900'
              }`}
            >
              <span>{quarter} квартал</span>
              <span className={`mt-1 block text-xs ${selectedQuarter === quarter ? 'text-white/75' : 'text-slate-500'}`}>{count} документов</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <InfoTile label="Выбранный квартал" value={`${selectedQuarter} квартал`} />
        <InfoTile label="Документов" value={String(documents.length)} />
        <InfoTile label="Отправлено клиенту" value={String(documents.filter((doc) => doc.status === 'published_to_client').length)} />
      </div>

      <div className="mt-5 space-y-3">
        {documents.map((doc) => (
          <div key={doc.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-slate-900">{doc.name}</p>
                <p className="mt-1 text-sm text-slate-500">{doc.fileName || 'Файл не указан'} · {doc.uploadedAt || doc.readyAt || 'дата не указана'}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${laboratoryResultStatusClass(doc.status)}`}>{laboratoryResultStatusLabels[doc.status]}</span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <InfoTile label="Квартал" value={`${doc.quarter || selectedQuarter} квартал`} />
              <InfoTile label="Загрузил" value={doc.uploadedBy || 'Нет'} />
              <InfoTile label="Публикация" value={doc.publishedAt || 'Нет'} />
            </div>
            {canEdit && (
              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={() => onStatus(doc.id, 'ready')}>Готов к отправке</Button>
                <Button type="button" onClick={() => onStatus(doc.id, 'published_to_client')}>
                  <Send size={16} />
                  Отправить клиенту
                </Button>
                <Button type="button" variant="secondary" onClick={() => onStatus(doc.id, 'archived')}>В архив</Button>
              </div>
            )}
            {doc.history?.length > 0 && <List title="История" items={formatLaboratoryHistory(doc.history)} />}
          </div>
        ))}
        {!documents.length && <EmptyState text="Документы по выбранному кварталу пока не загружены" />}
      </div>

      {canEdit && (
        <form onSubmit={(event) => onUpload(event, section)} className="mt-5 grid gap-4 rounded-2xl border border-dashed border-slate-200 p-4 md:grid-cols-2">
          <input type="hidden" name="quarter" value={selectedQuarter} />
          <Field label="Название документов">
            <input name="name" defaultValue={`Квартальный отчёт ${selectedQuarter} квартал`} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </Field>
          <Field label="Статус">
            <select name="status" defaultValue="published_to_client" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3">
              {(['ready', 'published_to_client'] as LaboratoryResultDocumentStatus[]).map((status) => <option key={status} value={status}>{status === 'published_to_client' ? 'Сразу отправить клиенту' : 'Готов к отправке'}</option>)}
            </select>
          </Field>
          <Field label="Файлы">
            <input name="file" type="file" multiple required className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </Field>
          <Field label="Комментарий">
            <input name="comment" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </Field>
          <Button className="md:col-span-2">Загрузить документы квартала</Button>
        </form>
      )}
    </Section>
  );
};

const LaboratoryResultSection = ({
  order,
  tab,
  canEdit,
  onUpload,
  onStatus,
}: {
  order: Order;
  tab: CrmTab;
  canEdit: boolean;
  onUpload: (event: FormEvent<HTMLFormElement>, section: LaboratoryResultDocument['section']) => void;
  onStatus: (documentId: string, status: LaboratoryResultDocumentStatus) => void;
}) => {
  const section = laboratoryTabToSection(tab);
  const documents = (order.laboratoryResultDocuments || []).filter((doc) => doc.section === section);
  return (
    <Section title={`Документы клиенту: ${laboratoryResultSectionLabels[section]}`} icon={<FileText size={20} />}>
      <div className="grid gap-3 md:grid-cols-3">
        <InfoTile label="Документов" value={String(documents.length)} />
        <InfoTile label="Отправлено клиенту" value={String(documents.filter((doc) => doc.status === 'published_to_client').length)} />
        <InfoTile label="Готово к отправке" value={String(documents.filter((doc) => doc.status === 'ready').length)} />
      </div>

      <div className="mt-5 space-y-3">
        {documents.map((doc) => (
          <div key={doc.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-slate-900">{doc.name}</p>
                <p className="mt-1 text-sm text-slate-500">{doc.fileName || 'Файл не указан'} · {doc.uploadedAt || doc.readyAt || 'дата не указана'}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${laboratoryResultStatusClass(doc.status)}`}>{laboratoryResultStatusLabels[doc.status]}</span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <InfoTile label="Загрузил" value={doc.uploadedBy || 'Нет'} />
              <InfoTile label="Готовность" value={doc.readyAt || 'Нет'} />
              <InfoTile label="Публикация" value={doc.publishedAt || 'Нет'} />
            </div>
            {canEdit && (
              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={() => onStatus(doc.id, 'ready')}>Готов к отправке</Button>
                <Button type="button" onClick={() => onStatus(doc.id, 'published_to_client')}>
                  <Send size={16} />
                  Отправить клиенту
                </Button>
                <Button type="button" variant="secondary" onClick={() => onStatus(doc.id, 'archived')}>В архив</Button>
              </div>
            )}
            {doc.history?.length > 0 && <List title="История" items={formatLaboratoryHistory(doc.history)} />}
          </div>
        ))}
        {!documents.length && <EmptyState text="Документы для отправки клиенту пока не загружены" />}
      </div>

      {canEdit && (
        <form onSubmit={(event) => onUpload(event, section)} className="mt-5 grid gap-4 rounded-2xl border border-dashed border-slate-200 p-4 md:grid-cols-2">
          <Field label="Название документа">
            <input name="name" defaultValue={laboratoryResultSectionLabels[section]} className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </Field>
          <Field label="Статус">
            <select name="status" defaultValue="published_to_client" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3">
              {(['ready', 'published_to_client'] as LaboratoryResultDocumentStatus[]).map((status) => <option key={status} value={status}>{status === 'published_to_client' ? 'Сразу отправить клиенту' : 'Готов к отправке'}</option>)}
            </select>
          </Field>
          <Field label="Файл">
            <input name="file" type="file" required className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </Field>
          <Field label="Комментарий">
            <input name="comment" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </Field>
          <Button className="md:col-span-2">Загрузить документ клиенту</Button>
        </form>
      )}
    </Section>
  );
};

export const StaffClientsPage = () => {
  const { orders, refresh } = useOrders();
  const toast = useToast();
  const navigate = useNavigate();
  const { companyKey: selectedKeyParam } = useParams();
  const [q, setQ] = useState('');
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [createResult, setCreateResult] = useState<{ email: string; password: string } | null>(null);
  const [createError, setCreateError] = useState('');
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
  const selectedContracts: ClientContract[] = [];
  const latestOrder = [...selectedOrders].sort((a, b) => b.id.localeCompare(a.id))[0];

  const newOrderUrl = (order?: Order, companyName = selectedCompany?.name || '') => {
    const params = new URLSearchParams();
    if (order?.clientId) params.set('clientId', order.clientId);
    if (order?.clientName || order?.contactPerson) params.set('clientName', order.contactPerson || order.clientName);
    if (order?.companyName || companyName) params.set('companyName', order?.companyName || companyName);
    if (order?.bin) params.set('bin', order.bin);
    if (order?.phone) params.set('phone', order.phone);
    if (order?.whatsapp) params.set('whatsapp', order.whatsapp);
    if (order?.email) params.set('email', order.email);
    return `/staff/orders/new${params.toString() ? `?${params.toString()}` : ''}`;
  };

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
              <div className="flex flex-wrap gap-2">
                <Link to={newOrderUrl(latestOrder, selectedCompany.name)} className="rounded-full bg-eco-900 px-4 py-3 text-sm font-bold text-white">Создать заявку</Link>
                <Link to="/staff/orders" className="rounded-full bg-eco-50 px-4 py-3 text-sm font-bold text-eco-800">Все заявки</Link>
              </div>
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
            <Section title="Договоры сопровождения" icon={<FileSignature size={20} />}>
              <div className="grid gap-3 lg:grid-cols-2">
                {selectedContracts.map((contract) => <StaffContractLine key={contract.id} contract={contract} />)}
                {!selectedContracts.length && <EmptyState text="Договоров нет" />}
              </div>
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

  const handleCreateClient = async (values: CreateClientModalValues) => {
    setCreateError('');
    const payload: CreateClientPayload = {
      email: values.email,
      phone: values.phone,
      companyName: values.companyName,
      binIin: values.bin,
      contactPerson: values.contactPerson,
      legalAddress: values.address,
      clientType: values.companyName ? 'company' : 'individual',
    };
    try {
      const result = await createClient(payload);
      setCreateResult({ email: result.email, password: result.tempPassword });
      toast.success('Клиент создан', 'Теперь менеджер может оформить заявку от клиента.');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Не удалось создать клиента';
      setCreateError(message);
      toast.error('Ошибка', message);
      throw err;
    }
  };

  return (
    <Reveal>
      <div className="rounded-[22px] bg-white p-6 shadow-sm">
        <div className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-bold text-eco-900">Компании</h2>
            <button type="button" onClick={() => { setShowCreateClient(true); setCreateResult(null); setCreateError(''); }} className="rounded-full bg-eco-900 px-5 py-3 text-sm font-bold text-white hover:bg-eco-800">+ Создать клиента</button>
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск компании" className="input-focus mt-4 w-full max-w-xl rounded-2xl border border-slate-200 px-4 py-3" />
        </div>

        <CreateClientModal isOpen={showCreateClient} onClose={() => { setShowCreateClient(false); refresh(); }} onSubmit={handleCreateClient} />
        {createResult && (
          <div className="mb-5 rounded-2xl bg-eco-50 p-4 text-sm text-eco-900">
            <p className="font-bold">Клиент создан. Данные для входа:</p>
            <p className="mt-1">Email: {createResult.email}</p>
            <p>Пароль: {createResult.password}</p>
          </div>
        )}
        {createError && <p className="mb-5 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{createError}</p>}
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredCompanies.map((company) => {
            const companyOrders = orders.filter((order) => companyKey(getOrderCompanyName(order)) === company.key);
            const last = [...companyOrders].sort((a, b) => b.id.localeCompare(a.id))[0];
            const nearestContract = undefined as ClientContract | undefined;
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
                {nearestContract && (
                  <p className="mt-3 rounded-2xl bg-white p-3 text-xs font-bold text-eco-900">
                    Ближайший договор: {formatContractDaysLeft(nearestContract)} · {nearestContract.number}
                  </p>
                )}
                <p className="mt-3 text-xs font-semibold text-slate-500">Последняя: {lastOrderDate(companyOrders)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(newOrderUrl(last, company.name));
                    }}
                    className="rounded-full bg-eco-900 px-4 py-2 text-xs font-bold text-white"
                  >
                    Создать заявку
                  </button>
                  <span className="rounded-full bg-white px-4 py-2 text-xs font-bold text-eco-800">Открыть карточку</span>
                </div>
              </Link>
            );
          })}
          {!filteredCompanies.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Компаний нет</p>}
        </div>
      </div>
    </Reveal>
  );
};

const documentHref = (doc: StaffDocument) =>
  doc.fileUrl || `/api/files/documents/${doc.id}`;

const DocumentLine = ({ doc }: { doc: StaffDocument }) => (
  <div className="grid items-center gap-3 rounded-2xl bg-slate-50 p-4 lg:grid-cols-[1.6fr_1.1fr_0.8fr_0.9fr_auto]">
    <div className="min-w-0">
      <p className="break-words font-bold text-slate-900">{doc.name}</p>
      <p className="mt-1 text-sm text-slate-500">{doc.company}</p>
    </div>
    <div className="text-sm text-slate-600">
      <p className="font-semibold text-slate-800">{doc.orderId}</p>
      <p>{doc.orderService}</p>
    </div>
    <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800">{doc.docType}</span>
    <div className="text-sm text-slate-600">
      <p>{doc.status}</p>
      <p>{doc.uploadedAt}</p>
    </div>
    <Link to={`/staff/documents/${doc.orderId}`} className="inline-flex justify-center rounded-full bg-eco-900 px-4 py-2 text-xs font-bold text-white">Открыть</Link>
  </div>
);

const DocumentFileRow = ({ doc }: { doc: StaffDocument }) => (
  <div className="grid items-center gap-3 rounded-2xl bg-slate-50 p-4 lg:grid-cols-[1.7fr_0.8fr_0.8fr_auto]">
    <div className="min-w-0">
      <p className="break-words font-bold text-slate-900">{doc.name}</p>
      <p className="mt-1 text-sm text-slate-500">{doc.uploadedBy} · {doc.uploadedAt}</p>
    </div>
    <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800">{doc.docType}</span>
    <p className="text-sm font-semibold text-slate-700">{doc.status}</p>
    <div className="flex flex-wrap gap-2">
      <a href={documentHref(doc)} target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-eco-800 transition hover:bg-white">Посмотреть</a>
      <a href={documentHref(doc)} download={doc.name} className="rounded-full bg-eco-900 px-4 py-2 text-xs font-bold text-white">Скачать</a>
    </div>
  </div>
);

export const StaffDocumentsPage = () => {
  const { orders } = useOrders();
  const { orderId } = useParams();
  const [q, setQ] = useState('');
  const [company, setCompany] = useState('Все');
  const [type, setType] = useState('Все');
  const [status, setStatus] = useState('Все');
  const completedOrders = useMemo(() => orders.filter((order) => ['Готово', 'Завершено'].includes(order.status)), [orders]);
  const docs = useMemo(() => collectDocuments(completedOrders), [completedOrders]);
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
  const selectedOrder = orderId ? completedOrders.find((order) => order.id === orderId) : undefined;
  const selectedDocs = selectedOrder ? collectDocuments([selectedOrder]) : [];

  if (orderId) {
    if (!selectedOrder) {
      return (
        <Reveal>
          <div className="rounded-[22px] bg-white p-6 shadow-sm">
            <Link to="/staff/documents" className="text-sm font-bold text-eco-700">← Документы</Link>
            <EmptyState text="Завершённая заявка не найдена" />
          </div>
        </Reveal>
      );
    }

    return (
      <Reveal>
        <div className="rounded-[22px] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link to="/staff/documents" className="text-sm font-bold text-eco-700">← Документы</Link>
              <h2 className="mt-3 text-3xl font-bold text-eco-900">{selectedOrder.id} · {getOrderCompanyName(selectedOrder)}</h2>
              <p className="mt-2 text-sm text-slate-500">{selectedOrder.service}</p>
            </div>
            {badge(selectedOrder.status)}
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <InfoTile label="Компания" value={getOrderCompanyName(selectedOrder)} />
            <InfoTile label="Контакт" value={selectedOrder.contactPerson || selectedOrder.clientName} />
            <InfoTile label="Дата" value={selectedOrder.createdAt} />
            <InfoTile label="Документы" value={String(selectedDocs.length)} />
          </div>

          <div className="mt-6 space-y-3">
            {selectedDocs.map((doc) => <DocumentFileRow key={doc.id} doc={doc} />)}
            {!selectedDocs.length && <EmptyState text="Документов нет" />}
          </div>
        </div>
      </Reveal>
    );
  }

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
              <div className="mt-3 space-y-2">
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

export const StaffCommercialOffersPage = () => {
  const { orders } = useOrders();
  const offers = useMemo(() => orders.filter((order) => ['Подготовка КП', 'КП отправлено', 'КП согласовано', 'Подготовка договора', 'Договор отправлен', 'Ожидаем подпись договора', 'Договор подписан', 'Передано бухгалтеру', 'КП', 'Договор', 'Счет на оплату'].includes(order.status)), [orders]);
  const activeOffers = offers.filter((order) => order.status === 'Подготовка КП' || order.status === 'КП').length;

  return (
    <SimpleStaffPage title="КП">
      <div className="grid gap-3 md:grid-cols-3">
        <InfoTile label="В работе" value={String(activeOffers)} />
        <InfoTile label="На согласовании" value={String(offers.filter((order) => ['КП отправлено', 'КП согласовано'].includes(order.status)).length)} />
        <InfoTile label="Переданы бухгалтеру" value={String(offers.filter((order) => ['Передано бухгалтеру', 'Счет на оплату'].includes(order.status)).length)} />
      </div>
      <div className="mt-5 space-y-3">
        {offers.map((order) => (
          <Link key={order.id} to={`/staff/orders/${order.id}`} className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-eco-50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-slate-900">{order.id} · {getOrderCompanyName(order)}</p>
                <p className="mt-1 break-words text-sm text-slate-600">{order.service}</p>
                <p className="mt-2 text-xs font-semibold text-eco-700">{getNextCrmStep(order)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {badge(order.status)}
                {paymentBadge(order.paymentStatus)}
              </div>
            </div>
          </Link>
        ))}
        {!offers.length && <EmptyState text="КП нет" />}
      </div>
    </SimpleStaffPage>
  );
};

export const StaffContractsPage = () => {
  const { orders } = useOrders();
  const orderContracts = useMemo(() => orders.filter((order) => order.contractId || ['Подготовка договора', 'Договор отправлен', 'Ожидаем подпись договора', 'Договор подписан', 'Передано бухгалтеру', 'Договор', 'Счет на оплату', 'annual_active'].includes(order.status)), [orders]);

  return (
    <SimpleStaffPage title="Договоры">
      <div className="grid gap-3 md:grid-cols-4">
        <InfoTile label="По заявкам" value={String(orderContracts.length)} />
      </div>
      <Section title="Договоры сопровождения" icon={<FileSignature size={20} />}>
        <EmptyState text="Договоры сопровождения пока не созданы" />
      </Section>
      <Section title="Договоры по заявкам" icon={<ClipboardList size={20} />}>
        <div className="space-y-3">
          {orderContracts.map((order) => (
            <Link key={order.id} to={`/staff/orders/${order.id}`} className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-eco-50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{getPrimaryContractForOrder(order)?.number || order.contractId || order.id}</p>
                  <p className="mt-1 break-words text-sm text-slate-600">{getOrderCompanyName(order)} · {order.service}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {badge(order.status)}
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800">{contractLabel(order.crmContractStatus || order.contractStatus)}</span>
                </div>
              </div>
            </Link>
          ))}
          {!orderContracts.length && <EmptyState text="Договоров по заявкам нет" />}
        </div>
      </Section>
    </SimpleStaffPage>
  );
};

export const StaffTasksPage = () => {
  const { orders } = useOrders();
  const role = useStaffRole();
  const toast = useToast();
  const [remoteTasks, setRemoteTasks] = useState<Awaited<ReturnType<typeof getTasks>>>([]);
  useEffect(() => {
    getTasks().then(setRemoteTasks);
  }, []);
  const tasks = useMemo(() => buildMyTasks(orders, role), [orders, role]);
  const createTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await saveTask({
      orderId: String(form.get('orderId') || ''),
      title: String(form.get('title') || ''),
      responsibleId: String(form.get('responsibleId') || ''),
      status: 'new',
      priority: String(form.get('priority') || 'normal') as never,
      dueDate: String(form.get('dueDate') || ''),
      comment: String(form.get('comment') || ''),
    });
    toast.success('Задача сохранена', 'Если backend пока не подключен, форма уже готова к интеграции.');
    event.currentTarget.reset();
    getTasks().then(setRemoteTasks);
  };

  return (
    <SimpleStaffPage title="Задачи">
      <div className="grid gap-3 md:grid-cols-3">
        <InfoTile label="Всего" value={String(tasks.length)} />
        <InfoTile label="Срочно" value={String(tasks.filter((task) => task.priority === 'Срочно').length)} />
        <InfoTile label="Роль" value={roleTitle(role)} />
      </div>
      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {remoteTasks.map((task) => (
          <div key={task.id} className="rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">{task.title}</p>
                <p className="mt-1 text-sm text-slate-500">Заявка: {task.orderId} · срок: {task.dueDate || 'не указан'}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800">{task.status}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => updateTaskStatus(task.id, 'in_progress').then(() => toast.success('Задача в работе'))}>В работу</Button>
              <Button type="button" onClick={() => updateTaskStatus(task.id, 'done').then(() => toast.success('Задача завершена'))}>Завершить</Button>
              <Button type="button" variant="secondary" onClick={() => updateTaskStatus(task.id, 'cancelled').then(() => toast.success('Задача отменена'))}>Отменить</Button>
            </div>
          </div>
        ))}
        {tasks.map((task) => <WorkTaskCard key={task.id} task={task} />)}
        {!tasks.length && !remoteTasks.length && <EmptyState text="Задач нет" />}
      </div>
      {(role === 'ADMIN' || role === 'DIRECTOR' || role === 'HEAD' || canAccess(role, 'edit_tasks')) && (
        <form onSubmit={createTask} className="mt-5 grid gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
          <Field label="Заявка"><input name="orderId" required className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
          <Field label="Название"><input name="title" required className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
          <Field label="Ответственный"><input name="responsibleId" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
          <Field label="Приоритет"><select name="priority" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3"><option value="normal">Обычный</option><option value="high">Высокий</option><option value="urgent">Срочный</option><option value="low">Низкий</option></select></Field>
          <Field label="Срок"><input name="dueDate" type="date" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
          <Field label="Комментарий"><input name="comment" className="input-focus w-full rounded-2xl border border-slate-200 px-4 py-3" /></Field>
          <Button>Создать задачу</Button>
        </form>
      )}
    </SimpleStaffPage>
  );
};

export const StaffCalendarPage = () => {
  const role = useStaffRole();
  const { orders } = useOrders();
  const [remoteEvents, setRemoteEvents] = useState<Awaited<ReturnType<typeof getStaffCalendar>>>([]);
  const [view, setView] = useState<'today' | 'week' | 'month' | 'all' | 'overdue' | 'rescheduled'>('today');
  useEffect(() => {
    getStaffCalendar().then(setRemoteEvents);
  }, []);
  if (!canAccess(role, 'view_calendar') && role !== 'ADMIN' && role !== 'DIRECTOR' && role !== 'HEAD') return <PermissionDenied permission="view_calendar" />;
  const generatedEvents: StaffCalendarEvent[] = orders.flatMap((order) => {
    const items: StaffCalendarEvent[] = [];
    if (order.laboratoryMeasurementAgreement?.measurementDate) {
      items.push({
        id: `${order.id}-lab`,
        orderId: order.id,
        type: 'laboratory' as const,
        title: `Замер: ${order.service}`,
        date: order.laboratoryMeasurementAgreement.measurementDate,
        time: order.laboratoryMeasurementAgreement.measurementTime,
        address: order.laboratoryMeasurementAgreement.address,
        contactPerson: order.laboratoryMeasurementAgreement.contactPerson,
        measurementType: order.laboratoryMeasurementAgreement.measurementScope,
        status: order.laboratoryMeasurementAgreement.status === 'reschedule_requested' ? 'rescheduled' as const : 'planned' as const,
      });
    }
    if (['Вывоз', 'Утилизация'].includes(order.status)) {
      items.push({
        id: `${order.id}-waste`,
        orderId: order.id,
        type: 'waste' as const,
        title: `Вывоз / утилизация: ${order.service}`,
        date: order.deadline || order.updatedAt || order.createdAt,
        address: order.objectAddress || order.legalAddress,
        executor: order.assignedEcologist || order.manager,
        status: 'planned' as const,
      });
    }
    return items;
  });
  const today = new Date().toISOString().slice(0, 10);
  const events = [...remoteEvents, ...generatedEvents].filter((event) => {
    if (view === 'today') return event.date === today;
    if (view === 'overdue') return event.date < today && event.status !== 'completed';
    if (view === 'rescheduled') return event.status === 'rescheduled';
    return true;
  });
  const views = [
    ['today', 'Сегодня'],
    ['week', 'Неделя'],
    ['month', 'Месяц'],
    ['all', 'Все выезды'],
    ['overdue', 'Просроченные'],
    ['rescheduled', 'Переносы от клиента'],
  ] as const;
  return (
    <SimpleStaffPage title="Календарь">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {views.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setView(key)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${view === key ? 'bg-eco-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{label}</button>
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {events.map((event) => (
          <Link key={event.id} to={event.orderId ? `/staff/orders/${event.orderId}` : '/staff/calendar'} className="block rounded-2xl bg-slate-50 p-4 transition hover:bg-eco-50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">{event.title}</p>
                <p className="mt-1 text-sm text-slate-600">{event.date} {event.time || ''}</p>
                <p className="mt-1 text-sm text-slate-500">{event.address || 'Адрес не указан'}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800">{event.type === 'laboratory' ? 'Лаборатория' : event.type === 'waste' ? 'Вывоз' : 'Задача'}</span>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
              {event.contactPerson && <span>Контакт: {event.contactPerson}</span>}
              {event.measurementType && <span>Тип замера: {event.measurementType}</span>}
              {event.transport && <span>Транспорт: {event.transport}</span>}
              {event.executor && <span>Исполнитель: {event.executor}</span>}
            </div>
          </Link>
        ))}
        {!events.length && <EmptyState text="Событий нет" />}
      </div>
    </SimpleStaffPage>
  );
};

export const StaffReportsPage = () => {
  const { orders } = useOrders();
  const docs = useMemo(() => collectDocuments(orders), [orders]);
  const companies = useMemo(() => buildCompanySummaries(orders), [orders]);
  const active = orders.filter((order) => !isClosedOrder(order)).length;
  const completed = orders.filter((order) => ['Готово', 'Завершено'].includes(order.status)).length;
  const paid = orders.filter((order) => fallbackPaymentStatus(order.paymentStatus) === 'paid').length;
  const debt = orders.filter((order) => order.quarters?.some((quarter) => quarter.remainingAmount > 0)).length;

  return (
    <SimpleStaffPage title="Отчеты">
      <div className="grid gap-3 md:grid-cols-4">
        <InfoTile label="Заявки" value={String(orders.length)} />
        <InfoTile label="В работе" value={String(active)} />
        <InfoTile label="Готово" value={String(completed)} />
        <InfoTile label="Есть долг" value={String(debt)} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Воронка CRM" icon={<ClipboardList size={20} />}>
          <div className="space-y-2">
            {roleStats(orders, 'ADMIN').map(([label, value]) => <ReportRow key={label} label={label} value={value} total={orders.length} />)}
          </div>
        </Section>
        <Section title="Клиенты и документы" icon={<FileText size={20} />}>
          <div className="space-y-2">
            <ReportRow label="Клиенты" value={companies.length} total={Math.max(companies.length, 1)} />
            <ReportRow label="Документы" value={docs.length} total={Math.max(docs.length, 1)} />
            <ReportRow label="Оплачено" value={paid} total={orders.length} />
            <ReportRow label="Договоры сопровождения" value={0} total={1} />
          </div>
        </Section>
      </div>
    </SimpleStaffPage>
  );
};

export const StaffUserRolesPage = () => {
  const role = useStaffRole();
  if (!canAccess(role, 'manage_roles') && !canAccess(role, 'manage_employees')) return <PermissionDenied permission="manage_roles" />;

  return (
    <SimpleStaffPage title="Роли пользователей">
      <div className="grid gap-3 md:grid-cols-3">
        <InfoTile label="Пользователи" value="—" />
        <InfoTile label="Роли" value="8" />
        <InfoTile label="Текущая роль" value={roleTitle(role)} />
      </div>
      {!canAccess(role, 'manage_roles') && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Доступ руководителя открыт для просмотра сотрудников. Техническое управление ролями остается у администратора.
        </div>
      )}
      <div className="mt-5 space-y-3">
        <EmptyState text="Список сотрудников пока пуст" />
      </div>
    </SimpleStaffPage>
  );
};

const ReportRow = ({ label, value, total }: { label: string; value: number; total: number }) => {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-slate-800">{label}</p>
        <p className="text-sm font-bold text-eco-900">{value}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
};

const StaffUserRoleRow = ({ user }: { user: User }) => {
  const permissions = permissionsForRole(user.role);
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-slate-900">{user.name}</p>
          <p className="mt-1 text-sm text-slate-600">{user.email} · {user.position || 'Должность не указана'}</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800">{roleTitle(user.role)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {permissions.map((permission) => <span key={permission} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{permission}</span>)}
      </div>
    </div>
  );
};

export const StaffNotificationsPage = () => {
  const { orders } = useOrders();
  const role = useStaffRole();
  const generated = buildRoleNotifications(orders, role);
  return (
    <SimpleStaffPage title="Уведомления">
      {generated.map((item) => <NotificationLine key={item.id} notification={item} />)}
      
    </SimpleStaffPage>
  );
};

export const StaffProfilePage = () => {
  const { user, logout } = useAuth();
  const role = useStaffRole();
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
