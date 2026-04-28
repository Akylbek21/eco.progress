import { Check } from 'lucide-react';
import { TariffItem } from '../data/mockData';

interface TariffCardProps {
  tariff: TariffItem;
}

const TariffCard = ({ tariff }: TariffCardProps) => {
  return (
    <div className={`glass relative rounded-3xl p-8 ${tariff.popular ? 'border-2 border-accent' : 'border border-white/20'}`}>
      {tariff.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white">
          Популярный
        </div>
      )}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white">{tariff.name}</h3>
        <div className="mt-4">
          <span className="text-4xl font-bold text-white">{tariff.price}</span>
          <span className="text-eco-200"> / месяц</span>
        </div>
      </div>
      <ul className="mt-8 space-y-4">
        {tariff.features.map((feature, index) => (
          <li key={index} className="flex items-center gap-3 text-eco-200">
            <Check size={20} className="text-accent" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <button className={`mt-8 w-full rounded-2xl py-4 font-semibold transition ${
        tariff.popular
          ? 'bg-accent text-white hover:bg-accent/90'
          : 'bg-white/10 text-white hover:bg-white/20'
      }`}>
        Выбрать тариф
      </button>
    </div>
  );
};

export default TariffCard;