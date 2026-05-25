import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronDown, HelpCircle, LogIn, Menu, UserPlus, X } from 'lucide-react';
import { FaInstagram, FaTelegramPlane, FaTiktok, FaWhatsapp } from 'react-icons/fa';
import Button from '../components/ui/Button';
import WhatsAppButton from '../components/WhatsAppButton';
import OrderChoiceModal from '../components/OrderChoiceModal';
import { company } from '../config/company';
import { trackPhoneClick } from '../services/analytics';

const navItems = [
  { label: 'Главная', path: '/' },
  { label: 'О компании', path: '/about' },
  { label: 'Услуги', path: '/services' },
  { label: 'Сотрудники', path: '/employees' },
  { label: 'Как это работает', path: '/#how-it-works' },
  { label: 'Контакты', path: '/contacts' },
];

const accountMenuItems = [
  { label: 'Регистрация', path: '/register', Icon: UserPlus },
  { label: 'Войти', path: '/login', Icon: LogIn },
  { label: 'Частые вопросы', path: '/faq', Icon: HelpCircle },
];

const socialLinks = [
  { label: 'TikTok', href: 'https://www.tiktok.com/@ecoprogress.group', Icon: FaTiktok },
  { label: 'Instagram', href: 'https://www.instagram.com/ecoprogress.group', Icon: FaInstagram },
  { label: 'Telegram', href: 'https://t.me/ecoprogress_group', Icon: FaTelegramPlane },
];

const PublicLayout = ({ children }: { children: ReactNode }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [orderModal, setOrderModal] = useState(false);

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
            <span className="leading-none">ecoprogress.kz</span>
          </Link>
          <nav className="hidden items-center gap-5 xl:gap-6 lg:flex">
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
            <div className="relative">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAccountMenuOpen((state) => !state)}
                className="gap-2 border-eco-200 bg-white text-eco-800 hover:bg-eco-50"
                aria-expanded={accountMenuOpen}
              >
                Меню <ChevronDown size={16} className={`transition ${accountMenuOpen ? 'rotate-180' : ''}`} />
              </Button>
              {accountMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] w-72 overflow-hidden rounded-[20px] border border-eco-100 bg-white p-2 shadow-2xl shadow-eco-900/12">
                  {accountMenuItems.map(({ label, path, Icon }) => (
                    <Link
                      key={path}
                      to={path}
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-eco-900 hover:bg-eco-50"
                    >
                      <Icon size={18} className="text-eco-600" />
                      {label}
                    </Link>
                  ))}
                  <div className="mt-2 border-t border-slate-100 px-3 py-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Социальные сети</p>
                    <div className="mt-3 flex gap-2">
                      {socialLinks.map(({ label, href, Icon }) => (
                        <a
                          key={label}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={label}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-eco-50 text-eco-800 hover:bg-eco-900 hover:text-white"
                        >
                          <Icon size={18} />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <Button type="button" onClick={() => setOrderModal(true)} className="bg-accent text-eco-900 hover:bg-accent/90">
              Оставить заявку
            </Button>
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
              <div className="grid gap-2 border-t border-eco-100 pt-3">
                {accountMenuItems.map(({ label, path, Icon }) => (
                  <Link key={path} to={path} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-2xl border border-eco-100 px-4 py-3 text-sm font-semibold text-eco-800">
                    <Icon size={18} className="text-eco-600" />
                    {label}
                  </Link>
                ))}
                <div className="flex items-center gap-2 rounded-2xl bg-eco-50 px-4 py-3">
                  {socialLinks.map(({ label, href, Icon }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-eco-800 shadow-sm hover:bg-eco-900 hover:text-white"
                    >
                      <Icon size={18} />
                    </a>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => { setMenuOpen(false); setOrderModal(true); }} className="block w-full rounded-2xl bg-accent px-4 py-3 text-left text-sm font-semibold text-eco-900">
                Оставить заявку
              </button>
            </div>
          </div>
        )}
      </header>
      <main>{children}</main>
      <WhatsAppButton floating />
      <OrderChoiceModal open={orderModal} onClose={() => setOrderModal(false)} />
      <footer className="relative isolate overflow-hidden bg-eco-900 text-white">
        <img src="/para.jpg" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-eco-900/86" />
        <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_0.8fr_1fr_1fr]">
            <div>
              <h3 className="text-2xl font-bold leading-tight">
                ecoprogress.kz
              </h3>
              <p className="mt-4 max-w-md text-sm leading-6 text-white/75">
                Экологические документы, лаборатория, вывоз и утилизация отходов для бизнеса.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <WhatsAppButton label="WhatsApp" className="bg-accent px-4 py-2 text-eco-900 hover:bg-accent/90" />
                <button type="button" onClick={() => setOrderModal(true)} className="inline-flex rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">Оставить заявку</button>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase text-eco-200">Услуги</h4>
              <ul className="mt-4 space-y-3 text-sm text-white/75">
                <li><Link to="/services/ecological-documents" className="hover:text-white">Экологические документы</Link></li>
                <li><Link to="/services/waste-transportation" className="hover:text-white">Вывоз отходов</Link></li>
                <li><Link to="/services/waste-recycling" className="hover:text-white">Утилизация отходов</Link></li>
                <li><Link to="/services/laboratory-tests" className="hover:text-white">Лабораторные анализы</Link></li>
                <li><Link to="/services/poligon-tbo" className="hover:text-white">Полигон ТБО</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase text-eco-200">Контакты</h4>
              <ul className="mt-4 space-y-3 text-sm text-white/75">
                <li><a href={company.phoneHref} onClick={() => trackPhoneClick({ placement: 'footer' })} className="hover:text-white">{company.phone}</a></li>
                <li className="flex items-center gap-2"><FaWhatsapp className="shrink-0 text-[#25D366]" size={16} aria-hidden="true" /> WhatsApp: {company.whatsappDisplay}</li>
                <li>{company.email}</li>
                <li>{company.address}</li>
                <li>{company.schedule}</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase text-eco-200">Компания</h4>
              <div className="mt-4 space-y-3 text-sm text-white/75">
                <Link to="/tariffs" className="block hover:text-white">Тарифы</Link>
                <Link to="/employees" className="block hover:text-white">Сотрудники</Link>
                <Link to="/faq" className="block hover:text-white">FAQ</Link>
                <Link to="/contacts" className="block hover:text-white">Контакты</Link>
              </div>
              <h4 className="mt-7 text-sm font-semibold uppercase text-eco-200">Личный кабинет</h4>
              <div className="mt-4 space-y-3 text-sm text-white/75">
                <Link to="/login" className="block hover:text-white">Кабинет клиента</Link>
                <Link to="/staff/login" className="block text-xs text-white/45 hover:text-white">Вход для сотрудников</Link>
              </div>
            </div>
          </div>
          <div className="mt-12 border-t border-white/15 pt-6 text-sm text-white/60">2026 ecoprogress.kz. Все права защищены.</div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
