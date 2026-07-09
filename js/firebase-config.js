// Firebase Configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDbq1AFBn359es8Ibiz-Pu0RAoMXcyoRi0",
  authDomain: "absensi-ops.firebaseapp.com",
  projectId: "absensi-ops",
  storageBucket: "absensi-ops.firebasestorage.app",
  messagingSenderId: "1063092003478",
  appId: "1:1063092003478:web:4d670e9430be15129458b7",
  measurementId: "G-Z3CKTKMTBS"
};

// Initialize Firebase with error handling
try {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully");
  
  // Export Firebase services as global variables
  window.db = firebase.firestore();
  window.auth = firebase.auth();
  
  console.log("Firebase services exported:", { db: !!window.db, auth: !!window.auth });
} catch (error) {
  console.error("Firebase initialization error:", error);
  alert("Gagal menghubungkan ke Firebase. Silakan refresh halaman.");
}
