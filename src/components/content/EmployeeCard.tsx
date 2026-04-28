import { type Employee } from '../../data/mockData';
import StatusBadge from '../ui/StatusBadge';

const EmployeeCard = ({ employee }: { employee: Employee }) => {
  return (
    <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-2xl">
      <div className="mb-5 flex items-center gap-4">
        <img src={employee.avatar} alt={employee.name} className="h-20 w-20 rounded-3xl object-cover" />
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{employee.name}</h3>
          <p className="text-sm text-eco-700">{employee.position}</p>
          <p className="mt-2 text-sm text-slate-500">Опыт: {employee.experience}</p>
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">{employee.summary}</p>
        <StatusBadge status={employee.specialty} />
      </div>
    </article>
  );
};

export default EmployeeCard;
