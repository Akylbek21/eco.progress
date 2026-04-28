import { tariffs } from '../data/mockData';
import TariffCard from '../components/TariffCard';
import Calculator from '../components/Calculator';
import ContactBlock from '../components/ContactBlock';

const TariffsPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-eco-900 via-eco-800 to-eco-900">
      <div className="container mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Тарифы и услуги
          </h1>
          <p className="text-xl text-eco-200 max-w-3xl mx-auto">
            Выберите подходящий тариф для вашего бизнеса. Мы предлагаем комплексное сопровождение
            по всем экологическим вопросам.
          </p>
        </div>

        {/* Tariffs Grid */}
        <div className="grid gap-8 md:grid-cols-3 mb-16">
          {tariffs.map((tariff) => (
            <TariffCard key={tariff.id} tariff={tariff} />
          ))}
        </div>

        {/* Calculator Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Рассчитайте стоимость услуг
            </h2>
            <p className="text-eco-200">
              Заполните форму для получения предварительного расчета
            </p>
          </div>
          <div className="max-w-2xl mx-auto">
            <Calculator />
          </div>
        </div>

        {/* Contact Section */}
        <div>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Остались вопросы?
            </h2>
            <p className="text-eco-200">
              Свяжитесь с нами для получения консультации
            </p>
          </div>
          <div className="max-w-4xl mx-auto">
            <ContactBlock />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TariffsPage;