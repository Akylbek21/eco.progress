import { ReactNode, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Bell, BriefcaseBusiness, FileText, Home, LogOut, Menu, UserRound, Users, X } from 'lucide-react';
import { logout } from '../services/authService';

const links = [
  { label: 'Dashboard', path: '/staff', icon: Home },
  { label: 'Заявки', path: '/staff/orders', icon: BriefcaseBusiness },
  { label: 'Клиенты', path: '/staff/clients', icon: Users },
  { label: 'Документы', path: '/staff/documents', icon: FileText },
  { label: 'Уведомления', path: '/staff/notifications', icon: Bell },
  { label: 'Профиль', path: '/staff/profile', icon: UserRound },
];

const StaffLayout = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);

  const nav = (mobile = false) => (
    <nav className={mobile ? 'space-y-1' : 'mt-8 space-y-1'}>
      {links.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/staff'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                mobile
                  ? isActive
                    ? 'bg-eco-900 text-white shadow-lg shadow-eco-900/15'
                    : 'text-slate-700 hover:bg-eco-50'
                  : isActive
                    ? 'bg-white text-eco-900'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon size={18} /> {item.label}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:grid lg:grid-cols-[290px_1fr]">
      <aside className="hidden bg-eco-900 p-6 text-white lg:block">
        <Link to="/staff" className="flex items-center text-xl font-bold leading-tight">
          <span>
            <span className="block">ECOPROGRESS</span>
            <span className="block text-xs tracking-[0.22em] text-white/55">GROUP CRM</span>
          </span>
        </Link>
        <p className="mt-2 text-sm text-white/60">Кабинет сотрудника</p>
        {nav()}
      </aside>
      <div>
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
            <button className="rounded-2xl border border-slate-200 bg-white p-3 lg:hidden" onClick={() => setOpen(true)} aria-label="Меню">
              <Menu size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-500">Роль: MANAGER</p>
              <h1 className="truncate text-base font-semibold text-eco-900 sm:text-lg">Менеджер ECOPROGRESS GROUP</h1>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link to="/" className="hidden text-sm font-semibold text-eco-700 hover:text-eco-900 sm:block">На сайт</Link>
              <Link to="/staff/login" onClick={logout} className="inline-flex items-center gap-2 rounded-full bg-eco-900 px-3 py-2 text-sm font-semibold text-white sm:px-4">
                <LogOut size={16} />
                <span className="hidden sm:inline">Выйти</span>
              </Link>
            </div>
          </div>
        </header>
        {open && (
          <div className="fixed inset-0 z-50 bg-eco-900/40 lg:hidden" onClick={() => setOpen(false)}>
            <aside className="h-full w-80 max-w-[86vw] bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <span className="font-bold text-eco-900">CRM сотрудника</span>
                  <p className="mt-1 text-xs text-slate-500">ECOPROGRESS GROUP</p>
                </div>
                <button className="rounded-2xl border border-slate-200 p-2" onClick={() => setOpen(false)} aria-label="Закрыть меню">
                  <X size={18} />
                </button>
              </div>
              {nav(true)}
            </aside>
          </div>
        )}
        <main className="px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
};

export default StaffLayout;
