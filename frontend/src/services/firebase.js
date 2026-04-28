// src/services/firebase.js
// ⚠️  Bu dosyadaki değerleri kendi Firebase projenizden kopyalayın:
//     Firebase Console → Proje Ayarları → Uygulamalarınız → firebaseConfig

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
};

const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// ─── Auth ───────────────────────────────────────────────────────────────────

export const login  = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);
export const onAuth = (cb) => onAuthStateChanged(auth, cb);

// ─── Spare Parts (koleksiyon: "parts") ──────────────────────────────────────

const PARTS = 'parts';

export const getParts = async () => {
  const snap = await getDocs(query(collection(db, PARTS), orderBy('code')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/** Gerçek zamanlı dinleyici — UI otomatik güncellenir */
export const subscribeParts = (cb) =>
  onSnapshot(query(collection(db, PARTS), orderBy('code')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );

export const addPart    = (data) => addDoc(collection(db, PARTS), data);
export const updatePart = (id, data) => updateDoc(doc(db, PARTS, id), data);
export const deletePart = (id) => deleteDoc(doc(db, PARTS, id));

// ─── Simulation Results (koleksiyon: "results") ──────────────────────────────

const RESULTS = 'results';

export const subscribeResults = (cb) =>
  onSnapshot(query(collection(db, RESULTS), orderBy('createdAt', 'desc')), snap =>
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
