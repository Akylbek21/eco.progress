import type {
  LaboratoryMeasurementAgreement,
  LaboratoryMeasurementAgreementStatus,
  LaboratoryPrimaryDocument,
  LaboratoryPrimaryDocumentStatus,
  LaboratoryResultDocument,
  LaboratoryResultDocumentStatus,
  Order,
  OrderHistoryItem,
} from '../data/mockData';

export const laboratoryPrimaryDocumentNames = [
  'Разрешение',
  'Заключение',
  'СЭС заключение',
  'ПУО',
  'ПЭК',
  'НОВ',
  'ОВОС',
  'ППМ',
  'ПДС',
  'Паспорт отходов',
  'Договор на вывоз мусора и жидких отходов',
  'Разрешение на специальное водопользование',
] as const;

export const laboratorySectionLabels = {
  overview: 'Обзор заявки',
  primary_documents: 'Первичные документы',
  measurement: 'Согласование замера',
  protocol: 'Протокол',
  form_870: '870 форма',
  base_report: 'База отчёт',
  annual_report: 'Годовой отчёт',
  half_year_report: 'Полугодовой отчёт',
  archive_report: 'Архив отчёт',
  history: 'История',
} as const;

export const laboratoryResultSections = ['protocol', 'form_870', 'base_report', 'annual_report', 'half_year_report', 'archive_report'] as const;

export const laboratoryResultSectionLabels: Record<LaboratoryResultDocument['section'], string> = {
  protocol: 'Протокол',
  form_870: '870 форма',
  base_report: 'База отчёт',
  annual_report: 'Годовой отчёт',
  half_year_report: 'Полугодовой отчёт',
  archive_report: 'Архив отчёт',
};

export const laboratoryPrimaryStatusLabels: Record<LaboratoryPrimaryDocumentStatus, string> = {
  not_uploaded: 'Не загружено',
  uploaded: 'Загружено',
  in_review: 'На проверке',
  approved: 'Принято',
  revision_required: 'Нужна доработка',
  not_required: 'Не требуется',
};

export const laboratoryMeasurementStatusLabels: Record<LaboratoryMeasurementAgreementStatus, string> = {
  draft: 'Черновик',
  sent_to_client: 'Отправлено клиенту',
  accepted_by_client: 'Клиент подтвердил',
  reschedule_requested: 'Клиент предложил другую дату',
  confirmed: 'Замер согласован',
  completed: 'Замер проведён',
  cancelled: 'Отменено',
};

export const laboratoryResultStatusLabels: Record<LaboratoryResultDocumentStatus, string> = {
  draft: 'Черновик',
  in_progress: 'В работе',
  ready: 'Готов',
  published_to_client: 'Опубликовано для клиента',
  archived: 'В архиве',
};

export const isLaboratoryOrder = (order: Pick<Order, 'serviceId' | 'service' | 'businessCompanyId'>) =>
  order.serviceId === 'laboratory' ||
  order.businessCompanyId === 'ecoprogress-laboratory' ||
  /лаборатор|замер|анализ|исслед/i.test(order.service);

export const createLaboratoryPrimaryDocuments = (orderId: string, existing: LaboratoryPrimaryDocument[] = []) =>
  laboratoryPrimaryDocumentNames.map((name, index) => {
    const current = existing.find((doc) => doc.name === name || doc.id === `LAB-PD-${index + 1}`);
    return current ? { ...current, orderId, history: current.history || [] } : {
      id: `LAB-PD-${index + 1}`,
      orderId,
      name,
      status: 'not_uploaded' as const,
      history: [],
    };
  });

export const createLaboratoryMeasurementAgreement = (
  order: Pick<Order, 'id' | 'legalAddress' | 'companyName' | 'contactPerson' | 'phone'>,
  existing?: LaboratoryMeasurementAgreement
): LaboratoryMeasurementAgreement => existing || ({
  id: `LAB-MEASURE-${order.id}`,
  orderId: order.id,
  measurementDate: '',
  measurementTime: '',
  address: order.legalAddress || '',
  companyName: 'ECOPROGRESS LABORATORY',
  contactPerson: order.contactPerson || '',
  phone: order.phone || '',
  measurementScope: '',
  comment: '',
  status: 'draft',
});

export const normalizeLaboratoryResultDocuments = (orderId: string, documents: LaboratoryResultDocument[] = []) =>
  documents.map((doc) => ({ ...doc, orderId, history: doc.history || [] }));

export const laboratoryPrimaryStatusClass = (status: LaboratoryPrimaryDocumentStatus) => {
  if (status === 'approved') return 'bg-emerald-50 text-emerald-800 ring-emerald-100';
  if (status === 'revision_required') return 'bg-rose-50 text-rose-800 ring-rose-100';
  if (status === 'in_review' || status === 'uploaded') return 'bg-amber-50 text-amber-800 ring-amber-100';
  if (status === 'not_required') return 'bg-slate-100 text-slate-700 ring-slate-200';
  return 'bg-white text-slate-500 ring-slate-200';
};

export const laboratoryMeasurementStatusClass = (status: LaboratoryMeasurementAgreementStatus) => {
  if (status === 'confirmed' || status === 'accepted_by_client' || status === 'completed') return 'bg-emerald-50 text-emerald-800 ring-emerald-100';
  if (status === 'reschedule_requested') return 'bg-amber-50 text-amber-800 ring-amber-100';
  if (status === 'cancelled') return 'bg-rose-50 text-rose-800 ring-rose-100';
  if (status === 'sent_to_client') return 'bg-eco-50 text-eco-800 ring-eco-100';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
};

export const laboratoryResultStatusClass = (status: LaboratoryResultDocumentStatus) => {
  if (status === 'published_to_client') return 'bg-emerald-50 text-emerald-800 ring-emerald-100';
  if (status === 'ready') return 'bg-eco-50 text-eco-800 ring-eco-100';
  if (status === 'in_progress') return 'bg-amber-50 text-amber-800 ring-amber-100';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
};

export const clientLaboratoryStepState = (order: Order) => {
  const docs = order.laboratoryPrimaryDocuments || [];
  const agreement = order.laboratoryMeasurementAgreement;
  const results = order.laboratoryResultDocuments || [];
  return [
    {
      label: 'Документы от вас',
      done: docs.length > 0 && docs.every((doc) => ['approved', 'not_required'].includes(doc.status)),
      active: docs.some((doc) => ['not_uploaded', 'revision_required', 'uploaded', 'in_review'].includes(doc.status)),
    },
    {
      label: 'Согласование замера',
      done: Boolean(agreement && ['confirmed', 'completed'].includes(agreement.status)),
      active: Boolean(agreement && ['sent_to_client', 'accepted_by_client', 'reschedule_requested'].includes(agreement.status)),
    },
    {
      label: 'Статус выполнения',
      done: agreement?.status === 'completed' || order.laboratoryStatus === 'result_ready',
      active: agreement?.status === 'confirmed' || order.laboratoryStatus === 'analysis_in_progress',
    },
    {
      label: 'Готовые документы',
      done: results.some((doc) => doc.status === 'published_to_client'),
      active: results.some((doc) => doc.status === 'ready'),
    },
  ];
};

export const formatLaboratoryHistory = (items: OrderHistoryItem[] = []) =>
  items.map((item) => `${item.createdAt} · ${item.actorName || item.actor || 'Система'}: ${item.text}`);
