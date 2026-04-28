import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Button from '../components/ui/Button';
import BrandLogo from '../components/ui/BrandLogo';

const navItems = [
  { label: 'Главная', path: '/' },
  { label: 'О компании', path: '/about' },
  { label: 'Услуги', path: '/services' },
  { label: 'Сотрудники', path: '/employees' },
  { label: 'Новости', path: '/news' },
  { label: 'Кабинет клиента', path: '/cabinet' },
];

const PublicLayout = ({ children }: { children: ReactNode }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#F7FBFD] text-slate-900">
      <header className={`sticky top-0 z-40 border-b border-eco-200/45 bg-white/92 text-eco-900 backdrop-blur-xl transition-all duration-300 ${scrolled ? 'shadow-xl shadow-eco-900/8' : 'shadow-sm shadow-eco-900/5'}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/" className="group inline-flex items-center gap-3 text-xl font-bold text-eco-900">
            <BrandLogo className="h-11 w-11" />
            <span className="leading-none">
              <span className="block text-base">ECOPROGRESS</span>
              <span className="block text-xs tracking-[0.22em] text-eco-500">GROUP</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 lg:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `relative text-sm font-medium transition after:absolute after:-bottom-2 after:left-0 after:h-0.5 after:bg-accent after:transition-all ${
                    isActive ? 'text-eco-800 after:w-full' : 'text-slate-700 hover:text-eco-800 after:w-0 hover:after:w-full'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <Link to="/login">
              <Button variant="secondary" className="border-eco-200 bg-white text-eco-800 hover:bg-eco-50">Войти</Button>
            </Link>
            <Link to="/register">
              <Button className="bg-accent text-eco-900 hover:bg-accent/90">Регистрация</Button>
            </Link>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-2xl border border-eco-200 bg-white p-3 text-eco-900 lg:hidden"
            onClick={() => setMenuOpen((state) => !state)}
            aria-label="Меню"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-eco-100 bg-white px-5 py-5 shadow-xl lg:hidden">
            <div className="space-y-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-2xl px-4 py-3 text-sm font-medium ${isActive ? 'bg-eco-800 text-white' : 'text-slate-700 hover:bg-eco-50'}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <Link to="/register" onClick={() => setMenuOpen(false)} className="block rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-eco-900">
                Регистрация
              </Link>
            </div>
          </div>
        )}
      </header>
      <main>{children}</main>
      <footer className="relative overflow-hidden bg-eco-900 text-white">
        <div className="absolute inset-0 bg-sea bg-cover bg-center opacity-35" />
        <div className="absolute inset-0 bg-eco-900/80" />
        <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_0.8fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-3">
                <BrandLogo className="h-12 w-12" dark={false} />
                <h3 className="text-2xl font-bold leading-tight">
                  <span className="block">ECOPROGRESS</span>
                  <span className="block text-sm tracking-[0.24em] text-eco-200">GROUP</span>
                </h3>
              </div>
              <p className="mt-4 max-w-md text-sm leading-6 text-white/75">
                Экологическое сопровождение бизнеса: документы, отчетность, проверки и понятные статусы в онлайн-кабинете.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase text-eco-200">Навигация</h4>
              <ul className="mt-4 space-y-3 text-sm text-white/75">
                {navItems.slice(0, 5).map((item) => (
                  <li key={item.path}>
                    <Link to={item.path} className="hover:text-white">{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase text-eco-200">Контакты</h4>
              <ul className="mt-4 space-y-3 text-sm text-white/75">
                <li>+7 (___) ___-__-__</li>
                <li>info@ecoprogress.kz</li>
                <li>Республика Казахстан, г. Астана</li>
                <li>Пн-Пт, 09:00-18:00</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase text-eco-200">Сервис</h4>
              <div className="mt-4 space-y-3 text-sm text-white/75">
                <Link to="/login" className="block hover:text-white">Кабинет клиента</Link>
                <Link to="/staff/login" className="block hover:text-white">Вход для сотрудников</Link>
              </div>
            </div>
          </div>
          <div className="mt-12 border-t border-white/15 pt-6 text-sm text-white/60">2026 ECOPROGRESS GROUP. Frontend mock service.</div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
