"use client";

import { useEffect } from "react";
import { 
  useConductorDashboard, 
  type ConductorReport 
} from "@/lib/stores/conductorDashboardStore";
import { getConductorReportsWithSolutions } from "@/app/actions/getReportDetail";
import { createBrowserClient } from "@/lib/supabase/service";

import { ConductorSidebar } from "./conductor-sidebar";
import { ConductorHeader } from "./conductor-header";
import { NewReportView } from "./views/new-report-view";
import { WaitingView } from "./views/waiting-view";
import { ReportDetailView } from "./views/report-detail-view";

/**
 * Main Conductor Dashboard Client Component
 * 
 * Manages state and renders appropriate view based on dashboard state
 */
export function ConductorDashboardClient() {
  const { 
    view, 
    selectedReport, 
    setReports, 
    updateSolution, 
    updateReport,
    setLoading 
  } = useConductorDashboard();

  // Load reports on mount
  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      try {
        const result = await getConductorReportsWithSolutions();
        if (result.success) {
          setReports(result.reports);
        } else {
          console.error("Failed to load reports:", result.error);
        }
      } catch (error) {
        console.error("Error loading reports:", error);
      } finally {
        setLoading(false);
      }
    }
    
    loadReports();
  }, [setReports, setLoading]);

  // Subscribe to realtime updates for solutions
  useEffect(() => {
    const supabase = createBrowserClient();

    // Subscribe to Solution table changes
    const channel = supabase
      .channel("conductor-solution-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Solution",
        },
        (payload: { new: Record<string, unknown> }) => {
          console.log("[Conductor] Solution received:", payload);
          
          const solution = payload.new;
          if (solution?.reportId) {
            // Parse steps from string to array
            const stepsRaw = solution.steps;
            const steps = typeof stepsRaw === 'string'
              ? stepsRaw.split('\n').filter((s: string) => s.trim())
              : Array.isArray(stepsRaw)
                ? stepsRaw as string[]
                : [];

            updateSolution(solution.reportId as string, {
              id: solution.id as string,
              title: solution.title as string,
              steps,
              source: solution.source as string,
              confidence: solution.confidence as number | null,
              createdAt: solution.createdAt as string,
            });

            // Also update report status
            updateReport(solution.reportId as string, { status: "RESOLVED" });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "Report",
        },
        (payload: { new: Record<string, unknown> }) => {
          console.log("[Conductor] Report updated:", payload);
          
          const report = payload.new;
          if (report?.id) {
            updateReport(report.id as string, {
              status: report.status as ConductorReport["status"],
            });
          }
        }
      )
      .subscribe((status: string) => {
        console.log("[Conductor] Realtime subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [updateSolution, updateReport]);

  // Render appropriate view based on state
  const renderContent = () => {
    switch (view) {
      case "waiting":
        return <WaitingView report={selectedReport} />;
      case "report-detail":
        return <ReportDetailView report={selectedReport} />;
      case "new-report":
      default:
        return <NewReportView />;
    }
  };

  return (
    <>
      <ConductorSidebar />
      <main className="flex-1 flex flex-col min-w-0 bg-neutral-950 relative overflow-hidden">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />
        
        <ConductorHeader />
        {renderContent()}
      </main>
    </>
  );
}
