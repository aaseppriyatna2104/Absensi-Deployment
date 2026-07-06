/* =========================================================
   ATTENDANCE — logika Check-in / Check-out, sekarang nulis
   ke Firestore (koleksi "absensi") lewat firestore-service.js,
   bukan lagi localStorage.

   >>> CATATAN PENTING <<<
   File `absensi.html` versi terbaru project ini tidak ikut
   di-upload ke saya, jadi ID elemen di bawah ini adalah
   ASUMSI berdasarkan README & pola penamaan di index.html.
   Kalau ID di absensi.html kamu beda, tinggal samakan dengan
   yang dipakai di bawah (atau kirim absensi.html-nya, nanti
   saya sesuaikan otomatis).

   ID/atribut yang dipakai:
   - #namaKaryawan        input teks nama (atau ambil dari profil)
   - #checkInBtn          tombol Check-in
   - #checkOutBtn         tombol Check-out
   - #statusPresensi      badge status (Hadir/Telat/dst)
   - #jamCheckIn          teks jam check-in
   - #jamCheckOut         teks jam check-out
   - #totalJamKerja        teks durasi kerja (berjalan real-time)
   ========================================================= */

(function () {
  const NAMA_STORAGE_KEY = "absensi_nama_aktif";

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatJam(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function getNamaAktif() {
    let nama = localStorage.getItem(NAMA_STORAGE_KEY);
    if (!nama) {
      nama = prompt("Masukkan nama kamu (sekali saja, akan diingat di perangkat ini):");
      if (nama) localStorage.setItem(NAMA_STORAGE_KEY, nama.trim());
    }
    return nama ? nama.trim() : null;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const checkInBtn = document.getElementById("checkInBtn");
    const checkOutBtn = document.getElementById("checkOutBtn");
    if (!checkInBtn && !checkOutBtn) return; // bukan halaman Absensi

    const statusEl = document.getElementById("statusPresensi");
    const jamCheckInEl = document.getElementById("jamCheckIn");
    const jamCheckOutEl = document.getElementById("jamCheckOut");
    const totalJamKerjaEl = document.getElementById("totalJamKerja");

    const nama = getNamaAktif();
    if (!nama) return;

    const today = new Date();
    const tanggal = window.AbsensiService.toDateStr(today);

    let checkInDate = null;
    let checkOutDate = null;
    let liveTimer = null;

    function setBadge(status) {
      if (!statusEl) return;
      const label = { hadir: "Hadir", telat: "Telat", izin: "Izin", alpha: "Alpha" }[status] || status;
      statusEl.textContent = label;
      statusEl.className = `status-badge status-badge--${status}`;
    }

    function startLiveDuration() {
      if (liveTimer) clearInterval(liveTimer);
      liveTimer = setInterval(() => {
        if (!checkInDate || checkOutDate) return;
        const ms = new Date() - checkInDate;
        if (totalJamKerjaEl) totalJamKerjaEl.textContent = window.AbsensiService.formatDuration(ms);
      }, 1000);
    }

    function applyRecordToUI(record) {
      if (!record) return;
      checkInDate = record.checkIn;
      checkOutDate = record.checkOut;

      if (checkInDate) {
        if (jamCheckInEl) jamCheckInEl.textContent = formatJam(checkInDate);
        checkInBtn && checkInBtn.setAttribute("disabled", "true");
        setBadge(record.status);
        startLiveDuration();
      }
      if (checkOutDate) {
        if (jamCheckOutEl) jamCheckOutEl.textContent = formatJam(checkOutDate);
        if (totalJamKerjaEl) totalJamKerjaEl.textContent = window.AbsensiService.formatDuration(record.totalJamKerjaMs);
        checkOutBtn && checkOutBtn.setAttribute("disabled", "true");
        if (liveTimer) clearInterval(liveTimer);
      } else if (checkInDate) {
        checkOutBtn && checkOutBtn.removeAttribute("disabled");
      }
    }

    // Muat status hari ini saat halaman dibuka (kalau sudah pernah check-in di device lain, tetap sinkron karena sumbernya Firestore).
    window.AbsensiService.getToday(nama, tanggal)
      .then(applyRecordToUI)
      .catch((err) => console.error("Gagal memuat data presensi hari ini:", err));

    checkInBtn &&
      checkInBtn.addEventListener("click", () => {
        checkInBtn.setAttribute("disabled", "true");
        const now = new Date();
        window.AbsensiService.checkIn(nama, tanggal, now)
          .then(() => {
            applyRecordToUI({
              checkIn: now,
              checkOut: null,
              totalJamKerjaMs: 0,
              status: window.AbsensiService.computeStatus(now),
            });
          })
          .catch((err) => {
            console.error("Gagal menyimpan check-in:", err);
            checkInBtn.removeAttribute("disabled");
            alert("Gagal menyimpan check-in. Coba lagi.");
          });
      });

    checkOutBtn &&
      checkOutBtn.addEventListener("click", () => {
        if (!checkInDate) return;
        checkOutBtn.setAttribute("disabled", "true");
        const now = new Date();
        window.AbsensiService.checkOut(nama, tanggal, checkInDate, now)
          .then(() => {
            applyRecordToUI({
              checkIn: checkInDate,
              checkOut: now,
              totalJamKerjaMs: now - checkInDate,
              status: window.AbsensiService.computeStatus(checkInDate),
            });
          })
          .catch((err) => {
            console.error("Gagal menyimpan check-out:", err);
            checkOutBtn.removeAttribute("disabled");
            alert("Gagal menyimpan check-out. Coba lagi.");
          });
      });
  });
})();
