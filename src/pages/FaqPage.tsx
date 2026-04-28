import Reveal from '../components/animations/Reveal';

const faqs = [
  ['Можно ли работать без backend?', 'Да, текущая версия использует mock data и localStorage для демонстрации сервиса.'],
  ['Кто видит комментарии сотрудника?', 'Комментарии клиенту видны в кабинете клиента, внутренние комментарии видны только сотрудникам.'],
  ['Как быстро создается заявка?', 'В mock-версии заявка появляется сразу со статусом "Новая".'],
  ['Можно ли загрузить документ?', 'Да, загрузка имитируется: файл добавляется в список документов заявки.'],
];

const FaqPage = () => (
  <section className="mx-auto max-w-4xl px-5 py-16 sm:px-8">
    <Reveal><h1 className="text-4xl font-bold text-eco-900">FAQ</h1></Reveal>
    <div className="mt-8 space-y-4">
      {faqs.map(([q, a], index) => (
        <Reveal key={q} delay={index * 0.04}>
          <div className="rounded-[20px] bg-white p-6 shadow-sm">
            <h2 className="font-bold text-eco-900">{q}</h2>
            <p className="mt-2 text-slate-600">{a}</p>
          </div>
        </Reveal>
      ))}
    </div>
  </section>
);

export default FaqPage;
