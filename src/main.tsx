import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from './components/ui/ToastProvider';
import PublicApplication from './PublicApplication';
import './index.css';

console.info('[EcoProgress build]', __BUILD_INFO__);

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

const privatePrefixes = ['/cabinet', '/client', '/staff', '/admin', '/dashboard', '/login', '/register', '/reset-password', '/internal', '/crm'];
const isPrivateRuntime = privatePrefixes.some((prefix) => window.location.pathname === prefix || window.location.pathname.startsWith(`${prefix}/`));

const bootstrap = async () => {
  let runtime: React.ReactNode;
  if (isPrivateRuntime) {
    const [{ default: App }, { AuthProvider }, { default: QueryRuntime }] = await Promise.all([
      import('./App'),
      import('./contexts/AuthContext'),
      import('./runtime/QueryRuntime'),
    ]);
    runtime = <QueryRuntime><AuthProvider><App /></AuthProvider></QueryRuntime>;
    runtime = <ToastProvider>{runtime}</ToastProvider>;
  }

  const application = (
    <React.StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {isPrivateRuntime ? runtime : <PublicApplication />}
      </BrowserRouter>
    </React.StrictMode>
  );

  if (!isPrivateRuntime && root.dataset.prerendered === 'true' && root.hasChildNodes()) {
    hydrateRoot(root, application);
  } else {
    if (isPrivateRuntime && root.hasChildNodes()) {
      root.replaceChildren();
      root.removeAttribute('data-prerendered');
    }
    createRoot(root).render(application);
  }
};

void bootstrap();
