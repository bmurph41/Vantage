// ============================================================================
// Settings Center Type Definitions
// ============================================================================

export interface NotificationPreferences {
  channels: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
  };
  digests: {
    enabled: boolean;
    cadence: 'daily' | 'weekly';
    time: string;
    dayOfWeek?: number;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  scope: 'mine' | 'all';
  modules: {
    dealRoom: {
      ndaSigned: boolean;
      fileUploaded: boolean;
      comment: boolean;
      taskAssigned: boolean;
      qaResponse: boolean;
    };
    valuator: {
      parseComplete: boolean;
      reviewRequired: boolean;
      modelReady: boolean;
    };
    crm: {
      leadAssigned: boolean;
      taskDue: boolean;
      pipelineMoved: boolean;
    };
    security: {
      newLogin: boolean;
      passwordChanged: boolean;
      tokenCreated: boolean;
    };
    comps: {
      newCompsParsed: boolean;
      anomalies: boolean;
    };
  };
}

export interface UserSettings {
  autoSave: boolean;
  timezone: string;
  locale: string;
  currency: string;
  defaultLanding: string;
  theme: 'light' | 'dark' | 'system';
  density: 'comfortable' | 'compact';
  reducedMotion: boolean;
  stickyHeaders: boolean;
  numberFormat: 'comma' | 'space' | 'none';
  decimalPrecision: number;
  notificationPreferences: NotificationPreferences;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  mfaEnabled: boolean;
  emailVerified: boolean;
}

export interface Organization {
  id: string;
  name: string;
}

export interface SettingsResponse {
  settings: UserSettings;
  profile: UserProfile;
  organization: Organization | null;
}

export interface Session {
  id: string;
  deviceType: string;
  browser: string;
  os: string;
  ipAddress: string;
  location: string;
  lastActivityAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface PersonalAccessToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  category: string;
  metadata: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export interface AppInfo {
  version: string;
  buildHash: string;
  environment: string;
  supportEmail: string;
  docsUrl: string;
  changelogUrl: string;
}

export type SettingsSection =
  | 'account'
  | 'security'
  | 'notifications'
  | 'display'
  | 'data-privacy'
  | 'integrations'
  | 'help'
  | 'admin';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  channels: { inApp: true, email: true, sms: false },
  digests: { enabled: false, cadence: 'daily', time: '09:00', dayOfWeek: 1 },
  quietHours: { enabled: false, start: '22:00', end: '08:00' },
  scope: 'mine',
  modules: {
    dealRoom: { ndaSigned: true, fileUploaded: true, comment: true, taskAssigned: true, qaResponse: true },
    valuator: { parseComplete: true, reviewRequired: true, modelReady: true },
    crm: { leadAssigned: true, taskDue: true, pipelineMoved: true },
    security: { newLogin: true, passwordChanged: true, tokenCreated: true },
    comps: { newCompsParsed: true, anomalies: true },
  },
};

export const DEFAULT_SETTINGS: UserSettings = {
  autoSave: true,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
  locale: 'en-US',
  currency: 'USD',
  defaultLanding: 'dashboard',
  theme: 'light',
  density: 'comfortable',
  reducedMotion: false,
  stickyHeaders: true,
  numberFormat: 'comma',
  decimalPrecision: 2,
  notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
};