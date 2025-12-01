/**
 * DockitAppShell - Content wrapper for Dockit module pages
 * 
 * This component provides a consistent header and content area for Dockit pages.
 * The main sidebar is rendered by the parent App component, so we only render
 * the content area here (no duplicate sidebar).
 */

import { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight, Anchor } from "lucide-react";

interface DockitAppShellProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export default function DockitAppShell({ children, title, description }: DockitAppShellProps) {
  return (
    <div className="space-y-4">
      {/* Header with breadcrumb */}
      <div className="border-b bg-white -mx-4 -mt-4 px-4 py-3 md:-mx-6 md:-mt-6 md:px-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/operations/dockit" className="hover:text-foreground flex items-center gap-1">
            <Anchor className="h-3.5 w-3.5" />
            Dockit
          </Link>
          {title && title !== "Marina Operations Dashboard" && (
            <>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground font-medium">{title}</span>
            </>
          )}
        </div>
        
        {/* Title */}
        {title && (
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        )}
      </div>
      
      {/* Main Content */}
      <div>
        {children}
      </div>
    </div>
  );
}

/**
 * Utility hook for Dockit API calls
 * Ensures all Dockit API calls use the correct prefix
 */
export function useDockitApi() {
  const API_PREFIX = "/dockit/api";
  
  const fetchDockitApi = async (endpoint: string, options?: RequestInit) => {
    const url = `${API_PREFIX}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new Error(error.message || `Request failed: ${response.status}`);
    }
    
    return response.json();
  };
  
  return { fetchDockitApi, apiPrefix: API_PREFIX };
}
