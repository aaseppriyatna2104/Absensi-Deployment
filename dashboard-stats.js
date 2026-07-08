/* =========================================================
   DASHBOARD STATISTIK — kartu ringkasan + grafik Chart.js,
   sumber data lewat "db" (js/local-db.js), polyfill localStorage
   yang meniru API Firebase Firestore. Sama seperti file lain,
   ini bisa langsung dipakai ulang dengan Firestore asli tanpa
   perlu diubah.
   ========================================================= */

(function () {
  const DAY_LABELS_SHORT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

  // Instance Chart.js disimpan supaya bisa di-destroy() sebelum
  // digambar ulang (mencegah grafik dobel saat data berubah).
  let weeklyChartInstance = null;
  let monthlyChartInstance = null;

  /** Menambahkan angka nol di depan kalau kurang dari 2 digit. @param {number} n @returns {string} */
  function pad(n) { return String(n).padStart(2, "0"); }

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

  /** Mengembalikan tanggal hari Senin di minggu yang sama dengan `date`. @param {Date} date @returns {Date} */
  function startOfWeek(date) {
    const d = startOfDay(date);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return d;
  }

  /** Mengembalikan tanggal 1 di bulan yang sama dengan `date`. @param {Date} date @returns {Date} */
  function startOfMonth(date) {
    const d = startOfDay(date);
    d.setDate(1);
    return d;
  }

  /**
   * Menghitung jumlah hari kerja (Senin–Jumat) dari `start` sampai
   * `end` (inklusif) — dipakai sebagai penyebut Persentase Kehadiran.
   * @param {Date} start
   * @param {Date} end
   * @returns {number}
   */
  function countWeekdays(start, end) {
    let count = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) count++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  }

  /** Membandingkan apakah dua Date jatuh di tanggal kalender yang sama. @param {Date} a @param {Date} b @returns {boolean} */
  function sameDate(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  /**
   * Mengubah satu record mentah dari penyimpanan menjadi objek
   * siap-pakai untuk perhitungan kartu & grafik.
   * @param {object} data - data mentah dari db.collection("attendance")
   * @returns {{date: Date, checkIn: Date|null, checkOut: Date|null, totalJamKerjaDetik: number, status: string}}
   */
  function docToRecord(data) {
    const [y, m, d] = data.tanggal.split("-").map(Number);
    return {
      date: new Date(y, m - 1, d),
      checkIn: data.checkIn ? new Date(data.checkIn) : null,
      checkOut: data.checkOut ? new Date(data.checkOut) : null,
      totalJamKerjaDetik: data.totalJamKerjaDetik || 0,
      status: data.status || "belum",
    };
  }

  /**
   * Menghitung & menampilkan 4 kartu ringkasan bulan berjalan:
   * Total Hadir, Total Jam Kerja, Total Terlambat, Persentase Kehadiran.
   * @param {Array<object>} records - seluruh record presensi karyawan
   * @param {Date} today
   */
  function renderStatCards(records, today) {
    const monthStart = startOfMonth(today);
    const dayEnd = startOfDay(today);

    const monthRecords = records.filter((r) => {
      const d = startOfDay(r.date);
      return d >= monthStart && d <= dayEnd;
    });

    const totalHadir = monthRecords.filter((r) => r.checkIn).length;
    const totalTelat = monthRecords.filter((r) => r.status === "telat").length;
    const totalDetik = monthRecords.reduce((sum, r) => {
      return sum + (r.checkIn && r.checkOut ? r.totalJamKerjaDetik : 0);
    }, 0);
    const workingDays = countWeekdays(monthStart, dayEnd);
    const persentase = workingDays > 0
      ? Math.min(100, Math.round((totalHadir / workingDays) * 100))
      : 0;

    /** Helper kecil: set textContent kalau elemennya ada. @param {string} id @param {string|number} val */
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setText("dashStatHadir", totalHadir);
    setText("dashStatJamKerja", formatDuration(totalDetik));
    setText("dashStatTelat", totalTelat);
    setText("dashStatPersentase", `${persentase}%`);
  }

  /**
   * Menggambar grafik bar bertumpuk "Kehadiran Mingguan" (Senin–Minggu,
   * minggu berjalan): tiap hari menunjukkan Hadir/Terlambat/Alpha.
   * @param {Array<object>} records
   * @param {Date} today
   */
  function buildWeeklyChart(records, today) {
    const canvas = document.getElementById("weeklyAttendanceChart");
    if (!canvas || typeof Chart === "undefined") return;

    const weekStart = startOfWeek(today);
    const hadirData = [];
    const telatData = [];
    const alphaData = [];

    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);

      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      const isFuture = day > startOfDay(today);
      const record = records.find((r) => sameDate(r.date, day));

      let hadir = 0, telat = 0, alpha = 0;
      if (record && record.checkIn) {
        if (record.status === "telat") telat = 1;
        else hadir = 1;
      } else if (!isWeekend && !isFuture) {
        alpha = 1;
      }

      hadirData.push(hadir);
      telatData.push(telat);
      alphaData.push(alpha);
    }

    if (weeklyChartInstance) weeklyChartInstance.destroy();
    weeklyChartInstance = new Chart(canvas, {
      type: "bar",
      data: {
        labels: DAY_LABELS_SHORT,
        datasets: [
          { label: "Hadir", data: hadirData, backgroundColor: "#2E9678", borderRadius: 4, maxBarThickness: 28 },
          { label: "Terlambat", data: telatData, backgroundColor: "#E8A33D", borderRadius: 4, maxBarThickness: 28 },
          { label: "Alpha", data: alphaData, backgroundColor: "#D9534F", borderRadius: 4, maxBarThickness: 28 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 }, max: 1 },
        },
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 10, font: { family: "Inter", size: 11 } } },
        },
      },
    });
  }

  /**
   * Menggambar grafik garis "Kehadiran Bulanan": jumlah hari hadir
   * per kelompok minggu (Minggu 1–5) dalam bulan berjalan.
   * @param {Array<object>} records
   * @param {Date} today
   */
  function buildMonthlyChart(records, today) {
    const canvas = document.getElementById("monthlyAttendanceChart");
    if (!canvas || typeof Chart === "undefined") return;

    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    const weekBuckets = [];
    for (let d = 1; d <= daysInMonth; d += 7) {
      weekBuckets.push({ from: d, to: Math.min(d + 6, daysInMonth) });
    }

    const labels = weekBuckets.map((w, i) => `Minggu ${i + 1}`);
    const hadirData = weekBuckets.map((w) => {
      let count = 0;
      for (let day = w.from; day <= w.to; day++) {
        const date = new Date(today.getFullYear(), today.getMonth(), day);
        if (date > startOfDay(today)) continue;
        const record = records.find((r) => sameDate(r.date, date));
        if (record && record.checkIn) count++;
      }
      return count;
    });

    if (monthlyChartInstance) monthlyChartInstance.destroy();
    monthlyChartInstance = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Hari Hadir",
            data: hadirData,
            borderColor: "#1F7A64",
            backgroundColor: "rgba(46, 150, 120, 0.15)",
            tension: 0.35,
            fill: true,
            pointBackgroundColor: "#1F7A64",
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
        },
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 10, font: { family: "Inter", size: 11 } } },
        },
      },
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const weeklyCanvas = document.getElementById("weeklyAttendanceChart");
    if (!weeklyCanvas) return; // bukan halaman Dashboard

    if (typeof db === "undefined") {
      console.error("Gagal memuat modul penyimpanan (js/local-db.js).");
      window.showToast("Gagal memuat modul penyimpanan data.", "error");
      return;
    }

    // Real-time listener — kartu & grafik otomatis update begitu ada
    // check-in/check-out baru, tanpa perlu reload halaman.
    db.collection("attendance")
      .where("nama", "==", CURRENT_EMPLOYEE.nama)
      .onSnapshot((snapshot) => {
        const records = snapshot.docs.map((doc) => docToRecord(doc.data()));
        const today = new Date();

        renderStatCards(records, today);
        buildWeeklyChart(records, today);
        buildMonthlyChart(records, today);
      }, (err) => {
        console.error("Gagal memuat statistik dashboard:", err);
        window.showToast("Gagal memuat statistik dashboard.", "error");
      });
  });
})();
