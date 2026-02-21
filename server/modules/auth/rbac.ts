import { Role, Permission, UserClaims } from './auth.types';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    'view:financials', 'edit:financials',
    'view:crm', 'edit:crm',
    'view:deals', 'edit:deals',
    'manage:dealroom',
    'upload:files', 'view:files', 'download:files', 'delete:files',
    'view:modeling', 'edit:modeling', 'approve:modeling',
    'view:rentroll', 'edit:rentroll',
    'view:salescomps', 'edit:salescomps',
    'view:fuel', 'edit:fuel',
    'view:shipstore', 'edit:shipstore',
    'view:vdr', 'edit:vdr', 'manage:vdr',
    'view:docket', 'manage:docket',
    'view:analytics', 'view:reports', 'create:reports',
    'manage:users', 'manage:settings',
    'view:audit', 'manage:integrations',
  ],
  
  [Role.OWNER]: [
    'view:financials', 'edit:financials',
    'view:crm', 'edit:crm',
    'view:deals', 'edit:deals',
    'manage:dealroom',
    'upload:files', 'view:files', 'download:files', 'delete:files',
    'view:modeling', 'edit:modeling', 'approve:modeling',
    'view:rentroll', 'edit:rentroll',
    'view:salescomps', 'edit:salescomps',
    'view:fuel', 'edit:fuel',
    'view:shipstore', 'edit:shipstore',
    'view:vdr', 'edit:vdr', 'manage:vdr',
    'view:docket', 'manage:docket',
    'view:analytics', 'view:reports', 'create:reports',
    'manage:users', 'manage:settings',
    'view:audit',
  ],
  
  [Role.INVESTOR]: [
    'view:financials',
    'view:deals',
    'view:files', 'download:files',
    'view:modeling',
    'view:rentroll',
    'view:salescomps',
    'view:fuel',
    'view:shipstore',
    'view:vdr',
    'view:analytics', 'view:reports',
  ],
  
  [Role.BROKER]: [
    'view:financials',
    'view:crm', 'edit:crm',
    'view:deals', 'edit:deals',
    'upload:files', 'view:files', 'download:files',
    'view:modeling',
    'view:rentroll',
    'view:salescomps', 'edit:salescomps',
    'view:vdr',
    'view:analytics', 'view:reports', 'create:reports',
    'view:docket',
  ],
  
  [Role.APPRAISER]: [
    'view:financials',
    'view:files', 'download:files',
    'view:modeling',
    'view:rentroll',
    'view:salescomps', 'edit:salescomps',
    'view:fuel',
    'view:vdr',
    'view:analytics', 'view:reports', 'create:reports',
  ],
  
  [Role.EDITOR]: [
    'view:financials', 'edit:financials',
    'view:crm', 'edit:crm',
    'view:deals', 'edit:deals',
    'upload:files', 'view:files', 'download:files',
    'view:modeling', 'edit:modeling',
    'view:rentroll', 'edit:rentroll',
    'view:salescomps', 'edit:salescomps',
    'view:fuel', 'edit:fuel',
    'view:shipstore', 'edit:shipstore',
    'view:vdr', 'edit:vdr',
    'view:analytics', 'view:reports', 'create:reports',
    'view:docket',
  ],
  
  [Role.VIEWER]: [
    'view:financials',
    'view:crm',
    'view:deals',
    'view:files',
    'view:modeling',
    'view:rentroll',
    'view:salescomps',
    'view:fuel',
    'view:shipstore',
    'view:vdr',
    'view:analytics', 'view:reports',
    'view:docket',
  ],
  
  [Role.AUDITOR]: [
    'view:financials',
    'view:deals',
    'view:files', 'download:files',
    'view:modeling',
    'view:rentroll',
    'view:fuel',
    'view:shipstore',
    'view:vdr',
    'view:analytics', 'view:reports',
    'view:audit',
  ],
};

export function hasRole(user: UserClaims | { role: Role | string }, roles: Role[]): boolean {
  const userRole = typeof user.role === 'string' ? user.role as Role : user.role;
  return roles.includes(userRole);
}

export function hasPermission(user: UserClaims | { role: Role | string }, permissions: Permission[]): boolean {
  const userRole = typeof user.role === 'string' ? user.role as Role : user.role;
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.every(perm => rolePermissions.includes(perm));
}

export function hasAnyPermission(user: UserClaims | { role: Role | string }, permissions: Permission[]): boolean {
  const userRole = typeof user.role === 'string' ? user.role as Role : user.role;
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.some(perm => rolePermissions.includes(perm));
}

export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function getAllRoles(): Role[] {
  return Object.values(Role);
}

export function isValidRole(role: string): role is Role {
  return Object.values(Role).includes(role as Role);
}

export { ROLE_PERMISSIONS };
