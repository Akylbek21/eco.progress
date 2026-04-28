import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

const HomePage = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section с фоном ветровой мельницы */}
      <section 
        className="relative px-6 py-32 text-white sm:px-8 lg:py-48 overflow-hidden"
        style={{
          backgroundImage: 'linear-gradient(135deg, rgba(15, 60, 110, 0.85) 0%, rgba(15, 60, 110, 0.75) 50%), url(/pexels-jan-van.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center right',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="mx-auto max-w-7xl relative z-10">
          <div className="max-w-2xl">
            <div className="inline-block mb-6 px-4 py-2 rounded-full bg-eco-400/30 border border-eco-300/50 backdrop-blur">
              <span className="text-eco-200 text-sm font-semibold">Возобновляемая энергия для природы</span>
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-8">
              Eco.Progress
            </h1>
            <p className="text-xl md:text-2xl text-eco-100 mb-10 leading-relaxed max-w-xl">
              Экологическое сопровождение бизнеса. Помогаем компаниям соблюдать требования, готовить документацию и проходить проверки.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/services">
                <Button className="px-8 py-4 text-base font-semibold bg-white text-eco-900 hover:bg-eco-50">
                  Посмотреть услуги
                </Button>
              </Link>
              <Button variant="secondary" className="px-8 py-4 text-base font-semibold border-2 border-white text-white hover:bg-white/10">
                Заказать услугу
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Чем мы помогаем */}
      <section className="bg-white px-6 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Чем мы помогаем</h2>
            <p className="text-xl text-slate-600">Комплексное экологическое сопровождение бизнеса</p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: '📊',
                title: 'Экологическая отчетность',
                description: 'Подготовка и сдача регулярной экологической отчетности'
              },
              {
                icon: '📄',
                title: 'Документация и разрешения',
                description: 'Разработка экологической документации и получение разрешений'
              },
              {
                icon: '🔍',
                title: 'Производственный контроль',
                description: 'Проверка соблюдения экологических норм'
              },
              {
                icon: '✅',
                title: 'Сопровождение проверок',
                description: 'Подготовка к проверкам и сопровождение инспекций'
              }
            ].map((item, index) => (
              <div key={index} className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-eco-100 to-eco-50 rounded-3xl transform group-hover:scale-105 transition-transform duration-300"></div>
                <div className="relative p-8 text-center">
                  <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform duration-300">{item.icon}</div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Как проходит работа */}
      <section className="bg-slate-50 px-6 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Как проходит работа</h2>
            <p className="text-xl text-slate-600">Простой и прозрачный процесс в 5 шагов</p>
          </div>
          <div className="grid gap-8 md:grid-cols-5 relative">
            {[
              { step: '1', title: 'Заявка', description: 'Оставьте заявку или позвоните' },
              { step: '2', title: 'Уточнение', description: 'Анализируем ваши требования' },
              { step: '3', title: 'Подготовка', description: 'Собираем необходимые документы' },
              { step: '4', title: 'Исполнение', description: 'Выполняем услугу' },
              { step: '5', title: 'Результат', description: 'Передаем готовый результат' }
            ].map((item, index) => (
              <div key={index} className="text-center relative">
                {index < 4 && (
                  <div className="hidden md:block absolute top-8 left-1/2 w-full h-1 bg-gradient-to-r from-eco-400 to-eco-300 -z-10" 
                    style={{transform: 'translateY(-50%) translateX(calc(50% + 24px))'}}
                  ></div>
                )}
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-eco-600 to-eco-700 text-2xl font-bold text-white shadow-lg">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-600 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Популярные услуги */}
      <section className="bg-white px-6 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Популярные услуги</h2>
            <p className="text-xl text-slate-600">Наши основные направления работы</p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Экологическая отчетность',
                description: 'Подготовка и подача регулярной отчетности',
                features: ['Анализ требований', 'Сбор данных', 'Оформление отчетов'],
                color: 'from-eco-500 to-eco-600'
              },
              {
                title: 'Разработка документации',
                description: 'Создание документов для управления отходами',
                features: ['Регламенты', 'Карты отходов', 'Инструкции'],
                color: 'from-eco-600 to-eco-700'
              },
              {
                title: 'Производственный контроль',
                description: 'Проверка соблюдения экологических норм',
                features: ['Инспекция объектов', 'Оценка рисков', 'Рекомендации'],
                color: 'from-eco-400 to-eco-500'
              },
              {
                title: 'Экологический аудит',
                description: 'Глубокая оценка состояния экологии',
                features: ['Полный аудит', 'Аналитический отчет', 'Дорожная карта'],
                color: 'from-eco-700 to-eco-800'
              },
              {
                title: 'Консультации по экологии',
                description: 'Экспертные советы по разрешительной документации',
                features: ['Онлайн/оффлайн', 'Анализ ситуации', 'План действий'],
                color: 'from-eco-500 to-eco-600'
              },
              {
                title: 'Управление отходами',
                description: 'Программы переработки и утилизации',
                features: ['Утилизация', 'Сортировка', 'Экологический контроль'],
                color: 'from-eco-600 to-eco-700'
              }
            ].map((service, index) => (
              <div key={index} className="group relative h-full overflow-hidden rounded-3xl">
                <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                <div className="relative bg-white group-hover:bg-transparent p-8 h-full flex flex-col rounded-3xl border border-slate-200 group-hover:border-transparent transition-all duration-300">
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-white mb-3 transition-colors duration-300">{service.title}</h3>
                  <p className="text-slate-600 group-hover:text-white/90 mb-6 text-sm transition-colors duration-300">{service.description}</p>
                  <ul className="space-y-2 mb-8 flex-grow">
                    {service.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-slate-600 group-hover:text-white/90 transition-colors duration-300">
                        <span className="text-eco-600 group-hover:text-white font-bold transition-colors duration-300">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-3 pt-4 border-t border-slate-200 group-hover:border-white/20 transition-colors duration-300">
                    <Button variant="secondary" className="flex-1 text-sm group-hover:bg-white/20 group-hover:border-white group-hover:text-white transition-all duration-300">Подробнее</Button>
                    <Button className="flex-1 text-sm">Заказать</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Почему выбирают Eco.Progress с фоном чайки */}
      <section 
        className="relative px-6 py-32 sm:px-8 overflow-hidden"
        style={{
          backgroundImage: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.92) 50%), url(/pexels-enginakyurt.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center left',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="mx-auto max-w-7xl relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Почему выбирают Eco.Progress</h2>
            <p className="text-xl text-slate-600">Наши конкурентные преимущества</p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: '🎯',
                title: 'Понятное сопровождение',
                description: 'Простые объяснения сложных процессов и прозрачные сроки выполнения'
              },
              {
                icon: '📋',
                title: 'Соблюдение требований',
                description: 'Все документы соответствуют актуальным нормам и стандартам'
              },
              {
                icon: '📦',
                title: 'Документы под ключ',
                description: 'Полный пакет документов без необходимости самостоятельной подготовки'
              },
              {
                icon: '👤',
                title: 'Удобный кабинет',
                description: 'Персональный доступ ко всем документам и статусам заявок'
              },
              {
                icon: '📊',
                title: 'Прозрачные статусы',
                description: 'Отслеживание прогресса работы в реальном времени'
              },
              {
                icon: '⚡',
                title: 'Поддержка 24/7',
                description: 'Квалифицированная помощь на всех этапах сотрудничества'
              }
            ].map((item, index) => (
              <div key={index} className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-eco-50 to-eco-100 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg"></div>
                <div className="relative p-8 text-center rounded-3xl border border-eco-200/50 group-hover:border-eco-300 transition-all duration-300">
                  <div className="text-5xl mb-4 transform group-hover:scale-125 transition-transform duration-300">{item.icon}</div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">{item.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Оставить заявку */}
      <section className="bg-gradient-to-br from-eco-900 via-eco-800 to-eco-900 px-6 py-20 text-white sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Оставить заявку</h2>
            <p className="text-xl text-eco-200">Получите консультацию и план экологического сопровождения</p>
          </div>
          <div className="mx-auto max-w-2xl">
            <form className="bg-white/10 backdrop-blur-md rounded-3xl p-8 space-y-6 border border-white/20">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-eco-200 mb-3">Имя</label>
                  <input
                    type="text"
                    className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white placeholder-eco-300 focus:border-white focus:outline-none focus:ring-2 focus:ring-eco-400/50 transition-all"
                    placeholder="Ваше имя"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-eco-200 mb-3">Телефон</label>
                  <input
                    type="tel"
                    className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white placeholder-eco-300 focus:border-white focus:outline-none focus:ring-2 focus:ring-eco-400/50 transition-all"
                    placeholder="+7 (___) ___-__-__"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-eco-200 mb-3">Компания</label>
                <input
                  type="text"
                  className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white placeholder-eco-300 focus:border-white focus:outline-none focus:ring-2 focus:ring-eco-400/50 transition-all"
                  placeholder="Название вашей компании"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-eco-200 mb-3">Выберите услугу</label>
                <select className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white focus:border-white focus:outline-none focus:ring-2 focus:ring-eco-400/50 transition-all">
                  <option value="">Выберите услугу</option>
                  <option value="reporting">Экологическая отчетность</option>
                  <option value="documentation">Разработка документации</option>
                  <option value="audit">Экологический аудит</option>
                  <option value="control">Производственный контроль</option>
                  <option value="permits">Разрешительная документация</option>
                  <option value="consulting">Консультации</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-eco-200 mb-3">Комментарий</label>
                <textarea
                  rows={4}
                  className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white placeholder-eco-300 focus:border-white focus:outline-none focus:ring-2 focus:ring-eco-400/50 transition-all resize-none"
                  placeholder="Опишите вашу задачу или вопрос"
                />
              </div>
              <Button className="w-full px-8 py-4 text-base font-semibold bg-white text-eco-900 hover:bg-eco-50">
                Отправить заявку
              </Button>
              <p className="text-center text-sm text-eco-200">
                Мы ответим в течение 24 часов
              </p>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;