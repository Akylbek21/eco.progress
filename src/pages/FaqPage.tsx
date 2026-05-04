import Reveal from '../components/animations/Reveal';

const faqs = [
  ['Сколько стоит услуга?', 'Стоимость зависит от объекта, объема работ и сроков. После заявки специалист подготовит расчет.'],
  ['Какие документы нужны?', 'Если документы есть — загрузите их в личном кабинете. Если нет — специалист подскажет, что нужно.'],
  ['Можно ли заключить договор онлайн?', 'Да, договор, счет и документы можно получать через личный кабинет.'],
  ['Как узнать статус заявки?', 'Все этапы отображаются в личном кабинете: проверка, договор, оплата, работа и готовый результат.'],
  ['Можно ли получить консультацию через WhatsApp?', 'Да, вы можете написать нам в WhatsApp для быстрой консультации.'],
  ['Вы работаете с ТОО и ИП?', 'Да, мы работаем с юридическими лицами, ИП и физическими лицами.'],
];

const FaqPage = () => (
  <section className="bg-[#F7FBFD] px-4 py-16 sm:px-8 sm:py-20">
    <div className="mx-auto max-w-4xl">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">FAQ</p>
        <h1 className="mt-3 text-4xl font-bold text-eco-900">Частые вопросы</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-600">Короткие ответы на вопросы, которые обычно возникают перед первой заявкой.</p>
      </Reveal>
      <div className="mt-8 space-y-4">
        {faqs.map(([q, a], index) => (
          <Reveal key={q} delay={index * 0.04}>
            <div className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-bold text-eco-900">{q}</h2>
              <p className="mt-3 leading-7 text-slate-600">{a}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export default FaqPage;
