import type { Protocol } from '../../../types/protocols';
import { formatProtocolDate, type ProtocolEditSection } from './protocolDetailsModel';
import { getWaterTypeLabel, getWaterUseCategoryLabel, isWaterProtocolType } from '../../../config/protocolWater';

type Props = { protocol: Protocol; editable: boolean; onEdit: (section: ProtocolEditSection) => void };
const value = (item?: string | number | null) => item === undefined || item === null || String(item).trim() === '' ? 'Не заполнено' : String(item);

const Card = ({ title, editable, onEdit, children }: { title: string; editable: boolean; onEdit: () => void; children: React.ReactNode }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black">{title}</h2>{editable && <button type="button" onClick={onEdit} className="text-sm font-bold text-eco-700">Изменить</button>}</div>
    <dl className="mt-4 space-y-3 text-sm">{children}</dl>
  </article>
);
const Item = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="grid gap-1 sm:grid-cols-[150px_1fr]"><dt className="text-slate-500">{label}</dt><dd className="font-semibold text-slate-900">{children}</dd></div>;

const ProtocolMainDataTab = ({ protocol, editable, onEdit }: Props) => {
  const environment = protocol.environment || {};
  const executor = protocol.executor || protocol.laboratory.executorName || protocol.laboratory.executor;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Заказчик" editable={editable} onEdit={() => onEdit('organization')}>
        <Item label="Компания">{value(protocol.companySnapshot.companyName)}</Item><Item label="БИН">{value(protocol.companySnapshot.bin)}</Item><Item label="Объект">{value(protocol.companySnapshot.objectName)}</Item><Item label="Адрес">{value(protocol.companySnapshot.objectAddress)}</Item>
      </Card>
      <Card title="Испытание" editable={editable} onEdit={() => onEdit('general')}>
        <Item label="Дата отбора">{formatProtocolDate(protocol.testing.samplingDate || protocol.samplingDate)}</Item><Item label="Дата измерения">{formatProtocolDate(protocol.measurementDate)}</Item><Item label="Время">{value(protocol.measurementTime)}</Item><Item label="Место">{value(protocol.measurementPlace || protocol.samplingPlace)}</Item>
      </Card>
      <Card title="Лаборатория" editable={editable} onEdit={() => onEdit('laboratory')}>
        <Item label="Лаборатория">{value(protocol.laboratory.laboratoryName || protocol.laboratory.name)}</Item><Item label="Исполнитель">{value(executor)}</Item><Item label="Аккредитация">{protocol.laboratory.accreditationValidUntil ? `действительна до ${formatProtocolDate(protocol.laboratory.accreditationValidUntil)}` : 'Не заполнено'}</Item>
      </Card>
      <Card title="Условия измерения" editable={editable} onEdit={() => onEdit('environment')}>
        {isWaterProtocolType(protocol.templateId) && <><Item label="Тип воды">{getWaterTypeLabel(protocol.waterType || String(protocol.conditions?.waterType || ''))}</Item><Item label="Категория водопользования">{getWaterUseCategoryLabel(protocol.waterUseCategory || String(protocol.conditions?.waterUseCategory || ''))}</Item></>}
        {!environment.temperature && !environment.humidity && !environment.pressureKpa && !environment.pressure && !environment.windSpeed ? <Item label="Состояние">Условия измерения не заполнены</Item> : <><Item label="Температура">{value(environment.temperature)} °C</Item><Item label="Влажность">{value(environment.humidity)} %</Item><Item label="Давление">{value(environment.pressureKpa || environment.pressure)} кПа</Item><Item label="Ветер">{value(environment.windSpeed)} м/с</Item></>}
      </Card>
      <div className="lg:col-span-2"><Card title="Методика" editable={editable} onEdit={() => onEdit('methods')}><Item label="Метод испытаний">{value(protocol.testing.testingMethodDocument || protocol.testingMethodDocument)}</Item><Item label="Метод отбора">{value(protocol.testing.samplingMethodDocument || protocol.samplingMethodDocument)}</Item><Item label="Основание">{value(protocol.organization.testingBasis || protocol.testingBasis)}</Item></Card></div>
    </div>
  );
};

export default ProtocolMainDataTab;
