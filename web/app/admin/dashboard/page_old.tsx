"use client";

import { useState, useCallback, useTransition, useMemo } from "react";
import { WaitingForReport } from "@/components/admin/waiting-for-report";
import {
  useReportRealtime,
  type RealtimeEvent,
  type ReportPayload,
  type SolutionPayload,
} from "@/hooks/useReportRealtime";
import { analyzeSolution } from "@/app/actions/analyzeSolution";

type ReportWithSolution = ReportPayload & {
  solution?: SolutionPayload | null;
  isAnalyzing?: boolean;
};

type FilterTab = "all" | "active" | "analyzing" | "resolved";

export default function AdminDashboardPage() {
  const [reports, setReports] = useState<Map<string, ReportWithSolution>>(new Map());
  const [isPending, startTransition] = useTransition();
  const [analyzingReportId, setAnalyzingReportId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  
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
    <div className="w-screen h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header with connection status */}
      <div className="p-4 border-b bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Real-time incident monitoring & resolution</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                }`}
              />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {isConnected ? "Live" : "Disconnected"}
              </span>
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {reportsList.length} Total Reports
            </div>
          </div>
        </div>
        {error && (
          <div className="mt-2 max-w-7xl mx-auto">
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded">
              ⚠️ {error}
            </p>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left side - Waiting animation */}
        <div className="flex-1 flex items-center justify-center">
          <WaitingForReport />
        </div>

        {/* Right side - Real-time events */}
        <div className="w-1/2 border-l bg-muted/30 flex flex-col">
          <div className="p-4 border-b bg-background/95">
            <h2 className="text-lg font-semibold">
              Real-time Reports ({reportsList.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              New reports will appear here automatically
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {reportsList.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">No reports received yet...</p>
              </div>
            ) : (
              reportsList.map((report) => (
                <div
                  key={report.id}
                  className="bg-background border rounded-lg p-4 space-y-3 animate-in slide-in-from-top-2 duration-300"
                >
                  {/* Report header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          report.status === "RESOLVED"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : report.status === "ANALYZING"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                        }`}
                      >
                        {report.status}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${
                          report.urgency === "CRITICAL"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                            : report.urgency === "HIGH"
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                            : report.urgency === "MEDIUM"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
                        }`}
                      >
                        {report.urgency}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(report.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Report details */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>📍 {report.location}</span>
                      {report.trainId && <span>🚆 Train {report.trainId}</span>}
                    </div>
                    <p className="text-sm">{report.content}</p>
                    {report.imageUrl.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        � {report.imageUrl.length} image(s)
                      </p>
                    )}
                  </div>

                  {/* Analyze button or Solution display */}
                  {report.solution ? (
                    <div className="border-t pt-3 mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-green-600 dark:text-green-400">
                          ✅ {report.solution.title}
                        </h4>
                        <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded">
                          {Math.round(report.solution.confidence * 100)}% confidence
                        </span>
                      </div>
                      <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
                        {(Array.isArray(report.solution.steps) 
                          ? report.solution.steps 
                          : [report.solution.steps]
                        ).map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ol>
                      <p className="text-[10px] text-muted-foreground">
                        Source: {report.solution.source}
                        {report.solution.similarityScore != null && (
                          <> • Similarity: {Math.round(report.solution.similarityScore * 100)}%</>
                        )}
                      </p>
                    </div>
                  ) : report.status === "OPEN" ? (
                    <button
                      onClick={() => handleAnalyze(report.id)}
                      disabled={report.isAnalyzing || isPending}
                      className="w-full mt-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      {report.isAnalyzing ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Analyzing...
                        </span>
                      ) : (
                        "🔍 Analyze & Generate Solution"
                      )}
                    </button>
                  ) : report.status === "ANALYZING" ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-blue-600 dark:text-blue-400 py-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing with AI...
                    </div>
                  ) : null}

                  {/* JSON payload (collapsible) */}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View raw data
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto text-[10px]">
                      {JSON.stringify(report, null, 2)}
                    </pre>
                  </details>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}