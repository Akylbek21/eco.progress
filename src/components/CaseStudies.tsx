import { publishedCaseStudies } from '../content/cases/caseStudies';
import Button from './ui/Button';

const CaseStudies = () => (
  <section id="cases" className="bg-white px-4 py-16 sm:px-8 sm:py-20">
    <div className="mx-auto max-w-7xl">
      <div className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Кейсы</p><h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Подтверждённые проекты EcoProgress</h2><p className="mt-4 leading-7 text-slate-600">Мы публикуем только кейсы, для которых проверены факты и получено согласие клиента. Обобщённые примеры не выдаются за выполненные проекты.</p></div>
      {publishedCaseStudies.length > 0 ? <div className="mt-10 grid gap-5 lg:grid-cols-3">{publishedCaseStudies.map((item) => <article key={item.slug} className="flex h-full flex-col rounded-[20px] border border-slate-200 bg-white p-6 shadow-lg shadow-eco-900/5"><p className="text-xs font-bold uppercase text-eco-500">{item.industry} · {item.region}</p><h3 className="mt-3 text-xl font-bold text-eco-900">{item.title}</h3><p className="mt-4 text-sm leading-6 text-slate-600">{item.initialSituation}</p><h4 className="mt-5 font-bold text-eco-900">Что сделали</h4><ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">{item.workCompleted.map((work) => <li key={work}>{work}</li>)}</ul><h4 className="mt-5 font-bold text-eco-900">Подтверждённый результат</h4><ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">{item.result.map((result) => <li key={result}>{result}</li>)}</ul><Button asChild className="mt-6 w-full"><a href="#lead">Обсудить похожую задачу</a></Button></article>)}</div> : <div className="mt-8 rounded-[22px] border border-eco-200 bg-eco-50 p-6"><h3 className="text-xl font-bold text-eco-900">Материалы проходят согласование</h3><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Проверенные кейсы будут опубликованы после подтверждения исходных данных и разрешения клиентов. До этого момента мы не показываем вымышленные показатели, сроки или отзывы.</p></div>}
    </div>
  </section>
);

export default CaseStudies;
