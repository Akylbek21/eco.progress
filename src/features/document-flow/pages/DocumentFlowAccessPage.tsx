import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Ban, CreditCard, LogIn } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { documentFlowAccessApi, documentFlowPlansApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { AccessRequestDialog } from '../components/AccessRequestDialog';

const DocumentFlowAccessPage = ({ expired = false }: { expired?: boolean }) => {
  const { isAuthenticated } = useAuth();
  const [requestOpen, setRequestOpen] = useState(false);
  const accessQuery = useQuery({ queryKey: documentFlowKeys.access(), queryFn: documentFlowAccessApi.get, enabled: isAuthenticated, retry: false });
  const plansQuery = useQuery({ queryKey: documentFlowKeys.plans(), queryFn: documentFlowPlansApi.list, retry: false });
  const suspended = accessQuery.data?.status === 'SUSPENDED';
  const title = !isAuthenticated
    ? 'Войдите в личный кабинет'
    : suspended
      ? 'Доступ приостановлен'
      : expired
        ? 'Срок доступа истёк'
        : 'Документооборот не подключён';
  const description = !isAuthenticated
    ? 'Для работы с документооборотом используйте существующую учётную запись EcoProgress.'
    : accessQuery.data?.reason || (expired
      ? 'Backend ограничил доступ. Если разрешён режим просмотра, откройте кабинет повторно.'
      : 'Выберите тариф или отправьте заявку — доступ появится только после подтверждения backend.');

  return (
    <div className="grid min-h-[68vh] place-items-center bg-[#f6fafc] px-5 py-16">
      <div className="w-full max-w-2xl rounded-[30px] border border-eco-100 bg-white p-8 text-center shadow-sm sm:p-12">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-700">
          {suspended ? <Ban /> : expired ? <AlertTriangle /> : isAuthenticated ? <CreditCard /> : <LogIn />}
        </span>
        <h1 className="mt-6 text-3xl font-black text-eco-950">{title}</h1>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-600">{description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {!isAuthenticated ? (
            <>
              <Link to="/login?redirect=%2Fdocument-flow%2Fapp" className="rounded-full bg-eco-900 px-6 py-3 font-bold text-white">Войти</Link>
              <Link to="/register" className="rounded-full border border-eco-200 px-6 py-3 font-bold text-eco-900">Зарегистрироваться</Link>
            </>
          ) : (
            <>
              {!suspended && <button onClick={() => setRequestOpen(true)} className="rounded-full bg-eco-900 px-6 py-3 font-bold text-white">Оставить заявку</button>}
              <Link to="/document-flow/pricing" className="rounded-full border border-eco-200 px-6 py-3 font-bold text-eco-900">Посмотреть тарифы</Link>
              {accessQuery.data?.readOnly && <Link to="/document-flow/app/dashboard" className="rounded-full border border-eco-200 px-6 py-3 font-bold text-eco-900">Открыть просмотр</Link>}
            </>
          )}
        </div>
      </div>
      <AccessRequestDialog open={requestOpen} plans={plansQuery.data || []} onClose={() => setRequestOpen(false)} />
    </div>
  );
};

export default DocumentFlowAccessPage;

