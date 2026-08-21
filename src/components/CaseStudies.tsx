import { Link } from 'react-router-dom';
import { RelatedCaseStudies } from './content/AeoContent';

const CaseStudies = () => <section id="cases" className="bg-white px-4 py-16 sm:px-8 sm:py-20">
  <div className="mx-auto max-w-7xl">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-eco-500">Кейсы</p>
    <h2 className="mt-3 text-3xl font-bold text-eco-900 sm:text-4xl">Подтверждённые проекты EcoProgress</h2>
    <p className="mt-4 max-w-3xl leading-7 text-slate-600">Публикуются только проекты с проверенными исходными данными, результатом, специалистом и reviewer. Черновики и неподтверждённые показатели посетителям не показываются.</p>
    <div className="mt-10"><RelatedCaseStudies /></div>
    <Link to="/cases" className="mt-8 inline-flex font-semibold text-eco-700 underline">Все подтверждённые кейсы</Link>
  </div>
</section>;

export default CaseStudies;
