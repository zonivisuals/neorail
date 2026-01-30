"use client";

import { useState, useTransition } from "react";
import { 
  MapPin, 
  Clock,
  Train,
  ImageIcon,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Sparkles,
  ListChecks,
  ChevronRight,
  Bell,
  ThumbsUp,
  UserCheck
} from "lucide-react";
import { useConductorDashboard, type ConductorReport } from "@/lib/stores/conductorDashboardStore";
import { acknowledgeSolution } from "@/app/actions/acknowledgeSolution";

interface ReportDetailViewProps {
  report: ConductorReport | null;
}

/**
 * Format date for display
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
 * Get urgency badge styling
 */
function getUrgencyStyle(urgency: ConductorReport["urgency"]) {
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
 * Status Badge Component
 */
function StatusBadge({ status }: { status: ConductorReport["status"] }) {
  switch (status) {
    case "RESOLVED":
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
          <CheckCircle2 size={14} className="text-green-400" />
          <span className="text-xs font-medium text-green-400">Resolved</span>
        </div>
      );
    case "PENDING_CONDUCTOR":
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full animate-pulse">
          <Bell size={14} className="text-cyan-400" />
          <span className="text-xs font-medium text-cyan-400">Action Required</span>
        </div>
      );
    case "PENDING_REVIEW":
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
          <Loader2 size={14} className="text-purple-400 animate-spin" />
          <span className="text-xs font-medium text-purple-400">Under Review</span>
        </div>
      );
    case "ANALYZING":
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
          <Loader2 size={14} className="text-blue-400 animate-spin" />
          <span className="text-xs font-medium text-blue-400">Analyzing</span>
        </div>
      );
    case "OPEN":
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
          <AlertCircle size={14} className="text-yellow-400" />
          <span className="text-xs font-medium text-yellow-400">Open</span>
        </div>
      );
    default:
      return null;
  }
}

/**
 * Solution Display Component
 */
function SolutionCard({ 
  solution, 
  isPendingConductor,
  onAcknowledge,
  isAcknowledging
}: { 
  solution: NonNullable<ConductorReport["solution"]>;
  isPendingConductor: boolean;
  onAcknowledge: () => void;
  isAcknowledging: boolean;
}) {
  return (
    <div className={`border rounded-xl overflow-hidden ${
      isPendingConductor 
        ? "bg-cyan-500/5 border-cyan-500/20" 
        : "bg-green-500/5 border-green-500/20"
    }`}>
      {/* Pending Conductor Alert Banner */}
      {isPendingConductor && (
        <div className="px-6 py-4 bg-cyan-500/10 border-b border-cyan-500/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center animate-pulse">
            <Bell size={20} className="text-cyan-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-cyan-400">Action Required</h3>
            <p className="text-xs text-neutral-400">
              A solution has been assigned to this incident. Please review and acknowledge.
            </p>
          </div>
        </div>
      )}
      
      {/* Solution Header */}
      <div className={`px-6 py-4 border-b flex items-center gap-3 ${
        isPendingConductor ? "border-cyan-500/10" : "border-green-500/10"
      }`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isPendingConductor ? "bg-cyan-500/20" : "bg-green-500/20"
        }`}>
          <Sparkles size={16} className={isPendingConductor ? "text-cyan-400" : "text-green-400"} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">
            {isPendingConductor ? "New Solution Received" : "Solution Applied"}
          </h3>
          <p className="text-[10px] text-neutral-500">
            Generated {formatDate(solution.createdAt)}
          </p>
        </div>
        {solution.confidence && (
          <div className={`ml-auto px-2 py-1 rounded text-[10px] ${
            isPendingConductor ? "bg-cyan-500/10 text-cyan-400" : "bg-green-500/10 text-green-400"
          }`}>
            {Math.round(solution.confidence * 100)}% confidence
          </div>
        )}
      </div>

      {/* Solution Content */}
      <div className="p-6 space-y-6">
        {/* Title/Summary */}
        <div>
          <h4 className="text-lg font-medium text-white mb-2">
            {solution.title}
          </h4>
          <p className="text-xs text-neutral-500">
            Source: {solution.source}
          </p>
        </div>

        {/* Steps */}
        {solution.steps && solution.steps.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <ListChecks size={16} />
              <span className="font-medium">Resolution Steps</span>
            </div>
            <div className="space-y-2">
              {solution.steps.map((step, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-3 bg-white/5 rounded-lg"
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    isPendingConductor ? "bg-cyan-500/20" : "bg-green-500/20"
                  }`}>
                    <span className={`text-[10px] font-semibold ${
                      isPendingConductor ? "text-cyan-400" : "text-green-400"
                    }`}>
                      {index + 1}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Acknowledge Button - Only shown when PENDING_CONDUCTOR */}
        {isPendingConductor && (
          <div className="pt-4 border-t border-white/10">
            <button
              onClick={onAcknowledge}
              disabled={isAcknowledging}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all hover:scale-[1.02] disabled:hover:scale-100 shadow-lg shadow-cyan-500/20"
            >
              {isAcknowledging ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>Acknowledging...</span>
                </>
              ) : (
                <>
                  <ThumbsUp size={20} />
                  <span>Acknowledge & Take Action</span>
                </>
              )}
            </button>
            <p className="text-center text-[10px] text-neutral-500 mt-2">
              Clicking this confirms you have received and will act on this solution
            </p>
          </div>
        )}
        
        {/* Acknowledged Badge */}
        {!isPendingConductor && solution.acknowledgedAt && (
          <div className="pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-green-400">
            <UserCheck size={16} />
            <span className="text-xs font-medium">
              Acknowledged {formatDate(solution.acknowledgedAt)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Report Detail View - Shows full report with solution
 */
export function ReportDetailView({ report }: ReportDetailViewProps) {
  const [isPending, startTransition] = useTransition();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const { updateReport, updateSolution } = useConductorDashboard();
  
  const handleAcknowledge = () => {
    if (!report) return;
    
    startTransition(async () => {
      const result = await acknowledgeSolution(report.id);
      
      if (result.success) {
        // Update local state
        updateReport(report.id, { status: "RESOLVED" });
        if (report.solution) {
          updateSolution(report.id, {
            ...report.solution,
            acknowledgedAt: new Date().toISOString(),
          });
        }
        setShowSuccessModal(true);
        
        // Auto-hide success modal after 3 seconds
        setTimeout(() => setShowSuccessModal(false), 3000);
      } else {
        console.error("Failed to acknowledge solution:", result.error);
      }
    });
  };

  if (!report) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <AlertCircle size={48} className="text-neutral-600 mx-auto" />
          <p className="text-neutral-500">Select a report to view details</p>
        </div>
      </div>
    );
  }

  const isPendingConductor = report.status === "PENDING_CONDUCTOR";

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col p-6 relative z-0 min-h-0">
      {/* Success Modal Overlay */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-neutral-900 border border-green-500/30 rounded-2xl p-8 max-w-md mx-4 text-center animate-[scaleIn_0.2s_ease-out]">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Solution Acknowledged!</h3>
            <p className="text-sm text-neutral-400">
              The incident has been marked as resolved. You can now proceed with the recommended actions.
            </p>
          </div>
        </div>
      )}

      <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out] py-4">
        
        {/* Report Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge status={report.status} />
              <span className={`px-2 py-1 text-[10px] rounded-full border ${getUrgencyStyle(report.urgency)}`}>
                {report.urgency} Priority
              </span>
            </div>
            <h1 className="text-xl font-semibold text-white truncate">
              {report.content.split("\n")[0].substring(0, 80)}
              {report.content.length > 80 ? "..." : ""}
            </h1>
          </div>
        </div>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400 pb-4 border-b border-white/5">
          <div className="flex items-center gap-1.5">
            <MapPin size={12} />
            <span>{report.location}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={12} />
            <span>{formatDate(report.createdAt)}</span>
          </div>
          {report.trainId && (
            <div className="flex items-center gap-1.5">
              <Train size={12} />
              <span>Train {report.trainId}</span>
            </div>
          )}
        </div>

        {/* Report Content */}
        <div className="bg-neutral-900/50 border border-white/10 rounded-xl p-6">
          <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
            Incident Description
          </h3>
          <p className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap">
            {report.content}
          </p>
        </div>

        {/* Images */}
        {report.imageUrl && report.imageUrl.length > 0 && (
          <div className="bg-neutral-900/50 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-4">
              <ImageIcon size={14} />
              <span className="font-medium uppercase tracking-wider">
                Attached Images ({report.imageUrl.length})
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {report.imageUrl.map((url, index) => (
                <a
                  key={index}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-colors group relative"
                >
                  <img
                    src={url}
                    alt={`Attachment ${index + 1}`}
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
        {report.solution ? (
          <SolutionCard 
            solution={report.solution} 
            isPendingConductor={isPendingConductor}
            onAcknowledge={handleAcknowledge}
            isAcknowledging={isPending}
          />
        ) : report.status === "ANALYZING" ? (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-8 flex flex-col items-center gap-4">
            <Loader2 size={32} className="text-blue-400 animate-spin" />
            <div className="text-center">
              <h3 className="text-sm font-medium text-white mb-1">
                Generating Solution
              </h3>
              <p className="text-xs text-neutral-500">
                Our AI is analyzing this report and preparing a solution...
              </p>
            </div>
          </div>
        ) : report.status === "PENDING_REVIEW" ? (
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-8 flex flex-col items-center gap-4">
            <Loader2 size={32} className="text-purple-400 animate-spin" />
            <div className="text-center">
              <h3 className="text-sm font-medium text-white mb-1">
                Under Admin Review
              </h3>
              <p className="text-xs text-neutral-500">
                An admin is reviewing the solution candidates for this report...
              </p>
            </div>
          </div>
        ) : report.status === "OPEN" ? (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-8 flex flex-col items-center gap-4">
            <AlertCircle size={32} className="text-yellow-400" />
            <div className="text-center">
              <h3 className="text-sm font-medium text-white mb-1">
                Awaiting Analysis
              </h3>
              <p className="text-xs text-neutral-500">
                This report is queued for review. An admin will analyze it soon.
              </p>
            </div>
          </div>
        ) : null}

        {/* Report ID Footer */}
        <div className="text-center pt-4 border-t border-white/5">
          <p className="text-[10px] text-neutral-600">
            Report ID: {report.id}
          </p>
        </div>
      </div>
    </div>
  );
}
