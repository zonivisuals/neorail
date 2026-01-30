"use client";

import { create } from "zustand";

/**
 * Report data for conductor dashboard
 */
export type ConductorReport = {
  id: string;
  createdAt: string;
  content: string;
  location: string;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "ANALYZING" | "PENDING_REVIEW" | "PENDING_CONDUCTOR" | "RESOLVED";
  trainId: string | null;
  imageUrl: string[];
  solution?: {
    id: string;
    title: string;
    steps: string[];
    source: string;
    confidence: number | null;
    createdAt: string;
    acknowledgedAt?: string | null;
  } | null;
};

/**
 * Dashboard view modes
 */
export type DashboardView = 
  | "new-report"        // Creating a new report
  | "waiting"           // Submitted, waiting for solution
  | "report-detail";    // Viewing an existing report

/**
 * Conductor Dashboard Store State
 */
interface ConductorDashboardState {
  // Current view
  view: DashboardView;
  
  // Selected report (for waiting or detail view)
  selectedReport: ConductorReport | null;
  
  // All reports for sidebar
  reports: ConductorReport[];
  
  // Loading states
  isLoading: boolean;
  
  // Actions
  setView: (view: DashboardView) => void;
  selectReport: (report: ConductorReport) => void;
  setReports: (reports: ConductorReport[]) => void;
  updateReport: (reportId: string, updates: Partial<ConductorReport>) => void;
  addReport: (report: ConductorReport) => void;
  startNewReport: () => void;
  submitReport: (report: ConductorReport) => void;
  setLoading: (loading: boolean) => void;
  
  // Update solution for a report (realtime)
  updateSolution: (reportId: string, solution: ConductorReport["solution"]) => void;
}

/**
 * Zustand store for conductor dashboard
 */
export const useConductorDashboard = create<ConductorDashboardState>()((set) => ({
  view: "new-report",
  selectedReport: null,
  reports: [],
  isLoading: false,

  setView: (view: DashboardView) => set({ view }),

  selectReport: (report: ConductorReport) => set({ 
    selectedReport: report, 
    view: "report-detail" 
  }),

  setReports: (reports: ConductorReport[]) => set({ reports }),

  updateReport: (reportId: string, updates: Partial<ConductorReport>) => set((state: ConductorDashboardState) => ({
    reports: state.reports.map((r: ConductorReport) =>
      r.id === reportId ? { ...r, ...updates } : r
    ),
    // Also update selectedReport if it's the one being updated
    selectedReport: state.selectedReport?.id === reportId
      ? { ...state.selectedReport, ...updates }
      : state.selectedReport,
  })),

  addReport: (report: ConductorReport) => set((state: ConductorDashboardState) => ({
    reports: [report, ...state.reports],
  })),

  startNewReport: () => set({ 
    view: "new-report", 
    selectedReport: null 
  }),

  submitReport: (report: ConductorReport) => set((state: ConductorDashboardState) => ({
    reports: [report, ...state.reports],
    selectedReport: report,
    view: "waiting",
  })),

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  updateSolution: (reportId: string, solution: ConductorReport["solution"]) => set((state: ConductorDashboardState) => {
    const updatedReports = state.reports.map((r: ConductorReport) =>
      r.id === reportId 
        ? { ...r, solution, status: "RESOLVED" as const } 
        : r
    );
    
    const updatedSelected = state.selectedReport?.id === reportId
      ? { ...state.selectedReport, solution, status: "RESOLVED" as const }
      : state.selectedReport;

    return {
      reports: updatedReports,
      selectedReport: updatedSelected,
      // If we were waiting for this report, stay on report-detail view
      view: state.selectedReport?.id === reportId && state.view === "waiting"
        ? "report-detail"
        : state.view,
    };
  }),
}));
