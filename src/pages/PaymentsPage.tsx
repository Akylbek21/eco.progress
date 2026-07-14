import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CreditCard, ReceiptText, WalletCards, X, type LucideIcon } from 'lucide-react';
import Button from '../components/ui/Button';
import BackendFeatureUnavailable from '../components/ui/BackendFeatureUnavailable';
import Reveal from '../components/animations/Reveal';
import { CommentModal, ConfirmModal, PaymentModal, type CommentValues, type PaymentModalValues } from '../components/modals';
import type {
  ClientPaymentCompany,
  Contract,
  ContractType,
  Debt,
  OurPaymentCompany,
  Payment,
  PaymentMethod,
  PaymentRecordStatus,
  PaymentTransaction,
  QuarterlyContractItem,
  QuarterNumber,
  QuarterWorkStatus,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

const ourPaymentCompanies: OurPaymentCompany[] = [
  { id: 'ecoprogress-group', name: 'ТОО "ECOPROGRESS GROUP"' },
  { id: 'ecoprogress-lab', name: 'ТОО "ECOPROGRESS LAB"' },
  { id: 'ecoprogress-utilization', name: 'ТОО "ECOPROGRESS UTILIZATION"' },
];

const clientPaymentCompanies: ClientPaymentCompany[] = [
  { id: 'shymkent-plast', name: 'ТОО "Shymkent Plast"', bin: '120540018765' },
  { id: 'green-market', name: 'ТОО "Green Market"', bin: '160740011223' },
  { id: 'asylbek-ip', name: 'ИП "Асылбек"', bin: '880512350987' },
  { id: 'eco-build-kz', name: 'ТОО "Eco Build KZ"', bin: '190340025114' },
];
import {
  addPartialFinancePayment,
  addQuarterPayment,
  closeDebt,
  getFinanceContracts,
  getFinanceDebts,
  getFinancePayments,
  markFinancePaymentPaid,
  markQuarterPaid,
  updateDebtComment,
  updateFinancePaymentDetails,
  updateQuarterDetails,
} from '../services/paymentService';
import {
  calculateRemainingAmount,
  canAccessPayments,
  formatCurrency,
  getOverdueDays,
  getPaymentStatusColor,
  getPaymentStatusLabel,
  isDateInPeriod,
  isQuarterOverdue,
  paymentMethodLabel,
} from '../utils/payments';

type PaymentTypeFilter = 'all' | 'one_time' | 'quarterly' | 'debts';
type StatusFilter = 'all' | PaymentRecordStatus;
type DebtFilter = 'all' | 'with_debt' | 'without_debt' | 'overdue_debt';
type RowType = 'one_time' | 'quarterly' | 'debt';

type PaymentRow = {
  id: string;
  rowType: RowType;
  contractType: ContractType;
  requestNumber: string;
  contractNumber: string;
  quarter?: QuarterNumber;
  quarterLabel?: string;
  period?: string;
  invoiceNumber?: string;
  clientCompanyId: string;
  clientCompanyName: string;
  clientBin?: string;
  ourCompanyId: string;
  ourCompanyName: string;
  serviceName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: PaymentRecordStatus;
  dueDate?: string;
  invoiceDate?: string;
  lastPaymentDate?: string;
  workStatus?: QuarterWorkStatus;
  responsibleManager?: string;
  payment?: Payment;
  contract?: Contract;
  quarterItem?: QuarterlyContractItem;
  debt?: Debt;
};

const paymentMethods: PaymentMethod[] = ['bank_transfer', 'cash', 'card', 'other'];
const workStatusLabels: Record<QuarterWorkStatus, string> = {
  planned: 'Запланировано',
  waiting_client_data: 'Ожидает данные клиента',
  ready_to_start: 'Готово к старту',
  in_progress: 'В работе',
  completed: 'Выполнено',
  waiting_payment: 'Ожидает оплату',
  blocked_by_debt: 'Заблокировано долгом',
};

const paymentTypeOptions: Array<[PaymentTypeFilter, string]> = [
  ['all', 'Все'],
  ['one_time', 'Разовые оплаты'],
  ['quarterly', 'Квартальные оплаты'],
  ['debts', 'Долги'],
];

const statusOptions: Array<[StatusFilter, string]> = [
  ['all', 'Все статусы'],
  ['paid', 'Полностью оплачено'],
  ['partial', 'Частично оплачено'],
  ['unpaid', 'Не оплачено'],
  ['overdue', 'Просрочено'],
];

const periodOptions = [
  ['all', 'Все время'],
  ['today', 'Сегодня'],
  ['week', 'Эта неделя'],
  ['month', 'Этот месяц'],
  ['quarter', 'Этот квартал'],
  ['year', 'Этот год'],
  ['custom', 'Произвольный период'],
] as const;

const PaymentStatusBadge = ({ status }: { status: PaymentRecordStatus }) => (
  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${getPaymentStatusColor(status)}`}>
    {getPaymentStatusLabel(status)}
  </span>
);

const WorkStatusBadge = ({ status }: { status?: QuarterWorkStatus }) => {
  if (!status) return <span className="text-xs text-slate-400">-</span>;
  const tone =
    status === 'completed'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-100'
      : status === 'blocked_by_debt'
      ? 'bg-rose-50 text-rose-800 ring-rose-100'
      : status === 'waiting_payment'
      ? 'bg-amber-50 text-amber-800 ring-amber-100'
      : status === 'in_progress'
      ? 'bg-eco-50 text-eco-800 ring-eco-100'
      : 'bg-slate-100 text-slate-700 ring-slate-200';
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${tone}`}>{workStatusLabels[status]}</span>;
};

const AccessDenied = () => (
  <Reveal>
    <div className="rounded-[24px] bg-white p-8 text-center shadow-sm">
      <CreditCard className="mx-auto text-slate-400" size={36} />
      <h2 className="mt-4 text-2xl font-bold text-eco-900">Нет доступа</h2>
      <p className="mt-2 text-sm text-slate-600">Раздел оплаты и долгов доступен только администратору и бухгалтеру.</p>
    </div>
  </Reveal>
);

const PaymentsPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [selectedRowId, setSelectedRowId] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentTypeFilter>('all');
  const [contractType, setContractType] = useState<'all' | ContractType>('all');
  const [quarter, setQuarter] = useState<'all' | QuarterNumber>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [debtFilter, setDebtFilter] = useState<DebtFilter>('all');
  const [ourCompany, setOurCompany] = useState('all');
  const [clientCompany, setClientCompany] = useState('all');
  const [period, setPeriod] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [query, setQuery] = useState('');

  const canView = canAccessPayments(user?.role);
  const canEdit = canView;

  const load = () => {
    getFinancePayments().then(setPayments);
    getFinanceContracts().then(setContracts);
    getFinanceDebts().then(setDebts);
  };

  useEffect(() => { if (canView) load(); }, [canView]);

  const rows = useMemo<PaymentRow[]>(() => {
    const oneTimeRows = payments.map<PaymentRow>((payment) => {
      const contract = contracts.find((item) => item.contractNumber === payment.contractNumber || item.requestId === payment.requestId);
      return {
        id: `payment-${payment.id}`,
        rowType: 'one_time',
        contractType: contract?.contractType || 'one_time',
        requestNumber: payment.requestNumber,
        contractNumber: payment.contractNumber || contract?.contractNumber || '-',
        invoiceNumber: payment.invoiceNumber,
        clientCompanyId: payment.clientCompanyId,
        clientCompanyName: payment.clientCompanyName,
        clientBin: payment.clientBin,
        ourCompanyId: payment.ourCompanyId,
        ourCompanyName: payment.ourCompanyName,
        serviceName: payment.serviceName,
        totalAmount: payment.totalAmount,
        paidAmount: payment.paidAmount,
        remainingAmount: payment.remainingAmount,
        paymentStatus: payment.paymentStatus,
        dueDate: payment.dueDate,
        invoiceDate: payment.invoiceDate,
        lastPaymentDate: payment.lastPaymentDate,
        responsibleManager: payment.responsibleManager,
        payment,
        contract,
      };
    });

    const quarterlyRows = contracts.flatMap((contract) =>
      (contract.quarterlySchedule || []).map<PaymentRow>((item) => ({
        id: `quarter-${item.id}`,
        rowType: 'quarterly',
        contractType: contract.contractType,
        requestNumber: item.requestId,
        contractNumber: contract.contractNumber,
        quarter: item.quarter,
        quarterLabel: item.quarterLabel,
        period: `${item.periodStart} - ${item.periodEnd}`,
        invoiceNumber: item.invoiceNumber,
        clientCompanyId: contract.clientCompanyId,
        clientCompanyName: contract.clientCompanyName,
        clientBin: contract.clientBin,
        ourCompanyId: contract.ourCompanyId,
        ourCompanyName: contract.ourCompanyName,
        serviceName: item.serviceName,
        totalAmount: item.plannedAmount,
        paidAmount: item.paidAmount,
        remainingAmount: item.remainingAmount,
        paymentStatus: item.paymentStatus,
        dueDate: item.dueDate,
        invoiceDate: item.invoiceDate,
        lastPaymentDate: item.lastPaymentDate,
        workStatus: item.workStatus,
        responsibleManager: contract.responsibleManager,
        contract,
        quarterItem: item,
      }))
    );

    const debtRows = debts.map<PaymentRow>((debt) => {
      const contract = contracts.find((item) => item.id === debt.contractId);
      const quarterItem = contract?.quarterlySchedule?.find((item) => item.id === debt.quarterItemId);
      return {
        id: `debt-${debt.id}`,
        rowType: 'debt',
        contractType: contract?.contractType || 'annual_quarterly',
        requestNumber: debt.requestId,
        contractNumber: debt.contractNumber,
        quarter: quarterItem?.quarter,
        quarterLabel: debt.quarterLabel,
        period: quarterItem ? `${quarterItem.periodStart} - ${quarterItem.periodEnd}` : undefined,
        invoiceNumber: debt.invoiceNumber,
        clientCompanyId: debt.clientCompanyId,
        clientCompanyName: debt.clientCompanyName,
        clientBin: contract?.clientBin,
        ourCompanyId: contract?.ourCompanyId || '',
        ourCompanyName: contract?.ourCompanyName || '',
        serviceName: quarterItem?.serviceName || contract?.serviceName || 'Долг по счету',
        totalAmount: debt.amount,
        paidAmount: debt.paidAmount,
        remainingAmount: debt.remainingAmount,
        paymentStatus: debt.status === 'overdue' ? 'overdue' : debt.status === 'partial' ? 'partial' : debt.status === 'closed' ? 'paid' : 'unpaid',
        dueDate: debt.dueDate,
        invoiceDate: quarterItem?.invoiceDate || debt.createdAt,
        lastPaymentDate: quarterItem?.lastPaymentDate,
        workStatus: quarterItem?.workStatus,
        responsibleManager: contract?.responsibleManager,
        contract,
        quarterItem,
        debt,
      };
    });

    return [...oneTimeRows, ...quarterlyRows, ...debtRows];
  }, [payments, contracts, debts]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows
      .filter((row) => paymentType === 'all' ? row.rowType !== 'debt' : paymentType === 'debts' ? row.rowType === 'debt' : row.rowType === paymentType)
      .filter((row) => contractType === 'all' || row.contractType === contractType)
      .filter((row) => quarter === 'all' || row.quarter === quarter)
      .filter((row) => status === 'all' || row.paymentStatus === status)
      .filter((row) => {
        if (debtFilter === 'all') return true;
        if (debtFilter === 'with_debt') return row.remainingAmount > 0;
        if (debtFilter === 'without_debt') return row.remainingAmount <= 0;
        return row.paymentStatus === 'overdue' || Boolean(row.debt?.overdueDays && row.debt.overdueDays > 0);
      })
      .filter((row) => ourCompany === 'all' || row.ourCompanyId === ourCompany)
      .filter((row) => clientCompany === 'all' || row.clientCompanyId === clientCompany)
      .filter((row) => isDateInPeriod(row.invoiceDate || row.dueDate || '', period, customFrom, customTo))
      .filter((row) => {
        if (!normalizedQuery) return true;
        return [
          row.contractNumber,
          row.invoiceNumber || '',
          row.requestNumber,
          row.clientCompanyName,
          row.clientBin || '',
          row.serviceName,
        ].join(' ').toLowerCase().includes(normalizedQuery);
      });
  }, [rows, paymentType, contractType, quarter, status, debtFilter, ourCompany, clientCompany, period, customFrom, customTo, query]);

  const stats = useMemo(() => {
    const uniqueContracts = Array.from(new Map(filteredRows.filter((row) => row.contract).map((row) => [row.contract?.id, row.contract])).values()).filter(Boolean) as Contract[];
    const totalContracts = uniqueContracts.reduce((sum, contract) => sum + contract.totalAmount, 0);
    const quarterlyAmount = filteredRows.filter((row) => row.rowType === 'quarterly').reduce((sum, row) => sum + row.totalAmount, 0);
    const paid = filteredRows.reduce((sum, row) => sum + row.paidAmount, 0);
    const partial = filteredRows.filter((row) => row.paymentStatus === 'partial').reduce((sum, row) => sum + row.paidAmount, 0);
    const debtBasis = paymentType === 'debts'
      ? filteredRows
      : filteredRows.filter((row) => row.rowType === 'one_time' || row.rowType === 'quarterly');
    const totalDebt = debtBasis.filter((row) => row.remainingAmount > 0).reduce((sum, row) => sum + row.remainingAmount, 0);
    const overdueDebt = debtBasis.filter((row) => row.paymentStatus === 'overdue').reduce((sum, row) => sum + row.remainingAmount, 0);
    const clientsWithDebt = new Set(debtBasis.filter((row) => row.remainingAmount > 0).map((row) => row.clientCompanyId)).size;
    const upcoming = filteredRows.filter((row) => {
      const overdueDays = getOverdueDays(row.dueDate);
      if (!row.dueDate || row.remainingAmount <= 0 || overdueDays > 0) return false;
      const due = new Date(`${row.dueDate}T23:59:59`).getTime();
      return due - Date.now() <= 7 * 24 * 60 * 60 * 1000;
    }).reduce((sum, row) => sum + row.remainingAmount, 0);

    return [
      ['Общая сумма договоров', totalContracts, ReceiptText],
      ['Сумма квартальных оплат', quarterlyAmount, WalletCards],
      ['Оплачено', paid, CreditCard],
      ['Частично оплачено', partial, WalletCards],
      ['Общий долг клиентов', totalDebt, AlertTriangle],
      ['Просроченный долг', overdueDebt, AlertTriangle],
      ['Клиентов с долгом', clientsWithDebt, ReceiptText],
      ['Ближайшие оплаты', upcoming, CreditCard],
    ] as Array<[string, number, LucideIcon]>;
  }, [filteredRows, paymentType]);

  const selectedRow = rows.find((row) => row.id === selectedRowId);
  const selectedContract = selectedRow?.contract;
  const selectedPayment = selectedRow?.payment;
  const selectedQuarter = selectedRow?.quarterItem;
  const selectedTransactions = selectedRow
    ? transactions.filter((transaction) =>
        selectedPayment?.id
          ? transaction.paymentId === selectedPayment.id
          : selectedQuarter?.id
            ? transaction.quarterItemId === selectedQuarter.id
            : Boolean(selectedContract?.id && transaction.contractId === selectedContract.id)
      )
    : [];

  const refresh = () => {
    getFinancePayments().then(setPayments);
    getFinanceContracts().then(setContracts);
    getFinanceDebts().then(setDebts);
  };

  const submitOneTimePayment = async (values: PaymentModalValues) => {
    if (!selectedPayment) return;
    try {
      await addPartialFinancePayment(selectedPayment.id, {
        amount: values.amount,
        method: values.method,
        comment: values.comment,
      });
      refresh();
      toast.success(values.mode === 'full' ? 'Оплата закрыта полностью' : 'Частичная оплата сохранена', values.mode === 'full' ? 'Остаток по заявке равен 0.' : 'Остаток оплаты пересчитан.');
    } catch (err: unknown) {
      toast.error('Не удалось сохранить оплату', (err as Error)?.message || 'Проверьте данные и попробуйте снова.');
      throw err;
    }
  };

  const submitQuarterPayment = async (values: PaymentModalValues, quarterItem: QuarterlyContractItem) => {
    if (!selectedContract) return;
    try {
      await addQuarterPayment(selectedContract.requestId, quarterItem.id, {
        amount: values.amount,
        method: values.method,
        comment: values.comment,
      });
      refresh();
      toast.success(values.mode === 'full' ? 'Оплата закрыта полностью' : 'Частичная оплата сохранена', values.mode === 'full' ? 'Остаток по заявке равен 0.' : 'Остаток оплаты пересчитан.');
    } catch (err: unknown) {
      toast.error('Не удалось сохранить оплату', (err as Error)?.message || 'Проверьте данные и попробуйте снова.');
      throw err;
    }
  };

  const submitQuarterDetails = async (event: FormEvent<HTMLFormElement>, quarterItem: QuarterlyContractItem) => {
    event.preventDefault();
    if (!selectedContract) return;
    const form = new FormData(event.currentTarget);
    try {
      await updateQuarterDetails(selectedContract.requestId, quarterItem.id, {
        dueDate: String(form.get('dueDate') || ''),
        comment: String(form.get('comment') || ''),
        workStatus: String(form.get('workStatus') || quarterItem.workStatus) as QuarterWorkStatus,
      });
      refresh();
      toast.success('Квартал обновлен', 'Изменения по оплате и работам сохранены.');
    } catch (err: unknown) {
      toast.error('Не удалось обновить квартал', (err as Error)?.message || 'Попробуйте снова.');
    }
  };

  const markQuarterCompleted = async (quarterItem: QuarterlyContractItem) => {
    if (!selectedContract) return;
    try {
      await updateQuarterDetails(selectedContract.requestId, quarterItem.id, {
        workStatus: 'completed',
        completedAt: new Date().toISOString().slice(0, 10),
      });
      refresh();
      toast.success('Работа завершена', 'Квартальный этап отмечен как выполненный.');
    } catch (err: unknown) {
      toast.error('Нельзя завершить работу', (err as Error)?.message || 'Сначала проверьте данные квартала.');
    }
  };

  const submitDebtComment = async (values: CommentValues, debt: Debt) => {
    try {
      if (!values.text.trim()) {
        toast.error('Введите текст сообщения');
        return;
      }
      await updateDebtComment(debt.id, values.text);
      refresh();
      toast.success('Заметка сохранена', 'Комментарий по долгу обновлен.');
    } catch (err: unknown) {
      toast.error('Не удалось сохранить комментарий', (err as Error)?.message || 'Попробуйте снова.');
      throw err;
    }
  };

  const markSelectedQuarterPaid = async (quarterItem: QuarterlyContractItem) => {
    if (!selectedContract) return;
    try {
      await markQuarterPaid(selectedContract.requestId, quarterItem.id, quarterItem.remainingAmount || quarterItem.plannedAmount);
      refresh();
      toast.success('Оплата закрыта полностью', 'Остаток по заявке равен 0.');
    } catch (err: unknown) {
      toast.error('Ошибка', (err as Error)?.message || 'Не удалось подтвердить оплату.');
      throw err;
    }
  };

  const markSelectedPaymentPaid = async () => {
    if (!selectedRow?.payment) return;
    try {
      await markFinancePaymentPaid(selectedRow.payment.id);
      refresh();
      toast.success('Оплата подтверждена', 'Статус оплаты обновлен.');
    } catch (err: unknown) {
      toast.error('Ошибка', (err as Error)?.message || 'Не удалось подтвердить оплату.');
      throw err;
    }
  };

  const submitOneTimeDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRow?.payment) return;
    const form = new FormData(event.currentTarget);
    try {
      await updateFinancePaymentDetails(selectedRow.payment.id, {
        comment: String(form.get('comment') || ''),
        paymentMethod: String(form.get('paymentMethod') || selectedRow.payment.paymentMethod || 'bank_transfer') as PaymentMethod,
      });
      refresh();
      toast.success('Данные оплаты обновлены', 'Изменения сохранены.');
    } catch (err: unknown) {
      toast.error('Ошибка', (err as Error)?.message || 'Не удалось обновить данные оплаты.');
      throw err;
    }
  };

  const closeSelectedDebt = async () => {
    if (!selectedRow?.debt) return;
    try {
      await closeDebt(selectedRow.debt.id, 'Долг отмечен как решенный');
      refresh();
      toast.success('Долг закрыт', 'Задолженность отмечена как решенная.');
    } catch (err: unknown) {
      toast.error('Ошибка', (err as Error)?.message || 'Не удалось закрыть долг.');
      throw err;
    }
  };

  if (!canAccessPayments(user?.role)) return <AccessDenied />;

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-eco-900">Оплата</h2>
            <p className="mt-2 text-sm text-slate-600">Разовые счета, квартальные оплаты, задолженности и выполнение услуг.</p>
          </div>
          <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-eco-800 shadow-sm">Найдено: {filteredRows.length}</span>
        </div>
      </Reveal>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {paymentTypeOptions.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setPaymentType(value)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${paymentType === value ? 'bg-eco-900 text-white' : 'bg-white text-eco-800 hover:bg-eco-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, Icon], index) => (
          <Reveal key={label} delay={index * 0.03}>
            <div className="rounded-[20px] bg-white p-5 shadow-sm">
              <Icon className={label.includes('долг') || label.includes('Просроч') ? 'text-rose-600' : 'text-eco-600'} size={22} />
              <p className="mt-4 text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-eco-900">{label === 'Клиентов с долгом' ? value : formatCurrency(value)}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="rounded-[22px] bg-white p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-4 xl:grid-cols-8">
            <select value={ourCompany} onChange={(event) => setOurCompany(event.target.value)} className="input-focus rounded-2xl border border-slate-200 px-4 py-3">
              <option value="all">Все наши компании</option>
              {ourPaymentCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
            <select value={clientCompany} onChange={(event) => setClientCompany(event.target.value)} className="input-focus rounded-2xl border border-slate-200 px-4 py-3">
              <option value="all">Все клиенты</option>
              {clientPaymentCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
            <select value={contractType} onChange={(event) => setContractType(event.target.value as 'all' | ContractType)} className="input-focus rounded-2xl border border-slate-200 px-4 py-3">
              <option value="all">Все договоры</option>
              <option value="one_time">Разовый</option>
              <option value="annual_quarterly">Годовой с кварталами</option>
            </select>
            <select value={quarter} onChange={(event) => setQuarter(event.target.value === 'all' ? 'all' : Number(event.target.value) as QuarterNumber)} className="input-focus rounded-2xl border border-slate-200 px-4 py-3">
              <option value="all">Все кварталы</option>
              {[1, 2, 3, 4].map((item) => <option key={item} value={item}>{item} квартал</option>)}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="input-focus rounded-2xl border border-slate-200 px-4 py-3">
              {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={debtFilter} onChange={(event) => setDebtFilter(event.target.value as DebtFilter)} className="input-focus rounded-2xl border border-slate-200 px-4 py-3">
              <option value="all">Все долги</option>
              <option value="with_debt">Только с долгом</option>
              <option value="without_debt">Без долга</option>
              <option value="overdue_debt">Просроченные долги</option>
            </select>
            <select value={period} onChange={(event) => setPeriod(event.target.value)} className="input-focus rounded-2xl border border-slate-200 px-4 py-3">
              {periodOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Договор, счет, клиент, БИН, услуга" className="input-focus rounded-2xl border border-slate-200 px-4 py-3" />
          </div>
          {period === 'custom' && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="input-focus rounded-2xl border border-slate-200 px-4 py-3" />
              <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="input-focus rounded-2xl border border-slate-200 px-4 py-3" />
            </div>
          )}
        </div>
      </Reveal>

      <Reveal>
        <div className="overflow-hidden rounded-[22px] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1450px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {['№ договора', 'Тип договора', 'Квартал', 'Период', '№ счета', 'Клиентская компания', 'Наша компания', 'Услуга', 'Сумма', 'Оплачено', 'Остаток / долг', 'Статус оплаты', 'Срок оплаты', 'Просрочка', 'Статус работ', 'Действия'].map((head) => (
                    <th key={head} className="px-4 py-3 font-bold">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} onClick={() => setSelectedRowId(row.id)} className="cursor-pointer border-t border-slate-100 align-top transition hover:bg-eco-50/60">
                    <td className="px-4 py-4 font-bold text-eco-900">{row.contractNumber}</td>
                    <td className="px-4 py-4">{row.contractType === 'annual_quarterly' ? 'Годовой' : 'Разовый'}</td>
                    <td className="px-4 py-4">{row.quarterLabel || '-'}</td>
                    <td className="px-4 py-4">{row.period || '-'}</td>
                    <td className="px-4 py-4">{row.invoiceNumber || '-'}</td>
                    <td className="px-4 py-4"><p className="font-semibold">{row.clientCompanyName}</p><p className="mt-1 text-xs text-slate-500">{row.clientBin}</p></td>
                    <td className="px-4 py-4">{row.ourCompanyName || '-'}</td>
                    <td className="px-4 py-4">{row.serviceName}</td>
                    <td className="px-4 py-4 font-semibold">{formatCurrency(row.totalAmount)}</td>
                    <td className="px-4 py-4 text-emerald-700">{formatCurrency(row.paidAmount)}</td>
                    <td className="px-4 py-4 font-semibold text-rose-700">{row.remainingAmount > 0 ? formatCurrency(row.remainingAmount) : '0 ₸'}</td>
                    <td className="px-4 py-4"><PaymentStatusBadge status={row.paymentStatus} /></td>
                    <td className="px-4 py-4">{row.dueDate || '-'}</td>
                    <td className="px-4 py-4">{getOverdueDays(row.dueDate) > 0 && row.remainingAmount > 0 ? `${getOverdueDays(row.dueDate)} дн.` : '-'}</td>
                    <td className="px-4 py-4"><WorkStatusBadge status={row.workStatus} /></td>
                    <td className="px-4 py-4"><Button type="button" variant="secondary" className="px-4 py-2">Подробнее</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredRows.length && <p className="p-6 text-sm text-slate-500">Данных нет</p>}
        </div>
      </Reveal>

      {selectedRow && (
        <div className="fixed inset-0 z-50 bg-eco-900/35" onClick={() => setSelectedRowId('')}>
          <aside className="ml-auto h-full w-full max-w-4xl overflow-y-auto bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-eco-700">{selectedRow.contractNumber}</p>
                <h3 className="mt-2 text-2xl font-bold text-eco-900">{selectedRow.clientCompanyName}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedRow.serviceName}</p>
              </div>
              <button type="button" className="rounded-2xl border border-slate-200 p-2" onClick={() => setSelectedRowId('')} aria-label="Закрыть"><X size={18} /></button>
            </div>

            {selectedContract?.contractType === 'annual_quarterly' ? (
              <AnnualContractDetails
                contract={selectedContract}
                selectedQuarterId={selectedQuarter?.id}
                transactions={selectedTransactions}
                debts={debts}
                onSubmitPayment={submitQuarterPayment}
                onSubmitDetails={submitQuarterDetails}
                onMarkPaid={markSelectedQuarterPaid}
                onMarkCompleted={markQuarterCompleted}
              />
            ) : (
              selectedRow.payment && (
                <OneTimeDetails
                  row={selectedRow}
                  transactions={selectedTransactions}
                  onSubmitPayment={submitOneTimePayment}
                  onMarkPaid={markSelectedPaymentPaid}
                  onSubmitDetails={submitOneTimeDetails}
                />
              )
            )}

            {selectedRow.debt && (
              <DebtActions
                debt={selectedRow.debt}
                onSubmitComment={submitDebtComment}
                onClose={closeSelectedDebt}
              />
            )}
          </aside>
        </div>
      )}
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-slate-50 p-4">
    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
    <p className="mt-2 break-words text-sm font-semibold text-slate-800">{value}</p>
  </div>
);

const TransactionList = ({ transactions }: { transactions: PaymentTransaction[] }) => (
  <section className="mt-6">
    <h4 className="font-bold text-eco-900">История платежей</h4>
    <div className="mt-3"><BackendFeatureUnavailable title="История транзакций" description="История платежных транзакций пока не подключена к серверу." /></div>
    {transactions.length > 0 && <p className="sr-only">Получено транзакций: {transactions.length}</p>}
  </section>
);

const OneTimeDetails = ({
  row,
  transactions,
  onSubmitPayment,
  onMarkPaid,
  onSubmitDetails,
}: {
  row: PaymentRow;
  transactions: PaymentTransaction[];
  onSubmitPayment: (values: PaymentModalValues) => void | Promise<void>;
  onMarkPaid: () => void;
  onSubmitDetails: (event: FormEvent<HTMLFormElement>) => void;
}) => (
  <>
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      <Info label="Заявка" value={row.requestNumber} />
      <Info label="Счет" value={row.invoiceNumber || 'Нет'} />
      <Info label="Наша компания" value={row.ourCompanyName} />
      <Info label="Клиент" value={`${row.clientCompanyName} · ${row.clientBin || 'БИН не указан'}`} />
      <Info label="Сумма" value={formatCurrency(row.totalAmount)} />
      <Info label="Остаток" value={formatCurrency(row.remainingAmount)} />
    </div>
    <PaymentForm
      title="Добавить оплату"
      max={row.remainingAmount || row.totalAmount}
      totalAmount={row.totalAmount}
      paidAmount={row.paidAmount}
      remainingAmount={row.remainingAmount}
      onSubmit={onSubmitPayment}
      onMarkPaid={onMarkPaid}
    />
    <DetailsForm paymentMethod={row.payment?.paymentMethod} comment={row.payment?.comment} onSubmit={onSubmitDetails} />
    <TransactionList transactions={transactions} />
  </>
);

const AnnualContractDetails = ({
  contract,
  selectedQuarterId,
  transactions,
  debts,
  onSubmitPayment,
  onSubmitDetails,
  onMarkPaid,
  onMarkCompleted,
}: {
  contract: Contract;
  selectedQuarterId?: string;
  transactions: PaymentTransaction[];
  debts: Debt[];
  onSubmitPayment: (values: PaymentModalValues, quarterItem: QuarterlyContractItem) => void | Promise<void>;
  onSubmitDetails: (event: FormEvent<HTMLFormElement>, quarterItem: QuarterlyContractItem) => void;
  onMarkPaid: (quarterItem: QuarterlyContractItem) => void;
  onMarkCompleted: (quarterItem: QuarterlyContractItem) => void;
}) => (
  <>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Info label="Тип" value="Годовой договор" />
      <Info label="Срок" value={`${contract.startDate} - ${contract.endDate}`} />
      <Info label="Сумма" value={formatCurrency(contract.totalAmount)} />
      <Info label="Наша компания" value={contract.ourCompanyName} />
      <Info label="Клиент" value={`${contract.clientCompanyName} · ${contract.clientBin || 'БИН не указан'}`} />
      <Info label="Заявка" value={contract.requestId} />
    </div>
    <div className="mt-6 grid gap-4 xl:grid-cols-2">
      {(contract.quarterlySchedule || []).map((quarterItem) => {
        const debt = debts.find((item) => item.quarterItemId === quarterItem.id);
        const strongDebt = debt?.overdueDays && debt.overdueDays > 30;
        const hasPreviousDebt = (contract.quarterlySchedule || []).some((item) => item.quarter < quarterItem.quarter && item.remainingAmount > 0);
        return (
          <div key={quarterItem.id} className={`rounded-[20px] border p-4 ${selectedQuarterId === quarterItem.id ? 'border-eco-300 bg-eco-50/50' : strongDebt ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200 bg-white'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-bold text-eco-900">{quarterItem.quarterLabel}</h4>
                <p className="mt-1 text-sm text-slate-500">{quarterItem.periodStart} - {quarterItem.periodEnd}</p>
              </div>
              <PaymentStatusBadge status={quarterItem.paymentStatus} />
            </div>
            {hasPreviousDebt && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-800">Есть долг за предыдущий квартал. Проверьте оплату перед выполнением следующего этапа.</p>}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Info label="Сумма" value={formatCurrency(quarterItem.plannedAmount)} />
              <Info label="Оплачено" value={formatCurrency(quarterItem.paidAmount)} />
              <Info label="Остаток" value={formatCurrency(quarterItem.remainingAmount)} />
              <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase text-slate-500">Работы</p><div className="mt-2"><WorkStatusBadge status={quarterItem.workStatus} /></div></div>
              <Info label="Счет" value={quarterItem.invoiceNumber || 'Нет'} />
              <Info label="Просрочка" value={isQuarterOverdue(quarterItem) ? `${getOverdueDays(quarterItem.dueDate)} дн.` : 'Нет'} />
            </div>
            <PaymentForm
              title="Оплата квартала"
              max={quarterItem.remainingAmount || quarterItem.plannedAmount}
              totalAmount={quarterItem.plannedAmount}
              paidAmount={quarterItem.paidAmount}
              remainingAmount={quarterItem.remainingAmount}
              onSubmit={(values) => onSubmitPayment(values, quarterItem)}
              onMarkPaid={() => onMarkPaid(quarterItem)}
            />
            <form onSubmit={(event) => onSubmitDetails(event, quarterItem)} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input name="dueDate" type="date" defaultValue={quarterItem.dueDate || ''} className="input-focus rounded-2xl border border-slate-200 px-4 py-3" />
              <select name="workStatus" defaultValue={quarterItem.workStatus} className="input-focus rounded-2xl border border-slate-200 px-4 py-3">
                {Object.entries(workStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <input name="comment" defaultValue={quarterItem.comment || ''} placeholder="Комментарий по долгу/кварталу" className="input-focus rounded-2xl border border-slate-200 px-4 py-3 sm:col-span-2" />
              <Button type="submit" variant="secondary">Сохранить квартал</Button>
              <ConfirmAction title="Отметить услугу выполненной?" confirmText="Услуга выполнена" onConfirm={() => onMarkCompleted(quarterItem)} />
            </form>
          </div>
        );
      })}
    </div>
    <TransactionList transactions={transactions} />
  </>
);

const PaymentForm = ({
  title,
  max,
  totalAmount = max,
  paidAmount = 0,
  remainingAmount = max,
  onSubmit,
  onMarkPaid,
}: {
  title: string;
  max: number;
  totalAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  onSubmit: (values: PaymentModalValues) => void | Promise<void>;
  onMarkPaid: () => void | Promise<void>;
}) => {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [confirmPaid, setConfirmPaid] = useState(false);
  return (
    <div className="mt-6 rounded-[20px] border border-slate-200 p-4">
      <h4 className="font-bold text-eco-900">{title}</h4>
      <p className="mt-2 text-sm text-slate-600">Добавление частичной оплаты и полное закрытие счета выполняются через модальные окна.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" onClick={() => setPaymentOpen(true)}>Добавить оплату</Button>
        <Button type="button" variant="success" disabled={max <= 0} onClick={() => setConfirmPaid(true)}>Отметить полностью оплаченной</Button>
      </div>
      <PaymentModal
        isOpen={paymentOpen}
        mode="partial"
        totalAmount={totalAmount}
        paidAmount={paidAmount}
        remainingAmount={remainingAmount}
        onClose={() => setPaymentOpen(false)}
        onSubmit={onSubmit}
      />
      <ConfirmModal
        isOpen={confirmPaid}
        title="Подтвердить полную оплату?"
        description="После подтверждения счет будет отмечен как полностью оплаченный."
        confirmText="Подтвердить оплату"
        variant="success"
        onClose={() => setConfirmPaid(false)}
        onConfirm={async () => {
          await onMarkPaid();
          setConfirmPaid(false);
        }}
      />
    </div>
  );
};

const DetailsForm = ({ paymentMethod, comment, onSubmit }: { paymentMethod?: PaymentMethod; comment?: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) => (
  <form onSubmit={onSubmit} className="mt-6 rounded-[20px] border border-slate-200 p-4">
    <h4 className="font-bold text-eco-900">Комментарий бухгалтера</h4>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <select name="paymentMethod" defaultValue={paymentMethod || 'bank_transfer'} className="input-focus rounded-2xl border border-slate-200 px-4 py-3">
        {paymentMethods.map((method) => <option key={method} value={method}>{paymentMethodLabel(method)}</option>)}
      </select>
      <textarea name="comment" defaultValue={comment || ''} rows={3} className="input-focus rounded-2xl border border-slate-200 px-4 py-3 sm:col-span-2" />
    </div>
    <Button type="submit" variant="secondary" className="mt-4">Сохранить</Button>
  </form>
);

const DebtActions = ({ debt, onSubmitComment, onClose }: { debt: Debt; onSubmitComment: (values: CommentValues, debt: Debt) => void | Promise<void>; onClose: () => void | Promise<void> }) => {
  const [commentOpen, setCommentOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  return (
    <section className="mt-6 rounded-[20px] border border-rose-100 bg-rose-50/60 p-4">
      <h4 className="font-bold text-rose-900">Долг</h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Info label="Сумма долга" value={formatCurrency(debt.remainingAmount)} />
        <Info label="Просрочка" value={debt.overdueDays ? `${debt.overdueDays} дн.` : 'Нет'} />
      </div>
      <p className="mt-3 rounded-2xl bg-white/70 px-4 py-3 text-sm text-rose-900">{debt.comment || 'Комментария по долгу нет'}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={() => setCommentOpen(true)}>Изменить комментарий</Button>
        <Button type="button" variant="success" onClick={() => setCloseOpen(true)}>Отметить как решено</Button>
      </div>
      <CommentModal
        isOpen={commentOpen}
        title="Комментарий по долгу"
        defaultVisibility="internal"
        onClose={() => setCommentOpen(false)}
        onSubmit={(values) => onSubmitComment(values, debt)}
      />
      <ConfirmModal
        isOpen={closeOpen}
        title="Закрыть задолженность?"
        description="Долг будет отмечен как решенный."
        confirmText="Закрыть долг"
        variant="success"
        onClose={() => setCloseOpen(false)}
        onConfirm={async () => {
          await onClose();
          setCloseOpen(false);
        }}
      />
    </section>
  );
};

const ConfirmAction = ({ title, confirmText, onConfirm }: { title: string; confirmText: string; onConfirm: () => void | Promise<void> }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="success" onClick={() => setOpen(true)}>{confirmText}</Button>
      <ConfirmModal
        isOpen={open}
        title={title}
        confirmText={confirmText}
        variant="success"
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          await onConfirm();
          setOpen(false);
        }}
      />
    </>
  );
};

export default PaymentsPage;
