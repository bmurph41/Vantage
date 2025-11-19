import { createContext, useContext, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";

interface User {
  id: string;
  username: string;
  role?: string;
  subscriptionTier?: string;
}

interface AuthContextType {
  user: User | null;
  login: (credentials: { username: string; password: string }) => Promise<User>;
  signup: (credentials: { username: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  
  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/docktalk/auth/me"],
    queryFn: async () => {
      try {
        return await apiRequest("/api/docktalk/auth/me");
      } catch (err: any) {
        // If 401, return null (not authenticated) instead of throwing
        if (err.message?.includes('401')) {
          return null;
        }
        throw err;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await apiRequest("/api/docktalk/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });
      return response.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/docktalk/auth/me"], { user });
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await apiRequest("/api/docktalk/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });
      return response.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/docktalk/auth/me"], { user });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/docktalk/auth/logout", {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/docktalk/auth/me"], null);
      queryClient.clear(); // Clear all cached data on logout
      sessionStorage.removeItem('docktalk_filters'); // Clear filter preferences on logout
    },
  });

  const value: AuthContextType = {
    user: user?.user || null,
    login: loginMutation.mutateAsync,
    signup: signupMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoading: isLoading || loginMutation.isPending || signupMutation.isPending,
    isAuthenticated: !!user?.user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}