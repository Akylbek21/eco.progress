import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Reveal from '../components/animations/Reveal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { fetcher } from '../services/api';
import { getServices } from '../services/serviceService';
import { getNews } from '../services/newsService';
import type { Employee, NewsItem, ServiceItem } from '../types';

type AdminBlockItem = {
  title: string;
  subtitle?: string;
  category?: string;
  description?: string;
};

const AdminPage = () => {
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: getServices });
  const { data: news = [] } = useQuery({ queryKey: ['news'], queryFn: getNews });
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      try {
        return await fetcher<Employee[]>('/employees');
      } catch {
        return [];
      }
    },
  });

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner /></div>;

  const blocks: Array<{ title: string; status: string; items: AdminBlockItem[] }> = [
    { title: 'Услуги', status: 'Просмотр. CRUD будет подключен после backend endpoint.', items: services.map((item) => ({ title: item.title, subtitle: item.description, category: item.category, description: item.result })) },
    { title: 'Новости', status: 'Просмотр. CRUD будет подключен после backend endpoint.', items: news.map((item) => ({ title: item.title, subtitle: item.excerpt, category: item.category, description: item.content.join('\n') })) },
    { title: 'Сотрудники публичного сайта', status: 'Просмотр публичной команды.', items: employees.map((item) => ({ title: item.name, subtitle: item.position, category: item.specialty, description: item.summary })) },
    { title: 'Тарифы', status: 'Просмотр публичных тарифов и сценариев.', items: [] },
    { title: 'Настройки сайта', status: 'Раздел в разработке.', items: ['Контакты', 'Главная страница', 'Публичное меню', 'Хранилище заявок'].map((title) => ({ title })) },
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
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">Read-only</span>
              </div>
              <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">{block.status}</p>
              <div className="mt-5 space-y-3">
                {block.items.map((item) => (
                  <div key={item.title} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      {item.subtitle && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.subtitle}</p>}
                    </div>
                    <span className="shrink-0 text-slate-400">Просмотр</span>
                  </div>
                ))}
                {!block.items.length && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Раздел в разработке. Управление будет доступно после подключения backend.</p>}
              </div>
            </section>
          </Reveal>
        ))}
      </div>
    </>
  );
};

export default AdminPage;
