import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, FlaskConical, ShieldCheck, UserPlus, Users } from 'lucide-react';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import {
  createAdminUser,
  getAdminUsers,
  type AdminUserRecord,
  type CreateAdminUserPayload,
} from '../services/adminUserService';

type UserKind = 'client' | 'staff';
type ClientTypeOption = 'individual' | 'company';

const staffRoles = [
  { value: 'MANAGER', label: 'Менеджер' },
  { value: 'ACCOUNTANT', label: 'Бухгалтер' },
  { value: 'ECOLOGIST', label: 'Эколог' },
  { value: 'LABORATORY', label: 'Лаборатория' },
  { value: 'ADMIN', label: 'Администратор' },
] as const;

const roleLabels: Record<string, string> = {
  CLIENT: 'Клиент',
  MANAGER: 'Менеджер',
  ADMIN: 'Администратор',
  ACCOUNTANT: 'Бухгалтер',
  ECOLOGIST: 'Эколог',
  LABORATORY: 'Лаборатория',
};

const inputClass = 'input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900';
const labelClass = 'block text-sm font-semibold text-slate-700';

const Field = ({
  name,
  label,
  type = 'text',
  required = false,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) => (
  <label className={labelClass}>
    {label}
    <input
      name={name}
      type={type}
      required={required}
      placeholder={placeholder}
      defaultValue={defaultValue}
      className={inputClass}
    />
  </label>
);

const UserCard = ({ user }: { user: AdminUserRecord }) => (
  <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-bold text-slate-900">{user.name}</p>
        <p className="mt-1 truncate text-sm text-slate-600">{user.email}</p>
        {user.position && <p className="mt-1 text-xs text-slate-500">{user.position}</p>}
        {user.companyName && <p className="mt-1 text-xs text-slate-500">{user.companyName}</p>}
      </div>
      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800">
        {roleLabels[user.role] || user.role}
      </span>
    </div>
    <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
      <p>Тип: <span className="font-semibold text-slate-700">{user.type}</span></p>
      <p>Статус: <span className="font-semibold text-slate-700">{user.status}</span></p>
      <p>Последний вход: <span className="font-semibold text-slate-700">{user.lastLoginAt || 'ещё не входил'}</span></p>
      <p>Создан: <span className="font-semibold text-slate-700">{user.createdAt || '—'}</span></p>
    </div>
  </article>
);

const AdminUsersPage = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<UserKind>('client');
  const [clientType, setClientType] = useState<ClientTypeOption>('company');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAdminUsers,
  });

  const createMutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Готово', 'Пользователь успешно создан');
    },
    onError: (error: Error) => {
      toast.error('Ошибка', error.message || 'Не удалось создать пользователя');
    },
  });

  const stats = useMemo(() => ({
    total: users.length,
    clients: users.filter((user) => user.role === 'CLIENT').length,
    staff: users.filter((user) => user.role !== 'CLIENT').length,
  }), [users]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    const confirm = String(form.get('confirm') || '');
    if (password !== confirm) {
      toast.error('Ошибка', 'Пароли не совпадают');
      return;
    }

    const payload: CreateAdminUserPayload = {
      email: String(form.get('email') || '').trim(),
      name: String(form.get('name') || '').trim(),
      password,
      phone: String(form.get('phone') || '').trim() || undefined,
      city: String(form.get('city') || '').trim() || undefined,
      legalAddress: String(form.get('legalAddress') || '').trim() || undefined,
      position: String(form.get('position') || '').trim() || undefined,
      role: kind === 'client' ? 'CLIENT' : String(form.get('role') || 'MANAGER'),
      type: kind === 'client' ? clientType : undefined,
      companyName: String(form.get('companyName') || '').trim() || undefined,
      bin: String(form.get('bin') || '').trim() || undefined,
      organizationType: String(form.get('organizationType') || '').trim() || undefined,
    };

    await createMutation.mutateAsync(payload);
    event.currentTarget.reset();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] bg-gradient-to-r from-eco-900 via-eco-800 to-emerald-700 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-emerald-100">Администрирование</p>
            <h2 className="mt-1 text-3xl font-bold">Пользователи системы</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">
              Создавайте клиентов и сотрудников с полным набором полей users. Пароль сохраняется в bcrypt, последний вход фиксируется при login.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-center backdrop-blur">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-emerald-100">Всего</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-center backdrop-blur">
              <p className="text-2xl font-bold">{stats.clients}</p>
              <p className="text-xs text-emerald-100">Клиенты</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-center backdrop-blur">
              <p className="text-2xl font-bold">{stats.staff}</p>
              <p className="text-xs text-emerald-100">Сотрудники</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-[22px] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-eco-50 p-3 text-eco-800"><UserPlus size={20} /></span>
            <div>
              <h3 className="text-xl font-bold text-eco-900">Создать пользователя</h3>
              <p className="text-sm text-slate-500">Выберите тип аккаунта и заполните обязательные поля</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {([
              ['client', 'Клиент', Building2],
              ['staff', 'Сотрудник', ShieldCheck],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={`rounded-2xl border p-4 text-left transition ${
                  kind === value
                    ? 'border-eco-500 bg-eco-50 shadow-sm'
                    : 'border-slate-200 bg-slate-50 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className="text-eco-800" />
                  <span className="font-semibold text-slate-900">{label}</span>
                </div>
              </button>
            ))}
          </div>

          {kind === 'client' && (
            <div className="mt-4 flex flex-wrap gap-2">
              {(['company', 'individual'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setClientType(value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    clientType === value ? 'bg-eco-800 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {value === 'company' ? 'Юр. лицо / ИП' : 'Физ. лицо'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field name="name" label={kind === 'client' && clientType === 'company' ? 'Контактное лицо' : 'ФИО'} required />
              <Field name="email" label="Email" type="email" required />
              <Field name="phone" label="Телефон" />
              <Field name="city" label="Город" />

              {kind === 'staff' && (
                <>
                  <label className={labelClass}>
                    Роль
                    <select name="role" defaultValue="MANAGER" className={inputClass} required>
                      {staffRoles.map((role) => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                  </label>
                  <Field name="position" label="Должность" required />
                </>
              )}

              {kind === 'client' && clientType === 'company' && (
                <>
                  <Field name="companyName" label="Название компании" required />
                  <Field name="bin" label="БИН" required />
                  <label className={labelClass}>
                    Тип организации
                    <select name="organizationType" defaultValue="ТОО" className={inputClass}>
                      <option>ТОО</option>
                      <option>ИП</option>
                      <option>АО</option>
                      <option>Другое</option>
                    </select>
                  </label>
                  <Field name="legalAddress" label="Юридический адрес" />
                </>
              )}

              <Field name="password" label="Пароль" type="password" required />
              <Field name="confirm" label="Подтверждение пароля" type="password" required />
            </div>

            <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
              {createMutation.isPending ? 'Создание...' : 'Создать пользователя'}
            </Button>
          </form>
        </section>

        <section className="rounded-[22px] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-slate-100 p-3 text-slate-700"><Users size={20} /></span>
            <div>
              <h3 className="text-xl font-bold text-eco-900">Список пользователей</h3>
              <p className="text-sm text-slate-500">Актуальные аккаунты и время последнего входа</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {users.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                Пользователей пока нет. Создайте первого аккаунт через форму слева.
              </div>
            ) : (
              users.map((user) => <UserCard key={user.id} user={user} />)
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <FlaskConical size={18} className="mt-0.5 shrink-0" />
              <p>
                Поле <strong>last_login_at</strong> обновляется при каждом успешном входе через
                {' '}/api/auth/login или /api/auth/staff/login.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminUsersPage;
