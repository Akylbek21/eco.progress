import type { CompanyDetails } from '../../types/companies';

const display = (value?: string) => value || '—';
const formatDate = (value?: string) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString('ru-RU') : '—';
const Section = ({ title, rows }: { title: string; rows: Array<[string, string | undefined]> }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-bold text-slate-900">{title}</h2>
    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
      {rows.map(([label, item]) => <div key={label} className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-900">{display(item)}</dd></div>)}
    </dl>
  </section>
);

const CompanyDetailsBlock = ({ company, compact = false }: { company: CompanyDetails; compact?: boolean }) => {
  const mainRows: Array<[string, string | undefined]> = [
    ['Наименование', company.name], ['Краткое наименование', company.shortName], ['БИН', company.bin],
    ['Юридический адрес', company.legalAddress], ['Фактический адрес', company.actualAddress],
    ['Телефон', company.phone], ['Email', company.email], ['Сайт', company.website],
    ['Руководитель', company.directorFullName], ['Контактное лицо', company.contactPerson],
    ['Телефон контактного лица', company.contactPhone], ['Email контактного лица', company.contactEmail],
  ];
  if (compact) return <section className="rounded-2xl border border-eco-100 bg-eco-50/70 p-4"><h3 className="text-sm font-bold text-eco-900">Данные компании</h3><dl className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{mainRows.map(([label, item]) => <div key={label} className="rounded-xl bg-white/80 px-3 py-2"><dt className="text-[11px] font-semibold uppercase text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-900">{display(item)}</dd></div>)}</dl></section>;
  return <div className="grid gap-5 xl:grid-cols-2">
    <Section title="Основные данные" rows={mainRows} />
    <Section title="Реквизиты" rows={[[ 'Банк', company.bankName ], [ 'БИК', company.bik ], [ 'IBAN', company.iban ], [ 'КБЕ', company.kbe ], [ 'КНП', company.knp ], [ 'Примечание', company.notes ]]} />
    {(company.contractNumber || company.contractDate) && <Section title="Договор" rows={[[ 'Номер договора', company.contractNumber ], [ 'Дата договора', formatDate(company.contractDate) ]]} />}
    <Section title="Системная информация" rows={[[ 'Дата создания', formatDate(company.createdAt) ], [ 'Дата изменения', formatDate(company.updatedAt) ]]} />
  </div>;
};

export default CompanyDetailsBlock;
