import { normalizeProtocolStatus, protocolStatusConfig } from '../../../config/protocolStatus';
import type { Protocol, ProtocolHistoryItem, ProtocolInternalStatus, ProtocolResult } from '../../../types/protocols';
import { getProtocolPermissions } from '../../../utils/protocolPermissions';

export type ProtocolDetailsTab = 'results' | 'main' | 'documents' | 'history';
export type ProtocolEditSection = 'general' | 'organization' | 'laboratory' | 'environment' | 'results' | 'methods';
export type ProtocolPrimaryActionKey = 'edit' | 'ready' | 'approve' | 'sign' | 'publish' | 'pdf' | 'replacement' | 'review' | null;

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
  if (normalized === 'SIGNED' || normalized === 'REPLACED' || normalized === 'ARCHIVED') return 4;
  if (normalized === 'APPROVED') return 3;
  if (normalized === 'READY_FOR_APPROVAL') return 2;
  if (['CALCULATED', 'READY', 'NEEDS_REVISION'].includes(normalized)) return 1;
  return 0;
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

export const resultValue = (row: ProtocolResult) => String(row.result || row.resultValue || row.primaryReading || row.values.result || row.values.resultValue || 'Не заполнено');
export const resultNormative = (row: ProtocolResult) => String(row.normativeValue || row.normative || row.pdk || row.values.normativeValue || row.values.normative || 'Не найден');
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
    READY: 'Протокол подготовлен',
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

export const resolveProtocolPrimaryAction = (protocol: Protocol, role?: string): { key: ProtocolPrimaryActionKey; label: string } => {
  const status = normalizeProtocolStatus(protocol.status);
  const permissions = getProtocolPermissions(protocol, role);
  if (status === 'DRAFT') return { key: permissions.canSave ? 'edit' : null, label: 'Продолжить заполнение' };
  if (status === 'CALCULATED') return { key: permissions.canSendToApproval ? 'ready' : 'review', label: permissions.canSendToApproval ? 'Передать на проверку' : 'Проверить данные' };
  if (status === 'READY') return { key: permissions.canSendToApproval ? 'ready' : 'review', label: permissions.canSendToApproval ? 'Передать на проверку' : 'Проверить данные' };
  if (status === 'READY_FOR_APPROVAL') return { key: permissions.canApprove ? 'approve' : null, label: 'Утвердить' };
  if (status === 'NEEDS_REVISION') return { key: permissions.canSave ? 'edit' : null, label: 'Исправить протокол' };
  if (status === 'APPROVED') return { key: permissions.canSign ? 'sign' : protocol.hasPdf ? 'pdf' : null, label: permissions.canSign ? 'Подписать' : 'Скачать PDF' };
  if (status === 'SIGNED') return permissions.canPublish && !protocol.publishedToClientAt
    ? { key: 'publish', label: 'Отправить клиенту' }
    : { key: 'pdf', label: 'Скачать PDF' };
  if (status === 'REPLACED' && protocol.replacedByProtocolId) return { key: 'replacement', label: 'Открыть новую версию' };
  if (protocol.hasPdf) return { key: 'pdf', label: 'Скачать PDF' };
  return { key: null, label: '' };
};
