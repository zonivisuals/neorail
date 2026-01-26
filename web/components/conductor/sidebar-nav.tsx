import { 
  MessageSquare, 
  Settings,
  Sparkles,
  Clock,
  LogOut
} from 'lucide-react';

import { NeoRailLogo } from '@/lib/icons';
import { auth } from '@/lib/auth/auth';
import { logoutAction } from '@/app/(auth)/logout/actions';

export async function SidebarNav() {
  const session = await auth();
  
  const currentReport = {
    id: 'current',
    label: 'Current Report Title',
    date: 'Today',
    active: true
  };

  const previousReports = [
    { id: '1', label: 'Track Obstruction Alert', date: 'Yesterday', active: false },
    { id: '2', label: 'Signal Malfunction Report', date: '2 days ago', active: false },
    { id: '3', label: 'Platform Safety Issue', date: '3 days ago', active: false },
    { id: '4', label: 'Equipment Failure Log', date: '1 week ago', active: false },
  ];

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
          <a
            href="#"
            className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors group bg-white/10 text-white"
          >
            <MessageSquare 
              size={18} 
              className="text-white shrink-0" 
            />
            <div className="hidden lg:flex flex-col min-w-0 flex-1">
              <span className="font-medium truncate">[{currentReport.label}]</span>
              <span className="text-[10px] text-neutral-400">{currentReport.date}</span>
            </div>
          </a>
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
              {previousReports.map((report) => (
                <a
                  key={report.id}
                  href="#"
                  className="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors group text-neutral-400 hover:text-white hover:bg-white/5"
                >
                  <div className="hidden lg:flex flex-col min-w-0 flex-1">
                    <span className="font-medium truncate">{report.label}</span>
                    <span className="text-[10px] text-neutral-500">{report.date}</span>
                  </div>
                </a>
              ))}
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
            <span className="text-xs text-white font-medium truncate max-w-[140px]">
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
