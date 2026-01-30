"use client";

import { 
  MessageSquare, 
  Settings,
  Clock,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2
} from "lucide-react";

import { NeoRailLogo } from "@/lib/icons";
import { logoutAction } from "@/app/(auth)/logout/actions";
import { 
  useConductorDashboard,
  type ConductorReport 
} from "@/lib/stores/conductorDashboardStore";

/**
 * Format date to relative time
 */
function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return "1 month ago";
  return `${Math.floor(diffDays / 30)} months ago`;
}

/**
 * Truncate long content
 */
function truncateContent(content: string): string {
  const firstLine = content.split("\n")[0];
  return firstLine.length > 40 ? firstLine.substring(0, 40) + "..." : firstLine;
}

/**
 * Get status badge icon
 */
function StatusIcon({ status }: { status: ConductorReport["status"] }) {
  switch (status) {
    case "RESOLVED":
      return <CheckCircle2 size={12} className="text-green-400 shrink-0" />;
    case "ANALYZING":
      return <Loader2 size={12} className="text-blue-400 animate-spin shrink-0" />;
    default:
      return <AlertCircle size={12} className="text-yellow-400 shrink-0" />;
  }
}

interface SidebarReportItemProps {
  report: ConductorReport;
  isSelected: boolean;
  onClick: () => void;
}

function SidebarReportItem({ report, isSelected, onClick }: SidebarReportItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors group text-left ${
        isSelected 
          ? "bg-white/10 text-white" 
          : "text-neutral-400 hover:text-white hover:bg-white/5"
      }`}
    >
      <MessageSquare 
        size={18} 
        className={`shrink-0 ${isSelected ? "text-white" : "text-neutral-500"}`}
      />
      <div className="hidden lg:flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StatusIcon status={report.status} />
          <span className="font-medium truncate">
            {truncateContent(report.content)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-neutral-500">
          <span>{formatRelativeDate(report.createdAt)}</span>
          {report.trainId && (
            <span className="text-neutral-600">• Train {report.trainId}</span>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * Client-side Conductor Sidebar with interactive report selection
 */
export function ConductorSidebar() {
  const { 
    reports, 
    selectedReport, 
    view,
    selectReport, 
    isLoading 
  } = useConductorDashboard();

  // Separate current (OPEN/ANALYZING) from previous
  const currentReport = reports.find(
    (r) => r.status === "OPEN" || r.status === "ANALYZING"
  );
  const previousReports = reports.filter((r) => r.id !== currentReport?.id);

  return (
    <aside className="w-16 lg:w-64 border-r border-white/5 bg-neutral-925 flex flex-col justify-between transition-all duration-300 z-20 shrink-0">
      <div className="flex flex-col h-full overflow-hidden">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 lg:px-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <NeoRailLogo className="text-white w-4" />
            <span className="font-medium text-sm tracking-tight text-white hidden lg:block">
              NeoRail AI
            </span>
          </div>
        </div>

        {/* Current Report Section */}
        <div className="p-2 border-b border-white/5">
          <div className="text-[10px] uppercase text-neutral-600 px-3 py-2 hidden lg:block font-semibold tracking-wider">
            Current
          </div>
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-neutral-500 hidden lg:flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              <span>Loading...</span>
            </div>
          ) : currentReport ? (
            <SidebarReportItem
              report={currentReport}
              isSelected={selectedReport?.id === currentReport.id}
              onClick={() => selectReport(currentReport)}
            />
          ) : (
            <div className="px-3 py-2 text-sm text-neutral-500 hidden lg:block">
              No active reports
            </div>
          )}
        </div>

        {/* Previous Reports */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-2">
            <div className="items-center gap-2 px-3 py-2 hidden lg:flex">
              <Clock size={12} className="text-neutral-600" />
              <span className="text-[10px] uppercase text-neutral-600 font-semibold tracking-wider">
                Previous Reports
              </span>
            </div>
            <nav className="flex flex-col gap-1">
              {previousReports.length > 0 ? (
                previousReports.map((report) => (
                  <SidebarReportItem
                    key={report.id}
                    report={report}
                    isSelected={selectedReport?.id === report.id}
                    onClick={() => selectReport(report)}
                  />
                ))
              ) : !isLoading ? (
                <div className="px-3 py-2 text-sm text-neutral-500 hidden lg:block">
                  No previous reports
                </div>
              ) : null}
            </nav>
          </div>
        </div>
      </div>

      {/* Bottom Links */}
      <div className="p-2 border-t border-white/5">
        <a
          href="#"
          className="flex items-center gap-3 px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-white/5 rounded-md transition-colors group"
        >
          <Settings size={18} className="group-hover:text-white transition-colors" />
          <span className="hidden lg:block font-medium">Settings</span>
        </a>
        
        {/* Logout Button */}
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-400 hover:text-red-400 hover:bg-red-500/5 rounded-md transition-colors group mt-1"
          >
            <LogOut size={18} className="group-hover:text-red-400 transition-colors" />
            <span className="hidden lg:block font-medium">Logout</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
