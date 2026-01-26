import { Bell, Clock, PlusCircle } from 'lucide-react';

export function Header() {
  return (
    <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-neutral-950/80 backdrop-blur-md z-10 sticky top-0 shrink-0">
      <div className="flex items-center gap-4">
        <nav className="flex items-center text-sm text-neutral-500">
          <span className="text-white font-medium">[Current Report title]</span>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div className="py-1 px-2 rounded-sm hover:bg-white/10 cursor-pointer text-neutral-500 transition-colors">
          <Bell width={16} />
        </div>
        <button className="flex items-center gap-2 bg-white text-black hover:bg-neutral-200 px-3 py-1.5 rounded text-xs font-medium transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)]">
          <PlusCircle size={14} />
          New Report
        </button>
      </div>
    </header>
  );
}
