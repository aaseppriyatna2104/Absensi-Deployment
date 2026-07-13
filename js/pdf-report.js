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
    if (typeof html2pdf === "undefined") {
      window.showToast("Library PDF tidak tersedia. Cek koneksi internet.", "error");
      return;
    }

    // Sort records by date (newest first)
    const sortedRecords = [...records].sort((a, b) => {
      const dateA = new Date(a.tanggal);
      const dateB = new Date(b.tanggal);
      return dateB - dateA;
    });

    // Calculate statistics
    const totalHadir = sortedRecords.filter(r => r.checkIn).length;
    const totalAlpha = sortedRecords.length - totalHadir;
    const totalDetik = sortedRecords.reduce((sum, r) => {
      return sum + (r.checkIn && r.checkOut ? (r.totalJamKerjaDetik || 0) : 0);
    }, 0);

    // Generate HTML for PDF
    const reportHTML = `
      <div style="font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #2E9678; padding-bottom: 20px;">
          <h1 style="margin: 0; color: #1e293b; font-size: 24px; font-weight: 700;">LAPORAN KEHADIRAN KARYAWAN</h1>
          <h2 style="margin: 10px 0 0 0; color: #64748b; font-size: 16px; font-weight: 500;">Recharge Absensi - Operasional Jakarta</h2>
          <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 14px;">${period}</p>
        </div>

        <!-- Summary Statistics -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
          <div style="background: #f0fdf4; border: 1px solid #2E9678; border-radius: 8px; padding: 15px; text-align: center;">
            <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">TOTAL HADIR</div>
            <div style="font-size: 28px; font-weight: 700; color: #2E9678;">${totalHadir}</div>
          </div>
          <div style="background: #fef2f2; border: 1px solid #D9534F; border-radius: 8px; padding: 15px; text-align: center;">
            <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">TOTAL ALPHA</div>
            <div style="font-size: 28px; font-weight: 700; color: #D9534F;">${totalAlpha}</div>
          </div>
          <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 15px; text-align: center;">
            <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">TOTAL JAM KERJA</div>
            <div style="font-size: 28px; font-weight: 700; color: #3b82f6;">${formatDuration(totalDetik)}</div>
          </div>
        </div>

        <!-- Attendance Table -->
        <div style="margin-bottom: 30px;">
          <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px; font-weight: 600;">Detail Kehadiran</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-weight: 600;">Tanggal</th>
                <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-weight: 600;">Hari</th>
                <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-weight: 600;">Nama</th>
                <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-weight: 600;">Check In</th>
                <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-weight: 600;">Check Out</th>
                <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-weight: 600;">Total Jam Kerja</th>
                <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-weight: 600;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${sortedRecords.map(record => {
                const date = new Date(record.tanggal);
                const dayName = DAY_NAMES[date.getDay()];
                const checkInTime = record.checkIn ? formatClock(new Date(record.checkIn)) : "-";
                const checkOutTime = record.checkOut ? formatClock(new Date(record.checkOut)) : "-";
                const workTime = record.checkIn && record.checkOut ? formatDuration(record.totalJamKerjaDetik || 0) : "-";
                const status = record.checkIn ? "Hadir" : "Alpha";
                const statusColor = status === "Hadir" ? "#2E9678" : "#D9534F";
                
                return `
                  <tr>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">${formatDate(date)}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">${dayName}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">${record.nama || "-"}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">${checkInTime}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">${checkOutTime}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px;">${workTime}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 8px; color: ${statusColor}; font-weight: 600;">${status}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
          <p style="margin: 0;">Laporan ini dibuat secara otomatis oleh sistem Recharge Absensi</p>
          <p style="margin: 5px 0 0 0;">Tanggal cetak: ${formatDate(new Date())} ${formatClock(new Date())}</p>
        </div>
      </div>
    `;

    // PDF configuration
    const opt = {
      margin: 10,
      filename: `Laporan_Kehadiran_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Generate and download PDF
    const element = document.createElement('div');
    element.innerHTML = reportHTML;
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    document.body.appendChild(element);

    html2pdf().set(opt).from(element).save().then(() => {
      document.body.removeChild(element);
      window.showToast("Laporan PDF berhasil diunduh!", "success");
    }).catch(err => {
      console.error("PDF generation error:", err);
      document.body.removeChild(element);
      window.showToast("Gagal membuat laporan PDF.", "error");
    });
  }

  // Export function to global scope
  window.generateAttendanceReport = generateAttendanceReport;

})();
