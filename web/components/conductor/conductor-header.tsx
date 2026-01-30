"use client";

import { Bell, PlusCircle } from "lucide-react";
import { useConductorDashboard } from "@/lib/stores/conductorDashboardStore";

/**
 * Truncate title for header display
 */
function truncateTitle(content: string): string {
  const firstLine = content.split("\n")[0];
  return firstLine.length > 50 ? firstLine.substring(0, 50) + "..." : firstLine;
}

/**
 * Conductor Dashboard Header with functional New Report button
 */
export function ConductorHeader() {
  const { view, selectedReport, startNewReport } = useConductorDashboard();

  // Determine header title based on view
  const getTitle = () => {
    switch (view) {
      case "new-report":
        return "New Report";
      case "waiting":
        return selectedReport 
          ? `Waiting for solution: ${truncateTitle(selectedReport.content)}`
          : "Processing Report...";
      case "report-detail":
        return selectedReport 
          ? truncateTitle(selectedReport.content)
          : "Report Details";
      default:
        return "Dashboard";
    }
  };

  // Get status badge
  const getStatusBadge = () => {
    if (!selectedReport) return null;
    
    switch (selectedReport.status) {
      case "RESOLVED":
        return (
          <span className="px-2 py-0.5 text-[10px] rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
            Resolved
          </span>
        );
      case "ANALYZING":
        return (
          <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Analyzing
          </span>
        );
      case "OPEN":
        return (
          <span className="px-2 py-0.5 text-[10px] rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            Open
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-neutral-950/80 backdrop-blur-md z-10 sticky top-0 shrink-0">
      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-3 text-sm text-neutral-500">
          <span className="text-white font-medium truncate max-w-md">
            {getTitle()}
          </span>
          {view !== "new-report" && getStatusBadge()}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div className="py-1 px-2 rounded-sm hover:bg-white/10 cursor-pointer text-neutral-500 transition-colors">
          <Bell width={16} />
        </div>
        <button 
          onClick={startNewReport}
          className="flex items-center gap-2 bg-white text-black hover:bg-neutral-200 px-3 py-1.5 rounded text-xs font-medium transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)]"
        >
          <PlusCircle size={14} />
          New Report
        </button>
      </div>
    </header>
  );
}
