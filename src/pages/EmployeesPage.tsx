import { Link, useLocation } from 'react-router-dom';
import SEO from '../components/SEO';
import { company } from '../config/company';
import { experts } from '../content/experts/experts';
import { buildBreadcrumbSchema, buildCorePageEntities, buildPersonSchema } from '../seo/entityBuilders';

const EmployeesPage = () => {
  const { pathname } = useLocation();
  const employeeView = pathname === '/employees';
  const canonical = `${company.siteUrl}/experts`;
  const description = 'Подтверждённые специалисты ECOPROGRESS и сведения об их обучении и профессиональных компетенциях.';
  return <main className="bg-eco-50">
    <SEO title={employeeView ? 'Сотрудники ECOPROGRESS' : 'Сотрудники и эксперты ECOPROGRESS'} description={description} canonical={canonical} robots={employeeView ? 'noindex,follow' : 'index,follow'} schema={[
      ...buildCorePageEntities({ canonical, name: 'Сотрудники и эксперты ECOPROGRESS', description }),
      ...experts.map((expert) => buildPersonSchema(expert, `${company.siteUrl}${expert.profileUrl}#person`)),
      buildBreadcrumbSchema([{ name: 'Главная', url: company.siteUrl }, { name: 'Эксперты', url: canonical }]),
    ]} />
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <h1 className="text-4xl font-bold text-eco-900 sm:text-5xl">{employeeView ? 'Сотрудники ECOPROGRESS' : 'Сотрудники и эксперты ECOPROGRESS'}</h1>
      <p className="mt-4 max-w-3xl text-slate-600">В реестр включены только опубликованные специалисты с подтверждёнными сведениями об обучении или компетенции.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {experts.map((expert) => <article key={expert.id} className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm">
          <div aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-eco-100 text-xl font-bold text-eco-800">{expert.fullName.split(' ').slice(0, 2).map((part) => part[0]).join('')}</div>
          <h2 className="mt-5 text-xl font-bold text-eco-900">{expert.fullName}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{expert.specialization.join(' · ')}</p>
          <div className="mt-5 space-y-4">{expert.credentials.map((item) => <div key={`${item.title}-${item.number ?? item.date}`} className="border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">
            <p className="font-semibold text-eco-900">{item.title}</p>
            <p className="mt-1">{item.document}, {item.issuedBy}</p>
            <p>{item.date}{item.location ? `, ${item.location}` : ''}{item.hours ? ` · ${item.hours} часов` : ''}{item.number ? ` · № ${item.number}` : ''}</p>
          </div>)}</div>
          <Link to={expert.profileUrl} className="mt-5 inline-flex font-semibold text-eco-700 underline">Профиль эксперта →</Link>
        </article>)}
      </div>
    </section>
  </main>;
};

export default EmployeesPage;
