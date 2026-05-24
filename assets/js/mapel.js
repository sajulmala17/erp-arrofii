// =============================================================
//  mapel.js — Modul Mata Pelajaran
//  Tab 1: Master Mapel (subjects)
//  Tab 2: Penugasan Guru (teacher_subjects) + Approval workflow
// =============================================================

import { auth }                    from './firebase-config.js';
import { guardPage, getSession }   from './auth-guard.js';
import { getIcon }                 from './navbar.js';
import { onAuthStateChanged }      from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore,
         collection,
         doc,
         getDocs,
         getDoc,
         addDoc,
         updateDoc,
         deleteDoc,
         query,
         where,
         orderBy,
         runTransaction,
         serverTimestamp }         from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const db = getFirestore();
guardPage(['admin', 'kepsek', 'guru', 'tu']);

// =============================================================
//  STATE
// =============================================================
let currentRole = '';
let currentUid  = '';
let allSubjects  = [];
let allClasses   = [];
let allTeachers  = [];
let allPenugasan = [];
let allTahunAjaran = [];

let editMapelId     = null;
let editPenugasanId = null;
let tolakTargetId   = null;

// Pagination
const PAGE_SIZE = 10;
let pageMapel     = 1;
let pagePenugasan = 1;

// =============================================================
//  AUTH INIT
// =============================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const { role, name, uid } = getSession();
  currentRole = role;
  currentUid  = uid;

  // Update nama & role di layout
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-display-role');
  if (nameEl) nameEl.textContent = name;
  if (roleEl) roleEl.textContent = labelRole(role);

  // Avatar inisial
  const initials = name
  ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  : '?';
  ['sidebarAvatar', 'topbarAvatar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = initials;
  });

  applyRoleUI();
  await loadAllData();
  bindEvents();
});

// =============================================================
//  ROLE UI
// =============================================================
function applyRoleUI() {
  const isAdmin  = currentRole === 'admin';
  const isTU     = currentRole === 'tu';
  const isKepsek = currentRole === 'kepsek';
  const isGuru   = currentRole === 'guru';

  // Tab Master — tombol tambah hanya admin; kolom Aksi untuk admin & guru
  document.getElementById('btnTambahMapel').style.display = isAdmin ? 'flex' : 'none';
  document.getElementById('thAksiMapel').style.display    = (isAdmin || isGuru) ? '' : 'none';

  // FAB mobile — Tambah Mapel (hanya admin, hanya tampil di tab master)
  const fabMapel = document.getElementById('fabTambahMapel');
  if (fabMapel) fabMapel.style.display = isAdmin ? 'flex' : 'none';

  // Tab Penugasan — toolbar kanan hanya admin & TU
  document.getElementById('toolbarPenugasanRight').style.display = (isAdmin || isTU) ? '' : 'none';

  // FAB mobile — Tugaskan Guru (hanya admin & TU, tersembunyi sampai tab penugasan aktif)
  const fabPenugasan = document.getElementById('fabTambahPenugasan');
  if (fabPenugasan) fabPenugasan.style.display = 'none'; // ditampilkan saat switchTab('penugasan')

  // Pending banner — hanya kepsek
  if (isKepsek) document.getElementById('pendingBanner').style.display = '';

  // Guru-specific UI
  if (isGuru) {
    // Sembunyikan toolbar kanan (tombol tambah & salin)
    document.getElementById('toolbarPenugasanRight').style.display = 'none';

    // Ubah judul tab penugasan jadi "Penugasan Saya"
    const tabPenugasan = document.querySelector('[data-tab="penugasan"]');
    if (tabPenugasan) {
      const span = tabPenugasan.querySelector('span');
      if (span) span.textContent = 'Penugasan Saya';
    }
  }
}

// =============================================================
//  LOAD DATA
// =============================================================
async function loadAllData() {
  showPenugasanLoading();
  showMapelLoading();
  await Promise.all([loadSubjects(), loadClasses(), loadTeachers()]);
  await loadPenugasan();
}

async function loadSubjects() {
  try {
    const snap = await getDocs(query(collection(db, 'subjects'), orderBy('name')));
    allSubjects = snap.docs.map(d => ({ subject_id: d.id, ...d.data() }));
  } catch (err) {
    console.error('[loadSubjects]', err);
  }
  renderTabelMapel();
  populateSubjectSelect();
}

async function loadClasses() {
  try {
    const snap = await getDocs(query(collection(db, 'classes'), orderBy('name')));
    allClasses = snap.docs.map(d => ({ class_id: d.id, ...d.data() }));
  } catch (err) {
    console.error('[loadClasses]', err);
  }
  populateClassSelect();
}

async function loadTeachers() {
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'guru'), orderBy('name')));
    allTeachers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch (err) {
    console.error('[loadTeachers]', err);
  }
  populateTeacherSelect();
}

async function loadPenugasan() {
  try {
    let q;
    if (currentRole === 'guru') {
      q = query(collection(db, 'teacher_subjects'),
                where('teacher_uid', '==', currentUid),
                orderBy('created_at', 'desc'));
    } else {
      q = query(collection(db, 'teacher_subjects'), orderBy('created_at', 'desc'));
    }
    const snap = await getDocs(q);
    allPenugasan = snap.docs.map(d => ({ doc_id: d.id, ...d.data() }));
  } catch (err) {
    console.error('[loadPenugasan]', err);
  }

  // Pending banner untuk kepsek
  if (currentRole === 'kepsek') {
    const pending = allPenugasan.filter(p => p.status === 'menunggu_approval');
    const banner  = document.getElementById('pendingBanner');
    const bannerText = document.getElementById('pendingBannerText');
    banner.style.display = pending.length > 0 ? '' : 'none';
    bannerText.textContent = `Ada ${pending.length} penugasan menunggu persetujuan Anda.`;
  }

  collectTahunAjaran();
  populateTahunAjaranFilter();
  renderTabelPenugasan();
}

// =============================================================
//  LOADING STATES
// =============================================================
function showMapelLoading() {
  document.getElementById('tbodyMapel').innerHTML =
    `<tr><td colspan="4" class="empty-cell">
      <div class="loading-dots"><span></span><span></span><span></span></div>
    </td></tr>`;
  document.getElementById('cardListMapel').innerHTML =
    `<div style="text-align:center;padding:32px;color:var(--text-soft)">Memuat data...</div>`;
}

function showPenugasanLoading() {
  document.getElementById('tbodyPenugasan').innerHTML =
    `<tr><td colspan="7" class="empty-cell">
      <div class="loading-dots"><span></span><span></span><span></span></div>
    </td></tr>`;
  document.getElementById('cardListPenugasan').innerHTML =
    `<div style="text-align:center;padding:32px;color:var(--text-soft)">Memuat data...</div>`;
}

// =============================================================
//  HELPERS
// =============================================================
function namaGuru(uid)     { return allTeachers.find(t => t.uid === uid)?.name ?? uid; }
function namaMapel(sid)    { return allSubjects.find(s => s.subject_id === sid)?.name ?? sid; }
function namaKelas(cid)    { return allClasses.find(c => c.class_id === cid)?.name ?? cid; }
function jenjangMapel(sid) { return allSubjects.find(s => s.subject_id === sid)?.jenjang ?? ''; }
function escHtml(str)      { return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function svgIcon(name)     { return `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${getIcon(name)}</svg>`; }

// =============================================================
//  AUTO-INCREMENT id_mapel  (format MPL001, MPL002, …)
//  Menggunakan Firestore transaction pada doc counters/subjects
// =============================================================
async function nextIdMapel() {
  const counterRef = doc(db, 'counters', 'subjects');
  let newNum;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    newNum = snap.exists() ? (snap.data().last_num || 0) + 1 : 1;
    tx.set(counterRef, { last_num: newNum }, { merge: true });
  });
  return 'MPL' + String(newNum).padStart(3, '0');
}

// =============================================================
//  RENDER TABEL MASTER MAPEL (desktop)
//  Baris dengan nama mapel yang sama digabung:
//    Jenjang → "SMP / SMA"   KKM → "75 / 81"
// =============================================================
function buildGroupedMapel(subjects) {
  // Kelompokkan berdasarkan nama (case-insensitive)
  const map = new Map();
  for (const s of subjects) {
    const key = s.name.trim().toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }
  // Kembalikan array grup; tiap grup diurutkan SMP dulu
  const order = ['SMP', 'SMA'];
  return [...map.values()].map(grp => {
    grp.sort((a, b) => order.indexOf(a.jenjang) - order.indexOf(b.jenjang));
    return grp;
  });
}

function renderTabelMapel() {
  const search  = document.getElementById('searchMapel').value.toLowerCase();
  const jenjang = document.getElementById('filterJenjangMapel').value;
  const isAdmin = currentRole === 'admin';
  const isGuru  = currentRole === 'guru';

  const filtered = allSubjects.filter(s =>
    s.name.toLowerCase().includes(search) &&
    (jenjang === '' || s.jenjang === jenjang)
  );

  // Grup berdasarkan nama
  const groups = buildGroupedMapel(filtered);

  // Pagination berdasarkan jumlah grup
  const totalPageMapel = Math.ceil(groups.length / PAGE_SIZE);
  if (pageMapel > totalPageMapel) pageMapel = 1;
  const start = (pageMapel - 1) * PAGE_SIZE;
  const groupsHalIni = groups.slice(start, start + PAGE_SIZE);

  const colspan = isAdmin ? 4 : 3;
  const tbody   = document.getElementById('tbodyMapel');

  if (groups.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-cell">Tidak ada data.</td></tr>`;
    document.getElementById('cardListMapel').innerHTML =
      `<div style="text-align:center;padding:32px;color:var(--text-soft)">Tidak ada data.</div>`;
    document.getElementById('paginasiMapel').innerHTML = '';
    return;
  }

  tbody.innerHTML = groupsHalIni.map(grp => {
    const firstName = grp[0].name;
    const jenjangVal = grp.map(s => escHtml(s.jenjang)).join(' / ');
    const kkmVal     = grp.map(s => s.kkm).join(' / ');

    // Aksi: admin edit/hapus tiap entri; guru edit KKM jika ditugaskan
    let aksiHtml = '';
    if (isAdmin) {
      aksiHtml = grp.map(s => `
        <button class="btn-aksi edit"  title="Edit ${s.jenjang}"  onclick="openEditMapel('${s.subject_id}')">${svgIcon('edit')} ${escHtml(s.jenjang)}</button>
        <button class="btn-aksi hapus" title="Hapus ${s.jenjang}" onclick="hapusMapel('${s.subject_id}')">${svgIcon('delete')}</button>
      `).join('');
    } else if (isGuru) {
      aksiHtml = grp.map(s => {
        const ditugaskan = allPenugasan.some(p =>
          p.subject_id === s.subject_id &&
          p.teacher_uid === currentUid &&
          p.status === 'aktif'
        );
        return ditugaskan
          ? `<button class="btn-aksi edit" onclick="openEditKKM('${s.subject_id}', ${s.kkm})" title="Edit KKM ${s.jenjang}">KKM ${escHtml(s.jenjang)}</button>`
          : '';
      }).join('');
    }

    return `
    <tr>
      <td>${escHtml(firstName)}</td>
      <td>${jenjangVal}</td>
      <td>${kkmVal}</td>
      <td><div class="aksi-wrap">${aksiHtml}</div></td>
    </tr>`;
  }).join('');

  // Mobile cards
  document.getElementById('cardListMapel').innerHTML = groupsHalIni.map(grp => {
    const firstName  = grp[0].name;
    const jenjangVal = grp.map(s => escHtml(s.jenjang)).join(' / ');
    const kkmVal     = grp.map(s => s.kkm).join(' / ');

    let aksiHtml = '';
    if (isAdmin) {
      aksiHtml = grp.map(s => `
        <button class="btn-aksi edit"  title="Edit ${s.jenjang}"  onclick="openEditMapel('${s.subject_id}')">${svgIcon('edit')} ${escHtml(s.jenjang)}</button>
        <button class="btn-aksi hapus" title="Hapus ${s.jenjang}" onclick="hapusMapel('${s.subject_id}')">${svgIcon('delete')}</button>
      `).join('');
    } else if (isGuru) {
      aksiHtml = grp.map(s => {
        const ditugaskan = allPenugasan.some(p =>
          p.subject_id === s.subject_id &&
          p.teacher_uid === currentUid &&
          p.status === 'aktif'
        );
        return ditugaskan
          ? `<button class="btn-aksi edit" onclick="openEditKKM('${s.subject_id}', ${s.kkm})" title="Edit KKM ${s.jenjang}">KKM ${escHtml(s.jenjang)}</button>`
          : '';
      }).join('');
    }

    return `
    <div class="mapel-card">
      <div class="mapel-card-head">
        <div class="mapel-card-icon">${svgIcon('book')}</div>
        <div class="mapel-card-info">
          <div class="mapel-card-name">${escHtml(firstName)}</div>
          <div class="mapel-card-meta">${jenjangVal} · KKM ${kkmVal}</div>
        </div>
      </div>
      <div class="mapel-card-foot">
        <div class="aksi-wrap">${aksiHtml}</div>
      </div>
    </div>`;
  }).join('');

  // Render pagination
  renderPaginasi('paginasiMapel', pageMapel, totalPageMapel, 'goToPageMapel');
}

// =============================================================
//  RENDER TABEL PENUGASAN (desktop + mobile cards)
// =============================================================
function renderTabelPenugasan() {
  const tahun   = document.getElementById('filterTahunAjaran').value;
  const sem     = document.getElementById('filterSemester').value;
  const jenjang = document.getElementById('filterJenjangPenugasan').value;
  const status  = document.getElementById('filterStatus').value;
  const role    = currentRole;

  const rows = allPenugasan.filter(p =>
    (tahun   === '' || p.tahun_ajaran === tahun) &&
    (sem     === '' || p.semester === sem) &&
    (status  === '' || p.status === status) &&
    (jenjang === '' || jenjangMapel(p.subject_id) === jenjang)
  );

  // Pagination
  const totalPenugasan = rows.length;
  const totalPagePenugasan = Math.ceil(totalPenugasan / PAGE_SIZE);
  if (pagePenugasan > totalPagePenugasan) pagePenugasan = 1;
  const start = (pagePenugasan - 1) * PAGE_SIZE;
  const end   = start + PAGE_SIZE;
  const rowsHalIni = rows.slice(start, end);

  const tbody = document.getElementById('tbodyPenugasan');

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-cell">Tidak ada data.</td></tr>`;
    document.getElementById('cardListPenugasan').innerHTML =
      `<div style="text-align:center;padding:32px;color:var(--text-soft)">Tidak ada data.</div>`;
    document.getElementById('paginasiPenugasan').innerHTML = '';
    return;
  }

  tbody.innerHTML = rowsHalIni.map(p => {
    const aksiHtml = buildAksiPenugasan(p, role, false);
    return `
      <tr>
        <td>${escHtml(namaGuru(p.teacher_uid))}</td>
        <td>${escHtml(namaMapel(p.subject_id))}</td>
        <td>${escHtml(namaKelas(p.class_id))}</td>
        <td>${escHtml(p.tahun_ajaran)}</td>
        <td>Sem ${escHtml(p.semester)}</td>
        <td>${buildStatusBadge(p)}</td>
        <td>${aksiHtml}</td>
      </tr>`;
  }).join('');

  // Mobile cards
  document.getElementById('cardListPenugasan').innerHTML = rowsHalIni.map(p => `
    <div class="penugasan-card">
      <div class="penugasan-card-head">
        <div class="penugasan-card-avatar">
          ${namaGuru(p.teacher_uid).charAt(0).toUpperCase()}
        </div>
        <div class="penugasan-card-info">
          <div class="penugasan-card-name">${escHtml(namaGuru(p.teacher_uid))}</div>
          <div class="penugasan-card-meta">${escHtml(namaMapel(p.subject_id))} · ${escHtml(namaKelas(p.class_id))}</div>
        </div>
        ${buildStatusBadge(p)}
      </div>
      <div class="penugasan-card-body">
        <div class="penugasan-card-row">
          <span>Tahun Ajaran</span><span>${escHtml(p.tahun_ajaran)}</span>
        </div>
        <div class="penugasan-card-row">
          <span>Semester</span><span>Semester ${escHtml(p.semester)}</span>
        </div>
        ${p.status === 'ditolak' && p.catatan ? `
        <div class="penugasan-card-row" style="flex-direction:column;align-items:flex-start;gap:4px">
          <span>Catatan Penolakan</span>
          <span class="catatan-ditolak" style="font-style:italic">💬 ${escHtml(p.catatan)}</span>
        </div>` : ''}
      </div>
      <div class="penugasan-card-foot">
        ${buildAksiPenugasan(p, role, true)}
      </div>
    </div>
  `).join('');

  // Render pagination
  renderPaginasi('paginasiPenugasan', pagePenugasan, totalPagePenugasan, 'goToPagePenugasan');
}

function buildStatusBadge(p) {
  if (p.status === 'aktif') return '<span class="badge-aktif-ts">Aktif</span>';
  if (p.status === 'ditolak') {
    const catatanHtml = p.catatan
      ? `<div class="catatan-ditolak">💬 ${escHtml(p.catatan)}</div>` : '';
    return `<span class="badge-ditolak">Ditolak</span>${catatanHtml}`;
  }
  return '<span class="badge-pending">Menunggu</span>';
}

function buildAksiPenugasan(p, role, isCard) {
  const id = p.doc_id;
  if (role === 'admin') {
    return `<div class="aksi-wrap">
      <button class="btn-aksi edit"  title="Edit"  onclick="openEditPenugasan('${id}')">${svgIcon('edit')}</button>
      <button class="btn-aksi hapus" title="Hapus" onclick="hapusPenugasan('${id}')">${svgIcon('delete')}</button>
      ${p.status === 'menunggu_approval' ? `
      <button class="btn-aksi approve" title="Setujui" onclick="approvePenugasan('${id}')">${svgIcon('check')}</button>
      <button class="btn-aksi tolak"   title="Tolak"   onclick="openTolak('${id}')">${svgIcon('x')}</button>` : ''}
    </div>`;
  }
  if (role === 'tu') {
    const milikSendiri = p.created_by === currentUid;
    const bisDiedit    = milikSendiri && p.status === 'menunggu_approval';
    const bisDihapus   = milikSendiri && p.status === 'menunggu_approval';
    const bisRevisi    = milikSendiri && p.status === 'ditolak';
    if (!bisDiedit && !bisDihapus && !bisRevisi) return '—';
    return `<div class="aksi-wrap">
      ${(bisDiedit || bisRevisi) ? `<button class="btn-aksi edit" title="Edit" onclick="openEditPenugasan('${id}')">${svgIcon('edit')}</button>` : ''}
      ${bisDihapus ? `<button class="btn-aksi hapus" title="Hapus" onclick="hapusPenugasan('${id}')">${svgIcon('delete')}</button>` : ''}
    </div>`;
  }
  if (role === 'kepsek' && p.status === 'menunggu_approval') {
    return `<div class="aksi-wrap">
      <button class="btn-aksi approve" title="Setujui" onclick="approvePenugasan('${id}')">${svgIcon('check')}</button>
      <button class="btn-aksi tolak"   title="Tolak"   onclick="openTolak('${id}')">${svgIcon('x')}</button>
    </div>`;
  }
  return '—';
}

// =============================================================
//  AUTO-INCREMENT id_penugasan
//  Format: SKTGS_YYYY_MM001  (reset per tahun, pisah dari mapel)
//  Counter doc: counters/penugasan_YYYY
// =============================================================
async function nextIdPenugasan() {
  const now    = new Date();
  const yyyy   = now.getFullYear();
  const mm     = String(now.getMonth() + 1).padStart(2, '0');
  const ctrKey = `penugasan_${yyyy}`;
  const counterRef = doc(db, 'counters', ctrKey);
  let newNum;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    newNum = snap.exists() ? (snap.data().last_num || 0) + 1 : 1;
    tx.set(counterRef, { last_num: newNum }, { merge: true });
  });
  return `SKTGS_${yyyy}_${mm}${String(newNum).padStart(3, '0')}`;
}

// =============================================================
//  SEARCHABLE SELECT — lightweight custom component
//  Usage: initSearchableSelect(wrapperId, items, placeholder, onSelect)
//    items: [{ value, label }]
//    onSelect(value) called when user picks an item
// =============================================================
const _ssState = {};   // keyed by wrapperId

function initSearchableSelect(wrapperId, items, placeholder, onSelect) {
  const wrap = document.getElementById(wrapperId);
  if (!wrap) return;

  _ssState[wrapperId] = { items, onSelect, value: '', open: false };

  wrap.innerHTML = `
    <div class="ss-box" id="${wrapperId}_box">
      <input type="text" class="ss-input form-control" id="${wrapperId}_input"
             placeholder="${escHtml(placeholder)}" autocomplete="off" />
      <div class="ss-dropdown" id="${wrapperId}_drop" style="display:none"></div>
    </div>`;

  const input = document.getElementById(`${wrapperId}_input`);
  const drop  = document.getElementById(`${wrapperId}_drop`);

  input.addEventListener('focus', () => ssOpen(wrapperId));
  input.addEventListener('input', () => ssFilter(wrapperId));

  // Close on outside click
  document.addEventListener('mousedown', (e) => {
    if (!wrap.contains(e.target)) ssClose(wrapperId);
  }, true);
}

function ssOpen(wrapperId) {
  const state = _ssState[wrapperId];
  if (!state) return;
  state.open = true;
  ssFilter(wrapperId);
  document.getElementById(`${wrapperId}_drop`).style.display = '';
}

function ssClose(wrapperId) {
  const state = _ssState[wrapperId];
  if (!state) return;
  state.open = false;
  const drop = document.getElementById(`${wrapperId}_drop`);
  if (drop) drop.style.display = 'none';
  // Restore label if value is set
  const input = document.getElementById(`${wrapperId}_input`);
  if (input && state.value) {
    const item = state.items.find(i => i.value === state.value);
    if (item) input.value = item.label;
  } else if (input && !state.value) {
    input.value = '';
  }
}

function ssFilter(wrapperId) {
  const state = _ssState[wrapperId];
  if (!state) return;
  const input = document.getElementById(`${wrapperId}_input`);
  const drop  = document.getElementById(`${wrapperId}_drop`);
  if (!input || !drop) return;

  const q = input.value.toLowerCase();
  const filtered = state.items.filter(i => i.label.toLowerCase().includes(q));

  if (filtered.length === 0) {
    drop.innerHTML = `<div class="ss-empty">Tidak ada hasil</div>`;
  } else {
    drop.innerHTML = filtered.map(i => `
      <div class="ss-item ${i.value === state.value ? 'selected' : ''}"
           data-value="${escHtml(i.value)}"
           onmousedown="event.preventDefault();ssSelect('${wrapperId}','${escHtml(i.value)}')"
      >${escHtml(i.label)}</div>`).join('');
  }
  drop.style.display = '';
}

window.ssSelect = function(wrapperId, value) {
  const state = _ssState[wrapperId];
  if (!state) return;
  state.value = value;
  const item  = state.items.find(i => i.value === value);
  const input = document.getElementById(`${wrapperId}_input`);
  if (input && item) input.value = item.label;
  ssClose(wrapperId);
  if (state.onSelect) state.onSelect(value);
};

function ssSetValue(wrapperId, value) {
  const state = _ssState[wrapperId];
  if (!state) return;
  state.value = value;
  const item  = state.items.find(i => i.value === value);
  const input = document.getElementById(`${wrapperId}_input`);
  if (input) input.value = item ? item.label : '';
}

function ssGetValue(wrapperId) {
  return _ssState[wrapperId]?.value ?? '';
}

function ssUpdateItems(wrapperId, items) {
  const state = _ssState[wrapperId];
  if (!state) return;
  state.items = items;
  // Reset selection if current value no longer in items
  if (state.value && !items.find(i => i.value === state.value)) {
    state.value = '';
    const input = document.getElementById(`${wrapperId}_input`);
    if (input) input.value = '';
  }
}

// =============================================================
//  POPULATE SELECTS (Penugasan modal)
// =============================================================

// Jenjang dropdown — unique values from allSubjects
function populateJenjangPenugasanSelect() {
  const jenjangSet = [...new Set(allSubjects.map(s => s.jenjang).filter(Boolean))].sort();
  const sel = document.getElementById('inputJenjangPenugasan');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Jenjang --</option>' +
    jenjangSet.map(j => `<option value="${j}">${escHtml(j)}</option>`).join('');
}

// Mapel — filtered by jenjang, searchable
function populateSubjectSelect(jenjangFilter = '') {
  const items = allSubjects
    .filter(s => !jenjangFilter || s.jenjang === jenjangFilter)
    .map(s => ({ value: s.subject_id, label: `${s.name} (${s.jenjang})` }));
  if (_ssState['ssMapelWrap']) {
    ssUpdateItems('ssMapelWrap', items);
  } else {
    initSearchableSelect('ssMapelWrap', items, '-- Cari Mapel --', () => {});
  }
}

// Kelas — filtered by jenjang
function populateClassSelect(jenjangFilter = '') {
  const filtered = jenjangFilter
    ? allClasses.filter(c => c.jenjang === jenjangFilter)
    : allClasses;
  const sel = document.getElementById('inputKelasPenugasan');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Kelas --</option>' +
    filtered.map(c => `<option value="${c.class_id}">${escHtml(c.name)}</option>`).join('');
}

// Guru — searchable
function populateTeacherSelect() {
  const items = allTeachers.map(t => ({ value: t.uid, label: t.name }));
  if (_ssState['ssGuruWrap']) {
    ssUpdateItems('ssGuruWrap', items);
  } else {
    initSearchableSelect('ssGuruWrap', items, '-- Cari Guru --', () => {});
  }
}

function collectTahunAjaran() {
  const set = new Set(allPenugasan.map(p => p.tahun_ajaran).filter(Boolean));
  allTahunAjaran = [...set].sort().reverse();
}

function populateTahunAjaranFilter() {
  const sel = document.getElementById('filterTahunAjaran');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Semua Tahun</option>' +
    allTahunAjaran.map(t => `<option value="${t}" ${t === cur ? 'selected' : ''}>${t}</option>`).join('');
}

// =============================================================
//  BIND EVENTS
// =============================================================
function bindEvents() {
  // Tab switching
  document.querySelectorAll('.mapel-tab').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  );

  // Filter Master Mapel — reset page ke 1
  document.getElementById('searchMapel').addEventListener('input', () => {
    pageMapel = 1;
    renderTabelMapel();
  });
  document.getElementById('filterJenjangMapel').addEventListener('change', () => {
    pageMapel = 1;
    renderTabelMapel();
  });

  // Filter Penugasan — reset page ke 1
  ['filterTahunAjaran','filterSemester','filterJenjangPenugasan','filterStatus'].forEach(id =>
    document.getElementById(id).addEventListener('change', () => {
      pagePenugasan = 1;
      renderTabelPenugasan();
    })
  );

  // FAB mobile — wire click handlers
  const fabMapel = document.getElementById('fabTambahMapel');
  if (fabMapel) fabMapel.addEventListener('click', () => openEditMapel(null));
  const fabPenugasan = document.getElementById('fabTambahPenugasan');
  if (fabPenugasan) fabPenugasan.addEventListener('click', () => openEditPenugasan(null));

  // Modal Mapel
  document.getElementById('btnTambahMapel').addEventListener('click', () => openEditMapel(null));
  document.getElementById('btnCloseModalMapel').addEventListener('click', () => closeModal('modalMapel'));
  document.getElementById('btnCancelMapel').addEventListener('click', () => closeModal('modalMapel'));
  document.getElementById('btnSubmitMapel').addEventListener('click', submitMapel);

  // Modal Penugasan
  document.getElementById('btnTambahPenugasan').addEventListener('click', () => openEditPenugasan(null));
  document.getElementById('btnCloseModalPenugasan').addEventListener('click', () => closeModal('modalPenugasan'));
  document.getElementById('btnCancelPenugasan').addEventListener('click', () => closeModal('modalPenugasan'));
  document.getElementById('btnSubmitPenugasan').addEventListener('click', submitPenugasan);

  // Modal Tolak
  document.getElementById('btnCloseModalTolak').addEventListener('click', () => closeModal('modalTolak'));
  document.getElementById('btnCancelTolak').addEventListener('click', () => closeModal('modalTolak'));
  document.getElementById('btnSubmitTolak').addEventListener('click', submitTolak);

  // Modal Edit KKM
  document.getElementById('btnSubmitKKM').addEventListener('click', submitEditKKM);

  // Modal Salin
  document.getElementById('btnSalinTahunLalu').addEventListener('click', openModalSalin);
  document.getElementById('btnCloseModalSalin').addEventListener('click', () => closeModal('modalSalin'));
  document.getElementById('btnCancelSalin').addEventListener('click', () => closeModal('modalSalin'));
  document.getElementById('btnSubmitSalin').addEventListener('click', submitSalin);
  document.getElementById('salinDariTahun').addEventListener('change', renderSalinList);
  document.getElementById('checkAllSalin').addEventListener('change', (e) => {
    document.querySelectorAll('#salinList input[type="checkbox"]').forEach(cb => cb.checked = e.target.checked);
  });

  // Backdrop close
  document.querySelectorAll('.modal').forEach(m =>
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(m.id); })
  );
}

// =============================================================
//  TAB SWITCH
// =============================================================
function switchTab(tab) {
  document.querySelectorAll('.mapel-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('panelMaster').classList.toggle('active',    tab === 'master');
  document.getElementById('panelPenugasan').classList.toggle('active', tab === 'penugasan');

  // FAB: tampilkan FAB yang sesuai dengan tab aktif
  const isAdmin = currentRole === 'admin';
  const isTU    = currentRole === 'tu';
  const fabMapel     = document.getElementById('fabTambahMapel');
  const fabPenugasan = document.getElementById('fabTambahPenugasan');
  if (fabMapel)     fabMapel.style.display     = (tab === 'master'    && isAdmin)          ? 'flex' : 'none';
  if (fabPenugasan) fabPenugasan.style.display = (tab === 'penugasan' && (isAdmin || isTU)) ? 'flex' : 'none';
}

// =============================================================
//  MODAL HELPERS
// =============================================================
function openModal(id)  {
  document.getElementById(id).classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('show');
  document.body.style.overflow = '';
}
// Expose to global scope for inline onclick handlers in HTML
window.closeModal = closeModal;
window.submitEditKKM = submitEditKKM;

// Global pagination callbacks (needed for inline onclick in rendered HTML)
window.goToPageMapel = function(hal) {
  pageMapel = hal;
  renderTabelMapel();
};
window.goToPagePenugasan = function(hal) {
  pagePenugasan = hal;
  renderTabelPenugasan();
};

// =============================================================
//  MASTER MAPEL — CRUD
// =============================================================

// Render dynamic KKM fields based on checked jenjang checkboxes
function renderKKMFields() {
  const cbSMP = document.getElementById('cbJenjangSMP');
  const cbSMA = document.getElementById('cbJenjangSMA');
  const wrap  = document.getElementById('kkmFieldsWrap');
  const rows  = [];
  if (cbSMP && cbSMP.checked) {
    rows.push(`
      <div class="form-field">
        <label for="inputKKM_SMP">KKM SMP</label>
        <input type="number" id="inputKKM_SMP" class="form-control"
               placeholder="75" min="0" max="100" value="75" />
      </div>`);
  }
  if (cbSMA && cbSMA.checked) {
    rows.push(`
      <div class="form-field">
        <label for="inputKKM_SMA">KKM SMA</label>
        <input type="number" id="inputKKM_SMA" class="form-control"
               placeholder="75" min="0" max="100" value="75" />
      </div>`);
  }
  if (wrap) wrap.innerHTML = rows.join('');
}

// editMapelId = null  → mode Tambah (bisa multi-jenjang)
// editMapelId = string → mode Edit satu entri (jenjang sudah tetap)
window.openEditMapel = function(subject_id) {
  editMapelId = subject_id;

  const isEdit = !!subject_id;
  document.getElementById('modalMapelTitle').textContent =
    isEdit ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran';

  // Tampilkan/sembunyikan bagian jenjang checkbox vs label tetap
  const jenjangCheckboxWrap = document.getElementById('jenjangCheckboxWrap');
  const jenjangEditWrap     = document.getElementById('jenjangEditWrap');

  if (isEdit) {
    const s = allSubjects.find(x => x.subject_id === subject_id);
    if (!s) return;

    document.getElementById('inputNamaMapel').value = s.name;

    // Mode edit: tampilkan label jenjang (tidak bisa diubah dari sini)
    if (jenjangCheckboxWrap) jenjangCheckboxWrap.style.display = 'none';
    if (jenjangEditWrap)     jenjangEditWrap.style.display     = '';
    const jenjangLabel = document.getElementById('jenjangEditLabel');
    if (jenjangLabel) jenjangLabel.textContent = s.jenjang;

    // Satu field KKM
    const wrap = document.getElementById('kkmFieldsWrap');
    if (wrap) wrap.innerHTML = `
      <div class="form-field">
        <label for="inputKKM_EDIT">KKM</label>
        <input type="number" id="inputKKM_EDIT" class="form-control"
               placeholder="75" min="0" max="100" value="${s.kkm}" />
      </div>`;
  } else {
    document.getElementById('inputNamaMapel').value = '';

    // Mode tambah: tampilkan checkbox jenjang
    if (jenjangCheckboxWrap) jenjangCheckboxWrap.style.display = '';
    if (jenjangEditWrap)     jenjangEditWrap.style.display     = 'none';

    // Reset checkboxes
    const cbSMP = document.getElementById('cbJenjangSMP');
    const cbSMA = document.getElementById('cbJenjangSMA');
    if (cbSMP) cbSMP.checked = true;
    if (cbSMA) cbSMA.checked = false;
    renderKKMFields();
  }

  openModal('modalMapel');
};

// Expose renderKKMFields so checkbox onchange can call it
window.renderKKMFields = renderKKMFields;

async function submitMapel() {
  const name = document.getElementById('inputNamaMapel').value.trim();
  if (!name) { showToast('Nama mapel tidak boleh kosong.', 'error'); return; }

  setBtnLoading('btnSubmitMapel', true);
  try {
    if (editMapelId) {
      // ── MODE EDIT: update satu dokumen ──
      const kkmEl = document.getElementById('inputKKM_EDIT');
      const kkm   = parseInt(kkmEl?.value ?? '0', 10);
      if (isNaN(kkm) || kkm < 0 || kkm > 100) {
        showToast('KKM harus antara 0–100.', 'error'); return;
      }
      // Ambil jenjang dari label (tidak berubah saat edit)
      const jenjangLabel = document.getElementById('jenjangEditLabel');
      const jenjang = jenjangLabel ? jenjangLabel.textContent.trim() : '';
      await updateDoc(doc(db, 'subjects', editMapelId), { name, jenjang, kkm });
      showToast('Mata pelajaran berhasil diperbarui.', 'success');
    } else {
      // ── MODE TAMBAH: buat satu dokumen per jenjang yang dicentang ──
      const cbSMP = document.getElementById('cbJenjangSMP');
      const cbSMA = document.getElementById('cbJenjangSMA');
      const entries = [];
      if (cbSMP?.checked) {
        const kkm = parseInt(document.getElementById('inputKKM_SMP')?.value ?? '0', 10);
        if (isNaN(kkm) || kkm < 0 || kkm > 100) {
          showToast('KKM SMP harus antara 0–100.', 'error'); return;
        }
        entries.push({ jenjang: 'SMP', kkm });
      }
      if (cbSMA?.checked) {
        const kkm = parseInt(document.getElementById('inputKKM_SMA')?.value ?? '0', 10);
        if (isNaN(kkm) || kkm < 0 || kkm > 100) {
          showToast('KKM SMA harus antara 0–100.', 'error'); return;
        }
        entries.push({ jenjang: 'SMA', kkm });
      }
      if (entries.length === 0) {
        showToast('Pilih minimal satu jenjang.', 'error'); return;
      }

      // Buat dokumen per jenjang, masing-masing dengan id_mapel unik
      await Promise.all(entries.map(async ({ jenjang, kkm }) => {
        const id_mapel = await nextIdMapel();
        await addDoc(collection(db, 'subjects'), { id_mapel, name, jenjang, kkm });
      }));

      showToast(
        entries.length > 1
          ? `${entries.length} mata pelajaran berhasil ditambahkan.`
          : 'Mata pelajaran berhasil ditambahkan.',
        'success'
      );
    }
    closeModal('modalMapel');
    await loadSubjects();
  } catch (err) {
    console.error(err);
    showToast('Gagal menyimpan. Coba lagi.', 'error');
  } finally {
    setBtnLoading('btnSubmitMapel', false, 'Simpan');
  }
}

window.hapusMapel = async function(subject_id) {
  if (!confirm('Hapus mata pelajaran ini? Tindakan tidak bisa dibatalkan.')) return;
  try {
    await deleteDoc(doc(db, 'subjects', subject_id));
    showToast('Mata pelajaran dihapus.', 'success');
    await loadSubjects();
  } catch (err) {
    console.error(err);
    showToast('Gagal menghapus.', 'error');
  }
};

// =============================================================
//  PENUGASAN — CRUD
// =============================================================

// Called when jenjang dropdown changes in modal penugasan
window.onJenjangPenugasanChange = function() {
  const jenjang = document.getElementById('inputJenjangPenugasan')?.value ?? '';
  populateSubjectSelect(jenjang);
  populateClassSelect(jenjang);
  // Reset selections
  ssSetValue('ssMapelWrap', '');
  const kelasSel = document.getElementById('inputKelasPenugasan');
  if (kelasSel) kelasSel.value = '';
};

window.openEditPenugasan = function(doc_id) {
  editPenugasanId = doc_id;

  // Ensure searchable selects are initialized
  populateTeacherSelect();
  populateJenjangPenugasanSelect();

  if (doc_id) {
    const p = allPenugasan.find(x => x.doc_id === doc_id);
    if (!p) return;
    document.getElementById('modalPenugasanTitle').textContent = 'Edit Penugasan';

    // Set guru
    ssSetValue('ssGuruWrap', p.teacher_uid);

    // Set jenjang (derive from subject)
    const subjectJenjang = jenjangMapel(p.subject_id);
    const jenjangSel = document.getElementById('inputJenjangPenugasan');
    if (jenjangSel) jenjangSel.value = subjectJenjang;

    // Populate mapel & kelas filtered by jenjang, then set values
    populateSubjectSelect(subjectJenjang);
    populateClassSelect(subjectJenjang);
    ssSetValue('ssMapelWrap', p.subject_id);

    const kelasSel = document.getElementById('inputKelasPenugasan');
    if (kelasSel) kelasSel.value = p.class_id;

    document.getElementById('inputTahunAjaranPenugasan').value = p.tahun_ajaran;
    document.getElementById('inputSemesterPenugasan').value    = p.semester;
  } else {
    document.getElementById('modalPenugasanTitle').textContent = 'Tugaskan Guru';

    ssSetValue('ssGuruWrap', '');
    ssSetValue('ssMapelWrap', '');

    const jenjangSel = document.getElementById('inputJenjangPenugasan');
    if (jenjangSel) jenjangSel.value = '';

    populateSubjectSelect('');
    populateClassSelect('');

    const kelasSel = document.getElementById('inputKelasPenugasan');
    if (kelasSel) kelasSel.value = '';

    document.getElementById('inputTahunAjaranPenugasan').value = '';
    document.getElementById('inputSemesterPenugasan').value    = '1';
  }
  openModal('modalPenugasan');
};

async function submitPenugasan() {
  const teacher_uid  = ssGetValue('ssGuruWrap');
  const subject_id   = ssGetValue('ssMapelWrap');
  const class_id     = document.getElementById('inputKelasPenugasan')?.value ?? '';
  const jenjang      = document.getElementById('inputJenjangPenugasan')?.value ?? '';
  const tahun_ajaran = document.getElementById('inputTahunAjaranPenugasan').value.trim();
  const semester     = document.getElementById('inputSemesterPenugasan').value;

  if (!teacher_uid) { showToast('Pilih guru terlebih dahulu.', 'error'); return; }
  if (!jenjang)     { showToast('Pilih jenjang terlebih dahulu.', 'error'); return; }
  if (!subject_id)  { showToast('Pilih mata pelajaran.', 'error'); return; }
  if (!class_id)    { showToast('Pilih kelas.', 'error'); return; }
  if (!tahun_ajaran) { showToast('Isi tahun ajaran.', 'error'); return; }
  if (!/^\d{4}\/\d{4}$/.test(tahun_ajaran)) {
    showToast('Format tahun ajaran: 2025/2026', 'error'); return;
  }

  setBtnLoading('btnSubmitPenugasan', true);
  const status = currentRole === 'admin' ? 'aktif' : 'menunggu_approval';

  try {
    if (editPenugasanId) {
      await updateDoc(doc(db, 'teacher_subjects', editPenugasanId), {
        teacher_uid, subject_id, class_id, jenjang, tahun_ajaran, semester,
        status: 'menunggu_approval',
        approved_by: null, catatan: null,
        updated_at: serverTimestamp(),
      });
      showToast('Penugasan diperbarui & diajukan ulang.', 'success');
    } else {
      const id_penugasan = await nextIdPenugasan();
      await addDoc(collection(db, 'teacher_subjects'), {
        id_penugasan, teacher_uid, subject_id, class_id, jenjang,
        tahun_ajaran, semester, status,
        created_by: currentUid,
        approved_by: null, catatan: null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      showToast(status === 'aktif' ? 'Penugasan berhasil ditambahkan.' : 'Penugasan diajukan, menunggu approval.', 'success');
    }
    closeModal('modalPenugasan');
    await loadPenugasan();
  } catch (err) {
    console.error(err);
    showToast('Gagal menyimpan. Coba lagi.', 'error');
  } finally {
    setBtnLoading('btnSubmitPenugasan', false, 'Simpan & Ajukan');
  }
}

window.hapusPenugasan = async function(doc_id) {
  if (!confirm('Hapus penugasan ini?')) return;
  try {
    await deleteDoc(doc(db, 'teacher_subjects', doc_id));
    showToast('Penugasan dihapus.', 'success');
    await loadPenugasan();
  } catch (err) {
    console.error(err);
    showToast('Gagal menghapus.', 'error');
  }
};

// =============================================================
//  APPROVE / TOLAK
// =============================================================
window.approvePenugasan = async function(doc_id) {
  if (!confirm('Setujui penugasan ini?')) return;
  try {
    await updateDoc(doc(db, 'teacher_subjects', doc_id), {
      status: 'aktif', approved_by: currentUid, catatan: null,
      updated_at: serverTimestamp(),
    });
    showToast('Penugasan disetujui.', 'success');
    await loadPenugasan();
  } catch (err) {
    console.error(err);
    showToast('Gagal menyetujui.', 'error');
  }
};

window.openTolak = function(doc_id) {
  tolakTargetId = doc_id;
  document.getElementById('inputCatatan').value = '';
  openModal('modalTolak');
};

async function submitTolak() {
  const catatan = document.getElementById('inputCatatan').value.trim();
  if (!catatan) { showToast('Catatan penolakan wajib diisi.', 'error'); return; }

  setBtnLoading('btnSubmitTolak', true);
  try {
    await updateDoc(doc(db, 'teacher_subjects', tolakTargetId), {
      status: 'ditolak', approved_by: currentUid, catatan,
      updated_at: serverTimestamp(),
    });
    showToast('Penugasan ditolak.', 'success');
    closeModal('modalTolak');
    tolakTargetId = null;
    await loadPenugasan();
  } catch (err) {
    console.error(err);
    showToast('Gagal menolak.', 'error');
  } finally {
    setBtnLoading('btnSubmitTolak', false, 'Tolak');
  }
}

// =============================================================
//  SALIN DARI TAHUN LALU
// =============================================================
function openModalSalin() {
  const sel = document.getElementById('salinDariTahun');
  sel.innerHTML = '<option value="">-- Pilih Tahun --</option>' +
    allTahunAjaran.map(t => `<option value="${t}">${t}</option>`).join('');
  document.getElementById('salinKeTahun').value = '';
  document.getElementById('salinSemester').value = '1';
  document.getElementById('checkAllSalin').checked = false;
  document.getElementById('salinList').innerHTML =
    `<div class="empty-cell" style="padding:20px;text-align:center;color:var(--text-soft)">
      Pilih tahun ajaran sumber terlebih dahulu.
    </div>`;
  openModal('modalSalin');
}

function renderSalinList() {
  const tahun = document.getElementById('salinDariTahun').value;
  const list  = document.getElementById('salinList');
  document.getElementById('checkAllSalin').checked = false;

  if (!tahun) {
    list.innerHTML = `<div class="empty-cell" style="padding:20px;text-align:center;color:var(--text-soft)">Pilih tahun ajaran sumber terlebih dahulu.</div>`;
    return;
  }

  const filtered = allPenugasan.filter(p => p.tahun_ajaran === tahun && p.status === 'aktif');
  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-cell" style="padding:20px;text-align:center;color:var(--text-soft)">Tidak ada penugasan aktif untuk tahun ${tahun}.</div>`;
    return;
  }

  list.innerHTML = filtered.map(p => `
    <label class="salin-item">
      <input type="checkbox" value="${p.doc_id}" />
      <div class="salin-item-info">
        <div class="salin-item-name">${escHtml(namaGuru(p.teacher_uid))} — ${escHtml(namaMapel(p.subject_id))}</div>
        <div class="salin-item-meta">${escHtml(namaKelas(p.class_id))} · ${escHtml(p.tahun_ajaran)} · Sem ${p.semester}</div>
      </div>
    </label>
  `).join('');
}

async function submitSalin() {
  const tahunSumber = document.getElementById('salinDariTahun').value;
  const tahunTujuan = document.getElementById('salinKeTahun').value.trim();
  const semester    = document.getElementById('salinSemester').value;

  if (!tahunSumber) { showToast('Pilih tahun sumber.', 'error'); return; }
  if (!tahunTujuan) { showToast('Isi tahun ajaran tujuan.', 'error'); return; }
  if (!/^\d{4}\/\d{4}$/.test(tahunTujuan)) { showToast('Format: 2026/2027', 'error'); return; }

  const checked = [...document.querySelectorAll('#salinList input[type="checkbox"]:checked')];
  if (checked.length === 0) { showToast('Pilih minimal satu penugasan.', 'error'); return; }

  setBtnLoading('btnSubmitSalin', true);
  const status = currentRole === 'admin' ? 'aktif' : 'menunggu_approval';

  try {
    const ids        = checked.map(cb => cb.value);
    const sumberData = allPenugasan.filter(p => ids.includes(p.doc_id));

    await Promise.all(sumberData.map(p =>
      addDoc(collection(db, 'teacher_subjects'), {
        teacher_uid: p.teacher_uid, subject_id: p.subject_id,
        class_id: p.class_id, tahun_ajaran: tahunTujuan, semester,
        status, created_by: currentUid,
        approved_by: null, catatan: null,
        created_at: serverTimestamp(), updated_at: serverTimestamp(),
      })
    ));

    showToast(`${ids.length} penugasan berhasil disalin ke ${tahunTujuan}.`, 'success');
    closeModal('modalSalin');
    await loadPenugasan();
    collectTahunAjaran();
    populateTahunAjaranFilter();
  } catch (err) {
    console.error(err);
    showToast('Gagal menyalin. Coba lagi.', 'error');
  } finally {
    setBtnLoading('btnSubmitSalin', false, 'Salin yang Dipilih');
  }
}

// =============================================================
//  PAGINATION HELPER
// =============================================================
function renderPaginasi(containerId, currentPage, totalPages, onPageChange) {
  const el = document.getElementById(containerId);
  if (!el) return;

  // Sembunyikan paginasi jika hanya 1 halaman
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  const buttons = [];

  // Tombol Sebelumnya
  buttons.push(`
    <button class="paginasi-btn ${currentPage === 1 ? 'disabled' : ''}"
            onclick="(${onPageChange})(${currentPage - 1})"
            ${currentPage === 1 ? 'disabled' : ''}>&lsaquo;</button>
  `);

  // Nomor halaman — tampilkan max 5 halaman di sekitar halaman aktif
  const range = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 || i === totalPages ||
      (i >= currentPage - range && i <= currentPage + range)
    ) {
      buttons.push(`
        <button class="paginasi-btn ${i === currentPage ? 'active' : ''}"
                onclick="(${onPageChange})(${i})">${i}</button>
      `);
    } else if (
      i === currentPage - range - 1 ||
      i === currentPage + range + 1
    ) {
      buttons.push(`<span class="paginasi-dots">&hellip;</span>`);
    }
  }

  // Tombol Berikutnya
  buttons.push(`
    <button class="paginasi-btn ${currentPage === totalPages ? 'disabled' : ''}"
            onclick="(${onPageChange})(${currentPage + 1})"
            ${currentPage === totalPages ? 'disabled' : ''}>&rsaquo;</button>
  `);

  el.innerHTML = `
    <div class="paginasi-info">
      Halaman ${currentPage} dari ${totalPages}
    </div>
    <div class="paginasi-wrap">${buttons.join('')}</div>
  `;
}

// =============================================================
//  EDIT KKM (Guru)
// =============================================================
// Buka modal kecil untuk edit KKM saja
window.openEditKKM = function(subject_id, kkmSaat) {
  document.getElementById('kkmSubjectId').value  = subject_id;
  document.getElementById('inputKKMEdit').value  = kkmSaat;
  openModal('modalEditKKM');
};

// Submit edit KKM
async function submitEditKKM() {
  const subject_id = document.getElementById('kkmSubjectId').value;
  const kkm        = parseInt(document.getElementById('inputKKMEdit').value, 10);

  if (isNaN(kkm) || kkm < 0 || kkm > 100) {
    showToast('KKM harus antara 0–100.', 'error');
    return;
  }

  // Verifikasi guru ini memang ditugaskan ke mapel ini
  const boleh = allPenugasan.some(p =>
    p.subject_id === subject_id &&
    p.teacher_uid === currentUid &&
    p.status === 'aktif'
  );

  if (!boleh) {
    showToast('Anda tidak memiliki akses untuk edit KKM ini.', 'error');
    return;
  }

  setBtnLoading('btnSubmitKKM', true);
  try {
    await updateDoc(doc(db, 'subjects', subject_id), { kkm });
    showToast('KKM berhasil diperbarui.', 'success');
    closeModal('modalEditKKM');
    await loadSubjects();
  } catch (err) {
    showToast('Gagal update KKM.', 'error');
  } finally {
    setBtnLoading('btnSubmitKKM', false, 'Simpan');
  }
}

// =============================================================
//  UTILS
// =============================================================
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = `toast show ${type}`;
  setTimeout(() => { toast.className = 'toast'; }, 3500);
}

function setBtnLoading(id, isLoading, labelDefault) {
  const btn = document.getElementById(id);
  if (!btn) return;
  if (isLoading) {
    btn.dataset.label = btn.textContent;
    btn.textContent   = 'Menyimpan...';
    btn.disabled      = true;
  } else {
    btn.textContent = btn.dataset.label || labelDefault || 'Simpan';
    btn.disabled    = false;
  }
}

function labelRole(role) {
  const map = {
    admin: 'Administrator', kepsek: 'Kepala Sekolah',
    guru : 'Guru',          tu    : 'Tata Usaha',
  };
  return map[role] || role;
}

// =============================================================
//  CATATAN UNTUK DEVELOPER
//  Tambahkan dua div berikut ke mapel.html:
//
//  Di panelMaster, setelah .table-container:
//    <div class="card-list" id="cardListMapel"></div>
//
//  Di panelPenugasan, setelah .table-container:
//    <div class="card-list" id="cardListPenugasan"></div>
//
//  Dan tambahkan CSS berikut ke mapel.css (sudah disediakan
//  di file mapel-cards.css yang dihasilkan bersama file ini).
// =============================================================
