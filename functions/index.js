/**
 * index.js  —  PATCHED
 * ============================================================
 * Ringkasan perubahan:
 *   [FIX-A] setStudentPin: query Firestore berdasarkan field student_id
 *           (bukan doc ID) sebelum update, karena doc ID adalah auto-ID
 *           yang di-generate oleh addDoc di client.
 *   [FIX-B] posTransaction: sama — query berdasarkan field student_id.
 *           studentRef sekarang merujuk ke doc yang benar.
 * ============================================================
 */

const functions  = require('firebase-functions');
const admin      = require('firebase-admin');
const express    = require('express');
const cors       = require('cors');
const bcrypt     = require('bcrypt');

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ============================================================
// MIDDLEWARE: Verifikasi Firebase ID Token
// ============================================================
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const idToken    = authHeader.startsWith('Bearer ')
    ? authHeader.split('Bearer ')[1]
    : null;

  if (!idToken) {
    return res.status(401).json({ error: 'Unauthorized: Token tidak ditemukan.' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Token tidak valid.' });
  }
}

app.use(verifyToken);

// ============================================================
// HELPER: Bulan ke Angka Romawi
// ============================================================
function toRoman(month) {
  const romans = ['I','II','III','IV','V','VI',
                  'VII','VIII','IX','X','XI','XII'];
  return romans[month - 1] || String(month);
}

// ============================================================
// HELPER: Rata-rata array nilai harian
// ============================================================
function rataHarian(nilaiHarian = []) {
  if (!nilaiHarian || nilaiHarian.length === 0) return 0;
  const total = nilaiHarian.reduce((sum, item) => sum + (item.nilai || 0), 0);
  return total / nilaiHarian.length;
}

// ============================================================
// [FIX-A] HELPER: Cari dokumen student berdasarkan field student_id
// Mengembalikan { docRef, data } atau null jika tidak ditemukan.
// Diperlukan karena addDoc di client membuat auto-ID Firestore,
// sehingga doc ID ≠ nilai field student_id.
// ============================================================
async function findStudentByStudentId(studentId) {
  const snap = await db.collection('students')
    .where('student_id', '==', studentId)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const docSnap = snap.docs[0];
  return { docRef: docSnap.ref, data: docSnap.data() };
}

// ===========================================================
// A. PAYROLL ENGINE
// POST /api/calculatePayroll
// ===========================================================
app.post('/calculatePayroll', async (req, res) => {
  try {
    const callerRole = req.user.role;

    if (callerRole === 'tu') {
      return res.status(403).json({ error: 'Forbidden: TU tidak boleh mengakses payroll.' });
    }

    if (!['admin', 'kepsek'].includes(callerRole)) {
      return res.status(403).json({ error: 'Forbidden: Hanya admin dan kepsek.' });
    }

    const { teacher_uid, periode, tunjangan = 0 } = req.body;

    if (!teacher_uid || !periode) {
      return res.status(400).json({ error: 'teacher_uid dan periode wajib diisi.' });
    }

    if (!/^\d{4}-\d{2}$/.test(periode)) {
      return res.status(400).json({ error: 'Format periode harus YYYY-MM (contoh: 2025-04).' });
    }

    const teacherDoc = await db.collection('users').doc(teacher_uid).get();
    if (!teacherDoc.exists) {
      return res.status(404).json({ error: 'Guru tidak ditemukan.' });
    }
    const teacherData = teacherDoc.data();

    if (teacherData.role !== 'guru') {
      return res.status(400).json({ error: 'User yang dipilih bukan guru.' });
    }

    const hourlyRate = teacherData.hourly_rate || 0;

    const [year, month] = periode.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 1);

    const attendanceSnap = await db.collection('picket_attendance')
      .where('teacher_uid', '==', teacher_uid)
      .where('tanggal', '>=', admin.firestore.Timestamp.fromDate(startDate))
      .where('tanggal', '<',  admin.firestore.Timestamp.fromDate(endDate))
      .get();

    let totalJam = 0;
    attendanceSnap.forEach(doc => {
      totalJam += doc.data().total_jam || 0;
    });

    const gajiPokok = totalJam * hourlyRate;
    const total     = gajiPokok + Number(tunjangan);

    const existingSnap = await db.collection('salaries')
      .where('teacher_uid', '==', teacher_uid)
      .where('periode', '==', admin.firestore.Timestamp.fromDate(startDate))
      .get();

    if (!existingSnap.empty) {
      return res.status(409).json({
        error  : 'Slip gaji untuk periode ini sudah ada.',
        salary_id: existingSnap.docs[0].id,
      });
    }

    const salaryRef  = db.collection('salaries').doc();
    const salaryData = {
      salary_id   : salaryRef.id,
      teacher_uid,
      periode     : admin.firestore.Timestamp.fromDate(startDate),
      total_jam   : totalJam,
      gaji_pokok  : gajiPokok,
      tunjangan   : Number(tunjangan),
      total,
      is_published: false,
      created_at  : admin.firestore.FieldValue.serverTimestamp(),
    };

    await salaryRef.set(salaryData);

    return res.status(201).json({
      message   : 'Slip gaji berhasil dibuat.',
      salary_id : salaryRef.id,
      teacher   : teacherData.name,
      periode,
      total_jam : totalJam,
      gaji_pokok: gajiPokok,
      tunjangan : Number(tunjangan),
      total,
    });

  } catch (err) {
    console.error('[calculatePayroll] Error:', err);
    return res.status(500).json({ error: 'Internal server error.', detail: err.message });
  }
});

// ===========================================================
// B. SECURE POS TRANSACTION
// POST /api/posTransaction
// [FIX-B] Cari dokumen student berdasarkan field student_id,
//         bukan berdasarkan doc ID
// ===========================================================
app.post('/posTransaction', async (req, res) => {
  try {
    const callerRole = req.user.role;

    if (callerRole !== 'kantin') {
      return res.status(403).json({ error: 'Forbidden: Hanya kasir kantin.' });
    }

    const { student_id, pin, nominal, kasir_uid, keterangan = '' } = req.body;

    if (!student_id || !pin || !nominal || !kasir_uid) {
      return res.status(400).json({ error: 'student_id, pin, nominal, dan kasir_uid wajib diisi.' });
    }

    if (typeof nominal !== 'number' || nominal <= 0) {
      return res.status(400).json({ error: 'Nominal harus angka positif.' });
    }

    if (kasir_uid !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden: kasir_uid tidak sesuai token.' });
    }

    // [FIX-B] Cari dokumen berdasarkan field student_id
    const studentResult = await findStudentByStudentId(student_id);
    if (!studentResult) {
      return res.status(404).json({ error: 'Siswa tidak ditemukan.' });
    }

    const { docRef: studentRef, data: studentData } = studentResult;
    const pinHash = studentData.pin_hash;

    const isPinValid = await bcrypt.compare(String(pin), pinHash);
    if (!isPinValid) {
      console.warn(`[posTransaction] PIN salah untuk student_id: ${student_id}`);
      return res.status(401).json({ error: 'PIN tidak valid.' });
    }

    const txRef = db.collection('pos_transactions').doc();

    const result = await db.runTransaction(async (transaction) => {
      // [FIX-B] studentRef sudah merujuk ke dokumen yang benar
      const freshStudentDoc = await transaction.get(studentRef);
      const saldoSaat       = freshStudentDoc.data().saldo_jajan || 0;

      if (saldoSaat < nominal) {
        throw new Error(`INSUFFICIENT_BALANCE:${saldoSaat}`);
      }

      const saldoBaru = saldoSaat - nominal;

      transaction.update(studentRef, {
        saldo_jajan: saldoBaru,
        updated_at : admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.set(txRef, {
        tx_id      : txRef.id,
        student_id,
        nominal,
        kasir_uid,
        keterangan,
        timestamp  : admin.firestore.FieldValue.serverTimestamp(),
      });

      return { saldoBaru, tx_id: txRef.id };
    });

    return res.status(200).json({
      message   : 'Transaksi berhasil.',
      tx_id     : result.tx_id,
      student   : studentData.name,
      nominal,
      saldo_baru: result.saldoBaru,
    });

  } catch (err) {
    if (err.message && err.message.startsWith('INSUFFICIENT_BALANCE')) {
      const saldo = err.message.split(':')[1];
      return res.status(400).json({
        error : 'Saldo tidak cukup.',
        saldo_tersedia: Number(saldo),
      });
    }
    console.error('[posTransaction] Error:', err);
    return res.status(500).json({ error: 'Internal server error.', detail: err.message });
  }
});

// ===========================================================
// D. SUBMIT & FINALISASI NILAI
// POST /api/submitGrades
// ===========================================================
app.post('/submitGrades', async (req, res) => {
  try {
    const callerRole = req.user.role;
    const callerUid  = req.user.uid;

    if (!['guru', 'admin'].includes(callerRole)) {
      return res.status(403).json({ error: 'Forbidden: Hanya guru dan admin.' });
    }

    const { grade_id, action, nilai_harian, nilai_uts, nilai_uas } = req.body;

    if (!grade_id || !action) {
      return res.status(400).json({ error: 'grade_id dan action wajib diisi.' });
    }

    if (!['save_draft', 'finalize'].includes(action)) {
      return res.status(400).json({ error: 'action harus save_draft atau finalize.' });
    }

    const gradeDoc = await db.collection('grades').doc(grade_id).get();
    if (!gradeDoc.exists) {
      return res.status(404).json({ error: 'Dokumen nilai tidak ditemukan.' });
    }

    const gradeData = gradeDoc.data();

    if (callerRole === 'guru' && gradeData.status === 'final') {
      return res.status(403).json({ error: 'Nilai sudah final, tidak bisa diubah.' });
    }

    if (callerRole === 'guru') {
      const tsSnap = await db.collection('teacher_subjects')
        .where('teacher_uid', '==', callerUid)
        .where('class_id',    '==', gradeData.class_id)
        .where('subject_id',  '==', gradeData.subject_id)
        .limit(1)
        .get();

      if (tsSnap.empty) {
        return res.status(403).json({
          error: 'Forbidden: Anda tidak mengajar mata pelajaran ini di kelas ini.',
        });
      }
    }

    const nilaiHarianFinal = nilai_harian  ?? gradeData.nilai_harian ?? [];
    const nilaiUtsFinal    = nilai_uts     ?? gradeData.nilai_uts    ?? 0;
    const nilaiUasFinal    = nilai_uas     ?? gradeData.nilai_uas    ?? 0;

    const rataHarianVal = rataHarian(nilaiHarianFinal);
    const nilaiAkhir    = (rataHarianVal * 0.4) + (nilaiUtsFinal * 0.3) + (nilaiUasFinal * 0.3);

    const newStatus = action === 'finalize' ? 'final' : 'draft';

    const updateData = {
      nilai_harian: nilaiHarianFinal,
      nilai_uts   : nilaiUtsFinal,
      nilai_uas   : nilaiUasFinal,
      nilai_akhir : Math.round(nilaiAkhir * 100) / 100,
      status      : newStatus,
      teacher_uid : callerRole === 'guru' ? callerUid : gradeData.teacher_uid,
      updated_at  : admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('grades').doc(grade_id).update(updateData);

    return res.status(200).json({
      message     : action === 'finalize'
                    ? 'Nilai berhasil difinalisasi.'
                    : 'Draft nilai berhasil disimpan.',
      grade_id,
      status      : newStatus,
      nilai_akhir : updateData.nilai_akhir,
      detail: {
        rata_harian: Math.round(rataHarianVal * 100) / 100,
        nilai_uts  : nilaiUtsFinal,
        nilai_uas  : nilaiUasFinal,
        formula    : '(rata_harian×0.4) + (uts×0.3) + (uas×0.3)',
      },
    });

  } catch (err) {
    console.error('[submitGrades] Error:', err);
    return res.status(500).json({ error: 'Internal server error.', detail: err.message });
  }
});

// ===========================================================
// E. AUTO-INCREMENT NOMOR SURAT
// POST /api/generateLetterNumber
// ===========================================================
app.post('/generateLetterNumber', async (req, res) => {
  try {
    const callerRole = req.user.role;
    const callerUid  = req.user.uid;

    if (!['admin', 'tu'].includes(callerRole)) {
      return res.status(403).json({ error: 'Forbidden: Hanya admin dan TU.' });
    }

    const { jenis, perihal, recipient_uid } = req.body;

    if (!jenis || !perihal) {
      return res.status(400).json({ error: 'jenis dan perihal wajib diisi.' });
    }

    const validJenis = ['masuk', 'keluar', 'SK', 'undangan'];
    if (!validJenis.includes(jenis)) {
      return res.status(400).json({
        error: `jenis tidak valid. Pilihan: ${validJenis.join(', ')}`
      });
    }

    const now         = new Date();
    const tahunIni    = String(now.getFullYear());
    const bulanRomawi = toRoman(now.getMonth() + 1);

    const counterRef = db.collection('letter_counters').doc(jenis);
    const letterRef  = db.collection('letters').doc();

    const { nomorSurat, count } = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      let currentCount = 1;
      const lastReset  = counterDoc.exists ? counterDoc.data().last_reset : null;

      if (counterDoc.exists && lastReset === tahunIni) {
        currentCount = (counterDoc.data().count || 0) + 1;
      } else {
        currentCount = 1;
      }

      transaction.set(counterRef, {
        counterId : jenis,
        count     : currentCount,
        last_reset: tahunIni,
      });

      const nomorPadded = String(currentCount).padStart(3, '0');
      const nomor       = `${nomorPadded}/${jenis}/ARF/${bulanRomawi}/${tahunIni}`;

      transaction.set(letterRef, {
        letter_id    : letterRef.id,
        nomor_surat  : nomor,
        jenis,
        perihal,
        created_by   : callerUid,
        recipient_uid: recipient_uid || null,
        tanggal      : admin.firestore.FieldValue.serverTimestamp(),
        status       : 'draft',
      });

      return { nomorSurat: nomor, count: currentCount };
    });

    return res.status(201).json({
      message     : 'Nomor surat berhasil digenerate.',
      letter_id   : letterRef.id,
      nomor_surat : nomorSurat,
      jenis,
      perihal,
      urutan      : count,
    });

  } catch (err) {
    console.error('[generateLetterNumber] Error:', err);
    return res.status(500).json({ error: 'Internal server error.', detail: err.message });
  }
});

// ===========================================================
// F. SET / RESET PIN SISWA
// POST /api/setStudentPin
// [FIX-A] Query berdasarkan field student_id, bukan doc ID
// ===========================================================
app.post('/setStudentPin', async (req, res) => {
  try {
    const callerRole = req.user.role;

    if (!['admin', 'tu'].includes(callerRole)) {
      return res.status(403).json({ error: 'Forbidden: Hanya admin dan TU.' });
    }

    const { student_id, pin } = req.body;

    if (!student_id || !pin) {
      return res.status(400).json({ error: 'student_id dan pin wajib diisi.' });
    }

    if (String(pin).length !== 6 || isNaN(pin)) {
      return res.status(400).json({ error: 'PIN harus 6 digit angka.' });
    }

    // [FIX-A] Cari dokumen berdasarkan field student_id, bukan doc ID
    const studentResult = await findStudentByStudentId(student_id);
    if (!studentResult) {
      return res.status(404).json({ error: 'Siswa tidak ditemukan.' });
    }

    const { docRef } = studentResult;

    // Hash PIN dengan bcrypt
    const pinHash = await bcrypt.hash(String(pin), 10);

    // [FIX-A] Update menggunakan docRef yang benar
    await docRef.update({
      pin_hash  : pinHash,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      message   : 'PIN berhasil diset.',
      student_id,
    });

  } catch (err) {
    console.error('[setStudentPin] Error:', err);
    return res.status(500).json({ error: 'Internal server error.', detail: err.message });
  }
});

exports.api = functions.https.onRequest(app);

// ===========================================================
// C. AUTO BILLING — FIRESTORE TRIGGER
// ===========================================================
exports.onStudentCreated = functions.firestore
  .document('students/{studentId}')
  .onCreate(async (snap, context) => {
    const studentId   = context.params.studentId;
    const studentData = snap.data();
    const gender      = studentData.gender;

    console.log(`[onStudentCreated] Siswa baru: ${studentId} | Gender: ${gender}`);

    const tagihan = [];

    if (gender === 'L') {
      tagihan.push(
        { jenis_tagihan: 'Seragam Pria',  nominal: 250000 },
        { jenis_tagihan: 'Sarung',         nominal: 85000  },
        { jenis_tagihan: 'Peci',           nominal: 35000  },
      );
    } else if (gender === 'P') {
      tagihan.push(
        { jenis_tagihan: 'Seragam Wanita', nominal: 275000 },
        { jenis_tagihan: 'Mukena',         nominal: 120000 },
        { jenis_tagihan: 'Jilbab',         nominal: 65000  },
      );
    }

    tagihan.push(
      { jenis_tagihan: 'SPP Bulan 1',   nominal: 500000 },
      { jenis_tagihan: 'Biaya Asrama',  nominal: 750000 },
    );

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const batch = db.batch();

    tagihan.forEach(item => {
      const billRef = db.collection('billing').doc();
      batch.set(billRef, {
        bill_id      : billRef.id,
        student_id   : studentId,
        jenis_tagihan: item.jenis_tagihan,
        nominal      : item.nominal,
        due_date     : admin.firestore.Timestamp.fromDate(dueDate),
        status       : 'belum_bayar',
        created_at   : admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    console.log(
      `[onStudentCreated] ${tagihan.length} tagihan berhasil dibuat untuk siswa ${studentId}`
    );
    return null;
  });
