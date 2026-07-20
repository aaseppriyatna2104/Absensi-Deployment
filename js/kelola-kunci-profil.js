/* =========================================================
   KELOLA KUNCI PROFIL — halaman khusus admin untuk mengunci
   atau membuka akses edit profil staff. Staff tidak bisa
   mengedit profil jika dikunci oleh admin.
   ========================================================= */

(function () {
  let allUsers = []; // { username, nama, role, profileLocked }
  
  /** Render tabel berdasarkan daftar user yang sudah difilter pencarian */
  function renderTable(searchTerm) {
    const tbody = document.getElementById("lockTableBody");
    const countLabel = document.getElementById("lockCountLabel");

    let users = allUsers.slice().sort((a, b) => a.nama.localeCompare(b.nama));
    if (searchTerm) {
      const term = searchTerm.trim().toLowerCase();
      users = users.filter((u) => u.nama.toLowerCase().includes(term) || u.username.toLowerCase().includes(term));
    }

    countLabel.textContent = `${users.length} karyawan ditemukan`;

    if (!users.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; color: var(--color-text-faint); padding: var(--sp-6) 0;">
            Tidak ada data karyawan.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = users.map((u) => `
      <tr data-username="${u.username}">
        <td>${u.nama}</td>
        <td class="mono">${u.username}</td>
        <td>${u.role}</td>
        <td>
          <span class="lock-badge ${u.profileLocked ? 'locked' : 'unlocked'}">
            ${u.profileLocked 
              ? '<svg viewBox="0 0 24 24" fill="none" width="12" height="12"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Terkunci'
              : '<svg viewBox="0 0 24 24" fill="none" width="12" height="12"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0110 0v4M7 7h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Terbuka'}
          </span>
        </td>
        <td>
          <div class="row-actions">
            ${u.profileLocked 
              ? `<button type="button" class="success" data-unlock="${u.username}">Buka Kunci</button>`
              : `<button type="button" class="danger" data-lock="${u.username}">Kunci Profil</button>`
            }
          </div>
        </td>
      </tr>`).join("");
  }

  /** Mengunci profil staff @param {string} username */
  async function handleLock(username) {
    const user = allUsers.find((u) => u.username === username);
    if (!user) return;

    const confirmed = window.confirm(`Kunci profil ${user.nama}? Staff tidak akan bisa mengedit profil sampai Anda membuka kuncinya.`);
    if (!confirmed) return;

    try {
      await db.collection("profiles").doc(username).set({
        profileLocked: true,
      }, { merge: true });

      window.showToast(`Profil ${user.nama} berhasil dikunci.`, "success");
      await loadAllUsers();
    } catch (err) {
      console.error("Gagal mengunci profil:", err);
      window.showToast("Gagal mengunci profil.", "error");
    }
  }

  /** Membuka kunci profil staff @param {string} username */
  async function handleUnlock(username) {
    const user = allUsers.find((u) => u.username === username);
    if (!user) return;

    const confirmed = window.confirm(`Buka kunci profil ${user.nama}? Staff akan bisa mengedit profil kembali.`);
    if (!confirmed) return;

    try {
      await db.collection("profiles").doc(username).set({
        profileLocked: false,
      }, { merge: true });

      window.showToast(`Profil ${user.nama} berhasil dibuka.`, "success");
      await loadAllUsers();
    } catch (err) {
      console.error("Gagal membuka kunci profil:", err);
      window.showToast("Gagal membuka kunci profil.", "error");
    }
  }

  /**
   * Mengambil seluruh data user lalu render tabel.
   *
   * Sengaja mulai dari daftar akun di `window.Auth.USERS` (auth.js),
   * BUKAN cuma dari collection Firestore "profiles" — dokumen di
   * "profiles" baru dibuat begitu user pertama kali submit form
   * Profil. Kalau langsung baca "profiles" doang, karyawan yang
   * belum pernah buka halaman Profil sama sekali ga bakal muncul
   * di sini, padahal dia sudah terdaftar dan seharusnya bisa
   * di-lock lebih dulu oleh admin.
   */
  async function loadAllUsers() {
    const tbody = document.getElementById("lockTableBody");
    window.renderTableSkeleton(tbody, 5, 3);

    try {
      const snapshot = await db.collection("profiles").get();
      const profilesByUsername = {};
      snapshot.forEach((doc) => { profilesByUsername[doc.id] = doc.data(); });

      const baseUsers = (window.Auth && window.Auth.USERS) || [];
      allUsers = baseUsers.map((u) => {
        const profile = profilesByUsername[u.username];
        return {
          username: u.username,
          nama: (profile && profile.nama) || u.nama,
          role: (profile && profile.role) || u.role,
          profileLocked: profile ? !!profile.profileLocked : false,
        };
      });

      renderTable(document.getElementById("searchInput").value);
    } catch (err) {
      console.error("Gagal memuat data user:", err);
      tbody.innerHTML = `
        <tr><td colspan="5" style="text-align:center; color: var(--color-red-600); padding: var(--sp-6) 0;">
          Gagal memuat data karyawan.
        </td></tr>`;
      window.showToast("Gagal memuat data karyawan.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("lockTableBody");
    if (!tableBody) return; // bukan halaman Kelola Kunci Profil

    if (typeof db === "undefined") {
      tableBody.innerHTML = `
        <tr><td colspan="5" style="text-align:center; color: var(--color-text-faint); padding: var(--sp-6) 0;">
          Gagal memuat modul penyimpanan (js/firebase-config.js).
        </td></tr>`;
      return;
    }

    // Dukung link cepat dari tabel Status Karyawan di Dashboard
    // (index.html?...) yang membawa nama karyawan lewat query
    // param ?cari=, supaya tabel di sini otomatis terfilter.
    const cariParam = new URLSearchParams(window.location.search).get("cari");
    if (cariParam) {
      const searchInput = document.getElementById("searchInput");
      if (searchInput) searchInput.value = cariParam;
    }

    loadAllUsers();

    // Klik tombol Kunci/Buka per baris (event delegation)
    tableBody.addEventListener("click", (e) => {
      const lockBtn = e.target.closest("[data-lock]");
      const unlockBtn = e.target.closest("[data-unlock]");
      if (lockBtn) handleLock(lockBtn.getAttribute("data-lock"));
      if (unlockBtn) handleUnlock(unlockBtn.getAttribute("data-unlock"));
    });

    // Pencarian nama karyawan (live filter)
    document.getElementById("searchInput").addEventListener("input", (e) => {
      renderTable(e.target.value);
    });
  });
})();
