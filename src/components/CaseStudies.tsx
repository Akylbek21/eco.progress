import Button from './ui/Button';

const cases = [
  {
    title: 'Экологические документы для предприятия',
    task: 'Клиенту нужно было подготовить пакет экологических документов.',
    work: 'Провели анализ объекта, подготовили документы и сопроводили процесс.',
    result: 'Клиент получил готовый пакет документов для работы.',
  },
  {
    title: 'Вывоз и утилизация отходов',
    task: 'Организации нужно было безопасно вывезти отходы с объекта.',
    work: 'Организовали сбор, транспортировку, утилизацию и сопроводительные документы.',
    result: 'Отходы вывезены, документы переданы клиенту.',
  },
  {
    title: 'Лабораторные исследования',
    task: 'Нужно было провести анализ воды, воздуха и почвы.',
    work: 'Согласовали точки отбора, провели исследования и подготовили протоколы.',
    result: 'Клиент получил протоколы для экологической документации.',
  },
  {
    title: 'Сопровождение проверки',
    task: 'Клиент готовился к экологической проверке.',
    work: 'Проверили документы, подсказали риски и помогли собрать недостающие материалы.',
    result: 'Клиент прошел подготовку с понятным планом действий.',
  },
];

const CaseStudies = () => (
  <section id="cases" className="bg-white px-4 py-16 sm:px-8 sm:py-20">
    <div className="mx-auto max-w-7xl">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Кейсы</p>
        <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Примеры задач, с которыми мы помогаем</h2>
      </div>
      <div className="mt-10 grid gap-5 lg:grid-cols-4">
        {cases.map((item) => (
          <div key={item.title} className="flex h-full flex-col rounded-[20px] border border-slate-200 bg-white p-5 shadow-lg shadow-eco-900/5">
            <h3 className="text-lg font-bold text-eco-900">{item.title}</h3>
            <p className="mt-4 text-xs font-bold uppercase text-slate-500">Задача</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.task}</p>
            <p className="mt-4 text-xs font-bold uppercase text-slate-500">Что сделали</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.work}</p>
            <p className="mt-4 text-xs font-bold uppercase text-slate-500">Результат</p>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{item.result}</p>
            <a href="#lead" className="mt-5"><Button className="w-full">Хочу похожее решение</Button></a>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default CaseStudies;
