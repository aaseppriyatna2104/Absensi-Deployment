/* =========================================================
   ATTENDANCE — logika Check-in / Check-out halaman Absensi.
   
   Menggunakan "db" (js/core.js) yang meniru API Firebase
   Firestore. Data disimpan per tanggal & per karyawan.
   ========================================================= */

(function () {
  const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const MONTH_NAMES = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  
  // Tidak ada batas waktu - semua check-in dianggap hadir
  
  /** Menambahkan angka nol di depan kalau kurang dari 2 digit. @param {number} n @returns {string} */
  function pad(n) { return String(n).padStart(2, "0"); }
  
  /** Memformat objek Date menjadi jam "HH:MM:SS". @param {Date} date @returns {string} */
  function formatClock(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
  
  /** Memformat objek Date menjadi "DD Month YYYY". @param {Date} date @returns {string} */
  function formatDate(date) {
    return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
  }
  
  /** Memformat durasi dalam detik menjadi "HH:MM:SS". @param {number} seconds @returns {string} */
  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const h = pad(Math.floor(total / 3600));
    const m = pad(Math.floor((total % 3600) / 60));
    const s = pad(total % 60);
    return `${h}:${m}:${s}`;
  }
  
  /** Mengembalikan tanggal (jam di-nol-kan) dari sebuah Date. @param {Date} date @returns {Date} */
  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  
  /** Mengembalikan tanggal hari ini dalam format "YYYY-MM-DD". @returns {string} */
  function getTodayString() {
    const today = new Date();
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  }
  
  /** Menentukan status - semua check-in dianggap hadir. @param {Date} checkInTime @returns {"hadir"} */
  function determineStatus(checkInTime) {
    return "hadir";
  }
  
  /** ID record untuk hari ini: "{username}_{YYYY-MM-DD}" */
  function getTodayRecordId() {
    return `${CURRENT_EMPLOYEE.id}_${getTodayString()}`;
  }
  
  /** Update tampilan UI berdasarkan data attendance. @param {object|null} data */
  function updateUI(data) {
    const today = new Date();
    const dateLabel = document.getElementById("attendanceDateLabel");
    const checkInStatus = document.getElementById("checkInStatus");
    const checkInTime = document.getElementById("checkInTime");
    const checkOutStatus = document.getElementById("checkOutStatus");
    const checkOutTime = document.getElementById("checkOutTime");
    const workStatus = document.getElementById("workStatus");
    const totalWorkTime = document.getElementById("totalWorkTime");
    const btnCheckIn = document.getElementById("btnCheckIn");
    const btnCheckOut = document.getElementById("btnCheckOut");
    
    // Update label tanggal
    if (dateLabel) {
      dateLabel.textContent = `${DAY_NAMES[today.getDay()]}, ${formatDate(today)}`;
    }
    
    if (!data || !data.checkIn) {
      // Belum check-in
      checkInStatus.textContent = "Belum check-in";
      checkInTime.textContent = "--:--:--";
      checkOutStatus.textContent = "Belum check-out";
      checkOutTime.textContent = "--:--:--";
      workStatus.textContent = "Belum bekerja";
      totalWorkTime.textContent = "00:00:00";
      
      btnCheckIn.disabled = false;
      btnCheckOut.disabled = true;
      return;
    }
    
    const checkInDate = new Date(data.checkIn);
    checkInStatus.textContent = "Hadir";
    checkInTime.textContent = formatClock(checkInDate);
    
    if (!data.checkOut) {
      // Sudah check-in, belum check-out
      checkOutStatus.textContent = "Sedang bekerja";
      checkOutTime.textContent = "--:--:--";
      workStatus.textContent = "Sedang bekerja";
      
      // Hitung durasi real-time
      updateWorkDuration(checkInDate);
      
      btnCheckIn.disabled = true;
      btnCheckOut.disabled = false;
    } else {
      // Sudah check-out
      const checkOutDate = new Date(data.checkOut);
      checkOutStatus.textContent = "Selesai bekerja";
      checkOutTime.textContent = formatClock(checkOutDate);
      workStatus.textContent = "Selesai bekerja";
      totalWorkTime.textContent = formatDuration(data.totalJamKerjaDetik || 0);
      
      btnCheckIn.disabled = true;
      btnCheckOut.disabled = true;
      
      // Stop timer jika ada
      if (window.workTimer) {
        clearInterval(window.workTimer);
        window.workTimer = null;
      }
    }
  }
  
  /** Update durasi kerja real-time. @param {Date} checkInDate */
  function updateWorkDuration(checkInDate) {
    const totalWorkTime = document.getElementById("totalWorkTime");
    
    // Clear timer yang lama jika ada
    if (window.workTimer) {
      clearInterval(window.workTimer);
    }
    
    function tick() {
      const now = new Date();
      const diff = Math.floor((now - checkInDate) / 1000);
      totalWorkTime.textContent = formatDuration(diff);
    }
    
    tick();
    window.workTimer = setInterval(tick, 1000);
  }
  
  /** Handle Check-in */
  async function handleCheckIn() {
    const btn = document.getElementById("btnCheckIn");
    if (!btn || btn.disabled) return;
    
    window.setButtonLoading(btn, true, "Mencatat...");
    
    try {
      const now = new Date();
      const todayString = getTodayString();
      const recordId = getTodayRecordId();
      const status = determineStatus(now);
      
      const data = {
        nama: CURRENT_EMPLOYEE.nama,
        tanggal: todayString,
        checkIn: now.toISOString(),
        checkOut: null,
        totalJamKerjaDetik: 0,
        status: status
      };
      
      await db.collection("attendance").doc(recordId).set(data, { merge: true });
      
      window.showToast(`Check-in berhasil! Anda hadir.`, "success");
      
    } catch (error) {
      console.error("Check-in error:", error);
      window.showToast("Gagal melakukan check-in.", "error");
    } finally {
      window.setButtonLoading(btn, false);
    }
  }
  
  /** Handle Check-out */
  async function handleCheckOut() {
    const btn = document.getElementById("btnCheckOut");
    if (!btn || btn.disabled) return;
    
    window.setButtonLoading(btn, true, "Mencatat...");
    
    try {
      const now = new Date();
      const recordId = getTodayRecordId();
      
      // Baca data check-in dulu
      const doc = await db.collection("attendance").doc(recordId).get();
      if (!doc.exists) {
        window.showToast("Data check-in tidak ditemukan.", "error");
        window.setButtonLoading(btn, false);
        return;
      }
      
      const data = doc.data();
      const checkInDate = new Date(data.checkIn);
      const totalDetik = Math.floor((now - checkInDate) / 1000);
      
      const updateData = {
        checkOut: now.toISOString(),
        totalJamKerjaDetik: totalDetik
      };
      
      await db.collection("attendance").doc(recordId).set(updateData, { merge: true });
      
      window.showToast(`Check-out berhasil! Total: ${formatDuration(totalDetik)}`, "success");
      
    } catch (error) {
      console.error("Check-out error:", error);
      window.showToast("Gagal melakukan check-out.", "error");
    } finally {
      window.setButtonLoading(btn, false);
    }
  }
  
  document.addEventListener("DOMContentLoaded", () => {
    const btnCheckIn = document.getElementById("btnCheckIn");
    const btnCheckOut = document.getElementById("btnCheckOut");
    
    if (!btnCheckIn || !btnCheckOut) return; // Bukan halaman Absensi
    
    if (typeof db === "undefined") {
      window.showToast("Gagal memuat modul penyimpanan data.", "error");
      return;
    }
    
    // Event listeners
    btnCheckIn.addEventListener("click", handleCheckIn);
    btnCheckOut.addEventListener("click", handleCheckOut);
    
    // Real-time listener untuk data hari ini
    const recordId = getTodayRecordId();
    db.collection("attendance").doc(recordId).onSnapshot(
      (snapshot) => {
        updateUI(snapshot.exists ? snapshot.data() : null);
      },
      (error) => {
        console.error("Gagal memuat data attendance:", error);
        window.showToast("Gagal memuat data attendance.", "error");
      }
    );
  });
})();
