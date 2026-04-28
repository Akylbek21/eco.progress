import { Phone, Mail, MapPin, Clock } from 'lucide-react';

const ContactBlock = () => {
  return (
    <div className="glass rounded-3xl p-8">
      <h3 className="text-2xl font-bold text-white mb-6">Свяжитесь с нами</h3>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Phone size={20} className="text-accent" />
            <div>
              <p className="text-white font-medium">Телефон</p>
              <p className="text-eco-200">+7 (7172) 34-56-78</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Mail size={20} className="text-accent" />
            <div>
              <p className="text-white font-medium">Email</p>
              <p className="text-eco-200">info@ecoprogress.kz</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <MapPin size={20} className="text-accent" />
            <div>
              <p className="text-white font-medium">Адрес</p>
              <p className="text-eco-200">г. Нур-Султан, ул. Экологическая, 23</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock size={20} className="text-accent" />
            <div>
              <p className="text-white font-medium">Режим работы</p>
              <p className="text-eco-200">Пн-Пт: 9:00-18:00</p>
            </div>
          </div>
        </div>

        <form className="space-y-4">
          <input
            type="text"
            placeholder="Ваше имя"
            className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-eco-300 focus:border-accent focus:outline-none"
          />
          <input
            type="email"
            placeholder="Email"
            className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-eco-300 focus:border-accent focus:outline-none"
          />
          <input
            type="tel"
            placeholder="Телефон"
            className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-eco-300 focus:border-accent focus:outline-none"
          />
          <textarea
            rows={4}
            placeholder="Сообщение"
            className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-eco-300 focus:border-accent focus:outline-none resize-none"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-accent px-6 py-3 font-semibold text-white hover:bg-accent/90 transition"
          >
            Отправить сообщение
          </button>
        </form>
      </div>
    </div>
  );
};

export default ContactBlock;