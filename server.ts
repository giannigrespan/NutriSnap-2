import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config();

// Note: For simplicity in this demo environment, we are assuming environment has what it needs.
// In a real app, you'd use a service account key.
// Here we can use the default app initialization if we have the environment variables.
// However, since we are in AI Studio, we can likely use the firebase-admin with standard credentials 
// or just use the 'firebase' client SDK which we already have.
// Let's use standard 'firebase' client on server for consistency with the rest of the app.

import { initializeApp as initializeClientApp } from 'firebase/app';
import { getFirestore as getClientFirestore, doc, updateDoc, getDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const clientApp = initializeClientApp(firebaseConfig);
const db = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- WAHOO OAUTH ROUTES ---

  app.get('/api/auth/wahoo/url', (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const params = new URLSearchParams({
      client_id: process.env.WAHOO_CLIENT_ID!,
      redirect_uri: process.env.WAHOO_REDIRECT_URI || `${process.env.APP_URL}/auth/wahoo/callback`,
      response_type: 'code',
      scope: 'workouts_read v1_read',
      state: userId // Pass userId to identify them in callback
    });

    res.json({ url: `https://api.wahooligan.com/oauth/authorize?${params.toString()}` });
  });

  app.get('/auth/wahoo/callback', async (req, res) => {
    const { code, state: userId } = req.query;

    if (!code || !userId) {
      return res.status(400).send('Missing code or state');
    }

    try {
      // Exchange code for tokens
      const response = await axios.post('https://api.wahooligan.com/oauth/token', {
        client_id: process.env.WAHOO_CLIENT_ID,
        client_secret: process.env.WAHOO_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.WAHOO_REDIRECT_URI || `${process.env.APP_URL}/auth/wahoo/callback`,
      });

      const { access_token, refresh_token, expires_in } = response.data;

      // Save tokens to Firestore
      const userRef = doc(db, 'users', userId as string);
      await updateDoc(userRef, {
        wahooAccessToken: access_token,
        wahooRefreshToken: refresh_token,
        wahooTokenExpiresAt: Date.now() + expires_in * 1000,
        updatedAt: new Date().toISOString()
      });

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'WAHOO_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/profile';
              }
            </script>
            <p>Sincronizzazione Wahoo riuscita! Puoi chiudere questa finestra.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('Wahoo Callback Error:', error.response?.data || error.message);
      res.status(500).send('Errore durante l\'autorizzazione con Wahoo.');
    }
  });

  // --- SYNC WORKOUTS ROUTE ---
  app.post('/api/wahoo/sync', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    try {
      const userSnap = await getDoc(doc(db, 'users', userId));
      if (!userSnap.exists()) return res.status(404).json({ error: 'User not found' });

      const userData = userSnap.data();
      const token = userData.wahooAccessToken;

      if (!token) return res.status(400).json({ error: 'Wahoo not connected' });

      // Fetch workouts from Wahoo
      const workoutsRes = await axios.get('https://api.wahooligan.com/v1/workouts', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const workouts = workoutsRes.data.workouts; // Adjust based on actual API structure
      let syncedCount = 0;

      for (const workout of workouts) {
        // Simple check to avoid duplicates: check if workout exists by some Wahoo ID or timestamp
        // For this demo, we'll just check if there's an exercise log with same start time
        const startTime = workout.starts;
        const q = query(collection(db, 'exerciseLogs'), 
          where('userId', '==', userId), 
          where('date', '==', startTime)
        );
        const existing = await getDocs(q);

        if (existing.empty) {
          await addDoc(collection(db, 'exerciseLogs'), {
            userId,
            date: startTime,
            activityType: `Wahoo: ${workout.name || 'Ciclismo'}`,
            durationMinutes: Math.round(workout.duration_seconds / 60),
            caloriesBurned: Math.round(workout.calories || 0),
            createdAt: new Date().toISOString()
          });
          syncedCount++;
        }
      }

      res.json({ success: true, syncedCount });
    } catch (error: any) {
      console.error('Wahoo Sync Error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Errore durante la sincronizzazione.' });
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
