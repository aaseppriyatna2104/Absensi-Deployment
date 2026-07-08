/* =========================================================
   ATTENDANCE — logika Check-in / Check-out harian

   Disimpan lewat "db" yang didefinisikan di js/local-db.js —
   sebuah polyfill yang bentuk pemanggilannya (collection/doc/
   set/onSnapshot) sengaja dibuat MIRIP Firebase Firestore.
   Jadi kalau nanti project ini dihubungkan ke Firebase asli,
   file ini TIDAK PERLU diubah — cukup ganti local-db.js dengan
   SDK Firebase + firebase-config.js yang menginisialisasi
   variabel global "db" yang sama.

   Struktur data (collection "attendance"):
   collection("attendance")
     └── document("{employeeId}_{YYYY-MM-DD}")
           ├── nama            : string
           ├── tanggal         : string  "YYYY-MM-DD"
           ├── checkIn         : string ISO datetime | null
           ├── checkOut        : string ISO datetime | null
           ├── totalJamKerjaDetik : number (detik)
           └── status          : "hadir" | "telat" | "belum"
   ========================================================= */

(function () {
  const LATE_THRESHOLD_MINUTES = 8 * 60 + 15; // 08:15

  /**
   * Membentuk string tanggal hari ini dalam format "YYYY-MM-DD",
   * dipakai sebagai bagian dari ID record harian.
   * @returns {string}
   */
  function todayDateStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /**
   * Membentuk ID record presensi dari ID karyawan + tanggal,
   * contoh: "atna_2026-07-06".
   * @param {string} dateStr - tanggal format "YYYY-MM-DD"
   * @returns {string}
   */
  function docId(dateStr) {
    return `${CURRENT_EMPLOYEE.id}_${dateStr}`;
  }

  /**
   * Memformat objek Date menjadi jam "HH:MM:SS".
   * @param {Date} date
   * @returns {string}
   */
  function formatClock(date) {
    const p = (n) => String(n).padStart(2, "0");
    return `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
  }

  /**
   * Memformat durasi dalam detik menjadi "HH:MM:SS".
   * @param {number} seconds
   * @returns {string}
   */
  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  /**
   * Menentukan status kehadiran ("hadir"/"telat") berdasarkan
   * jam check-in, dibandingkan dengan batas toleransi 08:15.
   * @param {Date} checkInDate
   * @returns {"hadir"|"telat"}
   */
  function computeStatus(checkInDate) {
    const minutes = checkInDate.getHours() * 60 + checkInDate.getMinutes();
    return minutes > LATE_THRESHOLD_MINUTES ? "telat" : "hadir";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btnCheckIn = document.getElementById("btnCheckIn");
    const btnCheckOut = document.getElementById("btnCheckOut");
    const elCheckIn = document.getElementById("statusCheckIn");
    const elCheckOut = document.getElementById("statusCheckOut");
    const elTotalHours = document.getElementById("statusTotalHours");
    const elStatusLabel = document.getElementById("statusLabel");
    const elHint = document.getElementById("attendanceHint");

    if (!btnCheckIn || !btnCheckOut) return; // bukan halaman Absensi
    if (typeof db === "undefined") {
      elHint.textContent = "Gagal memuat modul penyimpanan (js/local-db.js).";
      return;
    }

    const dateStr = todayDateStr();
    const ref = db.collection("attendance").doc(docId(dateStr));

    /** @type {{checkIn: string|null, checkOut: string|null, totalJamKerjaDetik: number, status: string}} */
    let record = { checkIn: null, checkOut: null, totalJamKerjaDetik: 0, status: "belum" };
    let liveTimer = null;

    /**
     * Menggambar ulang seluruh tampilan kartu presensi berdasarkan
     * isi variabel `record` saat ini: jam check-in/out, label status,
     * pesan bantuan, serta status disabled kedua tombol.
     */
    function render() {
      elCheckIn.textContent = record.checkIn ? formatClock(new Date(record.checkIn)) : "—:—";
      elCheckOut.textContent = record.checkOut ? formatClock(new Date(record.checkOut)) : "—:—";

      btnCheckIn.disabled = !!record.checkIn;
      btnCheckOut.disabled = !record.checkIn || !!record.checkOut;

      if (!record.checkIn) {
        elStatusLabel.textContent = "Belum Hadir";
        elHint.textContent = "Anda belum melakukan check-in hari ini.";
      } else if (!record.checkOut) {
        elStatusLabel.textContent = record.status === "telat" ? "Sedang Bekerja (Telat)" : "Sedang Bekerja";
        elHint.textContent = "Check-in tersimpan. Jangan lupa check-out setelah selesai kerja.";
      } else {
        elStatusLabel.textContent = "Selesai";
        elHint.textContent = "Data presensi hari ini sudah tersimpan lengkap.";
      }

      updateTotalHoursDisplay();
    }

    /**
     * Memperbarui angka Total Jam Kerja: kalau sudah check-out,
     * tampilkan nilai final; kalau masih bekerja, hitung selisih
     * dari check-in sampai waktu sekarang (berjalan tiap detik).
     */
    function updateTotalHoursDisplay() {
      if (record.checkIn && record.checkOut) {
        elTotalHours.textContent = formatDuration(record.totalJamKerjaDetik);
      } else if (record.checkIn && !record.checkOut) {
        const diffSeconds = (Date.now() - new Date(record.checkIn).getTime()) / 1000;
        elTotalHours.textContent = formatDuration(diffSeconds);
      } else {
        elTotalHours.textContent = "00:00:00";
      }
    }

    /**
     * Menyalakan timer yang memanggil updateTotalHoursDisplay()
     * setiap detik, dipakai selagi status "Sedang Bekerja".
     */
    function startLiveTimer() {
      stopLiveTimer();
      liveTimer = setInterval(updateTotalHoursDisplay, 1000);
    }

    /**
     * Menghentikan timer jam berjalan (dipanggil saat check-out
     * atau saat data di-render ulang dari awal).
     */
    function stopLiveTimer() {
      if (liveTimer) {
        clearInterval(liveTimer);
        liveTimer = null;
      }
    }

    // Dengar perubahan record secara real-time — kalau data berubah
    // dari tab/perangkat lain, tampilan di sini otomatis ikut update.
    ref.onSnapshot((snap) => {
      if (snap.exists) {
        const data = snap.data();
        record = {
          checkIn: data.checkIn || null,
          checkOut: data.checkOut || null,
          totalJamKerjaDetik: data.totalJamKerjaDetik || 0,
          status: data.status || "belum",
        };
      } else {
        record = { checkIn: null, checkOut: null, totalJamKerjaDetik: 0, status: "belum" };
      }

      render();
      stopLiveTimer();
      if (record.checkIn && !record.checkOut) startLiveTimer();
    }, (err) => {
      console.error("Gagal memuat data presensi:", err);
      elHint.textContent = "Gagal memuat data presensi dari penyimpanan lokal.";
      window.showToast("Gagal memuat data presensi.", "error");
    });

    /**
     * Handler tombol Check-in: mencegah klik ganda di hari yang
     * sama, menyimpan jam saat ini + status (hadir/telat), lalu
     * menampilkan toast hasilnya.
     */
    btnCheckIn.addEventListener("click", async () => {
      if (record.checkIn) return; // sudah check-in hari ini — kunci

      window.setButtonLoading(btnCheckIn, true, "Menyimpan...");

      const now = new Date();
      const status = computeStatus(now);
      const payload = {
        nama: CURRENT_EMPLOYEE.nama,
        tanggal: dateStr,
        checkIn: now.toISOString(),
        checkOut: null,
        totalJamKerjaDetik: 0,
        status,
      };

      try {
        await ref.set(payload, { merge: true });
        window.showToast(
          status === "telat" ? "Check-in berhasil (tercatat telat)." : "Check-in berhasil.",
          status === "telat" ? "warning" : "success"
        );
      } catch (err) {
        console.error("Gagal menyimpan check-in:", err);
        elHint.textContent = "Gagal menyimpan check-in. Coba lagi.";
        window.showToast("Gagal menyimpan check-in. Coba lagi.", "error");
      } finally {
        window.setButtonLoading(btnCheckIn, false);
        render(); // onSnapshot juga akan render, ini jaga-jaga kalau event tertunda
      }
    });

    /**
     * Handler tombol Check-out: hanya berjalan kalau sudah check-in
     * dan belum check-out, menghitung total jam kerja, lalu
     * menyimpannya dan menampilkan toast hasilnya.
     */
    btnCheckOut.addEventListener("click", async () => {
      if (!record.checkIn || record.checkOut) return; // belum check-in / sudah check-out

      window.setButtonLoading(btnCheckOut, true, "Menyimpan...");

      const now = new Date();
      const totalJamKerjaDetik = (now.getTime() - new Date(record.checkIn).getTime()) / 1000;

      try {
        await ref.set({
          checkOut: now.toISOString(),
          totalJamKerjaDetik,
        }, { merge: true });
        window.showToast(`Check-out berhasil. Total kerja: ${formatDuration(totalJamKerjaDetik)}.`, "success");
      } catch (err) {
        console.error("Gagal menyimpan check-out:", err);
        elHint.textContent = "Gagal menyimpan check-out. Coba lagi.";
        window.showToast("Gagal menyimpan check-out. Coba lagi.", "error");
      } finally {
        window.setButtonLoading(btnCheckOut, false);
        render();
      }
    });
  });
})();
