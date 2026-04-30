import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import CabinetLayout from './layouts/CabinetLayout';
import StaffLayout from './layouts/StaffLayout';
import AdminLayout from './layouts/AdminLayout';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';
import ServiceDetailsPage from './pages/ServiceDetailsPage';
import EmployeesPage from './pages/EmployeesPage';
import TariffsPage from './pages/TariffsPage';
import NewsPage from './pages/NewsPage';
import NewsDetailsPage from './pages/NewsDetailsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FaqPage from './pages/FaqPage';
import ContactsPage from './pages/ContactsPage';
import AdminPage from './pages/AdminPage';
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
  StaffDashboardPage,
  StaffDocumentsPage,
  StaffNotificationsPage,
  StaffOrderDetailsPage,
  StaffOrdersPage,
  StaffProfilePage,
} from './pages/StaffPages';

function App() {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  return (
    <div className="min-h-screen bg-eco-50 text-slate-900">
      <Routes>
        <Route path="/" element={<PublicLayout><HomePage /></PublicLayout>} />
        <Route path="/about" element={<PublicLayout><AboutPage /></PublicLayout>} />
        <Route path="/services" element={<PublicLayout><ServicesPage /></PublicLayout>} />
        <Route path="/services/:id" element={<PublicLayout><ServiceDetailsPage /></PublicLayout>} />
        <Route path="/tariffs" element={<PublicLayout><TariffsPage /></PublicLayout>} />
        <Route path="/employees" element={<PublicLayout><EmployeesPage /></PublicLayout>} />
        <Route path="/news" element={<PublicLayout><NewsPage /></PublicLayout>} />
        <Route path="/news/:id" element={<PublicLayout><NewsDetailsPage /></PublicLayout>} />
        <Route path="/faq" element={<PublicLayout><FaqPage /></PublicLayout>} />
        <Route path="/contacts" element={<PublicLayout><ContactsPage /></PublicLayout>} />
        <Route path="/login" element={<LoginPage onSuccess={setToast} />} />
        <Route path="/register" element={<RegisterPage onSuccess={setToast} />} />
        <Route path="/staff/login" element={<LoginPage staff onSuccess={setToast} />} />

        <Route path="/cabinet" element={<CabinetLayout><CabinetDashboardPage /></CabinetLayout>} />
        <Route path="/cabinet/orders" element={<CabinetLayout><CabinetOrdersPage /></CabinetLayout>} />
        <Route path="/cabinet/orders/new" element={<CabinetLayout><CabinetNewOrderPage onNotify={setToast} /></CabinetLayout>} />
        <Route path="/cabinet/orders/:id" element={<CabinetLayout><CabinetOrderDetailsPage onNotify={setToast} /></CabinetLayout>} />
        <Route path="/cabinet/documents" element={<CabinetLayout><CabinetDocumentsPage /></CabinetLayout>} />
        <Route path="/cabinet/payments" element={<CabinetLayout><CabinetPaymentsPage /></CabinetLayout>} />
        <Route path="/cabinet/company" element={<CabinetLayout><CabinetCompanyPage /></CabinetLayout>} />
        <Route path="/cabinet/notifications" element={<CabinetLayout><CabinetNotificationsPage /></CabinetLayout>} />

        <Route path="/staff" element={<StaffLayout><StaffDashboardPage /></StaffLayout>} />
        <Route path="/staff/orders" element={<StaffLayout><StaffOrdersPage /></StaffLayout>} />
        <Route path="/staff/orders/:id" element={<StaffLayout><StaffOrderDetailsPage onNotify={setToast} /></StaffLayout>} />
        <Route path="/staff/clients" element={<StaffLayout><StaffClientsPage /></StaffLayout>} />
        <Route path="/staff/documents" element={<StaffLayout><StaffDocumentsPage /></StaffLayout>} />
        <Route path="/staff/notifications" element={<StaffLayout><StaffNotificationsPage /></StaffLayout>} />
        <Route path="/staff/profile" element={<StaffLayout><StaffProfilePage /></StaffLayout>} />

        <Route path="/admin" element={<AdminLayout><AdminPage /></AdminLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-[20px] border border-slate-200 bg-white px-5 py-4 shadow-2xl shadow-eco-900/15">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-slate-800">{toast}</p>
            <button type="button" className="text-slate-500 hover:text-slate-900" onClick={() => setToast(null)}>x</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
