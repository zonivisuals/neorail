import { 
  MessageSquare, 
  Settings,
  Clock,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';

import { NeoRailLogo } from '@/lib/icons';
import { auth } from '@/lib/auth/auth';
import { logoutAction } from '@/app/(auth)/logout/actions';
import { getConductorReports } from '@/app/actions/getConductorReports';

/**
 * Format date to relative time (e.g., "Today", "Yesterday", "2 days ago")
 */
function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return '1 month ago';
  return `${Math.floor(diffDays / 30)} months ago`;
}

/**
 * Truncate long content to first line or 50 chars
 */
function truncateContent(content: string): string {
  const firstLine = content.split('\n')[0];
  return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
}

/**
 * Get status badge icon
 */
function getStatusIcon(status: 'OPEN' | 'ANALYZING' | 'RESOLVED') {
  switch (status) {
    case 'RESOLVED':
      return <CheckCircle2 size={12} className="text-green-400" />;
    case 'ANALYZING':
      return <Loader2 size={12} className="text-blue-400 animate-spin" />;
    default:
      return <AlertCircle size={12} className="text-yellow-400" />;
  }
}

export async function SidebarNav() {
  const session = await auth();
  
  // Fetch conductor's reports
  const result = await getConductorReports();
  const reports = result.success ? result.reports : [];

  // Separate current (most recent OPEN/ANALYZING) from previous
  const currentReport = reports.find(r => r.status === 'OPEN' || r.status === 'ANALYZING');
  const previousReports = reports.filter(r => r.id !== currentReport?.id);

  return (
    <aside className="w-16 lg:w-64 border-r border-white/5 bg-neutral-925 flex flex-col justify-between transition-all duration-300 z-20 shrink-0">
      <div className="flex flex-col h-full overflow-hidden">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 lg:px-6 border-b border-white/5">
          <div className="flex items-center gap-3">
              <NeoRailLogo className="text-white w-4"/>
            <span className="font-medium text-sm tracking-tight text-white hidden lg:block">
              NeoRail AI
            </span>
          </div>
        </div>

        {/* Current Report */}
        <div className="p-2 border-b border-white/5">
          <div className="text-[10px] uppercase text-neutral-600 px-3 py-2 hidden lg:block font-semibold tracking-wider">
            Current
          </div>
          {currentReport ? (
            <a
              href={`#report-${currentReport.id}`}
              className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors group bg-white/10 text-white"
            >
              <MessageSquare 
                size={18} 
                className="text-white shrink-0" 
              />
              <div className="hidden lg:flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {getStatusIcon(currentReport.status)}
                  <span className="font-medium truncate">
                    {truncateContent(currentReport.content)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                  <span>{formatRelativeDate(currentReport.createdAt)}</span>
                  {currentReport.trainId && (
                    <span className="text-neutral-500">• Train {currentReport.trainId}</span>
                  )}
                </div>
              </div>
            </a>
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
                  <a
                    key={report.id}
                    href={`#report-${report.id}`}
                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors group text-neutral-400 hover:text-white hover:bg-white/5"
                  >
                    <div className="hidden lg:flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(report.status)}
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
                  </a>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-neutral-500 hidden lg:block">
                  No previous reports
                </div>
              )}
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

        {/* User Info */}
        <div className="mt-2 flex items-center gap-3 px-3 py-3 border-t border-white/5">
          <div className="w-6 h-6 rounded-full bg-linear-to-br from-neutral-700 to-neutral-800 border border-white/10 flex items-center justify-center text-[10px] text-white font-semibold">
            {session?.user?.email?.charAt(0).toUpperCase()}
          </div>
          <div className="hidden lg:flex flex-col">
            <span className="text-xs text-white font-medium truncate max-w-35">
              {session?.user?.email?.split('@')[0]}
            </span>
            <span className="text-[10px] text-neutral-500 capitalize">
              {session?.user?.role?.toLowerCase()}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
