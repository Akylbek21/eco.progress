import { normalizeApiError } from '../services/apiHelpers';

export type NormalizedProtocolError = {
  message: string;
  field?: string;
  resultIndex?: number;
  code?: string;
};

const fieldRules: Array<{ pattern: RegExp; field: string }> = [
  { pattern: /sample\s*date|дата отбора/i, field: 'sampleDate' },
  { pattern: /объект.*(не найден|не принадлежит)|object.*(not found|belong)/i, field: 'objectId' },
  { pattern: /лаборатор.*не найден|laboratory.*not found/i, field: 'laboratoryId' },
  { pattern: /исполнитель.*лаборатор|executor.*laboratory/i, field: 'executorId' },
  { pattern: /прибор.*(не найден|поверк)|device.*(not found|verification|expired)/i, field: 'measurementDeviceId' },
  { pattern: /единиц.*измерения|unit.*required/i, field: 'unit' },
  { pattern: /pollutant\s*code/i, field: 'pollutantCode' },
  { pattern: /factor\s*type/i, field: 'factorType' },
  { pattern: /template\s*id|тип протокола/i, field: 'templateId' },
];

const friendlyRules: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /measurementDeviceId|укажите.*прибор|device.*required/i, message: 'Выберите прибор.' },
  { pattern: /verification.*expired|срок.*поверк.*ист[её]к/i, message: 'Срок поверки выбранного прибора истёк.' },
  { pattern: /executor.*does not belong.*laboratory|исполнитель.*не относится.*лаборатор/i, message: 'Выбранный сотрудник не относится к этой лаборатории.' },
  { pattern: /normative.*(record )?not found|норматив.*не найден/i, message: 'Для показателя не найден норматив.' },
  { pattern: /invalid transition.*READY.*APPROVED|недопустим.*READY.*APPROVED/i, message: 'Протокол пока нельзя утвердить. Сначала передайте его на проверку.' },
  { pattern: /pollutantCode|pollutant code/i, message: 'Укажите код загрязняющего вещества.' },
  { pattern: /factorType|factor type/i, message: 'Укажите вид измерения.' },
  { pattern: /unit.*required|укажите.*единиц/i, message: 'Укажите единицу измерения.' },
  { pattern: /object.*not found|объект.*не найден/i, message: 'Выбранный объект не найден.' },
  { pattern: /object.*does not belong|объект.*не принадлежит/i, message: 'Выбранный объект не относится к этой компании.' },
  { pattern: /method.*required|укажите.*метод/i, message: 'Укажите метод испытаний.' },
];

export const normalizeProtocolError = (error: unknown): NormalizedProtocolError => {
  const parsed = normalizeApiError(error, 'Не удалось выполнить действие с протоколом.');
  const firstFieldError = Object.entries(parsed.fieldErrors)[0];
  const source = [parsed.message, ...parsed.errors, firstFieldError?.[1] || ''].filter(Boolean).join(' ');
  const explicitField = firstFieldError?.[0];
  const indexedField = explicitField?.match(/(?:measurements|results)\[(\d+)\]\.?(.+)?/i)
    || explicitField?.match(/(?:measurements|results)\.(\d+)\.?(.+)?/i);
  const messageIndex = source.match(/(?:строк|result|measurement)\D*(\d+)/i);
  const fieldRule = fieldRules.find((item) => item.pattern.test(source));
  const friendlyRule = friendlyRules.find((item) => item.pattern.test(source));
  const indexValue = indexedField?.[1] ?? messageIndex?.[1];

  return {
    message: friendlyRule?.message || parsed.message || 'Не удалось выполнить действие с протоколом.',
    field: indexedField?.[2] || explicitField || fieldRule?.field,
    resultIndex: indexValue === undefined ? undefined : Math.max(0, Number(indexValue) - (indexedField ? 0 : 1)),
    code: parsed.code,
  };
};
