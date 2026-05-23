// ============================================================
// absensi-mapel.js
// Absensi Mata Pelajaran — input oleh guru mapel / TU
//
// Alur:
//   1. Pilih tanggal → muncul daftar kelas yang diajar guru hari itu
//   2. Pilih kelas+mapel → muncul daftar siswa di kelas itu
//   3. Set jam pelajaran (1-8) yang diajarkan
//   4. Set status guru (hadir/izin/sakit)
//   5. Toggle status per siswa
//   6. Simpan ke subject_attendance
// ============================================================

import { auth, getToken }         from './firebase-config.js';
import { guardPage, getSession }  from './auth-guard.js';
import { getIcon }                from './navbar.js';
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
let currentRole     = '';
let currentUid      = '';
let allSiswa        = [];
let kehadiranMap    = {};   // { student_id: status }
let jamDipilih      = [];   // array jam ke- yang dipilih, misal [1,2]
let selectedMapel   = null; // { subject_id, subject_name, class_id, class_name, tahun_ajaran, semester }
let existingDocId   = null;
let teacherSubjects = [];   // daftar mapel+kelas yang diajar guru ini

// Helper SVG inline untuk status buttons
function si(name) {
  return `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${getIcon(name)}</svg>`;
}

// Status siswa
const STATUS_SISWA = {
  hadir    : { label: 'Hadir',     color: '#2d6a4f', bg: '#e8f5e9', icon: () => si('check') },
  sakit    : { label: 'Sakit',     color: '#e67e22', bg: '#fef9e7', icon: () => si('thermometer') },
  izin     : { label: 'Izin',      color: '#2980b9', bg: '#eaf4fb', icon: () => si('clipboard') },
  alpha    : { label: 'Alpha',     color: '#c0392b', bg: '#fdecea', icon: () => si('x') },
  terlambat: { label: 'Terlambat', color: '#8e44ad', bg: '#f5eef8', icon: () => si('clock') },
};

const STATUS_CYCLE = ['hadir', 'sakit', 'izin', 'alpha', 'terlambat'];

// ============================================================
// HELPER: Format tanggal
// ============================================================
function toDateInput(date) {
  return date.toISOString().split('T')[0];
}

function formatTanggalID(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric',
    month: 'long', year: 'numeric',
  }).format(date);
}

// ============================================================
// HELPER: Generate doc ID
// Format: {uid}_{YYYYMMDD}_{class_id}_{subject_id}
// Unik per guru per hari per kelas per mapel
// ============================================================
function generateDocId(uid, tanggal, classId, subjectId) {
  const dateStr = tanggal.replace(/-/g, '');
  return `${uid}_${dateStr}_${classId}_${subjectId}`;
}

// ============================================================
// LOAD: Ambil daftar kelas+mapel yang diajar guru ini
// ============================================================
async function loadTeacherSubjects(uid) {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'teacher_subjects'),
        where('teacher_uid', '==', uid),
        where('status', '==', 'aktif')
      )
    );

    if (snap.empty) {
      teacherSubjects = [];
      return;
    }

    // Fetch nama kelas & mapel
    const raw = snap.docs.map(d => d.data());

    const classIds   = [...new Set(raw.map(r => r.class_id))];
    const subjectIds = [...new Set(raw.map(r => r.subject_id))];

    const classMap   = {};
    const subjectMap = {};

    await Promise.all([
      ...classIds.map(async id => {
        const d = await getDoc(doc(db, 'classes', id));
        if (d.exists()) classMap[id] = d.data();
      }),
      ...subjectIds.map(async id => {
        const d = await getDoc(doc(db, 'subjects', id));
        if (d.exists()) subjectMap[id] = d.data();
      }),
    ]);

    teacherSubjects = raw.map(r => ({
      ...r,
      class_name  : classMap[r.class_id]?.name    || r.class_id,
      subject_name: subjectMap[r.subject_id]?.name || r.subject_id,
      jenjang     : classMap[r.class_id]?.jenjang  || '',
    }));

  } catch (err) {
    console.error('[loadTeacherSubjects] Error:', err);
  }
}

// ============================================================
// RENDER: Daftar kelas+mapel sebagai pilihan
// ============================================================
function renderKelasList() {
  const container = document.getElementById('kelasList');

  if (teacherSubjects.length === 0) {
    container.innerHTML = `
      <div class="empty-mapel">
        <div class="empty-mapel-icon">${si('book-open')}</div>
        <div>Belum ada mata pelajaran yang ditugaskan</div>
      </div>`;
    return;
  }

  const tanggal = document.getElementById('inputTanggal').value;

  container.innerHTML = teacherSubjects.map((ts, idx) => `
    <div class="mapel-card ${selectedMapel?.subject_id === ts.subject_id &&
                              selectedMapel?.class_id   === ts.class_id ? 'selected' : ''}"
         onclick="selectMapel(${idx})">
      <div class="mapel-card-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      </div>
      <div class="mapel-card-info">
        <div class="mapel-card-name">${ts.subject_name}</div>
        <div class="mapel-card-meta">
          ${ts.class_name}
          <span class="mapel-badge">${ts.jenjang}</span>
          <span class="mapel-badge">Sem ${ts.semester}</span>
        </div>
      </div>
      <div class="mapel-card-arrow">›</div>
    </div>
  `).join('');
}

// ============================================================
// ACTION: Pilih mapel+kelas
// ============================================================
window.selectMapel = async function(idx) {
  selectedMapel = teacherSubjects[idx];

  // Highlight kartu yang dipilih
  document.querySelectorAll('.mapel-card').forEach((el, i) => {
    el.classList.toggle('selected', i === idx);
  });

  // Reset state
  allSiswa     = [];
  kehadiranMap = {};
  jamDipilih   = [];
  existingDocId = null;

  showPanel(true);
  await loadSiswaKelas();
  await loadExistingAbsensi();
  renderAbsensiPanel();
};

// ============================================================
// LOAD: Siswa di kelas yang dipilih
// ============================================================
async function loadSiswaKelas() {
  if (!selectedMapel) return;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'students'),
        where('class_id', '==', selectedMapel.class_id),
        orderBy('name')
      )
    );
    allSiswa = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(s => s.aktif !== false);

    // Default semua hadir
    allSiswa.forEach(s => {
      kehadiranMap[s.student_id] = 'hadir';
    });

  } catch (err) {
    console.error('[loadSiswaKelas] Error:', err);
  }
}

// ============================================================
// LOAD: Cek absensi yang sudah ada
// ============================================================
async function loadExistingAbsensi() {
  const tanggal = document.getElementById('inputTanggal').value;
  if (!tanggal || !selectedMapel) return;

  const docId  = generateDocId(
    currentUid, tanggal,
    selectedMapel.class_id,
    selectedMapel.subject_id
  );
  const docRef = doc(db, 'subject_attendance', docId);
  const snap   = await getDoc(docRef);

  if (snap.exists()) {
    const data       = snap.data();
    existingDocId    = docId;
    kehadiranMap     = data.kehadiran_siswa || {};
    jamDipilih       = data.jam_pelajaran   || [];

    // Set status guru
    const statusGuru = data.status_guru || 'hadir';
    document.querySelectorAll('.guru-status-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.status === statusGuru);
    });

    // Update badge status
    setEl('statusMapelAbsensi', `<span class="badge-saved">✓ Tersimpan</span>`);
  } else {
    existingDocId = null;
    setEl('statusMapelAbsensi', `<span class="badge-draft">● Draft Baru</span>`);
  }
}

// ============================================================
// RENDER: Panel absensi mapel
// ============================================================
function renderAbsensiPanel() {
  if (!selectedMapel) return;

  const tanggal = document.getElementById('inputTanggal').value;

  // Update header panel
  setEl('panelMapelNama',  selectedMapel.subject_name);
  setEl('panelKelasNama',  selectedMapel.class_name);
  setEl('panelTanggal',    formatTanggalID(tanggal));
  setEl('panelJumlahSiswa', allSiswa.length);

  // Render jam pelajaran
  renderJamPelajaran();

  // Render daftar siswa
  renderSiswaMapel();

  updateSummaryMapel();
}

// ============================================================
// RENDER: Tombol jam pelajaran 1-8
// ============================================================
function renderJamPelajaran() {
  const container = document.getElementById('jamPelajaranWrap');
  container.innerHTML = '';

  for (let i = 1; i <= 8; i++) {
    const btn = document.createElement('button');
    btn.className   = `jam-btn ${jamDipilih.includes(i) ? 'active' : ''}`;
    btn.textContent = i;
    btn.title       = `Jam ke-${i}`;
    btn.onclick     = () => toggleJam(i);
    container.appendChild(btn);
  }

  updateJamInfo();
}

// ============================================================
// ACTION: Toggle jam pelajaran
// ============================================================
window.toggleJam = function(jam) {
  const idx = jamDipilih.indexOf(jam);
  if (idx === -1) {
    jamDipilih.push(jam);
    jamDipilih.sort((a, b) => a - b);
  } else {
    jamDipilih.splice(idx, 1);
  }
  renderJamPelajaran();
};

// ============================================================
// UPDATE: Info jam yang dipilih
// ============================================================
function updateJamInfo() {
  const infoEl = document.getElementById('jamInfo');
  if (!infoEl) return;
  if (jamDipilih.length === 0) {
    infoEl.textContent = 'Belum ada jam dipilih';
    infoEl.style.color = 'var(--error)';
  } else {
    infoEl.textContent = `${jamDipilih.length} jam pelajaran (Jam ke: ${jamDipilih.join(', ')})`;
    infoEl.style.color = 'var(--green-mid)';
  }
}

// ============================================================
// RENDER: Daftar siswa di panel absensi mapel
// ============================================================
function renderSiswaMapel() {
  const container = document.getElementById('siswaMapelList');
  const search    = document.getElementById('searchSiswaMapel')?.value.toLowerCase() || '';

  const filtered = allSiswa.filter(s =>
    !search || s.name.toLowerCase().includes(search) ||
    (s.nisn || '').includes(search)
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-absen"><div class="empty-absen-icon">${si('users')}</div><div>Tidak ada siswa</div></div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const status = kehadiranMap[s.student_id] || 'hadir';
    const cfg    = STATUS_SISWA[status];
    return `
      <div class="siswa-item"
           id="mapel-item-${s.student_id}"
           onclick="toggleStatusMapel('${s.student_id}')"
           style="--status-color:${cfg.color};--status-bg:${cfg.bg}">
        <div class="siswa-avatar ${s.gender === 'L' ? 'male' : 'female'}">
          ${s.name.charAt(0).toUpperCase()}
        </div>
        <div class="siswa-item-info">
          <div class="siswa-item-name">${s.name}</div>
          <div class="siswa-item-nisn">${s.nisn || s.student_id}</div>
        </div>
        <div class="status-buttons">
          ${STATUS_CYCLE.map(st => `
            <button class="status-btn ${status === st ? 'active' : ''}"
                    data-status="${st}"
                    onclick="setStatusMapel('${s.student_id}', '${st}', event)"
                    title="${STATUS_SISWA[st].label}">
              ${STATUS_SISWA[st].icon()}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================
// ACTION: Toggle & set status siswa mapel
// ============================================================
window.toggleStatusMapel = function(studentId) {
  const current = kehadiranMap[studentId] || 'hadir';
  const idx     = STATUS_CYCLE.indexOf(current);
  kehadiranMap[studentId] = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
  updateSiswaItemMapel(studentId);
  updateSummaryMapel();
};

window.setStatusMapel = function(studentId, status, event) {
  event.stopPropagation();
  kehadiranMap[studentId] = status;
  updateSiswaItemMapel(studentId);
  updateSummaryMapel();
};

function updateSiswaItemMapel(studentId) {
  const item   = document.getElementById(`mapel-item-${studentId}`);
  if (!item) return;
  const status = kehadiranMap[studentId] || 'hadir';
  const cfg    = STATUS_SISWA[status];
  item.style.setProperty('--status-color', cfg.color);
  item.style.setProperty('--status-bg', cfg.bg);
  item.querySelectorAll('.status-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });
}

// ============================================================
// UPDATE: Summary absensi mapel
// ============================================================
function updateSummaryMapel() {
  const total     = allSiswa.length;
  const hadir     = allSiswa.filter(s => (kehadiranMap[s.student_id] || 'hadir') === 'hadir').length;
  const sakit     = allSiswa.filter(s => kehadiranMap[s.student_id] === 'sakit').length;
  const izin      = allSiswa.filter(s => kehadiranMap[s.student_id] === 'izin').length;
  const alpha     = allSiswa.filter(s => kehadiranMap[s.student_id] === 'alpha').length;
  const terlambat = allSiswa.filter(s => kehadiranMap[s.student_id] === 'terlambat').length;

  setEl('mapelTotal',     total);
  setEl('mapelHadir',     hadir);
  setEl('mapelSakit',     sakit);
  setEl('mapelIzin',      izin);
  setEl('mapelAlpha',     alpha);
  setEl('mapelTerlambat', terlambat);

  const pct = total > 0 ? Math.round((hadir / total) * 100) : 0;
  const bar = document.getElementById('mapelProgressBar');
  if (bar) { bar.style.width = `${pct}%`; bar.textContent = `${pct}%`; }
}

// ============================================================
// ACTION: Set semua hadir
// ============================================================
window.setAllHadirMapel = function() {
  allSiswa.forEach(s => { kehadiranMap[s.student_id] = 'hadir'; });
  renderSiswaMapel();
};

// ============================================================
// SAVE: Simpan absensi mapel ke Firestore
// ============================================================
window.saveAbsensiMapel = async function() {
  const tanggal = document.getElementById('inputTanggal').value;

  if (!selectedMapel) {
    showToast('Pilih mata pelajaran terlebih dahulu.', 'error');
    return;
  }

  if (jamDipilih.length === 0) {
    showToast('Pilih minimal 1 jam pelajaran.', 'error');
    return;
  }

  if (allSiswa.length === 0) {
    showToast('Tidak ada siswa di kelas ini.', 'error');
    return;
  }

  // Ambil status guru
  const activeGuru = document.querySelector('.guru-status-btn.active');
  const statusGuru = activeGuru?.dataset.status || 'hadir';

  setBtnLoading('btnSimpanMapel', true);

  try {
    const docId    = generateDocId(
      currentUid, tanggal,
      selectedMapel.class_id,
      selectedMapel.subject_id
    );
    const docRef   = doc(db, 'subject_attendance', docId);
    const tanggalTs = Timestamp.fromDate(new Date(tanggal + 'T00:00:00'));

    // Pastikan semua siswa punya status
    allSiswa.forEach(s => {
      if (!kehadiranMap[s.student_id]) kehadiranMap[s.student_id] = 'hadir';
    });

    const dataToSave = {
      doc_id          : docId,
      teacher_uid     : currentUid,
      subject_id      : selectedMapel.subject_id,
      class_id        : selectedMapel.class_id,
      tahun_ajaran    : selectedMapel.tahun_ajaran || '',
      semester        : selectedMapel.semester || '',
      tanggal         : tanggalTs,
      jam_pelajaran   : jamDipilih,
      jumlah_jam      : jamDipilih.length, // ← dasar hitung gaji
      kehadiran_siswa : kehadiranMap,
      status_guru     : statusGuru,
      updated_at      : serverTimestamp(),
    };

    if (!existingDocId) {
      dataToSave.created_at = serverTimestamp();
    }

    await setDoc(docRef, dataToSave, { merge: true });

    existingDocId = docId;
    setEl('statusMapelAbsensi', `<span class="badge-saved">✓ Tersimpan</span>`);
    showToast('Absensi berhasil disimpan.', 'success');

  } catch (err) {
    console.error('[saveAbsensiMapel] Error:', err);
    showToast('Gagal menyimpan absensi.', 'error');
  } finally {
    setBtnLoading('btnSimpanMapel', false);
  }
};

// ============================================================
// HELPER: Tampilkan/sembunyikan panel absensi
// ============================================================
function showPanel(show) {
  document.getElementById('absensiMapelPanel').style.display = show ? 'block' : 'none';
}

// ============================================================
// EVENT LISTENERS
// ============================================================
document.getElementById('inputTanggal').addEventListener('change', () => {
  // Reset panel saat tanggal berubah
  selectedMapel = null;
  showPanel(false);
  renderKelasList();
});

document.getElementById('searchSiswaMapel')?.addEventListener('input', renderSiswaMapel);

// Guru status toggle
document.querySelectorAll('.guru-status-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.guru-status-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ============================================================
// HELPER: Set innerHTML
// ============================================================
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = val;
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
// HELPER: Toast
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

  // Tanggal default hari ini
  document.getElementById('inputTanggal').value = toDateInput(new Date());

  // Set user info
  setEl('user-display-name', name);
  setEl('user-display-role', labelRole(role));
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  setEl('sidebarAvatar', initial);
  setEl('topbarAvatar',  initial);

  // Load daftar mapel guru
  await loadTeacherSubjects(currentUid);
  renderKelasList();
});

function labelRole(role) {
  const map = {
    admin: 'Administrator', kepsek: 'Kepala Sekolah',
    guru : 'Guru',          tu    : 'Tata Usaha',
    kantin: 'Kantin',       ortu  : 'Orang Tua',
  };
  return map[role] || role;
}
