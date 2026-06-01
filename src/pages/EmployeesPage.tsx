import { useQuery } from '@tanstack/react-query';
import Reveal from '../components/animations/Reveal';
import SEO from '../components/SEO';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { fetcher } from '../services/api';
import type { Employee } from '../types';

const fallbackEmployees: Employee[] = [
  {
    id: 'employee-ecologist',
    name: 'Эколог ECOPROGRESS',
    position: 'Ведущий эколог',
    experience: '8 лет опыта',
    specialty: 'Экологическая документация',
    summary: 'Сопровождает проекты, разрешения, отчеты и коммуникацию с клиентами по экологическим вопросам.',
    avatar: '/jose.jpg',
  },
  {
    id: 'employee-laboratory',
    name: 'Лаборатория ECOPROGRESS',
    position: 'Лабораторный специалист',
    experience: '6 лет опыта',
    specialty: 'Замеры и протоколы',
    summary: 'Организует отбор проб, лабораторные исследования, протоколы и публикацию результатов.',
    avatar: '/edward.jpg',
  },
  {
    id: 'employee-waste',
    name: 'Специалист по отходам',
    position: 'Координатор вывоза',
    experience: '5 лет опыта',
    specialty: 'Вывоз и утилизация',
    summary: 'Подбирает маршрут, транспорт и документы для вывоза, размещения и утилизации отходов.',
    avatar: '/cottonbro.jpg',
  },
  {
    id: 'employee-manager',
    name: 'Менеджер проекта',
    position: 'Клиентский менеджер',
    experience: '7 лет опыта',
    specialty: 'Сопровождение заявок',
    summary: 'Ведет заявку от консультации до результата, согласует сроки, документы, договоры и оплаты.',
    avatar: '/pexels-jan-van.jpg',
  },
];

const EmployeesPage = () => {
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      try {
        const employees = await fetcher<Employee[]>('/employees');
        if (Array.isArray(employees) && employees.length) return employees;
      } catch {
        if (!import.meta.env.DEV) throw new Error('Не удалось загрузить сотрудников');
      }
      return import.meta.env.DEV ? fallbackEmployees : [];
    },
  });

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner /></div>;

  return (
    <div className="bg-eco-50">
      <SEO title="Сотрудники | ecoprogress.kz" description="Команда ecoprogress.kz сопровождает экологические документы, проверки, отходы, лабораторные исследования и заявки клиентов." />
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <Reveal><h1 className="text-4xl font-bold text-eco-900 sm:text-5xl">Сотрудники</h1></Reveal>
        <p className="mt-4 max-w-2xl text-slate-600">Команда, которая сопровождает заявки, документы, проверки и консультации.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {employees.map((employee, index) => (
            <Reveal key={employee.id} delay={index * 0.05}>
              <div className="card-hover h-full overflow-hidden rounded-[22px] bg-white shadow-sm">
                <img src={employee.avatar} alt="" className="h-40 w-full object-cover" />
                <div className="p-5">
                  <h2 className="text-lg font-bold text-eco-900">{employee.name}</h2>
                  <p className="mt-1 text-sm font-semibold text-eco-500">{employee.position}</p>
                  <p className="mt-3 text-sm text-slate-600">{employee.summary}</p>
                  <p className="mt-4 text-xs text-slate-500">{employee.experience} · {employee.specialty}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
};

export default EmployeesPage;
