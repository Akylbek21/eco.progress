export type EdoRole =
  | 'OWNER'
  | 'ORGANIZATION_ADMIN'
  | 'DOCUMENT_MANAGER'
  | 'SIGNER'
  | 'ACCOUNTANT'
  | 'VIEWER'
  | 'EXTERNAL_SIGNER'
  | string;

export type Permission =
  | 'ORGANIZATION_MANAGE'
  | 'MEMBER_VIEW'
  | 'MEMBER_INVITE'
  | 'MEMBER_MANAGE'
  | 'DOCUMENT_CREATE'
  | 'DOCUMENT_VIEW'
  | 'DOCUMENT_VIEW_ALL'
  | 'DOCUMENT_EDIT'
  | 'DOCUMENT_DELETE_DRAFT'
  | 'DOCUMENT_SEND'
  | 'DOCUMENT_SIGN'
  | 'DOCUMENT_REJECT'
  | 'DOCUMENT_REVOKE'
  | 'DOCUMENT_ARCHIVE'
  | 'COUNTERPARTY_MANAGE'
  | 'TEMPLATE_MANAGE'
  | 'AUDIT_VIEW'
  | 'SETTINGS_MANAGE'
  | string;

export interface EdoUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone?: string;
  emailVerified: boolean;
}

export interface OrganizationMembership {
  organizationId: string;
  organizationName: string;
  binMasked: string;
  role: EdoRole;
  status: string;
  permissions: Permission[];
}

export interface AuthSession {
  user: EdoUser;
  organizations: OrganizationMembership[];
  activeOrganizationId?: string;
  onboardingComplete: boolean;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
