import { useMutation } from "@tanstack/react-query";
import { Calendar, CalendarCheck, Loader2, CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CalendarSyncButtonProps {
  entityType: "activity" | "task";
  entityId: string;
  isSynced: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  showText?: boolean;
}

export function CalendarSyncButton({
  entityType,
  entityId,
  isSynced,
  variant = "ghost",
  size = "sm",
  showText = false,
}: CalendarSyncButtonProps) {
  const { toast } = useToast();

  const syncMutation = useMutation({
    mutationFn: async () => {
      const endpoint = `/api/calendar/sync/${entityType}/${entityId}`;
      return await apiRequest(endpoint, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm-activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Synced to calendar",
        description: `This ${entityType} has been added to your Google Calendar.`,
      });
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Failed to sync to calendar";
      toast({
        title: "Sync failed",
        description: errorMessage.includes("not connected") 
          ? "Please connect your Google Calendar in Calendar Settings first."
          : errorMessage,
        variant: "destructive",
      });
    },
  });

  const unsyncMutation = useMutation({
    mutationFn: async () => {
      const endpoint = `/api/calendar/sync/${entityType}/${entityId}`;
      return await apiRequest(endpoint, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm-activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Removed from calendar",
        description: `This ${entityType} has been removed from your Google Calendar.`,
      });
    },
    onError: () => {
      toast({
        title: "Failed to remove",
        description: "Could not remove from calendar. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isLoading = syncMutation.isPending || unsyncMutation.isPending;

  const handleClick = () => {
    if (isSynced) {
      unsyncMutation.mutate();
    } else {
      syncMutation.mutate();
    }
  };

  const ButtonContent = () => {
    if (isLoading) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {showText && <span className="ml-2">Syncing...</span>}
        </>
      );
    }

    if (isSynced) {
      return (
        <>
          <CalendarCheck className="h-4 w-4 text-green-600" />
          {showText && <span className="ml-2">Synced</span>}
        </>
      );
    }

    return (
      <>
        <Calendar className="h-4 w-4" />
        {showText && <span className="ml-2">Sync to Calendar</span>}
      </>
    );
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          onClick={handleClick}
          disabled={isLoading}
          data-testid={`button-calendar-sync-${entityType}-${entityId}`}
        >
          <ButtonContent />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isSynced ? "Remove from Google Calendar" : "Sync to Google Calendar"}
      </TooltipContent>
    </Tooltip>
  );
}
