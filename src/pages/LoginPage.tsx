import { FormEvent, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BriefcaseBusiness, UserRound } from 'lucide-react';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';

const LoginPage = ({ staff = false, documentFlow = false, onSuccess }: { staff?: boolean; documentFlow?: boolean; onSuccess?: (message: string) => void }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, staffLogin } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const requestedRedirect = searchParams.get('redirect');
  const safeRedirect = requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//')
    ? requestedRedirect
    : null;

  const signIn = async (email: string, password: string, asStaff = staff) => {
    setLoading(true);
    setError('');
    try {
      if (asStaff) {
        await staffLogin(email, password);
        onSuccess?.(documentFlow ? 'Вход в документооборот выполнен' : 'Вход сотрудника выполнен');
        navigate(safeRedirect ?? '/staff');
      } else {
        await login(email, password);
        onSuccess?.('Вы вошли в кабинет клиента');
        navigate(safeRedirect ?? '/cabinet');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        || (err as Error)?.message
        || 'Ошибка входа. Проверьте email и пароль.';
      setError(msg);
      toast.error('Ошибка входа', msg);
    } finally {
      setLoading(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await signIn(String(form.get('email') || ''), String(form.get('password') || ''), staff);
  };

  const submitDocumentFlowStaff = async () => {
    if (!formRef.current) return;
    const form = new FormData(formRef.current);
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');
    if (!email || !password) {
      setError('Укажите email и пароль.');
      return;
    }
    await signIn(email, password, true);
  };

  return (
    <div className="grid min-h-screen bg-eco-50 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-windmill bg-cover bg-center" />
        <div className="absolute inset-0 bg-eco-900/78" />
        <div className="relative flex h-full items-end p-12 text-white">
          <div>
            <h1 className="text-5xl font-bold leading-tight">
              <span className="block">ecoprogress.kz</span>
            </h1>
            <p className="mt-4 max-w-md text-white/75">Онлайн-сервис экологического сопровождения: заявка, проверка, договор, ЭЦП и оплата в одном процессе.</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-12">
        <form ref={formRef} onSubmit={submit} className="w-full max-w-md rounded-[26px] bg-white p-7 shadow-xl shadow-eco-900/8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-eco-50 text-eco-700">
            {staff ? <BriefcaseBusiness size={24} /> : <UserRound size={24} />}
          </div>
          <h1 className="mt-5 text-3xl font-bold text-eco-900">{staff ? 'Вход сотрудника' : documentFlow ? 'Вход в документооборот' : 'Вход клиента'}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {staff ? 'Рабочий кабинет для обработки заявок, договоров, счетов и документов.' : documentFlow ? 'Используйте email и пароль владельца или участника организации.' : 'Войдите, чтобы создать заявку, загрузить документы и отслеживать статус работы.'}
          </p>
          {error && <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          <label className="mt-7 block text-sm font-semibold text-slate-700">
            Email
            <input name="email" type="email" required placeholder={staff ? 'email@ecoprogress.kz' : 'email@example.com'} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </label>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Пароль
            <input name="password" type="password" required placeholder="Введите пароль" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </label>
          <Button disabled={loading} className="mt-6 w-full">{loading ? 'Входим...' : documentFlow ? 'Войти как участник организации' : 'Войти'}</Button>
          {documentFlow && <Button type="button" variant="secondary" disabled={loading} onClick={submitDocumentFlowStaff} className="mt-3 w-full">Войти как сотрудник EcoProgress</Button>}
          <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            {!documentFlow && <Link to={staff ? '/login' : '/staff/login'} className="font-semibold text-eco-700">
              {staff ? 'Перейти во вход клиента' : 'Перейти во вход сотрудника'}
            </Link>}
            {!staff && !documentFlow && <Link to="/register" className="font-semibold text-eco-700">Зарегистрировать нового клиента</Link>}
            {documentFlow && <Link to="/document-flow/request" className="font-semibold text-eco-700">Нет доступа? Оставить заявку</Link>}
          </div>
          <Link to="/" className="mt-6 block text-center text-sm text-slate-500">Вернуться на сайт</Link>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
