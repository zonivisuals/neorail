"use client";

import { useState, useCallback, useTransition, useMemo, useEffect } from "react";
import {
  MessageSquare,
  Activity,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MapPin,
  Clock,
  Train,
  ImageIcon,
  Sparkles,
  ListChecks,
  Bell,
  LogOut,
} from "lucide-react";
import { NeoRailLogo } from "@/lib/icons";
import { logoutAction } from "@/app/(auth)/logout/actions";
import {
  useReportRealtime,
  type RealtimeEvent,
  type ReportPayload,
  type SolutionPayload,
} from "@/hooks/useReportRealtime";
import { analyzeSolution } from "@/app/actions/analyzeSolution";
import { getReports } from "@/app/actions/getReports";

type ReportWithSolution = ReportPayload & {
  solution?: SolutionPayload | null;
  isAnalyzing?: boolean;
};

type FilterTab = "all" | "active" | "analyzing" | "resolved";

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
 * Format full date
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Truncate content
 */
function truncateContent(content: string): string {
  const firstLine = content.split("\n")[0];
  return firstLine.length > 50 ? firstLine.substring(0, 50) + "..." : firstLine;
}

/**
 * Get urgency styling
 */
function getUrgencyStyle(urgency: string) {
  switch (urgency) {
    case "CRITICAL":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "HIGH":
      return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    case "MEDIUM":
      return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    case "LOW":
      return "bg-green-500/10 text-green-400 border-green-500/20";
    default:
      return "bg-neutral-500/10 text-neutral-400 border-neutral-500/20";
  }
}

/**
 * Status Icon Component
 */
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "RESOLVED":
      return <CheckCircle2 size={12} className="text-green-400 shrink-0" />;
    case "ANALYZING":
      return <Loader2 size={12} className="text-blue-400 animate-spin shrink-0" />;
    default:
      return <AlertCircle size={12} className="text-yellow-400 shrink-0" />;
  }
}

export default function AdminDashboardPage() {
  const [reports, setReports] = useState<Map<string, ReportWithSolution>>(new Map());
  const [isPending, startTransition] = useTransition();
  const [analyzingReportId, setAnalyzingReportId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load existing reports on mount
  useEffect(() => {
    async function loadReports() {
      console.log("[Dashboard] Loading existing reports...");
      const result = await getReports();
      
      if (result.success) {
        console.log(`[Dashboard] Loaded ${result.reports.length} reports`);
        const reportsMap = new Map<string, ReportWithSolution>();
        
        for (const report of result.reports) {
          reportsMap.set(report.id, {
            ...report,
            isAnalyzing: false,
          });
        }
        
        setReports(reportsMap);
        
        // Auto-select the first report if any exist
        if (result.reports.length > 0) {
          setSelectedReportId(result.reports[0].id);
        }
      } else {
        console.error("[Dashboard] Failed to load reports:", result.error);
      }
      
      setIsLoading(false);
    }
    
    loadReports();
  }, []);
  
  // Memoize callback to prevent unnecessary re-renders
  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    console.log("[Dashboard] Received event:", event);
    
    if (event.table === "Report") {
      // Handle Report events
      setReports((prev) => {
        const updated = new Map(prev);
        if (event.type === "DELETE") {
          updated.delete(event.payload.id);
        } else {
          const existing = updated.get(event.payload.id);
          updated.set(event.payload.id, {
            ...event.payload,
            solution: existing?.solution,
            isAnalyzing: existing?.isAnalyzing,
          });
        }
        return updated;
      });
    } else if (event.table === "Solution") {
      // Handle Solution events - attach solution to its report
      setReports((prev) => {
        const updated = new Map(prev);
        const reportId = event.payload.reportId;
        const existing = updated.get(reportId);
        if (existing) {
          updated.set(reportId, {
            ...existing,
            solution: event.payload,
            isAnalyzing: false,
          });
        }
        return updated;
      });
      setAnalyzingReportId(null);
    }
  }, []);
  
  const { isConnected, error } = useReportRealtime(handleRealtimeEvent);

  // Handle analyze button click
  const handleAnalyze = (reportId: string) => {
    setAnalyzingReportId(reportId);
    setReports((prev) => {
      const updated = new Map(prev);
      const report = updated.get(reportId);
      if (report) {
        updated.set(reportId, { ...report, isAnalyzing: true });
      }
      return updated;
    });

    startTransition(async () => {
      const result = await analyzeSolution(reportId);
      
      if (!result.success) {
        console.error("[Dashboard] Analysis failed:", result.error);
        setReports((prev) => {
          const updated = new Map(prev);
          const report = updated.get(reportId);
          if (report) {
            updated.set(reportId, { ...report, isAnalyzing: false });
          }
          return updated;
        });
        setAnalyzingReportId(null);
        // The solution will arrive via realtime if successful
      }
    });
  };

  // Convert Map to array for rendering (newest first)
  const reportsList = useMemo(
    () => Array.from(reports.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    [reports]
  );

  // Filter reports based on active tab
  const filteredReports = useMemo(() => {
    switch (activeFilter) {
      case "active":
        return reportsList.filter((r) => r.status === "OPEN");
      case "analyzing":
        return reportsList.filter((r) => r.status === "ANALYZING");
      case "resolved":
        return reportsList.filter((r) => r.status === "RESOLVED");
      default:
        return reportsList;
    }
  }, [reportsList, activeFilter]);

  // Get selected report for detail view
  const selectedReport = useMemo(
    () => reportsList.find((r) => r.id === selectedReportId),
    [reportsList, selectedReportId]
  );

  // Auto-select first report if none selected
  useMemo(() => {
    if (!selectedReportId && filteredReports.length > 0) {
      setSelectedReportId(filteredReports[0].id);
    }
  }, [selectedReportId, filteredReports]);

  // Count by status
  const statusCounts = useMemo(() => {
    return reportsList.reduce(
      (acc, report) => {
        acc[report.status.toLowerCase() as "open" | "analyzing" | "resolved"]++;
        return acc;
      },
      { open: 0, analyzing: 0, resolved: 0 }
    );
  }, [reportsList]);

  return (
    <div className="w-screen h-screen flex bg-neutral-950">
      {/* Sidebar */}
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

          {/* Filter Tabs */}
          <div className="p-2 border-b border-white/5">
            <div className="text-[10px] uppercase text-neutral-600 px-3 py-2 hidden lg:block font-semibold tracking-wider">
              Filters
            </div>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setActiveFilter("all")}
                className={`flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                  activeFilter === "all"
                    ? "bg-white/10 text-white"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Activity size={18} className="shrink-0" />
                <span className="hidden lg:block font-medium">All Reports</span>
                <span className="ml-auto hidden lg:block text-xs text-neutral-500">
                  {reportsList.length}
                </span>
              </button>
              <button
                onClick={() => setActiveFilter("active")}
                className={`flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                  activeFilter === "active"
                    ? "bg-white/10 text-white"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <AlertCircle size={18} className="shrink-0" />
                <span className="hidden lg:block font-medium">Active</span>
                <span className="ml-auto hidden lg:block text-xs text-neutral-500">
                  {statusCounts.open}
                </span>
              </button>
              <button
                onClick={() => setActiveFilter("analyzing")}
                className={`flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                  activeFilter === "analyzing"
                    ? "bg-white/10 text-white"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Loader2 size={18} className="shrink-0" />
                <span className="hidden lg:block font-medium">Processing</span>
                <span className="ml-auto hidden lg:block text-xs text-neutral-500">
                  {statusCounts.analyzing}
                </span>
              </button>
              <button
                onClick={() => setActiveFilter("resolved")}
                className={`flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                  activeFilter === "resolved"
                    ? "bg-white/10 text-white"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <CheckCircle2 size={18} className="shrink-0" />
                <span className="hidden lg:block font-medium">Resolved</span>
                <span className="ml-auto hidden lg:block text-xs text-neutral-500">
                  {statusCounts.resolved}
                </span>
              </button>
            </div>
          </div>

          {/* Reports List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-2">
              <div className="items-center gap-2 px-3 py-2 hidden lg:flex">
                <Clock size={12} className="text-neutral-600" />
                <span className="text-[10px] uppercase text-neutral-600 font-semibold tracking-wider">
                  Incident Reports
                </span>
              </div>
              <nav className="flex flex-col gap-1">
                {isLoading ? (
                  <div className="px-3 py-8 text-center">
                    <Loader2 size={24} className="text-neutral-500 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-neutral-500 hidden lg:block">Loading...</p>
                  </div>
                ) : filteredReports.length === 0 ? (
                  <div className="px-3 py-8 text-center">
                    <MessageSquare size={24} className="text-neutral-600 mx-auto mb-2" />
                    <p className="text-xs text-neutral-500 hidden lg:block">No reports</p>
                  </div>
                ) : (
                  filteredReports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReportId(report.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-left ${
                        selectedReportId === report.id
                          ? "bg-white/10 text-white"
                          : "text-neutral-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <MessageSquare
                        size={18}
                        className={`shrink-0 ${
                          selectedReportId === report.id ? "text-white" : "text-neutral-500"
                        }`}
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
                  ))
                )}
              </nav>
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div className="p-2 border-t border-white/5">
          {/* Connection status */}
          <div className="px-3 py-2 mb-2 flex items-center gap-2 text-xs">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="text-neutral-500 hidden lg:block">
              {isConnected ? "Live Connection" : "Disconnected"}
            </span>
          </div>
          
          {/* Logout */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-400 hover:text-red-400 hover:bg-red-500/5 rounded-md transition-colors group"
            >
              <LogOut size={18} className="group-hover:text-red-400 transition-colors" />
              <span className="hidden lg:block font-medium">Logout</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-neutral-950 relative overflow-hidden">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />

        {/* Header */}
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-neutral-950/80 backdrop-blur-md z-10 sticky top-0 shrink-0">
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-3 text-sm text-neutral-500">
              <span className="text-white font-medium">
                {selectedReport ? truncateContent(selectedReport.content) : "Admin Dashboard"}
              </span>
              {selectedReport && (
                <span className={`px-2 py-0.5 text-[10px] rounded-full border ${
                  selectedReport.status === "RESOLVED"
                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : selectedReport.status === "ANALYZING"
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                }`}>
                  {selectedReport.status}
                </span>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="py-1 px-2 rounded-sm hover:bg-white/10 cursor-pointer text-neutral-500 transition-colors">
              <Bell width={16} />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col p-6 relative z-0 min-h-0">
          {selectedReport ? (
            <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out] py-4">
              {/* Report Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                        selectedReport.status === "RESOLVED"
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : selectedReport.status === "ANALYZING"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                      }`}
                    >
                      {selectedReport.status === "RESOLVED" ? (
                        <CheckCircle2 size={14} className="text-green-400" />
                      ) : selectedReport.status === "ANALYZING" ? (
                        <Loader2 size={14} className="text-blue-400 animate-spin" />
                      ) : (
                        <AlertCircle size={14} className="text-yellow-400" />
                      )}
                      <span className="text-xs font-medium">{selectedReport.status}</span>
                    </div>
                    <span className={`px-2 py-1 text-[10px] rounded-full border ${getUrgencyStyle(selectedReport.urgency)}`}>
                      {selectedReport.urgency} Priority
                    </span>
                  </div>
                  <h1 className="text-xl font-semibold text-white truncate">
                    {selectedReport.content.split("\n")[0].substring(0, 80)}
                    {selectedReport.content.length > 80 ? "..." : ""}
                  </h1>
                </div>
              </div>

              {/* Metadata Row */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400 pb-4 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <MapPin size={12} />
                  <span>{selectedReport.location}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={12} />
                  <span>{formatDate(selectedReport.createdAt)}</span>
                </div>
                {selectedReport.trainId && (
                  <div className="flex items-center gap-1.5">
                    <Train size={12} />
                    <span>Train {selectedReport.trainId}</span>
                  </div>
                )}
              </div>

              {/* Report Content */}
              <div className="bg-neutral-900/50 border border-white/10 rounded-xl p-6">
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
                  Incident Description
                </h3>
                <p className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedReport.content}
                </p>
              </div>

              {/* Images */}
              {selectedReport.imageUrl.length > 0 && (
                <div className="bg-neutral-900/50 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center gap-2 text-xs text-neutral-500 mb-4">
                    <ImageIcon size={14} />
                    <span className="font-medium uppercase tracking-wider">
                      Attached Images ({selectedReport.imageUrl.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedReport.imageUrl.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-colors group relative"
                      >
                        <img
                          src={url}
                          alt={`Attachment ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-xs text-white font-medium">View Full</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Solution Section */}
              {selectedReport.solution ? (
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-green-500/10 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Sparkles size={16} className="text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">AI Solution</h3>
                      <p className="text-[10px] text-neutral-500">
                        Generated {formatDate(selectedReport.solution.createdAt)}
                      </p>
                    </div>
                    {selectedReport.solution.confidence && (
                      <div className="ml-auto px-2 py-1 bg-green-500/10 rounded text-[10px] text-green-400">
                        {Math.round(selectedReport.solution.confidence * 100)}% confidence
                      </div>
                    )}
                  </div>
                  <div className="p-6 space-y-6">
                    <div>
                      <h4 className="text-lg font-medium text-white mb-2">
                        {selectedReport.solution.title}
                      </h4>
                      <p className="text-xs text-neutral-500">
                        Source: {selectedReport.solution.source}
                      </p>
                    </div>
                    {selectedReport.solution.steps && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-neutral-400">
                          <ListChecks size={16} />
                          <span className="font-medium">Resolution Steps</span>
                        </div>
                        <div className="space-y-2">
                          {(Array.isArray(selectedReport.solution.steps)
                            ? selectedReport.solution.steps
                            : [selectedReport.solution.steps]
                          ).map((step, idx) => (
                            <div key={idx} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                              <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-[10px] font-semibold text-green-400">
                                  {idx + 1}
                                </span>
                              </div>
                              <p className="text-sm text-neutral-300 leading-relaxed">{step}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : selectedReport.status === "ANALYZING" || selectedReport.isAnalyzing ? (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-8 flex flex-col items-center gap-4">
                  <Loader2 size={32} className="text-blue-400 animate-spin" />
                  <div className="text-center">
                    <h3 className="text-sm font-medium text-white mb-1">Analyzing with AI...</h3>
                    <p className="text-xs text-neutral-500">
                      Generating solution based on similar incidents
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <button
                    onClick={() => handleAnalyze(selectedReport.id)}
                    disabled={isPending}
                    className="px-8 py-4 text-base font-semibold text-black bg-white hover:bg-neutral-200 disabled:bg-neutral-400 disabled:cursor-not-allowed rounded-lg shadow-lg transition-all hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-3 mx-auto"
                  >
                    {isPending ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={20} />
                        <span>Analyze & Generate Solution</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                  <MessageSquare size={32} className="text-neutral-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">No Report Selected</h3>
                  <p className="text-sm text-neutral-500">
                    {reportsList.length === 0
                      ? "Waiting for incident reports..."
                      : "Select a report from the sidebar to view details"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

