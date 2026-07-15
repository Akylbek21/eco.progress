import { Link, useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import SEO from '../components/SEO';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import { company, getWhatsAppUrl } from '../config/company';
import { seoArticleMap } from '../data/seoArticles';

const NewsDetailsPage = () => {
  const { id } = useParams();
  const item = id ? seoArticleMap.get(id) : undefined;

  if (!item) {
    return (
      <div className="bg-eco-50 px-5 py-20">
        <SEO title="Новость не найдена | ECOPROGRESS" description="Материал не найден или был снят с публикации." robots="noindex,follow" />
        <div className="mx-auto max-w-3xl rounded-[24px] bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-eco-900">Новость не найдена</h1>
          <p className="mt-3 text-slate-600">Материал мог быть снят с публикации или ссылка устарела.</p>
          <Link to="/news" className="mt-6 inline-flex rounded-full bg-eco-800 px-5 py-3 text-sm font-semibold text-white">
            Вернуться к статьям
          </Link>
        </div>
      </div>
    );
  }

  const canonical = `${company.siteUrl}${item.slug}`;
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: item.h1,
      description: item.description,
      image: `${company.siteUrl}${item.image}`,
      datePublished: item.datePublished,
      dateModified: item.dateModified,
      author: { '@type': 'Organization', name: company.name },
      publisher: { '@type': 'Organization', name: company.name },
      mainEntityOfPage: canonical,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная', item: company.siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Статьи', item: `${company.siteUrl}/news` },
        { '@type': 'ListItem', position: 3, name: item.h1, item: canonical },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: item.faq.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
  ];

  return (
    <article className="bg-white">
      <SEO title={`${item.title} | ECOPROGRESS`} description={item.description} canonical={canonical} type="article" schema={schema} />
      <section className="relative overflow-hidden px-5 py-24 text-white sm:px-8">
        <ResponsiveImage fill src={item.image} alt={item.h1} priority width={1600} height={900} className="object-cover" />
        <div className="absolute inset-0 bg-eco-900/78" />
        <div className="relative mx-auto max-w-4xl">
          <nav className="flex flex-wrap gap-2 text-sm text-white/72" aria-label="Хлебные крошки">
            <Link to="/" className="hover:text-white">Главная</Link><span>/</span><Link to="/news" className="hover:text-white">Статьи</Link>
          </nav>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.22em] text-eco-200">{item.category} · {item.datePublished}</p>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">{item.h1}</h1>
          <p className="mt-5 text-lg leading-8 text-white/80">{item.description}</p>
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-5 py-14 text-lg leading-8 text-slate-700 sm:px-8">
        {item.sections.map((section) => (
          <section key={section.title} className="mb-8">
            <h2 className="text-2xl font-bold text-eco-900">{section.title}</h2>
            <p className="mt-3">{section.body}</p>
          </section>
        ))}
        <section className="mt-12 rounded-[8px] bg-eco-900 p-6 text-white">
          <h2 className="text-2xl font-bold">Нужна консультация по экологии?</h2>
          <p className="mt-3 text-base leading-7 text-white/75">Отправьте город, объект и вопрос. Специалист подскажет документы, сроки и следующий шаг.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="bg-accent text-eco-900 hover:bg-accent/90"><Link to="/contacts">Получить консультацию</Link></Button>
            <a href={getWhatsAppUrl(`Здравствуйте! Хочу консультацию по статье: ${item.h1}`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
              <MessageCircle size={18} /> WhatsApp
            </a>
          </div>
        </section>
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-eco-900">Частые вопросы</h2>
          <div className="mt-5 grid gap-4">
            {item.faq.map((faq) => (
              <div key={faq.question} className="rounded-[8px] border border-slate-200 bg-[#F7FBFD] p-5">
                <h3 className="font-bold text-eco-900">{faq.question}</h3>
                <p className="mt-2 text-base leading-7 text-slate-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-eco-900">Полезные ссылки</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {item.relatedLinks.map((link) => (
              <Link key={link.path} to={link.path} className="rounded-full border border-eco-200 bg-eco-50 px-4 py-2 text-sm font-semibold text-eco-800 hover:bg-eco-100">
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      </section>
    </article>
  );
};

export default NewsDetailsPage;
