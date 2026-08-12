import { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Settings, Users } from 'lucide-react';

const nav = [
  { to: '/admin', label: 'Контент', hash: '#услуги' },
  { to: '/admin/users', label: 'Пользователи' },
];

const AdminLayout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-slate-100 text-slate-900 lg:grid lg:grid-cols-[280px_1fr]">
    <aside className="hidden bg-white p-6 shadow-sm lg:block">
      <Link to="/admin" className="flex items-center gap-3 text-xl font-bold text-eco-900">
        <span className="rounded-2xl bg-eco-800 p-3 text-white"><Settings size={20} /></span>
        Админка
      </Link>
      <nav className="mt-8 space-y-2">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-eco-50 ${
                isActive ? 'bg-eco-50 text-eco-900' : ''
              }`
            }
          >
            {item.label === 'Пользователи' ? <Users size={16} /> : <Settings size={16} />}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
    <div>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur-xl sm:px-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Панель администратора</p>
            <h1 className="text-xl font-semibold text-eco-900">Управление контентом ecoprogress.kz</h1>
          </div>
          <Link to="/" className="rounded-full bg-eco-800 px-4 py-2 text-sm font-semibold text-white">На сайт</Link>
        </div>
      </header>
      <main className="px-5 py-8 sm:px-8">{children}</main>
    </div>
  </div>
);

export default AdminLayout;
