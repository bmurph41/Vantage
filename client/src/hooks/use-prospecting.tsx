import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "./use-websocket";
import { apiRequest } from "@/lib/queryClient";
import { useEffect, useMemo } from "react";
import type { ProspectingEntry, InsertProspectingEntry } from "@shared/schema";

// Hook for fetching all prospecting entries
export function useProspectingEntries(year?: number) {
  const queryKey = year ? 
    ['/api/prospecting/entries', year] : 
    ['/api/prospecting/entries'];

  return useQuery<ProspectingEntry[]>({
    queryKey,
    select: (data) => data || []
  });
}

// Hook for fetching a specific prospecting entry
export function useProspectingEntry(year: number, quarter: number, weekNumber: number) {
  const queryKey = ['/api/prospecting/entries', year, quarter, weekNumber];

  return useQuery<ProspectingEntry | null>({
    queryKey,
    queryFn: async () => {
      try {
        const res = await fetch(`/api/prospecting/entries/${year}/${quarter}/${weekNumber}`, {
          credentials: "include",
        });
        
        if (res.status === 404) {
          return null; // Entry doesn't exist yet
        }
        
        if (!res.ok) {
          throw new Error(`${res.status}: ${res.statusText}`);
        }
        
        return await res.json();
      } catch (error) {
        throw error;
      }
    }
  });
}

// Hook for saving prospecting entries (create or update)
export function useSaveProspectingEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsertProspectingEntry) => {
      const response = await apiRequest('POST', '/api/prospecting/entries', data);
      return await response.json();
    },
    onSuccess: (savedEntry: ProspectingEntry) => {
      // Update specific entry cache
      const specificKey = ['/api/prospecting/entries', savedEntry.year, savedEntry.quarter, savedEntry.weekNumber];
      queryClient.setQueryData(specificKey, savedEntry);

      // Invalidate list queries to refresh
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/entries', savedEntry.year] });
    },
    onError: (error) => {
      console.error('Error saving prospecting entry:', error);
    }
  });
}

// Hook for updating a specific prospecting entry
export function useUpdateProspectingEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      year, 
      quarter, 
      weekNumber, 
      data 
    }: { 
      year: number; 
      quarter: number; 
      weekNumber: number; 
      data: Partial<InsertProspectingEntry> 
    }) => {
      const response = await apiRequest(
        'PUT', 
        `/api/prospecting/entries/${year}/${quarter}/${weekNumber}`, 
        data
      );
      return await response.json();
    },
    onSuccess: (savedEntry: ProspectingEntry) => {
      // Update specific entry cache
      const specificKey = ['/api/prospecting/entries', savedEntry.year, savedEntry.quarter, savedEntry.weekNumber];
      queryClient.setQueryData(specificKey, savedEntry);

      // Invalidate list queries to refresh
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/entries', savedEntry.year] });
    },
    onError: (error) => {
      console.error('Error updating prospecting entry:', error);
    }
  });
}

// Hook for deleting prospecting entries
export function useDeleteProspectingEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/prospecting/entries/${id}`);
    },
    onSuccess: () => {
      // Invalidate all prospecting queries to refresh
      queryClient.invalidateQueries({ queryKey: ['/api/prospecting/entries'] });
    },
    onError: (error) => {
      console.error('Error deleting prospecting entry:', error);
    }
  });
}

// Hook that integrates WebSocket for real-time updates
export function useProspectingRealTime() {
  const { lastMessage } = useWebSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!lastMessage) return;

    try {
      const message = JSON.parse(lastMessage);
      
      if (message.type === 'PROSPECTING_ENTRY_UPDATED' && message.data) {
        const entry: ProspectingEntry = message.data;
        
        // Update specific entry cache
        const specificKey = ['/api/prospecting/entries', entry.year, entry.quarter, entry.weekNumber];
        queryClient.setQueryData(specificKey, entry);

        // Update list caches by invalidating them
        queryClient.invalidateQueries({ queryKey: ['/api/prospecting/entries'] });
        queryClient.invalidateQueries({ queryKey: ['/api/prospecting/entries', entry.year] });
        
      } else if (message.type === 'PROSPECTING_ENTRY_DELETED' && message.data?.id) {
        // Invalidate all prospecting queries when an entry is deleted
        queryClient.invalidateQueries({ queryKey: ['/api/prospecting/entries'] });
      }
    } catch (error) {
      // Ignore invalid JSON messages
    }
  }, [lastMessage, queryClient]);

  return { lastMessage };
}

// Helper hook for calculating real-time weekly metrics
export function useWeeklyProspectingMetrics(entry: ProspectingEntry | null | undefined) {
  return useMemo(() => {
    if (!entry || !entry.dailyActivities) {
      return {
        totalActivities: 0,
        leadsGenerated: 0,
        activitiesTargeted: 0,
        daysElapsed: 0,
        activitiesCompleted: 0,
        completionRate: 0
      };
    }

    const dailyData = entry.dailyActivities as Record<string, any>;
    const now = new Date();
    const weekStart = new Date(entry.weekStartDate);
    
    // Calculate days elapsed in the work week (Monday-Friday)
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysElapsed = Math.min(
      Math.max(0, Math.floor((now.getTime() - weekStart.getTime()) / msPerDay) + 1),
      5 // Cap at 5 work days
    );

    // Calculate metrics from daily data
    let totalActivities = 0;
    let leadsGenerated = 0;
    let activitiesTargeted = 0;

    Object.values(dailyData || {}).forEach((day: any) => {
      if (day.activityBoxes) {
        // Count completed activities
        totalActivities += day.activityBoxes.filter((box: any) => box.completed).length;
        // Sum target activities 
        activitiesTargeted += day.targetActivities || 0;
        // Count lead outcomes from activity boxes
        leadsGenerated += day.activityBoxes.filter((box: any) => box.completed && box.outcome === 'lead').length;
      }
    });

    const completionRate = activitiesTargeted > 0 ? (totalActivities / activitiesTargeted) * 100 : 0;

    return {
      totalActivities,
      leadsGenerated,
      activitiesTargeted,
      daysElapsed,
      activitiesCompleted: totalActivities,
      completionRate: Math.round(completionRate)
    };
  }, [entry]);
}