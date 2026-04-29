import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Upload, Loader2, Apple, Check, X } from 'lucide-react';
import { analyzeFoodImage, FoodAnalysis } from '../lib/gemini';
import { db, handleFirestoreError, OperationType, serverTimestamp, collection, addDoc } from '../lib/firebase';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function FoodLog() {
  const { user } = useAuth();
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<FoodAnalysis | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

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
        imageUrl: '', // In actual implementation would upload to storage
        createdAt: serverTimestamp(),
      });
      setResult(null);
      setImagePreview(null);
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
              className="glass-card p-8 flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-xs font-bold uppercase tracking-wider">
                  <Apple size={14} /> Analisi Completata
                </div>
                <button onClick={() => { setResult(null); setImagePreview(null); }} className="text-gray-400 hover:text-red-500">
                  <X size={20} />
                </button>
              </div>

              <h2 className="text-2xl font-bold mb-2">{result.description}</h2>
              <div className="flex gap-4 mb-8">
                <div className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-medium text-gray-600">
                  {result.mealType === 'breakfast' ? 'Colazione' : result.mealType === 'lunch' ? 'Pranzo' : result.mealType === 'dinner' ? 'Cena' : 'Snack'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-emerald-50 rounded-2xl">
                  <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Calorie</p>
                  <p className="text-2xl font-bold text-emerald-900">{result.calories} <span className="text-sm font-normal opacity-60">kcal</span></p>
                </div>
                <div className="p-4 bg-blue-50 rounded-2xl">
                  <p className="text-xs font-bold text-blue-600 uppercase mb-1">Proteine</p>
                  <p className="text-2xl font-bold text-blue-900">{result.protein} <span className="text-sm font-normal opacity-60">g</span></p>
                </div>
                <div className="p-4 bg-orange-50 rounded-2xl">
                  <p className="text-xs font-bold text-orange-600 uppercase mb-1">Carboidrati</p>
                  <p className="text-2xl font-bold text-orange-900">{result.carbs} <span className="text-sm font-normal opacity-60">g</span></p>
                </div>
                <div className="p-4 bg-red-50 rounded-2xl">
                  <p className="text-xs font-bold text-red-600 uppercase mb-1">Grassi</p>
                  <p className="text-2xl font-bold text-red-900">{result.fat} <span className="text-sm font-normal opacity-60">g</span></p>
                </div>
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
    </div>
  );
}
