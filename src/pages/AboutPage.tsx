import { Beaker, ClipboardCheck, FileText, FlaskConical, Leaf, MapPinned, Recycle, ShieldCheck, Truck, type LucideIcon } from 'lucide-react';
import Reveal from '../components/animations/Reveal';

const directions: Array<[string, string, LucideIcon]> = [
  ['Экологическое проектирование', 'Разрабатываем экологические проекты и документацию для предприятий и объектов различного назначения.', FileText],
  ['Лабораторные исследования', 'Проводим анализ воды, почвы, атмосферного воздуха, промышленных выбросов и факторов производственной среды.', Beaker],
  ['Разрешительная документация', 'Помогаем получать экологические разрешения, согласования и заключения.', ClipboardCheck],
  ['Работа с отходами', 'Организуем сбор, транспортировку, переработку, утилизацию и безопасное размещение отходов.', Recycle],
  ['Лицензированный транспорт', 'Обеспечиваем экологически безопасную перевозку отходов с полным документальным сопровождением.', Truck],
  ['Собственный полигон', 'Имеем возможность законного и безопасного размещения отходов на полигоне.', MapPinned],
];

const advantages: Array<[string, string, LucideIcon]> = [
  ['Полный цикл услуг', 'Клиент получает все в одном месте: от экологических расчетов и лаборатории до утилизации и отчетности.', Leaf],
  ['Работаем по Казахстану', 'Оказываем услуги для предприятий, организаций и объектов в разных регионах страны.', MapPinned],
  ['Собственная лабораторная база', 'Проводим исследования и замеры с оформлением протоколов.', FlaskConical],
  ['Лицензии и разрешения', 'Работы выполняются с соблюдением требований Экологического кодекса РК.', ShieldCheck],
  ['Безопасная транспортировка', 'Организуем перевозку отходов специализированным транспортом.', Truck],
  ['Документальное сопровождение', 'Помогаем клиенту пройти процесс понятно: документы, согласования, отчеты и подтверждения.', ClipboardCheck],
];

const AboutPage = () => (
  <div>
    <section className="relative isolate overflow-hidden px-5 py-24 text-white sm:px-8 lg:py-28">
      <div className="absolute inset-0 -z-30 bg-windmill bg-cover bg-center" />
      <div className="absolute inset-0 -z-20 bg-gradient-to-br from-eco-900/92 via-eco-800/82 to-eco-500/58" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-[#F7FBFD] to-transparent" />
      <div className="relative mx-auto max-w-7xl">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-eco-100">О компании</p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="mt-4 max-w-5xl text-4xl font-bold leading-tight sm:text-6xl">
            Eco Progress — экосистема экологических услуг полного цикла
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/80">
            От разработки экологической документации и лабораторных исследований до безопасной транспортировки, переработки, утилизации и размещения отходов на лицензированном полигоне.
          </p>
        </Reveal>
      </div>
    </section>

    <section className="bg-[#F7FBFD] px-5 py-16 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.78fr]">
        <Reveal direction="right">
          <div className="h-full rounded-[24px] border border-slate-200 bg-white p-7 shadow-lg shadow-eco-900/5 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">О компании</p>
            <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Экологические задачи без хаоса</h2>
            <div className="mt-6 space-y-5 text-base leading-8 text-slate-600">
              <p>
                Eco Progress — группа компаний, которая помогает бизнесу безопасно и законно решать экологические задачи в соответствии с требованиями Экологического кодекса Республики Казахстан.
              </p>
              <p>
                Мы объединяем ключевые направления экологического сопровождения: разработку экологических проектов, лабораторные исследования, оформление разрешительной документации, транспортировку, переработку, утилизацию и размещение отходов.
              </p>
              <p>
                Наша цель — сделать экологические процессы для клиентов понятными, прозрачными и безопасными: от первичной консультации и анализа объекта до полного документального сопровождения и реализации работ.
              </p>
            </div>
          </div>
        </Reveal>
        <Reveal direction="left">
          <div className="relative h-full overflow-hidden rounded-[24px] bg-eco-900 p-7 text-white shadow-xl shadow-eco-900/12 sm:p-8">
            <div className="absolute inset-0 bg-sea bg-cover bg-center opacity-20" />
            <div className="absolute inset-0 bg-eco-900/72" />
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-accent">
                <Leaf size={24} />
              </div>
              <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-eco-100">Миссия</p>
              <h2 className="mt-3 text-3xl font-bold leading-tight">Объединенные усилия — чистое будущее.</h2>
              <p className="mt-5 leading-8 text-white/78">
                Мы создаем и внедряем экологически устойчивые решения, направленные на защиту окружающей среды, соблюдение требований законодательства и развитие ответственного бизнеса в Казахстане.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>

    <section className="bg-white px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Наши направления</p>
            <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Все ключевые экологические работы в одной системе</h2>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {directions.map(([title, text, Icon], index) => (
            <Reveal key={title} delay={index * 0.04}>
              <div className="card-hover h-full rounded-[20px] border border-slate-200 bg-[#F7FBFD] p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-eco-600 shadow-sm">
                  <Icon size={24} />
                </div>
                <h3 className="mt-5 text-xl font-bold text-eco-900">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    <section className="bg-[#F7FBFD] px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Почему выбирают нас</p>
            <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Понятный процесс, законная работа и полный цикл</h2>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {advantages.map(([title, text, Icon], index) => (
            <Reveal key={title} delay={index * 0.04}>
              <div className="card-hover h-full rounded-[20px] border border-slate-200 bg-white p-6 shadow-lg shadow-eco-900/5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-eco-50 text-eco-600">
                    <Icon size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-eco-900">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  </div>
);

export default AboutPage;
