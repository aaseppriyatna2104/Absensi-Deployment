/* =========================================================
   FIRESTORE SERVICE — lapisan akses data untuk fitur presensi.
   Dipakai bersama oleh attendance.js, riwayat.js, dan
   dashboard-stats.js supaya struktur data konsisten di satu
   tempat (kalau mau nambah field baru, cukup ubah di sini).

   ---------------------------------------------------------
   STRUKTUR COLLECTION (sengaja dibuat flat & simpel):

   absensi/{tanggal}_{namaSlug}
     ├─ nama            : string   ("Asep Saepudin")
     ├─ tanggal          : string   ("2026-07-06", format YYYY-MM-DD)
     ├─ checkIn          : string | null   (ISO datetime)
     ├─ checkOut         : string | null   (ISO datetime)
     ├─ totalJamKerjaMs  : number   (durasi kerja dalam milidetik)
     ├─ status           : string   ("hadir" | "telat" | "izin" | "alpha")
     ├─ createdAt        : Firestore serverTimestamp
     └─ updatedAt        : Firestore serverTimestamp

   Kenapa 1 dokumen per (orang, tanggal)?
   - ID dokumen deterministik → check-in & check-out tinggal
     "upsert" (merge: true) ke dokumen yang sama, gak perlu
     query dulu buat cari record hari ini.
   - Gampang di-query per tanggal (where tanggal ==) atau per
     rentang tanggal (where tanggal >= && tanggal <=) karena
     tanggal disimpan sebagai string YYYY-MM-DD yang urut
     secara leksikografis sama seperti urut secara tanggal.
   - Gampang dikembangkan: tinggal tambah field baru (misalnya
     "divisi", "lokasi", "catatan") tanpa perlu ubah struktur
     atau migrasi dokumen lama — field lama tetap valid.
   ========================================================= */

(function () {
  const COLLECTION = "absensi";
  const LATE_THRESHOLD_MINUTES = 8 * 60 + 15; // 08:15

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function toDateStr(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function slugify(nama) {
    return String(nama)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function docId(tanggal, nama) {
    return `${tanggal}_${slugify(nama)}`;
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const h = pad(Math.floor(totalSeconds / 3600));
    const m = pad(Math.floor((totalSeconds % 3600) / 60));
    const s = pad(totalSeconds % 60);
    return `${h}:${m}:${s}`;
  }

  function computeStatus(checkInDate) {
    if (!checkInDate) return "alpha";
    const minutes = checkInDate.getHours() * 60 + checkInDate.getMinutes();
    return minutes > LATE_THRESHOLD_MINUTES ? "telat" : "hadir";
  }

  /**
   * Simpan / update Check-in untuk hari ini.
   * Dipanggil dari attendance.js saat tombol Check-in ditekan.
   */
  function checkIn(nama, tanggal, checkInDate) {
    const id = docId(tanggal, nama);
    return window.db
      .collection(COLLECTION)
      .doc(id)
      .set(
        {
          nama,
          tanggal,
          checkIn: checkInDate.toISOString(),
          checkOut: null,
          totalJamKerjaMs: 0,
          status: computeStatus(checkInDate),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  /**
   * Simpan / update Check-out untuk hari ini.
   * Dipanggil dari attendance.js saat tombol Check-out ditekan.
   */
  function checkOut(nama, tanggal, checkInDate, checkOutDate) {
    const id = docId(tanggal, nama);
    const totalMs = checkOutDate - checkInDate;
    return window.db
      .collection(COLLECTION)
      .doc(id)
      .set(
        {
          checkOut: checkOutDate.toISOString(),
          totalJamKerjaMs: totalMs,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  /**
   * Ambil dokumen presensi hari ini untuk 1 orang (dipakai
   * attendance.js buat cek status tombol saat halaman dibuka:
   * sudah check-in? sudah check-out?).
   */
  function getToday(nama, tanggal) {
    const id = docId(tanggal, nama);
    return window.db
      .collection(COLLECTION)
      .doc(id)
      .get()
      .then((snap) => (snap.exists ? normalizeRecord(snap.id, snap.data()) : null));
  }

  function normalizeRecord(id, data) {
    return {
      id,
      nama: data.nama || "",
      tanggal: data.tanggal,
      date: (function () {
        const [y, m, d] = data.tanggal.split("-").map(Number);
        return new Date(y, m - 1, d);
      })(),
      checkIn: data.checkIn ? new Date(data.checkIn) : null,
      checkOut: data.checkOut ? new Date(data.checkOut) : null,
      totalJamKerjaMs: data.totalJamKerjaMs || 0,
      status: data.status || "alpha",
    };
  }

  /**
   * Dengarkan SELURUH koleksi absensi secara real-time.
   * Dipakai oleh dashboard-stats.js & riwayat.js — begitu ada
   * dokumen baru/berubah (check-in/check-out siapa saja),
   * callback langsung dipanggil ulang dengan data terbaru.
   *
   * Return: fungsi unsubscribe (panggil kalau mau berhenti dengar).
   */
  function subscribeAll(callback) {
    return window.db.collection(COLLECTION).onSnapshot(
      (snapshot) => {
        const records = snapshot.docs.map((doc) => normalizeRecord(doc.id, doc.data()));
        callback(records);
      },
      (error) => {
        console.error("Gagal membaca data absensi dari Firestore:", error);
      }
    );
  }

  window.AbsensiService = {
    COLLECTION,
    docId,
    toDateStr,
    formatDuration,
    computeStatus,
    checkIn,
    checkOut,
    getToday,
    subscribeAll,
  };
})();
