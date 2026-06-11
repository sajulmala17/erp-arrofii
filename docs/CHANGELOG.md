# Changelog ERP Al-Arrofi

Format mengikuti standar di `AGENTS.md`.

---

## [2026-06-11 11:00] — Task: Guru Lihat Rekap Kehadiran Siswa dari Subject Attendance | Versi: 1.4.0
**Tipe:** ADD | **Agent:** Vibe-Coder | **Status:** ✅ Done

### Ringkasan
Guru sekarang bisa lihat rekap kehadiran siswa di tab "Absensi Siswa" dari data `subject_attendance` (absensi mapel yang guru input). Sebelumnya tab ini disembunyikan untuk guru. Admin/kepsek/tu tetap pakai `picket_attendance` (existing). Filter mapel & kelas dibatasi sesuai mata pelajaran yang diajar guru.

### File yang Dimodifikasi
| File | Perubahan |
| :--- | :--- |
| `assets/js/rekap-absensi.js` | Tambah state `teacherSubjects`, fungsi `loadTeacherSubjectsForRekap()`; `loadMasterData()` branch untuk guru (populate filter mapel & kelas terbatas); `loadRekapSiswa()` branch query — guru dari `subject_attendance` + filter mapel/kelas, non-guru tetap `picket_attendance`; `onAuthStateChanged` tampilkan tabSiswa untuk guru |
| `rekap-absensi.html` | Tambah filter "Mata Pelajaran" (`#filterMapelWrap`) di panelSiswa, hidden untuk non-guru |

### Keputusan Teknis
- **Branch query di loadRekapSiswa** — Satu fungsi dengan percabangan role lebih sederhana daripada duplikasi kode. Aggregation & render tetap identik untuk kedua sumber data
- **Filter mapel & kelas untuk guru** — Diambil dari `teacher_subjects` agar guru hanya melihat data yang relevan dengan mapel yang diajar; butuh composite index `[teacher_uid, subject_id, tanggal]` dan `[teacher_uid, class_id, tanggal]` di Firestore

### Checklist Guru Lihat Rekap Kehadiran Siswa ✅
- [x] Guru lihat tab "Absensi Siswa" (sebelumnya disembunyikan)
- [x] Filter Mapel muncul untuk guru, diisi dari teacher_subjects
- [x] Filter Kelas untuk guru hanya menampilkan kelas yg diajar
- [x] Query data dari `subject_attendance` by teacher_uid
- [x] Filter by mapel & kelas berfungsi untuk guru
- [x] Admin/kepsek/tu tidak terpengaruh (tetap `picket_attendance`)
- [x] Tabel & summary tampil sama untuk semua role

---

## [2026-06-11 10:30] — Task: Fix Absensi Mapel Render Gagal | Versi: 1.3.0
**Tipe:** FIX | **Agent:** Vibe-Coder | **Status:** ✅ Done

### Ringkasan
Perbaiki bug kritis di halaman absensi mapel: tombol jam pelajaran (1-8) dan daftar siswa tidak muncul setelah guru memilih mapel. Akar masalah: `loadExistingAbsensi()` tidak punya try/catch dan Firestore rules deny read untuk dokumen `subject_attendance` yang belum ada. Dampak: `renderAbsensiPanel()` tidak pernah dijalankan karena exception tidak tertangani.

### File yang Dimodifikasi
| File | Perubahan |
| :--- | :--- |
| `firestore.rules` | Pisah `read` jadi `get` + `list` untuk `subject_attendance`; `get` izinkan `resource == null` (doc belum ada) agar `getDoc` tidak 403 |
| `assets/js/absensi-mapel.js` | Tambah try/catch di `loadExistingAbsensi()` dan `selectMapel()`; pastikan `renderAbsensiPanel()` tetap jalan meski load data gagal |

### Keputusan Teknis
- **Split read rule** — Menggabung `get`+`list` dalam satu `read` rule menyebabkan `resource.data` diakses saat `resource == null`, yang selalu deny untuk doc baru. Pisah jadi `allow get` (izinkan null) dan `allow list` (cek ownership)
- **Try/catch di load vs caller** — Taruh try/catch di kedua level (fungsi load + pemanggil) agar error di salah satu load tidak memblokir load lain atau render

### Checklist Fix Absensi Mapel Render Gagal ✅
- [x] Tombol jam 1-8 muncul setelah klik mapel (first-time, belum ada absensi)
- [x] Daftar siswa muncul setelah klik mapel
- [x] Simpan absensi baru berhasil
- [x] Load absensi yang sudah ada (edit mode) tetap berfungsi
- [x] Ganti tanggal → pilih mapel → tetap muncul tombol & siswa

---

## [2026-06-11 10:00] — Task: Fix UI Mapel untuk Role Guru | Versi: 1.2.0
**Tipe:** FIX | **Agent:** Vibe-Coder | **Status:** ✅ Done

### Ringkasan
Dua perbaikan di halaman mapel untuk role guru: (1) Tab Master Mapel sekarang otomatis menampilkan mapel yang ditugaskan tanpa perlu pilih filter jenjang; (2) Kolom "Guru" di tab Penugasan Saya disembunyikan karena redundan (guru melihat penugasannya sendiri). Tidak ada perubahan untuk role admin/kepsek/tu.

### File yang Dimodifikasi
| File | Perubahan |
| :--- | :--- |
| `assets/js/mapel.js` | Tambah `renderTabelMapel()` setelah `loadPenugasan()` di `loadAllData()` agar mapel guru tampil default; kolom Guru di tabel & mobile cards disembunyikan untuk role guru via conditional render; colspan dinamis di loading & empty state |
| `mapel.html` | Tambah `id="thGuruPenugasan"` di `<th>Guru</th>` tabel penugasan |

### Keputusan Teknis
- **Re-render vs Restruktur Load Order** — Panggil `renderTabelMapel()` sekali lagi setelah `loadPenugasan()` lebih aman daripada mengubah urutan load (risiko regresi ke dependensi lain)
- **Conditional Render vs CSS Hide** — Skip `<td>` sepenuhnya (bukan CSS hide) agar DOM lebih bersih dan colspan akurat

### Checklist Fix UI Mapel untuk Role Guru ✅
- [x] Mapel guru tampil default di tab Master Mapel tanpa perlu pilih jenjang
- [x] Kolom Guru disembunyikan di tab Penugasan Saya (desktop table)
- [x] Avatar & nama guru disembunyikan di mobile cards untuk role guru
- [x] Empty state & loading state pakai colspan 6 (bukan 7) untuk role guru
- [x] Tidak ada perubahan tampilan untuk role admin/kepsek/tu

---

## [2026-06-10 14:00] — Task: Inisialisasi Dokumentasi Projek | Versi: 1.0.0
**Tipe:** DOCS | **Agent:** Architect | **Status:** ✅ Done

### Ringkasan
Membuat dokumentasi projek & standar AI: `AGENTS.md` (konstitusi AI),
`docs/CHANGELOG.md` (format changelog standar), `docs/DEVELOPMENT_STATUS.md`
(tracking status modul). Bertujuan agar setiap perubahan kode tercatat
dengan format konsisten dan AI patuh pada standar yg disepakati.

### File yang Dibuat
| File | Keterangan |
| :--- | :--- |
| `AGENTS.md` | Standar projek untuk AI: changelog format, branch & commit convention |
| `docs/CHANGELOG.md` | Changelog resmi projek, update tiap ada perubahan kode |
| `docs/DEVELOPMENT_STATUS.md` | Tracking status modul ✅ selesai / 🚧 progress / 📋 backlog |

### File yang Dimodifikasi
| File | Perubahan |
| :--- | :--- |
| `.gitignore` | Tambah `/AGENTS.md` explicit ignore + exception `!docs/CHANGELOG.md` + `!docs/DEVELOPMENT_STATUS.md` |

### Keputusan Teknis
- **AGENTS.md sebagai konstitusi AI** — opencode auto-baca file ini tiap session, jadi aturan changelog otomatis dipatuhi tanpa perlu remind manual
- **CHANGELOG.md di /docs** — konsisten dengan file dokumentasi lain; meski .gitignore ignore docs/, file changelog & dev-status di-explicit-track agar masuk version control
- **Format header detail** — timestamp + task title + versi + tipe + agent + status, agar tracking granular dan mudah dicari

### Checklist Inisialisasi Dokumentasi Projek ✅
- [x] Buat AGENTS.md berisi changelog convention + branch/commit rules
- [x] Buat docs/CHANGELOG.md dengan entry pertama
- [x] Buat docs/DEVELOPMENT_STATUS.md (modul lengkap)
- [x] Update .gitignore — AGENTS.md diignore, CHANGELOG & DEV_STATUS di-track
- [x] Standar field (Tipe, Agent, Status) terdokumentasi

---

## [2026-06-10 07:55] — Task: Reverse-Engineer Dokumentasi Teknis | Versi: 1.1.0
**Tipe:** DOCS | **Agent:** Architect | **Status:** ✅ Done

### Ringkasan
Reverse-engineering dokumentasi teknis lengkap dari codebase existing (11 JS files, firestore.rules, functions/index.js). Dokumentasi mencakup: DATABASE_DESIGN (15 koleksi Firestore + schema detail), API_STRUCTURE (5 HTTP endpoints + 1 trigger), AUTH_FLOW (login/guard/logout flow + security), BACKEND_ARCHITECTURE (Firebase serverless + vanilla JS frontend). Tujuan: onboarding dev baru, maintenance reference, arsitektur overview.

### File yang Dibuat
| File | Keterangan |
| :--- | :--- |
| `docs/DATABASE_DESIGN.md` | Firestore schema 15 koleksi: fields, relationships, security rules, indexes, doc ID patterns |
| `docs/API_STRUCTURE.md` | Cloud Functions API: 5 endpoints + 1 trigger, request/response format, auth, error handling |
| `docs/AUTH_FLOW.md` | Authentication flow: login, page guard, logout, token management, custom claims, 6 roles |
| `docs/BACKEND_ARCHITECTURE.md` | Arsitektur: Firebase serverless, data flow patterns, security layers, scalability, trade-offs |

### File yang Dimodifikasi
| File | Perubahan |
| :--- | :--- |
| — | Tidak ada modifikasi kode, hanya dokumentasi |

### Keputusan Teknis
- **Reverse-engineer vs Fresh Design** — Codebase sudah production-ready (8 modul selesai), lebih efisien dokumentasikan existing vs redesign from scratch
- **4 dokumen terpisah** — Modular: DATABASE (data model), API (endpoint contract), AUTH (security flow), BACKEND (arsitektur overview) agar mudah maintain per domain
- **Comprehensive detail** — Include source code line references (`mapel.js:890`), security matrix, error codes, business rules agar actionable
- **Migration notes** — Tambahkan trade-offs, limitations, future enhancements untuk inform decision making jangka panjang

### Checklist Reverse-Engineer Dokumentasi Teknis ✅
- [x] Scan codebase untuk inventory koleksi Firestore (15 collections)
- [x] Extract field schema + relationships dari JS files
- [x] Document security rules per collection (matrix 6 roles × 15 collections)
- [x] Document 5 HTTP endpoints + 1 Firestore trigger dari functions/index.js
- [x] Map auth flow: login.js, auth-guard.js, firestore.rules helper functions
- [x] Document token management (no storage, fresh fetch, auto-refresh)
- [x] Arsitektur overview: client layer, Firebase services, data flow patterns
- [x] Technology stack + project structure
- [x] Security architecture (3 layers: client, Firestore rules, Cloud Functions)
- [x] Scalability considerations + deployment architecture
- [x] Update CHANGELOG.md dengan entry ini
