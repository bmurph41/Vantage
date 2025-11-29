import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Target, Calendar, TrendingUp, BarChart3, ChevronLeft, ChevronRight, Clock, Phone, Mail, Users, ArrowUpRight, ArrowDownRight, Minus, ChevronDown, ChevronUp, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import WeekProspectingModal from "@/components/modals/week-prospecting-modal";
import { ProspectingSettingsDialog } from "@/components/modals/prospecting-settings-dialog";
import { useProspectingEntries, useProspectingRealTime, useWeeklyProspectingMetrics } from "@/hooks/use-prospecting";
import type { ProspectingEntry } from "@shared/schema";
import { format } from "date-fns";

type KpiCardProps = {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  color: string;
  isLoading?: boolean;
};

function KpiCard({ title, value, change, changeLabel, icon: Icon, color, isLoading }: KpiCardProps) {
  const getTrendIcon = () => {
    if (change === undefined) return null;
    if (change > 0) return <ArrowUpRight className="w-3 h-3" />;
    if (change < 0) return <ArrowDownRight className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const getTrendColor = () => {
    if (change === undefined) return "text-gray-500";
    if (change > 0) return "text-green-600";
    if (change < 0) return "text-red-600";
    return "text-gray-500";
  };

  return (
    <Card className="bg-white" data-testid={`kpi-card-${title.toLowerCase().replace(/ /g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500">{title}</p>
            {isLoading ? (
              <Skeleton className="h-6 w-16 mt-1" />
            ) : (
              <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
            )}
            {change !== undefined && (
              <div className={`flex items-center mt-0.5 text-xs ${getTrendColor()}`}>
                {getTrendIcon()}
                <span className="ml-0.5">{Math.abs(change)}% {changeLabel || 'vs last week'}</span>
              </div>
            )}
          </div>
          <div className={`w-10 h-10 ${color} rounded-full flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ISO Week Date Helper Functions

// Get the ISO week number for a given date
function getISOWeekNumber(date: Date): number {
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
  
  // Get first day of year
  const yearStart = new Date(tempDate.getFullYear(), 0, 1);
  
  // Calculate full weeks to nearest Thursday
  const weekNumber = Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  
  return weekNumber;
}

// Get the ISO year for a given date (may differ from calendar year)
function getISOYear(date: Date): number {
  const tempDate = new Date(date.getTime());
  tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
  return tempDate.getFullYear();
}

// Get the first day (Monday) of an ISO week
function getISOWeekStart(year: number, weekNumber: number): Date {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7; // Make Sunday = 7
  const firstMonday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000);
  
  const weekStart = new Date(firstMonday.getTime() + (weekNumber - 1) * 7 * 86400000);
  return weekStart;
}

// Get ISO week dates (Monday to Sunday)
function getISOWeekDates(year: number, weekNumber: number): { weekStart: Date; weekEnd: Date } {
  const weekStart = getISOWeekStart(year, weekNumber);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
  
  return { weekStart, weekEnd };
}

// Get ISO quarter from week number
function getISOQuarter(weekNumber: number): number {
  if (weekNumber <= 13) return 1;
  if (weekNumber <= 26) return 2;
  if (weekNumber <= 39) return 3;
  return 4;
}

// Get week number within ISO quarter
function getWeekInISOQuarter(weekNumber: number): number {
  const quarter = getISOQuarter(weekNumber);
  const quarterStartWeek = (quarter - 1) * 13 + 1;
  return weekNumber - quarterStartWeek + 1;
}

// Get current ISO week and quarter information
function getCurrentISOWeekInfo(date: Date = new Date()): { 
  year: number; 
  weekNumber: number; 
  quarter: number; 
  weekInQuarter: number;
  weekStart: Date;
  weekEnd: Date;
} {
  const year = getISOYear(date);
  const weekNumber = getISOWeekNumber(date);
  const quarter = getISOQuarter(weekNumber);
  const weekInQuarter = getWeekInISOQuarter(weekNumber);
  const { weekStart, weekEnd } = getISOWeekDates(year, weekNumber);
  
  return { year, weekNumber, quarter, weekInQuarter, weekStart, weekEnd };
}

// Get all weeks in an ISO quarter
function getWeeksInISOQuarter(year: number, quarter: number): Array<{
  weekNumber: number;
  weekInQuarter: number;
  weekStart: Date;
  weekEnd: Date;
}> {
  const quarterStartWeek = (quarter - 1) * 13 + 1;
  const weeks = [];
  
  // For most years, we can generate all 13 weeks, but check for year 53 edge case
  // Most years have 52 weeks, some have 53
  const maxWeeks = quarter === 4 ? 13 : 13; // Q4 might have fewer weeks in some years
  
  for (let i = 0; i < maxWeeks; i++) {
    const weekNumber = quarterStartWeek + i;
    
    // For Q4, be more careful about week 53
    if (quarter === 4 && weekNumber > 52) {
      // Check if this year actually has a 53rd week
      const dec28 = new Date(year, 11, 28); // December 28th is always in the last week
      const lastWeek = getISOWeekNumber(dec28);
      if (weekNumber > lastWeek) break;
    }
    
    const { weekStart, weekEnd } = getISOWeekDates(year, weekNumber);
    weeks.push({
      weekNumber,
      weekInQuarter: i + 1,
      weekStart,
      weekEnd
    });
  }
  
  return weeks;
}

// Helper function for backward compatibility - maps to ISO structure
function getWeekInQuarter(date: Date): { quarter: number; weekNumber: number } {
  const info = getCurrentISOWeekInfo(date);
  return { quarter: info.quarter, weekNumber: info.weekInQuarter };
}

// Helper function for backward compatibility - maps to ISO structure
function getWeekDates(year: number, quarter: number, weekInQuarter: number) {
  const actualWeekNumber = (quarter - 1) * 13 + weekInQuarter;
  return getISOWeekDates(year, actualWeekNumber);
}

export default function ProspectingBoard() {
  const currentDate = new Date();
  const currentISOInfo = getCurrentISOWeekInfo(currentDate);
  const currentQuarter = currentISOInfo.quarter;
  const currentWeek = currentISOInfo.weekInQuarter;
  
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter);
  const [selectedWeekInDropdown, setSelectedWeekInDropdown] = useState<string | null>(null);
  const [metricsExpanded, setMetricsExpanded] = useState(true);
  
  const [editingEntry, setEditingEntry] = useState<ProspectingEntry | null>(null);
  const [weekModalOpen, setWeekModalOpen] = useState(false);
  const [selectedWeekData, setSelectedWeekData] = useState<{
    weekNumber: number;
    weekStart: Date;
    weekEnd: Date;
    entry?: ProspectingEntry | null;
  } | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch prospecting entries from database
  const { data: prospectingEntries = [], isLoading } = useProspectingEntries(selectedYear);
  
  // Fetch dashboard stats for KPI cards
  const { data: dashboardStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['/api/prospecting/dashboard-stats'],
  });

  // Fetch leads for lead counts
  const { data: leads } = useQuery({
    queryKey: ['/api/leads'],
  });
  
  // Enable real-time updates
  useProspectingRealTime();
  
  // Calculate lead metrics
  const leadsCount = Array.isArray(leads) ? leads.length : 0;
  const newLeadsThisWeek = Array.isArray(leads) 
    ? leads.filter((l: any) => {
        const createdAt = new Date(l.createdAt);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return createdAt >= weekAgo;
      }).length 
    : 0;

  // Check if we're viewing the current period
  const isCurrentPeriod = selectedYear === currentDate.getFullYear() && selectedQuarter === currentQuarter;

  // Calculate quarterly summary metrics from all entries
  const quarterlyMetrics = useMemo(() => {
    const quarterEntries = prospectingEntries.filter(
      entry => entry.year === selectedYear && entry.quarter === selectedQuarter
    );

    let totalGoals = 0;
    let completedGoals = 0;
    let completedActivities = 0;
    let totalLeads = 0;
    let activitiesTargeted = 0;

    quarterEntries.forEach(entry => {
      // Count weekly goals from entry.goals
      if (entry.goals) {
        const goals = entry.goals as any[];
        goals.forEach(goal => {
          // Handle both string and object formats
          if (!goal) return;
          
          if (typeof goal === 'string' && goal.trim().length > 0) {
            totalGoals += 1;
          } else if (typeof goal === 'object' && goal.text && goal.text.trim().length > 0) {
            totalGoals += 1;
            if (goal.completed === true) {
              completedGoals += 1;
            }
          }
        });
      }
      
      // Calculate metrics from daily data
      if (entry.dailyActivities) {
        const dailyData = entry.dailyActivities as Record<string, any>;
        Object.values(dailyData || {}).forEach((day: any) => {
          // Count daily goals
          if (day.goals) {
            day.goals.forEach((goal: any) => {
              if (!goal) return;
              
              if (typeof goal === 'string' && goal.trim().length > 0) {
                totalGoals += 1;
              } else if (typeof goal === 'object' && goal.text && goal.text.trim().length > 0) {
                totalGoals += 1;
                if (goal.completed === true) {
                  completedGoals += 1;
                }
              }
            });
          }
          
          if (day.activityBoxes) {
            // Count completed activities (activity boxes that are marked complete)
            completedActivities += day.activityBoxes.filter((box: any) => box.completed).length;
            // Sum target activities 
            activitiesTargeted += day.targetActivities || 0;
            // Count lead outcomes from activity boxes
            totalLeads += day.activityBoxes.filter((box: any) => box.completed && box.outcome === 'lead').length;
          }
          
          // Also count leads from activities array (from Add Activity section)
          if (day.activities) {
            totalLeads += day.activities.filter((activity: any) => activity.outcome === 'lead').length;
          }
        });
      }
    });

    const goalAchievement = activitiesTargeted > 0 ? (completedActivities / activitiesTargeted) * 100 : 0;

    return {
      totalGoals,
      completedGoals,
      completedActivities,
      totalLeads,
      goalAchievement: Math.round(goalAchievement)
    };
  }, [prospectingEntries, selectedYear, selectedQuarter]);

  // Generate ISO weeks for the selected quarter
  const weeks = useMemo(() => {
    const isoWeeks = getWeeksInISOQuarter(selectedYear, selectedQuarter);
    
    const allWeeks = isoWeeks.map(week => {
      const existingEntry = prospectingEntries.find(
        entry => entry.year === selectedYear && 
                 entry.quarter === selectedQuarter && 
                 entry.weekNumber === week.weekInQuarter
      );
      
      return {
        weekNumber: week.weekInQuarter,
        isoWeekNumber: week.weekNumber,
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        entry: existingEntry || null
      };
    });

    // If we're viewing the current quarter, put the current week first
    if (isCurrentPeriod) {
      const currentWeekIndex = allWeeks.findIndex(week => week.weekNumber === currentWeek);
      if (currentWeekIndex > -1) {
        const currentWeekData = allWeeks[currentWeekIndex];
        const otherWeeks = allWeeks.filter((_, index) => index !== currentWeekIndex);
        return [currentWeekData, ...otherWeeks];
      }
    }

    return allWeeks;
  }, [selectedYear, selectedQuarter, prospectingEntries, isCurrentPeriod, currentWeek]);

  // Generate ISO quarter tabs with week ranges
  const quarterTabs = useMemo(() => {
    return [
      { value: "1", label: "Q1", weeks: "Weeks 1-13" },
      { value: "2", label: "Q2", weeks: "Weeks 14-26" },
      { value: "3", label: "Q3", weeks: "Weeks 27-39" },
      { value: "4", label: "Q4", weeks: "Weeks 40-52/53" },
    ];
  }, []);

  // Navigation functions
  const goToPreviousQuarter = () => {
    if (selectedQuarter > 1) {
      setSelectedQuarter(selectedQuarter - 1);
    } else {
      setSelectedYear(selectedYear - 1);
      setSelectedQuarter(4);
    }
  };

  const goToNextQuarter = () => {
    if (selectedQuarter < 4) {
      setSelectedQuarter(selectedQuarter + 1);
    } else {
      setSelectedYear(selectedYear + 1);
      setSelectedQuarter(1);
    }
  };

  const goToCurrentWeek = () => {
    setSelectedYear(currentDate.getFullYear());
    setSelectedQuarter(currentQuarter);
    setSelectedWeekInDropdown(currentWeek.toString());
    
    // Scroll to current week
    setTimeout(() => {
      const weekElement = document.querySelector(`[data-testid="week-card-${currentWeek}"]`);
      if (weekElement) {
        weekElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add temporary flash effect
        weekElement.classList.add('animate-pulse', 'bg-blue-50');
        setTimeout(() => {
          weekElement.classList.remove('animate-pulse', 'bg-blue-50');
        }, 1500);
      }
    }, 100);
  };

  const jumpToDate = (date: Date) => {
    const isoInfo = getCurrentISOWeekInfo(date);
    setSelectedYear(isoInfo.year);
    setSelectedQuarter(isoInfo.quarter);
    setSelectedWeekInDropdown(isoInfo.weekInQuarter.toString());
    
    // Scroll to the week card
    setTimeout(() => {
      const weekElement = document.querySelector(`[data-testid="week-card-${isoInfo.weekInQuarter}"]`);
      if (weekElement) {
        weekElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add temporary flash effect
        weekElement.classList.add('animate-pulse', 'bg-blue-50');
        setTimeout(() => {
          weekElement.classList.remove('animate-pulse', 'bg-blue-50');
        }, 1500);
      }
    }, 100);
  };

  const openWeekModal = (weekNumber: number, weekStart: Date, weekEnd: Date, entry?: ProspectingEntry | null) => {
    setSelectedWeekData({
      weekNumber,
      weekStart,
      weekEnd,
      entry
    });
    setWeekModalOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-50">
      {/* Enhanced Header */}
      <div className="flex-shrink-0 bg-white border-b shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Prospecting</h1>
              <p className="text-gray-500 text-sm mt-1">Track your outreach velocity and lead generation</p>
            </div>
            <div className="flex items-center gap-4">
              <ProspectingSettingsDialog />
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={goToCurrentWeek}
                className="flex items-center gap-2"
                data-testid="button-current-week"
              >
                <Clock className="w-4 h-4" />
                Go to Current Week
              </Button>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    data-testid="button-date-picker"
                  >
                    <Calendar className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={new Date(selectedYear, 0, 1)}
                    onSelect={(date) => {
                      if (date) {
                        jumpToDate(date);
                      }
                    }}
                    initialFocus
                    data-testid="calendar-date-picker"
                  />
                </PopoverContent>
              </Popover>
              
              <Input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-20"
                min="2020"
                max="2030"
                data-testid="input-year"
              />
              
              {isCurrentPeriod && (
                <Badge variant="default" className="text-xs bg-green-500">
                  Current Period
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible KPI Metrics Section */}
        <Collapsible open={metricsExpanded} onOpenChange={setMetricsExpanded}>
          <div className="px-6 pb-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-sm font-medium text-gray-700">Performance Metrics</span>
                {metricsExpanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                  title="Total Leads"
                  value={leadsCount}
                  change={12}
                  icon={Users}
                  color="bg-blue-500"
                  isLoading={isLoadingStats}
                />
                <KpiCard
                  title="New This Week"
                  value={newLeadsThisWeek}
                  change={8}
                  icon={Target}
                  color="bg-green-500"
                  isLoading={isLoadingStats}
                />
                <KpiCard
                  title="Calls Made"
                  value={dashboardStats?.callsMade || 0}
                  change={-5}
                  icon={Phone}
                  color="bg-purple-500"
                  isLoading={isLoadingStats}
                />
                <KpiCard
                  title="Emails Sent"
                  value={dashboardStats?.emailsSent || 0}
                  change={15}
                  icon={Mail}
                  color="bg-orange-500"
                  isLoading={isLoadingStats}
                />
              </div>
              
              {/* Weekly Goals Progress */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Card className="bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Weekly Goals</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">Calls</span>
                        <span className="font-medium">{dashboardStats?.callsMade || 0} / 50</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(((dashboardStats?.callsMade || 0) / 50) * 100, 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">Emails</span>
                        <span className="font-medium">{dashboardStats?.emailsSent || 0} / 100</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(((dashboardStats?.emailsSent || 0) / 100) * 100, 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">New Leads</span>
                        <span className="font-medium">{newLeadsThisWeek} / 20</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min((newLeadsThisWeek / 20) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Conversion Funnel</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Touches</span>
                      <div className="flex items-center">
                        <div className="w-24 h-1.5 bg-gray-200 rounded-full mr-2">
                          <div className="w-full h-full bg-blue-500 rounded-full" />
                        </div>
                        <span className="text-xs font-medium">100%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Conversations</span>
                      <div className="flex items-center">
                        <div className="w-24 h-1.5 bg-gray-200 rounded-full mr-2">
                          <div className="w-3/4 h-full bg-green-500 rounded-full" />
                        </div>
                        <span className="text-xs font-medium">42%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Qualified</span>
                      <div className="flex items-center">
                        <div className="w-24 h-1.5 bg-gray-200 rounded-full mr-2">
                          <div className="w-1/2 h-full bg-yellow-500 rounded-full" />
                        </div>
                        <span className="text-xs font-medium">28%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Deals Created</span>
                      <div className="flex items-center">
                        <div className="w-24 h-1.5 bg-gray-200 rounded-full mr-2">
                          <div className="w-1/4 h-full bg-purple-500 rounded-full" />
                        </div>
                        <span className="text-xs font-medium">12%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Enhanced Quarter Navigation */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={goToPreviousQuarter}
                data-testid="button-prev-quarter"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <div className="flex items-center gap-4">
                {quarterTabs.map((quarter) => {
                  const isActive = selectedQuarter.toString() === quarter.value;
                  const isCurrent = currentQuarter.toString() === quarter.value && selectedYear === currentDate.getFullYear();
                  return (
                    <button
                      key={quarter.value}
                      onClick={() => setSelectedQuarter(parseInt(quarter.value))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive 
                          ? 'bg-blue-600 text-white shadow-md' 
                          : isCurrent
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      data-testid={`button-quarter-${quarter.value}`}
                    >
                      <div className="font-semibold">{quarter.label}</div>
                      <div className="text-xs opacity-75">{quarter.weeks}</div>
                    </button>
                  );
                })}
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={goToNextQuarter}
                data-testid="button-next-quarter"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Week Navigation Pills */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Jump to week:</span>
              <Select 
                value={selectedWeekInDropdown || (isCurrentPeriod ? currentWeek.toString() : weeks[0]?.weekNumber.toString() || "1")}
                onValueChange={(value) => {
                  setSelectedWeekInDropdown(value);
                  // Scroll to specific week card
                  setTimeout(() => {
                    const weekElement = document.querySelector(`[data-testid="week-card-${value}"]`);
                    if (weekElement) {
                      weekElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      // Add temporary flash effect
                      weekElement.classList.add('animate-pulse', 'bg-blue-50');
                      setTimeout(() => {
                        weekElement.classList.remove('animate-pulse', 'bg-blue-50');
                      }, 1500);
                    }
                  }, 100);
                }}
              >
                <SelectTrigger className="w-48" data-testid="select-week">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weeks.map((week) => {
                    const startDate = format(week.weekStart, 'M/d');
                    const endDate = format(week.weekEnd, 'M/d');
                    return (
                      <SelectItem key={week.weekNumber} value={week.weekNumber.toString()}>
                        W{week.weekNumber} ({startDate}-{endDate})
                        {isCurrentPeriod && week.weekNumber === currentWeek && " •"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area with Proper Scrolling */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 flex flex-col h-full">
          {/* Quarter Summary - Sticky */}
          <div className="mb-6 flex-shrink-0 sticky top-0 bg-gray-50 pb-4 z-10">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Q{selectedQuarter} {selectedYear} Summary
                  </div>
                  {isCurrentPeriod && (
                    <Badge variant="outline" className="text-xs">
                      Current Quarter
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {quarterlyMetrics.completedGoals}/{quarterlyMetrics.totalGoals}
                    </div>
                    <div className="text-sm text-gray-500">Goals Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{quarterlyMetrics.completedActivities}</div>
                    <div className="text-sm text-gray-500">Completed Activities</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{quarterlyMetrics.totalLeads}</div>
                    <div className="text-sm text-gray-500">Total Leads</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{quarterlyMetrics.goalAchievement}%</div>
                    <div className="text-sm text-gray-500">Activity Achievement</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Cards Grid */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 content-start pb-6">
            {weeks.map(({ weekNumber, isoWeekNumber, weekStart, weekEnd, entry }) => (
              <WeekCard
                key={weekNumber}
                weekNumber={weekNumber}
                isoWeekNumber={isoWeekNumber}
                weekStart={weekStart}
                weekEnd={weekEnd}
                entry={entry}
                isCurrentWeek={isCurrentPeriod && weekNumber === currentWeek}
                onEdit={() => openWeekModal(weekNumber, weekStart, weekEnd, entry)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Week Prospecting Modal */}
      {selectedWeekData && (
        <WeekProspectingModal
          open={weekModalOpen}
          onOpenChange={setWeekModalOpen}
          weekNumber={selectedWeekData.weekNumber}
          weekStart={selectedWeekData.weekStart}
          weekEnd={selectedWeekData.weekEnd}
          year={selectedYear}
          quarter={selectedQuarter}
          entry={selectedWeekData.entry}
        />
      )}
    </div>
  );
}

// Individual Week Card Component
function WeekCard({ 
  weekNumber, 
  isoWeekNumber,
  weekStart, 
  weekEnd, 
  entry, 
  isCurrentWeek = false,
  onEdit 
}: { 
  weekNumber: number;
  isoWeekNumber?: number;
  weekStart: Date;
  weekEnd: Date;
  entry: ProspectingEntry | null;
  isCurrentWeek?: boolean;
  onEdit: () => void;
}) {
  // Use real-time metrics calculation
  const metrics = useWeeklyProspectingMetrics(entry);
  
  // Handle both goal objects and strings for backward compatibility
  const goals = entry?.goals ? (entry.goals as any[]) : [];
  
  // Process goals - handle both string and object formats
  const goalObjects = goals
    .filter(goal => {
      // Filter out empty/null/undefined goals
      if (!goal) return false;
      
      // For string goals, check if not empty
      if (typeof goal === 'string') {
        return goal.trim().length > 0;
      }
      
      // For object goals, check if they have valid text property
      return goal && typeof goal === 'object' && goal.text && typeof goal.text === 'string' && goal.text.trim().length > 0;
    })
    .map(goal => {
      if (typeof goal === 'string') {
        return { 
          id: `goal-${Math.random().toString(36).substr(2, 9)}`,
          text: goal, 
          completed: false,
          type: 'weekly'
        };
      }
      
      // Goal is already an object with proper structure
      return {
        id: goal.id || `goal-${Math.random().toString(36).substr(2, 9)}`,
        text: goal.text,
        completed: Boolean(goal.completed),
        type: goal.type || 'weekly'
      };
    });
  
  const totalGoals = goalObjects.length;
  const completedGoals = goalObjects.filter(goal => goal.completed === true).length;

  return (
    <Card 
      className={`hover:shadow-lg transition-all duration-200 cursor-pointer ${
        isCurrentWeek 
          ? 'ring-2 ring-blue-500 shadow-lg bg-blue-50/50 border-blue-200' 
          : 'border border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
      onClick={onEdit}
      data-testid={`week-card-${weekNumber}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span>Week {weekNumber}</span>
            {isCurrentWeek && (
              <Badge className="text-xs bg-blue-500 hover:bg-blue-600">
                Current
              </Badge>
            )}
          </CardTitle>
          <Edit className="w-4 h-4 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">
          {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Goals Section - Modernized */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500 rounded-lg shadow-sm">
                <Target className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-800">
                Weekly Goals
              </span>
            </div>
            {totalGoals > 0 && (
              <Badge 
                className={`text-xs font-semibold shadow-sm ${
                  completedGoals === totalGoals && totalGoals > 0
                    ? 'bg-green-500 text-white hover:bg-green-600' 
                    : completedGoals > 0
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-400 text-white'
                }`}
              >
                {completedGoals}/{totalGoals}
              </Badge>
            )}
          </div>
          {totalGoals > 0 ? (
            <div className="space-y-2">
              {goalObjects.slice(0, 2).map((goal, index) => (
                <div 
                  key={index} 
                  className={`text-xs font-medium flex items-start gap-2 p-2 rounded-lg transition-colors ${
                    goal.completed 
                      ? 'bg-white/60 text-green-700' 
                      : 'bg-white/40 text-gray-800'
                  }`}
                >
                  <div className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center ${
                    goal.completed 
                      ? 'bg-green-500 text-white' 
                      : 'border-2 border-gray-400'
                  }`}>
                    {goal.completed && <span className="text-xs leading-none">✓</span>}
                  </div>
                  <span className={`flex-1 leading-relaxed ${goal.completed ? 'line-through opacity-75' : ''}`}>
                    {goal.text}
                  </span>
                </div>
              ))}
              {totalGoals > 2 && (
                <div className="text-xs text-blue-700 font-semibold pl-2 flex items-center gap-1">
                  <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                  {totalGoals - 2} more goal{totalGoals > 3 ? 's' : ''}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-3">
              <div className="text-xs text-blue-600 font-medium">No goals set yet</div>
              <div className="text-xs text-gray-500 mt-1">Click to add your weekly goals</div>
            </div>
          )}
        </div>

        {/* Daily Activity Grid */}
        <div className="bg-gray-50 border rounded-lg p-3">
          <div className="text-sm font-medium mb-3 text-gray-700">Daily Progress</div>
          <div className="grid gap-2" style={{ 
            gridTemplateColumns: `repeat(${(entry?.enabledDays as string[] || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']).length}, minmax(0, 1fr))` 
          }}>
            {((entry?.enabledDays as string[]) || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']).map((dayKey, index) => {
              const dayMapping: Record<string, string> = {
                'monday': 'Mon',
                'tuesday': 'Tue',
                'wednesday': 'Wed',
                'thursday': 'Thu',
                'friday': 'Fri',
                'saturday': 'Sat',
                'sunday': 'Sun'
              };
              
              const day = dayMapping[dayKey];
              if (!day) return null;
              
              // Calculate completion percentage for this day
              const dailyData = entry?.dailyActivities ? (entry.dailyActivities as Record<string, any>)[dayKey] : null;
              
              let completionPercent = 0;
              if (dailyData?.activityBoxes && dailyData?.targetActivities > 0) {
                const completedActivities = dailyData.activityBoxes.filter((box: any) => box.completed).length;
                completionPercent = Math.round((completedActivities / dailyData.targetActivities) * 100);
              }
              
              // Helper function to generate red-to-green gradient color based on percentage
              const getProgressColor = (percent: number): string => {
                if (percent === 0) return 'rgb(229, 231, 235)'; // gray-200 for no progress
                
                // Red to Yellow to Green gradient
                // 0-50%: Red (0deg) to Yellow (50deg)
                // 50-100%: Yellow (50deg) to Green (120deg)
                let hue: number;
                if (percent <= 50) {
                  // Red to Yellow: 0 to 50 hue
                  hue = percent; // 0% = 0deg (red), 50% = 50deg (yellow)
                } else {
                  // Yellow to Green: 50 to 120 hue
                  hue = 50 + ((percent - 50) * 1.4); // 50% = 50deg (yellow), 100% = 120deg (green)
                }
                
                // Adjust saturation and lightness for better visual appeal
                const saturation = percent > 0 ? 75 : 0;
                const lightness = 50;
                
                return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
              };
              
              return (
                <div key={`${dayKey}-${index}`} className="text-center">
                  <div className="text-xs font-medium text-gray-600 mb-2">{day}</div>
                  <div className="space-y-1">
                    {/* Progress bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.max(completionPercent, 0)}%`,
                          backgroundColor: getProgressColor(completionPercent)
                        }}
                        title={`${completionPercent}% completed`}
                      />
                    </div>
                    {/* Completion percentage text */}
                    <div className="text-xs text-gray-500 font-medium">
                      {completionPercent}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Stats - Real-time data */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
          <div className="text-center p-2 rounded-lg bg-green-50">
            <div className="text-lg font-bold text-green-600">{metrics.leadsGenerated}</div>
            <div className="text-xs text-gray-600 font-medium">Leads Generated</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-blue-50">
            <div className="text-lg font-bold text-blue-600">{metrics.totalActivities}</div>
            <div className="text-xs text-gray-600 font-medium">Total Activities</div>
          </div>
        </div>

        {/* Quick Action Hint */}
        <div className="text-center">
          <div className="text-xs text-gray-400 italic">Click anywhere to track this week</div>
        </div>
      </CardContent>
    </Card>
  );
}
