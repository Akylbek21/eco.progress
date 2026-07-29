import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

const navigation = [
  { to: '/staff/pek', label: 'Обзор', end: true },
  { to: '/staff/pek/programs', label: 'Программы' },
  { to: '/staff/pek/reports', label: 'Отчёты' },
  { to: '/staff/pek/settings', label: 'Настройки' },
];

const labels: Record<string, string> = {
  programs: 'Программы',
  reports: 'Отчёты',
  new: 'Создание',
  edit: 'Редактирование',
  workspace: 'Рабочая область',
  settings: 'Настройки',
  history: 'История',
  preview: 'Предпросмотр',
};

const PekLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean).slice(2);
  const activeFilters = new URLSearchParams(location.search).size;

  return <section className="space-y-4">
    <div className="rounded-2xl border bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/staff/pek" className="text-xl font-black text-slate-950">Производственный экологический контроль</Link>
          <nav aria-label="Хлебные крошки" className="mt-1 flex flex-wrap gap-1 text-xs text-slate-500">
            <Link to="/staff/pek">ПЭК</Link>
            {segments.map((segment, index) => <span key={`${segment}-${index}`}>/ {labels[segment] || (/^\d+$/.test(segment) ? `№ ${segment}` : segment)}</span>)}
          </nav>
        </div>
        {activeFilters > 0 && <span className="rounded-full bg-eco-50 px-3 py-1 text-xs font-bold text-eco-800">Активных параметров: {activeFilters}</span>}
      </div>
      <nav aria-label="Разделы ПЭК" className="mt-3 flex max-w-full gap-1 overflow-x-auto">
        {navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold ${isActive ? 'bg-eco-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{item.label}</NavLink>)}
      </nav>
    </div>
    {children}
  </section>;
};

export default PekLayout;
