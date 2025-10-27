import React, { useState } from "react";
import type { Milestone } from "../types/dd";

type Props = {
  progressPct: number;
  elapsedLabel?: string;
  milestones: Milestone[];
};

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

export default function MilestoneProgressBar({ progressPct, elapsedLabel, milestones }: Props) {
  const progress = clamp(progressPct);
  const [openId, setOpenId] = useState<string | null>(null);

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
        {milestones.map((m) => {
          const id = `tip-${m.id}`;
          // keep tooltip within container edges by nudging at extremes
          const leftPct = clamp(m.positionPct);
          const nudge = leftPct < 6 ? 6 : leftPct > 94 ? -6 : 0;
          const isOpen = openId === m.id;

          return (
            <div
              key={m.id}
              className="absolute top-1/2 -translate-y-1/2 z-50"
              style={{ left: `${leftPct}%` }}
            >
              <button
                type="button"
                className={`h-4 w-4 rounded-full ring-2 ring-white shadow-md bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 ${m.color ?? ""}`}
                aria-describedby={id}
                onMouseEnter={() => setOpenId(m.id)}
                onMouseLeave={() => setOpenId((cur) => (cur === m.id ? null : cur))}
                onFocus={() => setOpenId(m.id)}
                onBlur={() => setOpenId((cur) => (cur === m.id ? null : cur))}
                onKeyDown={(e) => e.key === "Escape" && setOpenId(null)}
                onClick={(e) => {
                  // mobile toggle
                  e.stopPropagation();
                  setOpenId((cur) => (cur === m.id ? null : m.id));
                }}
                data-testid={`milestone-dot-${m.id}`}
              />

              {/* Tooltip - positioned outside progress bar to avoid clipping */}
              <div
                id={id}
                role="tooltip"
                className={`pointer-events-none absolute -top-16 transition-opacity duration-150 z-[9999] ${
                  isOpen ? "opacity-100" : "opacity-0"
                }`}
                style={{ 
                  left: '50%',
                  transform: `translateX(-50%) translateX(${nudge}px)`
                }}
              >
                <div className="relative w-48 rounded-lg bg-white border border-gray-200 shadow-xl px-4 py-3 text-xs">
                  <div className="font-semibold text-gray-900 mb-1">{m.title}</div>
                  <div className="text-gray-600 mb-1">Due: {formatDate(m.due)}</div>
                  <div className="text-gray-600">{Math.round(leftPct)}% Complete</div>
                  <div className="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white" />
                  <div className="absolute left-1/2 top-full -translate-x-1/2 translate-y-[-1px] w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-gray-200" />
                </div>
              </div>
            </div>
          );
        })}
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