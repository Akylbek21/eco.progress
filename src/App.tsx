import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import CabinetLayout from './layouts/CabinetLayout';
import AdminLayout from './layouts/AdminLayout';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';
import ServiceDetailsPage from './pages/ServiceDetailsPage';
import EmployeesPage from './pages/EmployeesPage';
import NewsPage from './pages/NewsPage';
import NewsDetailsPage from './pages/NewsDetailsPage';
import LoginPage from './pages/LoginPage';
import CabinetPage from './pages/CabinetPage';
import AdminPage from './pages/AdminPage';

function App() {
  const [toast, setToast] = useState<string | null>(null);
  const message = toast;

  return (
    <div className="min-h-screen bg-eco-50 text-slate-900">
      <Routes>
        <Route path="/" element={<PublicLayout><HomePage /></PublicLayout>} />
        <Route path="/about" element={<PublicLayout><AboutPage /></PublicLayout>} />
        <Route path="/services" element={<PublicLayout><ServicesPage /></PublicLayout>} />
        <Route path="/services/:id" element={<PublicLayout><ServiceDetailsPage /></PublicLayout>} />
        <Route path="/employees" element={<PublicLayout><EmployeesPage /></PublicLayout>} />
        <Route path="/news" element={<PublicLayout><NewsPage /></PublicLayout>} />
        <Route path="/news/:id" element={<PublicLayout><NewsDetailsPage /></PublicLayout>} />
        <Route path="/login" element={<LoginPage onSuccess={() => setToast('Успешный вход. Добро пожаловать!')} />} />
        <Route path="/cabinet" element={<CabinetLayout><CabinetPage onNotify={(text) => setToast(text)} /></CabinetLayout>} />
        <Route path="/admin" element={<AdminLayout><AdminPage onNotify={(text) => setToast(text)} /></AdminLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {message && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-2xl shadow-slate-900/10">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-900">{message}</p>
            <button
              type="button"
              className="text-slate-500 hover:text-slate-800"
              onClick={() => setToast(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
