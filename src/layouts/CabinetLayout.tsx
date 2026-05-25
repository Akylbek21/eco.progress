import { ReactNode, useState } from 'react';
import { Link, NavLink, Navigate } from 'react-router-dom';
import { Building2, CreditCard, FileText, Home, LogOut, Menu, User, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const CabinetLayout = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const { user, loading, isAuthenticated, logout } = useAuth();

  if (loading) return <div className="flex min-h-screen items-center justify-center"><LoadingSpinner /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isIndividual = user?.type === 'individual';
  const links = [
    { label: 'Главная', path: '/cabinet', icon: Home },
    { label: 'Мои заявки', path: '/cabinet/orders', icon: FileText },
    { label: 'Документы', path: '/cabinet/documents', icon: FileText },
    { label: 'Оплата', path: '/cabinet/payments', icon: CreditCard },
    { label: 'Профиль компании', path: '/cabinet/company', icon: isIndividual ? User : Building2 },
  ];

  const nav = (
    <nav className="space-y-1">
      {links.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/cabinet'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${isActive ? 'bg-eco-400 text-white shadow-lg shadow-eco-400/20' : 'text-slate-650 hover:bg-eco-50'}`
            }
          >
            <Icon size={18} />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-eco-50 text-slate-900 lg:grid lg:grid-cols-[286px_1fr]">
      <aside className="hidden border-r border-slate-200 bg-white/95 p-6 shadow-sm lg:block">
        <Link to="/cabinet" className="flex items-center text-xl font-bold leading-tight text-eco-800">
          <span>ecoprogress.kz</span>
        </Link>
        <p className="mt-2 text-sm text-slate-500">Кабинет клиента</p>
        <div className="my-6 rounded-3xl bg-eco-50 p-4">
          <p className="text-sm font-semibold text-slate-900">{user?.companyName ?? user?.name ?? 'Клиент'}</p>
          <p className="mt-1 text-xs text-slate-500">{isIndividual ? 'Физическое лицо' : 'Юридическое лицо / ИП'}</p>
        </div>
        {nav}
      </aside>
      <div>
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <button className="rounded-2xl border border-slate-200 bg-white p-3 lg:hidden" onClick={() => setOpen(true)} aria-label="Меню">
              <Menu size={20} />
            </button>
            <div>
              <p className="text-sm text-slate-500">Добро пожаловать</p>
              <h1 className="text-lg font-semibold text-eco-900">{user?.name ?? 'Клиент ecoprogress.kz'}</h1>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/" className="hidden text-sm font-semibold text-eco-700 hover:text-eco-900 sm:block">На сайт</Link>
              <Link to="/login" onClick={logout} className="inline-flex items-center gap-2 rounded-full bg-eco-800 px-4 py-2 text-sm font-semibold text-white">
                <LogOut size={16} /> Выйти
              </Link>
            </div>
          </div>
        </header>
        {open && (
          <div className="fixed inset-0 z-50 bg-eco-900/40 lg:hidden" onClick={() => setOpen(false)}>
            <aside className="h-full w-80 max-w-[86vw] bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between">
                <span className="font-bold text-eco-800">Кабинет</span>
                <button onClick={() => setOpen(false)}><X size={20} /></button>
              </div>
              {nav}
            </aside>
          </div>
        )}
        <main className="px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
};

export default CabinetLayout;
