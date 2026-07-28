import { useFormContext } from 'react-hook-form';
import type { Company, CompanyObject } from '../../../../types/companies';
import type { LaboratoryEmployee, LaboratoryListItem } from '../../../../types/laboratories';
import {
  getWaterTypeLabel,
  getWaterUseCategoryLabel,
  isWaterProtocolType,
  type ProtocolSelectOption,
} from '../../../../config/protocolWater';
import { PROTOCOL_TEMPLATES } from '../../utils/protocolTemplates';
import WizardValidationSummary, { type WizardIssue } from '../components/WizardValidationSummary';
import type { ProtocolWizardForm } from '../wizardTypes';

type Props = {
  companies: Company[];
  objects: CompanyObject[];
  laboratories: LaboratoryListItem[];
  employees: LaboratoryEmployee[];
  issues: WizardIssue[];
  onGoTo: (step: number, field?: WizardIssue['field']) => void;
  waterTypeOptions: ProtocolSelectOption[];
  waterUseCategoryOptions: ProtocolSelectOption[];
  final?: boolean;
  apiPayloadValid: boolean;
};
const ReviewStep = ({
  companies,
  objects,
  laboratories,
  employees,
  issues,
  onGoTo,
  waterTypeOptions,
  waterUseCategoryOptions,
  final,
  apiPayloadValid,
}: Props) => {
  const { watch } = useFormContext<ProtocolWizardForm>();
  const form = watch();
  const rows: Array<[string, string, number]> = [
    ['Тип протокола', form.templateId ? PROTOCOL_TEMPLATES[form.templateId].label : 'Не выбран', 0],
    ['Компания и объект', `${companies.find((item) => item.id === form.companyId)?.name || '—'} · ${objects.find((item) => item.id === form.objectId)?.name || '—'}`, 1],
    ['Лаборатория и исполнитель', `${laboratories.find((item) => String(item.id) === form.laboratoryId)?.name || '—'} · ${employees.find((item) => String(item.id) === form.executorId)?.fullName || '—'}`, 2],
    ['Даты и место', `${form.measurementDate || '—'} · ${form.measurementPlace || '—'}`, 3],
    ['Условия среды', `${form.temperature || '—'} °C · ${form.humidity || '—'} %`, 4],
    ['Результаты, приборы и нормативы', `${form.results.filter((item) => item.indicatorName || item.value).length} строк`, 5],
    ['Методики', form.testingMethodNd || 'Не заполнено', 6],
  ];
  const selectedObject = objects.find((item) => String(item.id) === form.objectId);
  const selectedEmployee = employees.find((item) => String(item.id) === form.executorId);
  const technicalChecks: Array<[string, boolean]> = [
    ['Компания выбрана', Number(form.companyId) > 0],
    ['Выбран реальный сохранённый объект', Boolean(
      selectedObject
      && Number(selectedObject.id) > 0
      && selectedObject.isVirtual !== true
      && selectedObject.virtual !== true
      && selectedObject.persisted !== false
    )],
    ['Лаборатория и исполнитель проверены', Boolean(
      Number(form.laboratoryId) > 0
      && selectedEmployee?.active
      && String(selectedEmployee.laboratoryId) === form.laboratoryId
    )],
    ['Даты и место измерения корректны', Boolean(form.measurementDate && form.measurementPlace.trim())],
    ['Строки результатов заполнены', form.results.some((row) => String(row.value).trim() !== '' || row.textValue.trim() !== '')],
    ['Единицы измерения и приборы проверены', form.results.length > 0 && form.results.every((row) => row.unit.trim() && Number(row.measurementDeviceId) > 0)],
    ['Коды показателей или физических факторов заполнены', form.results.length > 0 && form.results.every((row) => (row.pollutantCode || row.factorCode || row.factorType).trim())],
    ['Характеристики воды проверены, если применимо', !isWaterProtocolType(form.templateId) || Boolean(form.waterType && form.waterUseCategory)],
    ['Методика испытаний заполнена', Boolean(form.testingMethodNd.trim())],
  ];
  const contextLinks = [
    ['Заявка', form.orderId],
    ['Позиция заявки', form.orderServiceItemId],
    ['Программа ПЭК', form.pekProgramId],
    ['Отчёт ПЭК', form.pekReportId],
    ['Контрольный пункт ПЭК', form.pekControlItemId],
    ['Контрольное событие ПЭК', form.pekControlEventId],
    ['Точка мониторинга', form.monitoringPointId],
    ['Источник выброса', form.emissionSourceId],
    ['Выпуск воды', form.waterOutletId],
  ].filter(([, value]) => Boolean(value));
  return (
    <section>
      <h3 id="wizard-step-title" tabIndex={-1} className="text-xl font-black">{final ? 'Создание протокола' : 'Проверка данных'}</h3>
      <p className="mt-2 text-sm text-slate-500">{final ? 'После нажатия будет отправлен один запрос POST /api/protocols/quick-create.' : 'Проверьте сводку перед созданием.'}</p>
      {final && apiPayloadValid && issues.length === 0 && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
          Все обязательные данные заполнены. Можно переходить к созданию.
        </div>
      )}
      {final && (
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {technicalChecks.map(([label, valid]) => (
            <li key={label} className={`rounded-lg border px-3 py-2 font-semibold ${valid ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              {valid ? '✓' : '•'} {label}
            </li>
          ))}
        </ul>
      )}
      {isWaterProtocolType(form.templateId) && (
        <article className="mt-5 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-black text-slate-900">Характеристики воды</h4>
              <dl className="mt-3 space-y-2 text-sm">
                <div><dt className="inline text-slate-500">Тип воды: </dt><dd className="inline font-semibold">{getWaterTypeLabel(form.waterType, waterTypeOptions)}</dd></div>
                <div><dt className="inline text-slate-500">Категория водопользования: </dt><dd className="inline font-semibold">{getWaterUseCategoryLabel(form.waterUseCategory, waterUseCategoryOptions)}</dd></div>
              </dl>
            </div>
            <button type="button" onClick={() => onGoTo(4, !form.waterType ? 'waterType' : !form.waterUseCategory ? 'waterUseCategory' : undefined)} className="font-bold text-eco-700">Исправить</button>
          </div>
        </article>
      )}
      {contextLinks.length > 0 && (
        <article className="mt-5 rounded-2xl border border-eco-200 bg-eco-50/60 p-4">
          <h4 className="font-black text-slate-900">Связи с заявкой и ПЭК</h4>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {contextLinks.map(([label, value]) => <div key={label}><dt className="inline text-slate-500">{label}: </dt><dd className="inline font-semibold">{value}</dd></div>)}
          </dl>
        </article>
      )}
      <div className="mt-5 grid gap-3 md:grid-cols-2">{rows.map(([label, value, rowStep]) => <button key={label} type="button" onClick={() => onGoTo(rowStep)} className="rounded-xl border border-slate-200 bg-white p-4 text-left"><span className="text-xs font-bold uppercase text-slate-400">{label}</span><span className="mt-1 block font-semibold text-slate-900">{value}</span></button>)}</div>
      <div className="mt-5"><WizardValidationSummary issues={issues} onGoTo={onGoTo} /></div>
    </section>
  );
};
export default ReviewStep;
