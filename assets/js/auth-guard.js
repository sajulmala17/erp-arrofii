// ============================================================
// auth-guard.js
// Guard autentikasi — import di setiap halaman yang butuh login
//
// Perubahan security:
//   ✅ Token TIDAK disimpan di sessionStorage
//   ✅ Selalu ambil token fresh via getToken() dari firebase-config
//   ✅ sessionStorage hanya menyimpan data UI (uid, role, name, email)
//
// Cara pakai di halaman lain:
//   import { guardPage, logout, getSession }
//     from '../assets/js/auth-guard.js';
//
//   guardPage(['admin', 'kepsek']); // roles yang diizinkan
// ============================================================

import { auth, ROLE_REDIRECT }  from './firebase-config.js';
import { onAuthStateChanged,
         signOut }               from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// ============================================================
// guardPage(allowedRoles)
// Panggil di awal setiap halaman yang butuh autentikasi.
//
// allowedRoles: array role yang diizinkan, misal ['admin','kepsek']
//               isi [] atau kosong = semua role yang valid boleh masuk
// ============================================================
function guardPage(allowedRoles = []) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // Belum login → ke halaman login
      window.location.href = '/login.html';
      return;
    }

    try {
      // Selalu refresh token untuk pastikan claims terbaru
      // forceRefresh = true agar claims yang baru di-assign langsung berlaku
      const tokenResult = await user.getIdTokenResult(true);
      const role        = tokenResult.claims.role;

      if (!role) {
        // Punya akun Auth tapi belum di-assign role → logout paksa
        await signOut(auth);
        window.location.href = '/login.html';
        return;
      }

      // Cek apakah role diizinkan di halaman ini
      if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        // Role tidak punya akses → redirect ke dashboard yang sesuai
        const target = ROLE_REDIRECT[role] || '/login.html';
        window.location.href = target;
        return;
      }

      // ✅ Simpan hanya data UI ke sessionStorage
      // ❌ Token TIDAK disimpan — selalu ambil fresh via getToken()
      sessionStorage.setItem('uid',   user.uid);
      sessionStorage.setItem('role',  role);
      sessionStorage.setItem('name',  user.displayName || user.email);
      sessionStorage.setItem('email', user.email);

    } catch (err) {
      console.error('[auth-guard] Token error:', err);
      await signOut(auth);
      sessionStorage.clear();
      window.location.href = '/login.html';
    }
  });
}

// ============================================================
// logout()
// Panggil dari tombol logout di halaman manapun
//
// Cara pakai:
//   import { logout } from '../assets/js/auth-guard.js';
//   document.getElementById('btnLogout').addEventListener('click', logout);
// ============================================================
async function logout() {
  try {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = './login.html';
  } catch (err) {
    console.error('[auth-guard] Logout error:', err);
    // Tetap clear storage dan redirect meski signOut gagal
    sessionStorage.clear();
    window.location.href = './login.html';
  }
}

// ============================================================
// getSession()
// Ambil data UI user dari sessionStorage (sinkron, tanpa async).
// Hanya untuk keperluan tampilan — BUKAN penentu akses data.
// Akses data tetap dikontrol oleh Firestore Rules & Cloud Functions.
//
// Cara pakai:
//   import { getSession } from '../assets/js/auth-guard.js';
//   const { name, role } = getSession();
//   document.getElementById('userName').textContent = name;
// ============================================================
function getSession() {
  return {
    uid  : sessionStorage.getItem('uid')   || '',
    role : sessionStorage.getItem('role')  || '',
    name : sessionStorage.getItem('name')  || '',
    email: sessionStorage.getItem('email') || '',
  };
}

export { guardPage, logout, getSession };
