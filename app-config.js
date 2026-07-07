/* =========================================================
   APP CONFIG — pengaturan aplikasi yang tidak tergantung pada
   jenis penyimpanan (localStorage sekarang, Firestore nanti).

   Dipisah dari file "db" (local-db.js) supaya kalau nanti
   pindah ke Firebase, file ini TIDAK PERLU diubah sama sekali.
   ========================================================= */

/* ---------------------------------------------------------
   Identitas karyawan aktif.
   Untuk saat ini masih 1 karyawan (statis) — cukup ganti nilai
   di sini kalau dipakai orang lain. Field "id" dipakai sebagai
   bagian dari ID dokumen/record, "nama" disimpan sebagai data.
   Struktur ini sudah didesain gampang dikembangkan jadi
   multi-karyawan (misalnya nanti dihubungkan ke sistem login).
   --------------------------------------------------------- */
const CURRENT_EMPLOYEE = {
  id: "atna",     // dipakai sebagai bagian dari ID record
  nama: "Atna",   // disimpan ke field "nama"
};
