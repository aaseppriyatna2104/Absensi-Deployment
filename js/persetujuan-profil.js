/* =========================================================
   PERSETUJUAN PROFIL — halaman khusus admin untuk meninjau,
   menyetujui, atau menolak pengajuan perubahan data diri
   (Nama, Email, Telepon, Alamat) yang diajukan staff lewat
   halaman Profil. Data resmi baru berlaku setelah disetujui
   di sini (koleksi Firestore "profiles"); pengajuan tersimpan
   di koleksi "profileRequests".
   ========================================================= */

(function () {
  const FIELD_LABELS = { 
    nama: "Nama", 
    email: "Email", 
    telepon: "Telepon", 
    alamat: "Alamat",
    kontakDaruratTipe: "Hubungan Kontak Darurat",
    kontakDaruratNomor: "Nomor Kontak Darurat"
  };
  const TIPE_LABELS = {
    pasangan: "Pasangan",
    istri: "Istri",
    suami: "Suami",
    ayah: "Ayah",
    ibu: "Ibu",
    orang_tua: "Orang Tua",
    saudara: "Saudara",
    teman: "Teman",
    lainnya: "Lainnya"
  };
  const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
  ];

  let allRequests = []; // { id, username, nama, old, new, status, submittedAt, reviewedAt, reviewedBy, rejectReason }
  let rejectingId = null;

  /** Menambahkan angka nol di depan kalau kurang dari 2 digit. @param {number} n @returns {string} */
  function pad(n) { return String(n).padStart(2, "0"); }

  /** Memformat ISO datetime string menjadi "DD Mon YYYY, HH:MM". @param {string} iso @returns {string} */
  function formatDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${pad(d.getDate())} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /**
   * Membentuk daftar field yang berbeda antara data lama & baru,
   * dipakai untuk menampilkan ringkasan perubahan per baris.
   * @param {object} oldData
   * @param {object} newData
   * @returns {string} HTML ringkasan perubahan
   */
  function renderDiff(oldData, newData) {
    oldData = oldData || {};
    newData = newData || {};
    const rows = Object.keys(FIELD_LABELS)
      .filter((key) => (oldData[key] || "") !== (newData[key] || ""))
      .map((key) => {
        const label = FIELD_LABELS[key];
        let before = oldData[key] ? oldData[key] : "(belum ada)";
        let after = newData[key] || "-";
        
        // Convert tipe to readable label
        if (key === "kontakDaruratTipe") {
          before = TIPE_LABELS[before] || before;
          after = TIPE_LABELS[after] || after;
        }
        
        return `<div style="margin-bottom:4px;"><strong>${label}:</strong> <span style="color: var(--color-text-faint); text-decoration: line-through;">${before}</span> → <span style="color: var(--color-teal-600, var(--color-teal-500));">${after}</span></div>`;
      });
    if (!rows.length) return '<span style="color: var(--color-text-faint);">Tidak ada perubahan field.</span>';
    return rows.join("");
  }

  /** Render tabel pengajuan yang masih pending. */
  function renderPendingTable() {
    const tbody = document.getElementById("approvalTableBody");
    const countLabel = document.getElementById("approvalCountLabel");
    const pending = allRequests.filter((r) => r.status === "pending")
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    countLabel.textContent = pending.length
      ? `${pending.length} pengajuan menunggu persetujuan`
      : "Tidak ada pengajuan yang menunggu persetujuan";

    if (!pending.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; color: var(--color-text-faint); padding: var(--sp-6) 0;">
            Belum ada pengajuan perubahan data diri.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = pending.map((r) => `
      <tr data-id="${r.id}">
        <td>${r.nama}</td>
        <td style="font-size: var(--fs-sm);">${renderDiff(r.old, r.new)}</td>
        <td class="mono">${formatDateTime(r.submittedAt)}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-approve="${r.id}">Setujui</button>
            <button type="button" class="danger" data-reject="${r.id}">Tolak</button>
          </div>
        </td>
      </tr>`).join("");
  }

  /** Render tabel riwayat pengajuan yang sudah ditinjau (approved/rejected). */
  function renderHistoryTable() {
    const tbody = document.getElementById("approvalHistoryBody");
    const history = allRequests.filter((r) => r.status === "approved" || r.status === "rejected")
      .sort((a, b) => new Date(b.reviewedAt || b.submittedAt) - new Date(a.reviewedAt || a.submittedAt));

    if (!history.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; color: var(--color-text-faint); padding: var(--sp-6) 0;">
            Belum ada riwayat persetujuan.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = history.map((r) => {
      const badge = r.status === "approved"
        ? '<span class="status-badge status-badge--hadir">Disetujui</span>'
        : `<span class="status-badge status-badge--alpha">Ditolak${r.rejectReason ? `: ${r.rejectReason}` : ""}</span>`;
      return `
      <tr data-id="${r.id}">
        <td>${r.nama}</td>
        <td style="font-size: var(--fs-sm);">${renderDiff(r.old, r.new)}</td>
        <td>${badge}</td>
        <td class="mono">${formatDateTime(r.reviewedAt)}</td>
      </tr>`;
    }).join("");
  }

  function renderAll() {
    renderPendingTable();
    renderHistoryTable();
  }

  /** Menyetujui satu pengajuan: tulis data baru ke "profiles", tandai pengajuan "approved". @param {string} id */
  async function handleApprove(id) {
    const req = allRequests.find((r) => r.id === id);
    if (!req) return;

    const confirmed = window.confirm(`Setujui perubahan data diri ${req.nama}?`);
    if (!confirmed) return;

    try {
      const now = new Date().toISOString();
      const session = window.Auth.getSession();

      await db.collection("profiles").doc(req.username).set({
        ...req.new,
        updatedAt: now,
      }, { merge: true });

      await db.collection("profileRequests").doc(id).set({
        status: "approved",
        reviewedAt: now,
        reviewedBy: session ? session.username : "admin",
      }, { merge: true });

      window.showToast(`Perubahan data diri ${req.nama} disetujui.`, "success");
      await loadAllRequests();
    } catch (err) {
      console.error("Gagal menyetujui pengajuan:", err);
      window.showToast("Gagal menyetujui pengajuan.", "error");
    }
  }

  /** Membuka modal alasan penolakan untuk satu pengajuan. @param {string} id */
  function openRejectModal(id) {
    const req = allRequests.find((r) => r.id === id);
    if (!req) return;

    rejectingId = id;
    document.getElementById("rejectModalSub").textContent = `Tolak pengajuan perubahan data diri ${req.nama}`;
    document.getElementById("rejectReason").value = "";
    document.getElementById("rejectModal").classList.add("is-open");
  }

  /** Menutup modal alasan penolakan. */
  function closeRejectModal() {
    rejectingId = null;
    document.getElementById("rejectModal").classList.remove("is-open");
  }

  /** Menyimpan penolakan pengajuan (dengan alasan opsional) ke Firestore. */
  async function handleConfirmReject(e) {
    e.preventDefault();
    if (!rejectingId) return;

    const req = allRequests.find((r) => r.id === rejectingId);
    if (!req) return;

    const btn = document.getElementById("btnConfirmReject");
    window.setButtonLoading(btn, true, "Menolak...");

    try {
      const now = new Date().toISOString();
      const session = window.Auth.getSession();
      const reason = document.getElementById("rejectReason").value.trim();

      await db.collection("profileRequests").doc(rejectingId).set({
        status: "rejected",
        reviewedAt: now,
        reviewedBy: session ? session.username : "admin",
        rejectReason: reason || null,
      }, { merge: true });

      window.showToast(`Pengajuan ${req.nama} ditolak.`, "success");
      closeRejectModal();
      await loadAllRequests();
    } catch (err) {
      console.error("Gagal menolak pengajuan:", err);
      window.showToast("Gagal menolak pengajuan.", "error");
    } finally {
      window.setButtonLoading(btn, false);
    }
  }

  /** Mengambil ulang seluruh dokumen profileRequests dari Firestore lalu render tabel. */
  async function loadAllRequests() {
    const tbody = document.getElementById("approvalTableBody");
    window.renderTableSkeleton(tbody, 4, 3);

    try {
      const snapshot = await db.collection("profileRequests").get();
      allRequests = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderAll();
    } catch (err) {
      console.error("Gagal memuat pengajuan profil:", err);
      tbody.innerHTML = `
        <tr><td colspan="4" style="text-align:center; color: var(--color-red-600); padding: var(--sp-6) 0;">
          Gagal memuat data pengajuan.
        </td></tr>`;
      window.showToast("Gagal memuat data pengajuan.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("approvalTableBody");
    if (!tableBody) return; // bukan halaman Persetujuan Profil

    if (typeof db === "undefined") {
      tableBody.innerHTML = `
        <tr><td colspan="4" style="text-align:center; color: var(--color-text-faint); padding: var(--sp-6) 0;">
          Gagal memuat modul penyimpanan (js/firebase-config.js).
        </td></tr>`;
      return;
    }

    loadAllRequests();

    // Klik tombol Setujui/Tolak per baris (event delegation)
    tableBody.addEventListener("click", (e) => {
      const approveBtn = e.target.closest("[data-approve]");
      const rejectBtn = e.target.closest("[data-reject]");
      if (approveBtn) handleApprove(approveBtn.getAttribute("data-approve"));
      if (rejectBtn) openRejectModal(rejectBtn.getAttribute("data-reject"));
    });

    // Modal tolak
    document.getElementById("rejectForm").addEventListener("submit", handleConfirmReject);
    document.getElementById("btnCancelReject").addEventListener("click", closeRejectModal);
    document.getElementById("rejectModal").addEventListener("click", (e) => {
      if (e.target.id === "rejectModal") closeRejectModal();
    });
  });
})();
