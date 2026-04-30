import React, { useState } from 'react';
import { generateMealPlan } from '../lib/gemini';
import { useAuth } from '../AuthContext';
import { motion } from 'motion/react';
import { Sparkles, Loader2, Apple, ChevronRight, Bookmark } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';

export default function Plan() {
  const { profile, user } = useAuth();
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!user || !profile) return;
    setLoading(true);
    try {
      // Fetch recent logs for context
      const q = query(
        collection(db, 'foodLogs'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const snap = await getDocs(q);
      const logs = snap.docs.map(doc => doc.data());
      
      const newPlan = await generateMealPlan(profile, logs);
      setPlan(newPlan);
    } catch (err) {
      console.error("Plan generation failed:", err);
      alert("Errore nella generazione del piano.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Piano Alimentare AI</h1>
          <p className="text-gray-500">Piani personalizzati basati sul tuo profilo e tracker</p>
        </div>
        {!plan && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
            Genera Piano
          </button>
        )}
      </div>

      {!plan && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="glass-card p-6 md:p-8 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center text-brand-primary">
              <Apple size={32} />
            </div>
            <h3 className="text-xl font-bold">Piano Giornaliero</h3>
            <p className="text-gray-500">Un piano specifico per le prossime 24 ore considerando i log precedenti.</p>
          </div>
          <div className="glass-card p-6 md:p-8 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
              <Bookmark size={32} />
            </div>
            <h3 className="text-xl font-bold">Consigli su Misura</h3>
            <p className="text-gray-500">Suggerimenti su macro e micro nutrienti basati sul tuo obiettivo.</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="glass-card p-20 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="animate-spin text-brand-primary" size={48} />
          <p className="font-medium text-gray-500">Il nutrizionista AI sta elaborando i tuoi dati...</p>
        </div>
      )}

      {plan && (
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="glass-card p-6 md:p-10 prose prose-emerald max-w-none prose-headings:font-bold prose-p:text-gray-600 prose-li:text-gray-600"
        >
          <div className="flex justify-end mb-4">
             <button onClick={() => setPlan(null)} className="text-sm text-gray-400 hover:text-gray-600 underline">Rigenera nuovo piano</button>
          </div>
          <ReactMarkdown>{plan}</ReactMarkdown>
        </motion.div>
      )}
    </div>
  );
}
