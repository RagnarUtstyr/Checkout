import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCNmMDNgT91vrj_BsivKvLewCq2SHXHb2o',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'checkout-52442.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'checkout-52442',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'checkout-52442.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '500953675538',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:500953675538:web:92179889a6dfea7342a5cb',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
