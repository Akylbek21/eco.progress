import { FormEvent, type ReactNode, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, ShieldCheck, UserPlus, Users, UserX, UserCheck } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import {
  createAdminUser,
  getAdminUsers,
  updateAdminUser,
  updateAdminUserStatus,
  type AdminUserRecord,
  type CreateAdminUserPayload,
  type UpdateAdminUserPayload,
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

const statusLabels: Record<string, string> = {
  active: 'Активен',
  blocked: 'Деактивирован',
  invited: 'Приглашён',
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
  value,
  onChange,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}) => (
  <label className={labelClass}>
    {label}
    <input
      name={name}
      type={type}
      required={required}
      placeholder={placeholder}
      defaultValue={defaultValue}
      value={value}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      className={inputClass}
    />
  </label>
);

const toUserKind = (user: AdminUserRecord): UserKind => (user.role === 'CLIENT' ? 'client' : 'staff');
const toClientType = (user: AdminUserRecord): ClientTypeOption =>
  user.type === 'individual' ? 'individual' : 'company';

const AdminUsersPage = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<UserKind>('client');
  const [clientType, setClientType] = useState<ClientTypeOption>('company');
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
  const [editKind, setEditKind] = useState<UserKind>('client');
  const [editClientType, setEditClientType] = useState<ClientTypeOption>('company');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAdminUsers,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  const createMutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => {
      invalidate();
      toast.success('Готово', 'Пользователь успешно создан');
    },
    onError: (error: Error) => toast.error('Ошибка', error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateAdminUserPayload }) => updateAdminUser(id, payload),
    onSuccess: () => {
      invalidate();
      setEditingUser(null);
      toast.success('Готово', 'Пользователь обновлён');
    },
    onError: (error: Error) => toast.error('Ошибка', error.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'active' | 'blocked' }) => updateAdminUserStatus(id, status),
    onSuccess: (_, variables) => {
      invalidate();
      toast.success('Готово', variables.status === 'active' ? 'Пользователь активирован' : 'Пользователь деактивирован');
    },
    onError: (error: Error) => toast.error('Ошибка', error.message),
  });

  const stats = useMemo(() => ({
    total: users.length,
    clients: users.filter((user) => user.role === 'CLIENT').length,
    staff: users.filter((user) => user.role !== 'CLIENT').length,
    active: users.filter((user) => user.status === 'active').length,
  }), [users]);

  const openEdit = (user: AdminUserRecord) => {
    setEditingUser(user);
    setEditKind(toUserKind(user));
    setEditClientType(toClientType(user));
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
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

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    const confirm = String(form.get('confirm') || '');
    if ((password || confirm) && password !== confirm) {
      toast.error('Ошибка', 'Пароли не совпадают');
      return;
    }

    const payload: UpdateAdminUserPayload = {
      email: String(form.get('email') || '').trim(),
      name: String(form.get('name') || '').trim(),
      phone: String(form.get('phone') || '').trim() || undefined,
      city: String(form.get('city') || '').trim() || undefined,
      legalAddress: String(form.get('legalAddress') || '').trim() || undefined,
      position: String(form.get('position') || '').trim() || undefined,
      role: editKind === 'client' ? 'CLIENT' : String(form.get('role') || editingUser.role),
      type: editKind === 'client' ? editClientType : undefined,
      companyName: String(form.get('companyName') || '').trim() || undefined,
      bin: String(form.get('bin') || '').trim() || undefined,
      organizationType: String(form.get('organizationType') || '').trim() || undefined,
    };
    if (password) payload.password = password;

    await updateMutation.mutateAsync({ id: editingUser.id, payload });
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
              Создание, редактирование и активация/деактивация аккаунтов. Деактивированные пользователи не могут войти в систему.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard value={stats.total} label="Всего" />
            <StatCard value={stats.active} label="Активные" />
            <StatCard value={stats.clients} label="Клиенты" />
            <StatCard value={stats.staff} label="Сотрудники" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-[22px] bg-white p-6 shadow-sm">
          <SectionHeader icon={<UserPlus size={20} />} title="Создать пользователя" subtitle="Новый клиент или сотрудник" />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <KindButton active={kind === 'client'} label="Клиент" icon={<Building2 size={18} />} onClick={() => setKind('client')} />
            <KindButton active={kind === 'staff'} label="Сотрудник" icon={<ShieldCheck size={18} />} onClick={() => setKind('staff')} />
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

          <form onSubmit={submitCreate} className="mt-6 space-y-4">
            <UserFormFields kind={kind} clientType={clientType} requirePassword />
            <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
              {createMutation.isPending ? 'Создание...' : 'Создать пользователя'}
            </Button>
          </form>
        </section>

        <section className="rounded-[22px] bg-white p-6 shadow-sm">
          <SectionHeader icon={<Users size={20} />} title="Список пользователей" subtitle="Редактирование и управление доступом" />

          <div className="mt-5 space-y-3">
            {users.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                Пользователей пока нет. Создайте первый аккаунт через форму слева.
              </div>
            ) : (
              users.map((user) => (
                <article key={user.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">{user.name}</p>
                      <p className="mt-1 truncate text-sm text-slate-600">{user.email}</p>
                      {user.position && <p className="mt-1 text-xs text-slate-500">{user.position}</p>}
                      {user.companyName && <p className="mt-1 text-xs text-slate-500">{user.companyName}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-eco-800">
                        {roleLabels[user.role] || user.role}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                        user.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {statusLabels[user.status] || user.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                    <p>Тип: <span className="font-semibold text-slate-700">{user.type}</span></p>
                    <p>Последний вход: <span className="font-semibold text-slate-700">{user.lastLoginAt || 'ещё не входил'}</span></p>
                    <p className="sm:col-span-2">Создан: <span className="font-semibold text-slate-700">{user.createdAt || '—'}</span></p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-100"
                    >
                      <Pencil size={14} /> Редактировать
                    </button>
                    {user.status === 'active' ? (
                      <button
                        type="button"
                        onClick={() => statusMutation.mutate({ id: user.id, status: 'blocked' })}
                        disabled={statusMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        <UserX size={14} /> Деактивировать
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => statusMutation.mutate({ id: user.id, status: 'active' })}
                        disabled={statusMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        <UserCheck size={14} /> Активировать
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Редактировать пользователя"
        description={editingUser ? editingUser.email : undefined}
        size="lg"
        footer={(
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setEditingUser(null)}>Отмена</Button>
            <Button type="submit" form="edit-user-form" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        )}
      >
        {editingUser && (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <KindButton active={editKind === 'client'} label="Клиент" icon={<Building2 size={18} />} onClick={() => setEditKind('client')} />
              <KindButton active={editKind === 'staff'} label="Сотрудник" icon={<ShieldCheck size={18} />} onClick={() => setEditKind('staff')} />
            </div>
            {editKind === 'client' && (
              <div className="mb-4 flex flex-wrap gap-2">
                {(['company', 'individual'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setEditClientType(value)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      editClientType === value ? 'bg-eco-800 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {value === 'company' ? 'Юр. лицо / ИП' : 'Физ. лицо'}
                  </button>
                ))}
              </div>
            )}
            <form id="edit-user-form" onSubmit={submitEdit} className="space-y-4">
              <UserFormFields
                kind={editKind}
                clientType={editClientType}
                user={editingUser}
                passwordOptional
              />
            </form>
          </>
        )}
      </Modal>
    </div>
  );
};

const StatCard = ({ value, label }: { value: number; label: string }) => (
  <div className="rounded-2xl bg-white/10 px-4 py-3 text-center backdrop-blur">
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-xs text-emerald-100">{label}</p>
  </div>
);

const SectionHeader = ({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) => (
  <div className="flex items-center gap-3">
    <span className="rounded-2xl bg-eco-50 p-3 text-eco-800">{icon}</span>
    <div>
      <h3 className="text-xl font-bold text-eco-900">{title}</h3>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  </div>
);

const KindButton = ({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-2xl border p-4 text-left transition ${
      active ? 'border-eco-500 bg-eco-50 shadow-sm' : 'border-slate-200 bg-slate-50 hover:bg-white'
    }`}
  >
    <div className="flex items-center gap-3">
      {icon}
      <span className="font-semibold text-slate-900">{label}</span>
    </div>
  </button>
);

const UserFormFields = ({
  kind,
  clientType,
  user,
  requirePassword = false,
  passwordOptional = false,
}: {
  kind: UserKind;
  clientType: ClientTypeOption;
  user?: AdminUserRecord;
  requirePassword?: boolean;
  passwordOptional?: boolean;
}) => (
  <div className="grid gap-4 md:grid-cols-2">
    <Field
      name="name"
      label={kind === 'client' && clientType === 'company' ? 'Контактное лицо' : 'ФИО'}
      defaultValue={user?.name}
      required
    />
    <Field name="email" label="Email" type="email" defaultValue={user?.email} required />
    <Field name="phone" label="Телефон" defaultValue={user?.phone || ''} />
    <Field name="city" label="Город" defaultValue={user?.city || ''} />

    {kind === 'staff' && (
      <>
        <label className={labelClass}>
          Роль
          <select name="role" defaultValue={user?.role || 'MANAGER'} className={inputClass} required>
            {staffRoles.map((role) => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>
        </label>
        <Field name="position" label="Должность" defaultValue={user?.position || ''} required />
      </>
    )}

    {kind === 'client' && clientType === 'company' && (
      <>
        <Field name="companyName" label="Название компании" defaultValue={user?.companyName || ''} required />
        <Field name="bin" label="БИН" defaultValue={user?.bin || ''} required />
        <label className={labelClass}>
          Тип организации
          <select name="organizationType" defaultValue={user?.organizationType || 'ТОО'} className={inputClass}>
            <option>ТОО</option>
            <option>ИП</option>
            <option>АО</option>
            <option>Другое</option>
          </select>
        </label>
        <Field name="legalAddress" label="Юридический адрес" defaultValue={user?.legalAddress || ''} />
      </>
    )}

    <Field
      name="password"
      label={passwordOptional ? 'Новый пароль (необязательно)' : 'Пароль'}
      type="password"
      required={requirePassword}
    />
    <Field
      name="confirm"
      label={passwordOptional ? 'Подтверждение пароля' : 'Подтверждение пароля'}
      type="password"
      required={requirePassword}
    />
  </div>
);

export default AdminUsersPage;
