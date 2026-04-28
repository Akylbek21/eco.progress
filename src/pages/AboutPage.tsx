import Reveal from '../components/animations/Reveal';

const AboutPage = () => (
  <div>
    <section className="relative overflow-hidden px-5 py-24 text-white sm:px-8">
      <div className="absolute inset-0 bg-windmill bg-cover bg-center" />
      <div className="absolute inset-0 bg-eco-900/78" />
      <div className="relative mx-auto max-w-7xl">
        <Reveal><h1 className="text-4xl font-bold sm:text-6xl">О компании ECOPROGRESS GROUP</h1></Reveal>
        <Reveal delay={0.1}><p className="mt-5 max-w-2xl text-lg text-white/78">Мы делаем экологическое сопровождение понятным: от первой консультации до готовых документов и статусов в кабинете.</p></Reveal>
      </div>
    </section>
    <section className="bg-white px-5 py-16 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
        {[
          ['Фокус на бизнесе', 'Говорим простым языком и помогаем понять, какие действия действительно нужны.'],
          ['Документы под ключ', 'Собираем, проверяем и оформляем материалы в аккуратный комплект.'],
          ['Онлайн-процесс', 'Заявки, статусы, комментарии и документы доступны в личном кабинете.'],
        ].map(([title, text], index) => (
          <Reveal key={title} delay={index * 0.05}>
            <div className="card-hover h-full rounded-[22px] border border-slate-200 bg-eco-50 p-6">
              <h2 className="text-xl font-bold text-eco-900">{title}</h2>
              <p className="mt-3 text-slate-600">{text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  </div>
);

export default AboutPage;
