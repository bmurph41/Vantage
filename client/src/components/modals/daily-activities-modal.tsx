import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Calendar, 
  Target, 
  Check, 
  Plus,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DailyActivitiesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayName: string;
  date: Date;
  targetActivities: number;
  completedActivities: number;
  onActivityComplete: (activityIndex: number) => void;
  onActivityClick: (activityIndex: number) => void;
  activityBoxes: Array<{
    id: string;
    completed: boolean;
    type?: string;
    outcome?: string;
    notes?: string;
  }>;
  dayStatus: 'past' | 'current' | 'future';
  isBoxClickable: (activityIndex: number) => boolean;
}

export function DailyActivitiesModal({
  open,
  onOpenChange,
  dayName,
  date,
  targetActivities,
  completedActivities,
  onActivityComplete,
  onActivityClick,
  activityBoxes,
  dayStatus,
  isBoxClickable
}: DailyActivitiesModalProps) {
  const { toast } = useToast();
  const [selectedBox, setSelectedBox] = useState<number | null>(null);
  const [showPastDayWarning, setShowPastDayWarning] = useState(false);
  const [pendingBoxIndex, setPendingBoxIndex] = useState<number | null>(null);

  // Generate activity boxes based on target (minimum 16 boxes as shown in image)
  const totalBoxes = Math.max(16, targetActivities);
  const boxes = Array.from({ length: totalBoxes }, (_, index) => {
    const existingBox = activityBoxes[index];
    return {
      id: existingBox?.id || `box-${index}`,
      completed: existingBox?.completed || false,
      type: existingBox?.type,
      outcome: existingBox?.outcome,
      notes: existingBox?.notes,
      index
    };
  });

  const handleBoxClick = (index: number) => {
    const box = boxes[index];
    setSelectedBox(index);
    
    // Completely prevent future day access
    if (dayStatus === 'future') {
      toast({
        title: "Future Day",
        description: `Cannot access activities for future days. Wait until ${dayName}.`,
        variant: "destructive"
      });
      return;
    }
    
    // For past days, show warning but allow editing
    if (dayStatus === 'past') {
      setPendingBoxIndex(index);
      setShowPastDayWarning(true);
      return;
    }
    
    // For current day, proceed with normal logic
    if (!isBoxClickable(index)) {
      toast({
        title: "Not Available",
        description: "Complete previous activities first.",
        variant: "destructive"
      });
      return;
    }
    
    proceedWithBoxAction(index);
  };

  const proceedWithBoxAction = (index: number) => {
    const box = boxes[index];
    
    if (!box.completed) {
      // If not completed and clickable, mark as completed and open activity details
      onActivityComplete(index);
      onActivityClick(index);
      
      toast({
        title: "Activity Logged",
        description: `Activity ${index + 1} completed for ${dayName}`,
      });
    } else {
      // If already completed, allow editing
      onActivityClick(index);
    }
  };

  const handlePastDayConfirm = () => {
    if (pendingBoxIndex !== null) {
      proceedWithBoxAction(pendingBoxIndex);
    }
    setShowPastDayWarning(false);
    setPendingBoxIndex(null);
  };

  const handlePastDayCancel = () => {
    setShowPastDayWarning(false);
    setPendingBoxIndex(null);
  };

  const completionPercentage = totalBoxes > 0 ? (completedActivities / totalBoxes) * 100 : 0;
  const nextAvailableIndex = boxes.findIndex(box => !box.completed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-600" />
            <span>{dayName} Activities</span>
            <Badge variant="outline" className="ml-auto">
              {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Track your daily prospecting activities. Click on boxes to log activity details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-green-600" />
                Daily Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{completedActivities}</div>
                  <p className="text-sm text-gray-600">Completed</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{targetActivities}</div>
                  <p className="text-sm text-gray-600">Target</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{Math.round(completionPercentage)}%</div>
                  <p className="text-sm text-gray-600">Progress</p>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all duration-300 ${
                    completionPercentage >= 100 ? 'bg-green-500' : 
                    completionPercentage >= 75 ? 'bg-blue-500' :
                    completionPercentage >= 50 ? 'bg-yellow-500' : 'bg-gray-400'
                  }`}
                  style={{ width: `${Math.min(100, completionPercentage)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Activity Tracking Boxes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Activity Tracking Boxes
                <Badge variant="secondary" className="ml-auto">
                  {completedActivities}/{totalBoxes}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  Click on boxes to log outreach activities. Green boxes are completed, blue box is next to complete.
                </p>
                
                {/* Activity Boxes Grid - Matching the attached image layout */}
                <div className="grid grid-cols-8 md:grid-cols-16 gap-2 p-4 bg-gray-50 rounded-lg">
                  {boxes.map((box, index) => {
                    const isCompleted = box.completed;
                    const isNext = index === nextAvailableIndex && !isCompleted;
                    const isSelected = selectedBox === index;
                    
                    let boxStyle = '';
                    let titleText = '';
                    
                    if (isCompleted) {
                      boxStyle = isSelected 
                        ? 'bg-green-600 border-green-700 text-white shadow-lg ring-2 ring-green-300' 
                        : 'bg-green-500 border-green-600 text-white shadow-md hover:bg-green-600 cursor-pointer';
                      titleText = `Activity ${index + 1} - Completed${box.type ? ` (${box.type})` : ''}`;
                    } else if (isNext) {
                      boxStyle = isSelected 
                        ? 'bg-blue-600 border-blue-700 text-white shadow-lg ring-2 ring-blue-300' 
                        : 'bg-blue-500 border-blue-600 text-white shadow-md hover:bg-blue-600 cursor-pointer';
                      titleText = `Activity ${index + 1} - Next to complete`;
                    } else {
                      boxStyle = isSelected 
                        ? 'bg-gray-400 border-gray-500 text-gray-700 ring-2 ring-gray-300' 
                        : 'bg-gray-200 border-gray-300 text-gray-500 hover:bg-gray-300 cursor-pointer';
                      titleText = `Activity ${index + 1} - Available`;
                    }
                    
                    return (
                      <div
                        key={box.id}
                        className={`w-8 h-8 rounded-lg border-2 transition-all duration-200 flex items-center justify-center shadow-sm ${boxStyle}`}
                        onClick={() => handleBoxClick(index)}
                        title={titleText}
                        data-testid={`daily-activity-box-${index}`}
                      >
                        {isCompleted ? (
                          <Check className="w-5 h-5" />
                        ) : isNext ? (
                          <span className="text-xs font-bold">{index + 1}</span>
                        ) : (
                          <span className="text-xs font-medium">{index + 1}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded border border-green-600"></div>
                    <span className="text-sm text-gray-700">Completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded border border-blue-600"></div>
                    <span className="text-sm text-gray-700">Next Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-200 rounded border border-gray-300"></div>
                    <span className="text-sm text-gray-700">Available</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                <Button 
                  size="sm" 
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => {
                    if (nextAvailableIndex !== -1 && isBoxClickable(nextAvailableIndex)) {
                      handleBoxClick(nextAvailableIndex);
                    }
                  }}
                  disabled={nextAvailableIndex === -1 || !isBoxClickable(nextAvailableIndex)}
                  data-testid="button-log-next-activity"
                >
                  <Plus className="w-4 h-4" />
                  Log Next Activity
                </Button>
                
                <Button 
                  size="sm" 
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => {
                    // Prevent future day bulk logging entirely
                    if (dayStatus === 'future') {
                      toast({
                        title: "Future Day",
                        description: `Cannot log activities for future days. Wait until ${dayName}.`,
                        variant: "destructive"
                      });
                      return;
                    }
                    
                    // For past days, show warning for bulk action
                    if (dayStatus === 'past') {
                      toast({
                        title: "Past Day Bulk Action",
                        description: "Use individual boxes to edit past day activities with confirmation.",
                        variant: "destructive"
                      });
                      return;
                    }
                    
                    // Only allow bulk logging for current day
                    const nextFive = boxes.slice(completedActivities, completedActivities + 5);
                    let loggedCount = 0;
                    
                    nextFive.forEach((_, index) => {
                      const boxIndex = completedActivities + index;
                      if (isBoxClickable(boxIndex)) {
                        onActivityComplete(boxIndex);
                        loggedCount++;
                      }
                    });
                    
                    if (loggedCount > 0) {
                      toast({
                        title: "Bulk Activities Logged",
                        description: `Marked ${loggedCount} activities as complete`,
                      });
                    } else {
                      toast({
                        title: "Cannot Log Activities",
                        description: "No activities are available to log.",
                        variant: "destructive"
                      });
                    }
                  }}
                  disabled={completedActivities >= totalBoxes || dayStatus !== 'current'}
                  data-testid="button-quick-log-five"
                >
                  <CheckCircle className="w-4 h-4" />
                  Quick Log 5
                </Button>

                <div className="ml-auto flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>Updated: {new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Summary */}
          {completedActivities > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Today's Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                    <span className="text-sm font-medium text-green-700">Activities Completed</span>
                    <span className="text-sm font-bold text-green-800">{completedActivities}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                    <span className="text-sm font-medium text-blue-700">Progress Rate</span>
                    <span className="text-sm font-bold text-blue-800">{Math.round(completionPercentage)}%</span>
                  </div>
                  {completionPercentage >= 100 && (
                    <div className="flex items-center justify-center p-3 bg-green-100 rounded-lg border border-green-300">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      <span className="text-sm font-semibold text-green-800">🎉 Daily target achieved!</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>

      {/* Past Day Warning Dialog */}
      <AlertDialog open={showPastDayWarning} onOpenChange={setShowPastDayWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Editing Past Day Activity
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to edit an activity from <strong>{dayName}</strong>, which is a past day. 
              <br /><br />
              This will modify historical data. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handlePastDayCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePastDayConfirm}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Continue Editing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}