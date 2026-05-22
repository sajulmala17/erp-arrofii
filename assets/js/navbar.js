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