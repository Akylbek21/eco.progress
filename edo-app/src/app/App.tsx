import { lazy, Suspense, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { PublicSigningLayout } from '../layouts/PublicSigningLayout';
import { EdoAppLayout } from '../layouts/EdoAppLayout';
import { AppGuard, AuthenticatedGuard, PermissionGuard } from './router/guards';
import { FullScreenLoader } from '../shared/components/QueryState';

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

const management = (resource: string, title: string, description: string, createLabel?: string) =>
  <ManagementPage resource={resource} title={title} description={description} createLabel={createLabel} />;

export const App = () => (
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
      <Route element={<PublicSigningLayout />}><Route path="/external-sign/:token" element={<ExternalSigningPage />} /></Route>

      <Route element={<AuthenticatedGuard />}>
        <Route path="/select-organization" element={<OrganizationSelectorPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<AppGuard />}>
          <Route element={<EdoAppLayout />}>
            <Route path="/app/dashboard" element={<DashboardPage />} />
            <Route path="/app/incoming" element={<DocumentsPage />} />
            <Route path="/app/incoming/:documentType" element={<DocumentsPage />} />
            <Route path="/app/outgoing" element={<DocumentsPage />} />
            <Route path="/app/outgoing/:documentType" element={<DocumentsPage />} />
            <Route path="/app/requires-my-signature" element={<DocumentsPage />} />
            <Route path="/app/drafts" element={<DocumentsPage />} />
            <Route path="/app/archive" element={<DocumentsPage />} />
            <Route path="/app/documents/create" element={<PermissionGuard permission="DOCUMENT_CREATE"><CreateDocumentPage /></PermissionGuard>} />
            <Route path="/app/documents/:documentId" element={<DocumentDetailsPage />} />
            <Route path="/app/documents/:documentId/sign" element={<DocumentDetailsPage initialTab={1} openSigning />} />
            <Route path="/app/documents/:documentId/history" element={<DocumentDetailsPage initialTab={4} />} />
            <Route path="/app/documents/:documentId/versions" element={<DocumentDetailsPage initialTab={5} />} />
            <Route path="/app/revocation-requests" element={management('revocation-requests', 'Запросы на отзыв', 'Входящие и исходящие запросы на отзыв документов.', 'Создать запрос')} />
            <Route path="/app/revocation-requests/:requestId" element={management('revocation-requests', 'Запрос на отзыв', 'Подтверждение или отклонение выполняется только через backend actions.')} />
            <Route path="/app/counterparties" element={management('counterparties', 'Контрагенты', 'Организации, представители и приглашения в ЭДО.', 'Добавить контрагента')} />
            <Route path="/app/counterparties/:counterpartyId" element={management('counterparties', 'Контрагент', 'Карточка и связанные документы контрагента.')} />
            <Route path="/app/members" element={<PermissionGuard permission="MEMBER_VIEW">{management('members', 'Сотрудники', 'Участники активной организации.', 'Пригласить сотрудника')}</PermissionGuard>} />
            <Route path="/app/invitations" element={<PermissionGuard permission="MEMBER_INVITE">{management('invitations', 'Приглашения', 'Активные, истёкшие и принятые приглашения.', 'Новое приглашение')}</PermissionGuard>} />
            <Route path="/app/templates" element={<PermissionGuard permission="TEMPLATE_MANAGE">{management('templates', 'Шаблоны', 'Шаблоны документов активной организации.', 'Создать шаблон')}</PermissionGuard>} />
            <Route path="/app/audit" element={<PermissionGuard permission="AUDIT_VIEW">{management('audit', 'Журнал действий', 'Неизменяемые события организации.')}</PermissionGuard>} />
            <Route path="/app/settings/profile" element={management('settings/profile', 'Профиль', 'Личные данные пользователя.')} />
            <Route path="/app/settings/organization" element={<PermissionGuard permission="ORGANIZATION_MANAGE">{management('settings/organization', 'Организация', 'Реквизиты и профиль активной организации.')}</PermissionGuard>} />
            <Route path="/app/settings/security" element={management('settings/security', 'Безопасность', 'Пароль, MFA и политика доступа.')} />
            <Route path="/app/settings/notifications" element={management('settings/notifications', 'Уведомления', 'Каналы и события уведомлений.')} />
            <Route path="/app/settings/sessions" element={management('settings/sessions', 'Сессии', 'Устройства, IP и последняя активность.')} />
          </Route>
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </Suspense>
);
