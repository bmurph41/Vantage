import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, 
  Target, 
  Phone, 
  MessageSquare, 
  Linkedin, 
  Mail, 
  Calendar, 
  Users,
  Building,
  TrendingUp,
  CheckCircle,
  Clock,
  Edit,
  Trash2,
  Check,
  Search,
  MapPin,
  X
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DailyActivitiesModal } from "./daily-activities-modal";
import type { ProspectingEntry, ProspectingActivity, Contact, Deal } from "@shared/schema";

interface WeekProspectingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  year: number;
  quarter: number;
  entry?: ProspectingEntry | null;
}

interface ActivityType {
  id: string;
  name: string;
  icon: any;
  color: string;
  outcomes: string[];
}

const ACTIVITY_TYPES: ActivityType[] = [
  {
    id: 'call',
    name: 'Call',
    icon: Phone,
    color: 'bg-blue-500',
    outcomes: ['conversation', 'lead', 'no_answer', 'voicemail', 'bad_number', 'bad_email', 'not_on_site', 'connected', 'left_voicemail', 'busy', 'wrong_number', 'call_back']
  },
  {
    id: 'text',
    name: 'Text',
    icon: MessageSquare,
    color: 'bg-green-500',
    outcomes: ['conversation', 'lead', 'no_answer', 'voicemail', 'bad_number', 'bad_email', 'not_on_site', 'sent', 'delivered', 'read', 'replied']
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'bg-blue-600',
    outcomes: ['conversation', 'lead', 'no_answer', 'voicemail', 'bad_number', 'bad_email', 'not_on_site', 'connection_sent', 'message_sent', 'connected', 'replied']
  },
  {
    id: 'email',
    name: 'Email',
    icon: Mail,
    color: 'bg-orange-500',
    outcomes: ['conversation', 'lead', 'no_answer', 'voicemail', 'bad_number', 'bad_email', 'not_on_site', 'sent', 'opened', 'replied', 'bounced']
  },
  {
    id: 'meeting',
    name: 'Meeting',
    icon: Calendar,
    color: 'bg-indigo-500',
    outcomes: ['conversation', 'lead', 'no_answer', 'voicemail', 'bad_number', 'bad_email', 'not_on_site', 'scheduled', 'completed', 'no_show', 'rescheduled']
  },
  {
    id: 'site_visit',
    name: 'Site Visit',
    icon: MapPin,
    color: 'bg-teal-500',
    outcomes: ['conversation', 'lead', 'no_answer', 'voicemail', 'bad_number', 'bad_email', 'not_on_site', 'scheduled', 'completed', 'no_show', 'rescheduled']
  }
];

const ALL_DAYS_OF_WEEK = [
  { id: 'monday', name: 'Monday', short: 'Mon' },
  { id: 'tuesday', name: 'Tuesday', short: 'Tue' },
  { id: 'wednesday', name: 'Wednesday', short: 'Wed' },
  { id: 'thursday', name: 'Thursday', short: 'Thu' },
  { id: 'friday', name: 'Friday', short: 'Fri' },
  { id: 'saturday', name: 'Saturday', short: 'Sat' },
  { id: 'sunday', name: 'Sunday', short: 'Sun' }
];

const DEFAULT_DAYS_OF_WEEK = [
  { id: 'monday', name: 'Monday', short: 'Mon' },
  { id: 'tuesday', name: 'Tuesday', short: 'Tue' },
  { id: 'wednesday', name: 'Wednesday', short: 'Wed' },
  { id: 'thursday', name: 'Thursday', short: 'Thu' },
  { id: 'friday', name: 'Friday', short: 'Fri' }
];

interface Goal {
  id: string;
  text: string;
  completed: boolean;
  type: 'weekly' | 'daily';
  day?: string;
}

interface ActivityBox {
  id: string;
  completed: boolean;
  type?: string;
  outcome?: string;
  notes?: string;
  contactId?: string;
  dealId?: string;
  timestamp?: Date;
  isScheduled?: boolean;
  scheduledFrom?: {
    day: string;
    boxId: string;
    originalContactId?: string;
    originalDealId?: string;
  };
}

interface DailyData {
  activities: ProspectingActivity[];
  goals: Goal[];
  leadsGenerated: number;
  targetActivities: number;
  activityBoxes: ActivityBox[];
}

interface Targets {
  dailyActivities: number;
  weeklyActivities: number;
}


export default function WeekProspectingModal({
  open,
  onOpenChange,
  weekNumber,
  weekStart,
  weekEnd,
  year,
  quarter,
  entry
}: WeekProspectingModalProps) {
  
  const [weeklyGoals, setWeeklyGoals] = useState<Goal[]>([]);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(
    new Set(DEFAULT_DAYS_OF_WEEK.map(day => day.id))
  );
  const [targets, setTargets] = useState<Targets>({
    dailyActivities: 30,
    weeklyActivities: 30 * DEFAULT_DAYS_OF_WEEK.length // Auto-calculated: 30 × 5 = 150
  });
  const [dailyData, setDailyData] = useState<Record<string, DailyData>>(() => {
    return ALL_DAYS_OF_WEEK.reduce((acc, day) => {
      const initialBoxes = Array.from({ length: 30 }, (_, i) => ({
        id: `${day.id}-box-${i}`,
        completed: false
      }));
      
      acc[day.id] = {
        activities: [],
        goals: [],
        leadsGenerated: 0,
        targetActivities: 30,
        activityBoxes: initialBoxes
      };
      return acc;
    }, {} as Record<string, DailyData>);
  });
  
  // Helper to get currently selected days of the week
  const activeDaysOfWeek = ALL_DAYS_OF_WEEK.filter(day => selectedDays.has(day.id));

  // Load existing goals from entry when modal opens - track loaded entry to prevent overwrites
  const loadedGoalsEntryIdRef = useRef<string | null>(null);
  const dataLoadedRef = useRef(false);
  
  useEffect(() => {
    if (open) {
      const entryId = entry?.id || `${year}-${quarter}-${weekNumber}`;
      
      // Only load goals if this is a new/different week
      if (loadedGoalsEntryIdRef.current !== entryId) {
        loadedGoalsEntryIdRef.current = entryId;
        dataLoadedRef.current = false; // Reset loaded flag for new entry
        
        if (entry?.goals) {
          const existingGoals = entry.goals as any[];
          if (existingGoals.length > 0) {
            // Convert goals to proper format, handling both strings and objects
            const loadedGoals = existingGoals.map((goal, index) => {
              if (typeof goal === 'string') {
                return {
                  id: `weekly-${index + 1}`,
                  text: goal,
                  completed: false,
                  type: 'weekly' as const
                };
              } else {
                return {
                  id: goal.id || `weekly-${index + 1}`,
                  text: goal.text || goal,
                  completed: goal.completed || false,
                  type: 'weekly' as const
                };
              }
            });
            setWeeklyGoals(loadedGoals);
          } else {
            // Entry exists but has no goals - reset to empty
            setWeeklyGoals([]);
          }
        } else {
          // New week with no entry - reset to empty (will be initialized by the other useEffect)
          setWeeklyGoals([]);
        }
        
        // Mark data as loaded after a brief delay to allow state to settle
        setTimeout(() => {
          dataLoadedRef.current = true;
        }, 100);
      }
    } else {
      // Reset when modal closes
      loadedGoalsEntryIdRef.current = null;
      dataLoadedRef.current = false;
    }
  }, [open, entry?.goals, entry?.id, year, quarter, weekNumber]);

  // Load enabled days from entry when modal opens or reset to default for new weeks
  useEffect(() => {
    if (open) {
      if (entry?.enabledDays) {
        const loadedDays = entry.enabledDays as string[];
        if (loadedDays.length > 0) {
          setSelectedDays(new Set(loadedDays));
        }
      } else {
        // Reset to default for new/uninitialized weeks
        setSelectedDays(new Set(DEFAULT_DAYS_OF_WEEK.map(day => day.id)));
      }
    }
  }, [open, entry?.enabledDays]);

  // Load daily activities data from entry when modal opens
  // Track if we've already loaded this entry to avoid re-loading on target changes
  const loadedEntryIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (open) {
      const entryId = entry?.id || `${year}-${quarter}-${weekNumber}`;
      
      // Only load if this is a new entry or first open
      if (loadedEntryIdRef.current !== entryId) {
        loadedEntryIdRef.current = entryId;
        
        if (entry?.dailyActivities) {
          // Load existing data from entry
          const loadedDailyActivities = entry.dailyActivities as Record<string, any>;
          setDailyData(currentData => {
            const updatedData = { ...currentData };
            
            // Load each day's data from the entry
            ALL_DAYS_OF_WEEK.forEach(day => {
              const savedDayData = loadedDailyActivities[day.id];
              if (savedDayData) {
                updatedData[day.id] = {
                  activities: savedDayData.activities || [],
                  goals: savedDayData.goals || [],
                  leadsGenerated: savedDayData.leadsGenerated || 0,
                  targetActivities: savedDayData.targetActivities || targets.dailyActivities,
                  activityBoxes: savedDayData.activityBoxes || currentData[day.id].activityBoxes
                };
              }
            });
            
            return updatedData;
          });
        } else {
          // Reset to default empty state for new weeks
          setDailyData(ALL_DAYS_OF_WEEK.reduce((acc, day) => {
            const initialBoxes = Array.from({ length: targets.dailyActivities }, (_, i) => ({
              id: `${day.id}-box-${i}`,
              completed: false
            }));
            
            acc[day.id] = {
              activities: [],
              goals: [],
              leadsGenerated: 0,
              targetActivities: targets.dailyActivities,
              activityBoxes: initialBoxes
            };
            return acc;
          }, {} as Record<string, DailyData>));
        }
      }
    } else {
      // Reset when modal closes so it can reload fresh on next open
      loadedEntryIdRef.current = null;
    }
  }, [open, entry?.dailyActivities, entry?.id, year, quarter, weekNumber, targets.dailyActivities]);

  // Function to update goal templates
  
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    // Default to current day instead of Monday
    const today = new Date();
    const dayIndex = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayMapping = {
      1: 'monday',
      2: 'tuesday', 
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      0: 'monday', // Sunday maps to Monday for business week
      6: 'friday'  // Saturday maps to Friday for business week
    };
    return dayMapping[dayIndex as keyof typeof dayMapping] || 'monday';
  });
  const [dailyActivitiesModal, setDailyActivitiesModal] = useState<{
    open: boolean;
    dayId: string;
    dayName: string;
    date: Date;
  }>({ open: false, dayId: '', dayName: '', date: new Date() });
  const [newActivity, setNewActivity] = useState<{
    type: string;
    outcome: string;
    notes: string;
    contactId?: string;
    dealId?: string;
  }>({
    type: '',
    outcome: '',
    notes: '',
  });
  
  const [activityBoxModal, setActivityBoxModal] = useState<{
    open: boolean;
    day: string;
    boxId: string;
    boxData?: ActivityBox;
  }>({ open: false, day: '', boxId: '' });
  
  const [boxActivityForm, setBoxActivityForm] = useState<{
    type: string;
    outcome: string;
    notes: string;
    contactId?: string;
    dealId?: string;
    callbackDay?: string;
  }>({
    type: '',
    outcome: '',
    notes: '',
  });

  // Autocomplete state
  const [contactSearchOpen, setContactSearchOpen] = useState(false);
  const [dealSearchOpen, setDealSearchOpen] = useState(false);
  const [contactSearchValue, setContactSearchValue] = useState("");
  const [dealSearchValue, setDealSearchValue] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch contacts for linking
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
  });

  // Fetch deals for linking
  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ['/api/deals'],
  });

  // Mock prospecting activities for now - will be replaced with real data
  const [activities, setActivities] = useState<ProspectingActivity[]>([]);

  // Track save status for visual feedback
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveStatusTimeoutRef = useRef<NodeJS.Timeout>();

  // Autosave mutation for prospecting data with optimistic updates for real-time sync
  const autosaveMutation = useMutation({
    mutationFn: async (data: any) => {
      setSaveStatus('saving');
      try {
        const response = await apiRequest('PUT', `/api/prospecting/entries/${year}/${quarter}/${weekNumber}`, data);
        const result = await response.json();
        return result;
      } catch (error: any) {
        console.error('Prospecting save error:', error?.message || error);
        console.error('Request data:', JSON.stringify(data, null, 2).substring(0, 500));
        throw error;
      }
    },
    onMutate: async (newData: any) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['/api/prospecting/entries', year] });
      
      // Snapshot the previous value
      const previousEntries = queryClient.getQueryData<any[]>(['/api/prospecting/entries', year]);
      
      // Optimistically update the cache with deep-cloned serializable data
      if (previousEntries) {
        // Deep clone the data to ensure it's fully serializable
        const cleanDailyActivities = JSON.parse(JSON.stringify(newData.dailyActivities || {}));
        const cleanGoals = JSON.parse(JSON.stringify(newData.goals || []));
        const cleanEnabledDays = Array.isArray(newData.enabledDays) 
          ? [...newData.enabledDays] 
          : [];
        
        const optimisticEntry = {
          id: entry?.id || `temp-${year}-${quarter}-${weekNumber}`,
          userId: entry?.userId || newData.userId || 'temp-user-id',
          year: newData.year,
          quarter: newData.quarter,
          weekNumber: newData.weekNumber,
          weekStartDate: newData.weekStartDate instanceof Date 
            ? newData.weekStartDate.toISOString() 
            : newData.weekStartDate,
          weekEndDate: newData.weekEndDate instanceof Date 
            ? newData.weekEndDate.toISOString() 
            : newData.weekEndDate,
          goals: cleanGoals,
          enabledDays: cleanEnabledDays,
          dailyActivities: cleanDailyActivities,
          totalLeadGeneration: newData.totalLeadGeneration || 0,
          totalCalls: newData.totalCalls || 0,
          totalEmails: newData.totalEmails || 0,
          totalMeetings: newData.totalMeetings || 0,
          createdAt: entry?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        const existingIndex = previousEntries.findIndex(
          (e: any) => e.year === year && e.quarter === quarter && e.weekNumber === weekNumber
        );
        
        let updatedEntries;
        if (existingIndex >= 0) {
          updatedEntries = previousEntries.map((e: any, idx: number) => 
            idx === existingIndex ? optimisticEntry : e
          );
        } else {
          updatedEntries = [...previousEntries, optimisticEntry];
        }
        
        queryClient.setQueryData(['/api/prospecting/entries', year], updatedEntries);
      }
      
      return { previousEntries };
    },
    onSuccess: (savedEntry: any) => {
      // Show saved indicator briefly
      setSaveStatus('saved');
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }
      saveStatusTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
      
      // Update individual entry cache with server response
      queryClient.setQueryData(['/api/prospecting/entries', year, quarter, weekNumber], savedEntry);
      
      // Update the list cache directly with server response instead of invalidating
      // This prevents refetch from overwriting optimistic updates in progress
      const currentEntries = queryClient.getQueryData<any[]>(['/api/prospecting/entries', year]);
      if (currentEntries) {
        const existingIndex = currentEntries.findIndex(
          (e: any) => e.year === savedEntry.year && e.quarter === savedEntry.quarter && e.weekNumber === savedEntry.weekNumber
        );
        
        let updatedEntries;
        if (existingIndex >= 0) {
          updatedEntries = currentEntries.map((e: any, idx: number) => 
            idx === existingIndex ? savedEntry : e
          );
        } else {
          updatedEntries = [...currentEntries, savedEntry];
        }
        
        queryClient.setQueryData(['/api/prospecting/entries', year], updatedEntries);
      }
    },
    onError: (error, _newData, context) => {
      console.error('Autosave failed:', error);
      setSaveStatus('idle');
      
      // Rollback to previous value on error
      if (context?.previousEntries) {
        queryClient.setQueryData(['/api/prospecting/entries', year], context.previousEntries);
      }
      
      toast({
        title: "Save failed",
        description: "Your changes couldn't be saved. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Helper function to get deals associated with a specific contact
  const getDealsForContact = (contactId: string) => {
    return deals.filter(deal => 
      deal.primaryContactId === contactId || 
      deal.contactId === contactId // Legacy field
    );
  };

  // Filtered deals based on selected contact
  const filteredDeals = boxActivityForm.contactId 
    ? getDealsForContact(boxActivityForm.contactId) 
    : deals;

  // Helper function to get current day of week
  const getCurrentDayOfWeek = () => {
    const today = new Date();
    const dayIndex = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayMapping = {
      1: 'monday',
      2: 'tuesday', 
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      0: 'monday', // Sunday maps to Monday for business week
      6: 'friday'  // Saturday maps to Friday for business week
    };
    return dayMapping[dayIndex as keyof typeof dayMapping] || 'monday';
  };

  // Helper function to get past day blur styling
  const getPastDayStyle = (dayId: string) => {
    const dayStatus = getDayStatus(dayId);
    return dayStatus === 'past' ? 'opacity-60 blur-[0.5px] grayscale-[0.3]' : '';
  };

  // Helper function to get day order index
  const getDayOrderIndex = (dayId: string) => {
    return ALL_DAYS_OF_WEEK.findIndex(day => day.id === dayId);
  };

  // Helper function to determine day status relative to current day
  const getDayStatus = (dayId: string) => {
    const currentDay = getCurrentDayOfWeek();
    const currentDayIndex = getDayOrderIndex(currentDay);
    const targetDayIndex = getDayOrderIndex(dayId);
    
    if (targetDayIndex < currentDayIndex) return 'past';
    if (targetDayIndex === currentDayIndex) return 'current';
    return 'future';
  };

  // Helper function to get the next available box index (first uncompleted box)
  const getNextAvailableBoxIndex = (dayId: string) => {
    const boxes = dailyData[dayId]?.activityBoxes || [];
    const firstUncompletedIndex = boxes.findIndex(box => !box.completed);
    return firstUncompletedIndex === -1 ? boxes.length : firstUncompletedIndex;
  };

  // Helper function to schedule a callback in the first available box of target day
  const scheduleCallback = (targetDay: string, originalDay: string, originalBoxId: string, contactId?: string, dealId?: string, notes?: string) => {
    const nextAvailableIndex = getNextAvailableBoxIndex(targetDay);
    const boxes = dailyData[targetDay]?.activityBoxes || [];
    
    if (nextAvailableIndex < boxes.length) {
      const targetBox = boxes[nextAvailableIndex];
      setDailyData(data => ({
        ...data,
        [targetDay]: {
          ...data[targetDay],
          activityBoxes: data[targetDay].activityBoxes.map(box =>
            box.id === targetBox.id ? {
              ...box,
              completed: true,
              type: 'call',
              outcome: 'scheduled',
              notes: `Call back scheduled from ${ALL_DAYS_OF_WEEK.find(d => d.id === originalDay)?.name}: ${notes || 'Follow-up call'}`,
              contactId,
              dealId,
              timestamp: new Date(),
              isScheduled: true,
              scheduledFrom: {
                day: originalDay,
                boxId: originalBoxId,
                originalContactId: contactId,
                originalDealId: dealId
              }
            } : box
          )
        }
      }));
      
      return true; // Successfully scheduled
    }
    
    return false; // No available boxes
  };

  // Helper function to determine if a box is clickable based on day and completion status
  const isBoxClickable = (dayId: string, boxIndex: number) => {
    const boxes = dailyData[dayId]?.activityBoxes || [];
    const box = boxes[boxIndex];
    const nextAvailableIndex = getNextAvailableBoxIndex(dayId);
    const dayStatus = getDayStatus(dayId);
    
    // Future days: no boxes are clickable
    if (dayStatus === 'future') {
      return false;
    }
    
    // Past days: all boxes are clickable (for viewing/editing completed ones)
    if (dayStatus === 'past') {
      return box?.completed || false; // Only completed boxes are clickable for past days
    }
    
    // Current day: completed boxes + next available box (original logic)
    if (dayStatus === 'current') {
      return box?.completed || boxIndex === nextAvailableIndex;
    }
    
    return false;
  };

  // Calculate weekly statistics
  const weeklyStats = useMemo(() => {
    // Count lead outcomes from activity boxes instead of leadsGenerated field
    const totalLeads = Object.values(dailyData).reduce((sum, day) => 
      sum + day.activityBoxes.filter(box => box.completed && box.outcome === 'lead').length, 0
    );
    const totalActivities = Object.values(dailyData).reduce((sum, day) => sum + day.activityBoxes.filter(box => box.completed).length, 0);
    
    return {
      totalActivities,
      totalLeads,
      completedWeeklyGoals: weeklyGoals.filter(g => g.completed).length,
      completedDailyGoals: Object.values(dailyData).flatMap(day => day.goals).filter(g => g.completed).length
    };
  }, [dailyData, weeklyGoals]);

  // Calculate weekly lead count from activity boxes
  const weeklyLeadCount = weeklyStats.totalLeads;

  // Query all prospecting entries for the current quarter to calculate quarterly leads
  const { data: quarterlyEntries } = useQuery({
    queryKey: ['/api/prospecting/entries', year],
    enabled: open && !!year
  });

  // Calculate quarterly lead count from all weeks in the quarter
  const quarterlyLeadCount = useMemo(() => {
    if (!quarterlyEntries || !Array.isArray(quarterlyEntries)) {
      return 0;
    }

    // Filter entries for the current quarter and sum up all lead outcomes
    return quarterlyEntries
      .filter((entry: any) => entry.year === year && entry.quarter === quarter)
      .reduce((total: number, entry: any) => {
        // Count all lead outcomes from activity boxes across all days in each week
        const weekLeads = Object.values(entry.dailyActivities || {}).reduce((weekTotal: number, dayData: any) => {
          if (dayData && Array.isArray(dayData.activityBoxes)) {
            return weekTotal + dayData.activityBoxes.filter((box: any) => box.completed && box.outcome === 'lead').length;
          }
          return weekTotal;
        }, 0);
        return total + weekLeads;
      }, 0);
  }, [quarterlyEntries, year, quarter]);

  // Helper function to prepare data for saving
  const prepareDataForSave = useCallback(() => {
    return {
      userId: entry?.userId || 'temp-user-id', // Will be set by backend
      year,
      quarter,
      weekNumber,
      weekStartDate: new Date(weekStart),
      weekEndDate: new Date(weekEnd),
      goals: weeklyGoals.filter(goal => goal.text && goal.text.trim()),
      enabledDays: Array.from(selectedDays),
      dailyActivities: Object.fromEntries(
        ALL_DAYS_OF_WEEK.map(day => [
          day.id, 
          {
            targetActivities: dailyData[day.id]?.targetActivities || targets.dailyActivities,
            goals: dailyData[day.id]?.goals || [],
            activities: dailyData[day.id]?.activities || [],
            activityBoxes: dailyData[day.id]?.activityBoxes || []
          }
        ])
      ),
      totalLeadGeneration: weeklyStats.totalLeads,
      totalCalls: Object.values(dailyData).reduce((sum, day) => 
        sum + day.activityBoxes.filter(box => box.completed && box.type === 'call').length, 0
      ),
      totalEmails: Object.values(dailyData).reduce((sum, day) => 
        sum + day.activityBoxes.filter(box => box.completed && box.type === 'email').length, 0
      ),
      totalMeetings: Object.values(dailyData).reduce((sum, day) => 
        sum + day.activityBoxes.filter(box => box.completed && box.type === 'meeting').length, 0
      )
    };
  }, [year, quarter, weekNumber, weekStart, weekEnd, weeklyGoals, dailyData, targets, weeklyStats, entry?.userId, selectedDays]);

  // Function to save immediately (no debounce)
  const saveNow = useCallback(() => {
    const prospectingData = prepareDataForSave();
    autosaveMutation.mutate(prospectingData);
  }, [prepareDataForSave, autosaveMutation]);

  // Immediate optimistic cache update for real-time Week card sync (no server call)
  // Uses a deep clone of data to ensure cache receives only serializable, normalized objects
  const updateCacheOptimistically = useCallback(() => {
    if (!dataLoadedRef.current) return;
    
    // Get existing entries or start with empty array if cache not yet populated
    const previousEntries = queryClient.getQueryData<any[]>(['/api/prospecting/entries', year]) || [];
    
    // Build a clean, serializable cache entry (deep clone with plain objects only)
    const cleanDailyActivities: Record<string, any> = {};
    ALL_DAYS_OF_WEEK.forEach(day => {
      const dayData = dailyData[day.id];
      cleanDailyActivities[day.id] = {
        targetActivities: dayData?.targetActivities ?? targets.dailyActivities,
        goals: JSON.parse(JSON.stringify(dayData?.goals ?? [])),
        activities: JSON.parse(JSON.stringify(dayData?.activities ?? [])),
        activityBoxes: JSON.parse(JSON.stringify(dayData?.activityBoxes ?? []))
      };
    });
    
    const cleanGoals = weeklyGoals
      .filter(g => g && g.text && g.text.trim())
      .map(g => ({ id: g.id, text: g.text, completed: g.completed, type: g.type }));
    
    const optimisticEntry = {
      id: entry?.id || `temp-${year}-${quarter}-${weekNumber}`,
      userId: entry?.userId || 'temp-user-id',
      year,
      quarter,
      weekNumber,
      weekStartDate: weekStart instanceof Date ? weekStart.toISOString() : weekStart,
      weekEndDate: weekEnd instanceof Date ? weekEnd.toISOString() : weekEnd,
      goals: cleanGoals,
      enabledDays: Array.from(selectedDays),
      dailyActivities: cleanDailyActivities,
      totalLeadGeneration: weeklyStats.totalLeads,
      totalCalls: Object.values(dailyData).reduce((sum, day) => 
        sum + day.activityBoxes.filter((box: ActivityBox) => box.completed && box.type === 'call').length, 0
      ),
      totalEmails: Object.values(dailyData).reduce((sum, day) => 
        sum + day.activityBoxes.filter((box: ActivityBox) => box.completed && box.type === 'email').length, 0
      ),
      totalMeetings: Object.values(dailyData).reduce((sum, day) => 
        sum + day.activityBoxes.filter((box: ActivityBox) => box.completed && box.type === 'meeting').length, 0
      ),
      createdAt: entry?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const existingIndex = previousEntries.findIndex(
      (e: any) => e.year === year && e.quarter === quarter && e.weekNumber === weekNumber
    );
    
    let updatedEntries;
    if (existingIndex >= 0) {
      updatedEntries = previousEntries.map((e: any, idx: number) => 
        idx === existingIndex ? optimisticEntry : e
      );
    } else {
      updatedEntries = [...previousEntries, optimisticEntry];
    }
    
    queryClient.setQueryData(['/api/prospecting/entries', year], updatedEntries);
  }, [queryClient, year, quarter, weekNumber, entry, weekStart, weekEnd, weeklyGoals, dailyData, targets, selectedDays, weeklyStats]);

  // Debounced autosave function (placed after weeklyStats)
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const autosave = useCallback(() => {
    // Don't autosave until data is loaded from entry
    if (!dataLoadedRef.current) return;
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      const prospectingData = prepareDataForSave();
      autosaveMutation.mutate(prospectingData);
    }, 4000); // 4 second debounce for user inactivity
  }, [prepareDataForSave, autosaveMutation]);

  // Real-time cache update and debounced autosave when data changes
  // Note: We intentionally omit updateCacheOptimistically and autosave from deps to prevent infinite loops
  // These callbacks change when their internal deps change, but we only want to trigger on data changes
  useEffect(() => {
    if (open && dataLoadedRef.current) {
      // Immediately update cache for real-time Week card sync
      updateCacheOptimistically();
      // Also trigger debounced autosave to persist to server
      autosave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyData, targets, weeklyGoals, selectedDays, open]);

  // Save immediately when modal is closing
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (prevOpenRef.current === true && open === false) {
      // Modal is closing - save immediately without debounce
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      saveNow();
    }
    prevOpenRef.current = open;
  }, [open, saveNow]);

  // Save when user navigates away from the page (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (open && dataLoadedRef.current) {
        // Cancel any pending debounced save
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
        }
        // Use fetch with keepalive for PUT request (sendBeacon only supports POST)
        const prospectingData = prepareDataForSave();
        fetch(`/api/prospecting/entries/${year}/${quarter}/${weekNumber}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.cookie.match(/(?:^|; )csrf_token=([^;]*)/)?.[1] || '' },
          body: JSON.stringify(prospectingData),
          keepalive: true
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [open, year, quarter, weekNumber, prepareDataForSave]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }
    };
  }, []);

  const updateWeeklyGoal = (id: string, text: string, completed?: boolean) => {
    setWeeklyGoals(goals => goals.map(goal => 
      goal.id === id 
        ? { ...goal, text, ...(completed !== undefined && { completed }) }
        : goal
    ));
    // Autosave will handle cache updates
  };

  const addWeeklyGoal = () => {
    const newGoal: Goal = {
      id: `weekly-${weeklyGoals.length + 1}`,
      text: '',
      completed: false,
      type: 'weekly'
    };
    setWeeklyGoals(goals => [...goals, newGoal]);
    // Autosave will handle cache updates
  };

  const removeWeeklyGoal = (id: string) => {
    setWeeklyGoals(goals => goals.filter(goal => goal.id !== id));
    // Autosave will handle cache updates
  };

  const updateDailyGoal = (day: string, goalId: string, text: string, completed?: boolean) => {
    setDailyData(data => ({
      ...data,
      [day]: {
        ...data[day],
        goals: data[day].goals.map(goal =>
          goal.id === goalId
            ? { ...goal, text, ...(completed !== undefined && { completed }) }
            : goal
        )
      }
    }));
  };

  const updateDailyTarget = (day: string, target: number) => {
    setDailyData(data => {
      const currentBoxes = data[day].activityBoxes;
      let newBoxes: ActivityBox[];
      
      if (target > currentBoxes.length) {
        // Add more boxes
        const additionalBoxes = Array.from({ length: target - currentBoxes.length }, (_, i) => ({
          id: `${day}-box-${currentBoxes.length + i}`,
          completed: false
        }));
        newBoxes = [...currentBoxes, ...additionalBoxes];
      } else {
        // Remove excess boxes
        newBoxes = currentBoxes.slice(0, target);
      }
      
      return {
        ...data,
        [day]: {
          ...data[day],
          targetActivities: target,
          activityBoxes: newBoxes
        }
      };
    });
  };

  const updateTarget = (key: keyof Targets, value: number) => {
    setTargets(prev => {
      const updated = { ...prev, [key]: value };
      
      // If updating daily activities, auto-calculate weekly activities (based on selected days)
      if (key === 'dailyActivities') {
        updated.weeklyActivities = value * activeDaysOfWeek.length;
      }
      
      return updated;
    });
    
    // If updating daily activities target, update all selected days
    if (key === 'dailyActivities') {
      activeDaysOfWeek.forEach(day => {
        updateDailyTarget(day.id, value);
      });
    }
  };

  const handleDaySelection = (dayId: string, checked: boolean) => {
    setSelectedDays(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(dayId);
      } else {
        newSet.delete(dayId);
      }
      
      // Update weekly targets based on new day count
      setTargets(currentTargets => ({
        ...currentTargets,
        weeklyActivities: currentTargets.dailyActivities * newSet.size
      }));
      
      return newSet;
    });
  };
  
  const markActivityBox = (day: string, boxId: string, completed: boolean) => {
    setDailyData(data => ({
      ...data,
      [day]: {
        ...data[day],
        activityBoxes: data[day].activityBoxes.map(box =>
          box.id === boxId ? { ...box, completed } : box
        )
      }
    }));
  };
  
  const openActivityBoxModal = (day: string, boxId: string) => {
    const boxData = dailyData[day]?.activityBoxes.find(box => box.id === boxId);
    setActivityBoxModal({ open: true, day, boxId, boxData });
    setBoxActivityForm({
      type: boxData?.type || '',
      outcome: boxData?.outcome || '',
      notes: boxData?.notes || '',
      contactId: boxData?.contactId || '',
      dealId: boxData?.dealId || '',
      callbackDay: ''
    });
  };
  
  const saveActivityBoxDetails = () => {
    const { day, boxId } = activityBoxModal;
    
    if (!boxActivityForm.type || !boxActivityForm.outcome) {
      toast({
        title: "Missing Information",
        description: "Please select activity type and outcome",
        variant: "destructive"
      });
      return;
    }
    
    // Check if call_back outcome requires a callback day
    if (boxActivityForm.outcome === 'call_back' && !boxActivityForm.callbackDay) {
      toast({
        title: "Missing Callback Day",
        description: "Please select a day to schedule the callback",
        variant: "destructive"
      });
      return;
    }
    
    // Save the current activity
    setDailyData(data => ({
      ...data,
      [day]: {
        ...data[day],
        activityBoxes: data[day].activityBoxes.map(box =>
          box.id === boxId ? {
            ...box,
            completed: true,
            type: boxActivityForm.type,
            outcome: boxActivityForm.outcome,
            notes: boxActivityForm.notes,
            contactId: boxActivityForm.contactId || undefined,
            dealId: boxActivityForm.dealId || undefined,
            timestamp: new Date()
          } : box
        )
      }
    }));
    
    // If it's a callback, schedule it on the selected day
    if (boxActivityForm.outcome === 'call_back' && boxActivityForm.callbackDay) {
      scheduleCallback(
        boxActivityForm.callbackDay,
        day,
        boxId,
        boxActivityForm.contactId,
        boxActivityForm.dealId,
        boxActivityForm.notes
      );
    }
    
    setActivityBoxModal({ open: false, day: '', boxId: '' });
    setBoxActivityForm({ type: '', outcome: '', notes: '', callbackDay: '' });
  };
  
  const getCompletedBoxCount = (day: string) => {
    return dailyData[day]?.activityBoxes.filter(box => box.completed).length || 0;
  };

  const openDailyActivitiesModal = (dayId: string) => {
    const dayName = ALL_DAYS_OF_WEEK.find(d => d.id === dayId)?.name || dayId;
    const dayIndex = ALL_DAYS_OF_WEEK.findIndex(d => d.id === dayId);
    
    // Calculate the date for this day based on week start
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + dayIndex);
    
    setDailyActivitiesModal({
      open: true,
      dayId,
      dayName,
      date
    });
  };

  const handleDayActivityComplete = (dayId: string, activityIndex: number) => {
    setDailyData(data => ({
      ...data,
      [dayId]: {
        ...data[dayId],
        activityBoxes: data[dayId].activityBoxes.map((box, index) =>
          index === activityIndex ? { ...box, completed: true, timestamp: new Date() } : box
        )
      }
    }));
  };

  const handleDayActivityClick = (dayId: string, activityIndex: number) => {
    const boxes = dailyData[dayId]?.activityBoxes || [];
    const box = boxes[activityIndex];
    if (box) {
      openActivityBoxModal(dayId, box.id);
    }
  };

  const addActivity = () => {
    if (!newActivity.type || !newActivity.outcome) {
      toast({
        title: "Missing Information",
        description: "Please select activity type and outcome",
        variant: "destructive"
      });
      return;
    }

    const activity: ProspectingActivity = {
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'temp-user', // TODO: Use actual user ID
      notes: newActivity.notes,
      prospectingEntryId: 'temp-entry', // TODO: Use actual prospecting entry ID
      activityType: newActivity.type,
      outcome: newActivity.outcome,
      dayOfWeek: selectedDay,
      activityDate: new Date(),
      contactId: newActivity.contactId || null,
      dealId: newActivity.dealId || null,
      duration: null,
      phoneNumber: null,
      emailAddress: null,
      linkedinProfile: null,
      subject: null,
      followUpRequired: false,
      followUpDate: null
    };

    setDailyData(data => ({
      ...data,
      [selectedDay]: {
        ...data[selectedDay],
        activities: [...data[selectedDay].activities, activity]
      }
    }));
    
    setNewActivity({
      type: '',
      outcome: '',
      notes: '',
    });

    toast({
      title: "Activity Added",
      description: "Prospecting activity has been recorded",
    });
  };

  const getDayActivityCount = (day: string) => {
    return getCompletedBoxCount(day);
  };

  const getDayActivityIndicators = (day: string) => {
    const activities = dailyData[day]?.activities || [];
    const activityTypes = activities.reduce((acc, activity) => {
      acc[activity.activityType] = (acc[activity.activityType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(activityTypes).slice(0, 4).map(([type, count]) => {
      const activityType = ACTIVITY_TYPES.find(t => t.id === type);
      return {
        type,
        count,
        color: activityType?.color || 'bg-gray-500'
      };
    });
  };

  const selectedActivityType = ACTIVITY_TYPES.find(type => type.id === newActivity.type);

  const handleSave = async () => {
    // Cancel any pending debounced autosave to avoid race conditions
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    
    const prospectingData = prepareDataForSave();
    if (!prospectingData) {
      toast({
        title: "Error",
        description: "Failed to prepare data for saving.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await autosaveMutation.mutateAsync(prospectingData);
      toast({
        title: "Week Updated",
        description: "Your prospecting data has been saved",
      });
      onOpenChange(false);
    } catch (error: any) {
      // Check if the error is a false positive (data actually saved)
      // by verifying the mutation state
      console.error('Save error details:', error?.message || error);
      
      // If mutation succeeded despite error, still close the modal
      if (autosaveMutation.isSuccess) {
        toast({
          title: "Week Updated",
          description: "Your prospecting data has been saved",
        });
        onOpenChange(false);
        return;
      }
      
      toast({
        title: "Save Failed",
        description: error?.message || "Your changes couldn't be saved. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getActivityIcon = (type: string) => {
    const activityType = ACTIVITY_TYPES.find(t => t.id === type);
    if (!activityType) return Phone;
    return activityType.icon;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl h-[90vh] overflow-hidden bg-white border border-gray-200">
        <DialogHeader className="border-b border-gray-200 pb-4 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Target className="w-6 h-6 text-gray-700" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-gray-900">
                  Week {weekNumber} Prospecting
                </DialogTitle>
                <DialogDescription className="text-base text-gray-600 mt-1">
                  {weekStart.toLocaleDateString('en-US', { 
                    weekday: 'long',
                    month: 'long', 
                    day: 'numeric' 
                  })} - {weekEnd.toLocaleDateString('en-US', { 
                    weekday: 'long',
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {saveStatus === 'saving' && (
                <span className="text-sm text-gray-500 flex items-center gap-1" data-testid="text-saving-indicator">
                  <Clock className="w-3 h-3 animate-spin" />
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-sm text-green-600 flex items-center gap-1" data-testid="text-saved-indicator">
                  <Check className="w-3 h-3" />
                  Saved
                </span>
              )}
              <Badge variant="outline" className="border-gray-300 text-gray-700 px-3 py-1">
                {weeklyStats.totalActivities} Activities
              </Badge>
              <Badge variant="outline" className="border-gray-300 text-gray-700 px-3 py-1">
                {weeklyStats.totalLeads} Leads
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-120px)]">
          <div className="p-6 space-y-6">
            {/* Weekly Goals Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Weekly Goals</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="border-gray-300 text-gray-700 font-medium">
                      {weeklyStats.completedWeeklyGoals}/{weeklyGoals.length} Complete
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addWeeklyGoal}
                      className="h-8 px-3 text-sm border-gray-300 hover:bg-gray-50"
                      data-testid="button-add-goal"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Goal
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-4 gap-3">
                  {weeklyGoals.map((goal, index) => (
                    <div key={goal.id} className="relative group">
                      <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={goal.completed}
                            onCheckedChange={(checked) => updateWeeklyGoal(goal.id, goal.text, !!checked)}
                            className="w-4 h-4 flex-shrink-0"
                            data-testid={`checkbox-weekly-goal-${index}`}
                          />
                          {goal.completed && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
                          {weeklyGoals.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeWeeklyGoal(goal.id)}
                              className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-auto text-red-500 hover:text-red-700"
                              data-testid={`button-remove-goal-${index}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        <Textarea
                          placeholder={`Goal ${index + 1}...`}
                          value={goal.text}
                          onChange={(e) => updateWeeklyGoal(goal.id, e.target.value)}
                          className={`border-none bg-transparent text-sm resize-none min-h-[60px] p-0 ${goal.completed ? "line-through text-muted-foreground" : ""}`}
                          data-testid={`input-weekly-goal-${index}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {weeklyGoals.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm mb-3">No weekly goals set yet</p>
                    <Button
                      variant="outline"
                      onClick={addWeeklyGoal}
                      className="border-gray-300 hover:bg-gray-50"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Goal
                    </Button>
                  </div>
                )}
              </div>
            </div>


            {/* Day Selection Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Select Days of Week</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-7 gap-4">
                  {ALL_DAYS_OF_WEEK.map(day => (
                    <div key={day.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.id}`}
                        checked={selectedDays.has(day.id)}
                        onCheckedChange={(checked) => handleDaySelection(day.id, checked as boolean)}
                        data-testid={`checkbox-day-${day.id}`}
                      />
                      <Label 
                        htmlFor={`day-${day.id}`} 
                        className="text-sm font-medium cursor-pointer"
                      >
                        {day.name}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-4">
                  Select which days of the week you want to include in your prospecting schedule. Default is Monday-Friday.
                </p>
              </div>
            </div>

            {/* Daily Progress Section - MOVED TO TOP */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-6 h-6 text-gray-600" />
                    <h3 className="text-xl font-bold text-gray-900">Daily Activity Tracking</h3>
                  </div>
                  <div className="text-gray-600 text-sm font-medium">
                    {weeklyStats.totalActivities} / {targets.weeklyActivities} Weekly Goal
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className={`grid gap-6 mb-6 ${
                  activeDaysOfWeek.length === 7 ? 'grid-cols-7' :
                  activeDaysOfWeek.length === 6 ? 'grid-cols-6' :
                  activeDaysOfWeek.length === 5 ? 'grid-cols-5' :
                  activeDaysOfWeek.length === 4 ? 'grid-cols-4' :
                  activeDaysOfWeek.length === 3 ? 'grid-cols-3' :
                  activeDaysOfWeek.length === 2 ? 'grid-cols-2' : 'grid-cols-1'
                }`}>
                  {activeDaysOfWeek.map(day => {
                    const activityCount = getDayActivityCount(day.id);
                    const targetCount = dailyData[day.id]?.targetActivities || targets.dailyActivities;
                    const isSelected = selectedDay === day.id;
                    const progressPercentage = targetCount > 0 ? (activityCount / targetCount * 100) : 0;
                    const boxes = dailyData[day.id]?.activityBoxes || [];
                    const dayStatus = getDayStatus(day.id);
                    const pastDayStyle = getPastDayStyle(day.id);
                    
                    return (
                      <div
                        key={day.id}
                        className={`relative p-5 rounded-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] ${pastDayStyle} ${
                          isSelected 
                            ? 'bg-gray-900 text-white shadow-lg transform scale-[1.02] border-gray-900' 
                            : 'bg-white hover:bg-gray-50 border border-gray-200 hover:shadow-md'
                        }`}
                        onClick={() => {
                          setSelectedDay(day.id);
                          openDailyActivitiesModal(day.id);
                        }}
                        data-testid={`day-card-${day.id}`}
                      >
                        <div className="text-center mb-4">
                          <p className={`font-bold text-lg mb-1 ${isSelected ? 'text-white' : 'text-gray-800'}`}>{day.name}</p>
                          <div className={`text-sm font-medium ${isSelected ? 'text-gray-300' : 'text-gray-600'}`}>
                            <div>{activityCount}/{targetCount} Outreach</div>
                          </div>
                        </div>
                        
                        {/* Activity Boxes Grid - Larger and More Prominent */}
                        <div className="grid grid-cols-5 gap-2 mb-4">
                          {boxes.slice(0, 10).map((box, index) => {
                            const isClickable = isBoxClickable(day.id, index);
                            const nextAvailableIndex = getNextAvailableBoxIndex(day.id);
                            const isNextAvailable = index === nextAvailableIndex;
                            const dayStatus = getDayStatus(day.id);
                            
                            // Determine box styling based on day status
                            let boxStyle = '';
                            let titleText = '';
                            
                            if (dayStatus === 'future') {
                              // Future days: all boxes locked/grayed out
                              boxStyle = 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed opacity-40';
                              titleText = `${day.name} - Available ${day.name === 'tuesday' ? 'tomorrow' : 'on ' + day.name}`;
                            } else if (box.completed) {
                              // Completed boxes (past/current days) - check for lead outcome
                              if (box.outcome === 'lead') {
                                // Lead boxes: green styling
                                boxStyle = isSelected 
                                  ? 'bg-green-400 border-green-500 text-white shadow-md cursor-pointer hover:scale-110' 
                                  : 'bg-green-500 border-green-600 text-white shadow-lg cursor-pointer hover:scale-110';
                                titleText = `Outreach ${index + 1} completed - LEAD GENERATED! Click to view details`;
                              } else {
                                // Regular completed boxes: emerald styling
                                boxStyle = isSelected 
                                  ? 'bg-emerald-400 border-emerald-500 text-white shadow-md cursor-pointer hover:scale-110' 
                                  : 'bg-emerald-500 border-emerald-600 text-white shadow-lg cursor-pointer hover:scale-110';
                                titleText = `Outreach ${index + 1} completed - Click to view/edit details`;
                              }
                            } else if (dayStatus === 'current' && isNextAvailable) {
                              // Next available box on current day
                              boxStyle = isSelected 
                                ? 'bg-blue-400 border-blue-500 text-white shadow-md cursor-pointer hover:scale-110 ring-2 ring-blue-300 ring-opacity-50' 
                                : 'bg-blue-500 border-blue-600 text-white shadow-lg cursor-pointer hover:scale-110 ring-2 ring-blue-300 ring-opacity-50';
                              titleText = `Outreach ${index + 1} - Click to record outreach details (next to log)`;
                            } else {
                              // Other boxes (not available yet on current day, or incomplete on past days)
                              boxStyle = isSelected 
                                ? 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed opacity-60' 
                                : 'bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed opacity-60';
                              titleText = dayStatus === 'past' 
                                ? `Outreach ${index + 1} - Not completed`
                                : `Outreach ${index + 1} - Complete previous outreach first`;
                            }
                            
                            return (
                              <div
                                key={box.id}
                                className={`w-6 h-6 rounded-lg border-2 transition-all duration-200 flex items-center justify-center shadow-sm ${boxStyle}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isClickable) {
                                    openActivityBoxModal(day.id, box.id);
                                  }
                                }}
                                title={titleText}
                                data-testid={`activity-box-${day.id}-${index}`}
                              >
                                {box.completed ? (
                                  <Check className="w-4 h-4" />
                                ) : isNextAvailable && dayStatus === 'current' ? (
                                  <span className="text-xs font-bold animate-pulse">{index + 1}</span>
                                ) : (
                                  <span className="text-xs font-bold">{index + 1}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Progress Bar */}
                        <div className={`w-full rounded-full h-2 ${isSelected ? 'bg-white/30' : 'bg-gray-200'}`}>
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              isSelected 
                                ? 'bg-white' 
                                : progressPercentage >= 100 ? 'bg-green-500' : 
                                  progressPercentage >= 75 ? 'bg-indigo-500' :
                                  progressPercentage >= 50 ? 'bg-yellow-500' : 'bg-gray-400'
                            }`}
                            style={{ width: `${Math.min(100, progressPercentage)}%` }}
                          />
                        </div>
                        
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg">
                            <Check className="w-4 h-4 text-indigo-600" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{weeklyStats.totalActivities}</div>
                    <p className="text-xs font-medium text-gray-600">Activities Complete</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{weeklyStats.totalLeads}</div>
                    <p className="text-xs font-medium text-gray-600">Leads Generated</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{weeklyStats.completedWeeklyGoals}</div>
                    <p className="text-xs font-medium text-gray-600">Weekly Goals</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{weeklyStats.completedDailyGoals}</div>
                    <p className="text-xs font-medium text-gray-600">Daily Goals</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Targets Section - MOVED DOWN */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-white" />
                  <h3 className="text-lg font-semibold text-white">Prospecting Targets</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="bg-blue-50 rounded-lg p-4 mb-3">
                      <Label className="text-sm font-semibold text-blue-700 block mb-2">Daily Outreach</Label>
                      <Input
                        type="number"
                        value={targets.dailyActivities}
                        onChange={(e) => updateTarget('dailyActivities', parseInt(e.target.value) || 0)}
                        className="text-center text-xl font-bold border-blue-200 focus:border-blue-400"
                        min="0"
                        max="100"
                        data-testid="input-daily-target"
                      />
                    </div>
                    <p className="text-xs text-gray-500">Target per day</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-green-50 rounded-lg p-4 mb-3">
                      <Label className="text-sm font-semibold text-green-700 block mb-2">Weekly Outreach</Label>
                      <Input
                        type="number"
                        value={targets.weeklyActivities}
                        readOnly
                        className="text-center text-xl font-bold border-green-200 bg-green-100 cursor-not-allowed opacity-80"
                        data-testid="input-weekly-target"
                      />
                    </div>
                    <p className="text-xs text-gray-500">Auto-calculated (Daily × 5 days)</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-purple-50 rounded-lg p-4 mb-3">
                      <Label className="text-sm font-semibold text-purple-700 block mb-2">Weekly Leads</Label>
                      <div className="text-center text-xl font-bold text-black py-2" data-testid="text-weekly-leads">
                        {weeklyLeadCount}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Auto-calculated from lead outcomes</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-orange-50 rounded-lg p-4 mb-3">
                      <Label className="text-sm font-semibold text-orange-700 block mb-2">Quarterly Leads</Label>
                      <div className="text-center text-xl font-bold text-black py-2" data-testid="text-quarterly-leads">
                        {quarterlyLeadCount}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Auto-calculated projection</p>
                  </div>
                </div>
              </div>
            </div>


            {/* Daily Progress Section is now at the top */}

            {/* Day's Activities */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    {ALL_DAYS_OF_WEEK.find(d => d.id === selectedDay)?.name}'s Activities
                  </h3>
                </div>
              </div>
              <div className="p-6">
                {dailyData[selectedDay]?.activities.length > 0 ? (
                  <div className="rounded-lg border border-gray-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold text-gray-700">Type</TableHead>
                          <TableHead className="font-semibold text-gray-700">Outcome</TableHead>
                          <TableHead className="font-semibold text-gray-700">Contact</TableHead>
                          <TableHead className="font-semibold text-gray-700">Deal</TableHead>
                          <TableHead className="font-semibold text-gray-700">Time</TableHead>
                          <TableHead className="font-semibold text-gray-700">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyData[selectedDay].activities.map((activity, index) => {
                          const ActivityIcon = getActivityIcon(activity.activityType);
                          const linkedContact = contacts.find(c => c.id === activity.contactId);
                          const linkedDeal = deals.find(d => d.id === activity.dealId);
                          const activityType = ACTIVITY_TYPES.find(t => t.id === activity.activityType);
                          
                          return (
                            <TableRow key={activity.id} className="hover:bg-gray-50" data-testid={`activity-row-${index}`}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="p-1 rounded bg-gray-600">
                                    <ActivityIcon className="w-3 h-3 text-white" />
                                  </div>
                                  <span className="font-medium text-gray-900">{activityType?.name}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="border-gray-300 text-gray-700 font-medium">
                                  {activity.outcome.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {linkedContact ? (
                                  <div className="flex items-center gap-1">
                                    <Users className="w-3 h-3 text-gray-500" />
                                    <span className="text-gray-700">{linkedContact.firstName} {linkedContact.lastName}</span>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {linkedDeal ? (
                                  <div className="flex items-center gap-1">
                                    <Building className="w-3 h-3 text-gray-500" />
                                    <span className="text-gray-700">{linkedDeal.title}</span>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-gray-600 font-mono">
                                  {activity.activityDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </TableCell>
                              <TableCell>
                                {activity.notes ? (
                                  <div className="max-w-xs">
                                    <p className="text-sm text-gray-700 line-clamp-2" title={activity.notes}>
                                      {activity.notes}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-sm">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                      <Clock className="w-10 h-10 text-gray-400" />
                    </div>
                    <p className="text-lg font-medium text-gray-600 mb-2">No activities for {ALL_DAYS_OF_WEEK.find(d => d.id === selectedDay)?.name} yet</p>
                    <p className="text-sm text-gray-500">Start tracking your prospecting activities above</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="border-t border-gray-200 bg-white p-6">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Track your progress and achieve your goals
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="px-6 py-2 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                className="px-6 py-2 bg-gray-900 hover:bg-gray-800 text-white font-medium shadow-sm"
                data-testid="button-save-week"
              >
                Save Week
              </Button>
            </div>
          </div>
        </div>
        </DialogContent>
      </Dialog>
      
      {/* Activity Box Detail Modal */}
      <Dialog open={activityBoxModal.open} onOpenChange={(open) => !open && setActivityBoxModal({ open: false, day: '', boxId: '' })}>
        <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-gray-600" />
            Record Outreach Activity
          </DialogTitle>
          <DialogDescription>
            Capture details about your prospecting outreach for {ALL_DAYS_OF_WEEK.find(d => d.id === activityBoxModal.day)?.name}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Outreach Type *</Label>
              <Select 
                value={boxActivityForm.type} 
                onValueChange={(value) => setBoxActivityForm({...boxActivityForm, type: value, outcome: ''})}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select outreach type" />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded ${type.color}`}>
                          <type.icon className="w-3 h-3 text-white" />
                        </div>
                        {type.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {boxActivityForm.type && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Outcome *</Label>
                <Select 
                  value={boxActivityForm.outcome} 
                  onValueChange={(value) => setBoxActivityForm({...boxActivityForm, outcome: value})}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.find(t => t.id === boxActivityForm.type)?.outcomes.map(outcome => (
                      <SelectItem key={outcome} value={outcome}>
                        {outcome.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Link to Contact</Label>
              <Popover open={contactSearchOpen} onOpenChange={setContactSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={contactSearchOpen}
                    className="h-11 w-full justify-between"
                  >
                    {boxActivityForm.contactId
                      ? contacts.find(contact => contact.id === boxActivityForm.contactId)?.firstName + ' ' + contacts.find(contact => contact.id === boxActivityForm.contactId)?.lastName
                      : "Search and select contact..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput 
                      placeholder="Type to search contacts..." 
                      value={contactSearchValue}
                      onValueChange={setContactSearchValue}
                    />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty>No contacts found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="none"
                          onSelect={() => {
                            setBoxActivityForm({...boxActivityForm, contactId: "", dealId: ""});
                            setContactSearchOpen(false);
                            setContactSearchValue("");
                            setDealSearchValue("");
                          }}
                        >
                          <X className="mr-2 h-4 w-4" />
                          No contact linked
                        </CommandItem>
                        {contacts
                          .filter(contact => 
                            `${contact.firstName} ${contact.lastName} ${contact.email}`.toLowerCase()
                              .includes(contactSearchValue.toLowerCase())
                          )
                          .map(contact => (
                          <CommandItem
                            key={contact.id}
                            value={`${contact.firstName} ${contact.lastName}`}
                            onSelect={() => {
                              setBoxActivityForm({
                                ...boxActivityForm, 
                                contactId: contact.id,
                                dealId: "" // Clear deal when contact changes
                              });
                              setContactSearchOpen(false);
                              setContactSearchValue("");
                              setDealSearchValue("");
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{contact.firstName} {contact.lastName}</span>
                              <span className="text-sm text-gray-500">{contact.email}</span>
                              {contact.position && <span className="text-xs text-gray-400">{contact.position}</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Link to Deal/Property
                {boxActivityForm.contactId && (
                  <span className="text-xs text-green-600 ml-2">
                    ✓ Filtered by selected contact
                  </span>
                )}
              </Label>
              <Popover open={dealSearchOpen} onOpenChange={setDealSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={dealSearchOpen}
                    className="h-11 w-full justify-between"
                  >
                    {boxActivityForm.dealId
                      ? filteredDeals.find(deal => deal.id === boxActivityForm.dealId)?.title
                      : boxActivityForm.contactId 
                        ? `Search deals for ${contacts.find(c => c.id === boxActivityForm.contactId)?.firstName}...`
                        : "Search and select deal/property..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput 
                      placeholder={boxActivityForm.contactId 
                        ? "Type to search contact's deals..." 
                        : "Type to search all deals..."
                      } 
                      value={dealSearchValue}
                      onValueChange={setDealSearchValue}
                    />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty>
                        {boxActivityForm.contactId 
                          ? "No deals found for this contact." 
                          : "No deals found."}
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="none"
                          onSelect={() => {
                            setBoxActivityForm({...boxActivityForm, dealId: ""});
                            setDealSearchOpen(false);
                            setDealSearchValue("");
                          }}
                        >
                          <X className="mr-2 h-4 w-4" />
                          No deal linked
                        </CommandItem>
                        {filteredDeals
                          .filter(deal => 
                            deal.title.toLowerCase().includes(dealSearchValue.toLowerCase()) ||
                            (deal.description && deal.description.toLowerCase().includes(dealSearchValue.toLowerCase()))
                          )
                          .map(deal => (
                          <CommandItem
                            key={deal.id}
                            value={deal.title}
                            onSelect={() => {
                              setBoxActivityForm({...boxActivityForm, dealId: deal.id});
                              setDealSearchOpen(false);
                              setDealSearchValue("");
                            }}
                          >
                            <div className="flex flex-col w-full">
                              <span className="font-medium">{deal.title}</span>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500 capitalize">{deal.stage}</span>
                                {deal.amount && (
                                  <span className="text-sm text-green-600 font-medium">
                                    ${Number(deal.amount).toLocaleString()}
                                  </span>
                                )}
                              </div>
                              {deal.description && (
                                <span className="text-xs text-gray-400 truncate mt-1">
                                  {deal.description}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div>
            <Label className="text-sm font-medium mb-2 block">Notes</Label>
            <Textarea
              placeholder="Add notes about this outreach (optional)..."
              value={boxActivityForm.notes}
              onChange={(e) => setBoxActivityForm({...boxActivityForm, notes: e.target.value})}
              rows={3}
              className="resize-none"
            />
          </div>
          
          {/* Callback Day Selection - only show when outcome is call_back */}
          {boxActivityForm.outcome === 'call_back' && (
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <Label className="text-sm font-medium mb-2 block text-orange-800">
                📞 Schedule Callback Day *
              </Label>
              <Select 
                value={boxActivityForm.callbackDay || ''} 
                onValueChange={(value) => setBoxActivityForm({...boxActivityForm, callbackDay: value})}
              >
                <SelectTrigger className="h-11 border-orange-300">
                  <SelectValue placeholder="Select day to schedule callback..." />
                </SelectTrigger>
                <SelectContent>
                  {ALL_DAYS_OF_WEEK.map(day => {
                    const availableSlots = dailyData[day.id]?.activityBoxes?.filter(box => !box.completed).length || 0;
                    const isCurrentDay = day.id === activityBoxModal.day;
                    
                    return (
                      <SelectItem 
                        key={day.id} 
                        value={day.id}
                        disabled={isCurrentDay || availableSlots === 0}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span>{day.name}</span>
                          {isCurrentDay ? (
                            <span className="text-xs text-gray-500 ml-2">(Current day)</span>
                          ) : availableSlots === 0 ? (
                            <span className="text-xs text-red-500 ml-2">(No slots)</span>
                          ) : (
                            <span className="text-xs text-green-600 ml-2">({availableSlots} slots)</span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-orange-700 mt-2">
                💡 The callback will be automatically scheduled in the first available activity box on the selected day
              </p>
            </div>
          )}
          
          {activityBoxModal.boxData?.completed && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Previously recorded:</strong> {activityBoxModal.boxData?.timestamp?.toLocaleString()}
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-3 pt-4">
          <Button 
            variant="outline" 
            onClick={() => setActivityBoxModal({ open: false, day: '', boxId: '' })}
          >
            Cancel
          </Button>
          <Button 
            onClick={saveActivityBoxDetails}
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!boxActivityForm.type || !boxActivityForm.outcome}
          >
            Save Activity
          </Button>
        </div>
        </DialogContent>
      </Dialog>

      {/* Daily Activities Modal */}
      <DailyActivitiesModal
        open={dailyActivitiesModal.open}
        onOpenChange={(open) => setDailyActivitiesModal(prev => ({ ...prev, open }))}
        dayName={dailyActivitiesModal.dayName}
        date={dailyActivitiesModal.date}
        targetActivities={dailyData[dailyActivitiesModal.dayId]?.targetActivities || targets.dailyActivities}
        completedActivities={getCompletedBoxCount(dailyActivitiesModal.dayId)}
        onActivityComplete={(activityIndex) => handleDayActivityComplete(dailyActivitiesModal.dayId, activityIndex)}
        onActivityClick={(activityIndex) => handleDayActivityClick(dailyActivitiesModal.dayId, activityIndex)}
        activityBoxes={dailyData[dailyActivitiesModal.dayId]?.activityBoxes || []}
        dayStatus={getDayStatus(dailyActivitiesModal.dayId)}
        isBoxClickable={(activityIndex) => isBoxClickable(dailyActivitiesModal.dayId, activityIndex)}
      />
    </>
  );
}