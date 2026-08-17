import { normalizeProtocolStatus, protocolStatusConfig } from '../../../config/protocolStatus';
import type { Protocol, ProtocolHistoryItem, ProtocolInternalStatus, ProtocolResult } from '../../../types/protocols';
import { hasProtocolAction } from '../utils/protocolActions';

export type ProtocolDetailsTab = 'results' | 'main' | 'documents' | 'history';
export type ProtocolEditSection = 'general' | 'organization' | 'laboratory' | 'environment' | 'results' | 'methods';
export type ProtocolPrimaryActionKey = 'edit' | 'calculate' | 'checkNormatives' | 'ready' | 'approve' | 'sign' | 'publish' | 'pdf' | 'replacement' | 'review' | null;

export const formatProtocolDate = (value?: string | null) => {
  if (!value) return 'Не заполнено';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU').format(date);
};

export const formatProtocolDateTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

export const protocolStatusLabel = (status?: string | null) => protocolStatusConfig[normalizeProtocolStatus(status)].label;

export const lifecycleStage = (status?: string | null) => {
  const normalized = normalizeProtocolStatus(status);
  const stages = {
    DRAFT: 0,
    CALCULATED: 1,
    READY_FOR_APPROVAL: 2,
    APPROVED: 3,
    SIGNED: 4,
  } as const;
  return normalized in stages ? stages[normalized as keyof typeof stages] : null;
};

export const complianceLabel = (status?: ProtocolInternalStatus | string | null) => {
  const normalized = String(status || '').toUpperCase();
  if (['NORMAL', 'OK', 'OK_MANUAL', 'COMPLIES'].includes(normalized)) return 'Соответствует';
  if (['EXCEEDED', 'BELOW_REQUIRED', 'DOES_NOT_COMPLY'].includes(normalized)) return 'Есть превышение';
  if (normalized === 'NORMATIVE_NOT_FOUND') return 'Норматив не найден';
  if (normalized === 'UNIT_MISMATCH') return 'Проверьте единицу';
  if (normalized === 'EMPTY_RESULT') return 'Нет результата';
  return 'Нужна проверка';
};

export const complianceClass = (status?: ProtocolInternalStatus | string | null) => {
  const label = complianceLabel(status);
  if (label === 'Соответствует') return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  if (label === 'Есть превышение') return 'bg-rose-50 text-rose-800 ring-rose-200';
  if (label === 'Норматив не найден' || label === 'Проверьте единицу') return 'bg-amber-50 text-amber-800 ring-amber-200';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
};

const firstPresent = (...values: unknown[]) => values.find((value) => value !== undefined && value !== null && value !== '');
export const resultValue = (row: ProtocolResult) => String(firstPresent(row.result, row.resultValue, row.primaryReading, row.values.result, row.values.resultValue) ?? 'Не заполнено');
export const resultNormative = (row: ProtocolResult) => String(firstPresent(row.normativeValue, row.normative, row.pdk, row.values.normativeValue, row.values.normative) ?? 'Не найден');
export const resultIndicator = (row: ProtocolResult) => String(row.indicatorName || row.indicator || row.values.indicatorName || row.values.indicator || 'Показатель не указан');
export const resultDeviceName = (protocol: Protocol, row: ProtocolResult) => {
  const snapshot = row.deviceSnapshot || row.measurementDevice || row.device;
  if (snapshot?.name) return snapshot.name;
  if (row.deviceName) return row.deviceName;
  const id = String(row.measurementDeviceId || row.deviceId || '');
  return protocol.measurementDevices.find((item) => String(item.deviceId || item.id) === id)?.deviceSnapshot.name || 'Не выбран';
};

export const humanHistoryAction = (item: ProtocolHistoryItem) => {
  const action = String(item.action || '').trim().toUpperCase();
  const labels: Record<string, string> = {
    CREATED: 'Протокол создан',
    PROTOCOL_CREATED: 'Протокол создан',
    RESULT_ADDED: 'Добавлен результат измерения',
    RESULT_UPDATED: 'Изменены результаты измерений',
    CALCULATED: 'Результаты рассчитаны',
    READY_FOR_APPROVAL: 'Протокол передан на проверку',
    MARKED_READY_FOR_APPROVAL: 'Протокол передан на проверку',
    NEEDS_REVISION: 'Возвращён на исправление',
    RETURN_FOR_REVISION: 'Возвращён на исправление',
    APPROVED: 'Протокол утверждён',
    SIGNED: 'Протокол подписан',
    CANCELLED: 'Протокол отменён',
    ARCHIVED: 'Протокол перемещён в архив',
    CORRECTION_CREATED: 'Создана исправленная версия',
  };
  return labels[action] || (/READY_FOR_APPROVAL/.test(action) ? labels.READY_FOR_APPROVAL : /REVISION/.test(action) ? labels.NEEDS_REVISION : /APPROV/.test(action) ? labels.APPROVED : /SIGN/.test(action) ? labels.SIGNED : 'Данные протокола изменены');
};

export const resolveProtocolPrimaryAction = (protocol: Protocol, _role?: string): { key: ProtocolPrimaryActionKey; label: string } => {
  if (hasProtocolAction(protocol, 'approve')) return { key: 'approve', label: 'Утвердить' };
  if (hasProtocolAction(protocol, 'sendToApproval')) return { key: 'ready', label: 'Отправить на утверждение' };
  if (hasProtocolAction(protocol, 'sign')) return { key: 'sign', label: 'Подписать ЭЦП' };
  if (hasProtocolAction(protocol, 'calculate')) return { key: 'calculate', label: 'Рассчитать результаты' };
  if (hasProtocolAction(protocol, 'checkNormatives')) return { key: 'checkNormatives', label: 'Проверить нормативы' };
  if (hasProtocolAction(protocol, 'edit')) return { key: 'edit', label: 'Продолжить' };
  if (hasProtocolAction(protocol, 'publish')) return { key: 'publish', label: 'Отправить клиенту' };
  if (hasProtocolAction(protocol, 'downloadPdf')) return { key: 'pdf', label: 'Скачать PDF' };
  if (protocol.replacedByProtocolId) return { key: 'replacement', label: 'Открыть новую версию' };
  return { key: null, label: '' };
};
