/* =========================================================
   FIREBASE CONFIG — inisialisasi Firebase App + Firestore.
   Dimuat via CDN (compat SDK) di setiap halaman SEBELUM
   firestore-service.js dan file js lain yang pakai Firestore.

   >>> GANTI firebaseConfig DI BAWAH DENGAN CONFIG PROJECT
   >>> FIREBASE KAMU SENDIRI (Firebase Console > Project
   >>> Settings > General > Your apps > SDK setup and config).
   ========================================================= */

const firebaseConfig = {
  apiKey: "GANTI_DENGAN_API_KEY",
  authDomain: "GANTI_DENGAN_PROJECT.firebaseapp.com",
  projectId: "GANTI_DENGAN_PROJECT_ID",
  storageBucket: "GANTI_DENGAN_PROJECT.appspot.com",
  messagingSenderId: "GANTI_DENGAN_SENDER_ID",
  appId: "GANTI_DENGAN_APP_ID",
};

firebase.initializeApp(firebaseConfig);

// Diekspos secara global supaya firestore-service.js & file lain bisa pakai.
window.db = firebase.firestore();
