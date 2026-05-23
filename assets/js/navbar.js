/**
 * navbar.js - Komponen Navbar untuk ERP Al-Arrofi
 *
 * File ini berisi definisi menu navigasi berdasarkan role pengguna
 * dan fungsi untuk merender navbar ke dalam elemen HTML yang ditentukan.
 *
 * Cara penggunaan:
 * 1. Import file ini di halaman HTML Anda
 * 2. Panggil initNavbar(containerElementId) setelah DOM siap
 */

// Definisi menu untuk setiap role
export const NAV_MENUS = {
  admin: [
    { label: 'MENU UTAMA' },
    { icon: 'home',    text: 'Dashboard',      href: 'dashboard.html' },
    { icon: 'users',   text: 'Data Siswa',     href: 'siswa.html' },
    { icon: 'grid',    text: 'Absensi Piket',  href: 'piket.html' },
    { icon: 'book-open', text: 'Absensi Mapel', href: 'absensi-mapel.html' },
    { icon: 'bar-chart', text: 'Rekap Absensi', href: 'rekap-absensi.html' },
    { label: 'AKADEMIK' },
    { icon: 'book',    text: 'Mata Pelajaran', href: 'mapel.html' },
    { icon: 'file-text', text: 'Nilai',        href: 'nilai.html' },
    { label: 'KEUANGAN' },
    { icon: 'credit-card', text: 'Billing',    href: 'billing.html' },
    { icon: 'dollar-sign', text: 'Slip Gaji',  href: 'gaji.html' },
    { icon: 'shopping-cart', text: 'Kantin',   href: 'pos.html' },
    { label: 'ADMINISTRASI' },
    { icon: 'mail',    text: 'Surat',          href: 'surat.html' },
    { icon: 'settings', text: 'Pengguna',      href: 'pengguna.html' },
  ],
  kepsek: [
    { label: 'MENU UTAMA' },
    { icon: 'home',    text: 'Dashboard',      href: 'dashboard.html' },
    { icon: 'users',   text: 'Data Siswa',     href: 'siswa.html' },
    { icon: 'grid',    text: 'Absensi Piket',  href: 'piket.html' },
    { icon: 'book-open', text: 'Absensi Mapel', href: 'absensi-mapel.html' },
    { icon: 'bar-chart', text: 'Rekap Absensi', href: 'rekap-absensi.html' },
    { label: 'AKADEMIK' },
    { icon: 'book',    text: 'Mata Pelajaran', href: 'mapel.html' },
    { icon: 'file-text', text: 'Nilai',        href: 'nilai.html' },
    { label: 'KEUANGAN' },
    { icon: 'credit-card', text: 'Billing',    href: 'billing.html' },
    { icon: 'dollar-sign', text: 'Slip Gaji',  href: 'gaji.html' },
    { icon: 'shopping-cart', text: 'Kantin',   href: 'pos.html' },
    { label: 'ADMINISTRASI' },
    { icon: 'mail',    text: 'Surat',          href: 'surat.html' },
  ],
  guru: [
    { label: 'MENU UTAMA' },
    { icon: 'home',      text: 'Dashboard',     href: 'dashboard.html' },
    { icon: 'users',     text: 'Data Siswa',    href: 'siswa.html' },
    { icon: 'grid',      text: 'Absensi Piket', href: 'piket.html' },
    { icon: 'book-open', text: 'Absensi Mapel', href: 'absensi-mapel.html' },
    { icon: 'bar-chart', text: 'Rekap Absensi', href: 'rekap-absensi.html' },
    { label: 'AKADEMIK' },
    { icon: 'book',      text: 'Mata Pelajaran', href: 'mapel.html' },
    { icon: 'file-text', text: 'Input Nilai',   href: 'nilai.html' },
    { label: 'KEUANGAN' },
    { icon: 'dollar-sign', text: 'Slip Gaji',   href: 'gaji.html' },
  ],
  tu: [
    { label: 'MENU UTAMA' },
    { icon: 'home',      text: 'Dashboard',     href: 'dashboard.html' },
    { icon: 'users',     text: 'Data Siswa',    href: 'siswa.html' },
    { icon: 'grid',      text: 'Absensi Piket', href: 'piket.html' },
    { icon: 'book-open', text: 'Absensi Mapel', href: 'absensi-mapel.html' },
    { icon: 'bar-chart', text: 'Rekap Absensi', href: 'rekap-absensi.html' },
    { label: 'AKADEMIK' },
    { icon: 'book',      text: 'Mata Pelajaran', href: 'mapel.html' },
    { label: 'KEUANGAN' },
    { icon: 'credit-card', text: 'Billing',     href: 'billing.html' },
    { label: 'ADMINISTRASI' },
    { icon: 'mail',      text: 'Surat',         href: 'surat.html' },
  ],
  kantin: [
    { label: 'MENU UTAMA' },
    { icon: 'home',          text: 'Dashboard',  href: 'dashboard.html' },
    { icon: 'shopping-cart', text: 'Transaksi',  href: 'pos.html' },
  ],
  ortu: [
    { label: 'MENU UTAMA' },
    { icon: 'home',        text: 'Dashboard',    href: 'dashboard.html' },
    { icon: 'file-text',   text: 'Nilai Anak',   href: 'nilai.html' },
    { icon: 'credit-card', text: 'Tagihan',      href: 'billing.html' },
  ],
};

// Mapping ikon SVG
const ICONS = {
  'home': '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  'users': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'grid': '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  'credit-card': '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  'dollar-sign': '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  'shopping-cart': '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  'mail': '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  'settings': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  // Alias untuk kompatibilitas dengan siswa.html
  'file': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  'card': '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  'dollar': '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  'cart': '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  'bar-chart': '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  'book': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',

  // Action icons
  'edit': '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  'delete': '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  'pin': '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  'toggle-off': '<rect x="1" y="5" width="22" height="14" rx="7" ry="7"/><circle cx="8" cy="12" r="3"/>',
  'toggle-on':  '<rect x="1" y="5" width="22" height="14" rx="7" ry="7"/><circle cx="16" cy="12" r="3"/>',
  'user-check': '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>',
  'user-x':     '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/>',
  'check':      '<polyline points="20 6 9 17 4 12"/>',
  'x':          '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  'save':       '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  'clock':      '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  'user':       '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  'clipboard':  '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',
  'thermometer':'<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>',
  'alert-circle':'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  'log-in':     '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>',
};

/**
 * Mendapatkan SVG path untuk ikon tertentu
 * @param {string} name - Nama ikon
 * @returns {string} - SVG path data
 */
export function getIcon(name) {
  return ICONS[name] || '';
}

/**
 * Merender navbar berdasarkan role pengguna
 * @param {string} role - Role pengguna (admin, kepsek, guru, tu, kantin, ortu)
 * @param {string} containerId - ID elemen container navbar (default: 'sidebarNav')
 * @param {string} currentPage - URL halaman saat ini untuk menandai menu aktif (opsional)
 */
export function renderNav(role, containerId = 'sidebarNav', currentPage = null) {
  const menus = NAV_MENUS[role] || [];
  const nav = document.getElementById(containerId);

  if (!nav) {
    console.warn(`Container navbar dengan ID '${containerId}' tidak ditemukan`);
    return;
  }

  // Jika currentPage tidak diberikan, coba dapatkan dari URL saat ini
  if (!currentPage) {
    const path = window.location.pathname;
    currentPage = path.substring(path.lastIndexOf('/') + 1) || 'dashboard.html';
  }

  nav.innerHTML = menus.map(item => {
    // Jika item adalah label section (tidak ada icon)
    if (!item.icon) {
      return `<div class="nav-label">${item.label}</div>`;
    }

    // Cek apakah ini halaman aktif
    const isActive = item.href === currentPage || (item.active ?? false);

    return `
      <a href="${item.href}" class="nav-item ${isActive ? 'active' : ''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${getIcon(item.icon)}
        </svg>
        ${item.text}
      </a>
    `;
  }).join('');
}

/**
 * Inisialisasi navbar dengan session pengguna saat ini
 * @param {string} containerId - ID elemen container navbar (default: 'sidebarNav')
 * @param {string} currentPage - URL halaman saat ini untuk menandai menu aktif (opsional)
 */
export function initNavbar(containerId = 'sidebarNav', currentPage = null) {
  // Import getSession secara dinamis untuk menghindari circular dependency
  import('./auth-guard.js').then(({ getSession }) => {
    const { role } = getSession();
    if (role) {
      renderNav(role, containerId, currentPage);
    }
  }).catch(err => {
    console.error('Gagal memuat auth-guard.js:', err);
  });
}

/**
 * Helper untuk mendapatkan avatar initial dari nama pengguna
 * @param {string} name - Nama pengguna
 * @returns {string} - Initial huruf pertama
 */
export function getAvatarInitial(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

/**
 * Setup user info di sidebar dan topbar
 * @param {Object} user - Object user dengan properti name dan role
 */
export function setupUserInfo(user) {
  const { name, role } = user || {};
  const initial = getAvatarInitial(name);

  // Set avatar
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  const topbarAvatar = document.getElementById('topbarAvatar');

  if (sidebarAvatar) sidebarAvatar.textContent = initial;
  if (topbarAvatar) topbarAvatar.textContent = initial;

  // Set user info
  const displayName = document.getElementById('user-display-name');
  const displayRole = document.getElementById('user-display-role');

  if (displayName) displayName.textContent = name || 'Memuat...';
  if (displayRole) displayRole.textContent = role || '—';
}

/**
 * Inisialisasi lengkap navbar dan user info
 * @param {string} containerId - ID elemen container navbar (default: 'sidebarNav')
 * @param {string} currentPage - URL halaman saat ini (opsional)
 */
export function initComplete(containerId = 'sidebarNav', currentPage = null) {
  import('./auth-guard.js').then(({ getSession }) => {
    const user = getSession();
    setupUserInfo(user);
    if (user.role) {
      renderNav(user.role, containerId, currentPage);
    }
  }).catch(err => {
    console.error('Gagal memuat auth-guard.js:', err);
  });
}