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
    console.log("Records data:", JSON.stringify(records, null, 2));
    
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

    // Generate table rows HTML
    let tableRows = '';
    sortedRecords.forEach((record, index) => {
      console.log("Processing record", index, ":", record);
      const date = new Date(record.tanggal);
      const dayName = DAY_NAMES[date.getDay()];
      const checkInTime = record.checkIn ? formatClock(new Date(record.checkIn)) : "-";
      const checkOutTime = record.checkOut ? formatClock(new Date(record.checkOut)) : "-";
      const workTime = record.checkIn && record.checkOut ? formatDuration(record.totalJamKerjaDetik || 0) : "-";
      const status = record.checkIn ? "Hadir" : "Alpha";
      const statusColor = status === "Hadir" ? "#2E9678" : "#D9534F";
      const bgColor = index % 2 === 0 ? "#ffffff" : "#f8f9fa";
      
      tableRows += `
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
    });

    console.log("Table rows generated, length:", tableRows.length);

    // Generate HTML for PDF
    const reportHTML = `
      <div style="font-family: Arial, sans-serif; padding: 30px; color: #333; background: white; width: 100%; box-sizing: border-box;">
        <!-- Kop Surat -->
        <div style="display:flex; align-items:center; justify-content:space-between; border-bottom: 4px solid #2E9678; padding-bottom: 14px; margin-bottom: 20px;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="width:48px; height:48px; border-radius:10px; background:#2E9678; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:18px; font-family: 'Courier New', monospace;">RA</div>
            <div>
              <div style="font-size:16px; font-weight:bold; color:#1e293b;">PT. Jalan Terus Saja</div>
              <div style="font-size:11px; color:#64748b;">Recharge Indonesia — Operasional Jakarta</div>
            </div>
          </div>
          <div style="text-align:right; font-size:10px; color:#94a3b8;">
            Dicetak: ${formatDate(new Date())}<br>${formatClock(new Date())} WIB
          </div>
        </div>

        <!-- Header -->
        <div style="text-align: center; margin-bottom: 25px;">
          <h1 style="margin: 0; color: #1e293b; font-size: 20px; font-weight: bold; letter-spacing:0.5px;">LAPORAN KEHADIRAN KARYAWAN</h1>
          <p style="margin: 6px 0 0 0; color: #666; font-size: 12px;">${title}</p>
          <p style="margin: 2px 0 0 0; color: #94a3b8; font-size: 11px;">${period}</p>
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
              ${tableRows}
            </tbody>
          </table>
        </div>

        <!-- Tanda Tangan -->
        <div style="display:flex; justify-content:space-between; margin-top: 50px; font-size: 12px; color:#1e293b;">
          <div style="text-align:center; width: 220px;">
            <div>Dibuat oleh,</div>
            <div style="height: 70px;"></div>
            <div style="border-top: 1px solid #333; padding-top: 6px;">( .......................... )</div>
            <div style="font-size:10px; color:#666; margin-top:2px;">Admin Operasional</div>
          </div>
          <div style="text-align:center; width: 220px;">
            <div>Mengetahui,</div>
            <div style="height: 70px;"></div>
            <div style="border-top: 1px solid #333; padding-top: 6px;">( .......................... )</div>
            <div style="font-size:10px; color:#666; margin-top:2px;">Manajer Operasional</div>
          </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #666;">
          <p style="margin: 0;">Laporan ini dibuat secara otomatis oleh sistem Recharge Absensi</p>
          <p style="margin: 5px 0 0 0;">Total data: ${sortedRecords.length} record</p>
        </div>
      </div>
    `;

    console.log("Report HTML generated, length:", reportHTML.length);
    console.log("Report HTML preview:", reportHTML.substring(0, 500));

    // PDF configuration
    const opt = {
      margin: 10,
      filename: `Laporan_Kehadiran_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    console.log("Starting PDF generation");

    // Generate and download PDF.
    // PENTING: elemen HARUS tetap terlihat (visibility/opacity normal)
    // supaya html2canvas bisa menggambar isinya dengan benar — kalau
    // opacity di-set 0, hasil capture-nya jadi halaman kosong/blank.
    // Solusinya: taruh elemen di luar area layar (bukan disembunyikan).
    const element = document.createElement('div');
    element.innerHTML = reportHTML;
    element.style.position = 'fixed';
    element.style.left = '-10000px'; // di luar viewport, bukan opacity 0
    element.style.top = '0';
    element.style.zIndex = '-1';
    element.style.width = '210mm'; // A4 width
    element.style.background = '#ffffff';
    document.body.appendChild(element);

    console.log("Element added to DOM, innerHTML length:", element.innerHTML.length);

    // Small delay to ensure element is rendered/laid out before capture
    setTimeout(() => {
      html2pdf().set(opt).from(element).save().then(() => {
        console.log("PDF saved successfully");
        document.body.removeChild(element);
        window.showToast("Laporan PDF berhasil diunduh!", "success");
      }).catch(err => {
        console.error("PDF generation error:", err);
        document.body.removeChild(element);
        window.showToast("Gagal membuat laporan PDF: " + err.message, "error");
      });
    }, 150);
  }

  // Export function to global scope
  window.generateAttendanceReport = generateAttendanceReport;

})();
