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

const addedEmployees: Employee[] = [
  {
    id: 'employee-kozhak-erasyl',
    name: 'Қожақ Ерасыл Аманұлы',
    position: 'Специалист ECOPROGRESS',
    experience: 'Команда ECOPROGRESS',
    specialty: 'Сопровождение проектов',
    summary: 'Участвует в сопровождении заявок, подготовке материалов и коммуникации по экологическим услугам.',
    avatar: '/jose.jpg',
  },
  {
    id: 'employee-kurban-symbat',
    name: 'Қурбан Сымбат Нұржанқыз',
    position: 'Специалист ECOPROGRESS',
    experience: 'Команда ECOPROGRESS',
    specialty: 'Документы и заявки',
    summary: 'Помогает вести клиентские заявки, документы и внутреннюю координацию рабочих этапов.',
    avatar: '/edward.jpg',
  },
  {
    id: 'employee-duysenbay-ruslan',
    name: 'Дуйсенбай Руслан Серікбайұлы',
    position: 'Специалист ECOPROGRESS',
    experience: 'Команда ECOPROGRESS',
    specialty: 'Экологическое сопровождение',
    summary: 'Сопровождает задачи по экологическим услугам, проверке данных и подготовке результата для клиента.',
    avatar: '/cottonbro.jpg',
  },
  {
    id: 'employee-omirbayeva-aygerim',
    name: 'Өмірбаева Айгерім Қазыбекқызы',
    position: 'Специалист ECOPROGRESS',
    experience: 'Команда ECOPROGRESS',
    specialty: 'Лабораторные направления',
    summary: 'Участвует в сопровождении лабораторных задач, протоколов, замеров и клиентских материалов.',
    avatar: '/pexels-jan-van.jpg',
  },
  {
    id: 'employee-ibrayeva-araylym',
    name: 'Ибраева Арайлым Қуанышқызы',
    position: 'Специалист ECOPROGRESS',
    experience: 'Команда ECOPROGRESS',
    specialty: 'Клиентское сопровождение',
    summary: 'Помогает клиентам проходить этапы заявки, согласовывать данные и получать готовые документы.',
    avatar: '/para.jpg',
  },
  {
    id: 'employee-baktybay-kuralay',
    name: 'Бақтыбай Құралай Нұрланқызы',
    position: 'Специалист ECOPROGRESS',
    experience: 'Команда ECOPROGRESS',
    specialty: 'Экологическая документация',
    summary: 'Работает с экологическими материалами, исходными данными и подготовкой документов по заявкам.',
    avatar: '/images (1).jpg',
  },
  {
    id: 'employee-ortay-saniya',
    name: 'Ортай Сәния Бейбиталықызы',
    position: 'Специалист ECOPROGRESS',
    experience: 'Команда ECOPROGRESS',
    specialty: 'Проектная координация',
    summary: 'Координирует рабочие этапы, помогает поддерживать сроки и порядок в проектных материалах.',
    avatar: '/pexels-enginakyurt.jpg',
  },
  {
    id: 'employee-akhatay-zhuldyz',
    name: 'Ахатай Жұлдыз Қуанышқызы',
    position: 'Специалист ECOPROGRESS',
    experience: 'Команда ECOPROGRESS',
    specialty: 'Документальное сопровождение',
    summary: 'Сопровождает документы, статусы заявок и передачу готовых материалов клиентам.',
    avatar: '/utilizacija-othodov-3.jpg',
  },
];

const addEmployeesToList = (employees: Employee[]) => {
  const existingNames = new Set(employees.map((employee) => employee.name.toLocaleLowerCase('ru')));
  const missingEmployees = addedEmployees.filter((employee) => !existingNames.has(employee.name.toLocaleLowerCase('ru')));

  return [...employees, ...missingEmployees];
};

const EmployeesPage = () => {
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      try {
        const employees = await fetcher<Employee[]>('/employees');
        if (Array.isArray(employees) && employees.length) return addEmployeesToList(employees);
      } catch {
        return addEmployeesToList(fallbackEmployees);
      }
      return addEmployeesToList(fallbackEmployees);
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
