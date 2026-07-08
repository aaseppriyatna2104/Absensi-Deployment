/* =========================================================
   AUTH — daftar akun & logika login/logout.

   PENTING: ini autentikasi sisi-klien murni (tanpa backend),
   jadi daftar akun & password di bawah ini SECARA TEKNIS bisa
   dilihat siapa pun yang membuka file ini lewat browser (View
   Source). Ini cukup untuk demo/prototipe internal, TAPI belum
   aman untuk data sungguhan — kalau serius dipakai, ganti
   dengan autentikasi sungguhan di backend/Firebase Auth.

   Struktur akun sengaja dibuat mirip dokumen Firestore supaya
   nanti gampang dipindah ke Firebase Authentication:
     { username, password, nama, role }
   ========================================================= */

(function () {
  /**
   * Daftar akun yang bisa login. Password dibuat dari pola
   * "{username}123" sesuai permintaan.
   * @type {Array<{username: string, password: string, nama: string, role: "admin"|"staff"}>}
   */
  const USERS = [
    { username: "admin", password: "admin123", nama: "Admin", role: "admin" },
    { username: "asep", password: "asep123", nama: "Asep", role: "staff" },
    { username: "rezky", password: "rezky123", nama: "Rezky", role: "staff" },
  ];

  /**
   * Mencocokkan username+password terhadap daftar USERS.
   * Kalau cocok, sesi disimpan ke localStorage supaya halaman
   * lain tahu siapa yang sedang login.
   * @param {string} username
   * @param {string} password
   * @returns {{username: string, nama: string, role: string}|null} data sesi kalau berhasil, null kalau gagal
   */
  function login(username, password) {
    const normalizedUsername = username.trim().toLowerCase();
    const user = USERS.find((u) => u.username === normalizedUsername && u.password === password);
    if (!user) return null;

    const session = { username: user.username, nama: user.nama, role: user.role };
    localStorage.setItem("session_user", JSON.stringify(session));
    return session;
  }

  /**
   * Menghapus sesi login & mengarahkan kembali ke halaman login.
   */
  function logout() {
    localStorage.removeItem("session_user");
    window.location.href = "login.html";
  }

  /**
   * Membaca sesi login yang sedang aktif.
   * @returns {{username: string, nama: string, role: string}|null}
   */
  function getSession() {
    try {
      const raw = localStorage.getItem("session_user");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // Diekspos secara global supaya bisa dipanggil dari login.html
  // dan halaman lain (lewat CURRENT_EMPLOYEE / tombol logout di core.js).
  window.Auth = { login, logout, getSession, USERS };
})();
