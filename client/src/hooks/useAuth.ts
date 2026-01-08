// Re-export useAuth from the AuthContext to ensure consistent auth state across the app
// All components should use this hook for authentication
export { useAuth, useRequireAuth } from '@/contexts/AuthContext';
