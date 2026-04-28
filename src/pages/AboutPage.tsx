import SectionTitle from '../components/ui/SectionTitle';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const AboutPage = () => {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:py-14">
      <SectionTitle title="О компании Eco.Progress" subtitle="Надежный экологический партнер" />
      <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div className="space-y-8">
          <Card>
            <p className="text-slate-600 leading-7">
              Eco.Progress сопровождает компании на всех этапах экологической деятельности: от подготовки отчетности до прохождения проверок и получения разрешений. Мы работаем с промышленными предприятиями, агрокомпаниями и сервисными организациями.
            </p>
          </Card>
          <Card>
            <h3 className="text-xl font-semibold text-slate-900">Миссия компании</h3>
            <p className="mt-4 text-slate-600 leading-7">
              Помогать бизнесу действовать в рамках экологических требований и снижать риски за счет прозрачного сопровождения и грамотного документального оформления.
            </p>
          </Card>
          <Card>
            <h3 className="text-xl font-semibold text-slate-900">Для кого мы работаем</h3>
            <ul className="mt-4 space-y-3 text-slate-600">
              <li>Производственные предприятия</li>
              <li>Логистические и складские комплексы</li>
              <li>Сельское хозяйство и агропромышленные комплексы</li>
              <li>Строительные и инженерные компании</li>
            </ul>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <h3 className="text-xl font-semibold text-slate-900">Преимущества Eco.Progress</h3>
            <ul className="mt-5 space-y-4 text-slate-600">
              <li>Экономия времени за счет комплексного сопровождения</li>
              <li>Гибкая подготовка документов и отчетов</li>
              <li>Профессиональная команда экологов</li>
              <li>Поддержка на этапе проверок и согласований</li>
            </ul>
          </Card>
          <Card>
            <h3 className="text-xl font-semibold text-slate-900">Сертификаты и документы</h3>
            <div className="mt-5 grid gap-3">
              {['Сертификат ISO 14001', 'Лицензия эксперта', 'Патент на методики', 'Договор партнерства'].map((item) => (
                <div key={item} className="rounded-3xl border border-slate-200 bg-eco-50 px-4 py-3 text-sm text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: 'Опыт', value: '12 лет' },
                { label: 'Клиентов', value: '120+' },
                { label: 'Проектов', value: '320+' },
                { label: 'Услуг', value: '8 направлений' },
              ].map((item) => (
                <div key={item.label} className="rounded-3xl bg-white p-5 text-center shadow-sm">
                  <p className="text-sm uppercase tracking-[0.24em] text-eco-700">{item.label}</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <div className="mt-12 rounded-[32px] bg-eco-100 p-8 text-slate-900 shadow-xl shadow-eco-200/50">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-eco-700">Доверие бизнеса</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Сильная команда и высокая репутация</h2>
            <p className="mt-4 text-slate-600 leading-7">
              Наш подход основывается на глубоких знаниях, структурированной документации и своевременной коммуникации. Клиенты ценят нас за честность и надежность в сложных экологических задачах.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Опыт работы', value: '12 лет' },
              { label: 'Наши клиенты', value: '60 компаний' },
              { label: 'Завершено проектов', value: '320' },
              { label: 'Сотрудников', value: '15 экспертов' },
            ].map((item) => (
              <div key={item.label} className="rounded-3xl bg-white p-6 shadow-sm">
                <p className="text-sm text-eco-700">{item.label}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-12 flex justify-center">
        <Button>Связаться с экспертами</Button>
      </div>
    </div>
  );
};

export default AboutPage;
