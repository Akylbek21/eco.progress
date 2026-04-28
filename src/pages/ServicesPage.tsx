import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import { services, type ServiceCategory } from '../data/mockData';

const categories: Array<'Все' | ServiceCategory> = ['Все', 'Отчетность', 'Документация', 'Контроль и аудит', 'Проверки', 'Консультации'];

const ServicesPage = () => {
  const [category, setCategory] = useState<'Все' | ServiceCategory>('Все');
  const items = useMemo(() => (category === 'Все' ? services : services.filter((item) => item.category === category)), [category]);

  return (
    <div>
      <section className="relative overflow-hidden px-5 py-24 text-white sm:px-8">
        <div className="absolute inset-0 bg-windmill bg-cover bg-center" />
        <div className="absolute inset-0 bg-eco-900/78" />
        <div className="relative mx-auto max-w-7xl">
          <Reveal><h1 className="max-w-3xl text-4xl font-bold sm:text-6xl">Услуги ECOPROGRESS GROUP</h1></Reveal>
          <Reveal delay={0.1}><p className="mt-5 max-w-2xl text-lg text-white/78">Документы, отчетность, проверки и консультации для компаний, ИП и частных обращений.</p></Reveal>
        </div>
      </section>
      <section className="bg-eco-50 px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap gap-3">
            {categories.map((item) => (
              <button key={item} onClick={() => setCategory(item)} className={`rounded-full px-5 py-3 text-sm font-semibold transition ${category === item ? 'bg-eco-800 text-white' : 'bg-white text-eco-800 hover:bg-eco-200/30'}`}>
                {item}
              </button>
            ))}
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {items.map((service, index) => (
              <Reveal key={service.id} delay={index * 0.04}>
                <div className="card-hover h-full rounded-[22px] border border-slate-200 bg-white p-6">
                  <p className="text-sm font-semibold text-eco-500">{service.category}</p>
                  <h2 className="mt-3 text-2xl font-bold text-eco-900">{service.title}</h2>
                  <div className="mt-5 grid gap-4 text-sm leading-6 text-slate-600 lg:grid-cols-3">
                    <p><b className="text-slate-900">Что это:</b><br />{service.description}</p>
                    <p><b className="text-slate-900">Кому нужна:</b><br />{service.forWhom}</p>
                    <p><b className="text-slate-900">Что получает клиент:</b><br />{service.result}</p>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link to={`/services/${service.id}`}><Button variant="secondary">Подробнее</Button></Link>
                    <Link to="/cabinet/orders/new"><Button>Заказать</Button></Link>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ServicesPage;
