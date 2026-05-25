import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Reveal from '../components/animations/Reveal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { AdminEntityModal, type AdminEntityType, type AdminEntityValues } from '../components/modals';
import { fetcher } from '../services/api';
import { useToast } from '../hooks/useToast';
import type { Employee, NewsItem, ServiceItem } from '../types';

const AdminPage = () => {
  const toast = useToast();
  const [entityModal, setEntityModal] = useState<{
    entityType: AdminEntityType;
    mode: 'create' | 'edit';
    initialValues?: Partial<AdminEntityValues>;
  } | null>(null);
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: () => fetcher<ServiceItem[]>('/services') });
  const { data: news = [] } = useQuery({ queryKey: ['news'], queryFn: () => fetcher<NewsItem[]>('/news') });
  const { data: employees = [], isLoading } = useQuery({ queryKey: ['employees'], queryFn: () => fetcher<Employee[]>('/employees') });

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner /></div>;

  const blocks: Array<{ title: string; entityType?: AdminEntityType; items: Array<Partial<AdminEntityValues> & { title: string }> }> = [
    { title: 'услуги', entityType: 'service', items: services.map((item) => ({ title: item.title, subtitle: item.description, category: item.category, description: item.result })) },
    { title: 'новости', entityType: 'news', items: news.map((item) => ({ title: item.title, subtitle: item.excerpt, category: item.category, description: item.content.join('\n') })) },
    { title: 'сотрудники', entityType: 'employee', items: employees.map((item) => ({ title: item.name, subtitle: item.position, category: item.specialty, description: item.summary })) },
    { title: 'настройки', items: ['Контакты', 'Главная страница', 'Публичное меню', 'Хранилище заявок'].map((title) => ({ title })) },
  ];

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
      {blocks.map((block, index) => (
        <Reveal key={block.title} delay={index * 0.04}>
          <section id={block.title} className="rounded-[22px] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold capitalize text-eco-900">{block.title}</h2>
              {block.entityType && (
                <button
                  type="button"
                  className="rounded-full bg-eco-800 px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => setEntityModal({ entityType: block.entityType!, mode: 'create' })}
                >
                  Добавить
                </button>
              )}
            </div>
            <div className="mt-5 space-y-3">
              {block.items.map((item) => (
                <div key={item.title} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 text-sm">
                  <span>{item.title}</span>
                  {block.entityType ? (
                    <button
                      type="button"
                      className="font-semibold text-eco-700"
                      onClick={() => setEntityModal({ entityType: block.entityType!, mode: 'edit', initialValues: item })}
                    >
                      Редактировать
                    </button>
                  ) : (
                    <span className="text-slate-400">Настроить</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      ))}
      </div>
      {entityModal && (
        <AdminEntityModal
          isOpen
          entityType={entityModal.entityType}
          mode={entityModal.mode}
          initialValues={entityModal.initialValues}
          onClose={() => setEntityModal(null)}
          onSubmit={async () => {
            toast.success(
              entityModal.mode === 'create'
                ? entityModal.entityType === 'service'
                  ? 'Услуга добавлена'
                  : entityModal.entityType === 'employee'
                    ? 'Сотрудник добавлен'
                    : 'Запись добавлена'
                : entityModal.entityType === 'service'
                  ? 'Услуга обновлена'
                  : entityModal.entityType === 'employee'
                    ? 'Сотрудник обновлен'
                    : 'Запись обновлена',
              entityModal.mode === 'create' ? 'Изменение появится после сохранения данных.' : 'Изменения сохранены.',
            );
            setEntityModal(null);
          }}
        />
      )}
    </>
  );
};

export default AdminPage;
