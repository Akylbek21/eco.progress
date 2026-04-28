import Reveal from '../components/animations/Reveal';

const ContactsPage = () => (
  <section className="bg-eco-50 px-5 py-16 sm:px-8">
    <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
      <Reveal direction="right">
        <div>
          <h1 className="text-4xl font-bold text-eco-900">Контакты</h1>
          <p className="mt-4 text-slate-600">Свяжитесь с ECOPROGRESS GROUP для консультации или создайте заявку в кабинете клиента.</p>
        </div>
      </Reveal>
      <Reveal direction="left">
        <div className="rounded-[24px] bg-white p-6 shadow-sm">
          <p className="font-semibold text-eco-900">+7 (___) ___-__-__</p>
          <p className="mt-3">info@ecoprogress.kz</p>
          <p className="mt-3">Республика Казахстан, г. Астана</p>
          <p className="mt-3">Пн-Пт, 09:00-18:00</p>
        </div>
      </Reveal>
    </div>
  </section>
);

export default ContactsPage;
