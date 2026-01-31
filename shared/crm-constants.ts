/**
 * CRM Constants - Shared across frontend and backend
 * Contact Position/Role options with consistent Title Case formatting
 */

// Contact Position/Title Options - displayed in dropdowns
export const CONTACT_POSITION_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'operator', label: 'Operator' },
  { value: 'broker', label: 'Broker' },
  { value: 'investor', label: 'Investor' },
  { value: 'lender', label: 'Lender' },
  { value: 'attorney', label: 'Attorney' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'manager', label: 'Manager' },
  { value: 'asset_manager', label: 'Asset Manager' },
  { value: 'property_manager', label: 'Property Manager' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'developer', label: 'Developer' },
  { value: 'insurance_broker', label: 'Insurance Broker' },
  { value: 'general_partner', label: 'General Partner' },
  { value: 'limited_partner', label: 'Limited Partner' },
  { value: 'ceo', label: 'CEO' },
  { value: 'cfo', label: 'CFO' },
  { value: 'coo', label: 'COO' },
  { value: 'general_manager', label: 'General Manager' },
  { value: 'marina_manager', label: 'Marina Manager' },
  { value: 'dockmaster', label: 'Dockmaster' },
  { value: 'operations', label: 'Operations' },
  { value: 'sales', label: 'Sales' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'appraiser', label: 'Appraiser' },
  { value: 'other', label: 'Other' },
] as const;

// Get all position values as a type
export type ContactPositionValue = typeof CONTACT_POSITION_OPTIONS[number]['value'];

// Helper to normalize position to Title Case
export function normalizePosition(position: string | null | undefined): string | undefined {
  if (!position) return undefined;

  const normalized = position.toLowerCase().trim().replace(/\s+/g, '_');
  const found = CONTACT_POSITION_OPTIONS.find(opt => opt.value === normalized);

  if (found) {
    return found.value;
  }

  // If not in list, return original with Title Case
  return position.split(/[\s_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Get display label for a position value
export function getPositionLabel(value: string | null | undefined): string {
  if (!value) return '';

  const found = CONTACT_POSITION_OPTIONS.find(opt => opt.value === value);
  if (found) {
    return found.label;
  }

  // If custom value, format as Title Case
  return value.split(/[\s_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Activity types for the New Task dropdown
export const ACTIVITY_TYPES = [
  { value: 'email', label: 'Email', icon: 'Mail' },
  { value: 'call', label: 'Call', icon: 'Phone' },
  { value: 'note', label: 'Add Note', icon: 'StickyNote' },
  { value: 'reminder', label: 'Schedule Reminder', icon: 'Bell' },
  { value: 'meeting', label: 'Schedule Meeting', icon: 'Calendar' },
  { value: 'task', label: 'Task', icon: 'CheckSquare' },
  { value: 'follow_up', label: 'Follow Up', icon: 'ArrowRight' },
  { value: 'site_visit', label: 'Site Visit', icon: 'MapPin' },
] as const;

export type ActivityTypeValue = typeof ACTIVITY_TYPES[number]['value'];

// Phone formatting utilities
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Handle different lengths
  if (digits.length === 0) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;

  // For international numbers or longer
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

// Parse phone to digits only for storage
export function parsePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

// Validate phone number format
export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone) return true; // Empty is valid (not required)
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
}

// DD Project link relationship types
export const DD_PROJECT_RELATIONSHIP_TYPES = [
  { value: 'team_member', label: 'Team Member' },
  { value: 'deal_team', label: 'Deal Team' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'stakeholder', label: 'Stakeholder' },
  { value: 'subject_matter_expert', label: 'Subject Matter Expert' },
  { value: 'legal_counsel', label: 'Legal Counsel' },
  { value: 'other', label: 'Other' },
] as const;