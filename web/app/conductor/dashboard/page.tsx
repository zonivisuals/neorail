import { SidebarNav } from '@/components/conductor/sidebar-nav';
import { Header } from '@/components/conductor/header';
import { MainContent } from '@/components/conductor/main-content';

export default function ConductorDashboard() {
  return (
    <>
      <SidebarNav />
      <main className="flex-1 flex flex-col min-w-0 bg-neutral-950 relative overflow-hidden">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        <Header />
        <MainContent />
      </main>
    </>
  );
}