import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="bg-background-light dark:bg-slate-950 text-slate-900 dark:text-white h-screen flex overflow-hidden font-display">
      {mobileSidebarOpen && (
        <button
          aria-label="Close sidebar"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/55 backdrop-blur-[2px] md:hidden"
        />
      )}

      {/* 1. Sidebar dùng chung */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-[88vw] max-w-72 -translate-x-full border-r border-slate-200 bg-white transition-transform duration-300 dark:border-slate-800 dark:bg-[#111418] md:static md:z-20 md:w-64 md:max-w-none md:translate-x-0 ${mobileSidebarOpen ? 'translate-x-0' : ''}`}>
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 p-1.5 rounded-lg text-primary">
                <span className="material-symbols-outlined text-2xl">videocam</span>
              </div>
              <div>
                <h1 className="text-base font-bold leading-none tracking-tight">PTIT-Meet</h1>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Meeting workspace</span>
              </div>
            </div>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white md:hidden"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1">
            <Link
              to="/dashboard"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${isActive('/dashboard') || isActive('/') ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <span className="material-symbols-outlined group-hover:scale-110 transition-transform" style={isActive('/dashboard') ? { fontVariationSettings: "'FILL' 1" } : {}}>grid_view</span>
              <span className="text-sm font-medium">Dashboard</span>
            </Link>
            
            <Link
              to="/schedule"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${isActive('/schedule') ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <span className="material-symbols-outlined group-hover:scale-110 transition-transform" style={isActive('/schedule') ? { fontVariationSettings: "'FILL' 1" } : {}}>event_available</span>
              <span className="text-sm font-medium">Schedule Meeting</span>
            </Link>

            <Link 
              to="/history"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${isActive('/history') || isActive('/') ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <span className="material-symbols-outlined group-hover:scale-110 transition-transform" style={isActive('/history') ? { fontVariationSettings: "'FILL' 1" } : {}}>history</span>
              <span className="text-sm font-medium">History</span>
            </Link>

            <Link
              to="/recordings"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${isActive('/recordings') ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <span className="material-symbols-outlined group-hover:scale-110 transition-transform">cloud_upload</span>
              <span className="text-sm font-medium">Recordings</span>
            </Link>
            
            <button onClick={() => navigate("/settings")} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group w-full ${isActive('/settings') ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <span className="material-symbols-outlined group-hover:scale-110 transition-transform">settings</span>
              <span className="text-sm font-medium text-left">Settings</span>
            </button>

            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/50 px-3">
              <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Support</p>
              <button onClick={logout} className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group text-left">
                <span className="material-symbols-outlined group-hover:scale-110 transition-transform">logout</span>
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </nav>

          {/* User Info */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800/50">
            <button 
              onClick={() => navigate('/settings', { state: { tab: 'profile' } })}
              className="flex w-full items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="relative">
                <div className="size-10 rounded-full bg-slate-700 bg-cover border-2 border-slate-700" style={{ backgroundImage: `url(${user?.avatarUrl || 'https://picsum.photos/100'})` }}></div>
                <span className="absolute bottom-0 right-0 size-3 bg-green-500 border-2 border-white dark:border-[#111418] rounded-full"></span>
              </div>
              <div className="flex-1 overflow-hidden text-left">
                <p className="text-sm font-semibold truncate">{user?.fullName || 'User'}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Header dùng chung */}
        <header className="h-16 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm min-w-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="flex items-center justify-center rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white md:hidden"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
            <span>PTIT-Meet</span>
            <span className="material-symbols-outlined hidden md:block mx-2 text-[16px]">chevron_right</span>
            <span className="truncate text-slate-900 dark:text-white font-medium capitalize">
              {location.pathname === '/' ? 'Dashboard' : location.pathname.substring(1)}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm font-medium text-slate-500 md:block">
              Workspace
            </span>
          </div>
        </header>

        {/* Nơi chèn nội dung của từng trang (Dashboard, Schedule...) */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
