import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, ClipboardCheck, FileText, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';
import Button from '../components/ui/Button';
import Reveal from '../components/animations/Reveal';
import EcoDashboardPreview from '../components/content/EcoDashboardPreview';
import { services } from '../data/mockData';

const helpCards: Array<[string, string, LucideIcon]> = [
  ['Экологическая отчетность', 'Сроки, формы и исходные данные под контролем специалиста.', BarChart3],
  ['Документация и разрешения', 'Комплект документов под деятельность компании и требования проверок.', FileText],
  ['Производственный контроль', 'План контроля, документы, рекомендации и понятный мониторинг.', ClipboardCheck],
  ['Сопровождение проверок', 'Подготовка к инспекции, снижение рисков и помощь с пояснениями.', ShieldCheck],
];

const quizMap: Record<string, string[]> = {
  'Нужно сдать отчетность': ['Экологическая отчетность', 'Консультации по экологии'],
  'Нужны экологические документы': ['Разработка экологической документации', 'Подготовка разрешительной документации'],
  'Предстоит проверка': ['Сопровождение экологических проверок', 'Экологический аудит'],
  'Нужна консультация': ['Консультации по экологии', 'Экологический аудит'],
  'Не знаю, что нужно': ['Консультации по экологии', 'Экологический аудит'],
};

const process = [
  'Вы оставляете заявку',
  'Мы уточняем задачу',
  'Собираем документы',
  'Выполняем услугу',
  'Передаем результат',
];

const HomePage = () => {
  const [quiz, setQuiz] = useState('Нужно сдать отчетность');
  const [sent, setSent] = useState(false);

  const submitLead = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(true);
    event.currentTarget.reset();
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#F7FBFD]">
      <section className="relative isolate min-h-[760px] overflow-hidden px-5 py-24 text-white sm:px-8 lg:py-32">
        <div className="hero-zoom absolute inset-0 -z-30 bg-windmill bg-cover bg-center" />
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-eco-900/94 via-eco-800/82 to-eco-500/58" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-[#F7FBFD] to-transparent" />
        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <Reveal delay={0.08}>
              <h1 className="max-w-4xl text-4xl font-bold leading-[1.04] sm:text-5xl lg:text-[68px]">
                ECOPROGRESS GROUP — экологическое сопровождение бизнеса
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/82 sm:text-xl">
                Помогаем подготовить экологическую документацию, сдать отчетность, пройти проверки и видеть весь процесс в удобном онлайн-кабинете.
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="mt-9 flex flex-wrap gap-4">
                <a href="#lead"><Button className="bg-accent px-7 py-4 text-eco-900 shadow-xl shadow-accent/20 hover:bg-accent/90">Заказать услугу</Button></a>
                <a href="#lead"><Button variant="secondary" className="border-white/35 bg-white/10 px-7 py-4 text-white hover:bg-white/18">Получить консультацию</Button></a>
                <Link to="/services"><Button variant="secondary" className="px-7 py-4">Посмотреть услуги</Button></Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Сопровождение без хаоса</p>
              <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Чем мы помогаем</h2>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {helpCards.map(([title, text, Icon], index) => (
              <Reveal key={String(title)} delay={index * 0.05}>
                <div className="card-hover h-full rounded-[20px] border border-slate-200/80 bg-white p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-eco-50 text-eco-500">
                    <Icon size={24} />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-eco-900">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 rounded-[32px] bg-gradient-to-br from-eco-900 via-eco-800 to-eco-700 p-6 shadow-2xl shadow-eco-900/12 sm:p-8 lg:grid-cols-[0.82fr_1fr] lg:p-10">
          <Reveal direction="right">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-eco-200">Mini-quiz</p>
              <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Подберите услугу за 1 минуту</h2>
              <p className="mt-4 leading-7 text-white/72">Выберите задачу, а мы покажем направления, с которых стоит начать.</p>
            </div>
          </Reveal>
          <Reveal direction="left">
            <div className="rounded-[24px] bg-white p-6 shadow-xl shadow-eco-900/16">
              <h3 className="font-semibold text-slate-900">Какая у вас задача?</h3>
              <div className="mt-5 flex flex-wrap gap-3">
                {Object.keys(quizMap).map((item) => (
                  <button key={item} onClick={() => setQuiz(item)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${quiz === item ? 'bg-eco-800 text-white' : 'bg-eco-50 text-eco-800 hover:bg-eco-200/40'}`}>
                    {item}
                  </button>
                ))}
              </div>
              <div className="mt-6 rounded-2xl bg-[#F7FBFD] p-5">
                <p className="text-sm font-semibold text-eco-900">Рекомендуем:</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {quizMap[quiz].map((item) => <span key={item} className="rounded-full bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">{item}</span>)}
                </div>
                <a href="#lead" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-eco-700">Оставить заявку <ArrowRight size={16} /></a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal><h2 className="text-3xl font-bold text-eco-900 sm:text-4xl">Как мы работаем</h2></Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-5">
            {process.map((item, index) => (
              <Reveal key={item} delay={index * 0.05}>
                <div className="relative h-full rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-eco-900 font-bold text-white">{index + 1}</span>
                  <p className="mt-5 font-semibold text-slate-900">{item}</p>
                  {index < process.length - 1 && <div className="absolute -right-4 top-10 hidden h-px w-8 bg-eco-200 md:block" />}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal><h2 className="text-3xl font-bold text-eco-900 sm:text-4xl">Популярные услуги</h2></Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {services.slice(0, 6).map((service, index) => (
              <Reveal key={service.id} delay={index * 0.05}>
                <div className="card-hover flex h-full flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white">
                  <div className="h-1.5 bg-gradient-to-r from-accent via-eco-200 to-eco-500" />
                  <div className="flex flex-1 flex-col p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-eco-500">{service.category}</p>
                    <h3 className="mt-4 text-xl font-bold text-eco-900">{service.title}</h3>
                    <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{service.description}</p>
                    <div className="mt-6 flex gap-3">
                      <Link to={`/services/${service.id}`} className="flex-1"><Button variant="secondary" className="w-full">Подробнее</Button></Link>
                      <Link to="/cabinet/orders/new" className="flex-1"><Button className="w-full">Заказать</Button></Link>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-5 py-20 sm:px-8">
        <div className="absolute inset-0 bg-sea bg-cover bg-center opacity-30" />
        <div className="absolute inset-0 bg-white/88" />
        <div className="relative mx-auto max-w-7xl">
          <Reveal>
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Тарифы сопровождения</p>
              <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Выберите формат для вашего бизнеса</h2>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {[
              {
                name: 'Малый бизнес',
                price: 'от 150 000 ₸',
                text: 'Для ИП, небольших компаний и разовых экологических задач.',
                features: ['Первичная консультация', 'Одна заявка в работе', 'Базовая проверка документов', 'Рекомендации по следующим шагам'],
              },
              {
                name: 'Средний бизнес',
                price: 'от 350 000 ₸',
                text: 'Для компаний с регулярной отчетностью, документами и несколькими объектами.',
                features: ['До 3 активных заявок', 'Экологическая отчетность', 'Документы и разрешения', 'Комментарии специалиста в кабинете'],
                popular: true,
              },
              {
                name: 'Большой бизнес',
                price: 'от 650 000 ₸',
                text: 'Для предприятий, которым нужно комплексное сопровождение и контроль рисков.',
                features: ['Комплексное сопровождение', 'Проверки и аудит', 'Приоритетная обработка заявок', 'Готовые документы под ключ'],
              },
            ].map((tariff, index) => (
              <Reveal key={tariff.name} delay={index * 0.06}>
                <div className={`card-hover relative flex h-full flex-col rounded-[24px] border bg-white p-7 shadow-lg shadow-eco-900/8 ${tariff.popular ? 'border-accent ring-4 ring-accent/12' : 'border-slate-200'}`}>
                  {tariff.popular && (
                    <span className="absolute right-5 top-5 rounded-full bg-accent px-3 py-1 text-xs font-bold text-eco-900">
                      Популярный
                    </span>
                  )}
                  <ShieldCheck className="text-accent" size={26} />
                  <h3 className="mt-5 text-2xl font-bold text-eco-900">{tariff.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{tariff.text}</p>
                  <p className="mt-6 text-3xl font-bold text-eco-900">{tariff.price}</p>
                  <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700">
                    {tariff.features.map((feature) => (
                      <li key={feature} className="flex gap-3">
                        <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <a href="#lead" className="mt-7">
                    <Button className="w-full">Выбрать тариф</Button>
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal direction="right">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Онлайн-кабинет</p>
              <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Клиент видит весь процесс</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">Создание заявок, загрузка документов, статусы, комментарии специалиста и готовые файлы собраны в одном спокойном интерфейсе.</p>
              <Link to="/register" className="mt-7 inline-block"><Button>Создать кабинет</Button></Link>
            </div>
          </Reveal>
          <Reveal direction="left">
            <EcoDashboardPreview compact />
          </Reveal>
        </div>
      </section>

      <section id="lead" className="relative overflow-hidden bg-eco-900 px-5 py-20 text-white sm:px-8">
        <div className="absolute inset-0 bg-sea bg-cover bg-center" />
        <div className="absolute inset-0 bg-eco-900/78" />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1fr]">
          <Reveal direction="right">
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-accent">
                <Sparkles size={22} />
              </div>
              <h2 className="mt-5 text-3xl font-bold sm:text-4xl">Оставить заявку</h2>
              <p className="mt-4 leading-7 text-white/70">Расскажите о задаче. Специалист ECOPROGRESS GROUP свяжется с вами и подскажет следующий шаг.</p>
            </div>
          </Reveal>
          <Reveal direction="left">
            <form onSubmit={submitLead} className="rounded-[24px] border border-white/15 bg-white/10 p-6 backdrop-blur">
              <div className="grid gap-4 md:grid-cols-2">
                {['Имя', 'Телефон', 'Компания', 'Услуга'].map((label) => (
                  <label key={label} className="text-sm font-semibold text-white/78">
                    {label}
                    <input required className="input-focus mt-2 w-full rounded-2xl border border-white/20 bg-white px-4 py-3 text-slate-900" />
                  </label>
                ))}
              </div>
              <label className="mt-4 block text-sm font-semibold text-white/78">
                Комментарий
                <textarea className="input-focus mt-2 w-full rounded-2xl border border-white/20 bg-white px-4 py-3 text-slate-900" rows={4} />
              </label>
              <Button className="mt-5 w-full bg-accent text-eco-900 hover:bg-accent/90">Отправить заявку</Button>
              {sent && <p className="mt-4 rounded-2xl bg-white/12 p-4 text-sm">Спасибо! Ваша заявка принята. Специалист ECOPROGRESS GROUP свяжется с вами.</p>}
            </form>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
