import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AeoFaqItem, ServiceContent } from '../../content/types';
import { publicContentRepository } from '../../content/apiRepository';
import { isPublishableCaseStudy } from '../../content/cases/caseStudyPolicy';
import { isPublishableExpert } from '../../content/experts/experts';
import { experts as snapshotExperts } from '../../content/experts/experts';
import { caseStudies } from '../../content/cases/caseStudies';
import WhatsAppButton from '../WhatsAppButton';

const card = 'rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm';

export const normalizeAeoFaq = (item: AeoFaqItem) => {
  const source = (item.answer ?? item.explanation ?? '').trim();
  const firstSentence = source.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? source;
  return {
    question: item.question,
    shortAnswer: (item.shortAnswer ?? firstSentence).trim(),
    explanation: (item.explanation ?? source).trim(),
  };
};

export const AeoFaqList = ({ faq }: { faq: readonly AeoFaqItem[] }) => (
  <div className="mt-8 grid gap-4 md:grid-cols-2">
    {faq.map((raw) => {
      const item = normalizeAeoFaq(raw);
      return <article key={item.question} className={card}>
        <h3 className="text-lg font-bold leading-7 text-eco-900">{item.question}</h3>
        <p className="mt-3 font-semibold leading-7 text-eco-950"><span className="sr-only">Короткий ответ: </span>{item.shortAnswer}</p>
        {item.explanation && item.explanation !== item.shortAnswer && <p className="mt-3 text-sm leading-6 text-slate-600">{item.explanation}</p>}
      </article>;
    })}
  </div>
);

export const RelatedCaseStudies = ({ service, city }: { service?: string; city?: string }) => {
  const { data = [], isError } = useQuery({
    queryKey: ['public-content', 'cases'],
    queryFn: () => publicContentRepository.getCases(),
    initialData: caseStudies,
    staleTime: 5 * 60 * 1000,
  });
  if (isError) return null;
  const cases = data.filter((item) => isPublishableCaseStudy(item)
    && (!service || item.service === service)
    && (!city || item.city === city));
  if (!cases.length) return null;
  return <section aria-labelledby="related-cases-title">
    <h2 id="related-cases-title" className="text-3xl font-bold text-eco-900">Реализованные проекты / Кейсы</h2>
    <p className="mt-4 max-w-4xl leading-7 text-slate-600">Показываем только опубликованные проекты с проверенными исходными данными и результатом.</p>
    <div className="mt-6 grid gap-4 md:grid-cols-2">{cases.map((item) => <Link key={item.id} to={`/cases/${item.slug}`} className={`${card} block hover:border-eco-300`}><p className="text-xs font-bold uppercase text-eco-500">{item.industry} · {item.city}</p><h3 className="mt-2 text-xl font-bold text-eco-900">{item.title}</h3><p className="mt-4 text-sm leading-6 text-slate-600"><strong className="text-slate-900">Задача:</strong> {item.problem}</p><p className="mt-2 text-sm leading-6 text-slate-600"><strong className="text-slate-900">Что сделали:</strong> {item.workPerformed.join('; ')}</p><p className="mt-2 text-sm leading-6 text-slate-600"><strong className="text-slate-900">Результат:</strong> {item.result}</p></Link>)}</div>
  </section>;
};

export const VerifiedExperts = () => {
  const { data = [], isError } = useQuery({
    queryKey: ['public-content', 'experts'],
    queryFn: () => publicContentRepository.getExperts(),
    initialData: snapshotExperts,
    staleTime: 5 * 60 * 1000,
  });
  const experts = data.filter(isPublishableExpert).slice(0, 3);
  if (isError || !experts.length) return null;
  return <section aria-labelledby="verified-experts-title">
    <h2 id="verified-experts-title" className="text-3xl font-bold text-eco-900">Подтверждённые специалисты</h2>
    <div className="mt-6 grid gap-4 md:grid-cols-3">{experts.map((expert) => <article key={expert.id} className={card}>
      <a href={expert.profileUrl} className="text-lg font-bold text-eco-900 underline decoration-eco-200">{expert.fullName}</a>
      <p className="mt-1 text-sm text-slate-600">{expert.position} · опыт {expert.experienceYears} лет</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{expert.specialization.join(' · ')}</p>
    </article>)}</div>
  </section>;
};

const DirectSection = ({ title, answer, children }: { title: string; answer: string; children?: ReactNode }) => <section className={card}>
  <h2 className="text-2xl font-bold text-eco-900">{title}</h2>
  <p className="mt-4 leading-7 text-slate-700">{answer.trim()}</p>
  {children}
</section>;

const bullets = (items: string[]) => items.length ? <ul className="mt-5 list-disc space-y-2 pl-6 text-sm leading-6 text-slate-600">{items.map((item) => <li key={item}>{item}</li>)}</ul> : null;

const Workflow = ({ content }: { content: ServiceContent }) => <ol className="mt-6 grid gap-4 md:grid-cols-2">
  {content.workflow.map((step) => <li key={step.order} className={card}>
    <p className="text-xs font-bold uppercase tracking-wide text-eco-500">Этап {step.order}</p>
    <h3 className="mt-2 text-lg font-bold text-eco-900">{step.title}</h3>
    <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
    {step.result && <p className="mt-3 text-sm font-semibold text-eco-800">Результат: {step.result}</p>}
  </li>)}
</ol>;

const PricingFactors = ({ content }: { content: ServiceContent }) => <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
  <table className="w-full text-left text-sm">
    <thead className="bg-eco-50 text-eco-900"><tr><th className="px-4 py-3 font-bold">Фактор</th><th className="px-4 py-3 font-bold">На что влияет</th></tr></thead>
    <tbody>{content.pricingFactors.map((item) => <tr key={item.title} className="border-t border-slate-200"><td className="px-4 py-3 font-semibold text-slate-900">{item.title}</td><td className="px-4 py-3 leading-6 text-slate-600">{item.description}</td></tr>)}</tbody>
  </table>
</div>;

export const ServiceAeoContent = ({ content }: { content: ServiceContent }) => {
  const aeo = content.aeo;
  const targetItems = content.targetClients.map((item) => item.description ? `${item.title}: ${item.description}` : item.title);
  const requiredItems = content.whenRequired.map((item) => `${item.title}: ${item.description}`);
  const documentItems = content.requiredDocuments.map((item) => `${item.title}${item.description ? ` — ${item.description}` : ''}`);
  const deliverableItems = content.deliverables.map((item) => `${item.title}: ${item.description}`);
  const mistakeItems = content.risks.map((item) => `${item.risk}. Как избежать: ${item.prevention}`);
  const commercial = content.commercial;
  return <div className="mx-auto max-w-7xl space-y-10">
    <DirectSection title={commercial.audienceTitle} answer={aeo.targetAudience}>{bullets(targetItems)}</DirectSection>
    <DirectSection title={commercial.requiredTitle} answer={aeo.whenRequired}>{bullets(requiredItems)}<div className="mt-5 rounded-xl bg-slate-50 p-4"><h3 className="font-bold text-eco-900">Когда услуга может не потребоваться</h3><p className="mt-2 text-sm leading-6 text-slate-600">{aeo.whenNotRequired}</p></div></DirectSection>
    <DirectSection title={commercial.scopeTitle} answer={aeo.shortAnswer}><Workflow content={content} /></DirectSection>
    <DirectSection title={commercial.documentsTitle} answer={aeo.requiredDocuments}>{bullets(documentItems)}<p className="mt-5 rounded-xl bg-eco-50 p-4 text-sm font-semibold leading-6 text-eco-900">Если полного комплекта документов нет — отправьте имеющиеся материалы. Специалист проверит их и сообщит, каких данных не хватает.</p><WhatsAppButton label="Отправить документы на проверку" message={commercial.documentsWhatsAppMessage} className="mt-5" /></DirectSection>
    <DirectSection title={commercial.timelineTitle} answer={aeo.duration}><p className="mt-4 text-sm font-semibold text-eco-800">Предварительный срок определим после проверки исходных данных.</p></DirectSection>
    <DirectSection title={commercial.pricingTitle} answer={aeo.pricing}><p className="mt-4 text-lg font-bold text-eco-800">{content.summary.priceText}</p><PricingFactors content={content} /><a href="#lead" className="mt-5 inline-flex rounded-full bg-eco-900 px-5 py-3 text-sm font-bold text-white hover:bg-eco-800">Получить точный расчёт стоимости</a></DirectSection>
    <DirectSection title={commercial.deliverablesTitle} answer={aeo.deliverables}>{bullets(deliverableItems)}</DirectSection>
    <DirectSection title={commercial.regulationsTitle} answer={aeo.legalBasis}><ul className="mt-5 space-y-3">{content.legalBasis.map((item) => <li key={`${item.title}-${item.number || ''}`} className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-eco-700 underline decoration-eco-200 underline-offset-4">{item.title}{item.number ? ` ${item.number}` : ''}</a> : <strong className="text-slate-900">{item.title}{item.number ? ` ${item.number}` : ''}</strong>}{item.note && <p className="mt-2">{item.note}</p>}<p className="mt-2 text-xs font-semibold text-slate-500">Статус: {item.verificationStatus === 'verified' ? 'источник проверен' : 'требуется проверка применимости к объекту'}</p></li>)}</ul></DirectSection>
    <DirectSection title={commercial.mistakesTitle} answer={aeo.commonMistakes}>{bullets(mistakeItems)}</DirectSection>
    <section><h2 className="text-3xl font-bold text-eco-900">{commercial.faqTitle}</h2><AeoFaqList faq={aeo.faq} /></section>
    <RelatedCaseStudies service={content.serviceSlug} />
  </div>;
};
