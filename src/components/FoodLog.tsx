import React, { useRef, useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, Upload, Loader2, Apple, Check, X, Pencil, Trash2 } from 'lucide-react';
import { analyzeFoodImage, FoodAnalysis } from '../lib/gemini';
import { db, handleFirestoreError, OperationType, serverTimestamp, collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc } from '../lib/firebase';
import { useAuth } from '../AuthContext';
import { cn, safeDate } from '../lib/utils';
import { startOfDay, endOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid, LabelList } from 'recharts';
import { FoodEntry } from '../types';

export default function FoodLog() {
  const { user } = useAuth();
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<FoodAnalysis | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const [notes, setNotes] = useState('');
  
  const [todayLogs, setTodayLogs] = useState<FoodEntry[]>([]);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<FoodEntry>>({});

  useEffect(() => {
    if (!user) return;
    const today = new Date();
    const start = startOfDay(today).toISOString();
    const end = endOfDay(today).toISOString();

    const q = query(
      collection(db, 'foodLogs'),
      where('userId', '==', user.uid),
      where('date', '>=', start),
      where('date', '<=', end)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodEntry));
      setTodayLogs(logs.sort((a, b) => safeDate(b.createdAt).getTime() - safeDate(a.createdAt).getTime()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'foodLogs');
    });

    return () => unsubscribe();
  }, [user]);

  const handleEditLog = (log: FoodEntry) => {
    setEditingLogId(log.id!);
    setEditFormData({
      description: log.description,
      calories: log.calories,
      protein: log.protein,
      carbs: log.carbs,
      fat: log.fat,
      mealType: log.mealType,
      notes: log.notes
    });
  };

  const saveEditedLog = async () => {
    if (!editingLogId) return;
    try {
      const dataToUpdate = { ...editFormData };
      if (dataToUpdate.notes === undefined) delete dataToUpdate.notes;
      if (dataToUpdate.description === undefined) delete dataToUpdate.description;
      
      await updateDoc(doc(db, 'foodLogs', editingLogId), dataToUpdate);
      setEditingLogId(null);
    } catch (error) {
      console.error(error);
      handleFirestoreError(error, OperationType.UPDATE, 'foodLogs');
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo pasto?")) return;
    try {
      await deleteDoc(doc(db, 'foodLogs', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'foodLogs');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      setImagePreview(reader.result as string);
      setAnalyzing(true);
      try {
        const analysis = await analyzeFoodImage(base64String);
        setResult(analysis);
      } catch (err) {
        console.error("Analysis failed:", err);
        alert("Impossibile analizzare l'immagine. Riprova.");
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveLog = async () => {
    if (!user || !result) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'foodLogs'), {
        userId: user.uid,
        date: new Date().toISOString(),
        description: result.description,
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        mealType: result.mealType,
        notes: notes,
        imageUrl: '', // In actual implementation would upload to storage
        createdAt: serverTimestamp(),
      });
      setResult(null);
      setImagePreview(null);
      setNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'foodLogs');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Log del Cibo</h1>
          <p className="text-gray-500">Scatta una foto o carica un'immagine del tuo pasto</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <motion.div 
          className={cn(
            "aspect-square rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-8 transition-all hover:bg-white hover:border-brand-primary group cursor-pointer overflow-hidden relative",
            imagePreview && "border-solid border-brand-primary"
          )}
          onClick={() => !analyzing && fileInputRef.current?.click()}
        >
          {imagePreview ? (
            <>
              <img src={imagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
              {analyzing && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                  <Loader2 className="animate-spin mb-2" size={40} />
                  <p className="font-medium">Analizzando con NutriSnap AI...</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-brand-primary/5 rounded-full flex items-center justify-center text-brand-primary mb-6 group-hover:scale-110 transition-transform">
                <Camera size={40} />
              </div>
              <h3 className="text-xl font-bold mb-2">Scatta una foto</h3>
              <p className="text-gray-400 text-center max-w-[200px]">Usa la fotocamera o trascina un'immagine qui</p>
            </>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
          />
        </motion.div>

        {/* Analysis Result */}
        <AnimatePresence>
          {result ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass-card p-6 md:p-8 flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-xs font-bold uppercase tracking-wider">
                  <Apple size={14} /> Analisi Completata
                </div>
                <button onClick={() => { setResult(null); setImagePreview(null); }} className="text-gray-400 hover:text-red-500">
                  <X size={20} />
                </button>
              </div>

              <input
                value={result.description}
                onChange={(e) => setResult({ ...result, description: e.target.value })}
                className="text-xl md:text-2xl font-bold mb-2 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-brand-primary focus:outline-none transition-colors w-full pb-1"
              />
              <div className="flex gap-4 mb-4 md:mb-6">
                <select
                  value={result.mealType}
                  onChange={(e) => setResult({ ...result, mealType: e.target.value as any })}
                  className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 appearance-none cursor-pointer"
                >
                  <option value="breakfast">Colazione</option>
                  <option value="lunch">Pranzo</option>
                  <option value="dinner">Cena</option>
                  <option value="snack">Snack</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6">
                <div className="p-3 md:p-4 bg-emerald-50 rounded-2xl flex flex-col justify-center relative group">
                  <p className="text-[10px] md:text-xs font-bold text-emerald-600 uppercase mb-1">Calorie (kcal)</p>
                  <input
                    type="number"
                    value={result.calories}
                    onChange={(e) => setResult({ ...result, calories: Number(e.target.value) || 0 })}
                    className="text-xl md:text-2xl font-bold text-emerald-900 bg-transparent focus:outline-none w-full"
                  />
                  <div className="absolute inset-0 border-2 border-transparent group-hover:border-emerald-200 rounded-2xl pointer-events-none transition-colors" />
                </div>
                <div className="p-3 md:p-4 bg-blue-50 rounded-2xl flex flex-col justify-center relative group">
                  <p className="text-[10px] md:text-xs font-bold text-blue-600 uppercase mb-1">Proteine (g)</p>
                  <input
                    type="number"
                    value={result.protein}
                    onChange={(e) => setResult({ ...result, protein: Number(e.target.value) || 0 })}
                    className="text-xl md:text-2xl font-bold text-blue-900 bg-transparent focus:outline-none w-full"
                  />
                  <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-200 rounded-2xl pointer-events-none transition-colors" />
                </div>
                <div className="p-3 md:p-4 bg-orange-50 rounded-2xl flex flex-col justify-center relative group">
                  <p className="text-[10px] md:text-xs font-bold text-orange-600 uppercase mb-1">Carboidrati (g)</p>
                  <input
                    type="number"
                    value={result.carbs}
                    onChange={(e) => setResult({ ...result, carbs: Number(e.target.value) || 0 })}
                    className="text-xl md:text-2xl font-bold text-orange-900 bg-transparent focus:outline-none w-full"
                  />
                  <div className="absolute inset-0 border-2 border-transparent group-hover:border-orange-200 rounded-2xl pointer-events-none transition-colors" />
                </div>
                <div className="p-3 md:p-4 bg-red-50 rounded-2xl flex flex-col justify-center relative group">
                  <p className="text-[10px] md:text-xs font-bold text-red-600 uppercase mb-1">Grassi (g)</p>
                  <input
                    type="number"
                    value={result.fat}
                    onChange={(e) => setResult({ ...result, fat: Number(e.target.value) || 0 })}
                    className="text-xl md:text-2xl font-bold text-red-900 bg-transparent focus:outline-none w-full"
                  />
                  <div className="absolute inset-0 border-2 border-transparent group-hover:border-red-200 rounded-2xl pointer-events-none transition-colors" />
                </div>
              </div>

              <div className="space-y-3 mb-6 md:mb-8 px-2">
                <p className="text-sm font-semibold text-gray-700 mb-2">Composizione Macronutrienti</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold w-12 text-blue-600">PRO</span>
                  <div className="flex-1 bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-blue-400 h-full rounded-full transition-all" style={{ width: `${(result.protein + result.carbs + result.fat) > 0 ? (result.protein / (result.protein + result.carbs + result.fat)) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs font-medium w-8 text-right text-gray-500">{((result.protein + result.carbs + result.fat) > 0 ? (result.protein / (result.protein + result.carbs + result.fat)) * 100 : 0).toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold w-12 text-orange-600">CARB</span>
                  <div className="flex-1 bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-orange-400 h-full rounded-full transition-all" style={{ width: `${(result.protein + result.carbs + result.fat) > 0 ? (result.carbs / (result.protein + result.carbs + result.fat)) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs font-medium w-8 text-right text-gray-500">{((result.protein + result.carbs + result.fat) > 0 ? (result.carbs / (result.protein + result.carbs + result.fat)) * 100 : 0).toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold w-12 text-red-600">FAT</span>
                  <div className="flex-1 bg-gray-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-red-400 h-full rounded-full transition-all" style={{ width: `${(result.protein + result.carbs + result.fat) > 0 ? (result.fat / (result.protein + result.carbs + result.fat)) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs font-medium w-8 text-right text-gray-500">{((result.protein + result.carbs + result.fat) > 0 ? (result.fat / (result.protein + result.carbs + result.fat)) * 100 : 0).toFixed(0)}%</span>
                </div>
              </div>

              <div className="mb-6 md:mb-8">
                <label htmlFor="notes" className="block text-sm font-semibold text-gray-700 mb-2">Note (opzionale)</label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Es. aggiunto un filo d'olio, porzione piccola..."
                  className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all min-h-[80px]"
                />
              </div>

              <button 
                onClick={saveLog}
                disabled={saving}
                className="btn-primary w-full mt-auto flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                {saving ? 'Salvataggio...' : 'Conferma e Logga'}
              </button>
            </motion.div>
          ) : !analyzing && (
            <div className="flex items-center justify-center border-2 border-dashed border-gray-100 rounded-3xl p-10 text-center text-gray-400 italic">
              Carica un'immagine per vedere i dettagli nutrizionali qui
            </div>
          )}
        </AnimatePresence>
      </div>

      {todayLogs.length > 0 && (
        <div className="mt-12 space-y-4">
          <h2 className="text-2xl font-bold">Pasti di oggi</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {todayLogs.map(log => (
              <motion.div key={log.id} layout className="glass-card p-6 flex flex-col relative group">
                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleEditLog(log)}
                    className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-brand-primary hover:text-white transition-colors"
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

                {editingLogId === log.id ? (
                  <div className="space-y-4">
                    <input
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      className="text-lg font-bold w-full bg-transparent border-b focus:border-brand-primary focus:outline-none mb-2"
                    />
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500">Calorie</label>
                        <input
                          type="number"
                          value={editFormData.calories}
                          onChange={(e) => setEditFormData({ ...editFormData, calories: Number(e.target.value) || 0 })}
                          className="w-full bg-gray-50 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500">Pasto</label>
                        <select
                          value={editFormData.mealType}
                          onChange={(e) => setEditFormData({ ...editFormData, mealType: e.target.value as any })}
                          className="w-full bg-gray-50 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                        >
                          <option value="breakfast">Colazione</option>
                          <option value="lunch">Pranzo</option>
                          <option value="dinner">Cena</option>
                          <option value="snack">Snack</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500">PRO (g)</label>
                        <input
                          type="number"
                          value={editFormData.protein}
                          onChange={(e) => setEditFormData({ ...editFormData, protein: Number(e.target.value) || 0 })}
                          className="w-full bg-gray-50 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500">CARB (g)</label>
                        <input
                          type="number"
                          value={editFormData.carbs}
                          onChange={(e) => setEditFormData({ ...editFormData, carbs: Number(e.target.value) || 0 })}
                          className="w-full bg-gray-50 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500">FAT (g)</label>
                        <input
                          type="number"
                          value={editFormData.fat}
                          onChange={(e) => setEditFormData({ ...editFormData, fat: Number(e.target.value) || 0 })}
                          className="w-full bg-gray-50 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                        />
                      </div>
                    </div>
                    
                    <div>
                        <label className="text-[10px] uppercase font-bold text-gray-500">Note</label>
                        <textarea
                          value={editFormData.notes || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                          className="w-full bg-gray-50 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-primary text-sm resize-none"
                          rows={2}
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button onClick={saveEditedLog} className="flex-1 bg-brand-primary text-white py-2 rounded-xl text-sm font-semibold">Salva</button>
                      <button onClick={() => setEditingLogId(null)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-xl text-sm font-semibold">Annulla</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-4 pr-12">
                      <h3 className="text-lg font-bold line-clamp-2">{log.description}</h3>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs font-semibold text-gray-600">
                        {log.mealType === 'breakfast' ? 'Colazione' : log.mealType === 'lunch' ? 'Pranzo' : log.mealType === 'dinner' ? 'Cena' : 'Snack'}
                      </span>
                      <span className="text-brand-primary font-bold">{log.calories} kcal</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">PRO</p>
                        <p className="font-semibold text-gray-900 text-sm">{log.protein}g</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">CARB</p>
                        <p className="font-semibold text-gray-900 text-sm">{log.carbs}g</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">FAT</p>
                        <p className="font-semibold text-gray-900 text-sm">{log.fat}g</p>
                      </div>
                    </div>

                    {log.notes && (
                      <p className="text-sm text-gray-500 italic border-t border-gray-100 pt-3 mt-auto">
                        "{log.notes}"
                      </p>
                    )}
                  </>
                )}
              </motion.div>
            ))}
          </div>

          <div className="mt-12 glass-card p-6 md:p-8">
            <h3 className="text-xl font-bold mb-6">Riepilogo Giornaliero</h3>
            
            <div className="grid md:grid-cols-2 gap-8">
                <div>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Calorie (kcal)</h4>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[{ name: 'Calorie', value: todayLogs.reduce((acc, log) => acc + log.calories, 0), fill: '#10b981' }]} margin={{ top: 20, right: 60, left: 0, bottom: 5 }} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 13, fontWeight: 'bold' }} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => [`${value} kcal`, 'Totale']} />
                                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={40}>
                                    <LabelList dataKey="value" position="right" formatter={(val: number) => `${val} kcal`} style={{ fill: '#374151', fontSize: 13, fontWeight: 'bold' }} />
                                    <Cell fill="#10b981" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Macronutrienti (g)</h4>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                                { name: 'Proteine', value: todayLogs.reduce((acc, log) => acc + log.protein, 0), fill: '#3b82f6' },
                                { name: 'Carboidrati', value: todayLogs.reduce((acc, log) => acc + log.carbs, 0), fill: '#f97316' },
                                { name: 'Grassi', value: todayLogs.reduce((acc, log) => acc + log.fat, 0), fill: '#ef4444' }
                            ]} margin={{ top: 20, right: 60, left: 0, bottom: 5 }} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 13, fontWeight: 'bold' }} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => [`${value} g`, 'Totale']} />
                                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                                    <LabelList dataKey="value" position="right" formatter={(val: number) => `${val} g`} style={{ fill: '#374151', fontSize: 13, fontWeight: 'bold' }} />
                                    {
                                        [
                                            { fill: '#3b82f6' },
                                            { fill: '#f97316' },
                                            { fill: '#ef4444' }
                                        ].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))
                                    }
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
