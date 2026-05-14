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
  | 'view_documents'
  | 'edit_documents'
  | 'view_messages'
  | 'send_messages'
  | 'view_internal_notes'
  | 'add_internal_notes'
  | 'view_action_history'
  | 'manage_employees'
  | 'manage_roles'
  | 'manage_settings';

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
    'edit_ecology',
    'edit_laboratory',
    'edit_documents',
    'send_messages',
    'manage_employees',
    'manage_roles',
    'manage_settings',
  ],
  MANAGER: [
    ...staffBase,
    'create_order',
    'edit_order',
    'edit_documents',
    'send_messages',
  ],
  ACCOUNTANT: [
    ...staffBase,
    'view_payment',
    'edit_payment',
    'edit_documents',
  ],
  ECOLOGIST: [
    ...staffBase,
    'edit_ecology',
    'edit_documents',
  ],
  LABORATORY: [
    ...staffBase,
    'edit_laboratory',
    'edit_documents',
  ],
};

export const canAccess = (role: UserRole | undefined, permission: Permission) => {
  if (!role) return false;
  return rolePermissions[role]?.includes(permission) ?? false;
};

export const permissionsForRole = (role: UserRole | undefined) => (role ? rolePermissions[role] ?? [] : []);
