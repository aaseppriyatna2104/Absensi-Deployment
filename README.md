# Dashboard Absensi Karyawan — Recharge Indonesia

Aplikasi presensi karyawan berbasis web — HTML/CSS/JS murni di sisi
tampilan, dengan **Firebase Firestore sungguhan** sebagai penyimpanan
data (bukan lagi localStorage). Bisa langsung dibuka pakai **Live
Server** atau di-deploy ke **Vercel** sebagai static site.

> ⚠️ **Catatan penting soal keamanan (baca sebelum pakai data
> sungguhan)**: Login di aplikasi ini murni autentikasi sisi-klien —
> daftar akun & password ada di `js/auth.js` dan bisa dilihat siapa
> pun lewat "View Source" browser. Pembatasan admin/staff (menu mana
> yang muncul, halaman mana yang boleh diakses) juga cuma logika
> JavaScript di browser. Yang benar-benar menentukan siapa boleh
> baca/tulis/hapus data adalah **Firestore Security Rules** di
> Firebase Console (project `absensi-ops`) — itu di luar kode repo
> ini. Kalau Rules-nya masih longgar/default, siapa pun yang buka
> Developer Console browser bisa langsung baca/ubah/hapus semua data
> presensi & profil, terlepas dari login atau tidak. **Cek dan
> perketat Rules ini di Firebase Console kalau aplikasi dipakai untuk
> data operasional sungguhan.**

## Login & Akun

Halaman pertama yang dibuka pengguna adalah `login.html`. Tiga akun
demo sudah disiapkan (password mengikuti pola `{username}123`):

| Username | Password   | Peran   |
|----------|------------|---------|
| `admin`  | `admin123` | Admin   |
| `asep`   | `asep123`  | Staff   |
| `rezky`  | `rezky123` | Staff   |

Daftar akun ada di `js/auth.js` (array `USERS`) — tambah karyawan baru
cukup tambah satu baris di situ.

**Staff** hanya melihat & mencatat presensinya sendiri, mengajukan
perubahan data profil (butuh persetujuan admin), dan melihat jadwal
tim (read-only).

**Admin** melihat data gabungan semua staff, bisa input/edit/hapus
presensi manual, mengelola jadwal tim, menyetujui/menolak pengajuan
perubahan profil staff, dan mengunci/membuka akses edit profil staff.

Semua halaman terproteksi punya **guard login di `<head>`**
(redirect ke `/login` sebelum konten sempat terlihat kalau belum ada
sesi), dan halaman khusus admin punya **guard tambahan** yang
melempar staff ke `/absensi` kalau nekat buka lewat URL langsung.

## Struktur folder

```
project 1 copy 1 sesi 1/
├── login.html                     # Login (3 akun demo)
├── index.html                     # Dashboard: statistik & grafik Chart.js (admin: semua staff)
├── absensi.html                   # Absensi: kartu Check-in / Check-out + lokasi GPS
├── riwayat.html                   # Riwayat: tabel presensi + filter Harian/Mingguan/Bulanan
├── profil.html                    # Profil: data diri + pengajuan perubahan (staff perlu approval admin)
├── jadwal.html                    # Jadwal: kalender kegiatan tim (staff read-only, admin CRUD + drag&drop)
├── kelola-data.html               # [Admin] Lihat/edit/hapus semua data presensi + input manual + kalender per staff
├── persetujuan-profil.html        # [Admin] Setujui/tolak pengajuan perubahan profil staff
├── kelola-kunci-profil.html       # [Admin] Kunci/buka akses edit profil per staff
├── clear-data.html                # [Admin] Utilitas hapus data (dilindungi guard login+admin)
│
├── vercel.json                    # cleanUrls: true — supaya redirect "/login" dsb. jalan tanpa .html
│
├── css/
│   └── style.css                  # Satu file CSS: design tokens, reset, layout, komponen, dark mode
│
└── js/
    ├── firebase-config.js         # Inisialisasi Firebase (window.db, window.auth)
    ├── auth.js                    # Daftar akun, login/logout, baca sesi — dimuat SEBELUM core.js
    ├── core.js                    # Dipakai di semua halaman: identitas sesi, role-based menu,
    │                               # dark mode, toast, spinner, sidebar mobile, jam berjalan
    ├── attendance.js               # Absensi: Check-in/Check-out + GPS
    ├── riwayat.js                  # Riwayat: baca data, filter, ringkasan
    ├── dashboard-stats.js           # Dashboard: kartu statistik + 2 grafik Chart.js
    ├── jadwal.js                   # Kalender jadwal tim
    ├── kelola-data.js               # [Admin] CRUD data presensi + input manual + kalender per staff
    ├── persetujuan-profil.js         # [Admin] Approval pengajuan perubahan profil
    ├── kelola-kunci-profil.js        # [Admin] Kunci/buka profil staff
    ├── profil.js                    # Profil: load, validasi, submit (langsung / lewat approval)
    ├── pdf-report.js                 # Generator laporan PDF (html2pdf.js)
    └── excel-report.js               # Generator laporan Excel (SheetJS)
```

Tiap halaman terproteksi memuat **1 file CSS + Firebase SDK (CDN) +
`firebase-config.js` + `auth.js` + `core.js` + file fitur halaman itu
sendiri** (lihat tag `<script>` di masing-masing HTML).

## Fitur

### 1. Check-in / Check-out (Absensi)
- Mencatat tanggal & jam otomatis, plus **lokasi GPS** (kalau
  diizinkan browser) untuk check-in maupun check-out.
- Tombol terkunci begitu sudah dipakai hari itu; Check-out nonaktif
  sampai Check-in dilakukan.
- Total Jam Kerja berjalan real-time selagi "Sedang Bekerja", lalu
  terkunci ke nilai akhir setelah Check-out.
- Kalau lupa check-out di hari sebelumnya, sistem otomatis mendeteksi
  sesi aktif yang belum ditutup dan mengizinkan check-out untuknya.

### 2. Riwayat
- Tabel: Tanggal, Hari, Nama, Check-in, Check-out, Total Jam Kerja,
  Status, Lokasi Check-in/out (link Google Maps).
- Filter Harian / Mingguan / Bulanan dengan ringkasan Total Hadir,
  Total Alpha, Total Jam Kerja, Persentase Kehadiran.
- Admin melihat data semua staff sekaligus; staff hanya data sendiri.
- Export ke PDF (laporan terstruktur, bukan screenshot) dan Excel.

### 3. Dashboard Statistik
- Kartu ringkasan hari ini & bulan berjalan (Hadir, Alpha, Jam Kerja,
  Persentase Kehadiran).
- Grafik Kehadiran Mingguan (bar chart bertumpuk) & Bulanan (line
  chart), pakai Chart.js.

### 4. Jadwal Tim
- Kalender kegiatan bulanan. Admin bisa tambah/edit/hapus event dan
  drag & drop ke tanggal lain; staff hanya melihat (read-only).

### 5. Profil & Persetujuan Perubahan Data
- Staff mengedit data diri (nama, email, telepon, alamat, kontak
  darurat) — perubahan masuk antrian **persetujuan admin**, tidak
  langsung berlaku, sampai disetujui di halaman Persetujuan Profil.
- Admin (`kelola-kunci-profil.html`) bisa mengunci profil staff
  tertentu supaya tidak bisa diedit sama sekali sampai dibuka lagi.
- Perubahan admin sendiri berlaku langsung, tanpa approval.

### 6. Kelola Data (Admin)
- Lihat/edit/hapus semua data presensi seluruh staff dalam satu
  tabel, dengan pencarian nama.
- **Input Manual Presensi** — untuk backfill data karyawan yang lupa
  absen (status Hadir/Alpha, bisa dengan atau tanpa jam spesifik).
- **Kalender per staff** — lihat rekap kehadiran satu staff dalam
  tampilan kalender bulanan, lengkap dengan detail per tanggal &
  lokasi GPS, bisa di-export ke PDF.
- Export tabel ke PDF & Excel (menghormati filter pencarian aktif).

### 7. Status "Hadir" — logika konsisten di seluruh aplikasi
Sebuah record dianggap **Hadir** kalau field `status === "hadir"`
ATAU ada `checkIn` — bukan cuma salah satu. Ini penting untuk entri
manual "Hadir tanpa jam" dari Kelola Data (checkIn kosong tapi status
eksplisit "hadir"). Logika ini dipakai konsisten di Kelola Data,
Riwayat, Dashboard, **dan** generator laporan PDF/Excel.

## Cara menjalankan

- **Live Server (VS Code):** buka folder ini, klik kanan `index.html`
  → "Open with Live Server".
- **Deploy ke Vercel:** hubungkan folder ini sebagai project baru di
  Vercel — tanpa build command, tanpa environment variable
  (framework preset: "Other"). `vercel.json` sudah menyetel
  `cleanUrls: true`.

> ⚠️ **Batasan dev lokal**: seluruh redirect di kode (guard login,
> guard admin, tombol logout, dst.) pakai URL bersih tanpa `.html`
> (mis. `/login`, `/absensi`). Ini otomatis di-resolve oleh Vercel
> berkat `cleanUrls: true`, tapi **server statis biasa seperti
> `npx serve .` atau Live Server TIDAK tahu soal itu** — buka file
> langsung (mis. `index.html`) tetap bisa, tapi begitu ada redirect
> ke path tanpa ekstensi, kemungkinan besar hasilnya 404. Kalau mau
> testing alur guard/redirect persis seperti di production, pakai
> `vercel dev` (butuh Vercel CLI: `npm i -g vercel`, lalu `vercel dev`
> di folder ini), atau uji langsung di deployment Vercel (preview
> branch/PR juga bisa).

## Arsitektur data (Firestore)

Koneksi ke Firestore diatur di `js/firebase-config.js`
(`window.db = firebase.firestore()`). Semua file fitur
(`attendance.js`, `riwayat.js`, `dashboard-stats.js`, `kelola-data.js`,
`jadwal.js`, `profil.js`, `persetujuan-profil.js`,
`kelola-kunci-profil.js`) memanggil `db.collection(...)` langsung.

Collection yang dipakai:

| Collection        | Isi                                                                  | ID dokumen                 |
|--------------------|------------------------------------------------------------------------|--------------------------------|
| `attendance`        | Record presensi harian per karyawan                                    | `{username}_{YYYY-MM-DD}`        |
| `profiles`           | Data profil resmi per karyawan (nama, email, telepon, alamat, dst.)     | `{username}`                    |
| `profileRequests`     | Pengajuan perubahan profil staff yang menunggu/sudah ditinjau admin     | auto-generated (`.add()`)         |
| `schedule`            | Event kalender jadwal tim                                              | auto-generated (`.add()`)         |

Struktur `attendance` (field utama):
```
attendance (collection)
└── {username}_{YYYY-MM-DD}
      ├── nama                 : string
      ├── tanggal              : string   → "YYYY-MM-DD"
      ├── checkIn              : string | null   → ISO datetime
      ├── checkOut             : string | null   → ISO datetime
      ├── totalJamKerjaDetik   : number   → detik
      ├── status               : "hadir" | "belum"
      ├── checkInLat/Long/Accuracy    : number | null (GPS check-in)
      ├── checkOutLat/Long/Accuracy   : number | null (GPS check-out)
      ├── inputManual          : boolean  → true kalau diinput admin via Kelola Data
      └── diinputOleh          : string   → username admin, kalau inputManual
```

- **ID record** = `{username}_{tanggal}` — otomatis mencegah check-in
  ganda di hari yang sama (record yang sama di-*merge*, bukan dibuat
  baru).
- Menambah karyawan baru cukup tambah satu baris di `USERS`
  (`js/auth.js`) — tidak perlu ubah struktur data atau Rules kalau
  Rules-nya sudah dibuat generik per-role (bukan hardcode username).

## Konsep desain

- Sidebar navy gelap dengan menu Dashboard, Absensi, Jadwal, Riwayat,
  Kelola Data, Persetujuan Profil, Kelola Kunci Profil, Profil —
  otomatis menyesuaikan visibilitas per role.
- "Punch-clock" jam digital di topbar & kartu Absensi, font monospace
  (JetBrains Mono) untuk semua angka/waktu.
- Badge status bergaya stempel (border putus-putus) untuk Hadir/Alpha.
- Tipografi: Sora (judul), Inter (teks), JetBrains Mono (angka & waktu).
- Dark Mode (ikuti preferensi sistem atau manual, tanpa flash warna
  salah saat halaman dibuka), Toast Notification, loading
  spinner/skeleton, animasi ringan yang menghormati
  `prefers-reduced-motion`, sepenuhnya responsif (sidebar jadi drawer
  di layar <800px).

## Batasan / hal yang perlu diperhatikan saat ini

- **Autentikasi & otorisasi murni sisi-klien** — lihat catatan
  keamanan di bagian atas. Untuk pemakaian produksi sungguhan,
  pertimbangkan migrasi ke Firebase Authentication + Firestore
  Security Rules berbasis custom claims/role, bukan sekadar
  membiarkan Rules terbuka dan mengandalkan JS di browser.
- Belum ada fitur Izin/Cuti terstruktur; status presensi otomatis
  hanya Hadir/Alpha berdasarkan ada-tidaknya check-in (kecuali diinput
  manual oleh admin).
- Query Firestore di beberapa halaman sengaja dibuat equality-only
  (tanpa `.orderBy()` digabung `.where()` range) untuk menghindari
  kebutuhan composite index — sorting dilakukan di sisi klien setelah
  data diambil.
