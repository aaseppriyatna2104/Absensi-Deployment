/* =========================================================
   JADWAL — kalender kegiatan tim.

   Aturan akses:
   - ADMIN  : bisa tambah, edit, hapus, dan drag & drop jadwal
              ke tanggal lain.
   - STAFF  : hanya bisa MELIHAT jadwal (read-only), tidak ada
              tombol tambah, kartu jadwal tidak bisa di-drag,
              dan klik kartu cuma membuka detail (tanpa opsi edit/hapus).

   Data disimpan di Firestore collection "schedule" (lewat "db"
   dari js/firebase-config.js), dengan struktur:
     {
       judul       : string,
       tanggal     : "YYYY-MM-DD",
       deskripsi   : string,
       dibuatOleh  : string   (nama admin yang membuat)
     }
   ========================================================= */

(function () {
  const MONTH_NAMES = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  let currentYear, currentMonth; // currentMonth: 0-11
  let allEvents = [];            // seluruh dokumen "schedule" dari Firestore
  let isAdmin = false;
  let editingId = null;          // id event yang sedang diedit (null = mode tambah)
  let draggedEventId = null;

  /** Menambahkan angka nol di depan kalau kurang dari 2 digit. @param {number} n @returns {string} */
  function pad(n) { return String(n).padStart(2, "0"); }

  /** Format Date -> "YYYY-MM-DD" (zona waktu lokal, bukan UTC). @param {Date} d @returns {string} */
  function toDateString(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** String tanggal hari ini "YYYY-MM-DD". @returns {string} */
  function todayString() {
    return toDateString(new Date());
  }

  /**
   * Menghasilkan daftar sel kalender untuk satu bulan, termasuk
   * sisa hari dari bulan sebelumnya/berikutnya supaya grid selalu
   * genap 7 kolom x N baris, dimulai dari hari Senin.
   * @param {number} year
   * @param {number} month - 0-11
   * @returns {Array<{date: Date, isOutside: boolean}>}
   */
  function buildMonthCells(year, month) {
    const firstOfMonth = new Date(year, month, 1);
    // Senin = 0 ... Minggu = 6 (geser dari getDay() yang defaultnya Minggu = 0)
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;

    const gridStart = new Date(year, month, 1 - firstWeekday);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCellsNeeded = firstWeekday + daysInMonth;
    const totalRows = Math.ceil(totalCellsNeeded / 7);
    const totalCells = totalRows * 7;

    const cells = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push({ date: d, isOutside: d.getMonth() !== month });
    }
    return cells;
  }

  /** Membentuk markup satu kartu jadwal (chip). @param {object} ev @returns {string} */
  function eventChipHTML(ev) {
    const draggableAttr = isAdmin ? 'draggable="true"' : "";
    return `<div class="cal-event" ${draggableAttr} data-event-id="${ev.id}" title="${escapeHtml(ev.judul)}">${escapeHtml(ev.judul)}</div>`;
  }

  /** Escape karakter HTML dasar supaya aman disisipkan ke innerHTML. @param {string} str @returns {string} */
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  /** Merender ulang seluruh grid kalender untuk bulan yang sedang aktif. */
  function renderCalendar() {
    const grid = document.getElementById("calGrid");
    const monthLabel = document.getElementById("calMonthLabel");
    const today = todayString();

    monthLabel.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

    // Hapus sel lama (kecuali 7 header hari di baris pertama)
    grid.querySelectorAll(".cal-cell").forEach((el) => el.remove());

    const cells = buildMonthCells(currentYear, currentMonth);
    const eventsByDate = {};
    allEvents.forEach((ev) => {
      if (!eventsByDate[ev.tanggal]) eventsByDate[ev.tanggal] = [];
      eventsByDate[ev.tanggal].push(ev);
    });

    cells.forEach(({ date, isOutside }) => {
      const dateStr = toDateString(date);
      const cellEl = document.createElement("div");
      cellEl.className = "cal-cell" + (isOutside ? " is-outside" : "") + (dateStr === today ? " is-today" : "");
      cellEl.setAttribute("data-date", dateStr);

      const eventsForDay = eventsByDate[dateStr] || [];

      cellEl.innerHTML = `
        <div class="cal-cell__date">${date.getDate()}</div>
        <div class="cal-cell__events">${eventsForDay.map(eventChipHTML).join("")}</div>
        ${isAdmin ? '<button type="button" class="cal-cell__add-btn is-admin" data-add-date>+ jadwal</button>' : ""}
      `;

      grid.appendChild(cellEl);
    });

    attachCellEvents();
  }

  /** Memasang event listener klik/drag di semua sel kalender setelah render ulang. */
  function attachCellEvents() {
    document.querySelectorAll(".cal-cell").forEach((cellEl) => {
      const dateStr = cellEl.getAttribute("data-date");

      // Tap di area kosong sel tanggal -> buka Agenda Harian.
      // Ini yang utama dipakai di HP/Android (hover tidak berlaku
      // di layar sentuh, jadi tombol "+ jadwal" desktop tidak
      // banyak berguna di mobile).
      cellEl.addEventListener("click", () => openDayModal(dateStr));

      // Klik tombol "+ jadwal" (admin only, muncul saat hover — desktop)
      const addBtn = cellEl.querySelector("[data-add-date]");
      if (addBtn) {
        addBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openAddModal(dateStr);
        });
      }

      // Klik kartu jadwal (stopPropagation supaya tidak ikut memicu
      // buka Agenda Harian di belakangnya)
      cellEl.querySelectorAll(".cal-event").forEach((chip) => {
        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = chip.getAttribute("data-event-id");
          const ev = allEvents.find((e2) => e2.id === id);
          if (!ev) return;
          isAdmin ? openEditModal(ev) : openViewModal(ev);
        });

        if (isAdmin) {
          chip.addEventListener("dragstart", (e) => {
            draggedEventId = chip.getAttribute("data-event-id");
            chip.classList.add("is-dragging");
            e.dataTransfer.effectAllowed = "move";
          });
          chip.addEventListener("dragend", () => {
            chip.classList.remove("is-dragging");
            draggedEventId = null;
          });
        }
      });

      // Drop target (admin only) — geser jadwal ke tanggal sel ini
      if (isAdmin) {
        cellEl.addEventListener("dragover", (e) => {
          e.preventDefault();
          cellEl.classList.add("is-dragover");
        });
        cellEl.addEventListener("dragleave", () => {
          cellEl.classList.remove("is-dragover");
        });
        cellEl.addEventListener("drop", async (e) => {
          e.preventDefault();
          cellEl.classList.remove("is-dragover");
          if (!draggedEventId) return;

          const ev = allEvents.find((e2) => e2.id === draggedEventId);
          if (!ev || ev.tanggal === dateStr) return;

          try {
            await db.collection("schedule").doc(draggedEventId).update({ tanggal: dateStr });
            window.showToast(`Jadwal "${ev.judul}" dipindah ke ${formatShortDate(dateStr)}.`, "success");
          } catch (err) {
            console.error("Gagal memindah jadwal:", err);
            window.showToast("Gagal memindah jadwal.", "error");
          }
        });
      }
    });
  }

  /** Format "YYYY-MM-DD" -> "DD Bulan YYYY" untuk teks. @param {string} dateStr @returns {string} */
  function formatShortDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
  }

  /* ================= MODAL AGENDA HARIAN (tap tanggal) ================= */

  let dayModalDate = null;

  function openDayModal(dateStr) {
    dayModalDate = dateStr;
    const eventsForDay = allEvents
      .filter((ev) => ev.tanggal === dateStr)
      .sort((a, b) => (a.judul || "").localeCompare(b.judul || ""));

    document.getElementById("dayModalTitle").textContent = formatShortDate(dateStr);
    document.getElementById("dayModalSub").textContent = eventsForDay.length
      ? `${eventsForDay.length} kegiatan pada tanggal ini`
      : "Belum ada kegiatan pada tanggal ini";

    const list = document.getElementById("dayModalList");
    if (!eventsForDay.length) {
      list.innerHTML = `<div class="day-modal__empty">Belum ada jadwal.</div>`;
    } else {
      list.innerHTML = eventsForDay.map((ev) => `
        <div class="day-modal__item" data-event-id="${ev.id}">
          <span class="day-modal__item-title">${escapeHtml(ev.judul)}</span>
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16" style="flex-shrink:0; color: var(--color-text-faint);"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      `).join("");

      list.querySelectorAll("[data-event-id]").forEach((item) => {
        item.addEventListener("click", () => {
          const ev = allEvents.find((e) => e.id === item.getAttribute("data-event-id"));
          if (!ev) return;
          closeDayModal();
          isAdmin ? openEditModal(ev) : openViewModal(ev);
        });
      });
    }

    const addBtn = document.getElementById("btnAddFromDayModal");
    addBtn.style.display = isAdmin ? "inline-flex" : "none";

    document.getElementById("dayModal").classList.add("is-open");
  }

  function closeDayModal() {
    dayModalDate = null;
    document.getElementById("dayModal").classList.remove("is-open");
  }

  /* ================= MODAL TAMBAH / EDIT (admin) ================= */

  function openAddModal(prefillDate) {
    editingId = null;
    document.getElementById("eventModalTitle").textContent = "Tambah Jadwal";
    document.getElementById("eventModalSub").textContent = "Isi detail kegiatan di bawah ini.";
    document.getElementById("eventJudul").value = "";
    document.getElementById("eventTanggal").value = prefillDate || todayString();
    document.getElementById("eventDeskripsi").value = "";
    document.getElementById("btnDeleteEvent").style.display = "none";
    document.getElementById("eventModal").classList.add("is-open");
  }

  function openEditModal(ev) {
    editingId = ev.id;
    document.getElementById("eventModalTitle").textContent = "Edit Jadwal";
    document.getElementById("eventModalSub").textContent = ev.dibuatOleh ? `Dibuat oleh ${ev.dibuatOleh}` : "";
    document.getElementById("eventJudul").value = ev.judul || "";
    document.getElementById("eventTanggal").value = ev.tanggal || todayString();
    document.getElementById("eventDeskripsi").value = ev.deskripsi || "";
    document.getElementById("btnDeleteEvent").style.display = "block";
    document.getElementById("eventModal").classList.add("is-open");
  }

  function closeEventModal() {
    editingId = null;
    document.getElementById("eventModal").classList.remove("is-open");
  }

  async function handleSaveEvent(e) {
    e.preventDefault();

    const judul = document.getElementById("eventJudul").value.trim();
    const tanggal = document.getElementById("eventTanggal").value;
    const deskripsi = document.getElementById("eventDeskripsi").value.trim();

    const judulField = document.querySelector('[data-field="judul"]');
    const tanggalField = document.querySelector('[data-field="tanggal"]');
    judulField.classList.toggle("has-error", !judul);
    tanggalField.classList.toggle("has-error", !tanggal);
    if (!judul || !tanggal) return;

    const btn = document.getElementById("btnSaveEvent");
    window.setButtonLoading(btn, true, "Menyimpan...");

    try {
      const data = { judul, tanggal, deskripsi, dibuatOleh: CURRENT_EMPLOYEE.nama };

      if (editingId) {
        await db.collection("schedule").doc(editingId).set(data, { merge: true });
        window.showToast("Jadwal berhasil diperbarui.", "success");
      } else {
        await db.collection("schedule").add(data);
        window.showToast("Jadwal berhasil ditambahkan.", "success");
      }
      closeEventModal();
    } catch (err) {
      console.error("Gagal menyimpan jadwal:", err);
      window.showToast("Gagal menyimpan jadwal.", "error");
    } finally {
      window.setButtonLoading(btn, false);
    }
  }

  async function handleDeleteEvent() {
    if (!editingId) return;
    const confirmed = window.confirm("Hapus jadwal ini?");
    if (!confirmed) return;

    try {
      await db.collection("schedule").doc(editingId).delete();
      window.showToast("Jadwal berhasil dihapus.", "success");
      closeEventModal();
    } catch (err) {
      console.error("Gagal menghapus jadwal:", err);
      window.showToast("Gagal menghapus jadwal.", "error");
    }
  }

  /* ================= MODAL DETAIL (staff, read-only) ================= */

  function openViewModal(ev) {
    document.getElementById("viewEventTitle").textContent = ev.judul || "(Tanpa judul)";
    document.getElementById("viewEventDate").textContent = formatShortDate(ev.tanggal);

    const descList = document.getElementById("viewEventDesc");
    const lines = (ev.deskripsi || "").split("\n").map((l) => l.trim()).filter(Boolean);
    descList.innerHTML = lines.length
      ? lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")
      : `<li style="list-style:none; padding-left:0;">Tidak ada deskripsi tambahan.</li>`;

    document.getElementById("viewEventModal").classList.add("is-open");
  }

  function closeViewModal() {
    document.getElementById("viewEventModal").classList.remove("is-open");
  }

  /* ================= INIT ================= */

  document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById("calGrid");
    if (!grid) return; // bukan halaman Jadwal

    if (typeof db === "undefined") {
      document.getElementById("jadwalSubLabel").textContent = "Gagal memuat modul penyimpanan.";
      return;
    }

    const session = getSessionUser();
    isAdmin = !!session && session.role === "admin";

    document.getElementById("btnAddEvent").style.display = isAdmin ? "inline-flex" : "none";
    document.getElementById("calAdminHint").style.display = isAdmin ? "flex" : "none";
    document.getElementById("calStaffHint").style.display = isAdmin ? "none" : "flex";

    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();

    // Real-time listener — semua perubahan (tambah/edit/hapus/drag)
    // langsung ter-refresh di sini, termasuk kalau ada 2 admin yang
    // buka halaman ini bersamaan.
    db.collection("schedule").onSnapshot(
      (snapshot) => {
        allEvents = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        document.getElementById("jadwalSubLabel").textContent = `${allEvents.length} jadwal tersimpan`;
        renderCalendar();
      },
      (err) => {
        console.error("Gagal memuat jadwal:", err);
        document.getElementById("jadwalSubLabel").textContent = "Gagal memuat jadwal.";
        window.showToast("Gagal memuat data jadwal.", "error");
      }
    );

    renderCalendar();

    // Navigasi bulan
    document.getElementById("btnPrevMonth").addEventListener("click", () => {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      renderCalendar();
    });
    document.getElementById("btnNextMonth").addEventListener("click", () => {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      renderCalendar();
    });
    document.getElementById("btnToday").addEventListener("click", () => {
      const t = new Date();
      currentYear = t.getFullYear();
      currentMonth = t.getMonth();
      renderCalendar();
    });

    // Tombol "Tambah Jadwal" di header panel (admin only)
    if (isAdmin) {
      document.getElementById("btnAddEvent").addEventListener("click", () => openAddModal());
    }

    // Modal tambah/edit
    document.getElementById("eventForm").addEventListener("submit", handleSaveEvent);
    document.getElementById("btnCancelEvent").addEventListener("click", closeEventModal);
    document.getElementById("btnDeleteEvent").addEventListener("click", handleDeleteEvent);
    document.getElementById("eventModal").addEventListener("click", (e) => {
      if (e.target.id === "eventModal") closeEventModal();
    });

    // Modal detail (staff)
    document.getElementById("btnCloseView").addEventListener("click", closeViewModal);
    document.getElementById("viewEventModal").addEventListener("click", (e) => {
      if (e.target.id === "viewEventModal") closeViewModal();
    });

    // Modal Agenda Harian (tap tanggal — utamanya dipakai di HP)
    document.getElementById("btnCloseDayModal").addEventListener("click", closeDayModal);
    document.getElementById("dayModal").addEventListener("click", (e) => {
      if (e.target.id === "dayModal") closeDayModal();
    });
    document.getElementById("btnAddFromDayModal").addEventListener("click", () => {
      const dateForAdd = dayModalDate;
      closeDayModal();
      openAddModal(dateForAdd);
    });
  });
})();
