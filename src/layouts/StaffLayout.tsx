import { ReactNode, useState } from 'react';
import { NavLink, Link, Navigate } from 'react-router-dom';
import { BarChart3, Bell, BookOpenCheck, Building2, CalendarDays, ClipboardCheck, ClipboardList, CreditCard, FileSignature, FileText, FlaskConical, Gauge, Handshake, LayoutDashboard, LockKeyhole, LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { canAccessPayments } from '../utils/payments';
import { canAccess } from '../config/permissions';
import type { UserRole } from '../types';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const protocolRoles: UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY'];
const protocolMockMode = String(import.meta.env.VITE_USE_PROTOCOL_MOCKS || '').toLowerCase() === 'true';

const links: Array<{ label: string; path: string; icon: typeof ClipboardList; paymentsOnly?: boolean; rolesOnly?: boolean; allowedRoles?: UserRole[] }> = [
  { label: 'Обзор', path: '/staff', icon: LayoutDashboard },
  { label: 'Заявки', path: '/staff/orders', icon: ClipboardList },
  { label: 'Клиенты', path: '/staff/clients', icon: Building2, allowedRoles: ['ADMIN', 'MANAGER'] },
  { label: 'Компании', path: '/staff/companies', icon: Building2, allowedRoles: protocolRoles },
  { label: 'КП', path: '/staff/commercial-offers', icon: Handshake, allowedRoles: ['ADMIN', 'MANAGER'] },
  { label: 'Договоры', path: '/staff/contracts', icon: FileSignature, allowedRoles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'] },
  { label: 'Оплаты', path: '/staff/payments', icon: CreditCard, paymentsOnly: true, allowedRoles: ['ADMIN', 'ACCOUNTANT'] },
  { label: 'Календарь', path: '/staff/calendar', icon: CalendarDays, allowedRoles: ['ADMIN', 'MANAGER', 'ECOLOGIST', 'LABORATORY'] },
  { label: 'Протоколы', path: '/staff/protocols', icon: FlaskConical, allowedRoles: protocolRoles },
  { label: 'Нормативы', path: '/staff/normatives', icon: BookOpenCheck, allowedRoles: protocolRoles },
  { label: 'Средства измерений', path: '/staff/measurement-devices', icon: Gauge, allowedRoles: protocolRoles },
  { label: 'Задачи', path: '/staff/tasks', icon: ClipboardCheck },
  { label: 'Документы', path: '/staff/documents', icon: FileText },
  { label: 'Уведомления', path: '/staff/notifications', icon: Bell },
  { label: 'Отчеты', path: '/staff/reports', icon: BarChart3, allowedRoles: ['ADMIN', 'ACCOUNTANT'] },
  { label: 'Роли пользователей', path: '/staff/user-roles', icon: ShieldCheck, rolesOnly: true },
];

const roleLabel = (role?: string) => {
  const labels: Record<string, string> = {
    ADMIN: 'Администратор',
    DIRECTOR: 'Директор',
    HEAD: 'Руководитель',
    MANAGER: 'Менеджер',
    ACCOUNTANT: 'Бухгалтер',
    ECOLOGIST: 'Эколог',
    LABORATORY: 'Лаборатория',
    WASTE_SPECIALIST: 'Специалист по отходам',
  };
  return labels[role || ''] || 'Сотрудник';
};

const StaffLayout = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const { user, loading, isAuthenticated, isStaff, logout } = useAuth();

  if (loading) return <div className="flex min-h-screen items-center justify-center"><LoadingSpinner /></div>;
  if (!isAuthenticated || !isStaff) return <Navigate to="/staff/login" replace />;
  const homePath = '/staff';

  const nav = (mobile = false) => (
    <nav className={mobile ? 'space-y-1' : 'mt-8 space-y-1'}>
      {(protocolMockMode
        ? links.filter((item) => ['/staff', '/staff/companies', '/staff/protocols', '/staff/normatives', '/staff/measurement-devices'].includes(item.path))
        : links
      ).map((item) => {
        const Icon = item.icon;
        if (item.allowedRoles && (!user?.role || !item.allowedRoles.includes(user.role))) return null;
        const locked = (item.paymentsOnly && !canAccessPayments(user?.role)) || (item.rolesOnly && !canAccess(user?.role, 'manage_roles') && !canAccess(user?.role, 'manage_employees'));
        if (locked) {
          const title = item.rolesOnly ? 'Доступно администратору и руководителю' : 'Доступно администратору, руководителю и бухгалтеру';
          return (
            <div
              key={item.path}
              title={title}
              className={`flex cursor-not-allowed items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium ${
                mobile ? 'text-slate-400' : 'text-white/45'
              }`}
            >
              <Icon size={18} />
              <span className="min-w-0 flex-1">{item.label}</span>
              <LockKeyhole size={14} />
            </div>
          );
        }
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/staff'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                mobile
                  ? isActive
                    ? 'bg-eco-900 text-white shadow-lg shadow-eco-900/15'
                    : 'text-slate-700 hover:bg-eco-50'
                  : isActive
                    ? 'bg-white text-eco-900'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon size={18} /> {item.label}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:grid lg:grid-cols-[290px_1fr]">
      <aside className="hidden bg-eco-900 p-6 text-white lg:block">
        <Link to={homePath} className="flex items-center text-xl font-bold leading-tight">
          <span>
            <span className="block">ecoprogress.kz</span>
            <span className="block text-xs tracking-[0.22em] text-white/55">CRM</span>
          </span>
        </Link>
        <p className="mt-2 text-sm text-white/60">Кабинет сотрудника</p>
        {nav()}
      </aside>
      <div>
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
            <button className="rounded-2xl border border-slate-200 bg-white p-3 lg:hidden" onClick={() => setOpen(true)} aria-label="Меню">
              <Menu size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-500">Роль: {roleLabel(user?.role)}</p>
              <h1 className="truncate text-base font-semibold text-eco-900 sm:text-lg">{user?.name || 'Сотрудник ecoprogress.kz'}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {!protocolMockMode && <Link to="/" className="hidden text-sm font-semibold text-eco-700 hover:text-eco-900 sm:block">На сайт</Link>}
              <Link to="/staff/login" onClick={logout} className="inline-flex items-center gap-2 rounded-full bg-eco-900 px-3 py-2 text-sm font-semibold text-white sm:px-4">
                <LogOut size={16} />
                <span className="hidden sm:inline">Выйти</span>
              </Link>
            </div>
          </div>
        </header>
        {open && (
          <div className="fixed inset-0 z-50 bg-eco-900/40 lg:hidden" onClick={() => setOpen(false)}>
            <aside className="h-full w-80 max-w-[86vw] bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <span className="font-bold text-eco-900">CRM сотрудника</span>
                  <p className="mt-1 text-xs text-slate-500">ecoprogress.kz</p>
                </div>
                <button className="rounded-2xl border border-slate-200 p-2" onClick={() => setOpen(false)} aria-label="Закрыть меню">
                  <X size={18} />
                </button>
              </div>
              {nav(true)}
            </aside>
          </div>
        )}
        <main className="staff-crm px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
};

export default StaffLayout;
