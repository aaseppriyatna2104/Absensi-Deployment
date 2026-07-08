/* =========================================================
   VALIDATION — validasi input pada form Profil (halaman
   profil.html). Validasi dilakukan di sisi klien sebelum
   data "disimpan" (saat ini disimulasikan, karena project
   belum punya penyimpanan data profil).
   ========================================================= */

(function () {
  // Pola nomor telepon Indonesia: boleh diawali +62 / 62 / 0,
  // diikuti 8-13 digit (dengan atau tanpa tanda strip/spasi).
  const PHONE_PATTERN = /^(\+62|62|0)[\s-]?8[0-9]{2}[\s-]?[0-9]{3,4}[\s-]?[0-9]{3,4}$/;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Menandai satu form-field sebagai error/tidak, menampilkan
   * pesan error yang sudah ada di HTML (span.form-field__error).
   * @param {HTMLElement} fieldEl - elemen pembungkus .form-field
   * @param {boolean} isValid
   */
  function setFieldValidity(fieldEl, isValid) {
    if (!fieldEl) return;
    fieldEl.classList.toggle("has-error", !isValid);
  }

  /**
   * Memvalidasi field Nama Lengkap: wajib diisi, minimal 2 karakter.
   * @param {HTMLInputElement} input
   * @returns {boolean} true jika valid
   */
  function validateNama(input) {
    const value = input.value.trim();
    return value.length >= 2;
  }

  /**
   * Memvalidasi field Email dengan pola email sederhana.
   * @param {HTMLInputElement} input
   * @returns {boolean} true jika valid
   */
  function validateEmail(input) {
    const value = input.value.trim();
    return EMAIL_PATTERN.test(value);
  }

  /**
   * Memvalidasi field Nomor Telepon dengan pola nomor Indonesia.
   * @param {HTMLInputElement} input
   * @returns {boolean} true jika valid
   */
  function validateTelepon(input) {
    const value = input.value.trim().replace(/[()]/g, "");
    return PHONE_PATTERN.test(value);
  }

  /**
   * Memvalidasi field Alamat: wajib diisi, minimal 5 karakter.
   * @param {HTMLInputElement} input
   * @returns {boolean} true jika valid
   */
  function validateAlamat(input) {
    const value = input.value.trim();
    return value.length >= 5;
  }

  // Peta nama field -> fungsi validasinya masing-masing.
  const VALIDATORS = {
    nama: validateNama,
    email: validateEmail,
    telepon: validateTelepon,
    alamat: validateAlamat,
  };

  /**
   * Menjalankan semua validator terhadap form, menandai field
   * yang error, dan mengembalikan status keseluruhan.
   * @param {HTMLFormElement} form
   * @returns {boolean} true jika SEMUA field valid
   */
  function validateForm(form) {
    let allValid = true;

    Object.keys(VALIDATORS).forEach((fieldName) => {
      const input = form.elements[fieldName];
      const fieldEl = form.querySelector(`[data-field="${fieldName}"]`);
      if (!input || !fieldEl) return;

      const isValid = VALIDATORS[fieldName](input);
      setFieldValidity(fieldEl, isValid);
      if (!isValid) allValid = false;
    });

    return allValid;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("profilForm");
    if (!form) return; // bukan halaman Profil

    const submitBtn = document.getElementById("btnSimpanProfil");

    // Validasi langsung saat pengguna keluar dari sebuah field
    // (blur), supaya error terlihat lebih awal — bukan cuma pas submit.
    Object.keys(VALIDATORS).forEach((fieldName) => {
      const input = form.elements[fieldName];
      if (!input) return;
      input.addEventListener("blur", () => {
        const fieldEl = form.querySelector(`[data-field="${fieldName}"]`);
        setFieldValidity(fieldEl, VALIDATORS[fieldName](input));
      });
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const isValid = validateForm(form);
      if (!isValid) {
        window.showToast("Periksa kembali data yang belum sesuai.", "error");
        return;
      }

      // Simulasi proses simpan (belum ada backend/penyimpanan profil
      // sungguhan) — dibuat sebentar supaya spinner terlihat jelas
      // dan mudah diganti dengan pemanggilan API/Firestore nanti.
      window.setButtonLoading(submitBtn, true, "Menyimpan...");
      await new Promise((resolve) => setTimeout(resolve, 700));
      window.setButtonLoading(submitBtn, false);

      window.showToast("Perubahan profil berhasil disimpan.", "success");
    });
  });
})();
