import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { User, CheckCircle, Clock, PlayCircle, Calendar } from "lucide-react";
import type { Task } from "@shared/schema";

interface TaskOwnersViewProps {
  tasks: Task[];
}

interface OwnerStats {
  name: string;
  totalTasks: number;
  notStarted: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  contributionPercent: number;
  overallProgress: number;
}

export function TaskOwnersView({ tasks }: TaskOwnersViewProps) {
  // Calculate stats by owner
  const calculateOwnerStats = (): OwnerStats[] => {
    const ownerMap = new Map<string, {
      totalTasks: number;
      notStarted: number;
      scheduled: number;
      inProgress: number;
      completed: number;
    }>();

    // Count tasks by owner and status
    tasks.forEach(task => {
      const owner = task.assignee || "Unassigned";
      
      if (!ownerMap.has(owner)) {
        ownerMap.set(owner, {
          totalTasks: 0,
          notStarted: 0,
          scheduled: 0,
          inProgress: 0,
          completed: 0,
        });
      }

      const stats = ownerMap.get(owner)!;
      stats.totalTasks++;

      switch (task.status) {
        case 'not_started':
          stats.notStarted++;
          break;
        case 'scheduled':
          stats.scheduled++;
          break;
        case 'in_progress':
          stats.inProgress++;
          break;
        case 'completed':
          stats.completed++;
          break;
      }
    });

    const totalDistributedTasks = tasks.length;

    // Convert to OwnerStats array with calculations
    return Array.from(ownerMap.entries()).map(([name, counts]) => {
      const contributionPercent = totalDistributedTasks > 0 
        ? Math.round((counts.totalTasks / totalDistributedTasks) * 100)
        : 0;

      const overallProgress = counts.totalTasks > 0 
        ? Math.round((counts.completed / counts.totalTasks) * 100)
        : 0;

      return {
        name,
        ...counts,
        contributionPercent,
        overallProgress,
      };
    }).sort((a, b) => b.totalTasks - a.totalTasks); // Sort by task count descending
  };

  const ownerStats = calculateOwnerStats();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'in_progress':
        return 'text-blue-600 bg-blue-100';
      case 'scheduled':
        return 'text-blue-600 bg-blue-100';
      case 'not_started':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'in_progress':
        return <PlayCircle className="w-4 h-4" />;
      case 'scheduled':
        return <Calendar className="w-4 h-4" />;
      case 'not_started':
        return <Clock className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6" data-testid="task-owners-view">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Task Owners Overview</h2>
        <Badge variant="outline" className="text-sm">
          Total Tasks: {tasks.length}
        </Badge>
      </div>

      <div className="grid gap-6">
        {ownerStats.map((owner) => (
          <Card key={owner.name} className="overflow-hidden" data-testid={`owner-card-${owner.name}`}>
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">
                      {owner.name}
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      {owner.totalTasks} tasks • {owner.contributionPercent}% of project
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {owner.overallProgress}%
                  </div>
                  <p className="text-xs text-gray-500">Overall Progress</p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">{owner.completed}/{owner.totalTasks} completed</span>
                  </div>
                  <Progress 
                    value={owner.overallProgress} 
                    className="h-2"
                    data-testid={`progress-${owner.name}`}
                  />
                </div>

                {/* Status Breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className={`flex items-center space-x-2 p-3 rounded-lg ${getStatusColor('not_started')}`}>
                    {getStatusIcon('not_started')}
                    <div>
                      <div className="font-semibold" data-testid={`not-started-${owner.name}`}>
                        {owner.notStarted}
                      </div>
                      <div className="text-xs">Not Started</div>
                    </div>
                  </div>

                  <div className={`flex items-center space-x-2 p-3 rounded-lg ${getStatusColor('scheduled')}`}>
                    {getStatusIcon('scheduled')}
                    <div>
                      <div className="font-semibold" data-testid={`scheduled-${owner.name}`}>
                        {owner.scheduled}
                      </div>
                      <div className="text-xs">Scheduled</div>
                    </div>
                  </div>

                  <div className={`flex items-center space-x-2 p-3 rounded-lg ${getStatusColor('in_progress')}`}>
                    {getStatusIcon('in_progress')}
                    <div>
                      <div className="font-semibold" data-testid={`in-progress-${owner.name}`}>
                        {owner.inProgress}
                      </div>
                      <div className="text-xs">In Progress</div>
                    </div>
                  </div>

                  <div className={`flex items-center space-x-2 p-3 rounded-lg ${getStatusColor('completed')}`}>
                    {getStatusIcon('completed')}
                    <div>
                      <div className="font-semibold" data-testid={`completed-${owner.name}`}>
                        {owner.completed}
                      </div>
                      <div className="text-xs">Completed</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {ownerStats.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Task Owners</h3>
              <p className="text-gray-600">
                Tasks haven't been assigned to any team members yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}