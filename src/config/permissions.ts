import type { UserRole } from '../types';

export type Permission =
  | 'view_companies'
  | 'view_orders'
  | 'create_order'
  | 'edit_order'
  | 'delete_orders'
  | 'view_payment'
  | 'edit_payment'
  | 'view_ecology'
  | 'edit_ecology'
  | 'view_laboratory'
  | 'edit_laboratory'
  | 'view_waste'
  | 'edit_waste'
  | 'view_commercial_offers'
  | 'edit_commercial_offers'
  | 'view_contracts'
  | 'edit_contracts'
  | 'view_calendar'
  | 'view_tasks'
  | 'edit_tasks'
  | 'view_documents'
  | 'edit_documents'
  | 'view_messages'
  | 'send_messages'
  | 'view_internal_notes'
  | 'add_internal_notes'
  | 'view_action_history'
  | 'manage_employees'
  | 'manage_roles'
  | 'manage_settings'
  | 'view_content'
  | 'edit_content'
  | 'review_content_expert'
  | 'review_content_legal'
  | 'review_content_seo'
  | 'publish_content'
  | 'manage_content'
  | 'view_pek'
  | 'edit_pek'
  | 'PEK_VIEW'
  | 'PEK_PROGRAM_CREATE'
  | 'PEK_PROGRAM_EDIT'
  | 'PEK_PROGRAM_ACTIVATE'
  | 'PEK_PROGRAM_ARCHIVE'
  | 'PEK_REPORT_CREATE'
  | 'PEK_REPORT_EDIT'
  | 'PEK_REPORT_COLLECT'
  | 'PEK_REPORT_VALIDATE'
  | 'PEK_REPORT_REVIEW'
  | 'PEK_REPORT_RETURN'
  | 'PEK_REPORT_APPROVE'
  | 'PEK_REPORT_SIGN'
  | 'PEK_REPORT_SUBMIT'
  | 'PEK_REPORT_EXPORT'
  | 'PEK_ADMIN'
  | 'view_protocols'
  | 'create_protocols';

const staffBase: Permission[] = [
  'view_companies',
  'view_orders',
  'view_ecology',
  'view_laboratory',
  'view_documents',
  'view_messages',
  'view_internal_notes',
  'add_internal_notes',
  'view_action_history',
  'view_protocols',
  'view_content',
];

export const rolePermissions: Record<UserRole, Permission[]> = {
  CLIENT: [],
  ADMIN: [
    ...staffBase,
    'create_order',
    'edit_order',
    'delete_orders',
    'view_payment',
    'edit_payment',
    'view_commercial_offers',
    'edit_commercial_offers',
    'view_contracts',
    'edit_contracts',
    'edit_ecology',
    'edit_laboratory',
    'view_waste',
    'edit_waste',
    'view_calendar',
    'view_tasks',
    'edit_tasks',
    'edit_documents',
    'send_messages',
    'manage_employees',
    'manage_roles',
    'manage_settings',
    'create_protocols',
    'edit_content',
    'review_content_expert',
    'review_content_legal',
    'review_content_seo',
    'publish_content',
    'manage_content',
  ],
  DIRECTOR: [
    ...staffBase,
    'create_order',
    'edit_order',
    'view_payment',
    'view_commercial_offers',
    'view_contracts',
    'view_waste',
    'view_calendar',
    'view_tasks',
    'manage_employees',
    'review_content_expert',
    'review_content_seo',
    'publish_content',
    'create_protocols',
  ],
  HEAD: [
    ...staffBase,
    'create_order',
    'edit_order',
    'view_payment',
    'view_commercial_offers',
    'view_contracts',
    'view_waste',
    'view_calendar',
    'view_tasks',
    'manage_employees',
    'review_content_expert',
    'publish_content',
  ],
  MANAGER: [
    ...staffBase,
    'create_order',
    'edit_order',
    'edit_documents',
    'view_commercial_offers',
    'edit_commercial_offers',
    'view_contracts',
    'edit_contracts',
    'view_tasks',
    'edit_tasks',
    'send_messages',
    'edit_content',
    'review_content_seo',
  ],
  ACCOUNTANT: [
    ...staffBase,
    'view_payment',
    'edit_payment',
    'view_contracts',
    'edit_contracts',
    'view_tasks',
    'edit_documents',
  ],
  ECOLOGIST: [
    ...staffBase,
    'edit_ecology',
    'view_tasks',
    'edit_tasks',
    'edit_documents',
    'review_content_expert',
  ],
  LABORATORY: [
    ...staffBase,
    'edit_laboratory',
    'view_calendar',
    'view_tasks',
    'edit_tasks',
    'edit_documents',
  ],
  WASTE_SPECIALIST: [
    ...staffBase,
    'view_waste',
    'edit_waste',
    'view_calendar',
    'view_tasks',
    'edit_tasks',
    'edit_documents',
    'create_protocols',
  ],
  STAFF: [...staffBase],
};

export const canAccess = (role: UserRole | undefined, permission: Permission) => {
  if (!role) return false;
  return rolePermissions[role]?.includes(permission) ?? false;
};

const pekViewRoles: UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD', 'ECOLOGIST', 'LABORATORY', 'WASTE_SPECIALIST'];
const pekEditRoles: UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD', 'ECOLOGIST', 'WASTE_SPECIALIST'];
const pekPermissionRoles: Partial<Record<Permission, UserRole[]>> = {
  PEK_VIEW: pekViewRoles,
  PEK_PROGRAM_CREATE: ['ADMIN', 'DIRECTOR', 'HEAD', 'ECOLOGIST'],
  PEK_PROGRAM_EDIT: ['ADMIN', 'DIRECTOR', 'HEAD', 'ECOLOGIST'],
  PEK_PROGRAM_ACTIVATE: ['ADMIN', 'DIRECTOR', 'HEAD'],
  PEK_PROGRAM_ARCHIVE: ['ADMIN', 'DIRECTOR', 'HEAD'],
  PEK_REPORT_CREATE: ['ADMIN', 'DIRECTOR', 'HEAD', 'ECOLOGIST'],
  PEK_REPORT_EDIT: ['ADMIN', 'DIRECTOR', 'HEAD', 'ECOLOGIST'],
  PEK_REPORT_COLLECT: ['ADMIN', 'DIRECTOR', 'HEAD', 'ECOLOGIST', 'LABORATORY'],
  PEK_REPORT_VALIDATE: ['ADMIN', 'DIRECTOR', 'HEAD', 'ECOLOGIST'],
  PEK_REPORT_REVIEW: ['ADMIN', 'DIRECTOR', 'HEAD'],
  PEK_REPORT_RETURN: ['ADMIN', 'DIRECTOR', 'HEAD'],
  PEK_REPORT_APPROVE: ['ADMIN', 'DIRECTOR'],
  PEK_REPORT_SIGN: ['ADMIN', 'DIRECTOR'],
  PEK_REPORT_SUBMIT: ['ADMIN', 'DIRECTOR', 'HEAD', 'ECOLOGIST'],
  PEK_REPORT_EXPORT: pekViewRoles,
  PEK_ADMIN: ['ADMIN'],
};

export const hasPermission = (
  user: { role?: UserRole; permissions?: string[] } | null | undefined,
  permission: Permission | string,
) => {
  if (!user?.role) return false;
  if (Array.isArray(user.permissions)) return user.permissions.includes(permission);
  if (permission === 'view_pek') return pekViewRoles.includes(user.role);
  if (permission === 'edit_pek') return pekEditRoles.includes(user.role);
  const pekRoles = pekPermissionRoles[permission as Permission];
  if (pekRoles) return pekRoles.includes(user.role);
  return canAccess(user.role, permission as Permission);
};

export const permissionsForRole = (role: UserRole | undefined) => (role ? rolePermissions[role] ?? [] : []);

export const companyRoleMatrix = {
  read: ['ADMIN', 'DIRECTOR', 'HEAD', 'MANAGER', 'LABORATORY'],
  write: ['ADMIN', 'DIRECTOR', 'HEAD', 'MANAGER'],
  archive: ['ADMIN', 'DIRECTOR', 'HEAD'],
  readObjects: ['ADMIN', 'DIRECTOR', 'HEAD', 'MANAGER', 'LABORATORY'],
  writeObjects: ['ADMIN', 'DIRECTOR', 'HEAD', 'MANAGER'],
  archiveObjects: ['ADMIN', 'DIRECTOR', 'HEAD'],
} as const satisfies Record<string, readonly UserRole[]>;
