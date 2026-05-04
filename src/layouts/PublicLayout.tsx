import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Button from '../components/ui/Button';
import WhatsAppButton from '../components/WhatsAppButton';
import { companyContacts } from '../data/mockData';

const navItems = [
  { label: 'Главная', path: '/' },
  { label: 'Услуги', path: '/services' },
  { label: 'Сотрудники', path: '/employees' },
  { label: 'Тарифы', path: '/tariffs' },
  { label: 'Контакты', path: '/contacts' },
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
          <Link to="/" className="inline-flex items-center text-xl font-bold text-eco-900">
            <span className="leading-none">
              <span className="block text-base">ECOPROGRESS</span>
              <span className="block text-xs tracking-[0.22em] text-eco-500">GROUP</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 lg:flex">
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
            <Link to="/cabinet/orders/new">
              <Button className="bg-accent text-eco-900 hover:bg-accent/90">Оставить заявку</Button>
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
              <Link to="/login" onClick={() => setMenuOpen(false)} className="block rounded-2xl border border-eco-100 px-4 py-3 text-sm font-semibold text-eco-800">
                Войти
              </Link>
              <Link to="/cabinet/orders/new" onClick={() => setMenuOpen(false)} className="block rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-eco-900">
                Оставить заявку
              </Link>
            </div>
          </div>
        )}
      </header>
      <main>{children}</main>
      <WhatsAppButton />
      <footer className="relative overflow-hidden bg-eco-900 text-white">
        <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_0.8fr_1fr_1fr]">
            <div>
              <h3 className="text-2xl font-bold leading-tight">
                <span className="block">ECOPROGRESS</span>
                <span className="block text-sm tracking-[0.24em] text-eco-200">GROUP</span>
              </h3>
              <p className="mt-4 max-w-md text-sm leading-6 text-white/75">
                Экологические документы, вывоз отходов, лабораторные исследования и сопровождение бизнеса с понятным личным кабинетом.
              </p>
              <p className="mt-5 text-xs leading-5 text-white/45">Юридическая информация: реквизиты и лицензии будут добавлены после подключения backend.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase text-eco-200">Услуги</h4>
              <ul className="mt-4 space-y-3 text-sm text-white/75">
                {['Экологические документы', 'Вывоз и утилизация отходов', 'Лабораторные анализы', 'Сопровождение проверок'].map((item) => <li key={item}><Link to="/services" className="hover:text-white">{item}</Link></li>)}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase text-eco-200">Контакты</h4>
              <ul className="mt-4 space-y-3 text-sm text-white/75">
                <li>{companyContacts.phone}</li>
                <li>WhatsApp: {companyContacts.whatsappDisplay}</li>
                <li>{companyContacts.email}</li>
                <li>{companyContacts.address}</li>
                <li>{companyContacts.schedule}</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase text-eco-200">Сервис</h4>
              <div className="mt-4 space-y-3 text-sm text-white/75">
                <Link to="/login" className="block hover:text-white">Кабинет клиента</Link>
                <Link to="/faq" className="block hover:text-white">FAQ</Link>
                <Link to="/contacts" className="block hover:text-white">Контакты</Link>
                <Link to="/staff/login" className="block text-xs text-white/45 hover:text-white">Вход для сотрудников</Link>
              </div>
            </div>
          </div>
          <div className="mt-12 border-t border-white/15 pt-6 text-sm text-white/60">2026 ECOPROGRESS GROUP. Все права защищены.</div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
