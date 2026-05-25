import { Award, Beaker, Building2, ClipboardCheck, FileCheck2, FolderCheck, Recycle, ShieldCheck, Truck } from 'lucide-react';

const reasons = [
  ['Работаем с юридическими лицами и ИП', Building2],
  ['Готовим документы под требования РК', FileCheck2],
  ['Организуем вывоз и утилизацию отходов', Recycle],
  ['Организуем лабораторные исследования', Beaker],
  ['Предоставляем услуги полигона ТБО', Truck],
  ['Сопровождаем проверки', ShieldCheck],
  ['Все этапы можно контролировать в личном кабинете', ClipboardCheck],
] as const;

const documents = ['Сертификаты специалистов', 'Разрешения на деятельность', 'Лабораторные протоколы', 'Документы по полигону', 'Документы по транспортировке отходов'];

export const TrustSection = () => (
  <section id="trust" className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20">
    <div className="mx-auto max-w-7xl">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Доверие</p>
        <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Почему выбирают ecoprogress.kz</h2>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reasons.map(([title, Icon]) => (
          <div key={title} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
            <Icon className="text-eco-600" size={24} />
            <p className="mt-4 text-sm font-bold leading-6 text-eco-900">{title}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export const DocumentsSection = () => (
  <section id="documents" className="bg-white px-4 py-16 sm:px-8 sm:py-20">
    <div className="mx-auto max-w-7xl">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Документы</p>
        <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Документы, сертификаты и разрешения</h2>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {documents.map((title) => (
          <div key={title} className="rounded-[20px] border border-dashed border-eco-200 bg-eco-50 p-5">
            <FolderCheck className="text-eco-600" size={24} />
            <p className="mt-4 text-sm font-bold leading-6 text-eco-900">{title}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export const TrustCompact = () => (
  <div className="grid gap-3 sm:grid-cols-2">
    {reasons.slice(0, 4).map(([title, Icon]) => (
      <div key={title} className="flex items-start gap-3 rounded-2xl bg-eco-50 p-4 text-sm font-semibold text-eco-900">
        <Icon className="shrink-0 text-eco-600" size={19} />
        <span>{title}</span>
      </div>
    ))}
  </div>
);

export const CertificateBadge = () => (
  <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-eco-900 shadow-sm">
    <Award size={17} className="text-eco-600" /> Документы доступны по запросу
  </div>
);
