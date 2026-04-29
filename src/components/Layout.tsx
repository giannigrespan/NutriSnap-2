import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Camera, Activity, FileText, User, LogOut } from 'lucide-react';
import { signOut } from '../lib/firebase';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function Layout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/' },
    { icon: Camera, label: 'Cibo', path: '/food' },
    { icon: Activity, label: 'Attività', path: '/activity' },
    { icon: FileText, label: 'Piano', path: '/plan' },
  ];

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pl-20 xl:pl-64">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-20 xl:w-64 bg-white border-r border-gray-100 flex-col items-center xl:items-stretch py-8 px-4 z-50">
        <div className="xl:px-4 mb-12">
          <h1 className="text-2xl font-bold text-brand-primary hidden xl:block">NutriSnap</h1>
          <div className="w-10 h-10 bg-brand-primary rounded-xl md:block xl:hidden" />
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
            className="flex items-center gap-4 p-3 rounded-2xl text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-all"
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
      <nav className="md:hidden fixed bottom-6 left-6 right-6 h-20 bg-white/90 backdrop-blur-xl border border-gray-100 rounded-3xl shadow-2xl flex items-center justify-around px-2 z-50">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-2xl transition-all",
              location.pathname === item.path ? "text-brand-primary" : "text-gray-400"
            )}
          >
            <item.icon size={22} strokeWidth={location.pathname === item.path ? 2.5 : 2} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">{item.label}</span>
            {location.pathname === item.path && (
              <motion.div layoutId="nav-dot" className="w-1 h-1 bg-brand-primary rounded-full mt-0.5" />
            )}
          </Link>
        ))}
        <Link to="/profile" className={cn("flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-2xl", location.pathname === '/profile' ? "text-brand-primary" : "text-gray-400")}>
          <User size={22} />
          <span className="text-[10px] font-semibold uppercase tracking-wider">Tu</span>
        </Link>
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-10">
        {children}
      </main>
    </div>
  );
}
