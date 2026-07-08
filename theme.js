/* =========================================================
   THEME — logika Dark Mode.

   Catatan: pencegahan "flash" tema salah saat halaman baru
   dibuka ditangani oleh potongan skrip kecil inline di <head>
   tiap halaman HTML (dijalankan sebelum CSS di-render). File
   ini hanya menangani interaksi tombol toggle & penyimpanan
   preferensi setelah halaman siap.
   ========================================================= */

(function () {
  const STORAGE_KEY = "theme"; // nilai: "dark" | "light"

  /**
   * Membaca preferensi tema yang tersimpan di localStorage.
   * @returns {"dark"|"light"|null} tema tersimpan, atau null jika belum pernah diatur
   */
  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  /**
   * Menentukan tema yang seharusnya aktif: pakai preferensi
   * tersimpan kalau ada, kalau tidak ikuti preferensi sistem OS.
   * @returns {"dark"|"light"}
   */
  function resolveTheme() {
    const stored = getStoredTheme();
    if (stored === "dark" || stored === "light") return stored;
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  }

  /**
   * Menerapkan tema ke elemen <html> lewat atribut data-theme,
   * yang dibaca oleh variabel CSS di variables.css.
   * @param {"dark"|"light"} theme
   */
  function applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  /**
   * Membalik tema aktif (dark <-> light), menyimpannya ke
   * localStorage, lalu menerapkannya ke halaman.
   */
  function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      // localStorage penuh/diblokir — tema tetap berubah untuk sesi ini saja
    }
    applyTheme(next);
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Pastikan tema konsisten (jaga-jaga kalau skrip anti-flash di head
    // tidak sempat jalan, misalnya karena cache tertentu).
    applyTheme(resolveTheme());

    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.addEventListener("click", toggleTheme);
    });
  });
})();
