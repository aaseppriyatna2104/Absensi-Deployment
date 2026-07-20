/* =========================================================
   RIWAYAT — membaca data presensi lewat "db" (Firebase
   Firestore, lihat js/firebase-config.js).
   ========================================================= */

(function () {
  const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
  ];
  const TABLE_COLUMN_COUNT = 9;

  /** Menambahkan angka nol di depan kalau kurang dari 2 digit. @param {number} n @returns {string} */
  function pad(n) { return String(n).padStart(2, "0"); }

  /** Memformat objek Date menjadi jam "HH:MM:SS". @param {Date} date @returns {string} */
  function formatClock(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  /** Memformat objek Date menjadi "DD Mon YYYY", contoh "06 Jul 2026". @param {Date} date @returns {string} */
  function formatDateShort(date) {
    return `${pad(date.getDate())} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
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
   * Menghitung jumlah SEMUA hari (termasuk weekend) dari `start`
   * sampai `end` (inklusif) — dipakai sebagai penyebut Persentase
   * Kehadiran & Total Alpha. Basis hitungnya sengaja disamakan
   * dengan Dashboard (js/dashboard-stats.js) dan Kalender Kehadiran
   * di Kelola Data, yang juga menandai weekend tanpa data sebagai
   * Alpha — supaya angka Total Alpha di Riwayat staff konsisten
   * dengan yang dilihat admin untuk staff yang sama & periode yang
   * sama.
   * @param {Date} start
   * @param {Date} end
   * @returns {number}
   */
  function countAllDays(start, end) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((startOfDay(end) - startOfDay(start)) / msPerDay) + 1;
  }

  /**
   * Mengubah satu record mentah ("tanggal": "YYYY-MM-DD", dst.) dari
   * penyimpanan menjadi objek siap-pakai untuk tabel & statistik.
   * @param {object} data - data mentah dari db.collection("attendance")
   * @returns {{date: Date, checkIn: Date|null, checkOut: Date|null, totalJamKerjaDetik: number, status: string, checkInLat, checkInLong, checkOutLat, checkOutLong}}
   */
  function docToRecord(data) {
    const [y, m, d] = data.tanggal.split("-").map(Number);
    return {
      date: new Date(y, m - 1, d),
      nama: data.nama || "-",
      checkIn: data.checkIn ? new Date(data.checkIn) : null,
      checkOut: data.checkOut ? new Date(data.checkOut) : null,
      totalJamKerjaDetik: data.totalJamKerjaDetik || 0,
      status: data.status || "belum",
      checkInLat: data.checkInLat || null,
      checkInLong: data.checkInLong || null,
      checkInAccuracy: data.checkInAccuracy || null,
      checkOutLat: data.checkOutLat || null,
      checkOutLong: data.checkOutLong || null,
      checkOutAccuracy: data.checkOutAccuracy || null,
    };
  }

  /**
   * Menentukan apakah sebuah record dihitung "Hadir". Cek field
   * `status` eksplisit dulu — bukan cuma `checkIn` — supaya entri
   * manual "Hadir tanpa jam" (dari Kelola Data, checkIn null tapi
   * status="hadir") tetap kebaca Hadir. Konsisten dengan logic yang
   * sama di kelola-data.js dan dashboard-stats.js.
   * @param {{checkIn: Date|null, status: string}} record
   * @returns {boolean}
   */
  function isHadir(record) {
    return record.status === "hadir" || !!record.checkIn;
  }

  /**
   * Membentuk markup <span> badge status untuk satu baris tabel.
   * @param {{checkIn: Date|null, status: string}} record
   * @returns {string} HTML badge
   */
  function statusBadge(record) {
    if (!isHadir(record)) {
      return '<span class="status-badge status-badge--alpha">Alpha</span>';
    }
    return '<span class="status-badge status-badge--hadir">Hadir</span>';
  }

  /**
   * Menggambar isi <tbody> tabel riwayat berdasarkan daftar record
   * yang sudah difilter. Menampilkan pesan kosong kalau tidak ada data.
   * @param {Array<object>} records
   */
  function renderTable(records) {
    const tbody = document.getElementById("riwayatTableBody");
    if (!records.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${TABLE_COLUMN_COUNT}" style="text-align:center; color: var(--color-text-faint); padding: var(--sp-6) 0;">
            Belum ada data presensi pada periode ini.
          </td>
        </tr>`;
      return;
    }

    /**
     * Membentuk markup link "Lihat Peta" kalau koordinat GPS ada.
     * Sengaja pakai `!= null` (bukan truthy check) supaya koordinat
     * 0 (mis. tepat di garis khatulistiwa/meridian) tetap dianggap
     * valid, bukan dibaca sebagai "tidak ada data".
     * @param {number|null} lat
     * @param {number|null} long
     * @param {number|null} [accuracy] - radius akurasi GPS dalam meter
     * @returns {string}
     */
    function mapLink(lat, long, accuracy) {
      if (lat == null || long == null) return "-";
      const accuracyLabel = (typeof accuracy === "number")
        ? ` <span style="color: var(--color-text-faint); font-size: var(--fs-xs, 11px);">(±${Math.round(accuracy)}m)</span>`
        : "";
      return `<a href="https://maps.google.com/?q=${lat},${long}" target="_blank" style="color: var(--color-teal-600); text-decoration: none;">Lihat Peta</a>${accuracyLabel}`;
    }

    tbody.innerHTML = records.map((r) => {
      const checkInLocation = mapLink(r.checkInLat, r.checkInLong, r.checkInAccuracy);
      const checkOutLocation = mapLink(r.checkOutLat, r.checkOutLong, r.checkOutAccuracy);

      return `
      <tr>
        <td class="mono">${formatDateShort(r.date)}</td>
        <td>${DAY_NAMES[r.date.getDay()]}</td>
        <td>${r.nama}</td>
        <td class="cell-time mono">${r.checkIn ? formatClock(r.checkIn) : "—:—"}</td>
        <td class="cell-time mono">${r.checkOut ? formatClock(r.checkOut) : "—:—"}</td>
        <td class="cell-time mono">${r.checkIn && r.checkOut ? formatDuration(r.totalJamKerjaDetik) : "00:00:00"}</td>
        <td>${statusBadge(r)}</td>
        <td>${checkInLocation}</td>
        <td>${checkOutLocation}</td>
      </tr>`;
    }).join("");
  }

  /**
   * Menghitung & menampilkan 4 kartu ringkasan (Total Hadir, Total
   * Alpha, Total Jam Kerja, Persentase Kehadiran) untuk daftar
   * record yang sudah difilter.
   *
   * Untuk admin, `records` bisa berisi data BANYAK karyawan
   * sekaligus — supaya Total Alpha & Persentase Kehadiran tetap
   * akurat, jumlah karyawan diambil dari daftar staff RESMI
   * (window.Auth.USERS), BUKAN dari nama yang kebetulan muncul di
   * `records`. Kalau diambil dari `records`, staff yang alpha
   * penuh sepanjang periode (nggak pernah check-in sama sekali)
   * jadi tidak ikut kehitung — bikin Total Alpha di Dashboard admin
   * lebih rendah dari total kalau dijumlah manual dari Riwayat
   * masing-masing staff.
   * @param {Array<object>} records
   * @param {number} totalDays - jumlah hari (termasuk weekend) pada periode terpilih
   */
  function renderStats(records, totalDays) {
    const totalHadir = records.filter(isHadir).length;
    const totalDetik = records.reduce((sum, r) => sum + (r.checkIn && r.checkOut ? r.totalJamKerjaDetik : 0), 0);

    const isAdmin = CURRENT_EMPLOYEE.role === "admin";
    const employeeCount = isAdmin
      ? ((window.Auth && window.Auth.USERS) || []).filter((u) => u.role === "staff").length || 1
      : 1;
    const denominator = totalDays * employeeCount;
    const persentase = denominator > 0
      ? Math.min(100, Math.round((totalHadir / denominator) * 100))
      : 0;

    // Hitung alpha: jumlah semua hari (termasuk weekend) dikali jumlah karyawan, dikurangi total hadir
    const totalAlpha = Math.max(0, denominator - totalHadir);

    document.getElementById("statTotalHadir").textContent = totalHadir;
    document.getElementById("statTotalTelat").textContent = totalAlpha;
    document.getElementById("statTotalJamKerja").textContent = formatDuration(totalDetik);
    document.getElementById("statPersentase").textContent = `${persentase}%`;
  }

  /**
   * Menentukan rentang tanggal & label deskriptif berdasarkan
   * filter yang dipilih (harian/mingguan/bulanan).
   * @param {"harian"|"mingguan"|"bulanan"} filter
   * @param {Date} today
   * @returns {{start: Date, label: string}}
   */
  function getRange(filter, today) {
    if (filter === "harian") {
      return { start: startOfDay(today), label: "Menampilkan data hari ini" };
    }
    if (filter === "mingguan") {
      return { start: startOfWeek(today), label: "Menampilkan data minggu ini (Senin – hari ini)" };
    }
    return { start: startOfMonth(today), label: "Menampilkan data bulan ini" };
  }

  /**
   * Menyaring `allRecords` sesuai filter periode aktif, lalu
   * merender ulang tabel & kartu ringkasan.
   * @param {"harian"|"mingguan"|"bulanan"} filter
   * @param {Array<object>} allRecords
   */
  function applyFilter(filter, allRecords) {
    const today = new Date();
    const { start, label } = getRange(filter, today);
    const end = startOfDay(today);

    const filtered = allRecords.filter((r) => {
      const d = startOfDay(r.date);
      return d >= start && d <= end;
    }).sort((a, b) => b.date - a.date);

    const totalDays = countAllDays(start, end);

    document.getElementById("riwayatPeriodeLabel").textContent = label;
    renderTable(filtered);
    renderStats(filtered, totalDays);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("riwayatTableBody");
    const tabs = document.getElementById("filterTabs");
    if (!tableBody || !tabs) return; // bukan halaman Riwayat

    if (typeof db === "undefined") {
      tableBody.innerHTML = `
        <tr><td colspan="${TABLE_COLUMN_COUNT}" style="text-align:center; color: var(--color-text-faint); padding: var(--sp-6) 0;">
          Gagal memuat modul penyimpanan (js/firebase-config.js).
        </td></tr>`;
      return;
    }

    // Tampilkan skeleton loading singkat sebelum data pertama masuk,
    // supaya transisi terasa mulus (berguna juga nanti kalau db
    // sungguhan (Firestore) punya latensi jaringan).
    window.renderTableSkeleton(tableBody, TABLE_COLUMN_COUNT, 4);

    let allRecords = [];
    let currentFilter = "harian";

    // Admin melihat data SEMUA karyawan; staff hanya melihat datanya
    // sendiri. Query Firestore-style ini otomatis menyesuaikan lewat
    // ada/tidaknya klausa where("nama", ...).
    const isAdmin = CURRENT_EMPLOYEE.role === "admin";
    const query = isAdmin
      ? db.collection("attendance")
      : db.collection("attendance").where("nama", "==", CURRENT_EMPLOYEE.nama);

    // Real-time listener — record baru dari attendance.js langsung
    // muncul di sini tanpa reload halaman.
    query.onSnapshot((snapshot) => {
        allRecords = snapshot.docs.map((doc) => docToRecord(doc.data()));
        applyFilter(currentFilter, allRecords);
      }, (err) => {
        console.error("Gagal memuat riwayat:", err);
        tableBody.innerHTML = `
          <tr><td colspan="${TABLE_COLUMN_COUNT}" style="text-align:center; color: var(--color-red-600); padding: var(--sp-6) 0;">
            Gagal memuat data riwayat dari penyimpanan lokal.
          </td></tr>`;
        window.showToast("Gagal memuat data riwayat.", "error");
      });

    // Klik tab filter (Harian/Mingguan/Bulanan) — ganti tab aktif
    // lalu render ulang tabel & ringkasan sesuai periode barunya.
    tabs.addEventListener("click", (e) => {
      const target = e.target.closest("[data-filter]");
      if (!target) return;

      tabs.querySelectorAll(".tab-item").forEach((t) => t.classList.remove("is-active"));
      target.classList.add("is-active");

      currentFilter = target.getAttribute("data-filter");
      applyFilter(currentFilter, allRecords);
    });

    // PDF & Excel Download button handler — dua-duanya pakai data
    // mentah yang sama (rawData), supaya isi file PDF & Excel selalu
    // konsisten dengan periode filter yang sedang aktif.
    function getFilteredRawData() {
      const today = new Date();
      const { start } = getRange(currentFilter, today);
      const end = startOfDay(today);

      const filtered = allRecords.filter((r) => {
        const d = startOfDay(r.date);
        return d >= start && d <= end;
      });

      return filtered.map(r => ({
        tanggal: r.date.toISOString().split('T')[0],
        nama: r.nama,
        checkIn: r.checkIn ? r.checkIn.toISOString() : null,
        checkOut: r.checkOut ? r.checkOut.toISOString() : null,
        totalJamKerjaDetik: r.totalJamKerjaDetik,
        status: r.status,
        checkInLat: r.checkInLat,
        checkInLong: r.checkInLong,
        checkOutLat: r.checkOutLat,
        checkOutLong: r.checkOutLong,
      }));
    }

    const pdfBtn = document.querySelector("[data-download-pdf]");
    if (pdfBtn) {
      pdfBtn.addEventListener("click", () => {
        const { label } = getRange(currentFilter, new Date());
        const rawData = getFilteredRawData();

        if (typeof window.generateAttendanceReport === "function") {
          window.generateAttendanceReport(rawData, "Laporan Kehadiran", label);
        } else {
          window.showToast("Fungsi PDF tidak tersedia.", "error");
        }
      });
    }

    const excelBtn = document.getElementById("btnExportExcelRiwayat");
    if (excelBtn) {
      excelBtn.addEventListener("click", () => {
        const rawData = getFilteredRawData();
        const isAdminView = CURRENT_EMPLOYEE.role === "admin";
        const prefix = isAdminView ? `Riwayat-Semua-${currentFilter}` : `Riwayat-${CURRENT_EMPLOYEE.nama}-${currentFilter}`;

        if (typeof window.generateAttendanceExcel === "function") {
          window.generateAttendanceExcel(rawData, prefix);
        } else {
          window.showToast("Fungsi Excel tidak tersedia.", "error");
        }
      });
    }
  });
})();
