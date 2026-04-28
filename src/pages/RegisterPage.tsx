import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { register } from '../services/authService';

const RegisterPage = ({ onSuccess }: { onSuccess?: (message: string) => void }) => {
  const [type, setType] = useState<'company' | 'individual' | null>(null);
  const navigate = useNavigate();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!type) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    const confirm = String(form.get('confirm') || '');
    if (password !== confirm) {
      onSuccess?.('Пароли не совпадают');
      return;
    }
    if (type === 'individual') {
      await register({ type, name: String(form.get('name')), phone: String(form.get('phone')), email: String(form.get('email')), city: String(form.get('city')), password });
    } else {
      await register({
        type,
        companyName: String(form.get('companyName')),
        bin: String(form.get('bin')),
        organizationType: String(form.get('organizationType')),
        legalAddress: String(form.get('legalAddress')),
        city: String(form.get('city')),
        contactPerson: String(form.get('contactPerson')),
        position: String(form.get('position')),
        phone: String(form.get('phone')),
        email: String(form.get('email')),
        password,
      });
    }
    onSuccess?.('Кабинет клиента создан. Теперь вы можете оставить заявку и отслеживать ее статус.');
    navigate('/cabinet');
  };

  const field = (name: string, label: string, type = 'text') => (
    <label className="block text-sm font-semibold text-slate-700">{label}<input name={name} type={type} required className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
  );

  return (
    <div className="min-h-screen bg-eco-50 px-5 py-12 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-bold text-eco-900">Регистрация клиента</h1>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {[
            ['company', 'Юридическое лицо / ИП', 'Для компаний, ТОО, ИП, предприятий и организаций.'],
            ['individual', 'Физическое лицо', 'Для частной консультации или разового обращения.'],
          ].map(([value, title, text]) => (
            <button key={value} onClick={() => setType(value as 'company' | 'individual')} className={`rounded-[22px] border p-6 text-left transition ${type === value ? 'border-eco-500 bg-white shadow-lg' : 'border-slate-200 bg-white/70 hover:bg-white'}`}>
              <h2 className="text-xl font-bold text-eco-900">{title}</h2>
              <p className="mt-2 text-slate-600">{text}</p>
            </button>
          ))}
        </div>
        {type && (
          <form onSubmit={submit} className="mt-8 rounded-[26px] bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              {type === 'individual' ? (
                <>
                  {field('name', 'ФИО')}
                  {field('phone', 'Телефон')}
                  {field('email', 'Email', 'email')}
                  {field('city', 'Город')}
                </>
              ) : (
                <>
                  {field('companyName', 'Название компании')}
                  {field('bin', 'БИН')}
                  <label className="block text-sm font-semibold text-slate-700">Тип организации<select name="organizationType" className="input-focus mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"><option>ТОО</option><option>ИП</option><option>АО</option><option>Другое</option></select></label>
                  {field('legalAddress', 'Юридический адрес')}
                  {field('city', 'Город')}
                  {field('contactPerson', 'Контактное лицо')}
                  {field('position', 'Должность контактного лица')}
                  {field('phone', 'Телефон')}
                  {field('email', 'Email', 'email')}
                </>
              )}
              {field('password', 'Пароль', 'password')}
              {field('confirm', 'Подтверждение пароля', 'password')}
            </div>
            <label className="mt-5 flex items-center gap-3 text-sm text-slate-600"><input type="checkbox" required /> Согласие на обработку данных</label>
            <Button className="mt-6">Создать кабинет</Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default RegisterPage;
