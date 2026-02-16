'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, logout, user } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" suppressHydrationWarning>
        <div className="text-center" suppressHydrationWarning>
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" suppressHydrationWarning />
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-emerald-400 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} suppressHydrationWarning />
          </div>
          <p className="mt-6 text-slate-700 font-semibold text-lg">Loading...</p>
          <p className="mt-2 text-slate-500 text-sm">Please wait</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50" suppressHydrationWarning>
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm transition-all"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content wrapper */}
      <div className="lg:pl-[260px] min-h-screen">
        {/* Top Header */}
        <Header 
          onMenuClick={() => setSidebarOpen(true)}
          user={user}
          onLogout={logout}
        />
        
        {/* Main content */}
        <main className="p-3 sm:p-5 lg:p-7" suppressHydrationWarning>
          <div className="max-w-[1700px] mx-auto page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
