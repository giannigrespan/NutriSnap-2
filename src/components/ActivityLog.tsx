import React, { useState, useEffect } from 'react';
import { Dumbbell, Clock, Flame, Check, Loader2, Plus, Trash2, Pencil } from 'lucide-react';
import { db, handleFirestoreError, OperationType, serverTimestamp, collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc } from '../lib/firebase';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { cn, safeDate } from '../lib/utils';
import { startOfDay, endOfDay } from 'date-fns';
import { WorkoutDetail, ExerciseEntry } from '../types';

export default function ActivityLog() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    activityType: '',
    durationMinutes: 30,
    caloriesBurned: 200,
  });

  const [workoutDetails, setWorkoutDetails] = useState<WorkoutDetail[]>([]);

  const [syncing, setSyncing] = useState(false);
  const [todayLogs, setTodayLogs] = useState<ExerciseEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    const today = new Date();
    const start = startOfDay(today).toISOString();
    const end = endOfDay(today).toISOString();

    const q = query(
      collection(db, 'exerciseLogs'),
      where('userId', '==', user.uid),
      where('date', '>=', start),
      where('date', '<=', end)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ExerciseEntry));
      setTodayLogs(logs.sort((a, b) => safeDate(b.createdAt).getTime() - safeDate(a.createdAt).getTime()));
    }, error => handleFirestoreError(error, OperationType.LIST, 'exerciseLogs'));

    return () => unsubscribe();
  }, [user]);

  const commonActivities = [
    { type: 'Corsa', calPerMin: 10, epoc: 1.10 },
    { type: 'Camminata', calPerMin: 4, epoc: 1.05 }, // Cardio leggero: +5-10%
    { type: 'Palestra / Pesi', calPerMin: 6, epoc: 1.15 }, // Pesi tradizionali: +10-15%
    { type: 'Nuoto', calPerMin: 8, epoc: 1.10 },
    { type: 'Ciclismo', calPerMin: 7, epoc: 1.10 },
    { type: 'Yoga', calPerMin: 3, epoc: 1.0 },
    { type: 'HIIT', calPerMin: 12, epoc: 1.20 }, // HIIT: +15-25%
  ];

  const recalculateCalories = (details: WorkoutDetail[], minutes: number, actType: string) => {
    let cals = 0;
    let epocMultiplier = 1.0;

    if (details.length > 0) {
      cals += minutes * 2; // Base calories for activity with pauses
      
      let isHeavy = false;
      details.forEach(d => {
        // Simple formula: sets * reps * (weight % / 100) * factor
        cals += d.sets * d.reps * (d.weight / 100) * 0.5;
        
        const nameLower = d.name.toLowerCase();
        // Heavy strength (squat, deadlift, stacchi): +15-20%
        if (nameLower.includes('squat') || nameLower.includes('deadlift') || nameLower.includes('stacc')) {
            isHeavy = true;
        }
      });
      
      epocMultiplier = isHeavy ? 1.20 : 1.15;
    } else {
      const selectedActivity = commonActivities.find(a => a.type === actType);
      const calPerMin = selectedActivity?.calPerMin || 5;
      cals = calPerMin * minutes;
      epocMultiplier = selectedActivity?.epoc || 1.0;
    }
    
    // Apply EPOC (Excess Post-exercise Oxygen Consumption)
    cals = cals * epocMultiplier;

    setFormData(prev => ({ ...prev, caloriesBurned: Math.round(cals) }));
  };

  const handleActivitySelect = (activity: typeof commonActivities[0]) => {
    setFormData(prev => ({ ...prev, activityType: activity.type }));
    recalculateCalories(workoutDetails, formData.durationMinutes, activity.type);
  };

  const handleDurationChange = (minutes: number) => {
    setFormData(prev => ({ ...prev, durationMinutes: minutes }));
    recalculateCalories(workoutDetails, minutes, formData.activityType);
  };

  const handleAddDetail = () => {
    const newDetails = [...workoutDetails, { name: '', sets: 3, reps: 10, weight: 70 }];
    setWorkoutDetails(newDetails);
    recalculateCalories(newDetails, formData.durationMinutes, formData.activityType);
  };

  const updateDetail = (index: number, field: keyof WorkoutDetail, value: any) => {
    const newDetails = [...workoutDetails];
    newDetails[index] = { ...newDetails[index], [field]: value };
    setWorkoutDetails(newDetails);
    recalculateCalories(newDetails, formData.durationMinutes, formData.activityType);
  };

  const removeDetail = (index: number) => {
    const newDetails = workoutDetails.filter((_, i) => i !== index);
    setWorkoutDetails(newDetails);
    recalculateCalories(newDetails, formData.durationMinutes, formData.activityType);
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.activityType) return;
    setLoading(true);

    try {
      if (editingId) {
        await updateDoc(doc(db, 'exerciseLogs', editingId), {
          activityType: formData.activityType,
          durationMinutes: formData.durationMinutes,
          caloriesBurned: formData.caloriesBurned,
          workoutDetails: workoutDetails.length > 0 ? workoutDetails : [],
        });
        setEditingId(null);
        setFormData({ activityType: '', durationMinutes: 30, caloriesBurned: 200 });
        setWorkoutDetails([]);
      } else {
        await addDoc(collection(db, 'exerciseLogs'), {
          userId: user.uid,
          date: new Date().toISOString(),
          activityType: formData.activityType,
          durationMinutes: formData.durationMinutes,
          caloriesBurned: formData.caloriesBurned,
          ...(workoutDetails.length > 0 ? { workoutDetails } : {}),
          createdAt: serverTimestamp(),
        });
        setFormData({ activityType: '', durationMinutes: 30, caloriesBurned: 200 });
        setWorkoutDetails([]);
      }
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.WRITE, 'exerciseLogs');
    } finally {
      setLoading(false);
    }
  };

  const handleEditLog = (log: ExerciseEntry) => {
    setEditingId(log.id!);
    setFormData({
      activityType: log.activityType,
      durationMinutes: log.durationMinutes,
      caloriesBurned: log.caloriesBurned,
    });
    setWorkoutDetails(log.workoutDetails || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm("Sei sicuro di voler eliminare questa attività?")) return;
    try {
      await deleteDoc(doc(db, 'exerciseLogs', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'exerciseLogs');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ activityType: '', durationMinutes: 30, caloriesBurned: 200 });
    setWorkoutDetails([]);
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
                onChange={(e) => setFormData(prev => ({ ...prev, caloriesBurned: Number(e.target.value) }))}
                className="input-field text-2xl font-bold text-orange-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold uppercase tracking-widest text-gray-400">Dettaglio Esercizi (Opzionale)</label>
              <button
                type="button"
                onClick={handleAddDetail}
                className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={16} /> Aggiungi Esercizio
              </button>
            </div>
            
            <AnimatePresence>
              {workoutDetails.map((detail, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, height: 0, scale: 0.95 }}
                  animate={{ opacity: 1, height: 'auto', scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.95 }}
                  className="bg-gray-50 rounded-2xl p-4 space-y-4 relative"
                >
                  <button
                    type="button"
                    onClick={() => removeDetail(index)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                  
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Nome Esercizio</label>
                    <input
                      type="text"
                      value={detail.name}
                      onChange={(e) => updateDetail(index, 'name', e.target.value)}
                      placeholder="es. Panca piana, Squat..."
                      className="w-full bg-white border-transparent focus:border-blue-500 rounded-lg px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Serie</label>
                      <input
                        type="number"
                        min="1"
                        value={detail.sets}
                        onChange={(e) => updateDetail(index, 'sets', Number(e.target.value) || 0)}
                        className="w-full bg-white border-transparent focus:border-blue-500 rounded-lg px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Ripetizioni</label>
                      <input
                        type="number"
                        min="1"
                        value={detail.reps}
                        onChange={(e) => updateDetail(index, 'reps', Number(e.target.value) || 0)}
                        className="w-full bg-white border-transparent focus:border-blue-500 rounded-lg px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1" title="Percentuale di sforzo o Carico (es. 1RM%)">Carico (%)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={detail.weight}
                        onChange={(e) => updateDetail(index, 'weight', Number(e.target.value) || 0)}
                        className="w-full bg-white border-transparent focus:border-blue-500 rounded-lg px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="flex gap-3">
            <button
              disabled={loading || !formData.activityType}
              className="btn-primary flex-1 py-4 text-lg bg-blue-500 hover:bg-blue-600 flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Check size={24} />}
              {editingId ? "Salva Modifiche" : "Logga attività"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="btn-secondary flex-1 py-4 text-lg border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center gap-3"
              >
                Annulla
              </button>
            )}
          </div>
        </form>
      </motion.div>

      {todayLogs.length > 0 && (
        <div className="mt-12 space-y-4">
          <h2 className="text-2xl font-bold">Attività di oggi</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {todayLogs.map(log => (
              <motion.div key={log.id} layout className="glass-card p-6 flex flex-col relative group">
                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleEditLog(log)}
                    className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-blue-500 hover:text-white transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteLog(log.id!)}
                    className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex items-start justify-between mb-4 pr-16">
                  <h3 className="text-lg font-bold line-clamp-2">{log.activityType}</h3>
                </div>
                
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Clock size={16} />
                    <span className="font-semibold">{log.durationMinutes} min</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-orange-500">
                    <Flame size={16} />
                    <span className="font-bold">{log.caloriesBurned} kcal</span>
                  </div>
                </div>

                {log.workoutDetails && log.workoutDetails.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Esercizi ({log.workoutDetails.length})</p>
                    {log.workoutDetails.map((w, i) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded-lg">
                        <span className="font-semibold text-gray-700">{w.name || `Esercizio ${i+1}`}</span>
                        <span className="text-gray-500">{w.sets}x{w.reps} {w.weight ? `@${w.weight}%` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
