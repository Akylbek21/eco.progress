import { useState } from 'react';
import { Calculator as CalculatorIcon } from 'lucide-react';

const Calculator = () => {
  const [formData, setFormData] = useState({
    companyType: '',
    employees: '',
    wasteVolume: '',
    emissions: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const calculatePrice = () => {
    // Простая логика расчета цены
    const basePrice = 150000;
    const employeeMultiplier = parseInt(formData.employees) || 0;
    const wasteMultiplier = parseInt(formData.wasteVolume) || 0;
    const emissionMultiplier = parseInt(formData.emissions) || 0;

    return basePrice + (employeeMultiplier * 5000) + (wasteMultiplier * 2000) + (emissionMultiplier * 3000);
  };

  return (
    <div className="glass rounded-3xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <CalculatorIcon size={24} className="text-accent" />
        <h3 className="text-xl font-bold text-white">Калькулятор стоимости услуг</h3>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-eco-200 mb-2">
            Тип компании
          </label>
          <select
            name="companyType"
            value={formData.companyType}
            onChange={handleChange}
            className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-eco-300 focus:border-accent focus:outline-none"
          >
            <option value="">Выберите тип</option>
            <option value="production">Производство</option>
            <option value="trade">Торговля</option>
            <option value="services">Услуги</option>
            <option value="construction">Строительство</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-eco-200 mb-2">
            Количество сотрудников
          </label>
          <input
            type="number"
            name="employees"
            value={formData.employees}
            onChange={handleChange}
            placeholder="Введите количество"
            className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-eco-300 focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-eco-200 mb-2">
            Объем отходов (тонн/год)
          </label>
          <input
            type="number"
            name="wasteVolume"
            value={formData.wasteVolume}
            onChange={handleChange}
            placeholder="Введите объем"
            className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-eco-300 focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-eco-200 mb-2">
            Выбросы (тонн/год)
          </label>
          <input
            type="number"
            name="emissions"
            value={formData.emissions}
            onChange={handleChange}
            placeholder="Введите объем выбросов"
            className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-eco-300 focus:border-accent focus:outline-none"
          />
        </div>

        <div className="pt-4 border-t border-white/20">
          <div className="text-center">
            <div className="text-3xl font-bold text-accent mb-2">
              {calculatePrice().toLocaleString()} ₸
            </div>
            <p className="text-sm text-eco-200">Примерная стоимость услуг в месяц</p>
          </div>
        </div>

        <button className="w-full rounded-xl bg-accent px-6 py-3 font-semibold text-white hover:bg-accent/90 transition">
          Получить точный расчет
        </button>
      </div>
    </div>
  );
};

export default Calculator;