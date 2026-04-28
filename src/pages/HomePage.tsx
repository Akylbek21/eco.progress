import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ServiceCard from '../components/content/ServiceCard';
import NewsCard from '../components/content/NewsCard';
import { getServices } from '../services/serviceService';
import { getNewsList } from '../services/newsService';
import SectionTitle from '../components/ui/SectionTitle';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { services as servicesData } from '../data/mockData';
import { news as newsData } from '../data/mockData';

const HomePage = () => {
  const { data: services = servicesData } = useQuery({ queryKey: ['services'], queryFn: getServices });
  const { data: news = newsData } = useQuery({ queryKey: ['news'], queryFn: getNewsList });

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:py-14">
      <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-6">
          <span className="inline-flex rounded-full bg-eco-100 px-4 py-2 text-sm font-semibold text-eco-700">
            Экологическое сопровождение бизнеса
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Eco.Progress — экологическое сопровождение бизнеса
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-600">
            Помогаем компаниям соблюдать экологические требования, готовить документацию, сдавать отчеты и проходить проверки.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link to="/services">
              <Button>Посмотреть услуги</Button>
            </Link>
            <Button variant="secondary">Заказать услугу</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <p className="text-sm uppercase tracking-[0.24em] text-eco-700">Опыт</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">12+ лет</p>
            </Card>
            <Card>
              <p className="text-sm uppercase tracking-[0.24em] text-eco-700">Клиентов</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">120+</p>
            </Card>
          </div>
        </div>
        <div className="rounded-[32px] bg-gradient-to-br from-eco-100 via-white to-eco-50 p-8 shadow-xl shadow-eco-200/50">
          <div className="rounded-[28px] border border-slate-200 bg-white p-8">
            <p className="text-sm uppercase tracking-[0.24em] text-eco-700">Популярные услуги</p>
            <div className="mt-6 space-y-4">
              {services.slice(0, 3).map((service) => (
                <div key={service.id} className="rounded-3xl border border-slate-200 bg-eco-50 p-5">
                  <div className="mb-3 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-eco-100 text-xl">{service.icon}</div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{service.title}</h3>
                      <p className="text-sm text-slate-600">{service.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <SectionTitle title="Почему Eco.Progress" subtitle="Наши преимущества" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Актуальные решения', description: 'Работаем по последним нормам и требованиям.' },
            { title: 'Персональный менеджер', description: 'Каждому клиенту назначается ответственный специалист.' },
            { title: 'Прозрачное сопровождение', description: 'Отчеты, сроки и документы доступны в личном кабинете.' },
            { title: 'Гибкие услуги', description: 'Подбираем формат сопровождения под бизнес клиента.' },
          ].map((item) => (
            <Card key={item.title} className="h-full">
              <p className="mb-4 text-sm uppercase tracking-[0.24em] text-eco-700">{item.title}</p>
              <p className="text-slate-600">{item.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <SectionTitle title="Как мы работаем" subtitle="Прозрачная схема" />
        <div className="grid gap-6 lg:grid-cols-4">
          {[
            { title: 'Анализ требований', description: 'Определяем необходимые документы и сроки.' },
            { title: 'Сбор данных', description: 'Подготовка материалов с вами и для вас.' },
            { title: 'Экспертная проверка', description: 'Оценка и корректировка каждой заявки.' },
            { title: 'Сдача и сопровождение', description: 'Отслеживаем процесс до результата.' },
          ].map((item) => (
            <Card key={item.title} className="text-center">
              <p className="mb-3 text-xl font-semibold text-eco-800">{item.title}</p>
              <p className="text-slate-600">{item.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <SectionTitle title="Последние новости" subtitle="Актуальные материалы" />
        <div className="grid gap-6 lg:grid-cols-3">
          {news.slice(0, 3).map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-[32px] bg-eco-900 px-8 py-12 text-white shadow-2xl shadow-eco-800/20 sm:px-12">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-200">Закажите услугу сегодня</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Получите бесплатную консультацию и план действий</h2>
            <p className="mt-4 max-w-2xl text-slate-100">Оставьте заявку, и мы подготовим дорожную карту экологического сопровождения вашего производства.</p>
          </div>
          <form className="space-y-4 rounded-[28px] bg-white p-6 text-slate-900 shadow-xl shadow-eco-900/10">
            <div className="grid gap-4 sm:grid-cols-2">
              <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-eco-500 focus:ring-2 focus:ring-eco-100" placeholder="Имя" />
              <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-eco-500 focus:ring-2 focus:ring-eco-100" placeholder="Телефон" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-eco-500 focus:ring-2 focus:ring-eco-100" placeholder="Email" />
              <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-eco-500 focus:ring-2 focus:ring-eco-100" placeholder="Компания" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Button className="w-full">Отправить заявку</Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
