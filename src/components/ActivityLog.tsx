import React, { useState } from 'react';
import { Dumbbell, Clock, Flame, Check, Loader2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType, serverTimestamp, collection, addDoc } from '../lib/firebase';
import { useAuth } from '../AuthContext';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function ActivityLog() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    activityType: '',
    durationMinutes: 30,
    caloriesBurned: 200,
  });

  const [syncing, setSyncing] = useState(false);

  const handleSyncWahoo = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/wahoo/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Sincronizzati ${data.syncedCount} nuovi allenamenti!`);
        navigate('/');
      } else {
        alert(data.error || 'Errore durante la sincronizzazione');
      }
    } catch (err) {
      console.error(err);
      alert('Impossibile sincronizzare. Assicurati che Wahoo sia connesso nel profilo.');
    } finally {
      setSyncing(false);
    }
  };

  const commonActivities = [
    { type: 'Corsa', calPerMin: 10 },
    { type: 'Camminata', calPerMin: 4 },
    { type: 'Palestra / Pesi', calPerMin: 6 },
    { type: 'Nuoto', calPerMin: 8 },
    { type: 'Ciclismo', calPerMin: 7 },
    { type: 'Yoga', calPerMin: 3 },
  ];

  const handleActivitySelect = (activity: typeof commonActivities[0]) => {
    setFormData({
      ...formData,
      activityType: activity.type,
      caloriesBurned: activity.calPerMin * formData.durationMinutes,
    });
  };

  const handleDurationChange = (minutes: number) => {
    const selectedActivity = commonActivities.find(a => a.type === formData.activityType);
    const calPerMin = selectedActivity?.calPerMin || 5;
    setFormData({
      ...formData,
      durationMinutes: minutes,
      caloriesBurned: calPerMin * minutes,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.activityType) return;
    setLoading(true);

    try {
      await addDoc(collection(db, 'exerciseLogs'), {
        userId: user.uid,
        date: new Date().toISOString(),
        activityType: formData.activityType,
        durationMinutes: formData.durationMinutes,
        caloriesBurned: formData.caloriesBurned,
        createdAt: serverTimestamp(),
      });
      navigate('/');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'exerciseLogs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 md:py-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-6 md:p-10"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8 sm:mb-10">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
              <Dumbbell size={28} className="sm:w-8 sm:h-8" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Log Attività</h1>
              <p className="text-sm sm:text-base text-gray-500">Monitora le calorie bruciate</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={handleSyncWahoo} 
            disabled={syncing}
            className="flex items-center justify-center sm:justify-start w-full sm:w-auto gap-2 px-4 py-3 sm:py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-all border border-blue-100"
          >
            {syncing ? <Loader2 className="animate-spin" size={18} /> : <img src="https://developers.wahoofitness.com/img/WahooLogo_Blue_on_Transparent.png" className="w-6 h-6 object-contain" alt="Wahoo" referrerPolicy="no-referrer" />}
            Sincronizza Wahoo
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <label className="text-sm font-bold uppercase tracking-widest text-gray-400">Attività rapide</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {commonActivities.map((act) => (
                <button
                  key={act.type}
                  type="button"
                  onClick={() => handleActivitySelect(act)}
                  className={cn(
                    "p-4 rounded-2xl border font-semibold transition-all text-sm",
                    formData.activityType === act.type 
                      ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-200" 
                      : "bg-white border-gray-100 hover:border-blue-200 text-gray-700"
                  )}
                >
                  {act.type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-2">
               Nome attività personalizzata
            </label>
            <input
              type="text"
              value={formData.activityType}
              onChange={(e) => setFormData({ ...formData, activityType: e.target.value })}
              className="input-field"
              placeholder="Esempio: Calcetto con amici"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Clock size={16} /> Durata (minuti)
              </label>
              <input
                type="range"
                min="5"
                max="180"
                step="5"
                value={formData.durationMinutes}
                onChange={(e) => handleDurationChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-center font-bold text-2xl text-blue-600">{formData.durationMinutes} min</p>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Flame size={16} /> Calorie bruciate
              </label>
              <input
                type="number"
                value={formData.caloriesBurned}
                onChange={(e) => setFormData({ ...formData, caloriesBurned: Number(e.target.value) })}
                className="input-field text-2xl font-bold text-orange-500"
              />
            </div>
          </div>

          <button
            disabled={loading || !formData.activityType}
            className="btn-primary w-full py-4 text-lg bg-blue-500 hover:bg-blue-600 flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Check size={24} />}
            Logga attività
          </button>
        </form>
      </motion.div>
    </div>
  );
}
