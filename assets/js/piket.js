// ============================================================
// piket.js
// Absensi Piket Harian — input oleh guru piket / TU
//
// Alur:
//   1. Pilih tanggal & jenjang
//   2. Muncul daftar siswa sesuai jenjang
//   3. Toggle status per siswa (hadir/sakit/izin/alpha)
//   4. Simpan ke picket_attendance
// ============================================================

import { auth, getToken }         from './firebase-config.js';
import { guardPage, getSession }  from './auth-guard.js';
import { onAuthStateChanged }     from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore,
         collection,
         query,
         where,
         getDocs,
         getDoc,
         setDoc,
         doc,
         orderBy,
         serverTimestamp,
         Timestamp }              from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ============================================================
// INISIALISASI
// ============================================================
const db = getFirestore();
guardPage(['admin', 'kepsek', 'guru', 'tu']);

// State
let allSiswa        = [];
let allKelas        = [];
let kehadiranMap    = {}; // { student_id: status }
let existingDocId   = null; // doc ID jika absensi hari ini sudah ada
let currentRole     = '';
let currentUid      = '';
let isReadOnly      = false;

// Status warna
const STATUS_CONFIG = {
  hadir    : { label: 'Hadir',     color: '#2d6a4f', bg: '#e8f5e9', icon: '✓' },
  sakit    : { label: 'Sakit',     color: '#e67e22', bg: '#fef9e7', icon: '🤒' },
  izin     : { label: 'Izin',      color: '#2980b9', bg: '#eaf4fb', icon: '📋' },
  alpha    : { label: 'Alpha',     color: '#c0392b', bg: '#fdecea', icon: '✗' },
};

const STATUS_CYCLE = ['hadir', 'sakit', 'izin', 'alpha'];

// ============================================================
// HELPER: Format tanggal ke YYYY-MM-DD untuk input date
// ============================================================
function toDateInput(date) {
  return date.toISOString().split('T')[0];
}

// ============================================================
// HELPER: Format tanggal ke string Indonesia
// ============================================================
function formatTanggalID(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day    : 'numeric',
    month  : 'long',
    year   : 'numeric',
  }).format(date);
}

// ============================================================
// HELPER: Generate doc ID dari teacher_uid + tanggal + jenjang
// Format: {uid}_{YYYYMMDD}_{jenjang}
// ============================================================
function generateDocId(uid, tanggal, jenjang) {
  const dateStr = tanggal.replace(/-/g, '');
  return `${uid}_${dateStr}_${jenjang}`;
}

// ============================================================
// LOAD: Ambil data siswa berdasarkan jenjang
// ============================================================
async function loadSiswa(jenjang) {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'students'),
        where('jenjang', '==', jenjang),
        where('aktif', '!=', false),
        orderBy('aktif'),
        orderBy('name')
      )
    );

    // Fallback jika index belum ada
    if (snap.empty) {
      const snapAll = await getDocs(
        query(
          collection(db, 'students'),
          where('jenjang', '==', jenjang),
          orderBy('name')
        )
      );
      allSiswa = snapAll.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.aktif !== false);
    } else {
      allSiswa = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // Load nama kelas
    const classIds = [...new Set(allSiswa.map(s => s.class_id).filter(Boolean))];
    allKelas = {};
    await Promise.all(classIds.map(async id => {
      const kelasDoc = await getDoc(doc(db, 'classes', id));
      if (kelasDoc.exists()) allKelas[id] = kelasDoc.data().name;
    }));

  } catch (err) {
    console.error('[loadSiswa] Error:', err);
    showToast('Gagal memuat data siswa.', 'error');
  }
}

// ============================================================
// LOAD: Cek apakah absensi hari ini sudah ada
// ============================================================
async function loadExistingAbsensi(uid, tanggal, jenjang) {
  const docId  = generateDocId(uid, tanggal, jenjang);
  const docRef = doc(db, 'picket_attendance', docId);
  const snap   = await getDoc(docRef);

  if (snap.exists()) {
    existingDocId            = docId;
    kehadiranMap             = snap.data().kehadiran_siswa || {};
    isReadOnly               = snap.data().is_finalized || false;
    return snap.data();
  }

  existingDocId = null;
  kehadiranMap  = {};
  isReadOnly    = false;
  return null;
}

// ============================================================
// RENDER: Daftar siswa dengan toggle status
// ============================================================
function renderSiswaList() {
  const container = document.getElementById('siswaList');
  const search    = document.getElementById('searchSiswa')?.value.toLowerCase() || '';

  const filtered = allSiswa.filter(s =>
    !search || s.name.toLowerCase().includes(search) ||
    (s.nisn || '').includes(search)
  );

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-absen">
        <div class="empty-absen-icon">📋</div>
        <div>Tidak ada siswa ditemukan</div>
      </div>`;
    return;
  }

  // Group by kelas
  const byKelas = {};
  filtered.forEach(s => {
    const kelasNama = allKelas[s.class_id] || 'Tanpa Kelas';
    if (!byKelas[kelasNama]) byKelas[kelasNama] = [];
    byKelas[kelasNama].push(s);
  });

  let html = '';

  Object.entries(byKelas).sort().forEach(([kelasNama, siswaList]) => {
    const totalKelas  = siswaList.length;
    const hadirKelas  = siswaList.filter(s =>
      (kehadiranMap[s.student_id] || 'hadir') === 'hadir'
    ).length;

    html += `
      <div class="kelas-group">
        <div class="kelas-header">
          <span class="kelas-nama">${kelasNama}</span>
          <span class="kelas-count">${hadirKelas}/${totalKelas} hadir</span>
        </div>
        <div class="kelas-siswa">
          ${siswaList.map(s => renderSiswaItem(s)).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  updateSummary();
}

// ============================================================
// RENDER: Item siswa tunggal
// ============================================================
function renderSiswaItem(siswa) {
  const status = kehadiranMap[siswa.student_id] || 'hadir';
  const cfg    = STATUS_CONFIG[status];
  const nama   = siswa.name;
  const initial = nama.charAt(0).toUpperCase();

  const disabled = isReadOnly ? 'disabled' : '';

  return `
    <div class="siswa-item ${isReadOnly ? 'readonly' : ''}"
         id="item-${siswa.student_id}"
         onclick="${isReadOnly ? '' : `toggleStatus('${siswa.student_id}')`}"
         style="--status-color:${cfg.color};--status-bg:${cfg.bg}">
      <div class="siswa-avatar ${siswa.gender === 'L' ? 'male' : 'female'}">
        ${initial}
      </div>
      <div class="siswa-item-info">
        <div class="siswa-item-name">${nama}</div>
        <div class="siswa-item-nisn">${siswa.nisn || siswa.student_id}</div>
      </div>
      <div class="status-buttons">
        ${STATUS_CYCLE.map(s => `
          <button class="status-btn ${status === s ? 'active' : ''}"
                  data-status="${s}"
                  onclick="${isReadOnly ? 'event.stopPropagation()' : `setStatus('${siswa.student_id}', '${s}', event)`}"
                  title="${STATUS_CONFIG[s].label}"
                  ${disabled}>
            ${STATUS_CONFIG[s].icon}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

// ============================================================
// ACTION: Toggle status siswa (klik item)
// ============================================================
window.toggleStatus = function(studentId) {
  const current = kehadiranMap[studentId] || 'hadir';
  const idx     = STATUS_CYCLE.indexOf(current);
  const next    = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
  kehadiranMap[studentId] = next;
  updateSiswaItem(studentId);
  updateSummary();
};

// ============================================================
// ACTION: Set status langsung dari tombol
// ============================================================
window.setStatus = function(studentId, status, event) {
  event.stopPropagation();
  kehadiranMap[studentId] = status;
  updateSiswaItem(studentId);
  updateSummary();
};

// ============================================================
// UPDATE: Refresh tampilan satu item tanpa re-render semua
// ============================================================
function updateSiswaItem(studentId) {
  const siswa = allSiswa.find(s => s.student_id === studentId);
  if (!siswa) return;

  const item = document.getElementById(`item-${studentId}`);
  if (!item) return;

  const status = kehadiranMap[studentId] || 'hadir';
  const cfg    = STATUS_CONFIG[status];

  item.style.setProperty('--status-color', cfg.color);
  item.style.setProperty('--status-bg', cfg.bg);

  item.querySelectorAll('.status-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });
}

// ============================================================
// UPDATE: Summary statistik di header
// ============================================================
function updateSummary() {
  const total   = allSiswa.length;
  const hadir   = allSiswa.filter(s => (kehadiranMap[s.student_id] || 'hadir') === 'hadir').length;
  const sakit   = allSiswa.filter(s => kehadiranMap[s.student_id] === 'sakit').length;
  const izin    = allSiswa.filter(s => kehadiranMap[s.student_id] === 'izin').length;
  const alpha   = allSiswa.filter(s => kehadiranMap[s.student_id] === 'alpha').length;

  setEl('summaryTotal', total);
  setEl('summaryHadir', hadir);
  setEl('summarySakit', sakit);
  setEl('summaryIzin',  izin);
  setEl('summaryAlpha', alpha);

  // Update progress bar
  const pct = total > 0 ? Math.round((hadir / total) * 100) : 0;
  const bar = document.getElementById('progressBar');
  if (bar) {
    bar.style.width   = `${pct}%`;
    bar.textContent   = `${pct}%`;
  }
}

// ============================================================
// ACTION: Set semua siswa hadir (bulk)
// ============================================================
window.setAllHadir = function() {
  allSiswa.forEach(s => { kehadiranMap[s.student_id] = 'hadir'; });
  renderSiswaList();
};

// ============================================================
// LOAD: Muat absensi berdasarkan form
// ============================================================
async function loadAbsensi() {
  const tanggal = document.getElementById('inputTanggal').value;
  const jenjang = document.getElementById('inputJenjang').value;

  if (!tanggal || !jenjang) return;

  // Reset state
  allSiswa     = [];
  kehadiranMap = {};

  showLoading(true);

  try {
    // Load siswa & cek absensi existing paralel
    await loadSiswa(jenjang);
    const existing = await loadExistingAbsensi(currentUid, tanggal, jenjang);

    // Jika belum ada absensi, default semua hadir
    if (!existing) {
      allSiswa.forEach(s => { kehadiranMap[s.student_id] = 'hadir'; });
    }

    // Tampilkan panel absensi
    document.getElementById('emptyState').style.display    = 'none';
    document.getElementById('absensiPanel').style.display  = 'block';

    // Update info header
    setEl('infoTanggal', formatTanggalID(tanggal));
    setEl('infoJenjang', jenjang);
    setEl('infoJumlahSiswa', allSiswa.length);

    // Status existing
    const statusEl = document.getElementById('statusAbsensi');
    if (existing) {
      statusEl.innerHTML = `<span class="badge-saved">✓ Tersimpan</span>`;
      if (isReadOnly) {
        statusEl.innerHTML += ` <span class="badge-final">Final</span>`;
      }
    } else {
      statusEl.innerHTML = `<span class="badge-draft">● Draft Baru</span>`;
    }

    renderSiswaList();

  } catch (err) {
    console.error('[loadAbsensi] Error:', err);
    showToast('Gagal memuat data absensi.', 'error');
  } finally {
    showLoading(false);
  }
}

// ============================================================
// SAVE: Simpan absensi ke Firestore
// ============================================================
window.saveAbsensi = async function(finalize = false) {
  if (isReadOnly) {
    showToast('Absensi sudah difinalisasi, tidak bisa diubah.', 'error');
    return;
  }

  const tanggal = document.getElementById('inputTanggal').value;
  const jenjang = document.getElementById('inputJenjang').value;

  if (!tanggal || !jenjang) {
    showToast('Pilih tanggal dan jenjang terlebih dahulu.', 'error');
    return;
  }

  if (allSiswa.length === 0) {
    showToast('Tidak ada siswa untuk diabsen.', 'error');
    return;
  }

  setBtnLoading('btnSimpan', true);

  try {
    const docId      = generateDocId(currentUid, tanggal, jenjang);
    const docRef     = doc(db, 'picket_attendance', docId);
    const tanggalTs  = Timestamp.fromDate(new Date(tanggal + 'T00:00:00'));

    // Pastikan semua siswa punya status
    allSiswa.forEach(s => {
      if (!kehadiranMap[s.student_id]) {
        kehadiranMap[s.student_id] = 'hadir';
      }
    });

    await setDoc(docRef, {
      doc_id          : docId,
      teacher_uid     : currentUid,
      jenjang,
      tanggal         : tanggalTs,
      kehadiran_siswa : kehadiranMap,
      is_finalized    : finalize,
      total_jam       : 0, // Absensi piket tidak hitung jam
      created_at      : serverTimestamp(),
      updated_at      : serverTimestamp(),
    }, { merge: true });

    existingDocId = docId;
    if (finalize) isReadOnly = true;

    showToast(
      finalize ? 'Absensi berhasil difinalisasi.' : 'Absensi berhasil disimpan.',
      'success'
    );

    // Update status badge
    const statusEl = document.getElementById('statusAbsensi');
    statusEl.innerHTML = finalize
      ? `<span class="badge-saved">✓ Tersimpan</span> <span class="badge-final">Final</span>`
      : `<span class="badge-saved">✓ Tersimpan</span>`;

    // Re-render jika finalize (untuk disable tombol)
    if (finalize) renderSiswaList();

  } catch (err) {
    console.error('[saveAbsensi] Error:', err);
    showToast('Gagal menyimpan absensi.', 'error');
  } finally {
    setBtnLoading('btnSimpan', false);
  }
};

// ============================================================
// EVENT LISTENERS
// ============================================================
document.getElementById('inputTanggal').addEventListener('change', loadAbsensi);
document.getElementById('inputJenjang').addEventListener('change', loadAbsensi);
document.getElementById('searchSiswa')?.addEventListener('input', renderSiswaList);

// ============================================================
// HELPER: Set innerHTML by ID
// ============================================================
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = val;
}

// ============================================================
// HELPER: Loading state
// ============================================================
function showLoading(show) {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = show ? 'flex' : 'none';
}

// ============================================================
// HELPER: Loading tombol
// ============================================================
function setBtnLoading(id, isLoading) {
  const btn = document.getElementById(id);
  if (!btn) return;
  if (isLoading) {
    btn.dataset.label = btn.textContent;
    btn.textContent   = 'Menyimpan...';
    btn.disabled      = true;
  } else {
    btn.textContent = btn.dataset.label || 'Simpan';
    btn.disabled    = false;
  }
}

// ============================================================
// HELPER: Toast notification
// ============================================================
function showToast(msg, type = 'success') {
  const toast       = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = `toast show ${type}`;
  setTimeout(() => { toast.className = 'toast'; }, 3500);
}

// ============================================================
// MAIN
// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const { role, name } = getSession();
  currentRole = role;
  currentUid  = user.uid;

  // Set tanggal default = hari ini
  const today = toDateInput(new Date());
  document.getElementById('inputTanggal').value = today;

  // Set nama user di header
  setEl('user-display-name', name);
  setEl('user-display-role', labelRole(role));

  const initial = name ? name.charAt(0).toUpperCase() : '?';
  setEl('sidebarAvatar', initial);
  setEl('topbarAvatar',  initial);
});

function labelRole(role) {
  const map = {
    admin: 'Administrator', kepsek: 'Kepala Sekolah',
    guru : 'Guru',          tu    : 'Tata Usaha',
    kantin: 'Kantin',       ortu  : 'Orang Tua',
  };
  return map[role] || role;
}
