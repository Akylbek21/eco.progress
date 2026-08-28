import { ReactNode, useEffect, useState } from 'react';
import { lazy, Suspense } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, HelpCircle, LogIn, Menu, Search, UserPlus, X } from 'lucide-react';
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
];

const kkNavItems = [
  { label: 'Қызметтер', path: '/kk/ekologiyalyq-qyzmetter' },
  { label: 'ПЭК бағдарламасы', path: '/kk/pek-bagdarlamasy' },
  { label: 'Зертханалық зерттеулер', path: '/kk/zerthanalyq-zertteuler' },
  { label: 'Қалдықтар', path: '/kk/qaldyqtardy-kadege-zharatu' },
  { label: 'WhatsApp', path: getWhatsAppUrl() },
];

const accountMenuItems = [
  { label: 'WhatsApp', path: getWhatsAppUrl(), Icon: FaWhatsapp },
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
      <header className={`sticky top-0 z-40 border-b border-slate-200/70 bg-[#F8FCFE]/94 text-eco-900 backdrop-blur-2xl transition-all duration-300 before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-gradient-to-r before:from-transparent before:via-accent/80 before:to-transparent ${scrolled ? 'shadow-[0_12px_35px_-20px_rgba(2,28,57,0.4)]' : 'shadow-[0_1px_0_rgba(2,28,57,0.03)]'}`}>
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Link to={isKk ? '/kk' : '/'} className="group inline-flex shrink-0 items-center text-eco-900" aria-label="ecoprogress.kz — главная">
            <span className="whitespace-nowrap text-[19px] font-extrabold leading-none tracking-[-0.035em]">
              eco<span className="text-eco-500">progress</span><span className="text-[14px] font-bold text-slate-500">.kz</span>
            </span>
          </Link>
          <nav aria-label={isKk ? 'Негізгі навигация' : 'Основная навигация'} className="hidden items-center gap-1 rounded-full border border-slate-200/80 bg-white/80 p-1.5 shadow-[0_8px_24px_-18px_rgba(2,28,57,0.5)] xl:flex">
            {currentNavItems.map((item) => item.path.startsWith('http') || opensPrivateRuntime(item.path) ? (
              <a key={item.path} href={item.path} target={item.path.startsWith('http') ? '_blank' : undefined} rel={item.path.startsWith('http') ? 'noreferrer' : undefined} className="shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-semibold text-slate-600 transition-all duration-200 hover:bg-eco-50 hover:text-eco-900">
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
                  `shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-semibold transition-all duration-200 ${
                    isActive ? 'bg-eco-900 text-white shadow-[0_6px_14px_-8px_rgba(2,28,57,0.8)]' : 'text-slate-600 hover:bg-eco-50 hover:text-eco-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2.5 xl:flex">
            <nav aria-label={isKk ? 'Тілді таңдау' : 'Выбор языка'} className="inline-flex rounded-full border border-slate-200 bg-white/85 p-1 text-[11px] font-extrabold shadow-sm">
              <Link to={ruPath} lang="ru" className={`whitespace-nowrap rounded-full px-2.5 py-2 transition-colors ${!isKk ? 'bg-eco-900 text-white' : 'text-slate-500 hover:text-eco-900'}`}>RU</Link>
              <Link to={kkPath} lang="kk" className={`whitespace-nowrap rounded-full px-2.5 py-2 transition-colors ${isKk ? 'bg-eco-900 text-white' : 'text-slate-500 hover:text-eco-900'}`}>ҚАЗ</Link>
            </nav>
            <div className="relative">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAccountMenuOpen((state) => !state)}
                className="min-h-10 shrink-0 gap-2 whitespace-nowrap border-slate-200 bg-white/85 px-4 text-[13px] text-eco-900 shadow-sm hover:border-eco-200 hover:bg-white"
                aria-expanded={accountMenuOpen}
              >
                {isKk ? 'Мәзір' : 'Меню'} <ChevronDown size={16} className={`transition ${accountMenuOpen ? 'rotate-180' : ''}`} />
              </Button>
              {accountMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] w-72 overflow-hidden rounded-[20px] border border-eco-100 bg-white p-2 shadow-2xl shadow-eco-900/12">
                  {accountMenuItems.map(({ label, path, Icon }) => path.startsWith('http') || opensPrivateRuntime(path) ? (
                    <a key={path} href={path} target={path.startsWith('http') ? '_blank' : undefined} rel={path.startsWith('http') ? 'noreferrer' : undefined} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-eco-900 hover:bg-eco-50">
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
            <Button type="button" onClick={() => setOrderModal(true)} className="group min-h-11 shrink-0 gap-2 whitespace-nowrap bg-gradient-to-r from-eco-900 to-eco-600 px-5 text-[13px] text-white shadow-[0_10px_22px_-12px_rgba(2,28,57,0.8)] hover:from-eco-800 hover:to-eco-500">
              {isKk ? 'Өтінім қалдыру' : 'Получить консультацию эколога'}
              <ArrowUpRight size={16} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </Button>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-[14px] border border-slate-200 bg-white p-3 text-eco-900 shadow-sm transition hover:border-eco-200 hover:bg-eco-50 xl:hidden"
            onClick={() => setMenuOpen((state) => !state)}
            aria-label={isKk ? 'Мәзір' : 'Меню'}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-eco-100 bg-white px-5 py-5 shadow-xl xl:hidden">
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
                {accountMenuItems.map(({ label, path, Icon }) => path.startsWith('http') || opensPrivateRuntime(path) ? (
                    <a key={path} href={path} target={path.startsWith('http') ? '_blank' : undefined} rel={path.startsWith('http') ? 'noreferrer' : undefined} className="flex items-center gap-3 rounded-2xl border border-eco-100 px-4 py-3 text-sm font-semibold text-eco-800">
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
        <svg aria-hidden="true" viewBox="0 0 1440 80" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-0 z-0 h-16 w-full sm:h-20">
          <path fill="#F7FBFD" d="M0 0h1440v18c-324 54-760-20-1440 30V0Z" />
          <path d="M0 48c680-50 1116 24 1440-30" fill="none" stroke="#38C7BA" strokeOpacity="0.75" strokeWidth="2" />
        </svg>
        <div className="relative z-10 mx-auto max-w-7xl px-5 pb-14 pt-24 sm:px-8 sm:pt-28">
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
                <li><Link to={isKk ? '/kk/sanitariyalyq-qorgau-aimagy' : '/services/environmental-audit'} className="hover:text-white">{isKk ? 'Санитариялық-қорғау аймағы' : 'Экологический аудит'}</Link></li>
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
                {!isKk && <><Link to="/partners" className="block hover:text-white">Партнеры</Link><Link to="/news" className="block hover:text-white">Статьи</Link><Link to="/cases" className="block hover:text-white">Кейсы</Link><Link to="/faq" className="block hover:text-white">FAQ</Link></>}
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
