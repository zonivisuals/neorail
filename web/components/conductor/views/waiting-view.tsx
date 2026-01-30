"use client";

import { 
  MapPin, 
  AlertTriangle, 
  Clock,
  Train,
  ImageIcon
} from "lucide-react";
import type { ConductorReport } from "@/lib/stores/conductorDashboardStore";

interface WaitingViewProps {
  report: ConductorReport | null;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
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
 * Listening Animation Component - Shows AI is processing
 */
function ListeningAnimation() {
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Animated Circles */}
      <div className="relative w-32 h-32">
        {/* Outer ring - pulsing */}
        <div className="absolute inset-0 rounded-full border-2 border-blue-500/30 animate-ping" />
        
        {/* Middle ring - rotating */}
        <div className="absolute inset-4 rounded-full border-2 border-dashed border-blue-400/50 animate-spin" style={{ animationDuration: "3s" }} />
        
        {/* Inner core */}
        <div className="absolute inset-8 rounded-full bg-linear-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-blue-500/50 animate-pulse" />
        </div>
        
        {/* Sound wave bars */}
        <div className="absolute inset-0 flex items-center justify-center gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-blue-400/70 rounded-full animate-pulse"
              style={{
                height: `${12 + Math.random() * 20}px`,
                animationDelay: `${i * 0.15}s`,
                animationDuration: "0.8s",
              }}
            />
          ))}
        </div>
      </div>

      {/* Status Text */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-white">
          Analyzing Your Report
        </h2>
        <p className="text-neutral-400 text-sm max-w-md">
          Our AI is processing your incident report and searching for the best solution.
          You&apos;ll receive a response shortly.
        </p>
      </div>

      {/* Processing Steps */}
      <div className="flex items-center gap-8 text-xs text-neutral-500 mt-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>Submitted</span>
        </div>
        <div className="w-8 h-px bg-neutral-700" />
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span>Analyzing</span>
        </div>
        <div className="w-8 h-px bg-neutral-700" />
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-neutral-600" />
          <span>Solution Ready</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Waiting View - Shows submitted report with listening animation
 */
export function WaitingView({ report }: WaitingViewProps) {
  if (!report) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-neutral-500">No report selected</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col items-center p-6 relative z-0 min-h-0">
      <div className="w-full max-w-3xl flex flex-col gap-8 animate-[fadeIn_0.5s_ease-out] py-8">
        
        {/* Listening Animation */}
        <ListeningAnimation />

        {/* Submitted Report Card */}
        <div className="bg-neutral-900/50 border border-white/10 rounded-xl overflow-hidden">
          {/* Card Header */}
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">Your Submitted Report</h3>
            <span className={`px-2 py-1 text-[10px] rounded-full border ${getUrgencyStyle(report.urgency)}`}>
              {report.urgency}
            </span>
          </div>

          {/* Card Body */}
          <div className="p-6 space-y-4">
            {/* Metadata Row */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400">
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

            {/* Content */}
            <p className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap">
              {report.content}
            </p>

            {/* Images */}
            {report.imageUrl && report.imageUrl.length > 0 && (
              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 text-xs text-neutral-500 mb-3">
                  <ImageIcon size={12} />
                  <span>Attached Images ({report.imageUrl.length})</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {report.imageUrl.map((url, index) => (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-20 h-20 rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-colors"
                    >
                      <img
                        src={url}
                        alt={`Attachment ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Notice */}
        <div className="flex items-start gap-3 px-4 py-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <AlertTriangle size={16} className="text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-neutral-400">
            <span className="text-blue-400 font-medium">Stay on this page</span> to receive the solution in real-time. 
            You can also view the status from your report history.
          </div>
        </div>
      </div>
    </div>
  );
}
