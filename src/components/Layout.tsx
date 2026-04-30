import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Camera, Activity, FileText, User, LogOut } from 'lucide-react';
import { signOut } from '../lib/firebase';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function Layout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Camera, label: 'Cibo', path: '/food' },
    { icon: Activity, label: 'Attività', path: '/activity' },
    { icon: FileText, label: 'Piano', path: '/plan' },
  ];

  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pl-20 xl:pl-64">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-20 xl:w-64 bg-white border-r border-gray-100 flex-col items-center xl:items-stretch py-8 px-4 z-50">
        <div className="xl:px-4 mb-12 flex justify-center xl:justify-start">
          <h1 className="text-2xl font-bold text-brand-primary hidden xl:block">NutriSnap</h1>
          <div className="w-10 h-10 bg-brand-primary rounded-xl hidden md:block xl:hidden" />
        </div>
        
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-4 p-3 rounded-2xl transition-all group",
                location.pathname === item.path 
                  ? "bg-brand-primary text-white" 
                  : "hover:bg-gray-50 text-gray-400 hover:text-gray-900"
              )}
            >
              <item.icon size={24} />
              <span className="hidden xl:block font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="space-y-2 mt-auto">
          <Link
            to="/profile"
            className={cn(
              "flex items-center gap-4 p-3 rounded-2xl transition-all w-full",
              location.pathname === '/profile'
                ? "bg-brand-primary text-white" 
                : "text-gray-400 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            <User size={24} />
            <span className="hidden xl:block font-medium">Profilo</span>
          </Link>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-4 p-3 rounded-2xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all w-full"
          >
            <LogOut size={24} />
            <span className="hidden xl:block font-medium">Esci</span>
          </button>
        </div>
      </aside>

      {/* Tab Bar Mobile */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200 flex items-center justify-around px-2 pt-2 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      >
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-2xl transition-all relative",
              location.pathname === item.path ? "text-brand-primary" : "text-gray-400"
            )}
          >
            <item.icon size={22} strokeWidth={location.pathname === item.path ? 2.5 : 2} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">{item.label}</span>
          </Link>
        ))}
        <Link 
          to="/profile" 
          className={cn(
            "flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-2xl relative", 
            location.pathname === '/profile' ? "text-brand-primary" : "text-gray-400"
          )}
        >
          <User size={22} strokeWidth={location.pathname === '/profile' ? 2.5 : 2} />
          <span className="text-[10px] font-semibold uppercase tracking-wider">Tu</span>
        </Link>
      </nav>

      <main className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-10">
        {children}
      </main>
    </div>
  );
}
