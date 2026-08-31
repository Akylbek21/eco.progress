import { Alert, Skeleton } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FlaskConical, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Button from '../../../components/ui/Button';
import { hasPermission } from '../../../config/permissions';
import { useAuth } from '../../../contexts/AuthContext';
import { getActiveCompanies, getCompanyObjects } from '../../../services/companyService';
import type { Protocol } from '../../../types/protocols';
import { wizardInputClass, wizardLabelClass } from './ProtocolWizardField';
import PekProtocolRequirementsStep from './steps/PekProtocolRequirementsStep';

const currentLocalDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function PekProtocolCreationFlow({
  open,
  onClose,
  onManual,
  onCreated,
  initialCompanyId = '',
  initialObjectId = '',
}: {
  open: boolean;
  onClose: () => void;
  onManual: () => void;
  onCreated: (protocol: Protocol) => void;
  initialCompanyId?: string;
  initialObjectId?: string;
}) {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [objectId, setObjectId] = useState(initialObjectId);
  const date = useMemo(currentLocalDate, []);
  const companiesQuery = useQuery({ queryKey: ['companies', 'protocol-pek-creation', user?.id], queryFn: ({ signal }) => getActiveCompanies(signal), enabled: open });
  const objectsQuery = useQuery({ queryKey: ['company-objects', user?.id, companyId], queryFn: ({ signal }) => getCompanyObjects(companyId, false, signal), enabled: open && Boolean(companyId) });
  const companies = companiesQuery.data ?? [];
  const objects = useMemo(
    () => (objectsQuery.data ?? []).filter((item) => item.status === 'ACTIVE' && !item.virtual && !item.isVirtual),
    [objectsQuery.data],
  );

  useEffect(() => {
    if (!open) return;
    setCompanyId(initialCompanyId);
    setObjectId(initialObjectId);
  }, [initialCompanyId, initialObjectId, open]);

  useEffect(() => {
    if (!companyId || !objectsQuery.isSuccess) return;
    if (objects.length === 1) {
      setObjectId(String(objects[0].id));
      return;
    }
    if (!objects.some((item) => String(item.id) === objectId)) setObjectId('');
  }, [companyId, objectId, objects, objectsQuery.isSuccess]);

  const selectedCompany = companies.find((item) => String(item.id) === companyId);
  const selectedObject = objects.find((item) => String(item.id) === objectId);
  const canOpenPek = hasPermission(user, 'view_pek') || hasPermission(user, 'edit_pek') || hasPermission(user, 'PEK_PROGRAM_VIEW');

  return <div data-testid="protocol-pek-create" className="min-h-full overflow-x-clip bg-slate-50">
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-8 lg:px-6">
      <header className="flex flex-col gap-4 py-5 sm:py-6 md:flex-row md:items-center md:justify-between">
        <div><button type="button" onClick={onClose} className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-eco-800"><ArrowLeft className="h-4 w-4" /> К протоколам</button><h1 className="text-2xl font-bold text-slate-950">Создать лабораторный протокол</h1><p className="mt-1 text-sm text-slate-500">Выберите компанию — необходимые исследования определит действующая программа ПЭК.</p></div>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={onManual}>Создать вручную</Button><button type="button" onClick={onClose} aria-label="Закрыть" className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"><X className="h-4 w-4" /> Закрыть</button></div>
      </header>

      <main className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-eco-100 text-eco-800"><FlaskConical className="h-5 w-5" /></span><div><h2 className="text-lg font-bold text-slate-950">Выбрать по ПЭК</h2><p className="text-sm text-slate-500">Основной режим: backend вернёт тип протокола, точки, показатели и нормативы.</p></div></div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className={wizardLabelClass}>Компания *<select autoFocus value={companyId} disabled={companiesQuery.isLoading} onChange={(event) => { setCompanyId(event.target.value); setObjectId(''); }} className={wizardInputClass}><option value="">{companiesQuery.isLoading ? 'Загрузка компаний…' : 'Выберите компанию'}</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
            {companyId && objectsQuery.isLoading && <div aria-label="Загрузка объектов"><Skeleton variant="text" width="35%" /><Skeleton variant="rounded" height={44} /></div>}
            {companyId && !objectsQuery.isLoading && objects.length > 1 && <label className={wizardLabelClass}>Объект *<select value={objectId} onChange={(event) => setObjectId(event.target.value)} className={wizardInputClass}><option value="">Выберите объект</option>{objects.map((object) => <option key={object.id} value={object.id}>{object.name}</option>)}</select></label>}
            {companyId && !objectsQuery.isLoading && objects.length === 1 && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm"><p className="text-xs font-bold uppercase text-emerald-700">Объект выбран автоматически</p><p className="mt-1 font-semibold text-emerald-950">{objects[0].name}</p></div>}
          </div>
          {companiesQuery.isError && <Alert className="mt-4" severity="error" action={<Button type="button" variant="secondary" onClick={() => void companiesQuery.refetch()}>Повторить</Button>}>Не удалось загрузить компании.</Alert>}
          {companyId && objectsQuery.isError && <Alert className="mt-4" severity="error" action={<Button type="button" variant="secondary" onClick={() => void objectsQuery.refetch()}>Повторить</Button>}>Не удалось загрузить объекты компании.</Alert>}
          {companyId && objectsQuery.isSuccess && objects.length === 0 && <Alert className="mt-4" severity="warning" action={<Button type="button" variant="secondary" onClick={onManual}>Создать вручную</Button>}>У компании нет активных объектов.</Alert>}
        </section>

        {companyId && objectId && <PekProtocolRequirementsStep key={`${companyId}:${objectId}`} companyId={companyId} objectId={objectId} date={date} companyName={selectedCompany?.name || ''} objectName={selectedObject?.name || ''} userId={user?.id} canOpenPek={canOpenPek} onManual={onManual} onCreated={onCreated} />}
      </main>
    </div>
  </div>;
}
