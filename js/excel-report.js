/* =========================================================
   EXCEL REPORT GENERATOR — Generate file .xlsx dari data
   presensi, dipakai bareng di Kelola Data (admin, semua staff)
   dan Riwayat (staff, data diri sendiri / admin, per filter
   periode). Pakai SheetJS (window.XLSX), CDN-nya dimuat di
   HTML masing-masing halaman.

   Kolom yang dihasilkan sengaja disamakan dengan kolom tabel
   "Semua Data Presensi" di Kelola Data supaya isi file Excel
   konsisten dengan apa yang admin lihat di layar.
   ========================================================= */

(function () {
  const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  /** Menambahkan angka nol di depan kalau kurang dari 2 digit. */
  function pad(n) { return String(n).padStart(2, "0"); }

  /** Memformat objek Date menjadi jam "HH:MM:SS". */
  function formatClock(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  /** Memformat durasi dalam detik menjadi "HH:MM:SS". */
  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(seconds || 0));
    const h = pad(Math.floor(total / 3600));
    const m = pad(Math.floor((total % 3600) / 60));
    const s = pad(total % 60);
    return `${h}:${m}:${s}`;
  }

  /** Mengubah "tanggal" (string "YYYY-MM-DD" atau ISO datetime) jadi objek Date yang valid. */
  function parseTanggal(tanggal) {
    const d = tanggal && tanggal.includes("T") ? new Date(tanggal) : new Date(`${tanggal}T00:00:00`);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  /** Format lokasi lat/long jadi teks "lat, long" atau "-" kalau kosong. */
  function formatLokasi(lat, long) {
    if (lat === undefined || lat === null || long === undefined || long === null) return "-";
    return `${lat}, ${long}`;
  }

  /**
   * Menentukan apakah sebuah record dihitung "Hadir". Cek field `status`
   * eksplisit dulu — bukan cuma `checkIn` — supaya entri manual "Hadir
   * tanpa jam" (dari Kelola Data, checkIn null tapi status="hadir") tetap
   * kebaca Hadir di file Excel, bukan Alpha. Konsisten dengan logic yang
   * sama di kelola-data.js, riwayat.js, dan pdf-report.js.
   * @param {{checkIn: string|null, status: string}} r
   * @returns {boolean}
   */
  function isHadir(r) {
    return r.status === "hadir" || !!r.checkIn;
  }

  /**
   * Generate & download file .xlsx dari data presensi.
   * @param {Array<object>} records - record presensi mentah
   *   ({ tanggal, nama, checkIn, checkOut, totalJamKerjaDetik,
   *      checkInLat, checkInLong, checkOutLat, checkOutLong })
   * @param {string} filenamePrefix - awalan nama file, mis. "Riwayat-Asep"
   * @param {string} [sheetTitle] - judul yang ditulis sebagai baris pertama sheet
   */
  function generateAttendanceExcel(records, filenamePrefix, sheetTitle) {
    if (typeof XLSX === "undefined") {
      window.showToast("Library Excel tidak tersedia. Cek koneksi internet.", "error");
      return;
    }

    if (!records || records.length === 0) {
      window.showToast("Tidak ada data untuk diexport ke Excel.", "error");
      return;
    }

    const sorted = [...records].sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    const rows = sorted.map((r, index) => {
      const date = parseTanggal(r.tanggal);
      return {
        "No": index + 1,
        "Tanggal": `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
        "Hari": DAY_NAMES[date.getDay()],
        "Nama": r.nama || "-",
        "Check In": r.checkIn ? formatClock(new Date(r.checkIn)) : "-",
        "Check Out": r.checkOut ? formatClock(new Date(r.checkOut)) : "-",
        "Total Jam Kerja": r.checkIn && r.checkOut ? formatDuration(r.totalJamKerjaDetik) : "-",
        "Status": isHadir(r) ? "Hadir" : "Alpha",
        "Lokasi Check-in": formatLokasi(r.checkInLat, r.checkInLong),
        "Lokasi Check-out": formatLokasi(r.checkOutLat, r.checkOutLong),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Lebar kolom disesuaikan manual supaya nggak kepotong pas dibuka.
    worksheet["!cols"] = [
      { wch: 4 },  // No
      { wch: 12 }, // Tanggal
      { wch: 8 },  // Hari
      { wch: 18 }, // Nama
      { wch: 10 }, // Check In
      { wch: 10 }, // Check Out
      { wch: 15 }, // Total Jam Kerja
      { wch: 8 },  // Status
      { wch: 22 }, // Lokasi Check-in
      { wch: 22 }, // Lokasi Check-out
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Presensi");

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const safePrefix = (filenamePrefix || "Laporan-Presensi").replace(/[\\/:*?"<>|]/g, "-");
    const filename = `${safePrefix}_${dateStr}.xlsx`;

    try {
      XLSX.writeFile(workbook, filename);
      window.showToast("Laporan Excel berhasil diunduh!", "success");
    } catch (err) {
      console.error("Excel generation error:", err);
      window.showToast("Gagal membuat laporan Excel: " + err.message, "error");
    }
  }

  window.generateAttendanceExcel = generateAttendanceExcel;
})();
