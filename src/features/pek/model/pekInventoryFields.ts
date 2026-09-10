import type { InventoryKind, InventoryPayload } from '../api/pekInventory';
import { serializeCoordinates } from '../utils/pekCoordinates';

export type InventoryField = { key: string; label: string; type?: 'decimal' | 'integer' | 'waste'; required?: boolean; max?: number };
const field = (key: string, label: string, type?: InventoryField['type'], required?: boolean, max?: number): InventoryField => ({ key, label, type, required, max });
const common = [field('coordinates', 'Координаты'), field('description', 'Описание'), field('sortOrder', 'Порядок в списке', 'integer')];
export const inventoryDefinitions: Record<InventoryKind, { title: string; fields: InventoryField[] }> = {
  'emission-sources': { title: 'Источники выбросов', fields: [
    field('code', 'Номер / код источника', undefined, true), field('name', 'Название', undefined, true),
    field('sourceType', 'Тип источника'), field('workshopName', 'Цех / участок'),
    field('heightM', 'Высота, м', 'decimal'), field('diameterM', 'Диаметр, м', 'decimal'),
    field('gasCleaningEquipment', 'Газоочистное оборудование'), field('cleaningEfficiencyPercent', 'Степень очистки, %', 'decimal', false, 100),
    field('operatingHoursPerYear', 'Часов работы в год', 'integer'), ...common,
  ] },
  'discharge-sources': { title: 'Выпуски сточных вод', fields: [
    field('code', 'Номер / код выпуска', undefined, true), field('name', 'Название', undefined, true),
    field('receivingWaterBody', 'Принимающий водный объект'), field('dischargeType', 'Тип сброса'),
    field('permittedVolume', 'Разрешённый объём', 'decimal'), field('volumeUnit', 'Единица объёма'),
    field('treatmentFacilities', 'Очистные сооружения'), ...common,
  ] },
  'waste-items': { title: 'Виды отходов', fields: [
    field('name', 'Название', undefined, true), field('code', 'Код отхода'),
    field('hazardClass', 'Класс опасности'), field('accumulationLimit', 'Лимит накопления', 'decimal'),
    field('limitUnit', 'Единица измерения'), field('accumulationPeriodDays', 'Срок накопления, дней', 'integer'),
    field('storageSiteName', 'Место хранения'), ...common,
  ] },
  'waste-movements': { title: 'Движение отходов за период отчёта', fields: [
    field('wasteItemId', 'Вид отхода', 'waste', true),
    field('openingBalance', 'Остаток на начало', 'decimal'), field('generated', 'Образовано', 'decimal'),
    field('transferred', 'Передано', 'decimal'), field('disposed', 'Утилизировано / удалено', 'decimal'),
    field('closingBalance', 'Остаток на конец', 'decimal'), field('receiverName', 'Получатель'),
    field('receiverBin', 'БИН получателя'), field('note', 'Примечание'),
  ] },
};

export function inventoryPayload(kind: InventoryKind, values: Record<string, string>): InventoryPayload {
  return Object.fromEntries(inventoryDefinitions[kind].fields.map(({ key, label, type, required, max }) => {
    const value = (values[key] ?? '').trim();
    if (!value) {
      if (required) throw new Error(`Заполните поле «${label}».`);
      return [key, null];
    }
    if (type === 'decimal' || type === 'integer' || type === 'waste') {
      const normalized = value.replace(',', '.');
      const pattern = type === 'decimal' ? /^\d+(?:\.\d+)?$/ : /^\d+$/;
      if (!pattern.test(normalized)) throw new Error(`«${label}»: укажите неотрицательное число${type === 'decimal' ? '' : ' без дробной части'}.`);
      if (max !== undefined && Number(normalized) > max) throw new Error(`«${label}»: максимум ${max}.`);
      if (type !== 'decimal' && (!Number.isSafeInteger(Number(normalized)) || Number(normalized) > 2147483647)) throw new Error(`«${label}»: слишком большое число.`);
      // Keep decimal strings intact: the backend uses BigDecimal.
      return [key, type === 'decimal' ? normalized : Number(normalized)];
    }
    if (key === 'receiverBin' && !/^\d{12}$/.test(value)) throw new Error('БИН получателя должен состоять из 12 цифр.');
    if (key === 'coordinates') {
      const parts = value.split(',').map(part => part.trim());
      if (parts.length !== 2 || !parts.every(Boolean)) throw new Error('Координаты: укажите широту и долготу через запятую, например 52.905785, 69.153399.');
      return [key, serializeCoordinates(parts[0], parts[1])];
    }
    return [key, value];
  }));
}
