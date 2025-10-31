import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Milestone } from "../types/dd";

type Props = {
  progressPct: number;
  elapsedLabel?: string;
  milestones: Milestone[];
};

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

export default function MilestoneProgressBar({ progressPct, elapsedLabel, milestones }: Props) {
  const progress = clamp(progressPct);

  return (
    <div className="w-full rounded-2xl border p-4 shadow-sm bg-white">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-3 w-3 rounded-full bg-green-600 inline-block" />
        <span className="font-medium">Overall Progress to Closing</span>
        <span className="ml-auto text-sm text-gray-500">{elapsedLabel}</span>
      </div>

      <div className="relative overflow-visible">
        {/* Progress bar */}
        <div className="h-6 w-full rounded-full bg-gray-100 overflow-hidden">
          {/* Filled section */}
          <div
            className="absolute left-0 top-0 h-full bg-green-600"
            style={{ width: `${progress}%` }}
            aria-hidden
          />

          {/* Remaining section with subtle stripes */}
          <div
            className="absolute right-0 top-0 h-full w-full"
            style={{
              left: `${progress}%`,
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(16,185,129,0.10) 0, rgba(16,185,129,0.10) 6px, transparent 6px, transparent 12px)",
            }}
            aria-hidden
          />
        </div>

        {/* Milestone dots - positioned outside the progress bar container */}
        <TooltipProvider>
          {milestones.map((m) => {
            const leftPct = clamp(m.positionPct);

            return (
              <div
                key={m.id}
                className="absolute top-1/2 -translate-y-1/2 z-50"
                style={{ left: `${leftPct}%` }}
              >
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={`h-4 w-4 rounded-full ring-2 ring-white shadow-md bg-blue-600 hover:ring-4 hover:ring-blue-200 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all cursor-help ${m.color ?? ""}`}
                      data-testid={`milestone-dot-${m.id}`}
                    >
                      <span className="sr-only">{m.title}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="top" 
                    className="max-w-sm p-4 bg-white border border-gray-200 shadow-xl z-[100]"
                    data-testid={`milestone-tooltip-${m.id}`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${m.color ?? 'bg-blue-600'}`}></div>
                        <div className="font-semibold text-gray-900">{m.title}</div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Due Date:</span>
                        <span className="font-medium text-gray-900">{formatDate(m.due)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Progress:</span>
                        <span className="font-medium text-gray-900">{Math.round(leftPct)}%</span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}

function formatDate(input: string) {
  try {
    const d = new Date(input);
    return d.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return input;
  }
}