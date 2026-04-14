// ============================================================
// login.js
// Logika halaman login
// ============================================================

import { auth, ROLE_REDIRECT }           from './firebase-config.js';
import { signInWithEmailAndPassword,
         signOut,
         onAuthStateChanged }            from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// ============================================================
// CEK JIKA SUDAH LOGIN — LANGSUNG REDIRECT
// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const tokenResult = await user.getIdTokenResult();
      const role        = tokenResult.claims.role;

      if (role) {
        sessionStorage.setItem('uid',   user.uid);
        sessionStorage.setItem('role',  role);
        sessionStorage.setItem('name',  user.displayName || user.email);
        sessionStorage.setItem('email', user.email);

        const target = ROLE_REDIRECT[role] || '/pages/dashboard.html';
        window.location.href = target;
      }
    } catch (err) {
      await signOut(auth);
    }
  }
});

// ============================================================
// TOGGLE SHOW / HIDE PASSWORD
// ============================================================
const togglePw = document.getElementById('togglePw');
const pwInput  = document.getElementById('password');
const eyeIcon  = document.getElementById('eyeIcon');

const eyeOpen = `
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
  <circle cx="12" cy="12" r="3"/>`;

const eyeClose = `
  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
  <line x1="1" y1="1" x2="23" y2="23"/>`;

togglePw.addEventListener('click', () => {
  const isHidden    = pwInput.type === 'password';
  pwInput.type      = isHidden ? 'text' : 'password';
  eyeIcon.innerHTML = isHidden ? eyeClose : eyeOpen;
});

// ============================================================
// HELPER: Tampilkan / Sembunyikan Error
// ============================================================
function showError(msg) {
  const box = document.getElementById('errorBox');
  const el  = document.getElementById('errorMsg');
  el.textContent = msg;
  box.classList.add('show');
}

function hideError() {
  document.getElementById('errorBox').classList.remove('show');
}

// ============================================================
// HELPER: Loading State Tombol
// ============================================================
function setLoading(isLoading) {
  const btn    = document.getElementById('btnLogin');
  btn.disabled = isLoading;
  btn.classList.toggle('loading', isLoading);
}

// ============================================================
// HELPER: Pesan Error User-Friendly
// ============================================================
function getFriendlyError(code) {
  const map = {
    'auth/user-not-found'        : 'Email tidak terdaftar dalam sistem.',
    'auth/wrong-password'        : 'Password yang Anda masukkan salah.',
    'auth/invalid-email'         : 'Format email tidak valid.',
    'auth/user-disabled'         : 'Akun Anda telah dinonaktifkan. Hubungi admin.',
    'auth/too-many-requests'     : 'Terlalu banyak percobaan login. Coba lagi nanti.',
    'auth/network-request-failed': 'Gagal terhubung ke server. Periksa koneksi internet.',
    'auth/invalid-credential'    : 'Email atau password salah.',
  };
  return map[code] || 'Terjadi kesalahan. Silakan coba lagi.';
}

// ============================================================
// SUBMIT FORM LOGIN
// ============================================================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showError('Email dan password wajib diisi.');
    return;
  }

  setLoading(true);

  try {
    // 1. Login Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user           = userCredential.user;

    // 2. Ambil custom claims
    const tokenResult = await user.getIdTokenResult(false);
    const role        = tokenResult.claims.role;

    if (!role) {
      await signOut(auth);
      showError('Akun Anda belum dikonfigurasi. Hubungi administrator.');
      setLoading(false);
      return;
    }

    // 3. Simpan data UI ke sessionStorage
    // Token TIDAK disimpan — gunakan getToken() saat butuh token
    sessionStorage.setItem('uid',   user.uid);
    sessionStorage.setItem('role',  role);
    sessionStorage.setItem('name',  user.displayName || user.email);
    sessionStorage.setItem('email', user.email);

    // 4. Redirect sesuai role
    const target = ROLE_REDIRECT[role] || '/pages/dashboard.html';
    window.location.href = target;

  } catch (err) {
    console.error('[Login Error]', err.code, err.message);
    showError(getFriendlyError(err.code));
    setLoading(false);
  }
});

// Hapus error saat user mulai mengetik
['email', 'password'].forEach(id => {
  document.getElementById(id).addEventListener('input', hideError);
});
