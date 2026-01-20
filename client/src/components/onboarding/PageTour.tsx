import { useState, useEffect, useCallback } from "react";
import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from "react-joyride";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlayCircle, X } from "lucide-react";

export interface TourStep extends Step {
  content: React.ReactNode;
}

interface PageTourProps {
  tourId: string;
  steps: TourStep[];
  videoUrl?: string;
  videoTitle?: string;
  onComplete?: () => void;
  showVideoFirst?: boolean;
  continuous?: boolean;
}

const tourStyles = {
  options: {
    primaryColor: "#1E4FAB",
    textColor: "#1f2937",
    backgroundColor: "#ffffff",
    arrowColor: "#ffffff",
    overlayColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 10000,
  },
  tooltip: {
    borderRadius: "12px",
    padding: "16px",
    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15)",
    maxWidth: 380,
  },
  tooltipContainer: {
    textAlign: "left" as const,
  },
  tooltipContent: {
    padding: "8px 0",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  tooltipTitle: {
    fontSize: "16px",
    fontWeight: 600,
    marginBottom: "8px",
  },
  buttonNext: {
    backgroundColor: "#1E4FAB",
    borderRadius: "8px",
    padding: "8px 16px",
    fontSize: "14px",
    fontWeight: 500,
  },
  buttonBack: {
    color: "#6b7280",
    fontSize: "14px",
    fontWeight: 500,
  },
  buttonSkip: {
    color: "#9ca3af",
    fontSize: "14px",
  },
  buttonClose: {
    display: "none",
  },
  spotlight: {
    borderRadius: "8px",
  },
  beacon: {
    inner: "#1E4FAB",
    outer: "#1E4FAB",
  },
};

export function PageTour({
  tourId,
  steps,
  videoUrl,
  videoTitle,
  onComplete,
  showVideoFirst = false,
  continuous = true,
}: PageTourProps) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [hasCheckedCompletion, setHasCheckedCompletion] = useState(false);
  const queryClient = useQueryClient();

  const { data: tourProgress, isLoading } = useQuery<{ completed: boolean }>({
    queryKey: ["/api/tour-progress", tourId],
    enabled: !!tourId,
    staleTime: 1000 * 60 * 5,
  });

  const completeTourMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/tour-progress", { tourId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tour-progress"] });
      onComplete?.();
    },
  });

  useEffect(() => {
    if (!isLoading && !hasCheckedCompletion && tourProgress !== undefined) {
      setHasCheckedCompletion(true);
      if (!tourProgress?.completed) {
        if (showVideoFirst && videoUrl) {
          setShowVideoModal(true);
        } else {
          setTimeout(() => setRun(true), 500);
        }
      }
    }
  }, [isLoading, tourProgress, hasCheckedCompletion, showVideoFirst, videoUrl]);

  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, action, index, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      completeTourMutation.mutate();
    } else if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    }
  }, [completeTourMutation]);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setRun(true);
  }, []);

  const handleVideoClose = () => {
    setShowVideoModal(false);
    setTimeout(() => setRun(true), 300);
  };

  if (isLoading || steps.length === 0) return null;

  return (
    <>
      <Joyride
        steps={steps}
        run={run}
        stepIndex={stepIndex}
        continuous={continuous}
        showSkipButton
        showProgress
        disableOverlayClose
        disableScrollParentFix
        spotlightClicks
        styles={tourStyles}
        callback={handleJoyrideCallback}
        locale={{
          back: "Back",
          close: "Close",
          last: "Got it!",
          next: "Next",
          skip: "Skip tour",
        }}
        floaterProps={{
          disableAnimation: true,
        }}
      />

      {videoUrl && (
        <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5 text-[#1E4FAB]" />
                {videoTitle || "Quick Overview"}
              </DialogTitle>
              <DialogDescription>
                Watch this quick video to get started, or skip to the interactive walkthrough.
              </DialogDescription>
            </DialogHeader>
            <div className="aspect-video w-full bg-gray-100 rounded-lg overflow-hidden">
              <iframe
                src={videoUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={handleVideoClose}>
                Skip to Walkthrough
              </Button>
              <Button onClick={handleVideoClose} className="bg-[#1E4FAB] hover:bg-[#1a4294]">
                Start Interactive Tour
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export function useTourTrigger(tourId: string) {
  const queryClient = useQueryClient();

  const resetTour = useCallback(() => {
    queryClient.setQueryData(["/api/tour-progress", tourId], { completed: false });
  }, [queryClient, tourId]);

  return { resetTour };
}

interface TourTriggerButtonProps {
  tourId: string;
  label?: string;
  variant?: "ghost" | "outline" | "default";
  size?: "sm" | "default" | "lg" | "icon";
}

export function TourTriggerButton({ 
  tourId, 
  label = "Show Tour", 
  variant = "ghost",
  size = "sm" 
}: TourTriggerButtonProps) {
  const { resetTour } = useTourTrigger(tourId);

  return (
    <Button variant={variant} size={size} onClick={resetTour}>
      <PlayCircle className="h-4 w-4 mr-1" />
      {label}
    </Button>
  );
}
