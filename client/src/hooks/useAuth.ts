import type { User } from "@shared/schema";

// Simple auth hook - returns a mock user for now
// In production, this would fetch the actual authenticated user
export function useAuth() {
  // Mock user with Owner role to allow all operations
  const user: User = {
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

  return {
    user,
    isAuthenticated: true,
    isLoading: false,
  };
}
