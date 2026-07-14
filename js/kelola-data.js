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

  let allRecords = []; // { id, nama, tanggal, checkIn, checkOut, totalJamKerjaDetik, status }
  let editingId = null;

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
          <td colspan="7" style="text-align:center; color: var(--color-text-faint); padding: var(--sp-6) 0;">
            Tidak ada data presensi.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = records.map((r) => `
      <tr data-id="${r.id}">
        <td class="mono">${formatDateShort(r.tanggal)}</td>
        <td>${r.nama}</td>
        <td class="cell-time mono">${r.checkIn ? formatClock(new Date(r.checkIn)) : "—:—"}</td>
        <td class="cell-time mono">${r.checkOut ? formatClock(new Date(r.checkOut)) : "—:—"}</td>
        <td class="cell-time mono">${r.checkIn && r.checkOut ? formatDuration(r.totalJamKerjaDetik) : "00:00:00"}</td>
        <td>${statusBadge(r)}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-edit="${r.id}">Edit</button>
            <button type="button" class="danger" data-delete="${r.id}">Hapus</button>
          </div>
        </td>
      </tr>`).join("");
  }

  /** Membuka modal edit untuk satu record berdasarkan ID. @param {string} id */
  function openEditModal(id) {
    const record = allRecords.find((r) => r.id === id);
    if (!record) return;

    editingId = id;
    document.getElementById("editModalSub").textContent = `${record.nama} — ${formatDateShort(record.tanggal)}`;

    const checkInEl = document.getElementById("editCheckIn");
    const checkOutEl = document.getElementById("editCheckOut");
    const totalJamEl = document.getElementById("editTotalJam");

    checkInEl.value = record.checkIn ? formatClock(new Date(record.checkIn)) : "";
    checkOutEl.value = record.checkOut ? formatClock(new Date(record.checkOut)) : "";
    totalJamEl.value = record.totalJamKerjaDetik ? formatDuration(record.totalJamKerjaDetik) : "";

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
      const totalJamStr = document.getElementById("editTotalJam").value;

      const newCheckIn = combineDateTime(record.tanggal, checkInStr);
      const newCheckOut = combineDateTime(record.tanggal, checkOutStr);

      let totalJamKerjaDetik = 0;
      
      // Parse total jam dari input field jika diisi manual
      if (totalJamStr && totalJamStr.trim()) {
        const parts = totalJamStr.trim().split(":").map(Number);
        if (parts.length >= 2) {
          const h = parts[0] || 0;
          const m = parts[1] || 0;
          const s = parts[2] || 0;
          totalJamKerjaDetik = (h * 3600) + (m * 60) + s;
        }
      } else if (newCheckIn && newCheckOut) {
        // Jika total jam tidak diisi manual, hitung dari check-in dan check-out
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
    window.renderTableSkeleton(tbody, 7, 4);

    try {
      const snapshot = await db.collection("attendance").get();
      allRecords = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderTable(document.getElementById("searchInput").value);
    } catch (err) {
      console.error("Gagal memuat data:", err);
      tbody.innerHTML = `
        <tr><td colspan="7" style="text-align:center; color: var(--color-red-600); padding: var(--sp-6) 0;">
          Gagal memuat data presensi.
        </td></tr>`;
      window.showToast("Gagal memuat data presensi.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("kelolaTableBody");
    if (!tableBody) return; // bukan halaman Kelola Data

    if (typeof db === "undefined") {
      tableBody.innerHTML = `
        <tr><td colspan="7" style="text-align:center; color: var(--color-text-faint); padding: var(--sp-6) 0;">
          Gagal memuat modul penyimpanan (js/firebase-config.js).
        </td></tr>`;
      return;
    }

    loadAllRecords();

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
  });
})();
