import { normalizeApiError } from '../../../services/apiHelpers';

const messages: Record<string, string> = {
  DOCUMENT_FLOW_SUBSCRIPTION_REQUIRED: 'Документооборот не подключён для вашей организации.',
  DOCUMENT_FLOW_ACCESS_EXPIRED: 'Срок доступа истёк.',
  DOCUMENT_FLOW_ACCESS_SUSPENDED: 'Доступ к документообороту приостановлен.',
  DOCUMENT_FLOW_READ_ONLY: 'Раздел работает в режиме просмотра.',
  DOCUMENT_FLOW_FEATURE_DISABLED: 'Функция не входит в текущий тариф.',
  DOCUMENT_LIMIT_EXCEEDED: 'Лимит документов исчерпан.',
  MEMBER_LIMIT_EXCEEDED: 'Лимит сотрудников исчерпан.',
  STORAGE_LIMIT_EXCEEDED: 'Лимит хранилища исчерпан.',
  EXTERNAL_SIGNATURE_LIMIT_EXCEEDED: 'Лимит внешних подписей исчерпан.',
  PLAN_DOES_NOT_SUPPORT_MULTI_SIGNING: 'Тариф не поддерживает несколько подписантов.',
  PLAN_DOES_NOT_SUPPORT_EXTERNAL_SIGNING: 'Тариф не поддерживает внешних подписантов.',
  PLAN_DOES_NOT_SUPPORT_MIXED_SIGNING: 'Тариф не поддерживает смешанный маршрут.',
  DOCUMENT_NOT_EDITABLE: 'Документ больше нельзя изменять.',
  VERSION_LOCKED: 'Версия документа заблокирована.',
  ASSIGNMENT_NOT_AVAILABLE: 'Задание на подпись недоступно.',
  SIGNATURE_ALREADY_EXISTS: 'Подпись уже существует.',
  SIGNER_IIN_MISMATCH: 'ИИН сертификата не соответствует назначенному подписанту.',
  DOCUMENT_HASH_MISMATCH: 'Хэш документа изменился. Обновите страницу.',
  INVALID_CMS: 'Backend отклонил CMS-подпись.',
  CERTIFICATE_EXPIRED: 'Срок действия сертификата истёк.',
  CERTIFICATE_REVOKED: 'Сертификат отозван.',
  IDEMPOTENCY_CONFLICT: 'Этот запрос уже обрабатывается.',
  VERSION_CONFLICT: 'Документ был изменён. Обновите данные.',
};

export const getDocumentFlowError = (error: unknown, fallback = 'Не удалось выполнить запрос.') => {
  const parsed = normalizeApiError(error);
  return {
    ...parsed,
    message: messages[parsed.code || ''] || parsed.message || fallback,
  };
};

