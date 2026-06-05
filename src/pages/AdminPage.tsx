import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Reveal from '../components/animations/Reveal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { fetcher } from '../services/api';
import type { Employee, NewsItem, ServiceItem } from '../types';

type AdminBlockItem = {
  title: string;
  subtitle?: string;
  category?: string;
  description?: string;
};

const AdminPage = () => {
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: () => fetcher<ServiceItem[]>('/services') });
  const { data: news = [] } = useQuery({ queryKey: ['news'], queryFn: () => fetcher<NewsItem[]>('/news') });
  const { data: employees = [], isLoading } = useQuery({ queryKey: ['employees'], queryFn: () => fetcher<Employee[]>('/employees') });

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner /></div>;

  const blocks: Array<{ title: string; editable?: boolean; items: AdminBlockItem[] }> = [
    { title: 'Услуги', editable: true, items: services.map((item) => ({ title: item.title, subtitle: item.description, category: item.category, description: item.result })) },
    { title: 'Новости', editable: true, items: news.map((item) => ({ title: item.title, subtitle: item.excerpt, category: item.category, description: item.content.join('\n') })) },
    { title: 'Сотрудники', editable: true, items: employees.map((item) => ({ title: item.name, subtitle: item.position, category: item.specialty, description: item.summary })) },
    { title: 'Настройки', items: ['Контакты', 'Главная страница', 'Публичное меню', 'Хранилище заявок'].map((title) => ({ title })) },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-emerald-100 bg-emerald-50 p-5 text-sm leading-6 text-emerald-900">
        <p className="font-semibold">Создание клиентов и сотрудников доступно в разделе «Пользователи».</p>
        <Link to="/admin/users" className="rounded-full bg-eco-800 px-4 py-2 text-sm font-semibold text-white">Открыть пользователей</Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {blocks.map((block, index) => (
          <Reveal key={block.title} delay={index * 0.04}>
            <section id={block.title.toLowerCase()} className="rounded-[22px] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl font-bold capitalize text-eco-900">{block.title}</h2>
                {block.editable && (
                  <button
                    type="button"
                    disabled
                    title="CRUD админки ожидает backend endpoint"
                    className="cursor-not-allowed rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500"
                  >
                    Добавить
                  </button>
                )}
              </div>
              <div className="mt-5 space-y-3">
                {block.items.map((item) => (
                  <div key={item.title} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      {item.subtitle && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.subtitle}</p>}
                    </div>
                    {block.editable ? (
                      <button
                        type="button"
                        disabled
                        title="CRUD админки ожидает backend endpoint"
                        className="shrink-0 cursor-not-allowed font-semibold text-slate-400"
                      >
                        Read-only
                      </button>
                    ) : (
                      <span className="shrink-0 text-slate-400">Read-only</span>
                    )}
                  </div>
                ))}
                {!block.items.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Данных пока нет</p>}
              </div>
            </section>
          </Reveal>
        ))}
      </div>
    </>
  );
};

export default AdminPage;
