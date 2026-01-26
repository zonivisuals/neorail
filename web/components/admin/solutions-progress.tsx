"use client";

import { 
  CheckCircle, 
  ShieldAlert, 
  LockKeyhole, 
  Lock, 
  MoreVertical 
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: "completed" | "active" | "pending";
  subtitle?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface SolutionsProgressProps {
  tasks: Task[];
  completedCount: number;
  totalCount: number;
}

export function SolutionsProgress({ tasks, completedCount, totalCount }: SolutionsProgressProps) {
  return (
    <div className="glass-panel rounded-2xl p-8 relative overflow-hidden shadow-2xl">
      {/* Ambient Glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 blur-[80px] pointer-events-none rounded-full" />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Solutions Progress
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              Complete pending actions to proceed.
            </p>
          </div>
          <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
            <span className="text-xs font-medium text-white">
              {completedCount}/{totalCount}
            </span>
          </div>
        </div>
        
        {/* Vertical Stepper */}
        <div className="relative">
          {/* Background connection line */}
          <div className="absolute left-[15px] top-4 bottom-8 w-px bg-white/5" />

          {tasks.map((task, index) => (
            <TaskItem 
              key={task.id} 
              task={task} 
              isLast={index === tasks.length - 1} 
            />
          ))}
        </div>
      </div>
      
      {/* Bottom Gradient Line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

function TaskItem({ task, isLast }: { task: Task; isLast: boolean }) {
  const statusConfig = {
    completed: {
      icon: CheckCircle,
      iconColor: "text-emerald-500",
      borderColor: "border-emerald-500/20",
      shadowColor: "shadow-[0_0_10px_rgba(16,185,129,0.1)]",
      titleStyle: "text-neutral-500 line-through decoration-neutral-700",
      subtitleStyle: "text-emerald-500/80",
    },
    active: {
      icon: ShieldAlert,
      iconColor: "text-indigo-400",
      borderColor: "border-indigo-500/50",
      shadowColor: "",
      titleStyle: "text-white",
      subtitleStyle: "text-indigo-400",
    },
    pending: {
      icon: LockKeyhole,
      iconColor: "text-neutral-600",
      borderColor: "border-dashed border-white/10",
      shadowColor: "",
      titleStyle: "text-neutral-600",
      subtitleStyle: "text-neutral-600",
    },
  };

  const config = statusConfig[task.status];
  const Icon = config.icon;

  return (
    <div className={`relative flex gap-5 ${!isLast ? "pb-10" : ""} group`}>
      {/* Icon Circle */}
      <div className="relative z-10 shrink-0">
        <div 
          className={`w-8 h-8 rounded-full bg-neutral-900 border ${config.borderColor} ${config.iconColor} flex items-center justify-center ${config.shadowColor} transition-colors ${
            task.status === "active" ? "animate-pump" : ""
          }`}
        >
          <Icon size={18} strokeWidth={1.5} />
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 ${task.status === "completed" ? "pt-1.5" : "pt-1"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col">
            <span className={`text-sm font-medium ${config.titleStyle} transition-colors`}>
              {task.title}
            </span>
            {task.subtitle && (
              <span className={`text-[11px] ${config.subtitleStyle} mt-1 font-medium flex items-center gap-1.5`}>
                {task.status === "active" && (
                  <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
                )}
                {task.subtitle}
              </span>
            )}
          </div>

          {/* Action Button or Menu */}
          {task.status === "completed" && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                className="text-neutral-600 hover:text-white transition-colors"
                aria-label="More options"
              >
                <MoreVertical size={16} />
              </button>
            </div>
          )}
          
          {task.status === "active" && task.actionLabel && (
            <button 
              onClick={task.onAction}
              className="px-3 py-1.5 bg-white text-black text-xs font-semibold rounded-md hover:bg-neutral-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] active:scale-95 border border-transparent"
            >
              {task.actionLabel}
            </button>
          )}
          
          {task.status === "pending" && (
            <Lock size={14} className="text-neutral-700" />
          )}
        </div>

        {/* Active Task Description */}
        {task.status === "active" && task.description && (
          <div className="mt-3 p-3 rounded bg-white/5 border border-white/5 text-xs text-neutral-400 leading-relaxed">
            {task.description}
          </div>
        )}
      </div>
    </div>
  );
}
