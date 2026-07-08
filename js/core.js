/* =========================================================
   CORE.JS — gabungan file-file JS yang dipakai bersama di
   SEMUA halaman: penyimpanan data, konfigurasi, tema, toast,
   spinner, sidebar mobile, dan jam berjalan.

   Digabung jadi satu file supaya struktur project lebih
   ringkas (mengurangi jumlah file/path yang perlu ter-deploy
   dengan benar). File khusus per halaman tetap terpisah:
   attendance.js (Absensi), riwayat.js (Riwayat),
   dashboard-stats.js (Dashboard), validation.js (Profil).

   Urutan bagian di bawah ini penting:
   1. local-db.js     -> mendefinisikan window.db
   2. app-config.js   -> mendefinisikan CURRENT_EMPLOYEE
   3. theme.js        -> dark mode
   4. toast.js        -> window.showToast
   5. spinner.js      -> window.setButtonLoading, window.renderTableSkeleton
   6. sidebar.js       -> menu mobile
   7. clock.js         -> jam & tanggal berjalan
   ========================================================= */


/* ===== dari: local-db.js ===== */
/* =========================================================
   LOCAL-DB — "Firestore palsu" yang jalan di atas localStorage.

   TUJUAN:
   File ini sengaja meniru bentuk API Firebase Firestore
   (versi "compat") sebisa mungkin:

     db.collection("attendance").doc(id).set(data, { merge: true })
     db.collection("attendance").doc(id).onSnapshot(cb, errCb)
     db.collection("attendance").where("nama", "==", x).onSnapshot(cb, errCb)

   Supaya nanti kalau project ini dihubungkan ke Firebase
   sungguhan, kita TIDAK PERLU mengubah attendance.js, riwayat.js,
   atau dashboard-stats.js sama sekali — cukup:

     1. Hapus/ganti <script src="js/local-db.js">
        dengan SDK Firebase asli + firebase-config.js (init db).
     2. Selesai. Semua pemanggilan db.collection(...).doc(...).set(...)
        dkk. di file lain sudah kompatibel.

   Data asli disimpan di localStorage dengan format key:
     localdb:{namaCollection}:{id}
   ========================================================= */

(function (global) {
  const KEY_PREFIX = "localdb:";

  // ---- Pub-sub sederhana: dipakai onSnapshot() supaya "real-time" ----
  const listeners = {}; // { [collectionName]: Set<function> }

  /**
   * Mendaftarkan fungsi `fn` untuk dipanggil setiap kali data di
   * collection tertentu berubah (dipakai oleh onSnapshot()).
   * @param {string} collectionName
   * @param {function} fn
   * @returns {function} fungsi unsubscribe
   */
  function subscribe(collectionName, fn) {
    if (!listeners[collectionName]) listeners[collectionName] = new Set();
    listeners[collectionName].add(fn);
    return function unsubscribe() {
      listeners[collectionName].delete(fn);
    };
  }

  /**
   * Memanggil semua listener yang terdaftar pada satu collection
   * (dipanggil setelah set() berhasil menulis data).
   * @param {string} collectionName
   */
  function notify(collectionName) {
    (listeners[collectionName] || new Set()).forEach((fn) => fn());
  }

  // Sinkron antar-tab: kalau localStorage berubah dari tab lain,
  // ikut trigger listener di tab ini juga.
  window.addEventListener("storage", (e) => {
    if (!e.key || !e.key.startsWith(KEY_PREFIX)) return;
    const collectionName = e.key.slice(KEY_PREFIX.length).split(":")[0];
    notify(collectionName);
  });

  /**
   * Membentuk key localStorage untuk satu record, format:
   * "localdb:{collectionName}:{id}".
   * @param {string} collectionName
   * @param {string} id
   * @returns {string}
   */
  function docKey(collectionName, id) {
    return `${KEY_PREFIX}${collectionName}:${id}`;
  }

  /**
   * Membaca satu record dari localStorage dan mem-parse JSON-nya.
   * @param {string} collectionName
   * @param {string} id
   * @returns {object|null} data record, atau null kalau belum ada / rusak
   */
  function readDoc(collectionName, id) {
    try {
      const raw = localStorage.getItem(docKey(collectionName, id));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Menuliskan satu record ke localStorage sebagai JSON.
   * @param {string} collectionName
   * @param {string} id
   * @param {object} data
   */
  function writeDoc(collectionName, id, data) {
    localStorage.setItem(docKey(collectionName, id), JSON.stringify(data));
  }

  /**
   * Mengecek apakah satu record cocok dengan satu kondisi filter
   * (dipakai oleh where()), meniru operator pembanding Firestore.
   * @param {object} data - data record
   * @param {{field: string, op: string, value: *}} filter
   * @returns {boolean}
   */
  function matchesFilter(data, filter) {
    const value = data[filter.field];
    switch (filter.op) {
      case "==": return value === filter.value;
      case "!=": return value !== filter.value;
      case ">": return value > filter.value;
      case ">=": return value >= filter.value;
      case "<": return value < filter.value;
      case "<=": return value <= filter.value;
      default: return true;
    }
  }

  /**
   * Mengambil semua record dalam satu collection yang cocok dengan
   * daftar filter (dipakai oleh Query#get / Query#onSnapshot).
   * @param {string} collectionName
   * @param {Array<{field: string, op: string, value: *}>} filters
   * @returns {Array<{id: string, data: function(): object}>}
   */
  function getAllDocs(collectionName, filters) {
    const prefix = `${KEY_PREFIX}${collectionName}:`;
    const docs = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;

      let data;
      try {
        data = JSON.parse(localStorage.getItem(key));
      } catch (e) {
        continue;
      }
      if (!data) continue;
      if (filters.every((f) => matchesFilter(data, f))) {
        docs.push({ id: key.slice(prefix.length), data: () => data });
      }
    }
    return docs;
  }

  /* ---------------------------------------------------------
     DocumentReference — mirip firebase.firestore.DocumentReference
     --------------------------------------------------------- */
  class LocalDocRef {
    constructor(collectionName, id) {
      this.collectionName = collectionName;
      this.id = id;
    }

    // set(data, { merge: true }) — sama seperti Firestore
    async set(data, options) {
      const merge = !!(options && options.merge);
      const existing = merge ? (readDoc(this.collectionName, this.id) || {}) : {};
      const merged = { ...existing, ...data };
      writeDoc(this.collectionName, this.id, merged);
      notify(this.collectionName);
      return merged;
    }

    async get() {
      const data = readDoc(this.collectionName, this.id);
      return {
        exists: !!data,
        data: () => data,
      };
    }

    // onSnapshot(callback, errorCallback) — dipanggil langsung sekali di
    // awal (seperti Firestore), lalu setiap kali data berubah.
    onSnapshot(callback, errorCallback) {
      const run = () => {
        try {
          const data = readDoc(this.collectionName, this.id);
          callback({ exists: !!data, data: () => data });
        } catch (e) {
          if (errorCallback) errorCallback(e);
        }
      };
      run();
      return subscribe(this.collectionName, run);
    }
  }

  /* ---------------------------------------------------------
     Query — mirip firebase.firestore.Query (hasil dari .where())
     --------------------------------------------------------- */
  class LocalQuery {
    constructor(collectionName, filters) {
      this.collectionName = collectionName;
      this.filters = filters;
    }

    where(field, op, value) {
      return new LocalQuery(this.collectionName, [...this.filters, { field, op, value }]);
    }

    async get() {
      const docs = getAllDocs(this.collectionName, this.filters);
      return { docs, empty: docs.length === 0, size: docs.length };
    }

    onSnapshot(callback, errorCallback) {
      const run = () => {
        try {
          const docs = getAllDocs(this.collectionName, this.filters);
          callback({ docs, empty: docs.length === 0, size: docs.length });
        } catch (e) {
          if (errorCallback) errorCallback(e);
        }
      };
      run();
      return subscribe(this.collectionName, run);
    }
  }

  /* ---------------------------------------------------------
     CollectionReference — mirip firebase.firestore.CollectionReference
     --------------------------------------------------------- */
  class LocalCollectionRef {
    constructor(name) {
      this.name = name;
    }

    doc(id) {
      return new LocalDocRef(this.name, id);
    }

    where(field, op, value) {
      return new LocalQuery(this.name, [{ field, op, value }]);
    }

    onSnapshot(callback, errorCallback) {
      return new LocalQuery(this.name, []).onSnapshot(callback, errorCallback);
    }
  }

  /* ---------------------------------------------------------
     "db" — pengganti firebase.firestore()
     --------------------------------------------------------- */
  const localDb = {
    collection(name) {
      return new LocalCollectionRef(name);
    },
    // Penanda supaya kode lain bisa tahu ini bukan Firestore asli, kalau perlu.
    __isLocalPolyfill: true,
  };

  global.db = localDb;
})(window);


/* ===== dari: app-config.js (sekarang dinamis dari sesi login) ===== */
/* =========================================================
   APP CONFIG — identitas karyawan yang sedang login.

   Dulu nilai ini statis ("Atna" saja). Sekarang dibaca lewat
   window.Auth.getSession() (didefinisikan di js/auth.js, wajib
   dimuat SEBELUM core.js di setiap halaman), jadi tiap akun
   (admin, asep, rezky) punya data presensinya masing-masing
   secara otomatis — cukup ganti-ganti akun lewat halaman login,
   tidak perlu ubah kode.
   ========================================================= */

/**
 * Alias singkat untuk window.Auth.getSession(), supaya kode di
 * bawahnya (dan bagian auth-ui di paling bawah file ini) tetap
 * ringkas.
 * @returns {{username: string, nama: string, role: string}|null}
 */
function getSessionUser() {
  return window.Auth ? window.Auth.getSession() : null;
}

const _session = getSessionUser();

// Kalau halaman ini butuh sesi tapi tidak ada (harusnya sudah
// dicegat oleh guard di <head>), pakai identitas kosong supaya
// skrip lain tidak error — guard di <head> akan segera redirect
// ke login.html sebelum pengguna sempat lihat/pakai halaman ini.
const CURRENT_EMPLOYEE = _session
  ? { id: _session.username, nama: _session.nama, role: _session.role }
  : { id: "guest", nama: "Guest", role: "staff" };


/* ===== dari: theme.js ===== */
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


/* ===== dari: toast.js ===== */
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


/* ===== dari: spinner.js ===== */
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


/* ===== dari: sidebar.js ===== */
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


/* ===== dari: auth-ui.js (tampilan akun & logout di sidebar) ===== */
/* =========================================================
   AUTH UI — menampilkan nama/peran akun yang sedang login di
   sidebar, plus tombol Logout. Terpisah dari auth.js supaya
   auth.js sendiri tetap murni logika (login/logout/sesi) tanpa
   urusan DOM.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const session = getSessionUser();
  if (!session) return; // halaman login tidak butuh ini

  const nameEl = document.querySelector("[data-session-name]");
  const roleEl = document.querySelector("[data-session-role]");
  const avatarEl = document.querySelector("[data-session-avatar]");

  if (nameEl) nameEl.textContent = session.nama;
  if (roleEl) roleEl.textContent = session.role === "admin" ? "Administrator" : "Staff";
  if (avatarEl) avatarEl.textContent = session.nama.slice(0, 2).toUpperCase();

  // Tombol logout bisa ada lebih dari satu (sidebar desktop & mobile).
  document.querySelectorAll("[data-logout]").forEach((btn) => {
    btn.addEventListener("click", () => window.Auth.logout());
  });
});


/* ===== dari: clock.js ===== */
/* =========================================================
   CLOCK — jam digital berjalan di topbar & kartu presensi
   (murni tampilan, belum terhubung ke logika absensi)
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const timeEls = document.querySelectorAll("[data-live-time]");
  const dateEls = document.querySelectorAll("[data-live-date]");

  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  /** Menambahkan angka nol di depan kalau kurang dari 2 digit. @param {number} n @returns {string} */
  function pad(n) { return String(n).padStart(2, "0"); }

  /**
   * Membaca waktu saat ini dan menuliskannya ke semua elemen
   * bertanda [data-live-time] / [data-live-date] di halaman.
   * Dipanggil sekali di awal, lalu diulang tiap detik lewat setInterval.
   */
  function tick() {
    const now = new Date();
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const dateStr = `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    timeEls.forEach((el) => { el.textContent = timeStr; });
    dateEls.forEach((el) => { el.textContent = dateStr; });
  }

  tick();
  setInterval(tick, 1000);
});

