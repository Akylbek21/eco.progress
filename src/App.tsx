import { Route, Routes } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import CabinetLayout from './layouts/CabinetLayout';
import StaffLayout from './layouts/StaffLayout';
import AdminLayout from './layouts/AdminLayout';
import ScrollToTop from './components/ScrollToTop';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';
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

const StaffAccess = ({ roles, children }: { roles?: UserRole[]; children: ReactNode }) => {
  const { user } = useAuth();
  if (!roles || !user?.role || user.role === 'ADMIN' || roles.includes(user.role)) return <>{children}</>;
  return <StaffDashboardPage />;
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
        <Route path="/login" element={<LoginPage onSuccess={notify} />} />
        <Route path="/register" element={<RegisterPage onSuccess={notify} />} />
        <Route path="/staff/login" element={<LoginPage staff onSuccess={notify} />} />

        <Route path="/cabinet" element={<CabinetLayout><CabinetDashboardPage /></CabinetLayout>} />
        <Route path="/cabinet/orders" element={<CabinetLayout><CabinetOrdersPage /></CabinetLayout>} />
        <Route path="/cabinet/orders/new" element={<CabinetLayout><CabinetNewOrderPage onNotify={notify} /></CabinetLayout>} />
        <Route path="/cabinet/orders/:id" element={<CabinetLayout><CabinetOrderDetailsPage onNotify={notify} /></CabinetLayout>} />
        <Route path="/cabinet/documents" element={<CabinetLayout><CabinetDocumentsPage /></CabinetLayout>} />
        <Route path="/cabinet/payments" element={<CabinetLayout><CabinetPaymentsPage /></CabinetLayout>} />
        <Route path="/cabinet/company" element={<CabinetLayout><CabinetCompanyPage /></CabinetLayout>} />
        <Route path="/cabinet/notifications" element={<CabinetLayout><CabinetNotificationsPage /></CabinetLayout>} />

        <Route path="/staff" element={<StaffLayout><StaffDashboardPage /></StaffLayout>} />
        <Route path="/staff/orders" element={<StaffLayout><StaffOrdersPage /></StaffLayout>} />
        <Route path="/staff/orders/new" element={<StaffLayout><StaffAccess roles={['ADMIN', 'DIRECTOR', 'HEAD', 'MANAGER']}><StaffNewOrderPage onNotify={notify} /></StaffAccess></StaffLayout>} />
        <Route path="/staff/orders/company/:businessCompanyId" element={<StaffLayout><StaffOrdersPage /></StaffLayout>} />
        <Route path="/staff/orders/:id" element={<StaffLayout><StaffOrderDetailsPage onNotify={notify} /></StaffLayout>} />
        <Route path="/staff/clients" element={<StaffLayout><StaffAccess roles={['ADMIN', 'DIRECTOR', 'HEAD', 'MANAGER']}><StaffClientsPage /></StaffAccess></StaffLayout>} />
        <Route path="/staff/clients/:companyKey" element={<StaffLayout><StaffAccess roles={['ADMIN', 'DIRECTOR', 'HEAD', 'MANAGER']}><StaffClientsPage /></StaffAccess></StaffLayout>} />
        <Route path="/staff/commercial-offers" element={<StaffLayout><StaffAccess roles={['ADMIN', 'DIRECTOR', 'HEAD', 'MANAGER']}><StaffCommercialOffersPage /></StaffAccess></StaffLayout>} />
        <Route path="/staff/contracts" element={<StaffLayout><StaffAccess roles={['ADMIN', 'DIRECTOR', 'HEAD', 'MANAGER', 'ACCOUNTANT']}><StaffContractsPage /></StaffAccess></StaffLayout>} />
        <Route path="/staff/tasks" element={<StaffLayout><StaffTasksPage /></StaffLayout>} />
        <Route path="/staff/documents" element={<StaffLayout><StaffDocumentsPage /></StaffLayout>} />
        <Route path="/staff/documents/:orderId" element={<StaffLayout><StaffDocumentsPage /></StaffLayout>} />
        <Route path="/staff/payments" element={<StaffLayout><StaffAccess roles={['ADMIN', 'DIRECTOR', 'HEAD', 'ACCOUNTANT']}><PaymentsPage /></StaffAccess></StaffLayout>} />
        <Route path="/staff/calendar" element={<StaffLayout><StaffAccess roles={['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY', 'WASTE_SPECIALIST']}><StaffCalendarPage /></StaffAccess></StaffLayout>} />
        <Route path="/staff/reports" element={<StaffLayout><StaffAccess roles={['ADMIN', 'DIRECTOR', 'HEAD', 'ACCOUNTANT']}><StaffReportsPage /></StaffAccess></StaffLayout>} />
        <Route path="/staff/user-roles" element={<StaffLayout><StaffAccess roles={['ADMIN', 'DIRECTOR', 'HEAD']}><StaffUserRolesPage /></StaffAccess></StaffLayout>} />
        <Route path="/staff/notifications" element={<StaffLayout><StaffNotificationsPage /></StaffLayout>} />
        <Route path="/staff/profile" element={<StaffLayout><StaffProfilePage /></StaffLayout>} />
        <Route path="/dashboard/payments" element={<StaffLayout><PaymentsPage /></StaffLayout>} />

        <Route path="/admin" element={<AdminLayout><AdminPage /></AdminLayout>} />
        <Route path="*" element={<PublicLayout><NotFoundPage /></PublicLayout>} />
      </Routes>
    </div>
  );
}

export default App;
