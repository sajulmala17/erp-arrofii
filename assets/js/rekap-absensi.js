// ============================================================
// rekap-absensi.js
// Rekap & Laporan Absensi
//
// Fitur:
//   A. Rekap Absensi Siswa — dari picket_attendance
//   B. Rekap Absensi Guru  — dari subject_attendance
//
// Akses:
//   - Admin & Kepsek: semua data
//   - Guru: hanya absensi mapel milik sendiri
//   - TU: semua data
// ============================================================

import { auth }                   from './firebase-config.js';
import { guardPage, getSession }  from './auth-guard.js';
import { onAuthStateChanged }     from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore,
         collection,
         query,
         where,
         getDocs,
         getDoc,
         doc,
         orderBy,
         limit,        // ← tambahkan ini
         Timestamp }   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';


// ============================================================
// INISIALISASI
// ============================================================
const db = getFirestore();
guardPage(['admin', 'kepsek', 'guru', 'tu']);

let currentRole = '';
let currentUid  = '';
let allKelas    = [];
let allGuru     = [];
let activeTab   = 'siswa'; // 'siswa' | 'guru'

// ============================================================
// HELPER: Format tanggal
// ============================================================
function formatTanggalID(date) {
  if (!date) return '—';
  const d = date.toDate ? date.toDate() : new Date(date);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(d);
}

function formatBulanID(year, month) {
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long', year: 'numeric',
  }).format(date);
}

// ============================================================
// HELPER: Warna status
// ============================================================
const STATUS_COLOR = {
  hadir    : { bg: '#e8f5e9', color: '#2d6a4f' },
  sakit    : { bg: '#fef9e7', color: '#e67e22' },
  izin     : { bg: '#eaf4fb', color: '#2980b9' },
  alpha    : { bg: '#fdecea', color: '#c0392b' },
  terlambat: { bg: '#f5eef8', color: '#8e44ad' },
};

function statusBadge(status) {
  const cfg = STATUS_COLOR[status] || { bg: '#f5f5f5', color: '#666' };
  const label = {
    hadir: 'Hadir', sakit: 'Sakit', izin: 'Izin',
    alpha: 'Alpha', terlambat: 'Terlambat',
  }[status] || status;
  return `<span style="background:${cfg.bg};color:${cfg.color};padding:2px 8px;border-radius:12px;font-size:11.5px;font-weight:600">${label}</span>`;
}

// ============================================================
// LOAD: Data master kelas & guru
// ============================================================
async function loadMasterData() {
  // Kelas
  const kelasSnap = await getDocs(
    query(collection(db, 'classes'), orderBy('name'))
  );
  allKelas = kelasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Populate filter kelas
  const selKelas = document.getElementById('filterKelasRekap');
  if (selKelas) {
    selKelas.innerHTML = '<option value="">Semua Kelas</option>' +
      allKelas.map(k =>
        `<option value="${k.id}">${k.name} (${k.jenjang})</option>`
      ).join('');
  }

  // Guru (hanya untuk admin/kepsek/tu)
  if (['admin', 'kepsek', 'tu'].includes(currentRole)) {
    const guruSnap = await getDocs(
      query(
        collection(db, 'users'),
        where('role', '==', 'guru'),
        orderBy('name')
      )
    );
    allGuru = guruSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const selGuru = document.getElementById('filterGuru');
    if (selGuru) {
      selGuru.innerHTML = '<option value="">Semua Guru</option>' +
        allGuru.map(g =>
          `<option value="${g.uid || g.id}">${g.name}</option>`
        ).join('');
    }
  }
}

// ============================================================
// TAB: Switch antara rekap siswa & guru
// ============================================================
window.switchTab = function(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.getElementById('panelSiswa').style.display = tab === 'siswa' ? 'block' : 'none';
  document.getElementById('panelGuru').style.display  = tab === 'guru'  ? 'block' : 'none';
};

// ============================================================
// A. REKAP ABSENSI SISWA
// Sumber: picket_attendance
// ============================================================
window.loadRekapSiswa = async function() {
  const bulan   = document.getElementById('filterBulanSiswa').value;
  const kelasId = document.getElementById('filterKelasRekap').value;

  if (!bulan) {
    showToast('Pilih bulan terlebih dahulu.', 'error');
    return;
  }

  const [year, month] = bulan.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate   = new Date(year, month, 1);

  showLoading('loadingSiswa', true);
  document.getElementById('tableSiswa').innerHTML = '';
  document.getElementById('summaryRekapSiswa').innerHTML = '';

  try {
    // Query picket_attendance dalam bulan tersebut
    const snap = await getDocs(
      query(
        collection(db, 'picket_attendance'),
        where('tanggal', '>=', Timestamp.fromDate(startDate)),
        where('tanggal', '<',  Timestamp.fromDate(endDate)),
        orderBy('tanggal')
      )
    );

    if (snap.empty) {
      document.getElementById('tableSiswa').innerHTML =
        `<div class="empty-rekap">Tidak ada data absensi untuk bulan ini.</div>`;
      showLoading('loadingSiswa', false);
      return;
    }

    // Kumpulkan semua data kehadiran per siswa
    const rekapSiswa = {}; // { student_id: { hadir, sakit, izin, alpha, nama, kelas } }
    const tanggalSet = new Set();

    snap.forEach(d => {
      const data      = d.data();
      const kehadiran = data.kehadiran_siswa || {};
      const tgl       = formatTanggalID(data.tanggal);
      tanggalSet.add(tgl);

      Object.entries(kehadiran).forEach(([studentId, status]) => {
        if (!rekapSiswa[studentId]) {
          rekapSiswa[studentId] = {
            hadir: 0, sakit: 0, izin: 0, alpha: 0, terlambat: 0,
          };
        }
        rekapSiswa[studentId][status] =
          (rekapSiswa[studentId][status] || 0) + 1;
      });
    });

    // Fetch nama siswa
    const studentIds = Object.keys(rekapSiswa);
    const studentMap = {};

    await Promise.all(studentIds.map(async id => {
      // Cari berdasarkan field student_id
      const sSnap = await getDocs(
        query(
          collection(db, 'students'),
          where('student_id', '==', id),
          limit(1)
        )
      );
      if (!sSnap.empty) {
        const s = sSnap.docs[0].data();
        studentMap[id] = {
          name    : s.name,
          class_id: s.class_id,
          nisn    : s.nisn || '—',
        };
      }
    }));

    // Filter by kelas jika dipilih
    const kelasMap = {};
    allKelas.forEach(k => { kelasMap[k.id] = k.name; });

    let rows = Object.entries(rekapSiswa)
      .map(([studentId, rekap]) => ({
        studentId,
        ...rekap,
        ...studentMap[studentId],
        kelasNama: kelasMap[studentMap[studentId]?.class_id] || '—',
        total: (rekap.hadir || 0) + (rekap.sakit || 0) +
               (rekap.izin  || 0) + (rekap.alpha || 0),
        pct: 0,
      }))
      .filter(r => !kelasId || r.class_id === kelasId)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Hitung persentase kehadiran
    rows = rows.map(r => ({
      ...r,
      pct: r.total > 0 ? Math.round((r.hadir / r.total) * 100) : 0,
    }));

    // Render summary
    const totalSiswa  = rows.length;
    const rataHadir   = rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length)
      : 0;

    document.getElementById('summaryRekapSiswa').innerHTML = `
      <div class="rekap-summary-grid">
        <div class="rekap-stat">
          <div class="rekap-stat-val">${totalSiswa}</div>
          <div class="rekap-stat-label">Total Siswa</div>
        </div>
        <div class="rekap-stat">
          <div class="rekap-stat-val" style="color:var(--green-mid)">${rataHadir}%</div>
          <div class="rekap-stat-label">Rata-rata Hadir</div>
        </div>
        <div class="rekap-stat">
          <div class="rekap-stat-val">${tanggalSet.size}</div>
          <div class="rekap-stat-label">Hari Tercatat</div>
        </div>
      </div>
    `;

    // Render tabel
    if (rows.length === 0) {
      document.getElementById('tableSiswa').innerHTML =
        `<div class="empty-rekap">Tidak ada data untuk filter yang dipilih.</div>`;
    } else {
      document.getElementById('tableSiswa').innerHTML = `
        <div class="table-wrap">
          <table class="data-table rekap-table">
            <thead>
              <tr>
                <th>Nama Siswa</th>
                <th>Kelas</th>
                <th style="color:#2d6a4f">Hadir</th>
                <th style="color:#e67e22">Sakit</th>
                <th style="color:#2980b9">Izin</th>
                <th style="color:#c0392b">Alpha</th>
                <th>Total</th>
                <th>% Hadir</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td class="student-name">${r.name || r.studentId}</td>
                  <td>${r.kelasNama}</td>
                  <td class="text-center"><strong style="color:#2d6a4f">${r.hadir}</strong></td>
                  <td class="text-center"><strong style="color:#e67e22">${r.sakit || 0}</strong></td>
                  <td class="text-center"><strong style="color:#2980b9">${r.izin  || 0}</strong></td>
                  <td class="text-center"><strong style="color:#c0392b">${r.alpha || 0}</strong></td>
                  <td class="text-center">${r.total}</td>
                  <td>
                    <div class="pct-bar-wrap">
                      <div class="pct-bar" style="width:${r.pct}%;background:${r.pct >= 75 ? '#40916c' : r.pct >= 50 ? '#e67e22' : '#c0392b'}"></div>
                      <span class="pct-label">${r.pct}%</span>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

  } catch (err) {
    console.error('[loadRekapSiswa] Error:', err);
    document.getElementById('tableSiswa').innerHTML =
      `<div class="empty-rekap error-text">Gagal memuat data. Coba lagi.</div>`;
  } finally {
    showLoading('loadingSiswa', false);
  }
};

// ============================================================
// B. REKAP ABSENSI GURU
// Sumber: subject_attendance
// ============================================================
window.loadRekapGuru = async function() {
  const bulan  = document.getElementById('filterBulanGuru').value;
  const guruId = document.getElementById('filterGuru')?.value || '';

  if (!bulan) {
    showToast('Pilih bulan terlebih dahulu.', 'error');
    return;
  }

  const [year, month] = bulan.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate   = new Date(year, month, 1);

  showLoading('loadingGuru', true);
  document.getElementById('tableGuru').innerHTML = '';
  document.getElementById('summaryRekapGuru').innerHTML = '';

  try {
    // Bangun query
    const constraints = [
      where('tanggal', '>=', Timestamp.fromDate(startDate)),
      where('tanggal', '<',  Timestamp.fromDate(endDate)),
      orderBy('tanggal'),
    ];

    // Guru hanya lihat milik sendiri
    if (currentRole === 'guru') {
      constraints.unshift(where('teacher_uid', '==', currentUid));
    } else if (guruId) {
      constraints.unshift(where('teacher_uid', '==', guruId));
    }

    const snap = await getDocs(
      query(collection(db, 'subject_attendance'), ...constraints)
    );

    if (snap.empty) {
      document.getElementById('tableGuru').innerHTML =
        `<div class="empty-rekap">Tidak ada data absensi mapel untuk bulan ini.</div>`;
      showLoading('loadingGuru', false);
      return;
    }

    // Kumpulkan per guru
    const rekapGuru = {};
    // { teacher_uid: { name, totalJam, totalSesi, hadir, izin, sakit, mapelList } }

    // Fetch nama guru & mapel & kelas
    const teacherIds = [...new Set(snap.docs.map(d => d.data().teacher_uid))];
    const teacherMap = {};
    await Promise.all(teacherIds.map(async id => {
      const d = await getDoc(doc(db, 'users', id));
      if (d.exists()) teacherMap[id] = d.data().name;
    }));

    const subjectIds = [...new Set(snap.docs.map(d => d.data().subject_id))];
    const subjectMap = {};
    await Promise.all(subjectIds.map(async id => {
      const d = await getDoc(doc(db, 'subjects', id));
      if (d.exists()) subjectMap[id] = d.data().name;
    }));

    const classMap = {};
    allKelas.forEach(k => { classMap[k.id] = k.name; });

    snap.forEach(d => {
      const data       = d.data();
      const uid        = data.teacher_uid;
      const statusGuru = data.status_guru || 'hadir';

      if (!rekapGuru[uid]) {
        rekapGuru[uid] = {
          name     : teacherMap[uid] || uid,
          totalJam : 0,
          totalSesi: 0,
          hadir    : 0,
          izin     : 0,
          sakit    : 0,
          detail   : [],
        };
      }

      rekapGuru[uid].totalJam  += data.jumlah_jam || 0;
      rekapGuru[uid].totalSesi += 1;
      rekapGuru[uid][statusGuru] = (rekapGuru[uid][statusGuru] || 0) + 1;

      rekapGuru[uid].detail.push({
        tanggal    : formatTanggalID(data.tanggal),
        mapel      : subjectMap[data.subject_id] || '—',
        kelas      : classMap[data.class_id]     || '—',
        jam        : data.jam_pelajaran?.join(', ') || '—',
        jumlahJam  : data.jumlah_jam || 0,
        statusGuru,
      });
    });

    const rows = Object.values(rekapGuru).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // Summary
    const totalJamKeseluruhan = rows.reduce((s, r) => s + r.totalJam, 0);
    document.getElementById('summaryRekapGuru').innerHTML = `
      <div class="rekap-summary-grid">
        <div class="rekap-stat">
          <div class="rekap-stat-val">${rows.length}</div>
          <div class="rekap-stat-label">Total Guru</div>
        </div>
        <div class="rekap-stat">
          <div class="rekap-stat-val" style="color:var(--green-mid)">${totalJamKeseluruhan}</div>
          <div class="rekap-stat-label">Total Jam Mengajar</div>
        </div>
      </div>
    `;

    // Render tabel guru
    document.getElementById('tableGuru').innerHTML = `
      <div class="table-wrap">
        <table class="data-table rekap-table">
          <thead>
            <tr>
              <th>Nama Guru</th>
              <th class="text-center">Sesi Mengajar</th>
              <th class="text-center" style="color:var(--green-mid)">Total Jam</th>
              <th class="text-center" style="color:#2d6a4f">Hadir</th>
              <th class="text-center" style="color:#2980b9">Izin</th>
              <th class="text-center" style="color:#e67e22">Sakit</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, idx) => `
              <tr>
                <td class="student-name">${r.name}</td>
                <td class="text-center">${r.totalSesi}</td>
                <td class="text-center">
                  <strong style="color:var(--green-mid);font-size:15px">${r.totalJam}</strong>
                  <span style="font-size:11px;color:var(--text-soft)"> JP</span>
                </td>
                <td class="text-center"><strong style="color:#2d6a4f">${r.hadir || 0}</strong></td>
                <td class="text-center"><strong style="color:#2980b9">${r.izin  || 0}</strong></td>
                <td class="text-center"><strong style="color:#e67e22">${r.sakit || 0}</strong></td>
                <td>
                  <button class="btn-detail" onclick="toggleDetail(${idx})">
                    Lihat ▾
                  </button>
                </td>
              </tr>
              <tr class="detail-row" id="detail-${idx}" style="display:none">
                <td colspan="7" style="padding:0">
                  <div class="detail-wrap">
                    <table class="data-table" style="font-size:12px">
                      <thead>
                        <tr>
                          <th>Tanggal</th>
                          <th>Mapel</th>
                          <th>Kelas</th>
                          <th>Jam ke-</th>
                          <th class="text-center">Jumlah Jam</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${r.detail.map(d => `
                          <tr>
                            <td>${d.tanggal}</td>
                            <td>${d.mapel}</td>
                            <td>${d.kelas}</td>
                            <td>${d.jam}</td>
                            <td class="text-center"><strong>${d.jumlahJam}</strong></td>
                            <td>${statusBadge(d.statusGuru)}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

  } catch (err) {
    console.error('[loadRekapGuru] Error:', err);
    document.getElementById('tableGuru').innerHTML =
      `<div class="empty-rekap error-text">Gagal memuat data. Coba lagi.</div>`;
  } finally {
    showLoading('loadingGuru', false);
  }
};

// ============================================================
// ACTION: Toggle detail baris guru
// ============================================================
window.toggleDetail = function(idx) {
  const row = document.getElementById(`detail-${idx}`);
  if (!row) return;
  const isShown = row.style.display !== 'none';
  row.style.display = isShown ? 'none' : 'table-row';
};

// ============================================================
// HELPER: Show/hide loading
// ============================================================
function showLoading(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? 'flex' : 'none';
}

// ============================================================
// HELPER: Set bulan default = bulan ini
// ============================================================
function setDefaultBulan() {
  const now   = new Date();
  const bulan = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const el1   = document.getElementById('filterBulanSiswa');
  const el2   = document.getElementById('filterBulanGuru');
  if (el1) el1.value = bulan;
  if (el2) el2.value = bulan;
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
// HELPER: Set innerHTML
// ============================================================
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = val;
}

// ============================================================
// MAIN
// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const { role, name } = getSession();
  currentRole = role;
  currentUid  = user.uid;

  setEl('user-display-name', name);
  setEl('user-display-role', labelRole(role));
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  setEl('sidebarAvatar', initial);
  setEl('topbarAvatar',  initial);

  // Guru hanya bisa lihat tab rekap guru
  if (role === 'guru') {
    document.getElementById('tabSiswa')?.setAttribute('style', 'display:none');
    switchTab('guru');
  }

  // Sembunyikan filter guru jika role guru
  if (role === 'guru') {
    const filterGuruWrap = document.getElementById('filterGuruWrap');
    if (filterGuruWrap) filterGuruWrap.style.display = 'none';
  }

  setDefaultBulan();
  await loadMasterData();
});

function labelRole(role) {
  const map = {
    admin: 'Administrator', kepsek: 'Kepala Sekolah',
    guru : 'Guru',          tu    : 'Tata Usaha',
    kantin: 'Kantin',       ortu  : 'Orang Tua',
  };
  return map[role] || role;
}

// Fix: limit import yang belum ada
