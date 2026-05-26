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
    'view_messages',
    'view_action_history',
    'manage_employees',
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
    'view_messages',
    'view_action_history',
    'manage_employees',
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
  ],
};

export const canAccess = (role: UserRole | undefined, permission: Permission) => {
  if (!role) return false;
  return rolePermissions[role]?.includes(permission) ?? false;
};

export const permissionsForRole = (role: UserRole | undefined) => (role ? rolePermissions[role] ?? [] : []);
