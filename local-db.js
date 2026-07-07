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

  function subscribe(collectionName, fn) {
    if (!listeners[collectionName]) listeners[collectionName] = new Set();
    listeners[collectionName].add(fn);
    return function unsubscribe() {
      listeners[collectionName].delete(fn);
    };
  }

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

  function docKey(collectionName, id) {
    return `${KEY_PREFIX}${collectionName}:${id}`;
  }

  function readDoc(collectionName, id) {
    try {
      const raw = localStorage.getItem(docKey(collectionName, id));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeDoc(collectionName, id, data) {
    localStorage.setItem(docKey(collectionName, id), JSON.stringify(data));
  }

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
