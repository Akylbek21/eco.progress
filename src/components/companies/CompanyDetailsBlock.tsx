import type { Company } from '../../types/companies';

type Props = {
  company: Company;
  compact?: boolean;
};

const formatDate = (date?: string) => {
  if (!date) return '-';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('ru-RU');
};

const value = (item?: string) => item || '-';

const Section = ({ title, rows }: { title: string; rows: Array<[string, string | undefined]> }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-bold text-slate-900">{title}</h2>
    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
      {rows.map(([label, item]) => (
        <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className="mt-1 break-words text-sm font-semibold text-slate-900">{value(item)}</dd>
        </div>
      ))}
    </dl>
  </section>
);

const CompanyDetailsBlock = ({ company, compact = false }: Props) => {
  const protocolRows: Array<[string, string | undefined]> = [
    ['Заказчик', company.name],
    ['БИН / ИИН', company.bin],
    ['Юридический адрес', company.legalAddress],
    ['Фактический адрес', company.actualAddress],
    ['Телефон', company.phone],
    ['Email', company.email],
    ['Руководитель', company.directorFullName],
    ['Договор №', company.contractNumber],
    ['Дата договора', formatDate(company.contractDate)],
    ['Объект', company.objectName],
    ['Адрес объекта', company.objectAddress],
    ['Вид деятельности', company.activityType],
    ['Место отбора проб / замеров', company.samplingLocation],
    ['Представитель заказчика', company.customerRepresentative],
    ['Банк', company.bank],
    ['IBAN', company.iban],
    ['БИК', company.bik],
    ['КБЕ', company.kbe],
    ['КНП', company.knp],
  ];

  if (compact) {
    return (
      <section className="rounded-2xl border border-eco-100 bg-eco-50/70 p-4">
        <h3 className="text-sm font-bold text-eco-900">Данные компании</h3>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {protocolRows.map(([label, item]) => (
            <div key={label} className="rounded-xl bg-white/80 px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="mt-1 break-words text-sm font-semibold text-slate-900">{value(item)}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <Section
        title="Основные данные"
        rows={[
          ['Название', company.name],
          ['БИН / ИИН', company.bin],
          ['Юридический адрес', company.legalAddress],
          ['Фактический адрес', company.actualAddress],
          ['Телефон', company.phone],
          ['Email', company.email],
          ['Комментарий', company.comment],
          ['Дата добавления', formatDate(company.createdAt)],
        ]}
      />
      <Section
        title="Руководитель"
        rows={[
          ['ФИО руководителя', company.directorFullName],
          ['Должность', company.directorPosition],
          ['Ответственное лицо', company.contactPerson],
          ['Телефон ответственного', company.contactPhone],
        ]}
      />
      <Section
        title="Реквизиты"
        rows={[
          ['Банк', company.bank],
          ['IBAN', company.iban],
          ['БИК', company.bik],
          ['КБЕ', company.kbe],
          ['КНП', company.knp],
        ]}
      />
      <Section
        title="Договор"
        rows={[
          ['Договор №', company.contractNumber],
          ['Дата договора', formatDate(company.contractDate)],
        ]}
      />
      <Section
        title="Объект"
        rows={[
          ['Наименование объекта', company.objectName],
          ['Адрес объекта', company.objectAddress],
          ['Вид деятельности', company.activityType],
          ['Место отбора проб', company.samplingLocation],
          ['Представитель заказчика', company.customerRepresentative],
        ]}
      />
    </div>
  );
};

export default CompanyDetailsBlock;
