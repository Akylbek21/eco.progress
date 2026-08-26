import { ReactNode, useEffect, useState } from 'react';
import { lazy, Suspense } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, HelpCircle, LogIn, Menu, Search, UserPlus, X } from 'lucide-react';
import { FaInstagram, FaTelegramPlane, FaTiktok, FaWhatsapp } from 'react-icons/fa';
import Button from '../components/ui/Button';
import WhatsAppButton from '../components/WhatsAppButton';
import ResponsiveImage from '../components/ui/ResponsiveImage';
import { company, getWhatsAppUrl } from '../config/company';
import { trackEmailClick, trackPhoneClick } from '../services/analytics';
import { preloadPublicRoute } from '../utils/publicRoutePreload';
import { localePairForPath } from '../seo/localeRoutePairs';

const OrderChoiceModal = lazy(() => import('../components/OrderChoiceModal'));

const footerCities = [
  ['Алматы', 'almaty'], ['Астана', 'astana'], ['Шымкент', 'shymkent'],
  ['Караганда', 'karaganda'], ['Тараз', 'taraz'], ['Туркестан', 'turkestan'],
  ['Атырау', 'atyrau'], ['Актау', 'aktau'], ['Актобе', 'aktobe'],
];

const navItems = [
  { label: 'Услуги', path: '/services' },
  { label: 'Города', path: '/regions' },
  { label: 'Статьи', path: '/news' },
  { label: 'Кейсы', path: '/cases' },
  { label: 'О компании', path: '/about' },
  { label: 'Контакты', path: '/contacts' },
  { label: 'WhatsApp', path: getWhatsAppUrl() },
  { label: 'Войти', path: '/login' },
];

const kkNavItems = [
  { label: 'Қызметтер', path: '/kk/ekologiyalyq-qyzmetter' },
  { label: 'ПЭК бағдарламасы', path: '/kk/pek-bagdarlamasy' },
  { label: 'Зертханалық зерттеулер', path: '/kk/zerthanalyq-zertteuler' },
  { label: 'Қалдықтар', path: '/kk/qaldyqtardy-kadege-zharatu' },
  { label: 'WhatsApp', path: getWhatsAppUrl() },
];

const accountMenuItems = [
  { label: 'Поиск по сайту', path: '/search', Icon: Search },
  { label: 'Регистрация', path: '/register', Icon: UserPlus },
  { label: 'Войти', path: '/login', Icon: LogIn },
  { label: 'Частые вопросы', path: '/faq', Icon: HelpCircle },
];

const socialLinks = [
  { label: 'TikTok', href: company.tiktokUrl, Icon: FaTiktok },
  { label: 'Instagram', href: company.instagramUrl, Icon: FaInstagram },
  { label: 'Telegram', href: 'https://t.me/ecoprogress_group', Icon: FaTelegramPlane },
];

const privateRuntimePrefixes = ['/login', '/register', '/staff', '/cabinet', '/client', '/admin', '/dashboard'];
const opensPrivateRuntime = (path: string) => privateRuntimePrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const PublicLayout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const isKk = pathname === '/kk' || pathname.startsWith('/kk/');
  const currentNavItems = isKk ? kkNavItems : navItems;
  const localePair = localePairForPath(pathname);
  const ruPath = localePair?.ruPath || '/';
  const kkPath = localePair?.kkPath || '/kk';
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
          <Link to={isKk ? '/kk' : '/'} className="inline-flex shrink-0 items-center text-xl font-bold text-eco-900">
            <span className="whitespace-nowrap leading-none">ecoprogress.kz</span>
          </Link>
          <nav className="hidden items-center gap-4 xl:gap-5 lg:flex">
            {currentNavItems.map((item) => item.path.startsWith('http') || opensPrivateRuntime(item.path) ? (
              <a key={item.path} href={item.path} target={item.path.startsWith('http') ? '_blank' : undefined} rel={item.path.startsWith('http') ? 'noreferrer' : undefined} className="relative shrink-0 whitespace-nowrap text-sm font-medium text-slate-700 transition after:absolute after:-bottom-2 after:left-0 after:h-0.5 after:w-0 after:bg-accent after:transition-all hover:text-eco-800 hover:after:w-full">
                {item.label}
              </a>
            ) : (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onPointerEnter={() => preloadPublicRoute(item.path)}
                onFocus={() => preloadPublicRoute(item.path)}
                onPointerDown={() => preloadPublicRoute(item.path)}
                className={({ isActive }) =>
                  `relative shrink-0 whitespace-nowrap text-sm font-medium transition after:absolute after:-bottom-2 after:left-0 after:h-0.5 after:bg-accent after:transition-all ${
                    isActive ? 'text-eco-800 after:w-full' : 'text-slate-700 hover:text-eco-800 after:w-0 hover:after:w-full'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <nav aria-label={isKk ? 'Тілді таңдау' : 'Выбор языка'} className="inline-flex rounded-full border border-eco-200 bg-white p-1 text-xs font-bold">
              <Link to={ruPath} lang="ru" className={`whitespace-nowrap rounded-full px-3 py-2 ${!isKk ? 'bg-eco-900 text-white' : 'text-eco-800'}`}>RU</Link>
              <Link to={kkPath} lang="kk" className={`whitespace-nowrap rounded-full px-3 py-2 ${isKk ? 'bg-eco-900 text-white' : 'text-eco-800'}`}>ҚАЗ</Link>
            </nav>
            <div className="relative">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAccountMenuOpen((state) => !state)}
                className="shrink-0 gap-2 whitespace-nowrap border-eco-200 bg-white text-eco-800 hover:bg-eco-50"
                aria-expanded={accountMenuOpen}
              >
                {isKk ? 'Мәзір' : 'Меню'} <ChevronDown size={16} className={`transition ${accountMenuOpen ? 'rotate-180' : ''}`} />
              </Button>
              {accountMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] w-72 overflow-hidden rounded-[20px] border border-eco-100 bg-white p-2 shadow-2xl shadow-eco-900/12">
                  {accountMenuItems.map(({ label, path, Icon }) => opensPrivateRuntime(path) ? (
                    <a key={path} href={path} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-eco-900 hover:bg-eco-50">
                      <Icon size={18} className="text-eco-600" />
                      {label}
                    </a>
                  ) : (
                    <Link key={path} to={path} onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-eco-900 hover:bg-eco-50">
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
            <Button type="button" onClick={() => setOrderModal(true)} className="shrink-0 whitespace-nowrap bg-accent text-eco-900 hover:bg-accent/90">
              {isKk ? 'Өтінім қалдыру' : 'Получить консультацию эколога'}
            </Button>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-2xl border border-eco-200 bg-white p-3 text-eco-900 lg:hidden"
            onClick={() => setMenuOpen((state) => !state)}
            aria-label={isKk ? 'Мәзір' : 'Меню'}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-eco-100 bg-white px-5 py-5 shadow-xl lg:hidden">
            <div className="space-y-2">
              <div className="mb-3 flex gap-2"><Link to={ruPath} onClick={() => setMenuOpen(false)} className="rounded-full border px-4 py-2 text-sm font-bold">RU</Link><Link to={kkPath} onClick={() => setMenuOpen(false)} className="rounded-full border px-4 py-2 text-sm font-bold">ҚАЗ</Link></div>
              {currentNavItems.map((item) => item.path.startsWith('http') || opensPrivateRuntime(item.path) ? (
                <a key={item.path} href={item.path} target={item.path.startsWith('http') ? '_blank' : undefined} rel={item.path.startsWith('http') ? 'noreferrer' : undefined} onClick={() => setMenuOpen(false)} className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-eco-50">
                  {item.label}
                </a>
              ) : (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  onPointerEnter={() => preloadPublicRoute(item.path)}
                  onFocus={() => preloadPublicRoute(item.path)}
                  onPointerDown={() => preloadPublicRoute(item.path)}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-2xl px-4 py-3 text-sm font-medium ${isActive ? 'bg-eco-800 text-white' : 'text-slate-700 hover:bg-eco-50'}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <div className="grid gap-2 border-t border-eco-100 pt-3">
                {accountMenuItems.map(({ label, path, Icon }) => opensPrivateRuntime(path) ? (
                    <a key={path} href={path} className="flex items-center gap-3 rounded-2xl border border-eco-100 px-4 py-3 text-sm font-semibold text-eco-800">
                    <Icon size={18} className="text-eco-600" />
                    {label}
                  </a>
                ) : (
                    <Link key={path} to={path} onPointerEnter={() => preloadPublicRoute(path)} onFocus={() => preloadPublicRoute(path)} onPointerDown={() => preloadPublicRoute(path)} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-2xl border border-eco-100 px-4 py-3 text-sm font-semibold text-eco-800">
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
                Получить консультацию эколога
              </button>
            </div>
          </div>
        )}
      </header>
      <main className="route-page-enter min-h-[70vh]">{children}</main>
      <WhatsAppButton floating />
      {orderModal && <Suspense fallback={null}><OrderChoiceModal open onClose={() => setOrderModal(false)} /></Suspense>}
      <footer className="relative isolate overflow-hidden bg-eco-900 text-white">
        <ResponsiveImage fill sizes="100vw" src="/media/ecoprogress-og-cover-1280.jpg" alt="" width={1280} height={720} wrapperClassName="-z-20" className="bg-eco-900 object-cover" />
        <div className="absolute inset-0 -z-10 bg-eco-900/86" />
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-[5] h-40 bg-gradient-to-b from-[#F7FBFD] via-[#F7FBFD]/88 to-transparent backdrop-blur-xl" />
        <div className="pointer-events-none absolute inset-x-0 top-12 -z-[5] h-24 bg-[#F7FBFD]/45 blur-2xl" />
        <div className="relative mx-auto max-w-7xl px-5 pb-14 pt-44 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_0.8fr_1fr_1fr]">
            <div>
              <h3 className="text-2xl font-bold leading-tight">
                ecoprogress.kz
              </h3>
              <p className="mt-4 max-w-md text-sm leading-6 text-white/75">
                {isKk ? 'Қазақстан бойынша экологиялық құжаттар мен зертханалық зерттеулер. Қалдықтарды кәдеге жарату — Шымкент, Тараз және Түркістан; шығару — Шымкент.' : 'Экологические документы и лаборатория по Казахстану. Утилизация отходов — Шымкент, Тараз и Туркестан; вывоз — Шымкент.'}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <WhatsAppButton label="WhatsApp" className="bg-accent px-4 py-2 text-eco-900 hover:bg-accent/90" />
                <button type="button" onClick={() => setOrderModal(true)} className="inline-flex rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">{isKk ? 'Өтінім қалдыру' : 'Получить консультацию эколога'}</button>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase text-eco-200">{isKk ? 'Қызметтер' : 'Услуги'}</h4>
              <ul className="mt-4 space-y-3 text-sm text-white/75">
                <li><Link to={isKk ? '/kk/ekologiyalyq-qyzmetter' : '/services/environmental-design'} className="hover:text-white">{isKk ? 'Экологиялық қызметтер' : 'Экологическое проектирование'}</Link></li>
                <li><Link to={isKk ? '/kk/zerthanalyq-zertteuler' : '/services/laboratory-tests'} className="hover:text-white">{isKk ? 'Зертханалық зерттеулер' : 'Лабораторные замеры'}</Link></li>
                <li><Link to={isKk ? '/kk/pek-bagdarlamasy' : '/services/industrial-control'} className="hover:text-white">{isKk ? 'Өндірістік экологиялық бақылау' : 'Производственный контроль'}</Link></li>
                <li><Link to={isKk ? '/kk/qaldyqtardy-kadege-zharatu' : '/services/waste-recycling'} className="hover:text-white">{isKk ? 'Қалдықтарды кәдеге жарату' : 'Утилизация: Шымкент, Тараз, Туркестан'}</Link></li>
                <li><Link to={isKk ? '/kk/qaldyqtar-pasporty' : '/services/waste-passport'} className="hover:text-white">{isKk ? 'Қалдықтар паспорты' : 'Паспорт отходов'}</Link></li>
                <li><Link to={isKk ? '/kk/pek-esebi' : '/services/report-pek'} className="hover:text-white">{isKk ? 'ПЭК есебі' : 'Отчет ПЭК'}</Link></li>
                <li><Link to={isKk ? '/kk/ekologiyalyq-ruqsat' : '/services/environmental-permits'} className="hover:text-white">{isKk ? 'Экологиялық рұқсат' : 'Разрешения'}</Link></li>
                <li><Link to={isKk ? '/kk/sanitariyalyq-qorgau-aimagy' : '/ses-proverka-proizvodstvennyy-kontrol'} className="hover:text-white">{isKk ? 'Санитариялық-қорғау аймағы' : 'Сопровождение проверок'}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase text-eco-200">{isKk ? 'Қалалар' : 'Города'}</h4>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/75">
                {isKk ? <Link to="/kk/pek-bagdarlamasy-shymkent" className="hover:text-white">Шымкент</Link> : footerCities.map(([city, slug]) => (
                  <Link key={slug} to={`/ecologicheskie-uslugi-${slug}`} className="hover:text-white">{city}</Link>
                ))}
                {!isKk && <Link to="/regions" className="font-semibold text-white hover:text-accent">Все города</Link>}
              </div>
              <h4 className="mt-7 text-sm font-semibold uppercase text-eco-200">{isKk ? 'Байланыс' : 'Контакты'}</h4>
              <ul className="mt-4 space-y-3 text-sm text-white/75">
                <li><a href={company.phoneHref} onClick={() => trackPhoneClick({ placement: 'footer' })} className="hover:text-white">{company.phone}</a></li>
                <li className="flex items-center gap-2"><FaWhatsapp className="shrink-0 text-[#25D366]" size={16} aria-hidden="true" /> WhatsApp: {company.whatsappDisplay}</li>
                <li><a href={`mailto:${company.email}`} onClick={() => trackEmailClick({ placement: 'footer' })} className="hover:text-white">{company.email}</a></li>
                <li><a href={company.siteUrl} target="_blank" rel="noreferrer" className="hover:text-white">{company.siteLabel}</a></li>
                <li>{company.address}</li>
                <li>{company.schedule}</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase text-eco-200">{isKk ? 'Компания' : 'Компания'}</h4>
              <div className="mt-4 space-y-3 text-sm text-white/75">
                <Link to={isKk ? '/kk' : '/about'} className="block hover:text-white">{isKk ? 'Басты бет' : 'О компании'}</Link>
                <Link to={isKk ? '/kk/ekologiyalyq-qyzmetter' : '/contacts'} className="block hover:text-white">{isKk ? 'Қызметтер' : 'Контакты'}</Link>
                {!isKk && <><Link to="/partners" className="block hover:text-white">Партнеры</Link><Link to="/employees" className="block hover:text-white">Сотрудники</Link><Link to="/news" className="block hover:text-white">Статьи</Link><Link to="/cases" className="block hover:text-white">Кейсы</Link><Link to="/faq" className="block hover:text-white">FAQ</Link></>}
              </div>
              <h4 className="mt-7 text-sm font-semibold uppercase text-eco-200">{isKk ? 'Жеке кабинет' : 'Личный кабинет'}</h4>
              <div className="mt-4 space-y-3 text-sm text-white/75">
                <a href="/login" className="block hover:text-white">{isKk ? 'Клиент кабинеті' : 'Кабинет клиента'}</a>
                <a href="/staff/login" className="block text-xs text-white/45 hover:text-white">{isKk ? 'Қызметкерлерге кіру' : 'Вход для сотрудников'}</a>
              </div>
            </div>
          </div>
          <div className="mt-12 border-t border-white/15 pt-6 text-sm text-white/60">2026 ecoprogress.kz. {isKk ? 'Барлық құқықтар қорғалған.' : 'Все права защищены.'}</div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
