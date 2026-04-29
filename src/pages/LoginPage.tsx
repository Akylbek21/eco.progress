import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, UserRound } from 'lucide-react';
import Button from '../components/ui/Button';
import { login, staffLogin } from '../services/authService';

const LoginPage = ({ staff = false, onSuccess }: { staff?: boolean; onSuccess?: (message: string) => void }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    if (staff) {
      await staffLogin(String(form.get('email') || 'manager@ecoprogress.kz'), String(form.get('password') || ''));
      onSuccess?.('Вход сотрудника выполнен');
      navigate('/staff');
    } else {
      await login(String(form.get('email') || 'client@ecoprogress.kz'), String(form.get('password') || ''));
      onSuccess?.('Вы вошли в кабинет клиента');
      navigate('/cabinet');
    }
  };

  return (
    <div className="grid min-h-screen bg-eco-50 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-windmill bg-cover bg-center" />
        <div className="absolute inset-0 bg-eco-900/78" />
        <div className="relative flex h-full items-end p-12 text-white">
          <div>
            <h1 className="text-5xl font-bold leading-tight">
              <span className="block">ECOPROGRESS</span>
              <span className="block text-2xl tracking-[0.24em] text-eco-200">GROUP</span>
            </h1>
            <p className="mt-4 max-w-md text-white/75">Онлайн-сервис экологического сопровождения: заявка, проверка, договор, ЭЦП и оплата в одном процессе.</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-12">
        <form onSubmit={submit} className="w-full max-w-md rounded-[26px] bg-white p-7 shadow-xl shadow-eco-900/8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-eco-50 text-eco-700">
            {staff ? <BriefcaseBusiness size={24} /> : <UserRound size={24} />}
          </div>
          <h1 className="mt-5 text-3xl font-bold text-eco-900">{staff ? 'Вход сотрудника' : 'Вход клиента'}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {staff ? 'Демо-доступ для менеджера: проверьте заявку, отправьте договор и выставьте счет.' : 'Демо-доступ для клиента: создайте заявку и дождитесь договора со счетом.'}
          </p>
          <label className="mt-7 block text-sm font-semibold text-slate-700">
            Email
            <input name="email" type="email" required defaultValue={staff ? 'manager@ecoprogress.kz' : 'client@ecoprogress.kz'} className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </label>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Пароль
            <input name="password" type="password" required defaultValue="demo123" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" />
          </label>
          <Button disabled={loading} className="mt-6 w-full">{loading ? 'Входим...' : 'Войти'}</Button>
          <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <Link to={staff ? '/login' : '/staff/login'} className="font-semibold text-eco-700">
              {staff ? 'Перейти во вход клиента' : 'Перейти во вход сотрудника'}
            </Link>
            {!staff && <Link to="/register" className="font-semibold text-eco-700">Зарегистрировать нового клиента</Link>}
          </div>
          <Link to="/" className="mt-6 block text-center text-sm text-slate-500">Вернуться на сайт</Link>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
