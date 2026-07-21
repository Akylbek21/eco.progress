import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, type ComponentType, type ReactNode } from 'react';
import PublicLayout from './layouts/PublicLayout';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import PageLoader, { RouteProgressProvider } from './components/loading/PageLoader';
import AnalyticsRouteTracker from './components/AnalyticsRouteTracker';
import { useToast } from './hooks/useToast';
import { useAuth } from './contexts/AuthContext';
import type { UserRole } from './types';
import { companyRoleMatrix } from './config/permissions';
import { publicRouteLoaders } from './utils/publicRoutePreload';

const lazyNamed = <T extends Record<string, unknown>, K extends keyof T>(loader: () => Promise<T>, key: K) =>
  lazy(() => loader().then((module) => ({ default: module[key] as unknown as ComponentType<Record<string, unknown>> })));

const HomePage = lazy(publicRouteLoaders.home);
const CabinetLayout = lazy(() => import('./layouts/CabinetLayout'));
const StaffLayout = lazy(() => import('./layouts/StaffLayout'));
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const AboutPage = lazy(publicRouteLoaders.about);
const ServicesPage = lazy(publicRouteLoaders.services);
const SeoLandingPage = lazy(() => import('./pages/SeoLandingPage'));
const ServiceLandingPage = lazy(() => import('./pages/ServiceLandingPage'));
const ServiceDetailsPage = lazy(() => import('./pages/ServiceDetailsPage'));
const ServiceRoutePage = lazy(() => import('./pages/ServiceRoutePage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const PartnersPage = lazy(() => import('./pages/PartnersPage'));
const TariffsPage = lazy(() => import('./pages/TariffsPage'));
const NewsPage = lazy(publicRouteLoaders.news);
const NewsDetailsPage = lazy(() => import('./pages/NewsDetailsPage'));
const LoginPage = lazy(publicRouteLoaders.login);
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const ContactsPage = lazy(publicRouteLoaders.contacts);
const RegionsPage = lazy(publicRouteLoaders.regions);
const SearchPage = lazy(() => import('./pages/SearchPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const ProtocolsPage = lazy(() => import('./pages/ProtocolsPage'));
const ProtocolEditorPage = lazy(() => import('./pages/ProtocolEditorPage'));
const ProtocolCreatePage = lazy(() => import('./pages/ProtocolCreatePage'));
const QuickProtocolCreatePage = lazy(() => import('./pages/QuickProtocolCreatePage'));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'));
const NormativeDirectoryPage = lazy(() => import('./pages/NormativeDirectoryPage'));
const MeasurementDevicesPage = lazy(() => import('./pages/MeasurementDevicesPage'));
const LaboratorySettingsPage = lazy(() => import('./pages/LaboratorySettingsPage'));
const LabJournalsPage = lazy(() => import('./pages/LabJournalsPage'));
const StaffLeadsPage = lazy(() => import('./pages/staff/StaffLeadsPage'));
const ContentDashboardPage = lazyNamed(() => import('./pages/content/ContentManagementPages'), 'ContentDashboardPage');
const ContentListPage = lazyNamed(() => import('./pages/content/ContentManagementPages'), 'ContentListPage');
const ContentEditorPage = lazyNamed(() => import('./pages/content/ContentManagementPages'), 'ContentEditorPage');
const ContentAnalyticsPage = lazyNamed(() => import('./pages/content/ContentManagementPages'), 'ContentAnalyticsPage');
const ContentAuditPage = lazyNamed(() => import('./pages/content/ContentManagementPages'), 'ContentAuditPage');

const CabinetCompanyPage = lazyNamed(() => import('./pages/CabinetPages'), 'CabinetCompanyPage');
const CabinetDashboardPage = lazyNamed(() => import('./pages/CabinetPages'), 'CabinetDashboardPage');
const CabinetDocumentsPage = lazyNamed(() => import('./pages/CabinetPages'), 'CabinetDocumentsPage');
const CabinetNewOrderPage = lazyNamed(() => import('./pages/CabinetPages'), 'CabinetNewOrderPage');
const CabinetNotificationsPage = lazyNamed(() => import('./pages/CabinetPages'), 'CabinetNotificationsPage');
const CabinetOrderDetailsPage = lazyNamed(() => import('./pages/CabinetPages'), 'CabinetOrderDetailsPage');
const CabinetOrdersPage = lazyNamed(() => import('./pages/CabinetPages'), 'CabinetOrdersPage');
const CabinetPaymentsPage = lazyNamed(() => import('./pages/CabinetPages'), 'CabinetPaymentsPage');

const StaffClientsPage = lazyNamed(() => import('./pages/StaffPages'), 'StaffClientsPage');
const StaffCalendarPage = lazyNamed(() => import('./pages/StaffPages'), 'StaffCalendarPage');
const StaffCommercialOffersPage = lazyNamed(() => import('./pages/StaffPages'), 'StaffCommercialOffersPage');
const StaffContractsPage = lazyNamed(() => import('./pages/StaffPages'), 'StaffContractsPage');
const StaffDashboardPage = lazyNamed(() => import('./pages/StaffPages'), 'StaffDashboardPage');
const StaffDocumentsPage = lazyNamed(() => import('./pages/StaffPages'), 'StaffDocumentsPage');
const StaffNewOrderPage = lazyNamed(() => import('./pages/StaffPages'), 'StaffNewOrderPage');
const StaffNotificationsPage = lazyNamed(() => import('./pages/StaffPages'), 'StaffNotificationsPage');
const StaffOrderDetailsPage = lazyNamed(() => import('./pages/StaffPages'), 'StaffOrderDetailsPage');
const StaffOrdersPage = lazyNamed(() => import('./pages/StaffPages'), 'StaffOrdersPage');
const StaffProfilePage = lazyNamed(() => import('./pages/StaffPages'), 'StaffProfilePage');
const StaffReportsPage = lazyNamed(() => import('./pages/StaffPages'), 'StaffReportsPage');
const StaffTasksPage = lazyNamed(() => import('./pages/StaffPages'), 'StaffTasksPage');
const StaffUserRolesPage = lazyNamed(() => import('./pages/StaffPages'), 'StaffUserRolesPage');

const allStaffRoles: UserRole[] = ['MANAGER', 'ADMIN', 'DIRECTOR', 'HEAD', 'ACCOUNTANT', 'ECOLOGIST', 'LABORATORY', 'WASTE_SPECIALIST'];
const protocolRoles: UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY'];
const normativeRoles: UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY', 'MANAGER'];
const companyReadRoles: UserRole[] = [...companyRoleMatrix.read];
const companyManageRoles: UserRole[] = [...companyRoleMatrix.write];

const StaffAccess = ({ roles, children }: { roles?: UserRole[]; children: ReactNode }) => {
  const { user } = useAuth();
  if (!roles || !user?.role || user.role === 'ADMIN' || roles.includes(user.role)) return <>{children}</>;
  return <StaffDashboardPage />;
};

const ForbiddenPage = ({ message = 'У вашей роли нет прав для открытия этого раздела.' }: { message?: string }) => (
  <div className="flex min-h-[60vh] items-center justify-center px-5">
    <div className="max-w-md rounded-[24px] bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-bold text-eco-900">Нет доступа</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
    </div>
  </div>
);

const publicPathPrefixes = ['/', '/about', '/services', '/tariffs', '/employees', '/partners', '/news', '/faq', '/contacts'];

const RouteFallback = () => {
  const { pathname } = useLocation();
  const isPrivate = ['/cabinet', '/staff', '/admin', '/dashboard', '/login', '/register'].some((prefix) => pathname.startsWith(prefix));
  const isPublic = !isPrivate && (publicPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) || pathname.split('/').filter(Boolean).length === 1);
  return isPublic ? <PublicLayout><PageLoader /></PublicLayout> : <PageLoader />;
};

const RoleAccess = ({ roles, loginPath, forbiddenMessage, children }: { roles: UserRole[]; loginPath: string; forbiddenMessage?: string; children: ReactNode }) => {
  const { user, loading, isAuthenticated } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to={loginPath} replace />;
  if (!user?.role || !roles.includes(user.role)) return <ForbiddenPage message={forbiddenMessage} />;
  return <>{children}</>;
};

function App() {
  const toast = useToast();
  const location = useLocation();

  useEffect(() => {
    const privatePrefixes = ['/cabinet', '/staff', '/admin', '/dashboard', '/login', '/register', '/api', '/crm'];
    const isPrivate = privatePrefixes.some((prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`));
    let meta = document.head.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', isPrivate ? 'noindex,nofollow' : 'index,follow');
  }, [location.pathname]);
  const notify = (message: string) => {
    const lower = message.toLowerCase();
    if (
      lower.includes('ошибка') ||
      lower.includes('не удалось') ||
      lower.includes('нельзя') ||
      lower.includes('не сохран') ||
      lower.includes('не загруж') ||
      lower.includes('не отправ')
    ) {
      toast.error(message);
      return;
    }
    if (
      lower.includes('выберите') ||
      lower.includes('укажите') ||
      lower.includes('сначала') ||
      lower.includes('недоступ') ||
      lower.includes('заполните')
    ) {
      toast.warning(message);
      return;
    }
    toast.success(message);
  };

  return (
    <RouteProgressProvider>
      <div className="min-h-screen bg-eco-50 text-slate-900">
        <ScrollToTop />
        <AnalyticsRouteTracker />
        <Suspense fallback={<RouteFallback />}>
        <Routes>
        <Route path="/" element={<PublicLayout><HomePage /></PublicLayout>} />
        <Route path="/about" element={<PublicLayout><AboutPage /></PublicLayout>} />
        <Route path="/services" element={<PublicLayout><ServicesPage /></PublicLayout>} />
        <Route path="/services/ecological-documents" element={<PublicLayout><ServiceLandingPage slug="ecological-documents" /></PublicLayout>} />
        <Route path="/services/waste-transportation" element={<PublicLayout><ServiceLandingPage slug="waste-transportation" /></PublicLayout>} />
        <Route path="/services/waste-recycling" element={<PublicLayout><ServiceLandingPage slug="waste-recycling" /></PublicLayout>} />
        <Route path="/services/laboratory-tests" element={<PublicLayout><ServiceLandingPage slug="laboratory-tests" /></PublicLayout>} />
        <Route path="/services/poligon-tbo" element={<PublicLayout><ServiceLandingPage slug="poligon-tbo" /></PublicLayout>} />
        <Route path="/services/environmental-audit" element={<PublicLayout><ServiceLandingPage slug="environmental-audit" /></PublicLayout>} />
        <Route path="/services/:id" element={<PublicLayout><ServiceRoutePage /></PublicLayout>} />
        <Route path="/tariffs" element={<PublicLayout><TariffsPage /></PublicLayout>} />
        <Route path="/employees" element={<PublicLayout><EmployeesPage /></PublicLayout>} />
        <Route path="/partners" element={<PublicLayout><PartnersPage /></PublicLayout>} />
        <Route path="/news" element={<PublicLayout><NewsPage /></PublicLayout>} />
        <Route path="/news/:id" element={<PublicLayout><NewsDetailsPage /></PublicLayout>} />
        <Route path="/faq" element={<PublicLayout><FaqPage /></PublicLayout>} />
        <Route path="/contacts" element={<PublicLayout><ContactsPage /></PublicLayout>} />
        <Route path="/regions" element={<PublicLayout><RegionsPage /></PublicLayout>} />
        <Route path="/search" element={<PublicLayout><SearchPage /></PublicLayout>} />
        <Route path="/shtrafy-za-ekologiyu-kazakhstan" element={<Navigate to="/news/kakie-shtrafy-za-ekologiyu-v-kazakhstane" replace />} />
        <Route path="/:seoSlug" element={<PublicLayout><SeoLandingPage /></PublicLayout>} />
        <Route path="/login" element={<LoginPage onSuccess={notify} />} />
        <Route path="/register" element={<RegisterPage onSuccess={notify} />} />
        <Route path="/staff/login" element={<LoginPage staff onSuccess={notify} />} />

        <Route path="/cabinet" element={<RoleAccess roles={['CLIENT']} loginPath="/login"><CabinetLayout><CabinetDashboardPage /></CabinetLayout></RoleAccess>} />
        <Route path="/cabinet/orders" element={<RoleAccess roles={['CLIENT']} loginPath="/login"><CabinetLayout><CabinetOrdersPage /></CabinetLayout></RoleAccess>} />
        <Route path="/cabinet/orders/new" element={<RoleAccess roles={['CLIENT']} loginPath="/login"><CabinetLayout><CabinetNewOrderPage onNotify={notify} /></CabinetLayout></RoleAccess>} />
        <Route path="/cabinet/orders/:id" element={<RoleAccess roles={['CLIENT']} loginPath="/login"><CabinetLayout><CabinetOrderDetailsPage onNotify={notify} /></CabinetLayout></RoleAccess>} />
        <Route path="/client/orders/:id" element={<RoleAccess roles={['CLIENT']} loginPath="/login"><CabinetLayout><CabinetOrderDetailsPage onNotify={notify} /></CabinetLayout></RoleAccess>} />
        <Route path="/cabinet/documents" element={<RoleAccess roles={['CLIENT']} loginPath="/login"><CabinetLayout><CabinetDocumentsPage /></CabinetLayout></RoleAccess>} />
        <Route path="/cabinet/payments" element={<RoleAccess roles={['CLIENT']} loginPath="/login"><CabinetLayout><CabinetPaymentsPage /></CabinetLayout></RoleAccess>} />
        <Route path="/cabinet/company" element={<RoleAccess roles={['CLIENT']} loginPath="/login"><CabinetLayout><CabinetCompanyPage /></CabinetLayout></RoleAccess>} />
        <Route path="/cabinet/notifications" element={<RoleAccess roles={['CLIENT']} loginPath="/login"><CabinetLayout><CabinetNotificationsPage /></CabinetLayout></RoleAccess>} />

        <Route path="/staff" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffDashboardPage /></StaffLayout></RoleAccess>} />
        <Route path="/staff/orders" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffOrdersPage /></StaffLayout></RoleAccess>} />
        <Route path="/staff/orders/new" element={<RoleAccess roles={['MANAGER', 'ADMIN']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'MANAGER']}><StaffNewOrderPage onNotify={notify} /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/orders/company/:businessCompanyId" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffOrdersPage /></StaffLayout></RoleAccess>} />
        <Route path="/staff/orders/:id" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffOrderDetailsPage onNotify={notify} /></StaffLayout></RoleAccess>} />
        <Route path="/staff/clients" element={<RoleAccess roles={['MANAGER', 'ADMIN']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'MANAGER']}><StaffClientsPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/clients/:companyKey" element={<RoleAccess roles={['MANAGER', 'ADMIN']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'MANAGER']}><StaffClientsPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/leads" element={<RoleAccess roles={['MANAGER', 'ADMIN']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'MANAGER']}><StaffLeadsPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/content" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentDashboardPage /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/services" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentListPage type="SERVICE" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/services/:id" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentEditorPage type="SERVICE" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/articles" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentListPage type="ARTICLE" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/articles/:id" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentEditorPage type="ARTICLE" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/regions" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentListPage type="REGION" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/regions/:id" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentEditorPage type="REGION" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/regional-pages" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentListPage type="REGIONAL_PAGE" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/regional-pages/:id" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentEditorPage type="REGIONAL_PAGE" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/cases" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentListPage type="CASE" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/cases/:id" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentEditorPage type="CASE" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/experts" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentListPage type="EXPERT" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/experts/:id" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentEditorPage type="EXPERT" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/trust-documents" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentListPage type="TRUST_DOCUMENT" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/trust-documents/:id" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentEditorPage type="TRUST_DOCUMENT" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/legal-sources" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentListPage type="LEGAL_SOURCE" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/legal-sources/:id" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentEditorPage type="LEGAL_SOURCE" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/redirects" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentListPage type="REDIRECT" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/redirects/:id" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentEditorPage type="REDIRECT" /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/audit" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentAuditPage /></StaffLayout></RoleAccess>} />
        <Route path="/staff/content/analytics" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><ContentAnalyticsPage /></StaffLayout></RoleAccess>} />
        <Route path="/staff/companies" element={<RoleAccess roles={companyReadRoles} loginPath="/staff/login"><StaffLayout><StaffAccess roles={companyReadRoles}><ErrorBoundary fallbackTitle="Не удалось открыть компании"><CompaniesPage /></ErrorBoundary></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/companies/new" element={<RoleAccess roles={companyManageRoles} loginPath="/staff/login"><StaffLayout><StaffAccess roles={companyManageRoles}><ErrorBoundary fallbackTitle="Не удалось открыть создание компании"><CompaniesPage /></ErrorBoundary></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/companies/:companyId" element={<RoleAccess roles={companyReadRoles} loginPath="/staff/login"><StaffLayout><StaffAccess roles={companyReadRoles}><ErrorBoundary fallbackTitle="Не удалось открыть компанию"><CompaniesPage /></ErrorBoundary></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/companies/:companyId/edit" element={<RoleAccess roles={companyManageRoles} loginPath="/staff/login"><StaffLayout><StaffAccess roles={companyManageRoles}><ErrorBoundary fallbackTitle="Не удалось открыть редактирование компании"><CompaniesPage /></ErrorBoundary></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/commercial-offers" element={<RoleAccess roles={['MANAGER', 'ADMIN']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'MANAGER']}><StaffCommercialOffersPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/contracts" element={<RoleAccess roles={['MANAGER', 'ADMIN', 'ACCOUNTANT']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'MANAGER', 'ACCOUNTANT']}><StaffContractsPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/tasks" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffTasksPage /></StaffLayout></RoleAccess>} />
        <Route path="/staff/documents" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffDocumentsPage /></StaffLayout></RoleAccess>} />
        <Route path="/staff/documents/:orderId" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffDocumentsPage /></StaffLayout></RoleAccess>} />
        <Route path="/staff/payments" element={<RoleAccess roles={['ADMIN', 'ACCOUNTANT']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'ACCOUNTANT']}><PaymentsPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/calendar" element={<RoleAccess roles={['ADMIN', 'LABORATORY', 'ECOLOGIST', 'MANAGER']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'LABORATORY', 'ECOLOGIST', 'MANAGER']}><StaffCalendarPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/protocols" element={<RoleAccess roles={protocolRoles} loginPath="/staff/login"><StaffLayout><StaffAccess roles={protocolRoles}><ErrorBoundary fallbackTitle="Не удалось открыть протоколы"><ProtocolsPage /></ErrorBoundary></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/protocols/create" element={<RoleAccess roles={protocolRoles} loginPath="/staff/login"><StaffLayout><StaffAccess roles={protocolRoles}><ErrorBoundary fallbackTitle="Не удалось открыть создание протокола"><QuickProtocolCreatePage /></ErrorBoundary></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/protocols/new" element={<RoleAccess roles={protocolRoles} loginPath="/staff/login"><StaffLayout><StaffAccess roles={protocolRoles}><ProtocolCreatePage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/protocols/:protocolId" element={<RoleAccess roles={protocolRoles} loginPath="/staff/login"><StaffLayout><StaffAccess roles={protocolRoles}><ErrorBoundary fallbackTitle="Не удалось открыть редактор протокола"><ProtocolEditorPage /></ErrorBoundary></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/protocols/:protocolId/edit" element={<RoleAccess roles={protocolRoles} loginPath="/staff/login"><StaffLayout><StaffAccess roles={protocolRoles}><ErrorBoundary fallbackTitle="Не удалось открыть редактор протокола"><ProtocolEditorPage /></ErrorBoundary></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/normatives" element={<RoleAccess roles={normativeRoles} loginPath="/staff/login"><StaffLayout><StaffAccess roles={normativeRoles}><NormativeDirectoryPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/measurement-devices" element={<RoleAccess roles={protocolRoles} loginPath="/staff/login"><StaffLayout><StaffAccess roles={protocolRoles}><MeasurementDevicesPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/journals" element={<RoleAccess roles={['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY']} loginPath="/staff/login" forbiddenMessage="Недостаточно прав для просмотра журналов"><StaffLayout><StaffAccess roles={['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY']}><ErrorBoundary fallbackTitle="Не удалось открыть журналы"><LabJournalsPage /></ErrorBoundary></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/settings/laboratories" element={<RoleAccess roles={['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY']}><ErrorBoundary fallbackTitle="Не удалось открыть настройки лаборатории"><LaboratorySettingsPage /></ErrorBoundary></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/settings/laboratory" element={<Navigate to="/staff/settings/laboratories" replace />} />
        <Route path="/staff/reports" element={<RoleAccess roles={['ADMIN', 'ACCOUNTANT']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'ACCOUNTANT']}><StaffReportsPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/user-roles" element={<RoleAccess roles={['ADMIN']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN']}><StaffUserRolesPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/notifications" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffNotificationsPage /></StaffLayout></RoleAccess>} />
        <Route path="/staff/profile" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffProfilePage /></StaffLayout></RoleAccess>} />
        <Route path="/dashboard/payments" element={<RoleAccess roles={['ADMIN', 'ACCOUNTANT']} loginPath="/staff/login"><StaffLayout><PaymentsPage /></StaffLayout></RoleAccess>} />

        <Route path="/admin" element={<RoleAccess roles={['ADMIN']} loginPath="/staff/login"><AdminLayout><AdminPage /></AdminLayout></RoleAccess>} />
        <Route path="/admin/users" element={<RoleAccess roles={['ADMIN']} loginPath="/staff/login"><AdminLayout><AdminUsersPage /></AdminLayout></RoleAccess>} />
        <Route path="*" element={<PublicLayout><NotFoundPage /></PublicLayout>} />
        </Routes>
        </Suspense>
      </div>
    </RouteProgressProvider>
  );
}

export default App;
