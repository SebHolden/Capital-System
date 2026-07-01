"use client";

import { cn } from "@/lib/utils";

interface StatusBarProps {
  killSwitchActive: boolean;
  executionMode: string;
  onKillSwitchToggle?: () => void;
}

export function StatusBar({
  killSwitchActive,
  executionMode,
  onKillSwitchToggle,
}: StatusBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800/50 bg-slate-900/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-400">KILL SWITCH:</span>
          <button
            onClick={onKillSwitchToggle}
            className={cn(
              "relative h-7 w-14 rounded-full transition-colors",
              killSwitchActive ? "bg-red-500/30" : "bg-slate-700"
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full transition-all",
                killSwitchActive
                  ? "left-8 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                  : "left-1 bg-slate-400"
              )}
            />
          </button>
          <span
            className={cn(
              "text-sm font-medium",
              killSwitchActive ? "text-red-400" : "text-slate-500"
            )}
          >
            {killSwitchActive ? "ON" : "OFF"}
          </span>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">System Status:</span>
            <span className="flex items-center gap-1.5 text-green-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
              All Systems Operational
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Execution Mode:</span>
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-semibold uppercase",
                executionMode === "LIVE"
                  ? "bg-red-500/20 text-red-400"
                  : executionMode === "PAPER"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-blue-500/20 text-blue-400"
              )}
            >
              {executionMode}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
