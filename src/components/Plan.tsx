import React, { useState } from 'react';
import { generatePlan } from '../lib/gemini';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, Apple, Dumbbell, Coffee, Bookmark, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';

export default function Plan() {
  const { profile, user } = useAuth();
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [planType, setPlanType] = useState<'meals' | 'workout' | 'both'>('meals');
  const [specificRequest, setSpecificRequest] = useState('');

  const handleGenerate = async () => {
    if (!user || !profile) return;
    setLoading(true);
    try {
      // Fetch recent logs for context
      const qFood = query(
        collection(db, 'foodLogs'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const snapFood = await getDocs(qFood);
      const foodLogs = snapFood.docs.map(doc => doc.data());

      const qEx = query(
        collection(db, 'exerciseLogs'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const snapEx = await getDocs(qEx);
      const exerciseLogs = snapEx.docs.map(doc => doc.data());
      
      const newPlan = await generatePlan(profile, foodLogs, exerciseLogs, planType, specificRequest);
      setPlan(newPlan);
    } catch (err: any) {
      console.error("Plan generation failed:", err);
      if (err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED")) {
        alert("Limite AI superato (quota). Riprova tra un po' o aggiorna il piano.");
      } else {
        alert("Errore nella generazione del piano.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6 md:py-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Coach Personale</h1>
          <p className="text-gray-500">Piani su misura basati sul tuo profilo, log recenti e preferenze.</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card p-16 md:p-24 flex flex-col items-center justify-center space-y-6"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-brand-primary/20 rounded-full blur-xl animate-pulse"></div>
              <Sparkles className="text-brand-primary animate-pulse relative" size={48} />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold mb-2">Il tuo coach sta elaborando...</h3>
              <p className="font-medium text-gray-500">Analizzo i tuoi dati e preparo un piano perfetto per te.</p>
            </div>
          </motion.div>
        ) : !plan ? (
          <motion.div 
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="glass-card p-6 md:p-8">
              <h3 className="text-lg font-bold mb-4">Cosa vuoi pianificare?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setPlanType('meals')}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 text-center ${
                    planType === 'meals' 
                      ? 'border-brand-primary bg-brand-primary/5 text-brand-primary' 
                      : 'border-gray-100 hover:border-gray-200 text-gray-500'
                  }`}
                >
                  <Apple size={32} />
                  <div>
                    <div className="font-bold">Alimentazione</div>
                    <div className="text-xs opacity-80">Pasti per domani</div>
                  </div>
                </button>
                <button
                  onClick={() => setPlanType('workout')}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 text-center ${
                    planType === 'workout' 
                      ? 'border-blue-500 bg-blue-50 text-blue-600' 
                      : 'border-gray-100 hover:border-gray-200 text-gray-500'
                  }`}
                >
                  <Dumbbell size={32} />
                  <div>
                    <div className="font-bold">Allenamento</div>
                    <div className="text-xs opacity-80">Prossima sessione</div>
                  </div>
                </button>
                <button
                  onClick={() => setPlanType('both')}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 text-center ${
                    planType === 'both' 
                      ? 'border-purple-500 bg-purple-50 text-purple-600' 
                      : 'border-gray-100 hover:border-gray-200 text-gray-500'
                  }`}
                >
                  <Coffee size={32} />
                  <div>
                    <div className="font-bold">Combo Completa</div>
                    <div className="text-xs opacity-80">Dieta + Workout</div>
                  </div>
                </button>
              </div>

              <div className="mt-8">
                 <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Richieste o note specifiche (Opzionale)</h3>
                 <textarea
                   value={specificRequest}
                   onChange={e => setSpecificRequest(e.target.value)}
                   placeholder="Es: Ho poco tempo per cucinare, voglio spingere le gambe domani, senza lattosio..."
                   className="input-field w-full min-h-[100px] resize-none"
                 />
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                <button
                  onClick={handleGenerate}
                  className="btn-primary flex items-center gap-2 px-8 py-4 text-lg"
                >
                  <Sparkles size={20} />
                  Genera il mio Piano
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
             key="result"
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className="glass-card p-6 md:p-10"
          >
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100">
               <div>
                 <h2 className="text-2xl font-bold flex items-center gap-2">
                   <Sparkles className="text-brand-primary" /> 
                   Il Tuo Piano
                 </h2>
               </div>
               <button 
                  onClick={() => setPlan(null)} 
                  className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg"
                >
                  <RefreshCw size={16} /> 
                  Nuova Richiesta
                </button>
            </div>
            <div className="prose prose-emerald max-w-none prose-headings:font-bold prose-p:text-gray-600 prose-li:text-gray-600 prose-strong:text-gray-900">
               <ReactMarkdown>{plan}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
