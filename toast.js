/* =========================================================
   TOAST — notifikasi kecil di pojok kanan atas, dipakai untuk
   memberi tahu hasil aksi (berhasil/gagal) tanpa mengganggu
   alur halaman. Dipakai oleh attendance.js, dan bisa dipanggil
   dari file JS mana pun karena diekspos sebagai window.showToast.
   ========================================================= */

(function () {
  const AUTO_DISMISS_MS = 3500;

  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 16v-4m0-4h.01" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/></svg>',
  };

  /**
   * Mengambil (atau membuat kalau belum ada) container toast
   * yang akan menampung semua notifikasi di pojok layar.
   * @returns {HTMLElement}
   */
  function getContainer() {
    let container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * Menghapus satu elemen toast dari DOM dengan animasi keluar
   * terlebih dahulu (supaya tidak hilang mendadak).
   * @param {HTMLElement} toastEl
   */
  function dismissToast(toastEl) {
    if (!toastEl || toastEl.classList.contains("is-leaving")) return;
    toastEl.classList.add("is-leaving");
    toastEl.addEventListener("animationend", () => toastEl.remove(), { once: true });
  }

  /**
   * Menampilkan satu notifikasi toast.
   * @param {string} message - isi pesan yang ditampilkan
   * @param {"success"|"error"|"warning"|"info"} [type="info"] - jenis toast (menentukan warna & ikon)
   * @param {number} [duration=3500] - lama tampil sebelum otomatis hilang (ms)
   */
  function showToast(message, type, duration) {
    const resolvedType = ICONS[type] ? type : "info";
    const resolvedDuration = typeof duration === "number" ? duration : AUTO_DISMISS_MS;

    const container = getContainer();

    const toastEl = document.createElement("div");
    toastEl.className = `toast toast--${resolvedType}`;
    toastEl.setAttribute("role", "status");
    toastEl.innerHTML = `
      <span class="toast__icon">${ICONS[resolvedType]}</span>
      <span class="toast__body"></span>
      <button class="toast__close" type="button" aria-label="Tutup notifikasi">
        <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    `;
    // Pesan dimasukkan lewat textContent (bukan innerHTML) supaya aman
    // dari karakter HTML yang tidak sengaja ada di dalam pesan.
    toastEl.querySelector(".toast__body").textContent = message;

    toastEl.querySelector(".toast__close").addEventListener("click", () => dismissToast(toastEl));

    container.appendChild(toastEl);

    if (resolvedDuration > 0) {
      setTimeout(() => dismissToast(toastEl), resolvedDuration);
    }
  }

  // Diekspos secara global supaya bisa dipanggil dari file JS lain
  // (attendance.js, riwayat.js, dashboard-stats.js, dsb).
  window.showToast = showToast;
})();
