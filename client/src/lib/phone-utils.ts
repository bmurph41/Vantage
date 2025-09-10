/**
 * Formats a phone number to (000) 000-0000 format
 * Handles various input formats and removes non-digits
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Return empty string if no digits
  if (!digits) return '';
  
  // Handle different digit lengths
  if (digits.length === 10) {
    // Standard US phone number: format as (000) 000-0000
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // 11-digit number starting with 1: format as (000) 000-0000 (ignoring the leading 1)
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (digits.length < 10) {
    // Partial number: return as-is or with partial formatting
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
  } else {
    // Too many digits: return original input
    return phoneNumber;
  }
}