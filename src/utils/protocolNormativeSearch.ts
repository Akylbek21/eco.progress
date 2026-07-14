import type { NormativeRecord } from '../types/protocols';

export type ProtocolNormativeSearchContext = {
  templateId: string;
  sourceDocumentCode?: string | null;
  environmentType?: string;
  factorType?: string;
  waterType?: string;
  waterUseCategory?: string;
  season?: string;
  workCategory?: string;
  workplaceType?: string;
  normLevel?: string;
  roomType?: string;
  visualWorkCategory?: string;
  lightingType?: string;
  noiseType?: string;
};

const templateAliases: Record<string, string[]> = {
  water: ['water', 'water_wastewater'],
  soil: ['soil'],
  ambient_air: ['ambient_air', 'atmospheric_air', 'industrial_emissions'],
  workplace_air: ['workplace_air', 'working_zone_air'],
  microclimate: ['microclimate', 'physical_factors'],
  lighting: ['lighting', 'physical_factors'],
  noise_vibration: ['noise_vibration', 'physical_factors'],
  uv_emf_laser: ['uv_emf_laser', 'physical_factors'],
};

const scopeQueries: Record<string, string[]> = {
  water: ['вода', 'воды', 'water'],
  soil: ['почва', 'грунт', 'soil'],
  ambient_air: ['воздух', 'атмосферный воздух'],
  workplace_air: ['рабочая зона', 'воздух рабочей зоны'],
  microclimate: ['микроклимат'],
  lighting: ['освещение', 'освещенность', 'освещённость'],
  noise_vibration: ['шум', 'вибрация', 'шум вибрация'],
  uv_emf_laser: ['уф', 'эмп', 'лазер', 'ультрафиолет'],
};

export const normalizeProtocolSearchText = (value: unknown) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/ё/g, 'е')
  .replace(/[‐‑‒–—−]/g, '-')
  .replace(/[^a-zа-я0-9.+/%-]+/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const canSearchProtocolNormative = (value: string) =>
  normalizeProtocolSearchText(value).replace(/[^a-zа-я0-9]/gi, '').length >= 2;

export const isProtocolScopeQuery = (value: string, templateId: string) => {
  const query = normalizeProtocolSearchText(value);
  return (scopeQueries[templateId] || []).some((candidate) => normalizeProtocolSearchText(candidate) === query);
};

const normalizedCode = (value: unknown) => normalizeProtocolSearchText(value)
  .replace(/[-\s]+/g, '_')
  .toUpperCase()
  .replace(/ДСМ/g, 'DSM')
  .replace(/^КР_DSM_?/, 'DSM_');

const equivalentGroups = [
  ['DRINKING_WATER', 'ПИТЬЕВАЯ_ВОДА'],
  ['SURFACE_WATER', 'ПОВЕРХНОСТНАЯ_ВОДА', 'ВОДА_ВОДНОГО_ОБЪЕКТА'],
  ['COLD', 'ХОЛОДНЫЙ_ПЕРИОД'],
  ['WARM', 'ТЕПЛЫЙ_ПЕРИОД'],
  ['PERMANENT', 'ПОСТОЯННОЕ_МЕСТО', 'ПОСТОЯННОЕ_РАБОЧЕЕ_МЕСТО'],
  ['TEMPORARY', 'ВРЕМЕННОЕ_МЕСТО', 'НЕПОСТОЯННОЕ_РАБОЧЕЕ_МЕСТО'],
  ['OPTIMAL', 'ОПТИМАЛЬНЫЙ'],
  ['ALLOWABLE', 'ДОПУСТИМЫЙ'],
];

const sameOptionalCode = (actual: unknown, expected: unknown) => {
  const left = normalizedCode(actual);
  const right = normalizedCode(expected);
  if (!left || !right || left === right) return true;
  return equivalentGroups.some((group) => group.includes(left) && group.includes(right));
};

const factorAliases = (factorType: string) => {
  const value = normalizedCode(factorType);
  if (value === 'NOISE_VIBRATION') return ['NOISE_VIBRATION', 'NOISE', 'VIBRATION', 'INFRASOUND', 'ULTRASOUND'];
  if (value === 'UV') return ['UV', 'ULTRAVIOLET', 'ULTRAVIOLET_RADIATION', 'ELECTROMAGNETIC_FIELD', 'LASER'];
  return [value];
};

export const matchesProtocolNormativeContext = (item: NormativeRecord, context: ProtocolNormativeSearchContext) => {
  if (item.active === false || item.archived || item.status === 'ARCHIVED' || item.status === 'INACTIVE') return false;
  if (![item.factorCode, item.pollutantCode, item.code, item.indicator, item.indicatorName, item.pollutantName, item.name].some((value) => String(value || '').trim())) return false;
  if (!sameOptionalCode(item.sourceDocumentCode, context.sourceDocumentCode)) return false;

  const itemTemplate = normalizeProtocolSearchText(item.templateId);
  const allowedTemplates = (templateAliases[context.templateId] || [context.templateId]).map(normalizeProtocolSearchText);
  if (itemTemplate && !allowedTemplates.includes(itemTemplate)) return false;

  if (!sameOptionalCode(item.waterType, context.waterType)) return false;
  if (context.factorType && item.factorType) {
    const allowedFactors = factorAliases(context.factorType);
    if (!allowedFactors.includes(normalizedCode(item.factorType))) return false;
  }
  return true;
};

const normativeText = (item: NormativeRecord) => normalizeProtocolSearchText([
  item.code,
  item.pollutantCode,
  item.factorCode,
  item.indicator,
  item.indicatorName,
  item.pollutantName,
  item.name,
  item.synonyms,
  item.cas,
  item.casNumber,
  item.formula,
  item.chemicalFormula,
  item.researchObject,
  item.environmentType,
  item.environment,
  item.category,
  item.categoryCode,
  item.categoryName,
  item.factorType,
  item.conditionJson,
].filter(Boolean).join(' '));

const contextScore = (item: NormativeRecord, context: ProtocolNormativeSearchContext) => {
  const pairs: Array<[unknown, unknown]> = [
    [item.season, context.season],
    [item.workCategory, context.workCategory],
    [item.workplaceType, context.workplaceType],
    [item.normLevel, context.normLevel],
    [item.roomType, context.roomType],
    [item.visualWorkCategory, context.visualWorkCategory],
    [item.lightingType, context.lightingType],
    [item.noiseType, context.noiseType],
    [item.waterUseCategory, context.waterUseCategory],
  ];
  return pairs.reduce((score, [actual, expected]) => {
    if (!actual || !expected) return score;
    return score + (sameOptionalCode(actual, expected) ? 8 : -2);
  }, 0);
};

const queryScore = (item: NormativeRecord, query: string, context: ProtocolNormativeSearchContext) => {
  if (isProtocolScopeQuery(query, context.templateId)) return 0;
  const normalizedQuery = normalizeProtocolSearchText(query);
  const text = normativeText(item);
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  if (!tokens.length || !tokens.every((token) => text.includes(token))) return Number.NEGATIVE_INFINITY;

  const code = normalizeProtocolSearchText(item.factorCode || item.pollutantCode || item.code);
  const name = normalizeProtocolSearchText(item.indicator || item.indicatorName || item.pollutantName || item.name);
  if (code === normalizedQuery) return 100;
  if (name === normalizedQuery) return 90;
  if (code.startsWith(normalizedQuery)) return 70;
  if (name.startsWith(normalizedQuery)) return 60;
  return 30;
};

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

export const filterAndRankProtocolNormatives = (
  items: NormativeRecord[],
  query: string,
  context: ProtocolNormativeSearchContext,
) => {
  const unique = new Map<string, NormativeRecord>();
  items.forEach((item) => unique.set(protocolNormativeIdentity(item), item));
  return Array.from(unique.values())
    .filter((item) => matchesProtocolNormativeContext(item, context))
    .map((item) => ({ item, score: queryScore(item, query, context) + contextScore(item, context) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => right.score - left.score)
    .map(({ item }) => item);
};

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
