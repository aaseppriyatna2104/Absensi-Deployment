/* =========================================================
   PDF REPORT GENERATOR — Generate professional attendance reports
   for sending to managers. Uses html2pdf.js with custom formatting.
   ========================================================= */

(function () {
  const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const MONTH_NAMES = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  /** Menambahkan angka nol di depan kalau kurang dari 2 digit. */
  function pad(n) { return String(n).padStart(2, "0"); }

  /** Memformat objek Date menjadi jam "HH:MM:SS". */
  function formatClock(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  /** Memformat objek Date menjadi "DD Month YYYY". */
  function formatDate(date) {
    return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
  }

  /** Memformat durasi dalam detik menjadi "HH:MM:SS". */
  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const h = pad(Math.floor(total / 3600));
    const m = pad(Math.floor((total % 3600) / 60));
    const s = pad(total % 60);
    return `${h}:${m}:${s}`;
  }

  /**
   * Generate PDF report from attendance data
   * @param {Array} records - Array of attendance records
   * @param {string} title - Report title
   * @param {string} period - Period description (e.g., "Bulan Juli 2026")
   */
  function generateAttendanceReport(records, title, period) {
    console.log("generateAttendanceReport called with", records.length, "records");
    
    if (typeof html2pdf === "undefined") {
      window.showToast("Library PDF tidak tersedia. Cek koneksi internet.", "error");
      return;
    }

    if (!records || records.length === 0) {
      window.showToast("Tidak ada data untuk diexport ke PDF.", "error");
      return;
    }

    // Sort records by date (newest first)
    const sortedRecords = [...records].sort((a, b) => {
      const dateA = new Date(a.tanggal);
      const dateB = new Date(b.tanggal);
      return dateB - dateA;
    });

    console.log("Sorted records:", sortedRecords);

    // Calculate statistics
    const totalHadir = sortedRecords.filter(r => r.checkIn).length;
    const totalAlpha = sortedRecords.length - totalHadir;
    const totalDetik = sortedRecords.reduce((sum, r) => {
      return sum + (r.checkIn && r.checkOut ? (r.totalJamKerjaDetik || 0) : 0);
    }, 0);

    console.log("Stats - Hadir:", totalHadir, "Alpha:", totalAlpha, "Total Detik:", totalDetik);

    // Generate HTML for PDF
    const reportHTML = `
      <div style="font-family: Arial, sans-serif; padding: 30px; color: #333; background: white;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2E9678; padding-bottom: 15px;">
          <h1 style="margin: 0; color: #1e293b; font-size: 22px; font-weight: bold;">LAPORAN KEHADIRAN KARYAWAN</h1>
          <h2 style="margin: 8px 0 0 0; color: #64748b; font-size: 14px; font-weight: normal;">Recharge Absensi - Operasional Jakarta</h2>
          <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">${period}</p>
        </div>

        <!-- Summary Statistics -->
        <div style="display: flex; gap: 15px; margin-bottom: 25px;">
          <div style="flex: 1; background: #f0fdf4; border: 1px solid #2E9678; border-radius: 6px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; color: #666; margin-bottom: 5px; font-weight: bold;">TOTAL HADIR</div>
            <div style="font-size: 24px; font-weight: bold; color: #2E9678;">${totalHadir}</div>
          </div>
          <div style="flex: 1; background: #fef2f2; border: 1px solid #D9534F; border-radius: 6px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; color: #666; margin-bottom: 5px; font-weight: bold;">TOTAL ALPHA</div>
            <div style="font-size: 24px; font-weight: bold; color: #D9534F;">${totalAlpha}</div>
          </div>
          <div style="flex: 1; background: #eff6ff; border: 1px solid #3b82f6; border-radius: 6px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; color: #666; margin-bottom: 5px; font-weight: bold;">TOTAL JAM KERJA</div>
            <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${formatDuration(totalDetik)}</div>
          </div>
        </div>

        <!-- Attendance Table -->
        <div style="margin-bottom: 20px;">
          <h3 style="margin: 0 0 12px 0; color: #1e293b; font-size: 14px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 8px;">Detail Kehadiran</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left; font-weight: bold; background: #f8f9fa;">No</th>
                <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left; font-weight: bold; background: #f8f9fa;">Tanggal</th>
                <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left; font-weight: bold; background: #f8f9fa;">Hari</th>
                <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left; font-weight: bold; background: #f8f9fa;">Nama</th>
                <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left; font-weight: bold; background: #f8f9fa;">Check In</th>
                <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left; font-weight: bold; background: #f8f9fa;">Check Out</th>
                <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left; font-weight: bold; background: #f8f9fa;">Total Jam</th>
                <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left; font-weight: bold; background: #f8f9fa;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${sortedRecords.map((record, index) => {
                const date = new Date(record.tanggal);
                const dayName = DAY_NAMES[date.getDay()];
                const checkInTime = record.checkIn ? formatClock(new Date(record.checkIn)) : "-";
                const checkOutTime = record.checkOut ? formatClock(new Date(record.checkOut)) : "-";
                const workTime = record.checkIn && record.checkOut ? formatDuration(record.totalJamKerjaDetik || 0) : "-";
                const status = record.checkIn ? "Hadir" : "Alpha";
                const statusColor = status === "Hadir" ? "#2E9678" : "#D9534F";
                const bgColor = index % 2 === 0 ? "#ffffff" : "#f8f9fa";
                
                return `
                  <tr style="background: ${bgColor};">
                    <td style="border: 1px solid #dee2e6; padding: 6px; text-align: center;">${index + 1}</td>
                    <td style="border: 1px solid #dee2e6; padding: 6px;">${formatDate(date)}</td>
                    <td style="border: 1px solid #dee2e6; padding: 6px;">${dayName}</td>
                    <td style="border: 1px solid #dee2e6; padding: 6px;">${record.nama || "-"}</td>
                    <td style="border: 1px solid #dee2e6; padding: 6px;">${checkInTime}</td>
                    <td style="border: 1px solid #dee2e6; padding: 6px;">${checkOutTime}</td>
                    <td style="border: 1px solid #dee2e6; padding: 6px;">${workTime}</td>
                    <td style="border: 1px solid #dee2e6; padding: 6px; color: ${statusColor}; font-weight: bold; text-align: center;">${status}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #666;">
          <p style="margin: 0;">Laporan ini dibuat secara otomatis oleh sistem Recharge Absensi</p>
          <p style="margin: 5px 0 0 0;">Tanggal cetak: ${formatDate(new Date())} ${formatClock(new Date())}</p>
          <p style="margin: 5px 0 0 0;">Total data: ${sortedRecords.length} record</p>
        </div>
      </div>
    `;

    console.log("Report HTML generated");

    // PDF configuration
    const opt = {
      margin: 15,
      filename: `Laporan_Kehadiran_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    console.log("Starting PDF generation");

    // Generate and download PDF
    const element = document.createElement('div');
    element.innerHTML = reportHTML;
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    element.style.width = '210mm'; // A4 width
    document.body.appendChild(element);

    console.log("Element added to DOM");

    html2pdf().set(opt).from(element).save().then(() => {
      console.log("PDF saved successfully");
      document.body.removeChild(element);
      window.showToast("Laporan PDF berhasil diunduh!", "success");
    }).catch(err => {
      console.error("PDF generation error:", err);
      document.body.removeChild(element);
      window.showToast("Gagal membuat laporan PDF: " + err.message, "error");
    });
  }

  // Export function to global scope
  window.generateAttendanceReport = generateAttendanceReport;

})();
