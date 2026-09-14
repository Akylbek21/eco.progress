import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

const navigation = [
  { to: '/staff/pek', label: 'Обзор', end: true },
  { to: '/staff/pek/programs', label: 'Программы' },
  { to: '/staff/pek/permits', label: 'Разрешения' },
  { to: '/staff/pek/reports', label: 'Отчёты' },
];

const labels: Record<string, string> = {
  programs: 'Программы',
  permits: 'Разрешения',
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
  const isWorkspace = segments.some((segment) => /^\d+$/.test(segment));

  if (isWorkspace) {
    return <section className="pek-module min-w-0 space-y-3">
      <nav aria-label="Хлебные крошки" className="pek-workspace-breadcrumb flex min-w-0 items-center gap-2 border-b border-slate-200 bg-white px-1 pb-2 text-xs text-slate-500">
        <Link to="/staff/pek">ПЭК</Link>
        {segments.map((segment, index) => <span key={`${segment}-${index}`} className="truncate">/ {labels[segment] || (/^\d+$/.test(segment) ? `№ ${segment}` : segment)}</span>)}
      </nav>
      {children}
    </section>;
  }

  return <section className="pek-module min-w-0 space-y-4">
    <div className="rounded-2xl border bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link to="/staff/pek" className="text-lg font-black leading-tight text-slate-950 sm:text-xl">Производственный экологический контроль</Link>
          <nav aria-label="Хлебные крошки" className="mt-1 flex flex-wrap gap-1 text-xs text-slate-500">
            <Link to="/staff/pek">ПЭК</Link>
            {segments.map((segment, index) => <span key={`${segment}-${index}`}>/ {labels[segment] || (/^\d+$/.test(segment) ? `№ ${segment}` : segment)}</span>)}
          </nav>
        </div>
        {activeFilters > 0 && <span className="rounded-full bg-eco-50 px-3 py-1 text-xs font-bold text-eco-800">Активных параметров: {activeFilters}</span>}
      </div>
      <nav aria-label="Разделы ПЭК" className="mt-3 flex max-w-full gap-1 overflow-x-auto">
        {navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold ${isActive ? 'bg-eco-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{item.label}</NavLink>)}
        <NavLink to="/staff/pek/settings" className={({ isActive }) => `whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold ${isActive ? 'bg-eco-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Настройки</NavLink>
      </nav>
    </div>
    {children}
  </section>;
};

export default PekLayout;
