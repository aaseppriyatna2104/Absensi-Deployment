/* =========================================================
   SIDEBAR — buka/tutup navigasi pada tampilan mobile
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.querySelector(".sidebar");
  const backdrop = document.querySelector(".sidebar-backdrop");
  const openBtn = document.querySelector("[data-sidebar-open]");
  // Ada lebih dari satu elemen "tutup" (tombol X di sidebar + backdrop
  // itu sendiri) — pakai querySelectorAll supaya keduanya berfungsi.
  const closeBtns = document.querySelectorAll("[data-sidebar-close]");

  /** Menampilkan sidebar (drawer) di layar mobile beserta latar gelapnya. */
  function openSidebar() {
    sidebar?.classList.add("is-open");
    backdrop?.classList.add("is-visible");
  }

  /** Menyembunyikan sidebar (drawer) & latar gelapnya di layar mobile. */
  function closeSidebar() {
    sidebar?.classList.remove("is-open");
    backdrop?.classList.remove("is-visible");
  }

  openBtn?.addEventListener("click", openSidebar);
  closeBtns.forEach((btn) => btn.addEventListener("click", closeSidebar));
});
