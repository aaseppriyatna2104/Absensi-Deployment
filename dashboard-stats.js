/* =========================================================
   DASHBOARD STATISTIK — kartu ringkasan + grafik Chart.js,
   sumber data lewat "db" (js/local-db.js), polyfill localStorage
   yang meniru API Firebase Firestore. Sama seperti file lain,
   ini bisa langsung dipakai ulang dengan Firestore asli tanpa
   perlu diubah.
   ========================================================= */

(function () {
  const DAY_LABELS_SHORT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

  let weeklyChartInstance = null;
  let monthlyChartInstance = null;

  function pad(n) { return String(n).padStart(2, "0"); }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const h = pad(Math.floor(total / 3600));
    const m = pad(Math.floor((total % 3600) / 60));
    const s = pad(total % 60);
    return `${h}:${m}:${s}`;
  }

  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function startOfWeek(date) {
    const d = startOfDay(date);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return d;
  }

  function startOfMonth(date) {
    const d = startOfDay(date);
    d.setDate(1);
    return d;
  }

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

  function sameDate(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

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

  /* ---------------------------------------------------------
     Kartu ringkasan bulan berjalan
     --------------------------------------------------------- */
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

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setText("dashStatHadir", totalHadir);
    setText("dashStatJamKerja", formatDuration(totalDetik));
    setText("dashStatTelat", totalTelat);
    setText("dashStatPersentase", `${persentase}%`);
  }

  /* ---------------------------------------------------------
     Grafik Kehadiran Mingguan (Senin – Minggu, minggu ini)
     --------------------------------------------------------- */
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

  /* ---------------------------------------------------------
     Grafik Kehadiran Bulanan (per minggu, bulan berjalan)
     --------------------------------------------------------- */
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
      const hint = document.querySelector(".content__header p, .panel__header-sub");
      console.error("Gagal memuat modul penyimpanan (js/local-db.js).");
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
      });
  });
})();
