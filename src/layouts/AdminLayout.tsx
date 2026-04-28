import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

const nav = [
  { title: 'Заявки', anchor: 'orders' },
  { title: 'Клиенты', anchor: 'clients' },
  { title: 'Услуги', anchor: 'services' },
  { title: 'Новости', anchor: 'news' },
  { title: 'Сотрудники', anchor: 'employees' },
];

const AdminLayout = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-eco-50 text-slate-900">
      <div className="lg:flex lg:min-h-screen">
        <aside className="hidden w-72 flex-col border-r border-slate-200 bg-white p-6 shadow-sm lg:flex">
          <div className="mb-10">
            <Link to="/admin" className="inline-flex items-center gap-3 text-lg font-semibold text-eco-900">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-3xl bg-eco-600 text-2xl text-white">A</span>
              Админка
            </Link>
          </div>
          <nav className="space-y-2">
            {nav.map((item) => (
              <a key={item.anchor} href={`#${item.anchor}`} className="block rounded-3xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-eco-50">
                {item.title}
              </a>
            ))}
          </nav>
          <div className="mt-auto pt-8 text-sm text-slate-500">
            Mock-администрирование Eco.Progress
          </div>
        </aside>
        <div className="flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="text-lg font-semibold text-eco-900">Админка</div>
              <button
                className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-600"
                onClick={() => setOpen((state) => !state)}
              >
                ☰
              </button>
            </div>
            {open && (
              <div className="border-t border-slate-200 bg-white px-6 py-4">
                {nav.map((item) => (
                  <a key={item.anchor} href={`#${item.anchor}`} className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    {item.title}
                  </a>
                ))}
              </div>
            )}
          </header>
          <div className="mx-auto max-w-7xl px-6 py-8 sm:px-8"> 
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">Админ панель</h1>
                <p className="mt-2 text-sm text-slate-600">Управление заявками, клиентами, услугами и новостями.</p>
              </div>
              <div className="flex items-center gap-3">
                <Link to="/">
                  <Button variant="secondary">На сайт</Button>
                </Link>
                <Link to="/login">
                  <Button>Выйти</Button>
                </Link>
              </div>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
