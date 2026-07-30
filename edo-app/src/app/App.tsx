import { lazy, Suspense, type ComponentType } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { PublicSigningLayout } from '../layouts/PublicSigningLayout';
import { EdoAppLayout } from '../layouts/EdoAppLayout';
import { AppGuard, AuthenticatedGuard, PermissionGuard } from './router/guards';
import { FullScreenLoader } from '../shared/components/QueryState';
import {
  DocumentEditorErrorBoundary,
  RouteErrorBoundary,
  SigningErrorBoundary,
} from '../shared/components/AppErrorBoundary';

const lazyNamed = <T extends Record<string, unknown>, K extends keyof T>(loader: () => Promise<T>, key: K) =>
  lazy(() => loader().then((module) => ({ default: module[key] as ComponentType<Record<string, unknown>> })));

const LoginPage = lazyNamed(() => import('../features/auth/pages/LoginPage'), 'LoginPage');
const RegistrationPage = lazyNamed(() => import('../features/registration/pages/RegistrationPage'), 'RegistrationPage');
const VerifyEmailPage = lazyNamed(() => import('../features/auth/pages/RecoveryPages'), 'VerifyEmailPage');
const ForgotPasswordPage = lazyNamed(() => import('../features/auth/pages/RecoveryPages'), 'ForgotPasswordPage');
const ResetPasswordPage = lazyNamed(() => import('../features/auth/pages/RecoveryPages'), 'ResetPasswordPage');
const InvitationPage = lazyNamed(() => import('../features/invitations/pages/InvitationPage'), 'InvitationPage');
const ExternalSigningPage = lazyNamed(() => import('../features/signing/pages/ExternalSigningPage'), 'ExternalSigningPage');
const OrganizationSelectorPage = lazyNamed(() => import('../features/organizations/pages/OrganizationPages'), 'OrganizationSelectorPage');
const OnboardingPage = lazyNamed(() => import('../features/organizations/pages/OrganizationPages'), 'OnboardingPage');
const DashboardPage = lazyNamed(() => import('../features/documents/pages/DashboardPage'), 'DashboardPage');
const DocumentsPage = lazyNamed(() => import('../features/documents/pages/DocumentsPage'), 'DocumentsPage');
const CreateDocumentPage = lazyNamed(() => import('../features/documents/pages/CreateDocumentPage'), 'CreateDocumentPage');
const DocumentDetailsPage = lazyNamed(() => import('../features/documents/pages/DocumentDetailsPage'), 'DocumentDetailsPage');
const ManagementPage = lazyNamed(() => import('../features/management/pages/ManagementPage'), 'ManagementPage');
const AccessDeniedPage = lazyNamed(() => import('../features/auth/pages/StatusPages'), 'AccessDeniedPage');
const SessionExpiredPage = lazyNamed(() => import('../features/auth/pages/StatusPages'), 'SessionExpiredPage');
const ResendVerificationPage = lazyNamed(() => import('../features/auth/pages/StatusPages'), 'ResendVerificationPage');
const TermsPage = lazyNamed(() => import('../features/auth/pages/StatusPages'), 'TermsPage');
const PrivacyPage = lazyNamed(() => import('../features/auth/pages/StatusPages'), 'PrivacyPage');

const management = (resource: string, title: string, description: string) =>
  <ManagementPage resource={resource} title={title} description={description} />;

const LegacyAppRedirect = () => {
  const { pathname, search, hash } = useLocation();
  const legacy = pathname.replace(/^\/app\/?/, '');
  const mappings: Array<[string, string]> = [
    ['requires-my-signature', 'documents/waiting-for-me'],
    ['incoming', 'documents/incoming'],
    ['outgoing', 'documents/outgoing'],
    ['drafts', 'documents/drafts'],
    ['archive', 'documents/archive'],
  ];
  const match = mappings.find(([prefix]) => legacy === prefix || legacy.startsWith(`${prefix}/`));
  const target = match
    ? `/${legacy.replace(match[0], match[1])}`
    : `/${legacy || 'dashboard'}`;
  return <Navigate to={`${target}${search}${hash}`} replace />;
};

export const App = () => (
  <RouteErrorBoundary>
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<Navigate to="/register/organization" replace />} />
        <Route path="/register/organization" element={<RegistrationPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/resend-verification" element={<ResendVerificationPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/invitations/:token" element={<InvitationPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/access-denied" element={<AccessDeniedPage />} />
        <Route path="/session-expired" element={<SessionExpiredPage />} />
      </Route>
      <Route element={<PublicSigningLayout />}>
        <Route path="/external-sign/:token" element={<SigningErrorBoundary><ExternalSigningPage /></SigningErrorBoundary>} />
      </Route>

      <Route element={<AuthenticatedGuard />}>
        <Route path="/select-organization" element={<OrganizationSelectorPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<AppGuard />}>
          <Route element={<EdoAppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents/incoming" element={<DocumentsPage />} />
            <Route path="/documents/incoming/:documentType" element={<DocumentsPage />} />
            <Route path="/documents/outgoing" element={<DocumentsPage />} />
            <Route path="/documents/outgoing/:documentType" element={<DocumentsPage />} />
            <Route path="/documents/waiting-for-me" element={<DocumentsPage />} />
            <Route path="/documents/drafts" element={<DocumentsPage />} />
            <Route path="/documents/completed" element={<DocumentsPage />} />
            <Route path="/documents/archive" element={<DocumentsPage />} />
            <Route path="/documents/create" element={<PermissionGuard permission="DOCUMENT_CREATE"><DocumentEditorErrorBoundary><CreateDocumentPage /></DocumentEditorErrorBoundary></PermissionGuard>} />
            <Route path="/documents/:documentId" element={<DocumentEditorErrorBoundary><DocumentDetailsPage /></DocumentEditorErrorBoundary>} />
            <Route path="/documents/:documentId/sign" element={<SigningErrorBoundary><DocumentDetailsPage initialTab={1} openSigning /></SigningErrorBoundary>} />
            <Route path="/documents/:documentId/history" element={<DocumentEditorErrorBoundary><DocumentDetailsPage initialTab={4} /></DocumentEditorErrorBoundary>} />
            <Route path="/documents/:documentId/versions" element={<DocumentEditorErrorBoundary><DocumentDetailsPage initialTab={5} /></DocumentEditorErrorBoundary>} />
            <Route path="/revocation-requests" element={management('revocation-requests', 'Запросы на отзыв', 'Входящие и исходящие запросы на отзыв документов.')} />
            <Route path="/revocation-requests/:requestId" element={management('revocation-requests', 'Запрос на отзыв', 'Подтверждение или отклонение выполняется только через backend actions.')} />
            <Route path="/counterparties" element={management('counterparties', 'Контрагенты', 'Организации, представители и приглашения в ЭДО.')} />
            <Route path="/counterparties/:counterpartyId" element={management('counterparties', 'Контрагент', 'Карточка и связанные документы контрагента.')} />
            <Route path="/members" element={<PermissionGuard permission="MEMBER_VIEW">{management('members', 'Сотрудники', 'Участники активной организации.')}</PermissionGuard>} />
            <Route path="/invitations" element={<PermissionGuard permission="MEMBER_INVITE">{management('invitations', 'Приглашения', 'Активные, истёкшие и принятые приглашения.')}</PermissionGuard>} />
            <Route path="/templates" element={<PermissionGuard permission="TEMPLATE_MANAGE">{management('templates', 'Шаблоны', 'Шаблоны документов активной организации.')}</PermissionGuard>} />
            <Route path="/audit" element={<PermissionGuard permission="AUDIT_VIEW">{management('audit', 'Журнал действий', 'Неизменяемые события организации.')}</PermissionGuard>} />
            <Route path="/settings" element={management('settings/profile', 'Профиль', 'Личные данные пользователя.')} />
            <Route path="/settings/organization" element={<PermissionGuard permission="ORGANIZATION_MANAGE">{management('settings/organization', 'Организация', 'Реквизиты и профиль активной организации.')}</PermissionGuard>} />
            <Route path="/settings/security" element={management('settings/security', 'Безопасность', 'Пароль, MFA и политика доступа.')} />
            <Route path="/settings/notifications" element={management('settings/notifications', 'Уведомления', 'Каналы и события уведомлений.')} />
            <Route path="/sessions" element={management('settings/sessions', 'Сессии', 'Устройства, IP и последняя активность.')} />
          </Route>
        </Route>
      </Route>
      <Route path="/app/*" element={<LegacyAppRedirect />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  </RouteErrorBoundary>
);
