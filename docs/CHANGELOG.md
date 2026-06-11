# Changelog ERP Al-Arrofi

Format mengikuti standar di `AGENTS.md`.

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
