/* =========================================================
   RIWAYAT — tabel presensi + filter periode + ringkasan,
   sekarang membaca real-time dari Firestore (koleksi "absensi")
   lewat firestore-service.js. Begitu ada data baru tersimpan
   (dari halaman Absensi, device manapun), tabel di sini
   otomatis ter-update tanpa refresh (pakai onSnapshot).

   >>> CATATAN PENTING <<<
   File `riwayat.html` versi terbaru tidak ikut di-upload ke
   saya, jadi ID/struktur di bawah adalah ASUMSI berdasarkan
   README (tab filter Harian/Mingguan/Bulanan + tabel + kartu
   ringkasan). Samakan ID berikut dengan riwayat.html kamu,
   atau kirim file aslinya untuk saya sesuaikan.

   ID/atribut yang dipakai:
   - [data-filter="harian|mingguan|bulanan"]  tombol tab filter
   - #riwayatTableBody      <tbody> tempat baris tabel dirender
   - #ringkasanHadir        angka Total Hadir
   - #ringkasanTelat        angka Total Terlambat
   - #ringkasanJamKerja     angka Total Jam Kerja
   - #ringkasanPersentase   angka Persentase Kehadiran
   ========================================================= */

(function () {
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatJam(date) {
    return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : "-";
  }

  const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

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

  const STATUS_LABEL = { hadir: "Hadir", telat: "Telat", izin: "Izin", alpha: "Alpha" };

  document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("riwayatTableBody");
    if (!tableBody) return; // bukan halaman Riwayat

    const filterButtons = document.querySelectorAll("[data-filter]");
    const elHadir = document.getElementById("ringkasanHadir");
    const elTelat = document.getElementById("ringkasanTelat");
    const elJamKerja = document.getElementById("ringkasanJamKerja");
    const elPersentase = document.getElementById("ringkasanPersentase");

    let allRecords = [];
    let currentFilter = "harian";

    function getRange(filter, today) {
      const dayEnd = startOfDay(today);
      if (filter === "mingguan") return [startOfWeek(today), dayEnd];
      if (filter === "bulanan") return [startOfMonth(today), dayEnd];
      return [dayEnd, dayEnd]; // harian
    }

    function render() {
      const today = new Date();
      const [start, end] = getRange(currentFilter, today);

      const filtered = allRecords
        .filter((r) => r.date >= start && r.date <= end)
        .sort((a, b) => b.date - a.date);

      // --- Tabel ---
      tableBody.innerHTML = "";
      if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted,#888);padding:24px;">Belum ada data presensi pada periode ini.</td></tr>`;
      } else {
        filtered.forEach((r) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${r.nama || "-"}</td>
            <td>${r.tanggal}</td>
            <td>${HARI[r.date.getDay()]}</td>
            <td class="mono">${formatJam(r.checkIn)}</td>
            <td class="mono">${formatJam(r.checkOut)}</td>
            <td class="mono">${window.AbsensiService.formatDuration(r.totalJamKerjaMs)}</td>
            <td><span class="status-badge status-badge--${r.status}">${STATUS_LABEL[r.status] || r.status}</span></td>
          `;
          tableBody.appendChild(tr);
        });
      }

      // --- Ringkasan ---
      const totalHadir = filtered.filter((r) => r.checkIn).length;
      const totalTelat = filtered.filter((r) => r.status === "telat").length;
      const totalMs = filtered.reduce((sum, r) => sum + (r.totalJamKerjaMs || 0), 0);
      const workingDays = countWeekdays(start, end);
      const persentase = workingDays > 0 ? Math.min(100, Math.round((totalHadir / workingDays) * 100)) : 0;

      if (elHadir) elHadir.textContent = totalHadir;
      if (elTelat) elTelat.textContent = totalTelat;
      if (elJamKerja) elJamKerja.textContent = window.AbsensiService.formatDuration(totalMs);
      if (elPersentase) elPersentase.textContent = `${persentase}%`;
    }

    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterButtons.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        currentFilter = btn.getAttribute("data-filter");
        render();
      });
    });

    // Real-time: begitu ada perubahan di Firestore, render ulang otomatis.
    window.AbsensiService.subscribeAll((records) => {
      allRecords = records;
      render();
    });
  });
})();
