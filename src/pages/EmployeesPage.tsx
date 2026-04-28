import SectionTitle from '../components/ui/SectionTitle';
import EmployeeCard from '../components/content/EmployeeCard';
import { employees } from '../data/mockData';

const EmployeesPage = () => {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:py-14">
      <SectionTitle title="Сотрудники" subtitle="Команда Eco.Progress" />
      <p className="max-w-3xl text-slate-600">Наши эксперты обладают опытом экологической отчетности, аудита, документации и сопровождения проверок.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {employees.map((employee) => (
          <EmployeeCard key={employee.id} employee={employee} />
        ))}
      </div>
    </div>
  );
};

export default EmployeesPage;
