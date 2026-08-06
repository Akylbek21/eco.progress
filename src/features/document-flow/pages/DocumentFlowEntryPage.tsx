import { ArrowRight, FileSignature } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';

export default function DocumentFlowEntryPage() {
  const { logout } = useAuth();
  return (
    <div className="mx-auto max-w-4xl">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-eco-900 via-eco-800 to-eco-700 px-6 py-10 text-white sm:px-10 sm:py-14">
          <span className="inline-flex rounded-2xl bg-white/10 p-3 ring-1 ring-white/20">
            <FileSignature className="h-7 w-7" />
          </span>
          <h1 className="mt-6 text-3xl font-black sm:text-4xl">Документооборот</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-white/75">
            Создание, согласование, подписание и хранение документов организации.
          </p>
        </div>
        <div className="space-y-6 px-6 py-8 sm:px-10">
          <div>
            <h2 className="text-xl font-black text-slate-950">Вход в рабочее пространство</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Система проверит вашу организацию, участие и действующую подписку. Доступ откроется только после подтверждения сервером.
            </p>
          </div>
          <Link
            to="/document-flow/login?redirect=%2Fdocument-flow"
            onClick={logout}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-eco-800 px-6 py-3 font-bold text-white shadow-lg shadow-eco-900/15 transition hover:bg-eco-900"
          >
            Войти под аккаунтом организации
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
