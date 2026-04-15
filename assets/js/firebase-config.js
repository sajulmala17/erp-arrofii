// ============================================================
// firebase-config.js
// Konfigurasi Firebase — dipakai di semua halaman
// Ganti nilai di bawah dengan config project Anda
// Firebase Console → Project Settings → Your apps → Web app
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// ============================================================
// KONFIGURASI FIREBASE — GANTI DENGAN CONFIG MILIK ANDA
// ✅ AMAN untuk di-expose di frontend (bukan private key)
// Yang melindungi data adalah Firestore Rules + Firebase Auth
// ============================================================
const firebaseConfig = {
  apiKey           : "AIzaSyA5erov7rcgaF_BbKtr4kgwq5r36FJ7kZM",
  authDomain       : "er-arrofii.firebaseapp.com",
  projectId        : "er-arrofii",
  storageBucket    : "er-arrofii.appspot.com",
  messagingSenderId: "821555662001",
  appId            : "1:821555662001:web:df8afa1d574405c4eda690",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ============================================================
// PETA REDIRECT BERDASARKAN ROLE
// Sesuaikan path jika struktur folder berbeda
// ============================================================
const ROLE_REDIRECT = {
  admin  : '/pages/dashboard.html',
  kepsek : '/pages/dashboard.html',
  guru   : '/dashboard.html',
  tu     : '/dashboard.html',
  kantin : '/dashboard.html',
  ortu   : '/dashboard.html',
};

// ============================================================
// getToken()
// Selalu ambil token fresh dari Firebase Auth.
// Token otomatis di-refresh jika sudah expired (>1 jam).
//
// ✅ GUNAKAN ini setiap kali butuh token untuk Cloud Functions
// ❌ JANGAN simpan token di sessionStorage / localStorage
//
// Cara pakai di halaman lain:
//   import { getToken } from '../assets/js/firebase-config.js';
//   const token = await getToken();
//   fetch(URL, { headers: { Authorization: `Bearer ${token}` } })
// ============================================================
async function getToken() {
  const user = auth.currentUser;
  if (!user) return null;
  // Firebase otomatis refresh token jika hampir/sudah expired
  return await user.getIdToken(false);
}

export { app, auth, ROLE_REDIRECT, getToken };
