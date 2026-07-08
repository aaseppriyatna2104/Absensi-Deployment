/* =========================================================
   SPINNER — helper untuk menampilkan status "sedang memuat"
   di tombol (saat menyimpan data) dan di tabel (saat data
   pertama kali dibaca dari penyimpanan).
   ========================================================= */

(function () {
  /**
   * Menyalakan/mematikan status loading pada sebuah tombol:
   * menonaktifkan tombol, menyimpan teks aslinya, lalu
   * menggantinya dengan ikon spinner + teks alternatif.
   * @param {HTMLButtonElement} button
   * @param {boolean} isLoading
   * @param {string} [loadingText="Menyimpan..."] - teks yang tampil selagi loading
   */
  function setButtonLoading(button, isLoading, loadingText) {
    if (!button) return;

    if (isLoading) {
      if (!button.dataset.originalContent) {
        button.dataset.originalContent = button.innerHTML;
      }
      button.disabled = true;
      button.classList.add("is-loading");
      button.innerHTML = `<span class="spinner"></span> ${loadingText || "Menyimpan..."}`;
    } else {
      button.classList.remove("is-loading");
      if (button.dataset.originalContent) {
        button.innerHTML = button.dataset.originalContent;
        delete button.dataset.originalContent;
      }
      // `disabled` sengaja tidak otomatis di-set false di sini —
      // pemanggil (attendance.js dll.) yang menentukan apakah tombol
      // seharusnya tetap terkunci (misalnya karena sudah check-in).
    }
  }

  /**
   * Mengisi <tbody> tabel dengan beberapa baris skeleton (placeholder
   * abu-abu berkedip) selagi data asli belum selesai dibaca.
   * @param {HTMLElement} tbody
   * @param {number} columnCount - jumlah kolom tabel (untuk colspan tiap sel)
   * @param {number} [rowCount=3] - jumlah baris skeleton yang ditampilkan
   */
  function renderTableSkeleton(tbody, columnCount, rowCount) {
    if (!tbody) return;
    const rows = rowCount || 3;
    const cells = Array.from({ length: columnCount })
      .map(() => `<td><div class="skeleton-bar"></div></td>`)
      .join("");
    tbody.innerHTML = Array.from({ length: rows })
      .map(() => `<tr class="skeleton-row">${cells}</tr>`)
      .join("");
  }

  // Diekspos secara global supaya dipakai bareng oleh attendance.js,
  // riwayat.js, dan dashboard-stats.js.
  window.setButtonLoading = setButtonLoading;
  window.renderTableSkeleton = renderTableSkeleton;
})();
