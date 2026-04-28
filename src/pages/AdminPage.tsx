import Reveal from '../components/animations/Reveal';
import { clients, employees, news, services, staffUsers, users } from '../data/mockData';

const AdminPage = () => {
  const blocks = [
    ['услуги', services.map((item) => item.title)],
    ['новости', news.map((item) => item.title)],
    ['сотрудники', employees.map((item) => item.name)],
    ['клиенты', clients.map((item) => item.name)],
    ['пользователи', [...users, ...staffUsers].map((item) => `${item.email} · ${item.role}`)],
    ['настройки', ['Контакты', 'Главная страница', 'Публичное меню', 'Mock localStorage']],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {blocks.map(([title, items], index) => (
        <Reveal key={String(title)} delay={index * 0.04}>
          <section id={String(title)} className="rounded-[22px] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold capitalize text-eco-900">{title}</h2>
              <button className="rounded-full bg-eco-800 px-4 py-2 text-sm font-semibold text-white">Добавить</button>
            </div>
            <div className="mt-5 space-y-3">
              {(items as string[]).map((item) => (
                <div key={item} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 text-sm">
                  <span>{item}</span>
                  <span className="text-eco-700">Редактировать</span>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      ))}
    </div>
  );
};

export default AdminPage;
