import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Award, BadgeCheck, UserRound } from 'lucide-react';
import SEO from '../components/SEO';
import { company } from '../config/company';
import { experts } from '../content/experts/experts';
import { buildBreadcrumbSchema, buildCorePageEntities, buildPersonSchema } from '../seo/entityBuilders';

const EmployeesPage = () => {
  const { pathname } = useLocation();
  const employeeView = pathname === '/employees';
  const canonical = `${company.siteUrl}/experts`;
  const publicName = company.brandName.toUpperCase();
  const description = `Подтверждённые специалисты ${publicName} и сведения об их обучении и профессиональных компетенциях.`;
  return <main className="bg-eco-50">
    <SEO title={employeeView ? `Сотрудники ${publicName}` : `Сотрудники и эксперты ${publicName}`} description={description} canonical={canonical} robots={employeeView ? 'noindex,follow' : 'index,follow'} schema={[
      ...buildCorePageEntities({ canonical, name: `Сотрудники и эксперты ${publicName}`, description }),
      ...experts.map((expert) => buildPersonSchema(expert, `${company.siteUrl}${expert.profileUrl}#person`)),
      buildBreadcrumbSchema([{ name: 'Главная', url: company.siteUrl }, { name: 'Эксперты', url: canonical }]),
    ]} />
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <h1 className="text-4xl font-bold text-eco-900 sm:text-5xl">{employeeView ? `Сотрудники ${publicName}` : `Сотрудники и эксперты ${publicName}`}</h1>
      <p className="mt-4 max-w-3xl text-slate-600">В реестр включены только опубликованные специалисты с подтверждёнными сведениями об обучении или компетенции.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {experts.map((expert) => {
          const initials = expert.fullName.split(' ').slice(0, 2).map((part) => part[0]).join('');
          const primaryCredential = expert.credentials[0];
          return <article key={expert.id} className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-eco-200 hover:shadow-xl hover:shadow-eco-900/5">
            <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-eco-50 via-[#eef8fb] to-eco-100" aria-label={`Место для фотографии: ${expert.fullName}`}>
              <div className="absolute inset-x-0 bottom-0 mx-auto h-[78%] w-[62%] rounded-t-[999px] bg-white/55" />
              <UserRound aria-hidden="true" strokeWidth={1.25} className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-[42%] text-eco-300 sm:h-32 sm:w-32" />
              <div aria-hidden="true" className="absolute left-5 top-5 flex h-12 w-12 items-center justify-center rounded-full border border-white/80 bg-white/90 text-base font-black text-eco-800 shadow-sm">{initials}</div>
              <span className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-eco-700 shadow-sm"><BadgeCheck size={15} /> Специалист</span>
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h2 className="text-xl font-bold leading-snug text-eco-900">{expert.fullName}</h2>
              <div className="mt-4 rounded-2xl bg-eco-50 px-4 py-3"><p className="text-xs font-bold uppercase tracking-[0.14em] text-eco-500">Специализация</p><p className="mt-2 text-sm leading-6 text-slate-700">{expert.specialization.join(' · ')}</p></div>
              {primaryCredential && <div className="mt-5 border-t border-slate-100 pt-5">
                <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Award size={18} /></span><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Подтверждённое обучение</p><p className="mt-2 text-sm font-semibold leading-6 text-eco-900">{primaryCredential.title}</p></div></div>
                <p className="mt-3 text-xs leading-5 text-slate-500">{primaryCredential.document}, {primaryCredential.issuedBy} · {primaryCredential.date}{primaryCredential.hours ? ` · ${primaryCredential.hours} часов` : ''}</p>
                {expert.credentials.length > 1 && <p className="mt-2 text-xs font-semibold text-eco-600">Ещё документов: {expert.credentials.length - 1}</p>}
              </div>}
              <Link to={expert.profileUrl} className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-bold text-eco-700 transition group-hover:text-eco-500">Открыть профиль <ArrowRight size={16} className="transition group-hover:translate-x-1" /></Link>
            </div>
          </article>;
        })}
      </div>
    </section>
  </main>;
};

export default EmployeesPage;
