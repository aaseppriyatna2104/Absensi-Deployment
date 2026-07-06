# Setup Firebase Firestore — Dashboard Absensi

## 1. Buat project Firebase (kalau belum ada)

1. Buka https://console.firebase.google.com → **Add project**.
2. Setelah project jadi, klik ikon **Web (</>)** untuk daftarkan app web.
3. Firebase kasih objek `firebaseConfig` — copy semua isinya.
4. Buka `js/firebase-config.js`, ganti bagian `GANTI_DENGAN_...` dengan
   nilai asli dari Firebase Console.
5. Di sidebar Firebase Console → **Build > Firestore Database** →
   **Create database** → pilih lokasi (mis. `asia-southeast2` biar
   dekat Jakarta) → mode **production** (kita atur rules manual di
   langkah 3).

## 2. Struktur collection

```
absensi (collection)
└── {tanggal}_{nama-slug} (document, contoh: "2026-07-06_asep-saepudin")
    ├── nama            : string
    ├── tanggal          : string   ("2026-07-06")
    ├── checkIn          : string | null   (ISO datetime)
    ├── checkOut         : string | null   (ISO datetime)
    ├── totalJamKerjaMs  : number
    ├── status           : "hadir" | "telat" | "izin" | "alpha"
    ├── createdAt        : timestamp
    └── updatedAt        : timestamp
```

Kenapa strukturnya begini:
- **1 dokumen = 1 orang, 1 hari.** ID dokumen dibuat dari tanggal + nama,
  jadi check-in & check-out tinggal "upsert" ke dokumen yang sama —
  gak perlu query dulu.
- **`tanggal` sebagai string `YYYY-MM-DD`** bisa langsung dipakai buat
  filter rentang tanggal (Harian/Mingguan/Bulanan di Riwayat).
- **Mudah dikembangkan**: mau nambah field baru nanti (misalnya
  `divisi`, `lokasi`, `catatan`, `foto`) tinggal tambah di
  `js/firestore-service.js` pada fungsi `checkIn`/`checkOut` — dokumen
  lama tetap valid, gak perlu migrasi.

## 3. Firestore Security Rules (sementara, untuk internal tool)

Di Firebase Console → Firestore Database → tab **Rules**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /absensi/{docId} {
      allow read, write: if true; // sementara — belum ada auth
    }
  }
}
```

⚠️ Ini masih terbuka untuk siapa saja yang tahu URL project-nya.
Karena ini tool internal (dipakai tim operasional Recharge Indonesia),
untuk produksi nanti sebaiknya tambah Firebase Authentication supaya
rule-nya bisa dibatasi ke user yang login. Kalau perlu, saya bisa
bantu sekalian.

## 4. File yang diubah / ditambahkan

| File | Status | Keterangan |
|---|---|---|
| `js/firebase-config.js` | **Baru** | Init Firebase — isi config kamu di sini |
| `js/firestore-service.js` | **Baru** | Lapisan akses data (collection `absensi`) |
| `js/attendance.js` | **Baru** | Check-in/out → tulis ke Firestore. **Cek ID elemen** di komentar atas file, cocokkan dengan `absensi.html` kamu |
| `js/riwayat.js` | **Baru** | Baca real-time dari Firestore + filter. **Cek ID elemen** di komentar atas file, cocokkan dengan `riwayat.html` kamu |
| `js/dashboard-stats.js` | **Diubah** | Sekarang baca real-time dari Firestore (bukan localStorage lagi) |
| `index.html` | **Diubah** | Tambah `<script>` Firebase SDK + `firebase-config.js` + `firestore-service.js` |

## 5. Yang perlu kamu lakukan di `absensi.html` & `riwayat.html`

Kedua file itu tidak ikut ter-upload ke saya, jadi belum saya sentuh.
Tambahkan urutan script berikut sebelum `attendance.js` / `riwayat.js`:

```html
<script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore-compat.js"></script>
<script src="js/firebase-config.js"></script>
<script src="js/firestore-service.js"></script>
<script src="js/sidebar.js"></script>
<script src="js/clock.js"></script>
<script src="js/attendance.js"></script>   <!-- khusus absensi.html -->
<script src="js/riwayat.js"></script>       <!-- khusus riwayat.html -->
```

Lalu pastikan ID elemen di HTML kamu sama dengan yang dipakai
`attendance.js`/`riwayat.js` (didaftar di komentar atas tiap file).
Kalau beda, paling gampang: kirim ke saya isi `absensi.html` dan
`riwayat.html` yang asli, nanti saya sesuaikan otomatis biar 100%
nyambung tanpa kamu perlu edit manual.

## 6. Cara test

1. Isi `firebase-config.js` dengan config asli.
2. Set Firestore Rules seperti langkah 3.
3. Buka `absensi.html`, klik **Check-in** → cek di Firebase Console
   > Firestore Database, harus muncul dokumen baru di collection
   `absensi`.
4. Buka `index.html` (Dashboard) dan `riwayat.html` — datanya harus
   langsung muncul tanpa refresh (real-time lewat `onSnapshot`).
5. Klik **Check-out** di `absensi.html` → Dashboard & Riwayat otomatis
   update lagi.
