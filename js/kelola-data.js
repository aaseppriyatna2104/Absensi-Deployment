/* =========================================================
   KELOLA DATA — halaman khusus admin untuk melihat, mengedit,
   dan menghapus data presensi (per baris atau semuanya) lewat
   Firestore ("db", didefinisikan di js/firebase-config.js).
   ========================================================= */

(function () {
  const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
  ];
  const MONTH_NAMES_FULL = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  let allRecords = []; // { id, nama, tanggal, checkIn, checkOut, totalJamKerjaDetik, status, checkInLat, checkInLong, checkOutLat, checkOutLong }
  let editingId = null;

  // Calendar state
  let calendarStaffId = null;
  let calendarStaffName = null;
  let calendarYear = new Date().getFullYear();
  let calendarMonth = new Date().getMonth(); // 0-11
  let calendarAttendanceData = {}; // { "YYYY-MM-DD": { checkIn, checkOut, status } }

  /** Menambahkan angka nol di depan kalau kurang dari 2 digit. @param {number} n @returns {string} */
  function pad(n) { return String(n).padStart(2, "0"); }

  /** Memformat objek Date menjadi jam "HH:MM:SS". @param {Date} date @returns {string} */
  function formatClock(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  /** Memformat string tanggal "YYYY-MM-DD" menjadi "DD Mon YYYY". @param {string} tanggal @returns {string} */
  function formatDateShort(tanggal) {
    const [y, m, d] = tanggal.split("-").map(Number);
    return `${pad(d)} ${MONTH_NAMES[m - 1]} ${y}`;
  }

  /** Memformat durasi dalam detik menjadi "HH:MM:SS". @param {number} seconds @returns {string} */
  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(seconds || 0));
    const h = pad(Math.floor(total / 3600));
    const m = pad(Math.floor((total % 3600) / 60));
    const s = pad(total % 60);
    return `${h}:${m}:${s}`;
  }

  /**
   * Membentuk markup link "Lihat Peta" kalau koordinat GPS ada.
   * Sengaja pakai `!= null` (bukan truthy check) supaya koordinat 0
   * (mis. tepat di garis khatulistiwa/meridian) tetap dianggap valid,
   * bukan dibaca sebagai "tidak ada data".
   * @param {number|null|undefined} lat
   * @param {number|null|undefined} long
   * @param {number|null|undefined} [accuracy] - radius akurasi GPS dalam meter
   * @returns {string}
   */
  function mapLink(lat, long, accuracy) {
    if (lat == null || long == null) return "-";
    const accuracyLabel = (typeof accuracy === "number")
      ? ` <span style="color: var(--color-text-faint); font-size: var(--fs-xs, 11px);">(±${Math.round(accuracy)}m)</span>`
      : "";
    return `<a href="https://maps.google.com/?q=${lat},${long}" target="_blank" style="color: var(--color-teal-600); text-decoration: none;">Lihat Peta</a>${accuracyLabel}`;
  }

  /** Membentuk markup badge status untuk satu baris. @param {object} r @returns {string} */
  function statusBadge(r) {
    if (!r.checkIn) return '<span class="status-badge status-badge--alpha">Alpha</span>';
    return '<span class="status-badge status-badge--hadir">Hadir</span>';
  }

  /**
   * Render tabel berdasarkan daftar record yang sudah difilter
   * pencarian (kalau ada).
   * @param {string} [searchTerm]
   */
  function renderTable(searchTerm) {
    const tbody = document.getElementById("kelolaTableBody");
    const countLabel = document.getElementById("kelolaCountLabel");

    let records = allRecords.slice().sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    if (searchTerm) {
      const term = searchTerm.trim().toLowerCase();
      records = records.filter((r) => r.nama.toLowerCase().includes(term));
    }

    countLabel.textContent = `${records.length} data presensi ditemukan`;

    if (!records.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center; color: var(--color-text-faint); padding: var(--sp-6) 0;">
            Tidak ada data presensi.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = records.map((r) => {
      const checkInLocation = mapLink(r.checkInLat, r.checkInLong, r.checkInAccuracy);
      const checkOutLocation = mapLink(r.checkOutLat, r.checkOutLong, r.checkOutAccuracy);

      return `
      <tr data-id="${r.id}">
        <td class="mono">${formatDateShort(r.tanggal)}</td>
        <td>${r.nama}</td>
        <td class="cell-time mono">${r.checkIn ? formatClock(new Date(r.checkIn)) : "—:—"}</td>
        <td class="cell-time mono">${r.checkOut ? formatClock(new Date(r.checkOut)) : "—:—"}</td>
        <td class="cell-time mono">${r.checkIn && r.checkOut ? formatDuration(r.totalJamKerjaDetik) : "00:00:00"}</td>
        <td>${statusBadge(r)}</td>
        <td>${checkInLocation}</td>
        <td>${checkOutLocation}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-edit="${r.id}">Edit</button>
            <button type="button" class="danger" data-delete="${r.id}">Hapus</button>
          </div>
        </td>
      </tr>`;
    }).join("");
  }

  /** Membuka modal edit untuk satu record berdasarkan ID. @param {string} id */
  function openEditModal(id) {
    const record = allRecords.find((r) => r.id === id);
    if (!record) return;

    editingId = id;
    document.getElementById("editModalSub").textContent = `${record.nama} — ${formatDateShort(record.tanggal)}`;

    const checkInEl = document.getElementById("editCheckIn");
    const checkOutEl = document.getElementById("editCheckOut");

    checkInEl.value = record.checkIn ? formatClock(new Date(record.checkIn)) : "";
    checkOutEl.value = record.checkOut ? formatClock(new Date(record.checkOut)) : "";

    document.getElementById("editModal").classList.add("is-open");
  }

  /** Menutup modal edit. */
  function closeEditModal() {
    editingId = null;
    document.getElementById("editModal").classList.remove("is-open");
  }

  /**
   * Menggabungkan tanggal record ("YYYY-MM-DD") dengan jam dari
   * input <input type="time"> menjadi ISO datetime string.
   * @param {string} tanggal
   * @param {string} timeStr - format "HH:MM" atau "HH:MM:SS"
   * @returns {string|null}
   */
  function combineDateTime(tanggal, timeStr) {
    if (!timeStr) return null;
    const [y, m, d] = tanggal.split("-").map(Number);
    const parts = timeStr.split(":").map(Number);
    const date = new Date(y, m - 1, d, parts[0] || 0, parts[1] || 0, parts[2] || 0);
    return date.toISOString();
  }

  /** Menyimpan perubahan hasil edit ke Firestore. */
  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingId) return;

    const record = allRecords.find((r) => r.id === editingId);
    if (!record) return;

    const btn = document.getElementById("btnSaveEdit");
    window.setButtonLoading(btn, true, "Menyimpan...");

    try {
      const checkInStr = document.getElementById("editCheckIn").value;
      const checkOutStr = document.getElementById("editCheckOut").value;

      const newCheckIn = combineDateTime(record.tanggal, checkInStr);
      const newCheckOut = combineDateTime(record.tanggal, checkOutStr);

      // Hitung total jam kerja dari check-in dan check-out
      let totalJamKerjaDetik = 0;
      if (newCheckIn && newCheckOut) {
        totalJamKerjaDetik = Math.max(0, Math.floor((new Date(newCheckOut) - new Date(newCheckIn)) / 1000));
      }

      await db.collection("attendance").doc(editingId).set({
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        totalJamKerjaDetik,
        status: newCheckIn ? "hadir" : "belum",
      }, { merge: true });

      window.showToast("Data berhasil diperbarui.", "success");
      closeEditModal();
      await loadAllRecords();
    } catch (err) {
      console.error("Gagal menyimpan edit:", err);
      window.showToast("Gagal menyimpan perubahan.", "error");
    } finally {
      window.setButtonLoading(btn, false);
    }
  }

  /** Menghapus satu record berdasarkan ID, setelah konfirmasi. @param {string} id */
  async function handleDeleteOne(id) {
    const record = allRecords.find((r) => r.id === id);
    if (!record) return;

    const confirmed = window.confirm(`Hapus data presensi ${record.nama} pada ${formatDateShort(record.tanggal)}?`);
    if (!confirmed) return;

    try {
      await db.collection("attendance").doc(id).delete();
      window.showToast("Data berhasil dihapus.", "success");
      await loadAllRecords();
    } catch (err) {
      console.error("Gagal menghapus data:", err);
      window.showToast("Gagal menghapus data.", "error");
    }
  }

  /** Menghapus SEMUA data presensi, setelah konfirmasi ganda. */
  async function handleDeleteAll() {
    if (!allRecords.length) {
      window.showToast("Tidak ada data untuk dihapus.", "info");
      return;
    }

    const confirmed = window.confirm(`Yakin hapus SEMUA ${allRecords.length} data presensi? Aksi ini tidak bisa dibatalkan.`);
    if (!confirmed) return;

    const doubleConfirmed = window.confirm("Konfirmasi sekali lagi: benar-benar hapus semua data?");
    if (!doubleConfirmed) return;

    const btn = document.getElementById("btnHapusSemua");
    window.setButtonLoading(btn, true, "Menghapus...");

    try {
      const batch = db.batch();
      const snapshot = await db.collection("attendance").get();
      snapshot.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      window.showToast("Semua data presensi berhasil dihapus.", "success");
      await loadAllRecords();
    } catch (err) {
      console.error("Gagal menghapus semua data:", err);
      window.showToast("Gagal menghapus semua data.", "error");
    } finally {
      window.setButtonLoading(btn, false);
    }
  }

  /** Mengambil ulang seluruh data attendance dari Firestore lalu render tabel. */
  async function loadAllRecords() {
    const tbody = document.getElementById("kelolaTableBody");
    window.renderTableSkeleton(tbody, 9, 4);

    try {
      const snapshot = await db.collection("attendance").get();
      allRecords = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderTable(document.getElementById("searchInput").value);
    } catch (err) {
      console.error("Gagal memuat data:", err);
      tbody.innerHTML = `
        <tr><td colspan="9" style="text-align:center; color: var(--color-red-600); padding: var(--sp-6) 0;">
          Gagal memuat data presensi.
        </td></tr>`;
      window.showToast("Gagal memuat data presensi.", "error");
    }
  }

  // ==================== CALENDAR FUNCTIONS ====================

  /**
   * Load daftar staff untuk dropdown kalender.
   *
   * Sengaja sumber datanya dari `window.Auth.USERS` (auth.js),
   * BUKAN dari `db.collection("users")` — collection itu tidak
   * pernah ditulis oleh bagian mana pun dari aplikasi ini (sistem
   * akun di project ini jalan lewat auth.js + collection
   * "profiles"), jadi query lama selalu balik kosong dan dropdown
   * cuma berisi placeholder "Pilih Karyawan..." tanpa satu pun
   * opsi nama staff.
   */
  async function loadStaffList() {
    try {
      const select = document.getElementById("calendarStaffSelect");
      select.innerHTML = '<option value="">Pilih Karyawan...</option>';

      const staffUsers = ((window.Auth && window.Auth.USERS) || [])
        .filter((u) => u.role === "staff");

      staffUsers.forEach((user) => {
        const option = document.createElement("option");
        option.value = user.username;
        option.textContent = user.nama;
        select.appendChild(option);
      });

      if (!staffUsers.length) {
        console.warn("Tidak ada akun dengan role 'staff' di window.Auth.USERS.");
      }
    } catch (err) {
      console.error("Gagal memuat daftar staff:", err);
      window.showToast("Gagal memuat daftar karyawan.", "error");
    }
  }

  /**
   * Load data attendance untuk staff dan bulan yang dipilih.
   *
   * Catatan implementasi:
   * - Query Firestore sengaja HANYA pakai satu filter equality (`nama`),
   *   lalu filter tanggal/bulan dilakukan di JS. Ini menghindari
   *   kebutuhan composite index (equality + range) yang kalau belum
   *   dibuat di Firestore console akan bikin query reject dan kalender
   *   keliatan kosong tanpa pesan error apa pun.
   * - Karena dokumen attendance cuma nyimpen field `nama` (bukan uid
   *   staff), pencocokan tetap berbasis nama — tapi di-trim & tahan
   *   beda besar/kecil huruf supaya lebih toleran terhadap selisih
   *   spasi/kapitalisasi antara data di collection `users` & `attendance`.
   * - Kalau ada lebih dari satu dokumen attendance untuk tanggal yang
   *   sama, prioritas dipilih deterministik: yang sudah check-out
   *   menang atas yang cuma check-in.
   */
  async function loadCalendarAttendance() {
    if (!calendarStaffId || !calendarStaffName) return;

    const container = document.getElementById("calendarDays");
    if (container) {
      container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--color-text-faint); padding: var(--sp-6) 0;">Memuat data kalender...</div>`;
    }

    try {
      const targetName = calendarStaffName.trim().toLowerCase();
      const monthPrefix = `${calendarYear}-${pad(calendarMonth + 1)}-`;

      const snapshot = await db.collection("attendance")
        .where("nama", "==", calendarStaffName)
        .get();

      calendarAttendanceData = {};
      let matchedAnyName = false;

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.nama || data.nama.trim().toLowerCase() !== targetName) return;
        matchedAnyName = true;
        if (!data.tanggal || !data.tanggal.startsWith(monthPrefix)) return;

        const existing = calendarAttendanceData[data.tanggal];
        // Kalau ada duplikat di tanggal yang sama, prioritaskan yang
        // sudah check-out supaya hasilnya konsisten (bukan random
        // tergantung urutan snapshot dari Firestore).
        if (existing && existing.checkOut && !data.checkOut) return;

        calendarAttendanceData[data.tanggal] = {
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          status: data.status,
          totalJamKerjaDetik: data.totalJamKerjaDetik,
          checkInLat: data.checkInLat,
          checkInLong: data.checkInLong,
          checkInAccuracy: data.checkInAccuracy,
          checkOutLat: data.checkOutLat,
          checkOutLong: data.checkOutLong,
          checkOutAccuracy: data.checkOutAccuracy
        };
      });

      renderCalendar();

      if (!matchedAnyName) {
        window.showToast(
          `Tidak ditemukan data presensi apa pun untuk "${calendarStaffName}". Cek kemungkinan nama di data presensi beda dengan nama di daftar staff.`,
          "warning"
        );
      }
    } catch (err) {
      console.error("Gagal memuat data kalender:", err);
      if (container) {
        container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--color-red-600); padding: var(--sp-6) 0;">Gagal memuat data kalender. Coba refresh halaman.</div>`;
      }
      window.showToast("Gagal memuat data kalender.", "error");
    }
  }

  /** Render kalender berdasarkan bulan dan tahun yang dipilih */
  function renderCalendar() {
    const container = document.getElementById("calendarDays");
    const monthLabel = document.getElementById("calendarMonthLabel");

    monthLabel.textContent = `${MONTH_NAMES_FULL[calendarMonth]} ${calendarYear}`;

    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
    const startDay = firstDay.getDay(); // 0 = Minggu, 1 = Senin, dst.
    const totalDays = lastDay.getDate();

    // Adjust untuk start hari Senin (bukan Minggu)
    const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;

    let html = "";

    // Empty cells sebelum tanggal 1
    for (let i = 0; i < adjustedStartDay; i++) {
      html += `<div class="calendar-day empty"></div>`;
    }

    // Days
    const today = new Date();
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${calendarYear}-${pad(calendarMonth + 1)}-${pad(day)}`;
      const isToday = today.getFullYear() === calendarYear &&
                      today.getMonth() === calendarMonth &&
                      today.getDate() === day;

      const attendance = calendarAttendanceData[dateStr];
      let statusHtml = "";

      if (attendance) {
        if (attendance.checkOut) {
          statusHtml = `<div class="calendar-status calendar-status--hadir">✓ Hadir</div>`;
        } else if (attendance.checkIn) {
          statusHtml = `<div class="calendar-status calendar-status--working">⏳ Bekerja</div>`;
        }
      } else {
        statusHtml = `<div class="calendar-status calendar-status--alpha">✗ Alpha</div>`;
      }

      html += `
        <div class="calendar-day ${isToday ? 'today' : ''}" data-date="${dateStr}">
          <div class="calendar-day-number">${day}</div>
          ${statusHtml}
        </div>
      `;
    }

    container.innerHTML = html;
  }

  /** Buka modal detail untuk tanggal yang dipilih */
  function openCalendarDetail(dateStr) {
    const attendance = calendarAttendanceData[dateStr];
    const modal = document.getElementById("calendarDetailModal");
    const sub = document.getElementById("calendarDetailSub");
    const content = document.getElementById("calendarDetailContent");

    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

    sub.textContent = `${calendarStaffName} — ${dayNames[date.getDay()]}, ${d} ${MONTH_NAMES_FULL[m - 1]} ${y}`;

    if (attendance) {
      const checkInTime = attendance.checkIn ? formatClock(new Date(attendance.checkIn)) : "-";
      const checkOutTime = attendance.checkOut ? formatClock(new Date(attendance.checkOut)) : "-";
      const workDuration = attendance.totalJamKerjaDetik ? formatDuration(attendance.totalJamKerjaDetik) : "00:00:00";
      const checkInLocation = mapLink(attendance.checkInLat, attendance.checkInLong, attendance.checkInAccuracy);
      const checkOutLocation = mapLink(attendance.checkOutLat, attendance.checkOutLong, attendance.checkOutAccuracy);

      content.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4);">
          <div>
            <div style="font-size: var(--fs-sm); color: var(--color-text-muted); margin-bottom: var(--sp-1);">Jam Check In</div>
            <div style="font-weight: 600;">${checkInTime}</div>
          </div>
          <div>
            <div style="font-size: var(--fs-sm); color: var(--color-text-muted); margin-bottom: var(--sp-1);">Jam Check Out</div>
            <div style="font-weight: 600;">${checkOutTime}</div>
          </div>
          <div>
            <div style="font-size: var(--fs-sm); color: var(--color-text-muted); margin-bottom: var(--sp-1);">Total Jam Kerja</div>
            <div style="font-weight: 600;">${workDuration}</div>
          </div>
          <div>
            <div style="font-size: var(--fs-sm); color: var(--color-text-muted); margin-bottom: var(--sp-1);">Status</div>
            <div style="font-weight: 600;">${attendance.checkOut ? 'Hadir' : 'Sedang Bekerja'}</div>
          </div>
          <div>
            <div style="font-size: var(--fs-sm); color: var(--color-text-muted); margin-bottom: var(--sp-1);">Lokasi Check-in</div>
            <div style="font-weight: 600;">${checkInLocation}</div>
          </div>
          <div>
            <div style="font-size: var(--fs-sm); color: var(--color-text-muted); margin-bottom: var(--sp-1);">Lokasi Check-out</div>
            <div style="font-weight: 600;">${checkOutLocation}</div>
          </div>
        </div>
      `;
    } else {
      content.innerHTML = `
        <div style="text-align: center; color: var(--color-red-600); padding: var(--sp-4);">
          <div style="font-size: 48px; margin-bottom: var(--sp-2);">✗</div>
          <div style="font-weight: 600;">Alpha</div>
          <div style="font-size: var(--fs-sm); color: var(--color-text-muted);">Tidak ada data presensi</div>
        </div>
      `;
    }

    modal.classList.add("is-open");
  }

  /** Tutup modal detail kalender */
  function closeCalendarDetail() {
    document.getElementById("calendarDetailModal").classList.remove("is-open");
  }

  /** Export kalender ke PDF */
  function exportCalendarToPDF() {
    if (!calendarStaffId) {
      window.showToast("Pilih karyawan terlebih dahulu.", "warning");
      return;
    }

    const calendarContainer = document.getElementById("calendarContainer");
    const monthLabel = `${MONTH_NAMES_FULL[calendarMonth]} ${calendarYear}`;

    if (typeof window.generateCalendarReport === "function") {
      window.generateCalendarReport(calendarContainer, calendarStaffName, monthLabel);
    } else {
      // Fallback: gunakan html2pdf langsung
      const element = calendarContainer;
      const opt = {
        margin: 10,
        filename: `Kalender-${calendarStaffName}-${monthLabel}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      html2pdf().set(opt).from(element).save();
    }
  }

  /**
   * Mengisi dropdown karyawan di form Input Manual Presensi.
   * Sumber data sama seperti dropdown kalender: window.Auth.USERS.
   */
  function loadManualStaffList() {
    const select = document.getElementById("manualKaryawan");
    if (!select) return;
    select.innerHTML = '<option value="">Pilih karyawan...</option>';

    ((window.Auth && window.Auth.USERS) || [])
      .filter((u) => u.role === "staff")
      .forEach((user) => {
        const option = document.createElement("option");
        option.value = user.username;
        option.textContent = user.nama;
        select.appendChild(option);
      });
  }

  /**
   * Menyesuaikan tampilan form input manual sesuai status yang
   * dipilih: kalau "Alpha", input jam & checkbox "tanpa jam"
   * disembunyikan karena tidak relevan (Alpha = tidak hadir).
   */
  function updateManualFormVisibility() {
    const status = document.getElementById("manualStatus").value;
    const tanpaJam = document.getElementById("manualTanpaJam").checked;
    const isHadir = status === "hadir";

    document.getElementById("manualJamTersediaWrapper").style.display = isHadir ? "" : "none";
    document.getElementById("manualCheckInWrapper").style.display = (isHadir && !tanpaJam) ? "" : "none";
    document.getElementById("manualCheckOutWrapper").style.display = (isHadir && !tanpaJam) ? "" : "none";
  }

  /**
   * Simpan entri presensi manual (backfill) ke Firestore.
   * Doc ID mengikuti format yang sama dengan absen normal
   * (`${username}_${tanggal}`) supaya kalau ternyata sudah ada
   * record di tanggal itu, otomatis ter-merge/timpa, bukan dobel.
   *
   * Entri manual ditandai `inputManual: true` dan `diinputOleh`
   * supaya tetap bisa dibedakan dari absen normal (transparansi/audit).
   */
  async function handleSaveManualInput(e) {
    e.preventDefault();

    const username = document.getElementById("manualKaryawan").value;
    const namaKaryawan = document.getElementById("manualKaryawan").selectedOptions[0]?.textContent;
    const tanggal = document.getElementById("manualTanggal").value;
    const status = document.getElementById("manualStatus").value;
    const tanpaJam = document.getElementById("manualTanpaJam").checked;

    if (!username || !tanggal) {
      window.showToast("Pilih karyawan dan tanggal terlebih dahulu.", "error");
      return;
    }

    const btn = document.getElementById("btnSimpanManual");
    window.setButtonLoading(btn, true, "Menyimpan...");

    try {
      let checkIn = null;
      let checkOut = null;
      let totalJamKerjaDetik = 0;

      if (status === "hadir" && !tanpaJam) {
        const checkInStr = document.getElementById("manualCheckIn").value;
        const checkOutStr = document.getElementById("manualCheckOut").value;
        checkIn = combineDateTime(tanggal, checkInStr);
        checkOut = combineDateTime(tanggal, checkOutStr);
        if (checkIn && checkOut) {
          totalJamKerjaDetik = Math.max(0, Math.floor((new Date(checkOut) - new Date(checkIn)) / 1000));
        }
      }

      const recordId = `${username}_${tanggal}`;
      const session = window.Auth.getSession();

      await db.collection("attendance").doc(recordId).set({
        nama: namaKaryawan,
        tanggal,
        checkIn,
        checkOut,
        totalJamKerjaDetik,
        status,
        inputManual: true,
        diinputOleh: session ? session.username : "-",
      }, { merge: true });

      window.showToast("Data manual berhasil disimpan.", "success");
      document.getElementById("formInputManual").reset();
      updateManualFormVisibility();
      await loadAllRecords();
    } catch (err) {
      console.error("Gagal menyimpan input manual:", err);
      window.showToast("Gagal menyimpan data manual.", "error");
    } finally {
      window.setButtonLoading(btn, false);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("kelolaTableBody");
    if (!tableBody) return; // bukan halaman Kelola Data

    if (typeof db === "undefined") {
      tableBody.innerHTML = `
        <tr><td colspan="9" style="text-align:center; color: var(--color-text-faint); padding: var(--sp-6) 0;">
          Gagal memuat modul penyimpanan (js/firebase-config.js).
        </td></tr>`;
      return;
    }

    loadAllRecords();
    loadStaffList();
    loadManualStaffList();

    // ==================== INPUT MANUAL PRESENSI ====================
    document.getElementById("formInputManual").addEventListener("submit", handleSaveManualInput);
    document.getElementById("manualStatus").addEventListener("change", updateManualFormVisibility);
    document.getElementById("manualTanpaJam").addEventListener("change", updateManualFormVisibility);
    updateManualFormVisibility();

    // Klik tombol Edit/Hapus per baris (event delegation)
    tableBody.addEventListener("click", (e) => {
      const editBtn = e.target.closest("[data-edit]");
      const deleteBtn = e.target.closest("[data-delete]");
      if (editBtn) openEditModal(editBtn.getAttribute("data-edit"));
      if (deleteBtn) handleDeleteOne(deleteBtn.getAttribute("data-delete"));
    });

    // Pencarian nama karyawan (live filter, tidak perlu reload data)
    document.getElementById("searchInput").addEventListener("input", (e) => {
      renderTable(e.target.value);
    });

    // Modal edit
    document.getElementById("editForm").addEventListener("submit", handleSaveEdit);
    document.getElementById("btnCancelEdit").addEventListener("click", closeEditModal);
    document.getElementById("editModal").addEventListener("click", (e) => {
      if (e.target.id === "editModal") closeEditModal();
    });

    // Hapus semua
    document.getElementById("btnHapusSemua").addEventListener("click", handleDeleteAll);

    // ==================== CALENDAR EVENT LISTENERS ====================

    // Staff select change
    document.getElementById("calendarStaffSelect").addEventListener("change", (e) => {
      const select = e.target;
      if (select.value) {
        calendarStaffId = select.value;
        calendarStaffName = select.options[select.selectedIndex].textContent;
        document.getElementById("calendarContainer").style.display = "block";
        document.getElementById("calendarEmpty").style.display = "none";
        loadCalendarAttendance();
      } else {
        calendarStaffId = null;
        calendarStaffName = null;
        document.getElementById("calendarContainer").style.display = "none";
        document.getElementById("calendarEmpty").style.display = "block";
      }
    });

    // Previous month
    document.getElementById("btnPrevMonth").addEventListener("click", () => {
      if (!calendarStaffId) return; // belum pilih karyawan, jangan ubah state bulan
      calendarMonth--;
      if (calendarMonth < 0) {
        calendarMonth = 11;
        calendarYear--;
      }
      loadCalendarAttendance();
    });

    // Next month
    document.getElementById("btnNextMonth").addEventListener("click", () => {
      if (!calendarStaffId) return; // belum pilih karyawan, jangan ubah state bulan
      calendarMonth++;
      if (calendarMonth > 11) {
        calendarMonth = 0;
        calendarYear++;
      }
      loadCalendarAttendance();
    });

    // Calendar day click (event delegation)
    document.getElementById("calendarDays").addEventListener("click", (e) => {
      const dayEl = e.target.closest(".calendar-day");
      if (dayEl && !dayEl.classList.contains("empty")) {
        const dateStr = dayEl.getAttribute("data-date");
        openCalendarDetail(dateStr);
      }
    });

    // Close calendar detail modal
    document.getElementById("btnCloseCalendarDetail").addEventListener("click", closeCalendarDetail);
    document.getElementById("calendarDetailModal").addEventListener("click", (e) => {
      if (e.target.id === "calendarDetailModal") closeCalendarDetail();
    });

    // Export calendar to PDF
    document.getElementById("btnExportCalendar").addEventListener("click", exportCalendarToPDF);
  });
})();
