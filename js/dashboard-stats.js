/* =========================================================
   DASHBOARD STATISTIK — kartu ringkasan + grafik Chart.js,
   sumber data lewat "db" (Firebase Firestore, lihat
   js/firebase-config.js).
   ========================================================= */

(function () {
  const DAY_LABELS_SHORT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  // Instance Chart.js disimpan supaya bisa di-destroy() sebelum
  // digambar ulang (mencegah grafik dobel saat data berubah).
  let weeklyChartInstance = null;
  let monthlyChartInstance = null;

  // Menyimpan snapshot data terakhir + filter staff yang dipilih di
  // dropdown, supaya saat admin ganti pilihan di dropdown, grafik
  // bisa langsung digambar ulang tanpa perlu menunggu snapshot baru.
  let latestRecords = [];
  let latestToday = new Date();
  let selectedStaffFilter = "all";
  let staffDropdownPopulated = false;

  // Bulan yang sedang dilihat di panel "Statistik Kehadiran" & grafik
  // bulanan. Default = bulan berjalan; admin bisa ganti lewat dropdown
  // #dashMonthFilter untuk lihat histori bulan-bulan sebelumnya.
  let selectedMonthDate = new Date();
  let monthDropdownPopulated = false;

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

  /** Mengembalikan tanggal terakhir (jam di-nol-kan) di bulan yang sama dengan `date`. @param {Date} date @returns {Date} */
  function endOfMonth(date) {
    const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Mengecek apakah `date` berada di bulan & tahun yang sama dengan `now`. @param {Date} date @param {Date} now @returns {boolean} */
  function isSameMonth(date, now) {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  /**
   * Menghitung jumlah SEMUA hari (termasuk Sabtu & Minggu) dari
   * `start` sampai `end` (inklusif) — dipakai sebagai penyebut Total
   * Alpha & Persentase Kehadiran di kartu Dashboard, supaya basis
   * hitungnya sama dengan Kalender Kehadiran (yang juga menandai
   * weekend tanpa data sebagai Alpha).
   * @param {Date} start
   * @param {Date} end
   * @returns {number}
   */
  function countAllDays(start, end) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((startOfDay(end) - startOfDay(start)) / msPerDay) + 1;
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
   * Menentukan apakah sebuah record dihitung "Hadir". Cek field
   * `status` eksplisit dulu — bukan cuma `checkIn` — supaya entri
   * manual "Hadir tanpa jam" (dari Kelola Data, checkIn null tapi
   * status="hadir") ikut terhitung. Konsisten dengan logic yang
   * sama di kelola-data.js dan riwayat.js.
   * @param {{checkIn: Date|null, status: string}} record
   * @returns {boolean}
   */
  function isHadir(record) {
    return record.status === "hadir" || !!record.checkIn;
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
      nama: data.nama || "-",
      checkIn: data.checkIn ? new Date(data.checkIn) : null,
      checkOut: data.checkOut ? new Date(data.checkOut) : null,
      totalJamKerjaDetik: data.totalJamKerjaDetik || 0,
      status: data.status || "belum",
    };
  }

  /**
   * Menghitung & menampilkan 4 kartu ringkasan bulan yang dipilih di
   * dropdown #dashMonthFilter (default bulan berjalan): Total Hadir,
   * Total Jam Kerja, Total Alpha, Persentase Kehadiran.
   * @param {Array<object>} records - seluruh record presensi karyawan
   * @param {Date} monthDate - tanggal acuan bulan yang ditampilkan (bisa bulan lampau)
   */
  function renderStatCards(records, monthDate) {
    // Kalau admin pilih staff tertentu di dropdown "Filter Statistik
    // Kehadiran", kartu ringkasan cuma menghitung data staff itu saja
    // (bukan gabungan semua karyawan) — konsisten dengan grafik.
    const filteredRecords = selectedStaffFilter === "all"
      ? records
      : records.filter((r) => r.nama === selectedStaffFilter);

    const monthStart = startOfMonth(monthDate);
    const now = new Date();
    // Kalau bulan yang dipilih adalah bulan berjalan, batasi sampai
    // hari ini (bulan belum selesai). Kalau bulan lampau, hitung
    // sampai tanggal terakhir bulan itu (sudah selesai penuh).
    const dayEnd = isSameMonth(monthDate, now) ? startOfDay(now) : endOfMonth(monthDate);

    const monthRecords = filteredRecords.filter((r) => {
      const d = startOfDay(r.date);
      return d >= monthStart && d <= dayEnd;
    });

    const totalHadir = monthRecords.filter(isHadir).length;
    const totalDetik = monthRecords.reduce((sum, r) => {
      return sum + (r.checkIn && r.checkOut ? r.totalJamKerjaDetik : 0);
    }, 0);
    const workingDays = countAllDays(monthStart, dayEnd);

    // Untuk admin (records berisi banyak karyawan sekaligus), penyebut
    // persentase dikalikan jumlah karyawan unik supaya tetap masuk akal.
    const uniqueEmployeeCount = new Set(monthRecords.map((r) => r.nama)).size || 1;
    const denominator = workingDays * uniqueEmployeeCount;
    const persentase = denominator > 0
      ? Math.min(100, Math.round((totalHadir / denominator) * 100))
      : 0;

    // Hitung alpha: jumlah SEMUA hari (termasuk weekend) dikali jumlah
    // karyawan, dikurangi total hadir — konsisten dengan Kalender
    // Kehadiran di Kelola Data yang juga menandai weekend tanpa data
    // sebagai Alpha.
    const totalAlpha = Math.max(0, denominator - totalHadir);

    // Rata-rata Kehadiran/Bulan: rata-rata hari hadir per karyawan
    // (dibagi jumlah karyawan unik yang punya record bulan ini).
    const rataKehadiran = uniqueEmployeeCount > 0
      ? Math.round((totalHadir / uniqueEmployeeCount) * 10) / 10
      : 0;

    // Rata-rata Jam Kerja/Bulan: rata-rata jam kerja PER HARI HADIR
    // (bukan dibagi 30 hari, supaya angkanya masuk akal — mewakili
    // "biasanya kerja berapa jam kalau masuk").
    const rataJamKerjaDetik = totalHadir > 0 ? totalDetik / totalHadir : 0;

    /** Helper kecil: set textContent kalau elemennya ada. @param {string} id @param {string|number} val */
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setText("dashStatHadir", totalHadir);
    setText("dashStatJamKerja", formatDuration(totalDetik));
    setText("dashStatTelat", totalAlpha);
    setText("dashStatRataHadir", `${rataKehadiran} hari`);
    setText("dashStatRataJamKerja", formatDuration(rataJamKerjaDetik));
    setText("dashStatPersentase", `${persentase}%`);
  }

  /**
   * Menghitung & menampilkan 4 kartu ringkasan hari ini:
   * Hadir hari ini, Alpha hari ini, Total jam kerja hari ini.
   * @param {Array<object>} records - seluruh record presensi karyawan
   * @param {Date} today
   */
  function renderTodayStats(records, today) {
    const todayStart = startOfDay(today);
    const todayEnd = startOfDay(today);

    const todayRecords = records.filter((r) => {
      const d = startOfDay(r.date);
      return d >= todayStart && d <= todayEnd;
    });

    const todayHadir = todayRecords.filter(isHadir).length;
    const todayDetik = todayRecords.reduce((sum, r) => {
      return sum + (r.checkIn && r.checkOut ? r.totalJamKerjaDetik : 0);
    }, 0);

    // Hitung alpha: jumlah karyawan unik yang belum hadir hari ini
    const uniqueEmployees = new Set(records.map((r) => r.nama));
    const employeesToday = new Set(todayRecords.filter(isHadir).map((r) => r.nama));
    const todayAlpha = Math.max(0, uniqueEmployees.size - employeesToday.size);

    /** Helper kecil: set textContent kalau elemennya ada. @param {string} id @param {string|number} val */
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setText("todayHadir", todayHadir);
    setText("todayTelat", todayAlpha);
    setText("todayJamKerja", formatDuration(todayDetik));
  }

  /**
   * Menggambar grafik bar bertumpuk "Kehadiran Mingguan" (Senin–Minggu,
   * minggu berjalan): tiap hari menunjukkan Hadir/Alpha.
   * @param {Array<object>} records
   * @param {Date} today
   */
  function buildWeeklyChart(records, today) {
    const canvas = document.getElementById("weeklyAttendanceChart");
    if (!canvas || typeof Chart === "undefined") return;

    // Kalau admin pilih staff tertentu di dropdown, grafik cuma
    // menghitung data staff itu saja (bukan gabungan semua karyawan).
    const filteredRecords = selectedStaffFilter === "all"
      ? records
      : records.filter((r) => r.nama === selectedStaffFilter);

    const weekStart = startOfWeek(today);
    const hadirData = [];
    const alphaData = [];

    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);

      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
      const isFuture = day > startOfDay(today);
      // Pakai filter() (bukan find()) supaya benar juga untuk admin,
      // yang datanya bisa berisi check-in beberapa karyawan di hari yang sama.
      const dayRecords = filteredRecords.filter((r) => sameDate(r.date, day) && isHadir(r));

      const hadir = dayRecords.length;
      const alpha = (!isWeekend && !isFuture && dayRecords.length === 0) ? 1 : 0;

      hadirData.push(hadir);
      alphaData.push(alpha);
    }

    if (weeklyChartInstance) weeklyChartInstance.destroy();
    weeklyChartInstance = new Chart(canvas, {
      type: "bar",
      data: {
        labels: DAY_LABELS_SHORT,
        datasets: [
          { label: "Hadir", data: hadirData, backgroundColor: "#2E9678", borderRadius: 4, maxBarThickness: 28 },
          { label: "Alpha", data: alphaData, backgroundColor: "#D9534F", borderRadius: 4, maxBarThickness: 28 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false } },
          // Tanpa "max: 1" — untuk admin, sumbu Y otomatis menyesuaikan
          // kalau ada beberapa karyawan hadir di hari yang sama.
          y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } },
        },
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 10, font: { family: "Inter", size: 11 } } },
        },
      },
    });
  }

  /**
   * Menggambar grafik garis "Kehadiran Bulanan": jumlah hari hadir
   * per kelompok minggu (Minggu 1–5) dalam bulan yang dipilih di
   * dropdown #dashMonthFilter (default bulan berjalan).
   * @param {Array<object>} records
   * @param {Date} monthDate - tanggal acuan bulan yang ditampilkan (bisa bulan lampau)
   */
  function buildMonthlyChart(records, monthDate) {
    const canvas = document.getElementById("monthlyAttendanceChart");
    if (!canvas || typeof Chart === "undefined") return;

    const filteredRecords = selectedStaffFilter === "all"
      ? records
      : records.filter((r) => r.nama === selectedStaffFilter);

    const now = new Date();
    const isCurrentMonth = isSameMonth(monthDate, now);
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();

    const weekBuckets = [];
    for (let d = 1; d <= daysInMonth; d += 7) {
      weekBuckets.push({ from: d, to: Math.min(d + 6, daysInMonth) });
    }

    const labels = weekBuckets.map((w, i) => `Minggu ${i + 1}`);
    const hadirData = weekBuckets.map((w) => {
      let count = 0;
      for (let day = w.from; day <= w.to; day++) {
        const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
        // Cutoff "belum lewat hari ini" cuma relevan kalau yang
        // ditampilkan bulan berjalan. Bulan lampau sudah selesai penuh.
        if (isCurrentMonth && date > startOfDay(now)) continue;
        // filter().length (bukan find()) supaya benar juga untuk admin
        // yang datanya berisi check-in beberapa karyawan per hari.
        count += filteredRecords.filter((r) => sameDate(r.date, date) && isHadir(r)).length;
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

  /**
   * Merender daftar aktivitas presensi HARI INI ke #dashTimeline,
   * diurutkan dari check-in terbaru. Menggantikan 4 baris dummy
   * yang sebelumnya ditulis manual di index.html.
   * @param {Array<object>} records - seluruh record presensi (sudah difilter admin/staff)
   * @param {Date} today
   */
  function renderTimeline(records, today) {
    const container = document.getElementById("dashTimeline");
    if (!container) return;

    const todayRecords = records
      .filter((r) => sameDate(r.date, today) && r.checkIn)
      .sort((a, b) => b.checkIn - a.checkIn);

    if (!todayRecords.length) {
      container.innerHTML = `
        <div style="text-align:center; color: var(--color-text-faint); padding: var(--sp-6) 0;">
          Belum ada aktivitas presensi hari ini.
        </div>`;
      return;
    }

    container.innerHTML = todayRecords.map((r) => {
      const initials = (r.nama || "-").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      const jam = `${pad(r.checkIn.getHours())}:${pad(r.checkIn.getMinutes())}`;
      const meta = r.checkOut ? "Sudah check-out" : "Sedang bekerja";
      const badge = '<span class="status-badge status-badge--hadir">Hadir</span>';
      return `
        <div class="timeline__item">
          <div class="timeline__time mono">${jam}</div>
          <div class="timeline__avatar">${initials}</div>
          <div class="timeline__body">
            <div class="timeline__name">${r.nama}</div>
            <div class="timeline__meta">Melakukan check-in — ${meta}</div>
          </div>
          ${badge}
        </div>`;
    }).join("");
  }

  /**
   * Merender persentase kehadiran MINGGU INI per-karyawan ke
   * #dashWeeklySummary. Menggantikan progress bar dummy per-divisi
   * (data divisi memang tidak ada di struktur data attendance).
   * @param {Array<object>} records - seluruh record presensi (sudah difilter admin/staff)
   * @param {Date} today
   */
  function renderWeeklySummary(records, today) {
    const container = document.getElementById("dashWeeklySummary");
    if (!container) return;

    const weekStart = startOfWeek(today);
    const dayEnd = startOfDay(today);
    const workingDays = countWeekdays(weekStart, dayEnd) || 1;

    const weekRecords = records.filter((r) => {
      const d = startOfDay(r.date);
      return d >= weekStart && d <= dayEnd;
    });

    const byEmployee = {};
    weekRecords.forEach((r) => {
      if (!r.checkIn) return;
      byEmployee[r.nama] = (byEmployee[r.nama] || 0) + 1;
    });

    const names = Object.keys(byEmployee);
    if (!names.length) {
      container.innerHTML = `
        <div style="text-align:center; color: var(--color-text-faint); padding: var(--sp-6) 0;">
          Belum ada data kehadiran minggu ini.
        </div>`;
      return;
    }

    container.innerHTML = names.map((nama) => {
      const persen = Math.min(100, Math.round((byEmployee[nama] / workingDays) * 100));
      return `
        <div class="progress-row">
          <div class="progress-row__top"><span>${nama}</span><strong class="mono">${persen}%</strong></div>
          <div class="progress-track"><div class="progress-fill" style="width:${persen}%"></div></div>
        </div>`;
    }).join("");
  }

  /**
   * Menunggu Chart.js selesai dimuat dari CDN sebelum menggambar
   * grafik. Sebelumnya, kalau CDN lambat/gagal, kode langsung
   * "return" diam-diam tanpa pemberitahuan apapun ke user — jadi
   * grafik kelihatan kosong tanpa alasan yang jelas. Sekarang akan
   * dicoba ulang beberapa kali, dan kalau tetap gagal baru muncul
   * pesan error yang jelas.
   * @param {Function} callback - dipanggil begitu Chart.js siap
   */
  function waitForChart(callback, attemptsLeft) {
    if (attemptsLeft === undefined) attemptsLeft = 20; // ~5 detik (20 x 250ms)

    if (typeof Chart !== "undefined") {
      callback();
      return;
    }

    if (attemptsLeft <= 0) {
      console.error("Chart.js gagal dimuat dari CDN (cdnjs.cloudflare.com) setelah beberapa kali percobaan.");
      window.showToast("Gagal memuat library grafik (Chart.js). Cek koneksi internet Anda.", "error");
      return;
    }

    setTimeout(() => waitForChart(callback, attemptsLeft - 1), 250);
  }

  /**
   * Merender tabel status kehadiran hari ini untuk SELURUH karyawan
   * (khusus admin). Sumber daftar karyawan dari window.Auth.USERS
   * (bukan dari collection "attendance", supaya karyawan yang belum
   * pernah absen hari ini tetap muncul dengan status "Alpha").
   * @param {Array<object>} records - seluruh record presensi (semua karyawan)
   * @param {Date} today
   */
  function renderEmployeeStatusTable(records, today) {
    const tbody = document.getElementById("employeeStatusTableBody");
    if (!tbody) return;

    const staffList = ((window.Auth && window.Auth.USERS) || [])
      .filter((u) => u.role === "staff");

    const monthStart = startOfMonth(today);
    const dayEnd = startOfDay(today);

    const rows = staffList.map((user) => {
      const todayRecord = records.find((r) =>
        r.nama === user.nama && sameDate(r.date, today) && isHadir(r)
      );

      const monthRecordsForUser = records.filter((r) =>
        r.nama === user.nama && startOfDay(r.date) >= monthStart && startOfDay(r.date) <= dayEnd
      );
      const hadirBulanIni = monthRecordsForUser.filter(isHadir).length;
      const workingDaysSoFar = countAllDays(monthStart, dayEnd);

      return {
        nama: user.nama,
        isHadir: !!todayRecord,
        jamMasuk: todayRecord && todayRecord.checkIn ? formatClock(todayRecord.checkIn) : "-",
        jamKeluar: todayRecord && todayRecord.checkOut ? formatClock(todayRecord.checkOut) : (todayRecord ? "Belum checkout" : "-"),
        jamKerja: todayRecord && todayRecord.checkIn && todayRecord.checkOut ? formatDuration(todayRecord.totalJamKerjaDetik) : "-",
        hadirBulanIni,
        workingDaysSoFar,
      };
    });

    // Alpha (belum hadir) ditampilkan lebih dulu supaya langsung terlihat admin.
    rows.sort((a, b) => Number(a.isHadir) - Number(b.isHadir));

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: var(--sp-6) 0;">Belum ada data karyawan.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((row) => `
      <tr>
        <td>${row.nama}</td>
        <td>
          <span class="status-badge ${row.isHadir ? "status-badge--hadir" : "status-badge--alpha"}">
            ${row.isHadir ? "Hadir" : "Alpha"}
          </span>
        </td>
        <td class="mono">${row.jamMasuk}</td>
        <td class="mono">${row.jamKeluar}</td>
        <td class="mono">${row.jamKerja}</td>
        <td class="mono">${row.hadirBulanIni}/${row.workingDaysSoFar} hari</td>
        <td>
          <a href="/kelola-kunci-profil?cari=${encodeURIComponent(row.nama)}" class="btn btn--secondary" style="text-decoration:none; padding: 4px 10px; font-size: var(--fs-xs);">
            Lihat Profil
          </a>
        </td>
      </tr>
    `).join("");
  }

  /**
   * Merender ringkasan info sistem: total karyawan aktif, total
   * record presensi tersimpan, rentang tanggal data, dan kapan
   * data terakhir diperbarui (khusus admin).
   * @param {Array<object>} records - seluruh record presensi (semua karyawan)
   */
  function renderSystemInfo(records) {
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    const staffCount = ((window.Auth && window.Auth.USERS) || [])
      .filter((u) => u.role === "staff").length;

    setText("sysInfoTotalKaryawan", staffCount);
    setText("sysInfoTotalRecord", records.length);

    if (records.length > 0) {
      const dates = records.map((r) => r.date.getTime());
      const earliest = new Date(Math.min(...dates));
      const latest = new Date(Math.max(...dates));
      setText("sysInfoRentangTanggal", `${formatShortDate(earliest)} - ${formatShortDate(latest)}`);
    } else {
      setText("sysInfoRentangTanggal", "-");
    }

    setText("sysInfoUpdateTerakhir", formatClock(new Date()));
  }

  /** Memformat Date menjadi jam "HH:MM". @param {Date} date @returns {string} */
  function formatClock(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  /** Memformat Date menjadi tanggal singkat "DD/MM/YYYY". @param {Date} date @returns {string} */
  function formatShortDate(date) {
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  /**
   * Mengisi dropdown filter grafik dengan daftar staff (sekali saja),
   * lalu daftarkan event listener buat gambar ulang grafik begitu
   * admin ganti pilihan.
   */
  function setupChartStaffFilter() {
    const select = document.getElementById("chartStaffFilter");
    if (!select || staffDropdownPopulated) return;

    const staffList = ((window.Auth && window.Auth.USERS) || [])
      .filter((u) => u.role === "staff");

    staffList.forEach((user) => {
      const option = document.createElement("option");
      option.value = user.nama;
      option.textContent = user.nama;
      select.appendChild(option);
    });

    select.addEventListener("change", (e) => {
      selectedStaffFilter = e.target.value;
      renderStatCards(latestRecords, selectedMonthDate);
      buildWeeklyChart(latestRecords, latestToday);
      buildMonthlyChart(latestRecords, selectedMonthDate);
      updateStatsPanelSubtitle();
    });

    staffDropdownPopulated = true;
  }

  /**
   * Memformat Date jadi label "Bulan Tahun" berbahasa Indonesia.
   * @param {Date} date
   * @returns {string}
   */
  function monthLabel(date) {
    return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
  }

  /**
   * Menyesuaikan teks subjudul panel "Statistik Kehadiran" dan
   * grafik bulanan supaya jelas bulan mana yang sedang ditampilkan.
   */
  function updateStatsPanelSubtitle() {
    const now = new Date();
    const monthPart = isSameMonth(selectedMonthDate, now)
      ? "bulan berjalan"
      : monthLabel(selectedMonthDate);
    const staffPart = selectedStaffFilter === "all" ? "Anda" : selectedStaffFilter;

    const statsSub = document.getElementById("statsPanelSubtitle");
    if (statsSub) statsSub.textContent = `Berdasarkan data presensi ${staffPart} pada ${monthPart}`;

    const chartSub = document.getElementById("monthlyChartSubtitle");
    if (chartSub) chartSub.textContent = `Per minggu, ${monthPart}`;
  }

  /**
   * Mengisi dropdown #dashMonthFilter dengan 12 bulan terakhir
   * (bulan berjalan + 11 bulan ke belakang), lalu daftarkan event
   * listener buat menampilkan ulang kartu statistik & grafik bulanan
   * begitu admin/staff ganti bulan yang dipilih.
   */
  function setupMonthFilter() {
    const select = document.getElementById("dashMonthFilter");
    if (!select || monthDropdownPopulated) return;

    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const option = document.createElement("option");
      option.value = `${d.getFullYear()}-${d.getMonth()}`;
      option.textContent = i === 0 ? `${monthLabel(d)} (berjalan)` : monthLabel(d);
      select.appendChild(option);
    }
    select.value = `${now.getFullYear()}-${now.getMonth()}`;

    select.addEventListener("change", (e) => {
      const [y, m] = e.target.value.split("-").map(Number);
      selectedMonthDate = new Date(y, m, 1);
      renderStatCards(latestRecords, selectedMonthDate);
      buildMonthlyChart(latestRecords, selectedMonthDate);
      updateStatsPanelSubtitle();
    });

    monthDropdownPopulated = true;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const weeklyCanvas = document.getElementById("weeklyAttendanceChart");
    if (!weeklyCanvas) return; // bukan halaman Dashboard

    if (typeof db === "undefined") {
      console.error("Gagal memuat modul penyimpanan (js/firebase-config.js).");
      window.showToast("Gagal memuat modul penyimpanan data.", "error");
      return;
    }

    // Admin melihat statistik gabungan SEMUA karyawan; staff hanya
    // melihat datanya sendiri.
    const isAdmin = CURRENT_EMPLOYEE.role === "admin";
    const query = isAdmin
      ? db.collection("attendance")
      : db.collection("attendance").where("nama", "==", CURRENT_EMPLOYEE.nama);

    // Real-time listener — kartu, timeline, ringkasan & grafik
    // otomatis update begitu ada check-in/check-out baru, tanpa
    // perlu reload halaman.
    query.onSnapshot((snapshot) => {
        const records = snapshot.docs.map((doc) => docToRecord(doc.data()));
        const today = new Date();

        latestRecords = records;
        latestToday = today;

        renderTodayStats(records, today);
        renderStatCards(records, selectedMonthDate);
        renderTimeline(records, today);
        renderWeeklySummary(records, today);

        setupMonthFilter();
        updateStatsPanelSubtitle();

        // Untuk admin, render tambahan tabel status karyawan dan info sistem
        if (isAdmin) {
          renderEmployeeStatusTable(records, today);
          renderSystemInfo(records);
          setupChartStaffFilter();
        }

        // Chart.js kadang belum siap saat snapshot pertama datang
        // (misal koneksi CDN lambat) — tunggu dulu sebelum menggambar.
        waitForChart(() => {
          buildWeeklyChart(records, today);
          buildMonthlyChart(records, selectedMonthDate);
        });
      }, (err) => {
        console.error("Gagal memuat statistik dashboard:", err);
        window.showToast("Gagal memuat statistik dashboard.", "error");
      });
  });
})();
