import { createContext, useContext, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

export type Role = 'admin' | 'owner' | 'investor' | 'broker' | 'appraiser' | 'editor' | 'viewer' | 'auditor';

export type Permission =
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

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'view:financials', 'edit:financials', 'view:crm', 'edit:crm',
    'view:deals', 'edit:deals', 'manage:dealroom',
    'upload:files', 'view:files', 'download:files', 'delete:files',
    'view:modeling', 'edit:modeling', 'approve:modeling',
    'view:rentroll', 'edit:rentroll', 'view:salescomps', 'edit:salescomps',
    'view:fuel', 'edit:fuel', 'view:shipstore', 'edit:shipstore',
    'view:vdr', 'edit:vdr', 'manage:vdr',
    'view:docktalk', 'manage:docktalk',
    'view:analytics', 'view:reports', 'create:reports',
    'manage:users', 'manage:settings', 'view:audit', 'manage:integrations',
  ],
  owner: [
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
  ],
  investor: [
    'view:financials', 'view:deals', 'view:files', 'download:files',
    'view:modeling', 'view:rentroll', 'view:salescomps',
    'view:fuel', 'view:shipstore', 'view:vdr',
    'view:analytics', 'view:reports',
  ],
  broker: [
    'view:financials', 'view:crm', 'edit:crm',
    'view:deals', 'edit:deals',
    'upload:files', 'view:files', 'download:files',
    'view:modeling', 'view:rentroll', 'view:salescomps', 'edit:salescomps',
    'view:vdr', 'view:analytics', 'view:reports', 'create:reports', 'view:docktalk',
  ],
  appraiser: [
    'view:financials', 'view:files', 'download:files',
    'view:modeling', 'view:rentroll', 'view:salescomps', 'edit:salescomps',
    'view:fuel', 'view:vdr', 'view:analytics', 'view:reports', 'create:reports',
  ],
  editor: [
    'view:financials', 'edit:financials', 'view:crm', 'edit:crm',
    'view:deals', 'edit:deals',
    'upload:files', 'view:files', 'download:files',
    'view:modeling', 'edit:modeling',
    'view:rentroll', 'edit:rentroll', 'view:salescomps', 'edit:salescomps',
    'view:fuel', 'edit:fuel', 'view:shipstore', 'edit:shipstore',
    'view:vdr', 'edit:vdr',
    'view:analytics', 'view:reports', 'create:reports', 'view:docktalk',
  ],
  viewer: [
    'view:financials', 'view:crm', 'view:deals', 'view:files',
    'view:modeling', 'view:rentroll', 'view:salescomps',
    'view:fuel', 'view:shipstore', 'view:vdr',
    'view:analytics', 'view:reports', 'view:docktalk',
  ],
  auditor: [
    'view:financials', 'view:deals', 'view:files', 'download:files',
    'view:modeling', 'view:rentroll', 'view:fuel', 'view:shipstore',
    'view:vdr', 'view:analytics', 'view:reports', 'view:audit',
  ],
};

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  orgId: string;
  orgName?: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasRole: (roles: Role | Role[]) => boolean;
  hasPermission: (permissions: Permission | Permission[]) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  canView: (module: string) => boolean;
  canEdit: (module: string) => boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, refetch } = useQuery<User | null>({
    queryKey: ['/api/auth/me'],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const hasRole = useCallback((roles: Role | Role[]): boolean => {
    if (!user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  }, [user]);

  const hasPermission = useCallback((permissions: Permission | Permission[]): boolean => {
    if (!user) return false;
    const permArray = Array.isArray(permissions) ? permissions : [permissions];
    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    return permArray.every(perm => userPermissions.includes(perm));
  }, [user]);

  const hasAnyPermission = useCallback((permissions: Permission[]): boolean => {
    if (!user) return false;
    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    return permissions.some(perm => userPermissions.includes(perm));
  }, [user]);

  const canView = useCallback((module: string): boolean => {
    return hasPermission(`view:${module}` as Permission);
  }, [hasPermission]);

  const canEdit = useCallback((module: string): boolean => {
    return hasPermission(`edit:${module}` as Permission);
  }, [hasPermission]);

  const value = useMemo<AuthContextValue>(() => ({
    user: user || null,
    isLoading,
    isAuthenticated: !!user,
    hasRole,
    hasPermission,
    hasAnyPermission,
    canView,
    canEdit,
    refetch,
  }), [user, isLoading, hasRole, hasPermission, hasAnyPermission, canView, canEdit, refetch]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useRequireAuth(): AuthContextValue & { user: User } {
  const auth = useAuth();
  if (!auth.user) {
    throw new Error('User is not authenticated');
  }
  return auth as AuthContextValue & { user: User };
}

interface RequirePermissionProps {
  permission: Permission | Permission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequirePermission({ permission, children, fallback = null }: RequirePermissionProps) {
  const { hasPermission } = useAuth();
  
  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

interface RequireRoleProps {
  role: Role | Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireRole({ role, children, fallback = null }: RequireRoleProps) {
  const { hasRole } = useAuth();
  
  if (!hasRole(role)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

interface CanViewProps {
  module: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function CanView({ module, children, fallback = null }: CanViewProps) {
  const { canView } = useAuth();
  
  if (!canView(module)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

interface CanEditProps {
  module: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function CanEdit({ module, children, fallback = null }: CanEditProps) {
  const { canEdit } = useAuth();
  
  if (!canEdit(module)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}
