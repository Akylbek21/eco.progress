import { ReactNode, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { User, Settings, Menu } from 'lucide-react';
import Button from '../components/ui/Button';

const navItems = [
  { label: 'Главная', path: '/' },
  { label: 'О компании', path: '/about' },
  { label: 'Услуги', path: '/services' },
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
            ECOPROGRESS 
            GROUP
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
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-4">
            <div>
              <h3 className="text-xl font-bold text-white">ECOPROGRESS GROUP</h3>
              <p className="mt-4 text-sm text-eco-200">
                Экологическое сопровождение бизнеса. Помогаем соблюдать требования и проходить проверки.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.24em] text-eco-300">Навигация</h4>
              <ul className="mt-4 space-y-3 text-sm text-eco-200">
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
              <h4 className="text-sm font-semibold uppercase tracking-[0.24em] text-eco-300">Контакты</h4>
              <ul className="mt-4 space-y-3 text-sm text-eco-200">
                <li>Республика Казахстан, г. Астана</li>
                <li>+7 (___) ___-__-__</li>
                <li>info@ecoprogress.kz</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.24em] text-eco-300">Время работы</h4>
              <p className="mt-4 text-sm text-eco-200">
                Пн–Пт: 09:00–18:00
              </p>
            </div>
          </div>
          <div className="mt-12 border-t border-white/20 pt-8 text-center text-sm text-eco-300">
            © 2026 ECOPROGRESS GROUP. Все права защищены.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
