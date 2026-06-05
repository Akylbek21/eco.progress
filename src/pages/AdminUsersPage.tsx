import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Edit3,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
  Unlock,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ConfirmModal from '../components/modals/ConfirmModal';
import { useToast } from '../hooks/useToast';
import {
  changeUserStatus,
  createUser,
  deleteUser,
  getUsers,
  updateUser,
  type AdminUserRecord,
  type AdminUserStatus,
  type CreateAdminUserPayload,
} from '../services/adminUserService';

type TabKey = 'staff' | 'clients' | 'all';
type ClientTypeOption = 'individual' | 'company';
type StaffRole = typeof staffRoles[number]['value'];

const staffRoles = [
  { value: 'ADMIN', label: 'Администратор' },
  { value: 'DIRECTOR', label: 'Директор' },
  { value: 'HEAD', label: 'Руководитель отдела' },
  { value: 'MANAGER', label: 'Менеджер' },
  { value: 'ACCOUNTANT', label: 'Бухгалтер' },
  { value: 'ECOLOGIST', label: 'Эколог' },
  { value: 'LABORATORY', label: 'Лаборатория' },
  { value: 'WASTE_SPECIALIST', label: 'Специалист по отходам' },
] as const;

const staffRoleValues = new Set(staffRoles.map((role) => role.value));

const roleLabels: Record<string, string> = {
  CLIENT: 'Клиент',
  ADMIN: 'Администратор',
  DIRECTOR: 'Директор',
  HEAD: 'Руководитель отдела',
  MANAGER: 'Менеджер',
  ACCOUNTANT: 'Бухгалтер',
  ECOLOGIST: 'Эколог',
  LABORATORY: 'Лаборатория',
  WASTE_SPECIALIST: 'Специалист по отходам',
};

const statusLabels: Record<string, string> = {
  active: 'Активен',
  blocked: 'Заблокирован',
};

const emptyStaffForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'MANAGER' as StaffRole,
  position: '',
  city: '',
  legalAddress: '',
  status: 'active' as AdminUserStatus,
};

type StaffFormState = typeof emptyStaffForm;
type StaffFormErrors = Partial<Record<keyof StaffFormState, string>>;
type ConfirmState =
  | { type: 'status'; user: AdminUserRecord; nextStatus: AdminUserStatus }
  | { type: 'delete'; user: AdminUserRecord }
  | null;

const inputClass = 'input-focus mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm';
const labelClass = 'block text-sm font-semibold text-slate-700';

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const isStaffUser = (user: AdminUserRecord) => staffRoleValues.has(user.role as StaffRole);

const StatusChip = ({ status }: { status?: string | null }) => {
  const isBlocked = status === 'blocked';
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
      isBlocked ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
    }`}>
      {statusLabels[status || 'active'] || status || 'Активен'}
    </span>
  );
};

const RoleChip = ({ role }: { role: string }) => (
  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
    {roleLabels[role] || role}
  </span>
);

const Field = ({
  name,
  label,
  type = 'text',
  required = false,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) => (
  <label className={labelClass}>
    {label}
    <input name={name} type={type} required={required} placeholder={placeholder} className={inputClass} />
  </label>
);

const StaffTextField = ({
  field,
  label,
  form,
  errors,
  onChange,
  type = 'text',
  required = false,
}: {
  field: keyof StaffFormState;
  label: string;
  form: StaffFormState;
  errors: StaffFormErrors;
  onChange: (field: keyof StaffFormState, value: string) => void;
  type?: string;
  required?: boolean;
}) => (
  <label className={labelClass}>
    {label}{required && <span className="text-rose-500"> *</span>}
    <input
      value={form[field]}
      type={type}
      onChange={(event) => onChange(field, event.target.value)}
      className={`${inputClass} ${errors[field] ? 'border-rose-300 ring-2 ring-rose-100' : ''}`}
    />
    {errors[field] && <span className="mt-1 block text-xs font-medium text-rose-600">{errors[field]}</span>}
  </label>
);

const EmptyTableState = ({ text }: { text: string }) => (
  <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
    {text}
  </div>
);

const AdminUsersPage = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('staff');
  const [clientType, setClientType] = useState<ClientTypeOption>('company');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<AdminUserRecord | null>(null);
  const [staffForm, setStaffForm] = useState<StaffFormState>(emptyStaffForm);
  const [staffErrors, setStaffErrors] = useState<StaffFormErrors>({});
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getUsers,
  });

  const visibleUsers = useMemo(() => users.filter((user) => user.status !== 'deleted'), [users]);
  const staffUsers = useMemo(() => visibleUsers.filter(isStaffUser), [visibleUsers]);
  const clientUsers = useMemo(() => visibleUsers.filter((user) => user.role === 'CLIENT'), [visibleUsers]);

  const stats = useMemo(() => ({
    total: visibleUsers.length,
    clients: clientUsers.length,
    staff: staffUsers.length,
    blocked: visibleUsers.filter((user) => user.status === 'blocked').length,
  }), [clientUsers.length, staffUsers.length, visibleUsers]);

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      invalidateUsers();
      toast.success('Готово', 'Пользователь успешно создан');
    },
    onError: (error: Error) => {
      toast.error('Ошибка', error.message || 'Не удалось создать пользователя');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CreateAdminUserPayload }) => updateUser(id, payload),
    onSuccess: () => {
      invalidateUsers();
      toast.success('Готово', 'Данные сотрудника обновлены');
    },
    onError: (error: Error) => {
      toast.error('Ошибка', error.message || 'Не удалось обновить пользователя');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: AdminUserStatus }) => changeUserStatus(id, status),
    onSuccess: () => {
      invalidateUsers();
      toast.success('Готово', 'Статус пользователя изменен');
      setConfirmState(null);
    },
    onError: (error: Error) => {
      toast.error('Ошибка', error.message || 'Не удалось изменить статус');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      invalidateUsers();
      toast.success('Готово', 'Пользователь удален');
      setConfirmState(null);
    },
    onError: (error: Error) => {
      toast.error('Ошибка', error.message || 'Не удалось удалить пользователя');
    },
  });

  const resetStaffForm = () => {
    setStaffForm(emptyStaffForm);
    setStaffErrors({});
    setEditingStaff(null);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    resetStaffForm();
  };

  const openCreateStaff = () => {
    resetStaffForm();
    setDrawerOpen(true);
  };

  const openEditStaff = (user: AdminUserRecord) => {
    setEditingStaff(user);
    setStaffErrors({});
    setStaffForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      role: staffRoleValues.has(user.role as StaffRole) ? user.role as StaffRole : 'MANAGER',
      position: user.position || '',
      city: user.city || '',
      legalAddress: user.legalAddress || '',
      status: user.status === 'blocked' ? 'blocked' : 'active',
    });
    setDrawerOpen(true);
  };

  const handleStaffChange = (field: keyof StaffFormState, value: string) => {
    setStaffForm((current) => ({ ...current, [field]: value }));
    setStaffErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateStaffForm = () => {
    const errors: StaffFormErrors = {};
    const email = staffForm.email.trim();
    if (!staffForm.name.trim()) errors.name = 'Укажите ФИО сотрудника';
    if (!email) errors.email = 'Укажите email';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Введите корректный email';
    if (!staffForm.phone.trim()) errors.phone = 'Укажите телефон';
    if (!editingStaff && !staffForm.password.trim()) errors.password = 'Пароль обязателен при создании';
    if (!staffForm.role) errors.role = 'Выберите роль';
    if (!staffForm.position.trim()) errors.position = 'Укажите должность';
    if (!staffForm.city.trim()) errors.city = 'Укажите город';
    setStaffErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateStaffForm()) return;

    const payload: CreateAdminUserPayload = {
      email: staffForm.email.trim(),
      name: staffForm.name.trim(),
      phone: staffForm.phone.trim(),
      city: staffForm.city.trim(),
      legalAddress: staffForm.legalAddress.trim() || undefined,
      position: staffForm.position.trim(),
      role: staffForm.role,
      status: staffForm.status,
    };
    if (staffForm.password.trim()) payload.password = staffForm.password;

    if (editingStaff) {
      await updateMutation.mutateAsync({ id: editingStaff.id, payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    closeDrawer();
  };

  const submitClient = async (event: FormEvent<HTMLFormElement>) => {
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
      role: 'CLIENT',
      type: clientType,
      companyName: String(form.get('companyName') || '').trim() || undefined,
      bin: String(form.get('bin') || '').trim() || undefined,
      organizationType: String(form.get('organizationType') || '').trim() || undefined,
      status: 'active',
    };

    await createMutation.mutateAsync(payload);
    event.currentTarget.reset();
  };

  const confirmAction = async () => {
    if (!confirmState) return;
    if (confirmState.type === 'status') {
      await statusMutation.mutateAsync({ id: confirmState.user.id, status: confirmState.nextStatus });
      return;
    }
    await deleteMutation.mutateAsync(confirmState.user.id);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const tabs = [
    { key: 'staff' as const, label: 'Сотрудники', count: stats.staff },
    { key: 'clients' as const, label: 'Клиенты', count: stats.clients },
    { key: 'all' as const, label: 'Все пользователи', count: stats.total },
  ];

  return (
    <div className="space-y-6 bg-slate-50/60">
      <section className="overflow-hidden rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-eco-700">Администрирование</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-950">Пользователи системы</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Управление сотрудниками CRM, клиентскими аккаунтами, доступами и статусами.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Всего', stats.total],
              ['Сотрудники', stats.staff],
              ['Клиенты', stats.clients],
              ['Заблокированы', stats.blocked],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[20px] border border-slate-100 bg-slate-50 px-4 py-3 text-center">
                <p className="text-2xl font-bold text-slate-950">{value}</p>
                <p className="text-xs font-semibold text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-100 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 rounded-[18px] px-5 py-3 text-sm font-bold transition ${
                activeTab === tab.key ? 'bg-eco-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'staff' && (
        <section className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="rounded-[18px] bg-eco-50 p-3 text-eco-800"><ShieldCheck size={22} /></span>
              <div>
                <h3 className="text-xl font-bold text-slate-950">Сотрудники</h3>
                <p className="text-sm text-slate-500">Роли, должности, статусы и доступ к CRM.</p>
              </div>
            </div>
            <Button type="button" onClick={openCreateStaff} className="gap-2 rounded-[18px] bg-slate-950 px-5 hover:bg-slate-800">
              <Plus size={18} />
              Добавить сотрудника
            </Button>
          </div>
          <div className="mt-6 overflow-x-auto">
            {staffUsers.length === 0 ? (
              <EmptyTableState text="Сотрудников пока нет. Добавьте первого сотрудника через кнопку выше." />
            ) : (
              <table className="min-w-[1120px] w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    {['ФИО', 'Email', 'Телефон', 'Роль', 'Должность', 'Город', 'Статус', 'Последний вход', 'Дата создания', 'Действия'].map((header) => (
                      <th key={header} className="border-b border-slate-100 px-4 py-3 font-bold">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staffUsers.map((user) => {
                    const nextStatus: AdminUserStatus = user.status === 'blocked' ? 'active' : 'blocked';
                    return (
                      <tr key={user.id} className="group">
                        <td className="border-b border-slate-100 px-4 py-4 font-bold text-slate-950">{user.name}</td>
                        <td className="border-b border-slate-100 px-4 py-4 text-slate-600">{user.email}</td>
                        <td className="border-b border-slate-100 px-4 py-4 text-slate-600">{user.phone || '-'}</td>
                        <td className="border-b border-slate-100 px-4 py-4"><RoleChip role={user.role} /></td>
                        <td className="border-b border-slate-100 px-4 py-4 text-slate-600">{user.position || '-'}</td>
                        <td className="border-b border-slate-100 px-4 py-4 text-slate-600">{user.city || '-'}</td>
                        <td className="border-b border-slate-100 px-4 py-4"><StatusChip status={user.status} /></td>
                        <td className="border-b border-slate-100 px-4 py-4 text-slate-500">{formatDate(user.lastLoginAt)}</td>
                        <td className="border-b border-slate-100 px-4 py-4 text-slate-500">{formatDate(user.createdAt)}</td>
                        <td className="border-b border-slate-100 px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => openEditStaff(user)} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">
                              <Edit3 size={14} /> Редактировать
                            </button>
                            <button type="button" onClick={() => setConfirmState({ type: 'status', user, nextStatus })} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100">
                              {nextStatus === 'blocked' ? <Lock size={14} /> : <Unlock size={14} />}
                              {nextStatus === 'blocked' ? 'Заблокировать' : 'Активировать'}
                            </button>
                            <button type="button" onClick={() => setConfirmState({ type: 'delete', user })} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100">
                              <Trash2 size={14} /> Удалить
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {activeTab === 'clients' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(380px,0.75fr)_minmax(0,1fr)]">
          <section className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="rounded-[18px] bg-eco-50 p-3 text-eco-800"><UserPlus size={20} /></span>
              <div>
                <h3 className="text-xl font-bold text-slate-950">Создать клиента</h3>
                <p className="text-sm text-slate-500">Существующая клиентская логика сохранена отдельно.</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {(['company', 'individual'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setClientType(value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    clientType === value ? 'bg-eco-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {value === 'company' ? 'Юр. лицо / ИП' : 'Физ. лицо'}
                </button>
              ))}
            </div>
            <form onSubmit={submitClient} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <Field name="name" label={clientType === 'company' ? 'Контактное лицо' : 'ФИО'} required />
                <Field name="email" label="Email" type="email" required />
                <Field name="phone" label="Телефон" />
                <Field name="city" label="Город" />
                {clientType === 'company' && (
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
                {createMutation.isPending ? 'Создание...' : 'Создать клиента'}
              </Button>
            </form>
          </section>

          <section className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="rounded-[18px] bg-slate-100 p-3 text-slate-700"><Building2 size={20} /></span>
              <div>
                <h3 className="text-xl font-bold text-slate-950">Клиенты</h3>
                <p className="text-sm text-slate-500">Клиентские аккаунты без staff-ролей.</p>
              </div>
            </div>
            <div className="mt-6 overflow-x-auto">
              {clientUsers.length === 0 ? (
                <EmptyTableState text="Клиентов пока нет." />
              ) : (
                <table className="min-w-[760px] w-full border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      {['Имя', 'Email', 'Телефон', 'Компания', 'Статус', 'Дата создания'].map((header) => (
                        <th key={header} className="border-b border-slate-100 px-4 py-3 font-bold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientUsers.map((user) => (
                      <tr key={user.id}>
                        <td className="border-b border-slate-100 px-4 py-4 font-bold text-slate-950">{user.name}</td>
                        <td className="border-b border-slate-100 px-4 py-4 text-slate-600">{user.email}</td>
                        <td className="border-b border-slate-100 px-4 py-4 text-slate-600">{user.phone || '-'}</td>
                        <td className="border-b border-slate-100 px-4 py-4 text-slate-600">{user.companyName || '-'}</td>
                        <td className="border-b border-slate-100 px-4 py-4"><StatusChip status={user.status} /></td>
                        <td className="border-b border-slate-100 px-4 py-4 text-slate-500">{formatDate(user.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'all' && (
        <section className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="rounded-[18px] bg-slate-100 p-3 text-slate-700"><Users size={20} /></span>
            <div>
              <h3 className="text-xl font-bold text-slate-950">Все пользователи</h3>
              <p className="text-sm text-slate-500">Единый список аккаунтов с ролью и статусом.</p>
            </div>
          </div>
          <div className="mt-6 overflow-x-auto">
            {visibleUsers.length === 0 ? (
              <EmptyTableState text="Пользователей пока нет." />
            ) : (
              <table className="min-w-[940px] w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    {['ФИО / Компания', 'Email', 'Телефон', 'Роль', 'Тип', 'Статус', 'Последний вход', 'Дата создания'].map((header) => (
                      <th key={header} className="border-b border-slate-100 px-4 py-3 font-bold">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="border-b border-slate-100 px-4 py-4">
                        <p className="font-bold text-slate-950">{user.name}</p>
                        {user.companyName && <p className="mt-1 text-xs text-slate-500">{user.companyName}</p>}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4 text-slate-600">{user.email}</td>
                      <td className="border-b border-slate-100 px-4 py-4 text-slate-600">{user.phone || '-'}</td>
                      <td className="border-b border-slate-100 px-4 py-4"><RoleChip role={user.role} /></td>
                      <td className="border-b border-slate-100 px-4 py-4 text-slate-500">{user.type || '-'}</td>
                      <td className="border-b border-slate-100 px-4 py-4"><StatusChip status={user.status} /></td>
                      <td className="border-b border-slate-100 px-4 py-4 text-slate-500">{formatDate(user.lastLoginAt)}</td>
                      <td className="border-b border-slate-100 px-4 py-4 text-slate-500">{formatDate(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm">
          <button type="button" aria-label="Закрыть форму" className="absolute inset-0 cursor-default" onClick={closeDrawer} />
          <aside className="relative flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-eco-700">Сотрудник CRM</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-950">
                  {editingStaff ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Пароль при редактировании можно оставить пустым.
                </p>
              </div>
              <button type="button" onClick={closeDrawer} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitStaff} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
                <StaffTextField field="name" label="ФИО сотрудника" form={staffForm} errors={staffErrors} onChange={handleStaffChange} required />
                <div className="grid gap-5 sm:grid-cols-2">
                  <StaffTextField field="email" label="Email" type="email" form={staffForm} errors={staffErrors} onChange={handleStaffChange} required />
                  <StaffTextField field="phone" label="Телефон" form={staffForm} errors={staffErrors} onChange={handleStaffChange} required />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <StaffTextField field="password" label={editingStaff ? 'Новый пароль' : 'Пароль'} type="password" form={staffForm} errors={staffErrors} onChange={handleStaffChange} required={!editingStaff} />
                  <label className={labelClass}>
                    Роль<span className="text-rose-500"> *</span>
                    <select
                      value={staffForm.role}
                      onChange={(event) => handleStaffChange('role', event.target.value)}
                      className={`${inputClass} ${staffErrors.role ? 'border-rose-300 ring-2 ring-rose-100' : ''}`}
                    >
                      {staffRoles.map((role) => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                    {staffErrors.role && <span className="mt-1 block text-xs font-medium text-rose-600">{staffErrors.role}</span>}
                  </label>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <StaffTextField field="position" label="Должность" form={staffForm} errors={staffErrors} onChange={handleStaffChange} required />
                  <StaffTextField field="city" label="Город" form={staffForm} errors={staffErrors} onChange={handleStaffChange} required />
                </div>
                <StaffTextField field="legalAddress" label="Юридический адрес" form={staffForm} errors={staffErrors} onChange={handleStaffChange} />
                <label className={labelClass}>
                  Статус
                  <select
                    value={staffForm.status}
                    onChange={(event) => handleStaffChange('status', event.target.value)}
                    className={inputClass}
                  >
                    <option value="active">active</option>
                    <option value="blocked">blocked</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 p-6">
                <Button type="button" variant="secondary" onClick={closeDrawer}>Отмена</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? 'Сохранение...' : editingStaff ? 'Сохранить' : 'Добавить'}
                </Button>
              </div>
            </form>
          </aside>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(confirmState)}
        title={confirmState?.type === 'delete' ? 'Удалить пользователя?' : confirmState?.nextStatus === 'blocked' ? 'Заблокировать сотрудника?' : 'Активировать сотрудника?'}
        description={confirmState ? `${confirmState.user.name} (${confirmState.user.email})` : undefined}
        confirmText={confirmState?.type === 'delete' ? 'Удалить' : confirmState?.nextStatus === 'blocked' ? 'Заблокировать' : 'Активировать'}
        variant={confirmState?.type === 'delete' || confirmState?.nextStatus === 'blocked' ? 'danger' : 'success'}
        loading={statusMutation.isPending || deleteMutation.isPending}
        onConfirm={confirmAction}
        onClose={() => setConfirmState(null)}
      />
    </div>
  );
};

export default AdminUsersPage;
