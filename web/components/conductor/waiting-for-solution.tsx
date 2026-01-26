'use client'

import { Server, Database, StopCircle } from 'lucide-react';

export const WaitingForSolution = () => (
  <div className="flex-1 overflow-hidden flex flex-col items-center justify-center p-6 relative z-0">
    <div className="w-full max-w-lg flex flex-col items-center text-center gap-2 animate-in fade-in duration-500">
      
      {/* Wave Animation */}
      <div className="h-32 flex items-center justify-center gap-2.5">
        {[0, 0.1, 0.2, 0.3, 0.4].map((delay, i) => (
          <div 
            key={i} 
            className="w-2 h-8 bg-linear-to-t from-foreground/50 to-foreground rounded-full animate-wave" 
            style={{ animationDelay: `${delay}s` }} 
          />
        ))}
      </div>

      <div className="space-y-1 relative">
        <p className="text-neutral-500 text-sm max-w-xs mx-auto leading-relaxed">
          waiting for a comprehensive solution. This may take a moment.
        </p>
      </div>


    </div>

    <style jsx>{`
      @keyframes wave {
        0%, 100% {
          transform: scaleY(0.5);
        }
        50% {
          transform: scaleY(1.5);
        }
      }
      .animate-wave {
        animation: wave 1s ease-in-out infinite;
      }
    `}</style>
  </div>
);

const StatusBadge = ({ 
  icon: Icon, 
  label, 
  iconColor 
}: { 
  icon: React.ComponentType<{ size?: number; className?: string }>; 
  label: string; 
  iconColor: string;
}) => (
  <div className="flex items-center gap-2 text-xs font-medium text-neutral-400">
    <Icon className={iconColor} size={14} />
    <span>{label}</span>
  </div>
);