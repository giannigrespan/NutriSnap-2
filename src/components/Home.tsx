import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { FoodEntry, ExerciseEntry } from '../types';
import { formatNumber, cn, safeDate } from '../lib/utils';
import { motion } from 'motion/react';
import { Flame, Apple, Dumbbell, ChevronRight, TrendingUp, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { startOfDay, format, isSameDay, subDays } from 'date-fns';
import { it } from 'date-fns/locale';

export default function Home() {
  const { profile, user } = useAuth();
  const [foodLogs, setFoodLogs] = useState<FoodEntry[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseEntry[]>([]);

  useEffect(() => {
    if (!user) return;

    const qFood = query(
      collection(db, 'foodLogs'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const qExercise = query(
      collection(db, 'exerciseLogs'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubFood = onSnapshot(qFood, (snapshot) => {
      setFoodLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FoodEntry)));
    });

    const unsubEx = onSnapshot(qExercise, (snapshot) => {
      setExerciseLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ExerciseEntry)));
    });

    return () => {
      unsubFood();
      unsubEx();
    };
  }, [user]);

  const today = startOfDay(new Date());
  const todayFood = foodLogs.filter(log => isSameDay(safeDate(log.date), today));
  const todayEx = exerciseLogs.filter(log => isSameDay(safeDate(log.date), today));

  const consumed = todayFood.reduce((acc, log) => acc + log.calories, 0);
  const burned = todayEx.reduce((acc, log) => acc + log.caloriesBurned, 0);
  const target = profile?.dailyCalorieTarget || 2000;
  const net = consumed - burned;
  const remaining = target - net;

  const handleDeleteLog = async (id: string, isFood: boolean) => {
    if (!window.confirm('Vuoi eliminare questo log?')) return;
    try {
      const collectionName = isFood ? 'foodLogs' : 'exerciseLogs';
      await deleteDoc(doc(db, collectionName, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, isFood ? 'foodLogs' : 'exerciseLogs');
    }
  };

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dayFood = foodLogs.filter(log => isSameDay(safeDate(log.date), d));
    const dayEx = exerciseLogs.filter(log => isSameDay(safeDate(log.date), d));
    return {
      name: format(d, 'EEE', { locale: it }),
      consumed: dayFood.reduce((acc, log) => acc + log.calories, 0),
      burned: dayEx.reduce((acc, log) => acc + log.caloriesBurned, 0),
    };
  });

  const stats = [
    { label: 'Assunte', value: consumed, icon: Apple, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: 'Bruciate', value: burned, icon: Dumbbell, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Rimanenti', value: remaining, icon: Flame, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Ben tornato, {profile?.name || 'Utente'}!</h1>
          <p className="text-sm md:text-base text-gray-500">Ecco il progresso di oggi, {format(new Date(), "d MMMM", { locale: it })}</p>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn("glass-card p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-5", i === 2 ? "col-span-2 lg:col-span-1" : "")}
          >
            <div className={cn("w-12 h-12 md:w-14 md:h-14 rounded-2xl flex shrink-0 items-center justify-center", stat.bg, stat.color)}>
              <stat.icon size={24} className="md:w-7 md:h-7" />
            </div>
            <div>
              <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
              <h3 className="text-xl md:text-2xl font-bold">{formatNumber(stat.value)} <span className="text-xs md:text-sm font-normal text-gray-400">kcal</span></h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="lg:col-span-2 glass-card p-4 md:p-8 min-h-[300px] md:min-h-[400px] flex flex-col"
        >
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
              <TrendingUp size={20} className="text-brand-primary" />
              Andamento Settimanale
            </h3>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#999' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#999' }} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="consumed" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="burned" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Recent Logs (Mixed) */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold">Log Recenti</h3>
          <div className="space-y-3">
            {[...todayFood, ...todayEx]
              .sort((a, b) => safeDate(b.createdAt).getTime() - safeDate(a.createdAt).getTime())
              .slice(0, 5)
              .map((log, i) => {
                const isFood = 'calories' in log;
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-4 bg-white rounded-2xl border border-gray-100 flex items-center justify-between hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", isFood ? "bg-orange-50 text-orange-500" : "bg-blue-50 text-blue-500")}>
                        {isFood ? <Apple size={20} /> : <Dumbbell size={20} />}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 line-clamp-1">
                          {isFood ? log.description : (log as any).activityType}
                        </p>
                        {isFood && (log as any).notes && (
                          <p className="text-xs text-gray-500 italic line-clamp-1 mt-0.5">{(log as any).notes}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {format(safeDate(log.createdAt), "HH:mm")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <p className={cn("font-bold", isFood ? "text-orange-500" : "text-blue-500")}>
                        {isFood ? `+${log.calories}` : `-${(log as any).caloriesBurned}`}
                      </p>
                      <button 
                        onClick={() => handleDeleteLog(log.id, isFood)} 
                        className="text-gray-300 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors"
                        title="Elimina log"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            
            {([...todayFood, ...todayEx]).length === 0 && (
              <div className="text-center py-10 text-gray-400">
                Ancora nessun log oggi
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
