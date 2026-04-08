import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Target, Calendar, TrendingUp, BarChart3, ChevronLeft, ChevronRight, Clock, Phone, Mail, Users, ArrowUpRight, ArrowDownRight, Minus, RefreshCcw, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import WeekProspectingModal from "@/components/modals/week-prospecting-modal";
import { ProspectingSettingsDialog } from "@/components/modals/prospecting-settings-dialog";
import { useProspectingEntries, useProspectingRealTime, useWeeklyProspectingMetrics } from "@/hooks/use-prospecting";
import type { ProspectingEntry } from "@shared/schema";
import { format } from "date-fns";
import { Link } from "wouter";

function getISOWeekNumber(date: Date): number {
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
  const yearStart = new Date(tempDate.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNumber;
}

function getISOYear(date: Date): number {
  const tempDate = new Date(date.getTime());
  tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
  return tempDate.getFullYear();
}

function getISOWeekStart(year: number, weekNumber: number): Date {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const firstMonday = new Date(jan4.getTime() - (jan4Day - 1) * 86400000);
  const weekStart = new Date(firstMonday.getTime() + (weekNumber - 1) * 7 * 86400000);
  return weekStart;
}

function getISOWeekDates(year: number, weekNumber: number): { weekStart: Date; weekEnd: Date } {
  const weekStart = getISOWeekStart(year, weekNumber);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
  return { weekStart, weekEnd };
}

function getISOQuarter(weekNumber: number): number {
  if (weekNumber <= 13) return 1;
  if (weekNumber <= 26) return 2;
  if (weekNumber <= 39) return 3;
  return 4;
}

function getWeekInISOQuarter(weekNumber: number): number {
  const quarter = getISOQuarter(weekNumber);
  const quarterStartWeek = (quarter - 1) * 13 + 1;
  return weekNumber - quarterStartWeek + 1;
}

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

function getWeeksInISOQuarter(year: number, quarter: number): Array<{
  weekNumber: number;
  weekInQuarter: number;
  weekStart: Date;
  weekEnd: Date;
}> {
  const quarterStartWeek = (quarter - 1) * 13 + 1;
  const weeks = [];
  const maxWeeks = 13;
  
  for (let i = 0; i < maxWeeks; i++) {
    const weekNumber = quarterStartWeek + i;
    if (quarter === 4 && weekNumber > 52) {
      const dec28 = new Date(year, 11, 28);
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

export default function ProspectingWorkroom() {
  const currentDate = new Date();
  const currentISOInfo = getCurrentISOWeekInfo(currentDate);
  const currentQuarter = currentISOInfo.quarter;
  const currentWeek = currentISOInfo.weekInQuarter;
  
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter);
  const [selectedWeekInDropdown, setSelectedWeekInDropdown] = useState<string | null>(null);
  
  const [weekModalOpen, setWeekModalOpen] = useState(false);
  const [selectedWeekData, setSelectedWeekData] = useState<{
    weekNumber: number;
    weekStart: Date;
    weekEnd: Date;
    entry?: ProspectingEntry | null;
  } | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prospectingEntries = [], isLoading } = useProspectingEntries(selectedYear);
  
  const { data: settings } = useQuery<{
    weeklyCallsGoal?: number;
    weeklyEmailsGoal?: number;
    weeklyLeadsGoal?: number;
  }>({
    queryKey: ['/api/prospecting/settings'],
  });
  
  useProspectingRealTime();

  const isCurrentPeriod = selectedYear === currentDate.getFullYear() && selectedQuarter === currentQuarter;

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
      if (entry.goals) {
        const goals = entry.goals as any[];
        goals.forEach(goal => {
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
      
      if (entry.dailyActivities) {
        const dailyData = entry.dailyActivities as Record<string, any>;
        Object.values(dailyData || {}).forEach((day: any) => {
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
            completedActivities += day.activityBoxes.filter((box: any) => box.completed).length;
            activitiesTargeted += day.targetActivities || 0;
            totalLeads += day.activityBoxes.filter((box: any) => box.completed && box.outcome === 'lead').length;
          }
          
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
    
    setTimeout(() => {
      const weekElement = document.querySelector(`[data-testid="week-card-${currentWeek}"]`);
      if (weekElement) {
        weekElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    
    setTimeout(() => {
      const weekElement = document.querySelector(`[data-testid="week-card-${isoInfo.weekInQuarter}"]`);
      if (weekElement) {
        weekElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  const getWeekProgress = (entry: ProspectingEntry | null) => {
    if (!entry?.dailyActivities) return { total: 0, completed: 0, percentage: 0 };
    
    const dailyData = entry.dailyActivities as Record<string, any>;
    let total = 0;
    let completed = 0;
    
    Object.values(dailyData).forEach((day: any) => {
      if (day.activityBoxes) {
        total += day.activityBoxes.length;
        completed += day.activityBoxes.filter((box: any) => box.completed).length;
      }
    });
    
    return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  const getWeekLeads = (entry: ProspectingEntry | null): number => {
    if (!entry?.dailyActivities) return 0;
    
    const dailyData = entry.dailyActivities as Record<string, any>;
    let leads = 0;
    
    Object.values(dailyData).forEach((day: any) => {
      if (day.activityBoxes) {
        leads += day.activityBoxes.filter((box: any) => box.completed && box.outcome === 'lead').length;
      }
      if (day.activities) {
        leads += day.activities.filter((activity: any) => activity.outcome === 'lead').length;
      }
    });
    
    return leads;
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      <div className="flex-shrink-0 bg-white border-b shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Workroom</h1>
              <p className="text-gray-500 text-sm mt-1">Track your weekly goals, activities, and prospecting progress</p>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/prospecting" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800">
                <BarChart3 className="w-4 h-4" />
                View Analytics
                <ExternalLink className="w-3 h-3" />
              </Link>
              <ProspectingSettingsDialog />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={goToCurrentWeek}
                className="flex items-center gap-2"
                data-testid="button-current-week"
              >
                <Clock className="w-4 h-4" />
                Current Week
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-jump-to-date">
                    <Calendar className="w-4 h-4 mr-2" />
                    Jump to Date
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="single"
                    selected={undefined}
                    onSelect={(date) => date && jumpToDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Card className="bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={goToPreviousQuarter} data-testid="button-prev-quarter">
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    <h2 className="text-xl font-bold">Q{selectedQuarter} {selectedYear} Summary</h2>
                    {isCurrentPeriod && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">Current Quarter</Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={goToNextQuarter} data-testid="button-next-quarter">
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
                <Select 
                  value={selectedWeekInDropdown || ""} 
                  onValueChange={(value) => setSelectedWeekInDropdown(value)}
                >
                  <SelectTrigger className="w-[140px]" data-testid="select-week">
                    <SelectValue placeholder="Jump to week" />
                  </SelectTrigger>
                  <SelectContent>
                    {weeks.map(week => (
                      <SelectItem key={week.weekNumber} value={week.weekNumber.toString()}>
                        Week {week.weekNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {quarterlyMetrics.completedGoals}/{quarterlyMetrics.totalGoals}
                  </div>
                  <div className="text-sm text-gray-500">Goals Completed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {quarterlyMetrics.completedActivities}
                  </div>
                  <div className="text-sm text-gray-500">Completed Activities</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {quarterlyMetrics.totalLeads}
                  </div>
                  <div className="text-sm text-gray-500">Total Leads</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {quarterlyMetrics.goalAchievement}%
                  </div>
                  <div className="text-sm text-gray-500">Activity Achievement</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {weeks.map((week, index) => {
                const isCurrentWeek = isCurrentPeriod && week.weekNumber === currentWeek;
                const progress = getWeekProgress(week.entry);
                const leads = getWeekLeads(week.entry);
                const goals = week.entry?.goals as any[] || [];
                const hasGoals = goals.length > 0;

                return (
                  <Card 
                    key={week.weekNumber}
                    className={`cursor-pointer hover:shadow-lg transition-all ${
                      isCurrentWeek ? 'ring-2 ring-blue-500 bg-blue-50/30' : 'bg-white'
                    }`}
                    onClick={() => openWeekModal(week.weekNumber, week.weekStart, week.weekEnd, week.entry)}
                    data-testid={`week-card-${week.weekNumber}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          Week {week.weekNumber}
                          {isCurrentWeek && (
                            <Badge className="bg-blue-500 text-white text-xs">Current</Badge>
                          )}
                        </CardTitle>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </div>
                      <CardDescription className="text-xs">
                        {format(week.weekStart, 'MMM d')} - {format(week.weekEnd, 'MMM d')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium">Weekly Goals</span>
                        </div>
                        {hasGoals ? (
                          <div className="text-xs text-gray-600">
                            {goals.filter((g: any) => typeof g === 'object' ? g.completed : false).length} of {goals.length} completed
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 italic">No goals set yet</div>
                        )}
                        <div className="text-xs text-blue-600 mt-1">
                          Click to add your weekly goals
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-2">Daily Progress</div>
                        <div className="flex gap-1">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, i) => {
                            const dayData = week.entry?.dailyActivities as Record<string, any>;
                            const dayKey = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'][i];
                            const dayProgress = dayData?.[dayKey]?.activityBoxes?.filter((b: any) => b.completed).length || 0;
                            const dayTotal = dayData?.[dayKey]?.activityBoxes?.length || 0;
                            const percentage = dayTotal > 0 ? Math.round((dayProgress / dayTotal) * 100) : 0;
                            
                            return (
                              <div key={day} className="flex-1 text-center">
                                <div className="text-xs text-gray-400 mb-1">{day}</div>
                                <div className="text-xs font-medium">{percentage}%</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="bg-green-50 rounded-lg p-2 text-center">
                          <div className="text-lg font-bold text-green-600">{leads}</div>
                          <div className="text-xs text-gray-500">Leads Generated</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2 text-center">
                          <div className="text-lg font-bold text-blue-600">{progress.completed}</div>
                          <div className="text-xs text-gray-500">Total Activities</div>
                        </div>
                      </div>

                      <div className="text-xs text-center text-blue-600">
                        Click anywhere to track this week
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedWeekData && (
        <WeekProspectingModal
          open={weekModalOpen}
          onOpenChange={setWeekModalOpen}
          weekNumber={selectedWeekData.weekNumber}
          weekStart={selectedWeekData.weekStart}
          weekEnd={selectedWeekData.weekEnd}
          entry={selectedWeekData.entry}
          year={selectedYear}
          quarter={selectedQuarter}
        />
      )}
    </div>
  );
}
