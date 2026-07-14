import type { NormativeRecord } from '../types/protocols';

export const protocolNormativeIdentity = (item: NormativeRecord) => String(item.id || [
  item.templateId,
  item.sourceDocumentCode,
  item.factorCode || item.pollutantCode || item.code,
  item.indicator || item.indicatorName || item.pollutantName,
  item.appendixNo,
  item.tableNo,
  item.categoryCode,
  item.conditionJson,
  item.value,
  item.min,
  item.max,
].map((value) => String(value ?? '')).join('|'));

export const protocolNormativeDisplayValue = (normative?: NormativeRecord) => {
  if (!normative) return '';
  const direct = [normative.value, normative.normativeValue, normative.pdk, normative.limitValue]
    .find((value) => value !== undefined && value !== null && String(value).trim() !== '');
  if (direct !== undefined) return String(direct);
  const min = normative.min ?? normative.minValue;
  const max = normative.max ?? normative.maxValue;
  if (min !== undefined && min !== null && String(min).trim() !== '' && max !== undefined && max !== null && String(max).trim() !== '') {
    return `${min}-${max}`;
  }
  const fallback = [max, min, normative.maxOneTimeValue, normative.dailyAverageValue, normative.singleValue, normative.obuvValue, normative.obuv]
    .find((value) => value !== undefined && value !== null && String(value).trim() !== '');
  return fallback === undefined ? '' : String(fallback);
};

export const protocolNormativeConditionLabel = (item: NormativeRecord) => [
  item.season,
  item.workCategory,
  item.workplaceType,
  item.roomType,
  item.normLevel,
  item.waterType,
  item.waterUseCategory,
  item.categoryName || item.categoryCode,
  item.appendixNo ? `приложение ${item.appendixNo}` : '',
  item.tableNo ? `таблица ${item.tableNo}` : '',
].filter(Boolean).join(' · ') || item.conditionJson || '';
