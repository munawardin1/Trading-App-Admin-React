// Public client settings. The Firebase web config is not a secret: it only identifies the
// project, and access is controlled by Firebase Auth and the server's token checks.
// Any value can be overridden with a VITE_* variable at build time (see .env.example).
export const API_URL: string = (import.meta.env.VITE_API_URL || 'https://trading-app-server-production-37ee.up.railway.app').replace(/\/+$/, '');

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAP8tu34IMomSIpM8YDAeuJ6F6f526sXbY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'greyzeevtrading.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'greyzeevtrading',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'greyzeevtrading.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '436042079569',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:436042079569:web:e921147b32940b69784770',
};
