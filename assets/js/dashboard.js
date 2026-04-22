// ============================================================
// dashboard.js
// Logika utama dashboard — menampilkan konten sesuai role
// ============================================================

import { auth, getToken }          from './firebase-config.js';
import { guardPage, getSession, logout } from './auth-guard.js';
import { onAuthStateChanged }       from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore,
         collection,
         query,
         where,
         getDocs,
         onSnapshot,
         doc,
         getDoc,
         orderBy,
         limit }                   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const db = getFirestore();
guardPage([]);

const CF_BASE_URL = 'https://us-central1-er-arrofii.cloudfunctions.net/api';

async function apiFetch(endpoint, method = 'GET', body = null) {
  const token = await getToken();
  const opts  = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type' : 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(`${CF_BASE_URL}${endpoint}`, opts);
  return await res.json();
}

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', {
    style   : 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(angka);
}

function formatTanggal(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat('id-ID', {
    day  : 'numeric',
    month: 'long',
    year : 'numeric',
  }).format(date);
}

// [FIX] Tambah null/undefined guard untuk dueDate
function getStatusTagihan(status, dueDate) {
  if (status === 'lunas') return 'lunas';
  if (!dueDate) return 'belum-bayar'; // [FIX] guard dueDate null
  const now      = new Date();
  const due      = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
  const diffHari = Math.floor((now - due) / (1000 * 60 * 60 * 24));
  if (diffHari > 30) return 'tunggakan';
  if (diffHari > 0)  return 'telat-30';
  return 'belum-bayar';
}

function hideAllSections() {
  document.querySelectorAll('.role-section').forEach(el => {
    el.style.display = 'none';
  });
}

// Kepsek dan admin menggunakan section yang sama.
const SECTION_MAP = { kepsek: 'admin' };

function showSection(role) {
  const sectionId = SECTION_MAP[role] || role;
  const section   = document.getElementById(`section-${sectionId}`);
  if (section) {
    section.style.display = 'block';
  } else {
    console.warn(`[dashboard] Section untuk role "${role}" tidak ditemukan.`);
  }
}

// ============================================================
// RENDER: ADMIN
// ============================================================
async function renderAdmin() {
  try {
    const studentsSnap = await getDocs(collection(db, 'students'));
    setEl('admin-total-siswa', studentsSnap.size);

    const guruSnap = await getDocs(
      query(collection(db, 'users'), where('role', '==', 'guru'))
    );
    setEl('admin-total-guru', guruSnap.size);

    const billingSnap = await getDocs(
      query(collection(db, 'billing'), where('status', '==', 'belum_bayar'))
    );
    setEl('admin-tagihan-pending', billingSnap.size);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const txSnap = await getDocs(
      query(
        collection(db, 'pos_transactions'),
        where('timestamp', '>=', startOfDay),
        orderBy('timestamp', 'desc')
      )
    );
    let totalTxHariIni = 0;
    txSnap.forEach(d => { totalTxHariIni += d.data().nominal || 0; });
    setEl('admin-tx-hari-ini', formatRupiah(totalTxHariIni));

  } catch (err) {
    console.error('[renderAdmin] Error:', err);
  }
}

// ============================================================
// RENDER: KEPSEK
// Kepsek memakai section-admin (SECTION_MAP), sehingga cukup
// panggil renderAdmin() untuk data bersama, lalu tambahkan
// stat eksklusif kepsek (nilai draft) dan tampilkan card-nya.
// ============================================================
async function renderKepsek() {
  try {
    // Set judul sesuai role kepsek
    setEl('admin-page-title',    'Dashboard Kepala Sekolah');
    setEl('admin-page-subtitle', 'Monitoring akademik & keuangan');

    // Render semua stat yang sama dengan admin
    await renderAdmin();

    // Tambahan eksklusif kepsek: nilai masih draft
    const draftSnap = await getDocs(
      query(collection(db, 'grades'), where('status', '==', 'draft'))
    );
    setEl('admin-nilai-draft', draftSnap.size);

    // Tampilkan stat card nilai draft (hidden by default)
    const draftCard = document.getElementById('kepsek-card-nilai-draft');
    if (draftCard) draftCard.style.display = '';

  } catch (err) {
    console.error('[renderKepsek] Error:', err);
  }
}

// ============================================================
// RENDER: GURU
// ============================================================
async function renderGuru(uid) {
  try {
    const tsSnap = await getDocs(
      query(
        collection(db, 'teacher_subjects'),
        where('teacher_uid', '==', uid)
      )
    );

    if (tsSnap.empty) {
      setEl('guru-kelas-list', '<p class="empty-state">Belum ada kelas yang ditugaskan.</p>');
      return;
    }

    const kelasMapel = [];
    const classIds   = new Set();
    const subjectIds = new Set();

    tsSnap.forEach(d => {
      kelasMapel.push(d.data());
      classIds.add(d.data().class_id);
      subjectIds.add(d.data().subject_id);
    });

    const classMap = {};
    for (const id of classIds) {
      const snap = await getDoc(doc(db, 'classes', id));
      if (snap.exists()) classMap[id] = snap.data().name;
    }

    const subjectMap = {};
    for (const id of subjectIds) {
      const snap = await getDoc(doc(db, 'subjects', id));
      if (snap.exists()) subjectMap[id] = snap.data().name;
    }

    const rows = kelasMapel.map(item => `
      <tr>
        <td>${classMap[item.class_id]   || item.class_id}</td>
        <td>${subjectMap[item.subject_id] || item.subject_id}</td>
        <td>${item.tahun_ajaran}</td>
        <td>Semester ${item.semester}</td>
        <td>
          <a href="input-nilai.html?class=${item.class_id}&subject=${item.subject_id}"
             class="btn-action">Input Nilai</a>
        </td>
      </tr>
    `).join('');

    setEl('guru-kelas-list', `
      <table class="data-table">
        <thead>
          <tr>
            <th>Kelas</th>
            <th>Mata Pelajaran</th>
            <th>Tahun Ajaran</th>
            <th>Semester</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `);

  } catch (err) {
    console.error('[renderGuru] Error:', err);
  }
}

// ============================================================
// RENDER: TU
// ============================================================
async function renderTU(uid) {
  try {
    const suratSnap = await getDocs(
      query(
        collection(db, 'letters'),
        orderBy('tanggal', 'desc'),
        limit(10)
      )
    );

    if (suratSnap.empty) {
      setEl('tu-surat-list', '<p class="empty-state">Belum ada surat.</p>');
    } else {
      const rows = suratSnap.docs.map(d => {
        const s = d.data();
        return `
          <tr>
            <td>${s.nomor_surat || '-'}</td>
            <td>${s.jenis}</td>
            <td>${s.perihal}</td>
            <td>${formatTanggal(s.tanggal)}</td>
            <td><span class="badge badge-${s.status}">${s.status}</span></td>
          </tr>
        `;
      }).join('');

      setEl('tu-surat-list', `
        <table class="data-table">
          <thead>
            <tr>
              <th>Nomor Surat</th>
              <th>Jenis</th>
              <th>Perihal</th>
              <th>Tanggal</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `);
    }

    const billingSnap = await getDocs(
      query(collection(db, 'billing'), where('status', '==', 'belum_bayar'))
    );
    setEl('tu-tagihan-pending', billingSnap.size);

  } catch (err) {
    console.error('[renderTU] Error:', err);
  }
}

// ============================================================
// RENDER: KANTIN
// ============================================================
function renderKantin() {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'pos_transactions'),
      where('timestamp', '>=', startOfDay),
      orderBy('timestamp', 'desc')
    );

    onSnapshot(q, async (snap) => {
      let totalHariIni = 0;
      const studentIds = new Set();

      snap.forEach(d => {
        totalHariIni += d.data().nominal || 0;
        studentIds.add(d.data().student_id);
      });

      setEl('kantin-total-hari-ini', formatRupiah(totalHariIni));
      setEl('kantin-jumlah-tx', snap.size);

      if (snap.empty) {
        setEl('kantin-tx-list', '<p class="empty-state">Belum ada transaksi hari ini.</p>');
        return;
      }

      const studentMap = {};
      for (const id of studentIds) {
        const sSnap = await getDoc(doc(db, 'students', id));
        if (sSnap.exists()) studentMap[id] = sSnap.data().name;
      }

      const rows = snap.docs.map(d => {
        const tx = d.data();
        const waktu = tx.timestamp?.toDate
          ? tx.timestamp.toDate().toLocaleTimeString('id-ID')
          : '-';
        return `
          <tr>
            <td>${waktu}</td>
            <td>${studentMap[tx.student_id] || tx.student_id}</td>
            <td>${formatRupiah(tx.nominal)}</td>
            <td>${tx.keterangan || '-'}</td>
          </tr>
        `;
      }).join('');

      setEl('kantin-tx-list', `
        <table class="data-table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Siswa</th>
              <th>Nominal</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `);
    });

  } catch (err) {
    console.error('[renderKantin] Error:', err);
  }
}

// ============================================================
// RENDER: ORTU
// ============================================================
async function renderOrtu() {
  try {
    const { uid } = getSession();

    const parentDoc = await getDoc(doc(db, 'users', uid));
    if (!parentDoc.exists()) return;

    const studentIds = parentDoc.data().student_ids || [];
    if (studentIds.length === 0) {
      setEl('ortu-children-list', '<p class="empty-state">Tidak ada data anak terdaftar.</p>');
      return;
    }

    let html = '';

    for (const studentId of studentIds) {
      const studentDoc = await getDoc(doc(db, 'students', studentId));
      if (!studentDoc.exists()) continue;

      const siswa = studentDoc.data();

      const billingSnap = await getDocs(
        query(
          collection(db, 'billing'),
          where('student_id', '==', studentId)
        )
      );

      const tagihanRows = billingSnap.docs.map(d => {
        const b      = d.data();
        const status = getStatusTagihan(b.status, b.due_date);
        return `
          <tr>
            <td>${b.jenis_tagihan}</td>
            <td>${formatRupiah(b.nominal)}</td>
            <td>${formatTanggal(b.due_date)}</td>
            <td><span class="status-${status}">${labelStatus(status)}</span></td>
          </tr>
        `;
      }).join('');

      html += `
        <div class="student-card">
          <div class="student-card-header">
            <h3>${siswa.name}</h3>
            <div class="student-meta">
              <span>${siswa.jenjang} — ${siswa.program}</span>
              <span class="saldo-badge">
                Saldo Jajan: <strong>${formatRupiah(siswa.saldo_jajan)}</strong>
              </span>
            </div>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Tagihan</th>
                <th>Nominal</th>
                <th>Jatuh Tempo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tagihanRows || '<tr><td colspan="4">Tidak ada tagihan.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    }

    setEl('ortu-children-list', html);

  } catch (err) {
    console.error('[renderOrtu] Error:', err);
  }
}

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value;
}

function labelStatus(status) {
  const map = {
    'lunas'     : 'Lunas',
    'telat-30'  : 'Terlambat',
    'tunggakan' : 'Tunggakan',
    'belum-bayar': 'Belum Bayar',
  };
  return map[status] || status;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const { role, name, uid } = getSession();

  setEl('user-display-name', name);
  setEl('user-display-role', labelRole(role));

  hideAllSections();
  showSection(role);

  switch (role) {
    case 'admin'  : await renderAdmin();       break;
    case 'kepsek' : await renderKepsek();      break;
    case 'guru'   : await renderGuru(uid);     break;
    case 'tu'     : await renderTU(uid);       break;
    case 'kantin' :       renderKantin();      break;
    case 'ortu'   : await renderOrtu();        break;
    default:
      console.warn('[dashboard] Role tidak dikenali:', role);
  }
});

function labelRole(role) {
  const map = {
    admin  : 'Administrator',
    kepsek : 'Kepala Sekolah',
    guru   : 'Guru',
    tu     : 'Tata Usaha',
    kantin : 'Kantin',
    ortu   : 'Orang Tua',
  };
  return map[role] || role;
}

export { logout, apiFetch, formatRupiah, formatTanggal };
