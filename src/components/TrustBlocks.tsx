import { Award, Beaker, Building2, ClipboardCheck, FileCheck2, FolderCheck, Recycle, ShieldCheck, Truck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { trustDocuments } from '../content/trust-documents/trustDocuments';
import { publicContentRepository } from '../content/apiRepository';

const reasons = [
  ['Работаем с юридическими лицами и ИП', Building2],
  ['Готовим документы под требования РК', FileCheck2],
  ['Организуем вывоз и утилизацию отходов', Recycle],
  ['Организуем лабораторные исследования', Beaker],
  ['Предоставляем услуги полигона ТБО', Truck],
  ['Сопровождаем проверки', ShieldCheck],
  ['Все этапы можно контролировать в личном кабинете', ClipboardCheck],
] as const;

export const TrustSection = () => <section id="trust" className="bg-white px-4 py-14 sm:px-8 sm:py-16"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start"><div className="max-w-xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Единый подрядчик</p><h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Экологические задачи — в одном процессе</h2><p className="mt-4 leading-7 text-slate-600">Объединяем проектирование, лабораторные исследования и сопровождение предприятия до согласованного результата.</p></div><div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">{reasons.slice(0, 4).map(([title, Icon], index) => <div key={title} className="flex gap-4 border-t border-slate-200 pt-5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-eco-50 text-eco-700"><Icon size={22} /></span><div><span className="text-xs font-black text-eco-300">0{index + 1}</span><p className="mt-1 text-sm font-bold leading-6 text-eco-900">{title}</p></div></div>)}</div></div></section>;

export const DocumentsSection = () => {
  const { data: documents = [], isError } = useQuery({
    queryKey: ['public-content', 'trust-documents'],
    queryFn: () => publicContentRepository.getTrustDocuments(),
    initialData: import.meta.env.DEV ? trustDocuments : undefined,
    staleTime: 5 * 60 * 1000,
  });
  return <section id="documents" className="bg-[#F7FBFD] px-4 py-14 sm:px-8 sm:py-16"><div className="mx-auto max-w-7xl"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-3xl"><h2 className="text-2xl font-bold text-eco-900 sm:text-3xl">Проверяемые документы и разрешения</h2><p className="mt-3 text-sm leading-6 text-slate-600">Показываем статус реквизитов и не обозначаем документ действующим без подтверждения.</p></div><span className="text-sm font-semibold text-eco-600">Прозрачность до начала работ</span></div>{isError && <p className="mt-6 text-sm text-rose-700">Не удалось загрузить подтверждающие документы.</p>}<div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{documents.map((document) => <article key={document.id} className="rounded-[20px] border border-eco-100 bg-white p-5"><FolderCheck className="text-eco-600" size={22} /><h3 className="mt-4 text-sm font-bold leading-6 text-eco-900">{document.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{document.publicDescription}</p><p className={`mt-3 text-xs font-bold ${document.verificationStatus === 'verified' ? 'text-eco-700' : document.verificationStatus === 'expired' ? 'text-rose-700' : 'text-amber-700'}`}>{document.verificationStatus === 'verified' ? 'Реквизиты проверены' : document.verificationStatus === 'expired' ? 'Срок действия истёк' : 'Реквизиты требуют проверки'}</p>{document.fileUrl && <a href={document.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex text-sm font-semibold text-eco-700 underline">Открыть копию документа</a>}</article>)}</div></div></section>;
};

export const TrustCompact = () => <div className="grid gap-3 sm:grid-cols-2">{reasons.slice(0, 4).map(([title, Icon]) => <div key={title} className="flex items-start gap-3 rounded-2xl bg-eco-50 p-4 text-sm font-semibold text-eco-900"><Icon className="shrink-0 text-eco-600" size={19} /><span>{title}</span></div>)}</div>;

export const CertificateBadge = () => <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-eco-900 shadow-sm"><Award size={17} className="text-eco-600" /> Документы доступны по запросу</div>;
