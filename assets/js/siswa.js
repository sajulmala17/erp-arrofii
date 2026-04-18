// ============================================================
// siswa.js
// Logika halaman Data Siswa
// Fitur:
//   - Daftar siswa dengan filter jenjang, kelas, program
//   - Tambah siswa baru (admin & tu)
//   - Edit data siswa (admin & tu)
//   - Nonaktifkan siswa (admin & tu)
//   - Set/Reset PIN siswa via Cloud Function
// ============================================================

import { auth, getToken }               from './firebase-config.js';
import { guardPage, getSession }        from './auth-guard.js';
import { onAuthStateChanged }           from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore,
         collection,
         query,
         where,
         getDocs,
         getDoc,
         addDoc,
         updateDoc,
         doc,
         serverTimestamp,
         orderBy }                      from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ============================================================
// INISIALISASI
// ============================================================
const db = getFirestore();
guardPage(['admin', 'kepsek', 'guru', 'tu']);

const CF_BASE_URL = 'https://us-central1-er-arrofii.cloudfunctions.net/api';

// State
let allSiswa   = [];
let allKelas   = [];
let currentRole = '';
let editingId   = null; // student_id yang sedang diedit

// ============================================================
// HELPER: Fetch Cloud Functions dengan token
// ============================================================
async function apiFetch(endpoint, method = 'POST', body = null) {
  const token = await getToken();
  const res   = await fetch(`${CF_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type' : 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
  });
  return await res.json();
}

// ============================================================
// HELPER: Generate student_id otomatis
// Format: STD-[tahun][random 4 digit]
// ============================================================
function generateStudentId() {
  const year   = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `STD-${year}${random}`;
}

// ============================================================
// LOAD: Ambil semua kelas dari Firestore
// ============================================================
async function loadKelas() {
  const snap = await getDocs(
    query(collection(db, 'classes'), orderBy('name'))
  );
  allKelas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Populate select kelas di form
  const selKelas = document.getElementById('formKelas');
  selKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>' +
    allKelas.map(k =>
      `<option value="${k.class_id || k.id}">${k.name} (${k.jenjang})</option>`
    ).join('');
}

// ============================================================
// LOAD: Ambil semua siswa dari Firestore
// ============================================================
async function loadSiswa() {
  showTableLoading();
  try {
    const snap = await getDocs(
      query(collection(db, 'students'), orderBy('name'))
    );
    allSiswa = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    applyFilter();
  } catch (err) {
    console.error('[loadSiswa] Error:', err);
    showTableError('Gagal memuat data siswa.');
  }
}

// ============================================================
// FILTER & RENDER TABEL
// ============================================================
function applyFilter() {
  const filterJenjang  = document.getElementById('filterJenjang').value;
  const filterKelas    = document.getElementById('filterKelas').value;
  const filterProgram  = document.getElementById('filterProgram').value;
  const filterStatus   = document.getElementById('filterStatus').value;
  const filterSearch   = document.getElementById('filterSearch').value.toLowerCase();

  let filtered = allSiswa.filter(s => {
    if (filterJenjang && s.jenjang   !== filterJenjang)  return false;
    if (filterKelas   && s.class_id  !== filterKelas)    return false;
    if (filterProgram && s.program   !== filterProgram)  return false;
    if (filterStatus === 'aktif'    && s.aktif === false) return false;
    if (filterStatus === 'nonaktif' && s.aktif !== false) return false;
    if (filterSearch  && !s.name.toLowerCase().includes(filterSearch) &&
        !s.student_id.toLowerCase().includes(filterSearch))           return false;
    return true;
  });

  renderTable(filtered);
  document.getElementById('totalCount').textContent = `${filtered.length} siswa`;
}

// ============================================================
// RENDER: Tabel siswa (desktop) + Cards (mobile)
// ============================================================
function renderTable(data) {
  const canEdit = ['admin', 'tu'].includes(currentRole);

  // === DESKTOP TABLE ===
  if (data.length === 0) {
    document.getElementById('tableBody').innerHTML =
      `<tr><td colspan="7" class="empty-cell">Tidak ada data siswa.</td></tr>`;
    document.getElementById('cardList').innerHTML =
      `<div class="empty-state">Tidak ada data siswa.</div>`;
    return;
  }

  // Cari nama kelas dari allKelas
  const kelasMap = {};
  allKelas.forEach(k => { kelasMap[k.class_id || k.id] = k.name; });

  const rows = data.map(s => {
    const statusBadge = s.aktif === false
      ? '<span class="badge badge-nonaktif">Nonaktif</span>'
      : '<span class="badge badge-aktif">Aktif</span>';

    const aksiHtml = canEdit ? `
      <div class="aksi-wrap">
        <button class="btn-aksi edit"   onclick="openEdit('${s.student_id}')">Edit</button>
        <button class="btn-aksi pin"    onclick="openPin('${s.student_id}', '${s.name}')">PIN</button>
        ${s.aktif !== false
          ? `<button class="btn-aksi nonaktif" onclick="toggleAktif('${s.student_id}', false)">Nonaktifkan</button>`
          : `<button class="btn-aksi aktif"    onclick="toggleAktif('${s.student_id}', true)">Aktifkan</button>`
        }
      </div>` : '—';

    return `
      <tr class="${s.aktif === false ? 'row-nonaktif' : ''}">
        <td><span class="student-id">${s.nisn}</span></td>
        <td>${s.tahun_ajaran}</td>
	<td class="student-name">${s.name}</td>
        <td>${s.gender === 'L' ? '👦 Laki-laki' : '👧 Perempuan'}</td>
        <td>${kelasMap[s.class_id] || s.class_id || '—'}</td>
        <td>${statusBadge}</td>
        <td>${aksiHtml}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('tableBody').innerHTML = rows;

  // === MOBILE CARDS ===
  const cards = data.map(s => {
    const kelasNama = kelasMap[s.class_id] || s.class_id || '—';
    const statusBadge = s.aktif === false
      ? '<span class="badge badge-nonaktif">Nonaktif</span>'
      : '<span class="badge badge-aktif">Aktif</span>';

    return `
      <div class="siswa-card ${s.aktif === false ? 'card-nonaktif' : ''}">
        <div class="siswa-card-head">
          <div class="siswa-card-avatar ${s.gender === 'L' ? 'male' : 'female'}">
            ${s.name.charAt(0).toUpperCase()}
          </div>
          <div class="siswa-card-info">
            <div class="siswa-card-name">${s.name}</div>
            <div class="siswa-card-meta">${s.student_id} · ${kelasNama}</div>
          </div>
          ${statusBadge}
        </div>
        <div class="siswa-card-body">
	<div class="siswa-card-row">
            <span>Jenjang</span><span>${s.jenjang || '—'}</span>
          </div>
          <div class="siswa-card-row">
            <span>Angkatan</span><span>${s.tahun_ajaran || '—'}</span>
          </div>
          <div class="siswa-card-row">
            <span>Saldo Jajan</span>
            <span class="saldo-text">
              ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(s.saldo_jajan || 0)}
            </span>
          </div>
        </div>
        ${canEdit ? `
        <div class="siswa-card-foot">
          <button class="btn-aksi edit"    onclick="openEdit('${s.student_id}')">Edit</button>
          <button class="btn-aksi pin"     onclick="openPin('${s.student_id}', '${s.name}')">Set PIN</button>
          ${s.aktif !== false
            ? `<button class="btn-aksi nonaktif" onclick="toggleAktif('${s.student_id}', false)">Nonaktifkan</button>`
            : `<button class="btn-aksi aktif"    onclick="toggleAktif('${s.student_id}', true)">Aktifkan</button>`
          }
        </div>` : ''}
      </div>
    `;
  }).join('';

  document.getElementById('cardList').innerHTML = cards;
}

// ============================================================
// MODAL: Buka form tambah siswa
// ============================================================
window.openTambah = function () {
  editingId = null;
  document.getElementById('modalTitle').textContent   = 'Tambah Siswa Baru';
  document.getElementById('btnSubmitForm').textContent = 'Simpan';
  document.getElementById('siswaForm').reset();
  document.getElementById('formStudentId').value = generateStudentId();
  document.getElementById('pinSection').style.display = 'block';
  openModal('modalSiswa');
};

// ============================================================
// MODAL: Buka form edit siswa
// ============================================================
window.openEdit = function (studentId) {
  const siswa = allSiswa.find(s => s.student_id === studentId);
  if (!siswa) return;

  editingId = studentId;
  document.getElementById('modalTitle').textContent    = 'Edit Data Siswa';
  document.getElementById('btnSubmitForm').textContent = 'Update';
  document.getElementById('pinSection').style.display  = 'none'; // PIN diset terpisah

  // Isi form
  document.getElementById('formStudentId').value = siswa.student_id;
  document.getElementById('formNisn').value      = siswa.nisn || '';
  document.getElementById('formNama').value       = siswa.name;
  document.getElementById('formTahunAjaran').value = siswa.tahun_ajaran || '';
  document.getElementById('formGender').value     = siswa.gender;
  document.getElementById('formKelas').value      = siswa.class_id;
  document.getElementById('formJenjang').value    = siswa.jenjang;
  document.getElementById('formProgram').value    = siswa.program || '';
  document.getElementById('formKamar').value      = siswa.kamar || '';
  document.getElementById('formSaldo').value      = siswa.saldo_jajan || 0;

  openModal('modalSiswa');
};

// ============================================================
// MODAL: Buka form set PIN
// ============================================================
window.openPin = function (studentId, name) {
  document.getElementById('pinStudentId').value    = studentId;
  document.getElementById('pinStudentName').textContent = name;
  document.getElementById('inputPin').value        = '';
  document.getElementById('inputPinConfirm').value = '';
  document.getElementById('pinError').textContent  = '';
  openModal('modalPin');
};

// ============================================================
// MODAL: Toggle aktif/nonaktif siswa
// ============================================================
window.toggleAktif = async function (studentId, aktif) {
  const label = aktif ? 'mengaktifkan' : 'menonaktifkan';
  if (!confirm(`Yakin ingin ${label} siswa ini?`)) return;

  try {
    await updateDoc(doc(db, 'students', studentId), {
      aktif,
      updated_at: serverTimestamp(),
    });
    showToast(`Siswa berhasil di${aktif ? 'aktifkan' : 'nonaktifkan'}.`, 'success');
    await loadSiswa();
  } catch (err) {
    console.error('[toggleAktif] Error:', err);
    showToast('Gagal mengubah status siswa.', 'error');
  }
};

// ============================================================
// SUBMIT: Form tambah/edit siswa
// ============================================================
document.getElementById('siswaForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const studentId = document.getElementById('formStudentId').value.trim();
  const nisn      = document.getElementById('formNisn')?.value.trim() || '';
  const tahunAjaran = document.getElementById('formTahunAjaran')?.value.trim();
  const nama      = document.getElementById('formNama').value.trim();
  const gender    = document.getElementById('formGender').value;
  const classId   = document.getElementById('formKelas').value;
  const jenjang   = document.getElementById('formJenjang').value;
  const program   = document.getElementById('formProgram').value.trim();
  const kamar     = document.getElementById('formKamar')?.value.trim() || '';
  const saldo     = Number(document.getElementById('formSaldo').value) || 0;
  const pin       = document.getElementById('formPin')?.value;

  // Validasi NISN: maksimal 10 digit angka (opsional)
  if (nisn && (!/^\d{1,10}$/.test(nisn))) {
      alert('NISN harus terdiri dari 1-10 digit angka.');
      return;
  }
  // Validasi
  if (!nisn || !tahun_ajaran || !nama || !gender || !classId || !jenjang) {
    showToast('Lengkapi semua field yang wajib diisi.', 'error');
    return;
  }

  setBtnLoading('btnSubmitForm', true);

  try {
    if (editingId) {
      // === UPDATE ===
      await updateDoc(doc(db, 'students', editingId), {
        nisn,
	tahun_ajaran : tahunAjaran,
	name      : nama,
        gender,
        class_id  : classId,
        jenjang,
        program,
	kamar : kamar,
        saldo_jajan: saldo,
        updated_at: serverTimestamp(),
      });
      showToast('Data siswa berhasil diupdate.', 'success');

    } else {
      // === TAMBAH BARU ===
      // Cek PIN wajib untuk siswa baru
      if (!pin || String(pin).length !== 6 || isNaN(pin)) {
        showToast('PIN harus 6 digit angka.', 'error');
        setBtnLoading('btnSubmitForm', false);
        return;
      }

      // Simpan ke Firestore (pin_hash diset via Cloud Function)
      await addDoc(collection(db, 'students'), {
        student_id  : studentId,
        nisn,
	tahun_ajaran : tahunAjaran,
	name        : nama,
        gender,
        class_id    : classId,
        jenjang,
        program,
	kamar       : kamar,
        saldo_jajan : saldo,
        pin_hash    : '', // sementara kosong, langsung diset di bawah
        parent_uid  : '',
        aktif       : true,
        created_at  : serverTimestamp(),
      });

      // Set PIN via Cloud Function
      const pinResult = await apiFetch('/setStudentPin', 'POST', {
        student_id: studentId,
        pin,
      });

      if (pinResult.error) {
        showToast(`Siswa tersimpan tapi PIN gagal diset: ${pinResult.error}`, 'error');
      } else {
        showToast('Siswa baru berhasil ditambahkan.', 'success');
      }
    }

    closeModal('modalSiswa');
    await loadSiswa();

  } catch (err) {
    console.error('[submitSiswa] Error:', err);
    showToast('Terjadi kesalahan. Coba lagi.', 'error');
  } finally {
    setBtnLoading('btnSubmitForm', false);
  }
});

// ============================================================
// SUBMIT: Form set PIN
// ============================================================
document.getElementById('pinForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const studentId  = document.getElementById('pinStudentId').value;
  const pin        = document.getElementById('inputPin').value;
  const pinConfirm = document.getElementById('inputPinConfirm').value;
  const errEl      = document.getElementById('pinError');

  errEl.textContent = '';

  if (String(pin).length !== 6 || isNaN(pin)) {
    errEl.textContent = 'PIN harus 6 digit angka.';
    return;
  }

  if (pin !== pinConfirm) {
    errEl.textContent = 'Konfirmasi PIN tidak cocok.';
    return;
  }

  setBtnLoading('btnSubmitPin', true);

  try {
    const result = await apiFetch('/setStudentPin', 'POST', { student_id: studentId, pin });

    if (result.error) {
      errEl.textContent = result.error;
    } else {
      showToast('PIN berhasil diset.', 'success');
      closeModal('modalPin');
    }
  } catch (err) {
    errEl.textContent = 'Gagal menghubungi server.';
  } finally {
    setBtnLoading('btnSubmitPin', false);
  }
});

// ============================================================
// FILTER: Event listeners
// ============================================================
['filterJenjang','filterKelas','filterProgram',
 'filterStatus','filterSearch'].forEach(id => {
  document.getElementById(id)?.addEventListener('input',  applyFilter);
  document.getElementById(id)?.addEventListener('change', applyFilter);
});

document.getElementById('btnReset').addEventListener('click', () => {
  ['filterJenjang','filterKelas','filterProgram',
   'filterStatus','filterSearch'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  applyFilter();
});

// ============================================================
// HELPER: Modal open/close
// ============================================================
function openModal(id) {
  document.getElementById(id).classList.add('show');
  document.body.style.overflow = 'hidden';
}

window.closeModal = function (id) {
  document.getElementById(id).classList.remove('show');
  document.body.style.overflow = '';
};

// Tutup modal klik backdrop
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal.id);
  });
});

// ============================================================
// HELPER: Loading state tombol
// ============================================================
function setBtnLoading(id, isLoading) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled     = isLoading;
  btn.textContent  = isLoading ? 'Menyimpan...' : btn.dataset.label || btn.textContent;
}

// ============================================================
// HELPER: Toast notification
// ============================================================
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent  = msg;
  toast.className    = `toast show ${type}`;
  setTimeout(() => { toast.className = 'toast'; }, 3500);
}

// ============================================================
// HELPER: Loading & error state tabel
// ============================================================
function showTableLoading() {
  document.getElementById('tableBody').innerHTML =
    `<tr><td colspan="7" class="empty-cell">
      <div class="loading-dots"><span></span><span></span><span></span></div>
    </td></tr>`;
  document.getElementById('cardList').innerHTML =
    `<div class="empty-state">Memuat data...</div>`;
}

function showTableError(msg) {
  document.getElementById('tableBody').innerHTML =
    `<tr><td colspan="7" class="empty-cell error-text">${msg}</td></tr>`;
}

// ============================================================
// MAIN — Jalankan setelah auth siap
// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const { role, name } = getSession();
  currentRole = role;

  // Tampilkan nama user
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-display-role');
  if (nameEl) nameEl.textContent = name;
  if (roleEl) roleEl.textContent = labelRole(role);

  // Tampilkan/sembunyikan tombol tambah
  const btnTambah = document.getElementById('btnTambah');
  if (btnTambah) {
    btnTambah.style.display = ['admin','tu'].includes(role) ? 'flex' : 'none';
  }

  // Load data
  await loadKelas();
  await loadSiswa();
});

function labelRole(role) {
  const map = {
    admin: 'Administrator', kepsek: 'Kepala Sekolah',
    guru : 'Guru',          tu    : 'Tata Usaha',
    kantin: 'Kantin',       ortu  : 'Orang Tua',
  };
  return map[role] || role;
}
