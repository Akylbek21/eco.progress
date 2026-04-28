import { ReactNode, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { User, Settings, Menu } from 'lucide-react';
import Button from '../components/ui/Button';

const navItems = [
  { label: 'Главная', path: '/' },
  { label: 'О компании', path: '/about' },
  { label: 'Услуги', path: '/services' },
  { label: 'Тарифы', path: '/tariffs' },
  { label: 'Сотрудники', path: '/employees' },
  { label: 'Новости', path: '/news' },
];

const PublicLayout = ({ children }: { children: ReactNode }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-eco-50 text-slate-900">
      <header className="sticky top-0 z-40 bg-eco-700 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 sm:px-8">
          <Link to="/" className="text-xl font-bold text-white">
            ECOPROGRESS GROUP
          </Link>
          <nav className="hidden items-center gap-8 lg:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `text-sm font-medium transition ${isActive ? 'text-accent' : 'text-white hover:text-eco-200'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-4 lg:flex">
            <Link to="/cabinet" className="rounded-full p-2 text-white hover:bg-eco-600">
              <User size={20} />
            </Link>
            <Link to="/cabinet" className="rounded-full p-2 text-white hover:bg-eco-600">
              <Settings size={20} />
            </Link>
            <Link to="/login">
              <Button variant="secondary">Вход</Button>
            </Link>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 p-3 text-white shadow-sm lg:hidden"
            onClick={() => setMenuOpen((state) => !state)}
            aria-label="Меню"
          >
            <Menu size={20} />
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-white/20 bg-eco-700 lg:hidden">
            <div className="space-y-2 px-6 py-5">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-2xl px-4 py-3 text-sm font-medium ${
                      isActive ? 'bg-accent text-white' : 'text-white hover:bg-eco-600'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <Link to="/login" className="block rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-eco-700 hover:bg-eco-50">
                Вход
              </Link>
            </div>
          </div>
        )}
      </header>
      <main>{children}</main>
      <footer className="bg-eco-700 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-16 sm:px-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-md">
            <h2 className="text-2xl font-semibold text-white">Eco.Progress</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Сопровождаем бизнес на каждом этапе экологического аудита, оформления отчетности и прохождения проверок.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-eco-400">Контакты</p>
              <p className="mt-4 text-sm text-slate-300">Нур-Султан, ул. Экологическая, 23</p>
              <p className="mt-2 text-sm text-slate-300">+7 (7172) 34-56-78</p>
              <p className="mt-2 text-sm text-slate-300">info@ecoprogress.kz</p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-eco-400">Навигация</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                {navItems.map((item) => (
                  <li key={item.path}>
                    <Link to={item.path} className="hover:text-white">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-eco-400">Инструменты</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li>Личный кабинет</li>
                <li>Админка</li>
                <li>Моковые данные</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 px-6 py-6 text-center text-sm text-slate-500 sm:px-8">
          © 2026 Eco.Progress. Все права защищены.
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
