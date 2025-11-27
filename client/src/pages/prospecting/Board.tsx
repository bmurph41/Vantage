import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Phone, Mail, Calendar, Target, Plus, ChevronLeft, ChevronRight,
  Check, Clock, TrendingUp
} from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";

type WeekDay = {
  date: Date;
  calls: number;
  emails: number;
  meetings: number;
  leads: number;
};

export default function ProspectingBoard() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

  const goToPreviousWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const goToNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const goToCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const weekDays: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + i);
    return {
      date,
      calls: Math.floor(Math.random() * 10),
      emails: Math.floor(Math.random() * 15),
      meetings: Math.floor(Math.random() * 3),
      leads: Math.floor(Math.random() * 5),
    };
  });

  const weeklyTotals = weekDays.reduce(
    (acc, day) => ({
      calls: acc.calls + day.calls,
      emails: acc.emails + day.emails,
      meetings: acc.meetings + day.meetings,
      leads: acc.leads + day.leads,
    }),
    { calls: 0, emails: 0, meetings: 0, leads: 0 }
  );

  const weeklyGoals = {
    calls: 50,
    emails: 100,
    meetings: 10,
    leads: 20,
  };

  const isCurrentWeek = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime() === currentWeekStart.getTime();

  return (
    <div className="flex-1 overflow-auto p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Prospecting Board</h1>
            <p className="text-gray-500 mt-1">Track your weekly outreach activities</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={goToPreviousWeek} data-testid="button-prev-week">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant={isCurrentWeek ? "default" : "outline"} 
              size="sm" 
              onClick={goToCurrentWeek}
              data-testid="button-current-week"
            >
              This Week
            </Button>
            <Button variant="outline" size="sm" onClick={goToNextWeek} data-testid="button-next-week">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold text-gray-700">
            {format(currentWeekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <Phone className="w-4 h-4 text-blue-500 mr-2" />
                  <span className="text-sm font-medium">Calls</span>
                </div>
                <span className="text-lg font-bold">{weeklyTotals.calls} / {weeklyGoals.calls}</span>
              </div>
              <Progress value={(weeklyTotals.calls / weeklyGoals.calls) * 100} className="h-2" />
            </CardContent>
          </Card>
          
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <Mail className="w-4 h-4 text-green-500 mr-2" />
                  <span className="text-sm font-medium">Emails</span>
                </div>
                <span className="text-lg font-bold">{weeklyTotals.emails} / {weeklyGoals.emails}</span>
              </div>
              <Progress value={(weeklyTotals.emails / weeklyGoals.emails) * 100} className="h-2" />
            </CardContent>
          </Card>
          
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 text-purple-500 mr-2" />
                  <span className="text-sm font-medium">Meetings</span>
                </div>
                <span className="text-lg font-bold">{weeklyTotals.meetings} / {weeklyGoals.meetings}</span>
              </div>
              <Progress value={(weeklyTotals.meetings / weeklyGoals.meetings) * 100} className="h-2" />
            </CardContent>
          </Card>
          
          <Card className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <Target className="w-4 h-4 text-orange-500 mr-2" />
                  <span className="text-sm font-medium">New Leads</span>
                </div>
                <span className="text-lg font-bold">{weeklyTotals.leads} / {weeklyGoals.leads}</span>
              </div>
              <Progress value={(weeklyTotals.leads / weeklyGoals.leads) * 100} className="h-2" />
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Daily Activity Tracker</CardTitle>
            <CardDescription>Log your daily prospecting activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Day</th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-gray-500">
                      <div className="flex items-center justify-center">
                        <Phone className="w-4 h-4 mr-1" /> Calls
                      </div>
                    </th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-gray-500">
                      <div className="flex items-center justify-center">
                        <Mail className="w-4 h-4 mr-1" /> Emails
                      </div>
                    </th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-gray-500">
                      <div className="flex items-center justify-center">
                        <Calendar className="w-4 h-4 mr-1" /> Meetings
                      </div>
                    </th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-gray-500">
                      <div className="flex items-center justify-center">
                        <Target className="w-4 h-4 mr-1" /> Leads
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {weekDays.map((day, index) => {
                    const isToday = new Date().toDateString() === day.date.toDateString();
                    return (
                      <tr key={index} className={`border-b ${isToday ? 'bg-blue-50' : ''}`}>
                        <td className="py-3 px-2">
                          <div className="flex items-center">
                            <span className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                              {format(day.date, 'EEE')}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              {format(day.date, 'MMM d')}
                            </span>
                            {isToday && (
                              <Badge variant="secondary" className="ml-2 text-xs">Today</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <Input 
                            type="number" 
                            className="w-20 text-center mx-auto h-8" 
                            defaultValue={day.calls}
                            min={0}
                            data-testid={`input-calls-${index}`}
                          />
                        </td>
                        <td className="py-3 px-2">
                          <Input 
                            type="number" 
                            className="w-20 text-center mx-auto h-8" 
                            defaultValue={day.emails}
                            min={0}
                            data-testid={`input-emails-${index}`}
                          />
                        </td>
                        <td className="py-3 px-2">
                          <Input 
                            type="number" 
                            className="w-20 text-center mx-auto h-8" 
                            defaultValue={day.meetings}
                            min={0}
                            data-testid={`input-meetings-${index}`}
                          />
                        </td>
                        <td className="py-3 px-2">
                          <Input 
                            type="number" 
                            className="w-20 text-center mx-auto h-8" 
                            defaultValue={day.leads}
                            min={0}
                            data-testid={`input-leads-${index}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-medium">
                    <td className="py-3 px-2 text-sm text-gray-700">Weekly Total</td>
                    <td className="py-3 px-2 text-center text-sm text-gray-900">{weeklyTotals.calls}</td>
                    <td className="py-3 px-2 text-center text-sm text-gray-900">{weeklyTotals.emails}</td>
                    <td className="py-3 px-2 text-center text-sm text-gray-900">{weeklyTotals.meetings}</td>
                    <td className="py-3 px-2 text-center text-sm text-gray-900">{weeklyTotals.leads}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end mt-4">
          <Button data-testid="button-save-week">
            <Check className="w-4 h-4 mr-2" />
            Save Week
          </Button>
        </div>
      </div>
    </div>
  );
}
