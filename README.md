# Dashboard Absensi Karyawan

Aplikasi presensi karyawan sederhana — HTML/CSS/JS murni, tanpa
build tool, tanpa dependensi backend. Bisa langsung dibuka pakai
**Live Server** atau di-deploy langsung ke **Vercel** sebagai static site.

Penyimpanan data saat ini memakai **localStorage** (lewat sebuah
modul `db` buatan sendiri di `js/local-db.js`), tapi ditulis dengan
bentuk pemanggilan yang meniru Firebase Firestore — jadi nanti kalau
mau pindah ke Firebase sungguhan, halaman & logika fitur **tidak perlu
diubah** (lihat bagian [Arsitektur penyimpanan](#arsitektur-penyimpanan--jalan-ke-firebase) di bawah).

## Struktur folder

```
absensi-dashboard/
├── index.html            # Dashboard: ringkasan tim, statistik & grafik Chart.js
├── absensi.html          # Absensi: kartu Check-in / Check-out
├── riwayat.html          # Riwayat: tabel presensi + filter Harian/Mingguan/Bulanan
├── profil.html           # Profil: kartu identitas + form data diri
│
├── css/
│   ├── variables.css     # Design tokens: warna, tipografi, spasi, radius
│   ├── base.css          # Reset & gaya dasar
│   ├── layout.css        # Sidebar, topbar, app shell, responsif
│   └── components.css    # Card, tabel, badge status, tombol, form
│
└── js/
    ├── local-db.js        # Penyimpanan data (localStorage), API mirip Firestore
    ├── app-config.js      # Identitas karyawan aktif (terpisah dari mekanisme simpan)
    ├── sidebar.js          # Buka/tutup sidebar di tampilan mobile
    ├── clock.js            # Jam & tanggal berjalan otomatis (topbar + kartu Absensi)
    ├── attendance.js       # Logika Check-in / Check-out (halaman Absensi)
    ├── riwayat.js          # Baca data presensi, filter, hitung ringkasan (halaman Riwayat)
    └── dashboard-stats.js  # Kartu statistik + 2 grafik Chart.js (halaman Dashboard)
```

Setiap file JS berdiri sendiri untuk satu tanggung jawab, supaya
gampang dipelajari atau diganti satu-satu tanpa menyentuh yang lain.

## Cara menjalankan

Tidak ada instalasi apa pun yang dibutuhkan.

- **Live Server (VS Code):** buka folder ini, klik kanan `index.html` → "Open with Live Server".
- **Server statis manual:** `npx serve .` lalu buka `http://localhost:3000`.
- **Deploy ke Vercel:** hubungkan folder ini sebagai project baru di Vercel — tanpa build command, tanpa environment variable, langsung jalan (framework preset: "Other").

> Catatan: sebaiknya jangan dibuka langsung lewat `file://` (double-klik),
> karena beberapa browser membatasi `localStorage` di skema `file://`.
> Live Server / `npx serve` menghindari masalah ini.

## Fitur

### 1. Check-in / Check-out (halaman Absensi)
- Tombol **Check-in** mencatat tanggal & jam otomatis dari `Date()`, lalu **terkunci** (tidak bisa diklik lagi) begitu sudah dipakai hari itu.
- Tombol **Check-out** nonaktif sampai Check-in dilakukan, lalu ikut terkunci setelah dipakai.
- **Total Jam Kerja** dihitung otomatis: berjalan real-time selagi status "Sedang Bekerja", lalu terkunci ke nilai akhir setelah Check-out.
- Status otomatis ditentukan dari jam check-in: **Hadir** (≤ 08:15) atau **Telat** (> 08:15).
- Data disimpan per tanggal & per karyawan, jadi otomatis "reset" tampilannya di hari berikutnya tanpa perlu tindakan apa pun.

### 2. Riwayat (halaman Riwayat)
- Tabel: **Tanggal, Hari, Jam Check-in, Jam Check-out, Total Jam Kerja, Status**.
- Filter periode — **Harian / Mingguan / Bulanan**:
  - Harian → hari ini saja
  - Mingguan → Senin minggu ini s/d hari ini
  - Bulanan → tanggal 1 bulan ini s/d hari ini
- Ringkasan otomatis di atas tabel (dihitung ulang tiap ganti filter): **Total Hadir**, **Total Terlambat**, **Total Jam Kerja**, **Persentase Kehadiran** (Total Hadir ÷ jumlah hari kerja Senin–Jumat yang sudah berlalu di periode itu).

### 3. Dashboard Statistik (halaman Dashboard)
- 4 kartu ringkasan bulan berjalan: **Total Hadir**, **Total Jam Kerja**, **Total Terlambat**, **Persentase Kehadiran**.
- **Grafik Kehadiran Mingguan** — bar chart bertumpuk (Chart.js), Senin–Minggu, tiap hari menunjukkan Hadir (hijau) / Terlambat (amber) / Alpha (merah, untuk hari kerja tanpa check-in).
- **Grafik Kehadiran Bulanan** — line chart jumlah hari hadir per kelompok minggu (Minggu 1–5) dalam bulan berjalan.

### 4. Data bertahan setelah refresh
Semua data presensi tersimpan di `localStorage` browser, jadi kalau
halaman di-refresh (atau ditutup lalu dibuka lagi), data Check-in/Check-out
hari-hari sebelumnya tetap ada dan langsung tampil kembali di Absensi,
Riwayat, maupun Dashboard.

## Arsitektur penyimpanan & jalan ke Firebase

Ini bagian pentingnya. `js/local-db.js` **bukan sekadar wrapper
localStorage biasa** — dia sengaja meniru bentuk pemanggilan Firebase
Firestore (versi *compat*):

```js
db.collection("attendance").doc(id).set(data, { merge: true });
db.collection("attendance").doc(id).onSnapshot(callback, errorCallback);
db.collection("attendance").where("nama", "==", "Atna").onSnapshot(callback, errorCallback);
```

`attendance.js`, `riwayat.js`, dan `dashboard-stats.js` semuanya
menulis kode dengan pola di atas — persis seperti kalau mereka
bicara langsung ke Firestore. Di balik layar, `local-db.js` cuma
menyimpan datanya ke `localStorage` dengan key `localdb:attendance:{id}`,
dan mensimulasikan sifat "real-time" `onSnapshot` lewat pub-sub
sederhana (plus event `storage` bawaan browser untuk sinkron antar-tab).

**Kalau nanti mau pindah ke Firebase Firestore sungguhan:**

1. Tambahkan Firebase SDK (CDN atau npm) dan `firebase-config.js` yang menginisialisasi `firebase.initializeApp(...)` lalu `const db = firebase.firestore();` — variabel global `db` inilah yang dipakai kode lain.
2. Hapus/ganti `<script src="js/local-db.js">` di `index.html`, `absensi.html`, `riwayat.html` dengan script Firebase SDK + `firebase-config.js` tersebut.
3. Selesai — **`attendance.js`, `riwayat.js`, `dashboard-stats.js`, dan seluruh tampilan tidak perlu diubah**, karena bentuk pemanggilan `db.collection(...)` sudah cocok dengan API Firestore asli.

### Struktur data

Sengaja dibuat flat & sederhana, siap dipakai baik oleh `local-db.js`
maupun Firestore asli nanti:

```
attendance (collection)
└── {employeeId}_{YYYY-MM-DD}   (contoh: "atna_2026-07-06")
      ├── nama                 : string   → "Atna"
      ├── tanggal              : string   → "2026-07-06"
      ├── checkIn              : string | null   → ISO datetime
      ├── checkOut             : string | null   → ISO datetime
      ├── totalJamKerjaDetik   : number   → detik (dihitung saat check-out)
      └── status               : "hadir" | "telat" | "belum"
```

- **ID record** = `{employeeId}_{tanggal}` — otomatis mencegah check-in ganda di hari yang sama (record yang sama di-*merge*, bukan dibuat baru).
- **Multi-karyawan di masa depan**: cukup jadikan `CURRENT_EMPLOYEE` di `app-config.js` dinamis (misalnya dari sistem login) — struktur field `nama` / ID record sudah mendukung banyak karyawan tanpa perubahan skema.

## Konsep desain

- **Sidebar navy gelap** dengan 4 menu: Dashboard, Absensi, Riwayat, Profil.
- **"Punch-clock" jam digital** di topbar & kartu Absensi — motif mesin presensi karyawan, memakai font monospace (JetBrains Mono) untuk semua angka/waktu agar terasa presisi.
- **Badge status bergaya stempel** (border putus-putus) untuk status Hadir / Telat / Alpha — mengacu pada visual stempel kartu absen.
- Tipografi: **Sora** (judul), **Inter** (teks), **JetBrains Mono** (angka & waktu).
- Sepenuhnya responsif: sidebar menyusut jadi ikon saja di tablet, berubah jadi drawer geser di layar mobile (<800px).

## Batasan saat ini

- Data tersimpan per browser/perangkat (localStorage tidak disinkron antar-perangkat) — ini yang akan hilang begitu pindah ke Firebase.
- Baru mendukung 1 karyawan aktif per waktu (`CURRENT_EMPLOYEE` statis) — belum ada sistem login.
- Belum ada fitur Izin/Cuti; status otomatis hanya Hadir/Telat/Alpha berdasarkan ada-tidaknya check-in.
