import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { calculateBMR, calculateTDEE, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { User, Ruler, Weight, Target, Activity, Dumbbell, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    age: profile?.age || 25,
    height: profile?.height || 175,
    weight: profile?.weight || 70,
    gender: profile?.gender || 'male',
    activityLevel: profile?.activityLevel || 'moderate',
    goal: profile?.goal || 'maintain',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const bmr = calculateBMR(formData.weight, formData.height, formData.age, formData.gender);
      const tdee = calculateTDEE(bmr, formData.activityLevel);
      
      let dailyCalorieTarget = tdee;
      if (formData.goal === 'lose_weight') dailyCalorieTarget -= 500;
      if (formData.goal === 'gain_muscle') dailyCalorieTarget += 300;

      const profileData: any = {
        ...formData,
        userId: user.uid,
        dailyCalorieTarget: Math.round(dailyCalorieTarget),
        updatedAt: serverTimestamp(),
      };

      if (!profile) {
        profileData.createdAt = serverTimestamp();
      } else {
        // If profile exists, we must keep existing createdAt or rules might fail if they check equality
        // But our rules currently check 'incoming().createdAt == request.time' on create
        // and don't check it on update unless we add it.
        profileData.createdAt = profile.createdAt;
      }

      await setDoc(doc(db, 'users', user.uid), profileData);
      await refreshProfile();
      navigate('/');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-10"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary">
            <User size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Profilo Personale</h2>
            <p className="text-gray-500">I tuoi dati fisici per calcolare il piano</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <User size={16} /> Nome completo
              </label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field"
                placeholder="Es. Gianni"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                Età
              </label>
              <input
                required
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Ruler size={16} /> Altezza (cm)
              </label>
              <input
                required
                type="number"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: Number(e.target.value) })}
                className="input-field"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Weight size={16} /> Peso attuale (kg)
              </label>
              <input
                required
                type="number"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                className="input-field"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Genere</label>
            <div className="flex gap-4">
              {['male', 'female', 'other'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: g as any })}
                  className={cn(
                    "flex-1 py-3 rounded-xl border font-medium transition-all",
                    formData.gender === g ? "bg-brand-primary border-brand-primary text-white" : "border-gray-200 bg-white"
                  )}
                >
                  {g === 'male' ? 'Uomo' : g === 'female' ? 'Donna' : 'Altro'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-2">
              <Activity size={16} /> Livello di attività
            </label>
            <select
              value={formData.activityLevel}
              onChange={(e) => setFormData({ ...formData, activityLevel: e.target.value as any })}
              className="input-field appearance-none"
            >
              <option value="sedentary">Sedentario (ufficio)</option>
              <option value="light">Attività leggera (1-2 volte/sett)</option>
              <option value="moderate">Moderata (3-4 volte/sett)</option>
              <option value="active">Attivo (5-6 volte/sett)</option>
              <option value="very_active">Molto attivo (lavoro pesanti/atleta)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-2">
              <Activity size={16} /> Connessioni Esterne
            </label>
            <div className="p-4 rounded-xl border border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
                  <Dumbbell size={18} className="text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-bold">Wahoo Cloud</p>
                  <p className="text-xs text-gray-500">{profile?.wahooAccessToken ? 'Collegato' : 'Non collegato'}</p>
                </div>
              </div>
              {!profile?.wahooAccessToken ? (
                <button 
                  type="button"
                  onClick={async () => {
                    const res = await fetch(`/api/auth/wahoo/url?userId=${user?.uid}`);
                    const { url } = await res.json();
                    window.open(url, 'wahoo_oauth', 'width=600,height=700');
                  }}
                  className="text-xs font-bold text-brand-primary hover:underline"
                >
                  Connetti
                </button>
              ) : (
                <div className="text-emerald-500">
                  <Check size={18} />
                </div>
              )}
            </div>
          </div>

          <button
            disabled={loading}
            type="submit"
            className="btn-primary w-full mt-6"
          >
            {loading ? 'Salvataggio...' : 'Salva e Inizia'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
