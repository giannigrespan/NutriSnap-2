import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Home from './components/Home';
import Profile from './components/Profile';
import FoodLog from './components/FoodLog';
import ActivityLog from './components/ActivityLog';
import Plan from './components/Plan';
import Layout from './components/Layout';
import { signIn } from './lib/firebase';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, profile } = useAuth();
  
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
    </div>
  );
  
  if (!user) return <LoginView />;
  
  // If user exists but no profile, and we are not on the profile page, redirect to profile
  if (!profile && window.location.pathname !== '/profile') {
    return <Navigate to="/profile" />;
  }

  return <>{children}</>;
};

const LoginView = () => (
  <div className="min-h-screen flex items-center justify-center p-6 text-center">
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md w-full glass-card p-10 space-y-8"
    >
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">NutriSnap AI</h1>
        <p className="text-gray-500">Gestisci la tua dieta con l'intelligenza artificiale</p>
      </div>
      
      <div className="aspect-square bg-brand-primary/5 rounded-full flex items-center justify-center p-12">
        <div className="grid grid-cols-2 gap-4 w-full h-full">
          {[1,2,3,4].map(i => (
             <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center overflow-hidden">
               <img 
                 src={`https://images.unsplash.com/photo-${i === 1 ? '1546069901-ba9599a7e63c' : i === 2 ? '1490645935967-10de6ba17061' : i === 3 ? '1504674900247-0877df9cc836' : '1540189549336-e6e99c3679fe'}?w=200&h=200&fit=crop`} 
                 alt="Food" 
                 referrerPolicy="no-referrer"
               />
             </div>
          ))}
        </div>
      </div>

      <button onClick={signIn} className="btn-primary w-full flex items-center justify-center gap-2">
        <LogIn size={20} />
        Inizia ora con Google
      </button>
    </motion.div>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
          <Route path="/food" element={<ProtectedRoute><Layout><FoodLog /></Layout></ProtectedRoute>} />
          <Route path="/activity" element={<ProtectedRoute><Layout><ActivityLog /></Layout></ProtectedRoute>} />
          <Route path="/plan" element={<ProtectedRoute><Layout><Plan /></Layout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
