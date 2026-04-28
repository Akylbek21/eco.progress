import { ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Bell, BriefcaseBusiness, FileText, Home, LogOut, UserRound, Users } from 'lucide-react';
import { logout } from '../services/authService';
import BrandLogo from '../components/ui/BrandLogo';

const links = [
  { label: 'Dashboard', path: '/staff', icon: Home },
  { label: 'Заявки', path: '/staff/orders', icon: BriefcaseBusiness },
  { label: 'Клиенты', path: '/staff/clients', icon: Users },
  { label: 'Документы', path: '/staff/documents', icon: FileText },
  { label: 'Уведомления', path: '/staff/notifications', icon: Bell },
  { label: 'Профиль', path: '/staff/profile', icon: UserRound },
];

const StaffLayout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-slate-100 text-slate-900 lg:grid lg:grid-cols-[290px_1fr]">
    <aside className="hidden bg-eco-900 p-6 text-white lg:block">
      <Link to="/staff" className="flex items-center gap-3 text-xl font-bold leading-tight">
        <BrandLogo className="h-11 w-11" dark={false} />
        <span>
          <span className="block">ECOPROGRESS</span>
          <span className="block text-xs tracking-[0.22em] text-white/55">GROUP CRM</span>
        </span>
      </Link>
      <p className="mt-2 text-sm text-white/60">Кабинет сотрудника</p>
      <nav className="mt-8 space-y-1">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/staff'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${isActive ? 'bg-white text-eco-900' : 'text-white/75 hover:bg-white/10 hover:text-white'}`
              }
            >
              <Icon size={18} /> {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
    <div>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur-xl sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Роль: MANAGER</p>
            <h1 className="text-lg font-semibold text-eco-900">Менеджер ECOPROGRESS GROUP</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm font-semibold text-eco-700">На сайт</Link>
            <Link to="/staff/login" onClick={logout} className="inline-flex items-center gap-2 rounded-full bg-eco-900 px-4 py-2 text-sm font-semibold text-white">
              <LogOut size={16} /> Выйти
            </Link>
          </div>
        </div>
        <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
          {links.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === '/staff'} className="whitespace-nowrap rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="px-5 py-8 sm:px-8">{children}</main>
    </div>
  </div>
);

export default StaffLayout;
