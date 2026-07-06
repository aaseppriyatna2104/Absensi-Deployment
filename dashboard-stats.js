/* =========================================================
   DASHBOARD STATISTIK — mengolah data presensi dari Firestore
   (koleksi "absensi", lewat firestore-service.js) menjadi
   kartu ringkasan + grafik Chart.js.

   Real-time: pakai onSnapshot, jadi begitu ada check-in/out
   baru (dari halaman Absensi, device manapun), kartu & grafik
   di Dashboard ini otomatis ter-update tanpa refresh.
   ========================================================= */

(function () {
  const DAY_LABELS_SHORT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

  let weeklyChart = null;
  let monthlyChart = null;

  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function startOfWeek(date) {
    const d = startOfDay(date);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1; // Senin sebagai awal minggu
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
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
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
    const totalMs = monthRecords.reduce((sum, r) => sum + (r.totalJamKerjaMs || 0), 0);
    const workingDays = countWeekdays(monthStart, dayEnd);
    const persentase = workingDays > 0 ? Math.min(100, Math.round((totalHadir / workingDays) * 100)) : 0;

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setText("dashStatHadir", totalHadir);
    setText("dashStatJamKerja", window.AbsensiService.formatDuration(totalMs));
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

      let hadir = 0,
        telat = 0,
        alpha = 0;
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

    if (weeklyChart) weeklyChart.destroy();
    weeklyChart = new Chart(canvas, {
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

    if (monthlyChart) monthlyChart.destroy();
    monthlyChart = new Chart(canvas, {
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

    // Real-time: setiap ada perubahan data di Firestore, semua
    // kartu & grafik dihitung ulang dan dirender ulang otomatis.
    window.AbsensiService.subscribeAll((records) => {
      const today = new Date();
      renderStatCards(records, today);
      buildWeeklyChart(records, today);
      buildMonthlyChart(records, today);
    });
  });
})();
