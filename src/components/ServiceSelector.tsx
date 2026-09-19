import { useState } from 'react';
import { Beaker, Building2, ClipboardCheck, HelpCircle, MapPinned, ShieldAlert, Truck, type LucideIcon } from 'lucide-react';
import Button from './ui/Button';
import WhatsAppButton from './WhatsAppButton';

const categories = [
  ['I', 'значительное'],
  ['II', 'умеренное'],
  ['III', 'незначительное'],
  ['IV', 'минимальное'],
] as const;

type SelectorItem = {
  title: string;
  Icon: LucideIcon;
  recommendation: string;
};

const items: SelectorItem[] = [
  { title: 'Открываю новый объект', Icon: Building2, recommendation: 'Вам может подойти: экологические документы, разрешения, программа управления отходами.' },
  { title: 'Пришла экологическая проверка', Icon: ShieldAlert, recommendation: 'Вам может подойти: экологическое сопровождение, проверка документов, подготовка отчетности.' },
  { title: 'Нужно вывезти отходы', Icon: Truck, recommendation: 'Вам может подойти: сбор отходов, транспортировка, утилизация и документы по отходам.' },
  { title: 'Нужно сдать отчет', Icon: ClipboardCheck, recommendation: 'Вам может подойти: экологическая отчетность, проверка исходных данных и контроль сроков.' },
  { title: 'Нужны лабораторные анализы', Icon: Beaker, recommendation: 'Вам может подойти: анализ воды, воздуха, почвы, замеры выбросов и протоколы.' },
  { title: 'Нужен полигон ТБО', Icon: MapPinned, recommendation: 'Вам может подойти: приём ТБО, законное размещение и документы для организации.' },
  { title: 'Не знаю, нужна консультация', Icon: HelpCircle, recommendation: 'Специалист разберет вашу ситуацию и подскажет, с чего начать.' },
];

const ServiceSelector = () => {
  const [selected, setSelected] = useState(items[0]);

  return (
    <section id="selector" className="bg-white px-4 py-14 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Подбор услуги</p>
          <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Не знаете, какая услуга нужна?</h2>
          <p className="mt-4 leading-7 text-slate-600">Выберите вашу ситуацию — мы подскажем, с чего начать.</p>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => {
              const Icon = item.Icon;
              const active = selected.title === item.title;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setSelected(item)}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${active ? 'border-accent bg-eco-50 ring-4 ring-accent/15' : 'border-slate-200 bg-white hover:border-eco-200'}`}
                >
                  <Icon className="mt-0.5 shrink-0 text-eco-600" size={22} />
                  <span className="font-semibold text-eco-900">{item.title}</span>
                </button>
              );
            })}
          </div>
          <div className="rounded-[28px] bg-eco-900 p-6 text-white shadow-xl shadow-eco-900/10 sm:p-8">
            <p className="text-sm font-semibold text-eco-600">Рекомендация</p>
            <h3 className="mt-3 text-2xl font-bold">{selected.title}</h3>
            <p className="mt-4 leading-7 text-white/75">{selected.recommendation}</p>
            <div className="mt-7 border-t border-white/15 pt-6">
              <div className="flex items-end justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Категория объекта</p><p className="mt-2 text-sm text-white/65">Определяет состав документов и контроля</p></div>
                <a href="/news/kak-opredelit-kategoriyu-obekta" className="shrink-0 text-sm font-bold text-accent hover:underline">Как определить →</a>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">{categories.map(([category, impact]) => <div key={category} className="rounded-xl bg-white/10 px-2 py-3 text-center"><span className="block text-xl font-black text-accent">{category}</span><span className="mt-1 hidden text-[10px] text-white/60 sm:block">{impact}</span></div>)}</div>
            </div>
            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              <Button asChild className="w-full bg-accent text-eco-900 hover:bg-accent/90 sm:w-auto"><a href="#lead">Получить консультацию</a></Button>
              <WhatsAppButton label="Написать в WhatsApp" className="w-full sm:w-auto" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ServiceSelector;
