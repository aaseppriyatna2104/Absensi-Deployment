# Dashboard Absensi Karyawan

Aplikasi presensi karyawan sederhana — HTML/CSS/JS murni, tanpa
build tool, tanpa dependensi backend. Bisa langsung dibuka pakai
**Live Server** atau di-deploy langsung ke **Vercel** sebagai static site.

Struktur file sengaja dibuat **seringkas mungkin** (1 file CSS, 5 file
JS) supaya kecil kemungkinan ada path yang putus saat deploy.

Penyimpanan data saat ini memakai **localStorage** (lewat sebuah
modul `db` buatan sendiri, bagian dari `js/core.js`), tapi ditulis
dengan bentuk pemanggilan yang meniru Firebase Firestore — jadi nanti
kalau mau pindah ke Firebase sungguhan, halaman & logika fitur **tidak
perlu diubah** (lihat bagian [Arsitektur penyimpanan](#arsitektur-penyimpanan--jalan-ke-firebase) di bawah).

## Struktur folder

```
absensi-dashboard/
├── index.html            # Dashboard: ringkasan tim, statistik & grafik Chart.js
├── absensi.html          # Absensi: kartu Check-in / Check-out
├── riwayat.html          # Riwayat: tabel presensi + filter Harian/Mingguan/Bulanan
├── profil.html           # Profil: kartu identitas + form data diri
│
├── css/
│   └── style.css         # SATU file CSS: design tokens, reset, layout, komponen, dark mode
│
└── js/
    ├── core.js            # Dipakai di SEMUA halaman: penyimpanan data (mirip Firestore),
    │                      # konfigurasi karyawan, dark mode, toast, spinner, sidebar mobile, jam
    ├── attendance.js       # Khusus halaman Absensi: logika Check-in / Check-out
    ├── riwayat.js          # Khusus halaman Riwayat: baca data, filter, ringkasan
    ├── dashboard-stats.js  # Khusus halaman Dashboard: kartu statistik + 2 grafik Chart.js
    └── validation.js       # Khusus halaman Profil: validasi form
```

Tiap halaman HTML hanya memuat **1 file CSS + 2 file JS**
(`core.js` + satu file fitur halaman itu sendiri) — jauh lebih sedikit
dibanding sebelumnya (4 CSS + hingga 8 JS per halaman), supaya lebih
gampang dipastikan semuanya ikut ter-*deploy* dengan benar.

Isi `core.js` dan `style.css` tetap dipisah per bagian dengan komentar
penanda (`/* ===== dari: nama-file-asli.js ===== */`), jadi tetap mudah
ditelusuri walau sudah digabung jadi satu file. Setiap fungsi diberi
komentar JSDoc singkat di atasnya.

## Pemolesan UI/UX

### Dark Mode
- Tombol toggle (ikon bulan/matahari) ada di topbar tiap halaman & di mobile topbar.
- Preferensi disimpan di `localStorage` (`theme`), otomatis mengikuti preferensi sistem operasi kalau belum pernah diatur manual.
- Ada skrip kecil di `<head>` tiap halaman yang menerapkan tema **sebelum** CSS dirender, supaya tidak ada "kedipan" warna salah saat halaman baru dibuka.

### Loading Spinner
- Tombol **Check-in/Check-out** dan **Simpan Perubahan** (Profil) menampilkan ikon spinner + teks "Menyimpan..." selagi proses berjalan.
- Tabel **Riwayat** menampilkan baris skeleton (placeholder abu-abu berkedip) sesaat sebelum data pertama tampil.

### Toast Notification
- `js/toast.js` menyediakan `window.showToast(pesan, tipe)` yang bisa dipanggil dari file manapun.
- Dipakai untuk memberi tahu hasil Check-in/Check-out (berhasil/gagal/telat), hasil simpan profil, dan error saat memuat data.

### Validasi Input
- Form **Profil** (`js/validation.js`) memvalidasi Nama, Email, Nomor Telepon, dan Alamat — baik saat kolom ditinggalkan (blur) maupun saat form disimpan.
- Field yang tidak valid ditandai merah dengan pesan error di bawahnya; submit dibatalkan sampai semua valid.

### Animasi ringan
- Konten tiap halaman muncul dengan fade-in halus saat pertama dimuat.
- Kartu (`stat-card`, `panel`, `profile-card`) sedikit terangkat saat disentuh mouse (hover).
- Tombol memberi efek "ditekan" saat diklik; toast masuk/keluar dengan slide halus.
- Semua animasi menghormati preferensi `prefers-reduced-motion` (otomatis dimatikan kalau pengguna mengaktifkan pengurangan gerakan di OS).

### Perbaikan lain
- Bug tombol "✕" penutup sidebar mobile diperbaiki (sebelumnya tidak berfungsi karena `querySelector` hanya menangkap 1 dari 2 elemen bertanda `data-sidebar-close`).

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

Ini bagian pentingnya. Bagian "local-db" di dalam `js/core.js`
**bukan sekadar wrapper localStorage biasa** — dia sengaja meniru
bentuk pemanggilan Firebase Firestore (versi *compat*):

```js
db.collection("attendance").doc(id).set(data, { merge: true });
db.collection("attendance").doc(id).onSnapshot(callback, errorCallback);
db.collection("attendance").where("nama", "==", "Atna").onSnapshot(callback, errorCallback);
```

`attendance.js`, `riwayat.js`, dan `dashboard-stats.js` semuanya
menulis kode dengan pola di atas — persis seperti kalau mereka
bicara langsung ke Firestore. Di balik layar, bagian "local-db" ini
cuma menyimpan datanya ke `localStorage` dengan key
`localdb:attendance:{id}`, dan mensimulasikan sifat "real-time"
`onSnapshot` lewat pub-sub sederhana (plus event `storage` bawaan
browser untuk sinkron antar-tab).

**Kalau nanti mau pindah ke Firebase Firestore sungguhan:**

1. Tambahkan Firebase SDK (CDN atau npm) dan `firebase-config.js` yang menginisialisasi `firebase.initializeApp(...)` lalu `const db = firebase.firestore();` — variabel global `db` inilah yang dipakai kode lain.
2. Di `js/core.js`, hapus bagian "dari: local-db.js" (paling atas file), lalu tambahkan script Firebase SDK + `firebase-config.js` tersebut sebelum `core.js` dimuat di tiap halaman HTML.
3. Selesai — **`attendance.js`, `riwayat.js`, `dashboard-stats.js`, dan seluruh tampilan tidak perlu diubah**, karena bentuk pemanggilan `db.collection(...)` sudah cocok dengan API Firestore asli.

### Struktur data

Sengaja dibuat flat & sederhana, siap dipakai baik oleh penyimpanan
lokal saat ini maupun Firestore asli nanti:

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
- **Multi-karyawan di masa depan**: cukup jadikan `CURRENT_EMPLOYEE` (bagian "app-config" di `core.js`) dinamis (misalnya dari sistem login) — struktur field `nama` / ID record sudah mendukung banyak karyawan tanpa perubahan skema.

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
