import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import CabinetLayout from './layouts/CabinetLayout';
import StaffLayout from './layouts/StaffLayout';
import AdminLayout from './layouts/AdminLayout';
import ScrollToTop from './components/ScrollToTop';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';
import SeoLandingPage from './pages/SeoLandingPage';
import ServiceLandingPage from './pages/ServiceLandingPage';
import ServiceDetailsPage from './pages/ServiceDetailsPage';
import EmployeesPage from './pages/EmployeesPage';
import PartnersPage from './pages/PartnersPage';
import TariffsPage from './pages/TariffsPage';
import NewsPage from './pages/NewsPage';
import NewsDetailsPage from './pages/NewsDetailsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FaqPage from './pages/FaqPage';
import ContactsPage from './pages/ContactsPage';
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';
import PaymentsPage from './pages/PaymentsPage';
import { useToast } from './hooks/useToast';
import { useAuth } from './contexts/AuthContext';
import type { ReactNode } from 'react';
import type { UserRole } from './types';
import { seoPages } from './data/seoPages';
import {
  CabinetCompanyPage,
  CabinetDashboardPage,
  CabinetDocumentsPage,
  CabinetNewOrderPage,
  CabinetNotificationsPage,
  CabinetOrderDetailsPage,
  CabinetOrdersPage,
  CabinetPaymentsPage,
} from './pages/CabinetPages';
import {
  StaffClientsPage,
  StaffCalendarPage,
  StaffCommercialOffersPage,
  StaffContractsPage,
  StaffDashboardPage,
  StaffDocumentsPage,
  StaffNewOrderPage,
  StaffNotificationsPage,
  StaffOrderDetailsPage,
  StaffOrdersPage,
  StaffProfilePage,
  StaffReportsPage,
  StaffTasksPage,
  StaffUserRolesPage,
} from './pages/StaffPages';

const allStaffRoles: UserRole[] = ['MANAGER', 'ADMIN', 'DIRECTOR', 'HEAD', 'ACCOUNTANT', 'ECOLOGIST', 'LABORATORY', 'WASTE_SPECIALIST'];

const StaffAccess = ({ roles, children }: { roles?: UserRole[]; children: ReactNode }) => {
  const { user } = useAuth();
  if (!roles || !user?.role || user.role === 'ADMIN' || roles.includes(user.role)) return <>{children}</>;
  return <StaffDashboardPage />;
};

const ForbiddenPage = () => (
  <div className="flex min-h-[60vh] items-center justify-center px-5">
    <div className="max-w-md rounded-[24px] bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-bold text-eco-900">Нет доступа</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">У вашей роли нет прав для открытия этого раздела.</p>
    </div>
  </div>
);

const RoleAccess = ({ roles, loginPath, children }: { roles: UserRole[]; loginPath: string; children: ReactNode }) => {
  const { user, loading, isAuthenticated } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to={loginPath} replace />;
  if (!user?.role || !roles.includes(user.role)) return <ForbiddenPage />;
  return <>{children}</>;
};

function App() {
  const toast = useToast();
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
    <div className="min-h-screen bg-eco-50 text-slate-900">
      <ScrollToTop />
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
        <Route path="/services/:id" element={<PublicLayout><ServiceDetailsPage /></PublicLayout>} />
        <Route path="/tariffs" element={<PublicLayout><TariffsPage /></PublicLayout>} />
        <Route path="/employees" element={<PublicLayout><EmployeesPage /></PublicLayout>} />
        <Route path="/partners" element={<PublicLayout><PartnersPage /></PublicLayout>} />
        <Route path="/news" element={<PublicLayout><NewsPage /></PublicLayout>} />
        <Route path="/news/:id" element={<PublicLayout><NewsDetailsPage /></PublicLayout>} />
        <Route path="/faq" element={<PublicLayout><FaqPage /></PublicLayout>} />
        <Route path="/contacts" element={<PublicLayout><ContactsPage /></PublicLayout>} />
        {seoPages.map((page) => (
          <Route key={page.slug} path={`/${page.slug}`} element={<PublicLayout><SeoLandingPage slug={page.slug} /></PublicLayout>} />
        ))}
        <Route path="/login" element={<LoginPage onSuccess={notify} />} />
        <Route path="/register" element={<RegisterPage onSuccess={notify} />} />
        <Route path="/staff/login" element={<LoginPage staff onSuccess={notify} />} />

        <Route path="/cabinet" element={<RoleAccess roles={['CLIENT', 'MANAGER', 'ADMIN']} loginPath="/login"><CabinetLayout><CabinetDashboardPage /></CabinetLayout></RoleAccess>} />
        <Route path="/cabinet/orders" element={<RoleAccess roles={['CLIENT', 'MANAGER', 'ADMIN']} loginPath="/login"><CabinetLayout><CabinetOrdersPage /></CabinetLayout></RoleAccess>} />
        <Route path="/cabinet/orders/new" element={<RoleAccess roles={['CLIENT', 'MANAGER', 'ADMIN']} loginPath="/login"><CabinetLayout><CabinetNewOrderPage onNotify={notify} /></CabinetLayout></RoleAccess>} />
        <Route path="/cabinet/orders/:id" element={<RoleAccess roles={['CLIENT', 'MANAGER', 'ADMIN']} loginPath="/login"><CabinetLayout><CabinetOrderDetailsPage onNotify={notify} /></CabinetLayout></RoleAccess>} />
        <Route path="/cabinet/documents" element={<RoleAccess roles={['CLIENT', 'MANAGER', 'ADMIN']} loginPath="/login"><CabinetLayout><CabinetDocumentsPage /></CabinetLayout></RoleAccess>} />
        <Route path="/cabinet/payments" element={<RoleAccess roles={['CLIENT', 'MANAGER', 'ADMIN']} loginPath="/login"><CabinetLayout><CabinetPaymentsPage /></CabinetLayout></RoleAccess>} />
        <Route path="/cabinet/company" element={<RoleAccess roles={['CLIENT', 'MANAGER', 'ADMIN']} loginPath="/login"><CabinetLayout><CabinetCompanyPage /></CabinetLayout></RoleAccess>} />
        <Route path="/cabinet/notifications" element={<RoleAccess roles={['CLIENT', 'MANAGER', 'ADMIN']} loginPath="/login"><CabinetLayout><CabinetNotificationsPage /></CabinetLayout></RoleAccess>} />

        <Route path="/staff" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffDashboardPage /></StaffLayout></RoleAccess>} />
        <Route path="/staff/orders" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffOrdersPage /></StaffLayout></RoleAccess>} />
        <Route path="/staff/orders/new" element={<RoleAccess roles={['MANAGER', 'ADMIN']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'MANAGER']}><StaffNewOrderPage onNotify={notify} /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/orders/company/:businessCompanyId" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffOrdersPage /></StaffLayout></RoleAccess>} />
        <Route path="/staff/orders/:id" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffOrderDetailsPage onNotify={notify} /></StaffLayout></RoleAccess>} />
        <Route path="/staff/clients" element={<RoleAccess roles={['MANAGER', 'ADMIN']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'MANAGER']}><StaffClientsPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/clients/:companyKey" element={<RoleAccess roles={['MANAGER', 'ADMIN']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'MANAGER']}><StaffClientsPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/commercial-offers" element={<RoleAccess roles={['MANAGER', 'ADMIN']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'MANAGER']}><StaffCommercialOffersPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/contracts" element={<RoleAccess roles={['MANAGER', 'ADMIN', 'ACCOUNTANT']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'MANAGER', 'ACCOUNTANT']}><StaffContractsPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/tasks" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffTasksPage /></StaffLayout></RoleAccess>} />
        <Route path="/staff/documents" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffDocumentsPage /></StaffLayout></RoleAccess>} />
        <Route path="/staff/documents/:orderId" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffDocumentsPage /></StaffLayout></RoleAccess>} />
        <Route path="/staff/payments" element={<RoleAccess roles={['ADMIN', 'ACCOUNTANT']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'ACCOUNTANT']}><PaymentsPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/calendar" element={<RoleAccess roles={['ADMIN', 'LABORATORY', 'ECOLOGIST', 'MANAGER']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'LABORATORY', 'ECOLOGIST', 'MANAGER']}><StaffCalendarPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/reports" element={<RoleAccess roles={['ADMIN', 'ACCOUNTANT']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN', 'ACCOUNTANT']}><StaffReportsPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/user-roles" element={<RoleAccess roles={['ADMIN']} loginPath="/staff/login"><StaffLayout><StaffAccess roles={['ADMIN']}><StaffUserRolesPage /></StaffAccess></StaffLayout></RoleAccess>} />
        <Route path="/staff/notifications" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffNotificationsPage /></StaffLayout></RoleAccess>} />
        <Route path="/staff/profile" element={<RoleAccess roles={allStaffRoles} loginPath="/staff/login"><StaffLayout><StaffProfilePage /></StaffLayout></RoleAccess>} />
        <Route path="/dashboard/payments" element={<RoleAccess roles={['ADMIN', 'ACCOUNTANT']} loginPath="/staff/login"><StaffLayout><PaymentsPage /></StaffLayout></RoleAccess>} />

        <Route path="/admin" element={<RoleAccess roles={['ADMIN']} loginPath="/staff/login"><AdminLayout><AdminPage /></AdminLayout></RoleAccess>} />
        <Route path="*" element={<PublicLayout><NotFoundPage /></PublicLayout>} />
      </Routes>
    </div>
  );
}

export default App;
