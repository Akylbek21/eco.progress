import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

const links = [
  { label: 'Dashboard', anchor: 'dashboard' },
  { label: 'Мои заявки', anchor: 'orders' },
  { label: 'Создать заявку', anchor: 'create' },
  { label: 'Документы', anchor: 'documents' },
  { label: 'Оплаты', anchor: 'payments' },
  { label: 'Профиль', anchor: 'profile' },
  { label: 'Уведомления', anchor: 'notifications' },
];

const CabinetLayout = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-eco-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 sm:px-8">
          <Link to="/cabinet" className="text-lg font-semibold text-eco-900">
            Клиентский кабинет
          </Link>
          <div className="hidden items-center gap-3 lg:flex">
            <Link to="/">
              <Button variant="ghost">На сайт</Button>
            </Link>
            <Link to="/login">
              <Button>Выйти</Button>
            </Link>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 shadow-sm lg:hidden"
            onClick={() => setOpen((state) => !state)}
            aria-label="Меню кабинета"
          >
            <span className="text-2xl">☰</span>
          </button>
        </div>
        {open && (
          <div className="border-t border-slate-200 bg-white lg:hidden">
            <div className="space-y-2 px-6 py-5">
              {links.map((item) => (
                <a key={item.anchor} href={`#${item.anchor}`} className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </header>
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 sm:px-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:block">
          <p className="mb-4 text-sm uppercase tracking-[0.24em] text-eco-700">Разделы</p>
          <div className="space-y-2">
            {links.map((item) => (
              <a
                key={item.anchor}
                href={`#${item.anchor}`}
                className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-eco-50"
              >
                {item.label}
              </a>
            ))}
          </div>
        </aside>
        <section>{children}</section>
      </div>
    </div>
  );
};

export default CabinetLayout;
