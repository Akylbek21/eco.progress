import type { ProtocolTemplate, ProtocolTemplateKey } from '../types/protocols';

export type ProtocolSelectOption = {
  value: string;
  label: string;
};

// Temporary fallback for the backend enum. Prefer options returned by
// GET /protocols/templates whenever that contract supplies them.
export const WATER_TYPE_OPTIONS: ProtocolSelectOption[] = [
  { value: 'DRINKING_WATER', label: 'Питьевая вода' },
  { value: 'SURFACE_WATER', label: 'Вода водного объекта' },
];

export const WATER_USE_CATEGORY_OPTIONS: ProtocolSelectOption[] = [
  { value: 'I', label: 'I категория' },
  { value: 'II', label: 'II категория' },
];

export const isWaterProtocolType = (templateId?: ProtocolTemplateKey | '' | null) =>
  templateId === 'water' || templateId === 'water_wastewater';

const getTemplateFields = (template?: ProtocolTemplate): Array<{
  key?: string;
  name?: string;
  options?: ProtocolSelectOption[];
}> => {
  if (!template) return [];
  const source = template as ProtocolTemplate & {
    fields?: Array<{ key?: string; name?: string; options?: ProtocolSelectOption[] }>;
    conditionFields?: Array<{ key?: string; name?: string; options?: ProtocolSelectOption[] }>;
    conditions?: { fields?: Array<{ key?: string; name?: string; options?: ProtocolSelectOption[] }> };
  };
  return source.conditionFields || source.conditions?.fields || source.fields || [];
};

export const getWaterProtocolOptions = (
  template?: ProtocolTemplate,
): { waterTypes: ProtocolSelectOption[]; waterUseCategories: ProtocolSelectOption[] } => {
  const fields = getTemplateFields(template);
  const optionsFor = (key: string) =>
    fields.find((field) => (field.key || field.name) === key)?.options?.filter(
      (option) => option.value && option.label,
    );

  return {
    waterTypes: optionsFor('waterType') || WATER_TYPE_OPTIONS,
    waterUseCategories: optionsFor('waterUseCategory') || WATER_USE_CATEGORY_OPTIONS,
  };
};

const labelFor = (
  value: string,
  options: ProtocolSelectOption[],
  unknownLabel: string,
  field: 'waterType' | 'waterUseCategory',
) => {
  if (!value) return 'Не заполнено';
  const option = options.find((item) => item.value === value);
  if (option) return option.label;
  if (import.meta.env.DEV) console.warn(`[protocol] Unknown ${field}`, value);
  return unknownLabel;
};

export const getWaterTypeLabel = (
  value: string,
  options: ProtocolSelectOption[] = WATER_TYPE_OPTIONS,
) => labelFor(value, options, 'Неизвестный тип воды', 'waterType');

export const getWaterUseCategoryLabel = (
  value: string,
  options: ProtocolSelectOption[] = WATER_USE_CATEGORY_OPTIONS,
) => labelFor(value, options, 'Неизвестная категория водопользования', 'waterUseCategory');

