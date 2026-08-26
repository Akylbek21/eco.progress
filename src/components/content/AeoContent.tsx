import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AeoFaqItem, ServiceContent } from '../../content/types';
import { publicContentRepository } from '../../content/apiRepository';
import { isPublishableCaseStudy } from '../../content/cases/caseStudyPolicy';
import { isCompleteExpert } from '../../content/experts/experts';

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
    staleTime: 5 * 60 * 1000,
  });
  if (isError) return null;
  const cases = data.filter((item) => isPublishableCaseStudy(item)
    && (!service || item.service === service)
    && (!city || item.city === city));
  if (!cases.length) return null;
  return <section aria-labelledby="related-cases-title">
    <h2 id="related-cases-title" className="text-3xl font-bold text-eco-900">Связанные подтверждённые кейсы</h2>
    <p className="mt-4 max-w-4xl leading-7 text-slate-600">Здесь показаны только опубликованные проекты с проверенными исходными данными, результатом, специалистом и reviewer. Если клиент запретил раскрывать название, используется обезличенное описание.</p>
    <div className="mt-6 grid gap-4 md:grid-cols-2">{cases.map((item) => <Link key={item.id} to={`/cases/${item.slug}`} className={`${card} block hover:border-eco-300`}><p className="text-xs font-bold uppercase text-eco-500">{item.industry} · {item.city}</p><h3 className="mt-2 text-xl font-bold text-eco-900">{item.title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{item.result}</p></Link>)}</div>
  </section>;
};

export const VerifiedExperts = () => {
  const { data = [], isError } = useQuery({
    queryKey: ['public-content', 'experts'],
    queryFn: () => publicContentRepository.getExperts(),
    staleTime: 5 * 60 * 1000,
  });
  const experts = data.filter(isCompleteExpert).slice(0, 3);
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

export const ServiceAeoContent = ({ content }: { content: ServiceContent }) => {
  const aeo = content.aeo;
  const targetItems = content.targetClients.map((item) => item.description ? `${item.title}: ${item.description}` : item.title);
  const requiredItems = content.whenRequired.map((item) => `${item.title}: ${item.description}`);
  const documentItems = content.requiredDocuments.map((item) => `${item.title}${item.description ? ` — ${item.description}` : ''}`);
  const deliverableItems = content.deliverables.map((item) => `${item.title}: ${item.description}`);
  const legalItems = content.legalBasis.map((item) => `${item.title}${item.number ? ` ${item.number}` : ''}`);
  const mistakeItems = content.risks.map((item) => `${item.risk}. Как избежать: ${item.prevention}`);
  return <div className="mx-auto max-w-7xl space-y-10">
    {content.sections?.map((section) => <DirectSection key={section.title} title={section.title} answer={section.body} />)}
    <DirectSection title="Короткий ответ" answer={aeo.shortAnswer} />
    <DirectSection title="Кому нужна услуга" answer={aeo.targetAudience}>{bullets(targetItems)}</DirectSection>
    <DirectSection title="Когда она обязательна" answer={aeo.whenRequired}>{bullets(requiredItems)}</DirectSection>
    <DirectSection title="Когда не требуется" answer={aeo.whenNotRequired} />
    <DirectSection title="Какие документы нужны" answer={aeo.requiredDocuments}>{bullets(documentItems)}</DirectSection>
    <DirectSection title="Что получает заказчик" answer={aeo.deliverables}>{bullets(deliverableItems)}</DirectSection>
    <DirectSection title="Сколько занимает по времени" answer={aeo.duration} />
    <DirectSection title="От чего зависит стоимость" answer={aeo.pricing}>{bullets(content.pricingFactors.map((item) => `${item.title}: ${item.description}`))}</DirectSection>
    <DirectSection title="Нормативная база" answer={aeo.legalBasis}>{bullets(legalItems)}</DirectSection>
    <DirectSection title="Частые ошибки" answer={aeo.commonMistakes}>{bullets(mistakeItems)}</DirectSection>
    <section><h2 className="text-3xl font-bold text-eco-900">FAQ</h2><AeoFaqList faq={aeo.faq} /></section>
    <VerifiedExperts />
    <RelatedCaseStudies service={content.serviceSlug} />
  </div>;
};
