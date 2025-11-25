export enum Role {
  ADMIN = 'admin',
  OWNER = 'owner',
  INVESTOR = 'investor',
  BROKER = 'broker',
  APPRAISER = 'appraiser',
  EDITOR = 'editor',
  VIEWER = 'viewer',
  AUDITOR = 'auditor',
}

export type Permission =
  | 'view:financials'
  | 'edit:financials'
  | 'view:crm'
  | 'edit:crm'
  | 'view:deals'
  | 'edit:deals'
  | 'manage:dealroom'
  | 'upload:files'
  | 'view:files'
  | 'download:files'
  | 'delete:files'
  | 'view:modeling'
  | 'edit:modeling'
  | 'approve:modeling'
  | 'view:rentroll'
  | 'edit:rentroll'
  | 'view:salescomps'
  | 'edit:salescomps'
  | 'view:fuel'
  | 'edit:fuel'
  | 'view:shipstore'
  | 'edit:shipstore'
  | 'view:vdr'
  | 'edit:vdr'
  | 'manage:vdr'
  | 'view:docktalk'
  | 'manage:docktalk'
  | 'view:analytics'
  | 'view:reports'
  | 'create:reports'
  | 'manage:users'
  | 'manage:settings'
  | 'view:audit'
  | 'manage:integrations';

export interface UserClaims {
  sub: string;
  tenant_id: string;
  org_id: string;
  role: Role;
  email?: string;
  name?: string;
  marina_ids?: string[];
  permissions?: Permission[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest {
  user: {
    id: string;
    orgId: string;
    role: Role | string;
    email?: string;
    name?: string;
    permissions?: Permission[];
  };
  requestId: string;
  log: any;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
}
