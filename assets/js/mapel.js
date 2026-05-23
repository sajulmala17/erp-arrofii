// =============================================================
//  mapel.js — Modul Mata Pelajaran
//  Tab 1: Master Mapel (subjects)
//  Tab 2: Penugasan Guru (teacher_subjects) + Approval workflow
// =============================================================

import { auth }                    from './firebase-config.js';
import { guardPage, getSession }   from './auth-guard.js';
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
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
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

  // Tab Master — tombol tambah hanya admin
  document.getElementById('btnTambahMapel').style.display = isAdmin ? 'flex' : 'none';
  document.getElementById('thAksiMapel').style.display    = isAdmin ? '' : 'none';

  // Tab Penugasan — toolbar kanan hanya admin & TU
  document.getElementById('toolbarPenugasanRight').style.display = (isAdmin || isTU) ? '' : 'none';

  // Pending banner — hanya kepsek
  if (isKepsek) document.getElementById('pendingBanner').style.display = '';
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
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'guru'), orderBy('displayName')));
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
function namaGuru(uid)     { return allTeachers.find(t => t.uid === uid)?.displayName ?? uid; }
function namaMapel(sid)    { return allSubjects.find(s => s.subject_id === sid)?.name ?? sid; }
function namaKelas(cid)    { return allClasses.find(c => c.class_id === cid)?.name ?? cid; }
function jenjangMapel(sid) { return allSubjects.find(s => s.subject_id === sid)?.jenjang ?? ''; }
function escHtml(str)      { return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// =============================================================
//  RENDER TABEL MASTER MAPEL (desktop)
// =============================================================
function renderTabelMapel() {
  const search  = document.getElementById('searchMapel').value.toLowerCase();
  const jenjang = document.getElementById('filterJenjangMapel').value;
  const isAdmin = currentRole === 'admin';

  const rows = allSubjects.filter(s =>
    s.name.toLowerCase().includes(search) &&
    (jenjang === '' || s.jenjang === jenjang)
  );

  const colspan = isAdmin ? 4 : 3;
  const tbody   = document.getElementById('tbodyMapel');

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-cell">Tidak ada data.</td></tr>`;
    document.getElementById('cardListMapel').innerHTML =
      `<div style="text-align:center;padding:32px;color:var(--text-soft)">Tidak ada data.</div>`;
    return;
  }

  tbody.innerHTML = rows.map(s => `
    <tr>
      <td>${escHtml(s.name)}</td>
      <td>${escHtml(s.jenjang)}</td>
      <td>${s.kkm}</td>
      ${isAdmin ? `
      <td>
        <div class="aksi-wrap">
          <button class="btn-aksi edit"  onclick="openEditMapel('${s.subject_id}')">✏️ Edit</button>
          <button class="btn-aksi hapus" onclick="hapusMapel('${s.subject_id}')">🗑️ Hapus</button>
        </div>
      </td>` : ''}
    </tr>
  `).join('');

  // Mobile cards
  document.getElementById('cardListMapel').innerHTML = rows.map(s => `
    <div class="mapel-card">
      <div class="mapel-card-head">
        <div class="mapel-card-icon">📚</div>
        <div class="mapel-card-info">
          <div class="mapel-card-name">${escHtml(s.name)}</div>
          <div class="mapel-card-meta">${escHtml(s.jenjang)} · KKM ${s.kkm}</div>
        </div>
      </div>
      ${isAdmin ? `
      <div class="mapel-card-foot">
        <button class="btn-aksi edit"  onclick="openEditMapel('${s.subject_id}')">✏️ Edit</button>
        <button class="btn-aksi hapus" onclick="hapusMapel('${s.subject_id}')">🗑️ Hapus</button>
      </div>` : ''}
    </div>
  `).join('');
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

  const tbody = document.getElementById('tbodyPenugasan');

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-cell">Tidak ada data.</td></tr>`;
    document.getElementById('cardListPenugasan').innerHTML =
      `<div style="text-align:center;padding:32px;color:var(--text-soft)">Tidak ada data.</div>`;
    return;
  }

  tbody.innerHTML = rows.map(p => {
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
  document.getElementById('cardListPenugasan').innerHTML = rows.map(p => `
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
      <button class="btn-aksi edit"  onclick="openEditPenugasan('${id}')">✏️ Edit</button>
      <button class="btn-aksi hapus" onclick="hapusPenugasan('${id}')">🗑️ Hapus</button>
      ${p.status === 'menunggu_approval' ? `
      <button class="btn-aksi approve" onclick="approvePenugasan('${id}')">✅ Approve</button>
      <button class="btn-aksi tolak"   onclick="openTolak('${id}')">❌ Tolak</button>` : ''}
    </div>`;
  }
  if (role === 'tu') {
    const milikSendiri = p.created_by === currentUid;
    const bisDiedit    = milikSendiri && p.status === 'menunggu_approval';
    const bisDihapus   = milikSendiri && p.status === 'menunggu_approval';
    const bisRevisi    = milikSendiri && p.status === 'ditolak';
    if (!bisDiedit && !bisDihapus && !bisRevisi) return '—';
    return `<div class="aksi-wrap">
      ${(bisDiedit || bisRevisi) ? `<button class="btn-aksi edit" onclick="openEditPenugasan('${id}')">✏️ Edit</button>` : ''}
      ${bisDihapus ? `<button class="btn-aksi hapus" onclick="hapusPenugasan('${id}')">🗑️ Hapus</button>` : ''}
    </div>`;
  }
  if (role === 'kepsek' && p.status === 'menunggu_approval') {
    return `<div class="aksi-wrap">
      <button class="btn-aksi approve" onclick="approvePenugasan('${id}')">✅ Approve</button>
      <button class="btn-aksi tolak"   onclick="openTolak('${id}')">❌ Tolak</button>
    </div>`;
  }
  return '—';
}

// =============================================================
//  POPULATE SELECTS
// =============================================================
function populateSubjectSelect() {
  document.getElementById('inputMapelPenugasan').innerHTML =
    '<option value="">-- Pilih Mapel --</option>' +
    allSubjects.map(s => `<option value="${s.subject_id}">${escHtml(s.name)} (${s.jenjang})</option>`).join('');
}

function populateClassSelect() {
  document.getElementById('inputKelasPenugasan').innerHTML =
    '<option value="">-- Pilih Kelas --</option>' +
    allClasses.map(c => `<option value="${c.class_id}">${escHtml(c.name)}</option>`).join('');
}

function populateTeacherSelect() {
  document.getElementById('inputGuruPenugasan').innerHTML =
    '<option value="">-- Pilih Guru --</option>' +
    allTeachers.map(t => `<option value="${t.uid}">${escHtml(t.displayName)}</option>`).join('');
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

  // Filter Master Mapel
  document.getElementById('searchMapel').addEventListener('input', renderTabelMapel);
  document.getElementById('filterJenjangMapel').addEventListener('change', renderTabelMapel);

  // Filter Penugasan
  ['filterTahunAjaran','filterSemester','filterJenjangPenugasan','filterStatus'].forEach(id =>
    document.getElementById(id).addEventListener('change', renderTabelPenugasan)
  );

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

// =============================================================
//  MASTER MAPEL — CRUD
// =============================================================
window.openEditMapel = function(subject_id) {
  editMapelId = subject_id;
  if (subject_id) {
    const s = allSubjects.find(x => x.subject_id === subject_id);
    if (!s) return;
    document.getElementById('modalMapelTitle').textContent = 'Edit Mata Pelajaran';
    document.getElementById('inputNamaMapel').value    = s.name;
    document.getElementById('inputJenjangMapel').value = s.jenjang;
    document.getElementById('inputKKM').value          = s.kkm;
  } else {
    document.getElementById('modalMapelTitle').textContent = 'Tambah Mata Pelajaran';
    document.getElementById('inputNamaMapel').value    = '';
    document.getElementById('inputJenjangMapel').value = 'SMP';
    document.getElementById('inputKKM').value          = '75';
  }
  openModal('modalMapel');
};

async function submitMapel() {
  const name    = document.getElementById('inputNamaMapel').value.trim();
  const jenjang = document.getElementById('inputJenjangMapel').value;
  const kkm     = parseInt(document.getElementById('inputKKM').value, 10);

  if (!name) { showToast('Nama mapel tidak boleh kosong.', 'error'); return; }
  if (isNaN(kkm) || kkm < 0 || kkm > 100) { showToast('KKM harus antara 0–100.', 'error'); return; }

  setBtnLoading('btnSubmitMapel', true);
  try {
    if (editMapelId) {
      await updateDoc(doc(db, 'subjects', editMapelId), { name, jenjang, kkm });
      showToast('Mata pelajaran berhasil diperbarui.', 'success');
    } else {
      await addDoc(collection(db, 'subjects'), { name, jenjang, kkm });
      showToast('Mata pelajaran berhasil ditambahkan.', 'success');
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
window.openEditPenugasan = function(doc_id) {
  editPenugasanId = doc_id;
  if (doc_id) {
    const p = allPenugasan.find(x => x.doc_id === doc_id);
    if (!p) return;
    document.getElementById('modalPenugasanTitle').textContent     = 'Edit Penugasan';
    document.getElementById('inputGuruPenugasan').value            = p.teacher_uid;
    document.getElementById('inputMapelPenugasan').value           = p.subject_id;
    document.getElementById('inputKelasPenugasan').value           = p.class_id;
    document.getElementById('inputTahunAjaranPenugasan').value     = p.tahun_ajaran;
    document.getElementById('inputSemesterPenugasan').value        = p.semester;
  } else {
    document.getElementById('modalPenugasanTitle').textContent     = 'Tugaskan Guru';
    document.getElementById('inputGuruPenugasan').value            = '';
    document.getElementById('inputMapelPenugasan').value           = '';
    document.getElementById('inputKelasPenugasan').value           = '';
    document.getElementById('inputTahunAjaranPenugasan').value     = '';
    document.getElementById('inputSemesterPenugasan').value        = '1';
  }
  openModal('modalPenugasan');
};

async function submitPenugasan() {
  const teacher_uid  = document.getElementById('inputGuruPenugasan').value;
  const subject_id   = document.getElementById('inputMapelPenugasan').value;
  const class_id     = document.getElementById('inputKelasPenugasan').value;
  const tahun_ajaran = document.getElementById('inputTahunAjaranPenugasan').value.trim();
  const semester     = document.getElementById('inputSemesterPenugasan').value;

  if (!teacher_uid || !subject_id || !class_id || !tahun_ajaran) {
    showToast('Semua field wajib diisi.', 'error'); return;
  }
  if (!/^\d{4}\/\d{4}$/.test(tahun_ajaran)) {
    showToast('Format tahun ajaran: 2025/2026', 'error'); return;
  }

  setBtnLoading('btnSubmitPenugasan', true);
  const status = currentRole === 'admin' ? 'aktif' : 'menunggu_approval';

  try {
    if (editPenugasanId) {
      await updateDoc(doc(db, 'teacher_subjects', editPenugasanId), {
        teacher_uid, subject_id, class_id, tahun_ajaran, semester,
        status: 'menunggu_approval',
        approved_by: null, catatan: null,
        updated_at: serverTimestamp(),
      });
      showToast('Penugasan diperbarui & diajukan ulang.', 'success');
    } else {
      await addDoc(collection(db, 'teacher_subjects'), {
        teacher_uid, subject_id, class_id, tahun_ajaran, semester,
        status,
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
