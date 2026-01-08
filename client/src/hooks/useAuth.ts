import type { User } from "@shared/schema";

type Permission =
  | 'view:financials' | 'edit:financials'
  | 'view:crm' | 'edit:crm'
  | 'view:deals' | 'edit:deals'
  | 'manage:dealroom'
  | 'upload:files' | 'view:files' | 'download:files' | 'delete:files'
  | 'view:modeling' | 'edit:modeling' | 'approve:modeling'
  | 'view:rentroll' | 'edit:rentroll'
  | 'view:salescomps' | 'edit:salescomps'
  | 'view:fuel' | 'edit:fuel'
  | 'view:shipstore' | 'edit:shipstore'
  | 'view:vdr' | 'edit:vdr' | 'manage:vdr'
  | 'view:docktalk' | 'manage:docktalk'
  | 'view:analytics' | 'view:reports' | 'create:reports'
  | 'manage:users' | 'manage:settings'
  | 'view:audit' | 'manage:integrations';

// Simple auth hook - returns a mock user for now
// In production, this would fetch the actual authenticated user
export function useAuth() {
  // Mock user with owner role to allow all operations
  const user: any = {
    id: "mock-user-id",
    orgId: "mock-org-id",
    email: "user@example.com",
    name: "Current User",
    role: "owner",
    tz: "America/New_York",
    defaultCalendarProvider: null,
    calendarSyncEnabled: true,
    preferredDashboard: "default",
    dashboardConfig: {},
    createdAt: new Date(),
  };

  const hasPermission = (permissions: Permission | Permission[]): boolean => {
    if (!user) return false;
    const permissionArray = Array.isArray(permissions) ? permissions : [permissions];
    // Owner role has manage:docktalk permission
    const ownerPermissions: Permission[] = [
      'view:financials', 'edit:financials', 'view:crm', 'edit:crm',
      'view:deals', 'edit:deals', 'manage:dealroom',
      'upload:files', 'view:files', 'download:files', 'delete:files',
      'view:modeling', 'edit:modeling', 'approve:modeling',
      'view:rentroll', 'edit:rentroll', 'view:salescomps', 'edit:salescomps',
      'view:fuel', 'edit:fuel', 'view:shipstore', 'edit:shipstore',
      'view:vdr', 'edit:vdr', 'manage:vdr',
      'view:docktalk', 'manage:docktalk',
      'view:analytics', 'view:reports', 'create:reports',
      'manage:users', 'manage:settings', 'view:audit',
    ];
    return permissionArray.every(p => ownerPermissions.includes(p));
  };

  return {
    user,
    isAuthenticated: true,
    isLoading: false,
    hasPermission,
  };
}
