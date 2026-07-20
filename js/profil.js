/* =========================================================
   PROFIL — halaman untuk melihat dan mengedit data diri staff.

   Catatan: file ini SEKARANG satu-satunya script yang menangani
   form Profil (dulu profil.html juga memuat js/validation.js
   secara terpisah, yang menempelkan submit-handler KEDUA ke
   form yang sama — menyebabkan submit ganda, pengajuan
   profileRequests duplikat, dan field kontak darurat hilang
   dari salah satu jalurnya). Validasi per-field yang dulu ada
   di validation.js sekarang digabung ke sini.

   Termasuk validasi kunci profil: staff tidak bisa edit jika
   profil dikunci oleh admin.
   ========================================================= */

(function () {
  let currentProfile = null;
  let isProfileLocked = false;

  /* ================= VALIDASI FIELD ================= */

  /** Validasi email dengan regex sederhana. @param {string} email @returns {boolean} */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /** Validasi nomor telepon Indonesia (minimal 10 digit, dimulai 0 atau +62). @param {string} phone @returns {boolean} */
  function isValidPhone(phone) {
    return /^(\+62|0)[0-9]{9,}$/.test(phone.replace(/[-\s]/g, ""));
  }

  /** Validasi field nama (minimal 2 karakter). @param {string} name @returns {boolean} */
  function isValidName(name) {
    return name.trim().length >= 2;
  }

  /** Validasi field alamat (minimal 5 karakter). @param {string} address @returns {boolean} */
  function isValidAddress(address) {
    return address.trim().length >= 5;
  }

  /** Menampilkan/menyembunyikan style error pada satu field. @param {HTMLElement} field @param {boolean} isError */
  function setFieldError(field, isError) {
    const wrapper = field.closest(".form-field");
    if (!wrapper) return;
    wrapper.classList.toggle("has-error", isError);
  }

  /** Validasi satu field berdasarkan nama-nya. @param {HTMLElement} field @returns {boolean} */
  function validateField(field) {
    const value = field.value.trim();
    let isValid = true;

    switch (field.name) {
      case "nama":
        isValid = isValidName(value);
        break;
      case "email":
        isValid = isValidEmail(value);
        break;
      case "telepon":
      case "kontakDaruratNomor":
        isValid = isValidPhone(value);
        break;
      case "alamat":
        isValid = isValidAddress(value);
        break;
      default:
        isValid = value.length > 0;
    }

    setFieldError(field, !isValid);
    return isValid;
  }

  /** Validasi seluruh field wajib dalam form. @param {HTMLFormElement} form @returns {boolean} */
  function validateForm(form) {
    let isFormValid = true;
    form.querySelectorAll("input[required], select[required]").forEach((field) => {
      if (!validateField(field)) isFormValid = false;
    });
    return isFormValid;
  }

  /* ================= LOAD PROFIL ================= */

  /** Load profile data dan cek status kunci */
  async function loadProfile() {
    const session = window.Auth.getSession();
    if (!session || !session.username) return;

    try {
      const doc = await db.collection("profiles").doc(session.username).get();
      if (doc.exists) {
        currentProfile = doc.data();
        isProfileLocked = currentProfile.profileLocked || false;

        // Update UI dengan data profil
        document.getElementById("profileAvatar").textContent = (currentProfile.nama || "--").charAt(0).toUpperCase();
        document.getElementById("profileName").textContent = currentProfile.nama || "...";
        document.getElementById("profileRole").textContent = currentProfile.role || "...";
        document.getElementById("profileUsername").textContent = session.username;
        document.getElementById("infoUsername").textContent = session.username;
        document.getElementById("infoRole").textContent = currentProfile.role || "...";

        // Update status kunci profil
        const lockStatusEl = document.getElementById("profileLockStatus");
        if (isProfileLocked) {
          lockStatusEl.textContent = "Terkunci";
          lockStatusEl.className = "status-badge status-badge--alpha";
          document.getElementById("profileLockedBanner").style.display = "flex";
          disableProfileForm(true);
        } else {
          lockStatusEl.textContent = "Terbuka";
          lockStatusEl.className = "status-badge status-badge--hadir";
          document.getElementById("profileLockedBanner").style.display = "none";
          disableProfileForm(false);
        }

        // Update kontak darurat
        const tipeLabels = {
          pasangan: "Pasangan", istri: "Istri", suami: "Suami", ayah: "Ayah",
          ibu: "Ibu", orang_tua: "Orang Tua", saudara: "Saudara", teman: "Teman", lainnya: "Lainnya"
        };
        document.getElementById("infoKontakDaruratTipe").textContent = tipeLabels[currentProfile.kontakDaruratTipe] || "-";
        document.getElementById("infoKontakDaruratNomor").textContent = currentProfile.kontakDaruratNomor || "-";

        // Isi form dengan data profil
        document.getElementById("inputNama").value = currentProfile.nama || "";
        document.getElementById("inputEmail").value = currentProfile.email || "";
        document.getElementById("inputTelepon").value = currentProfile.telepon || "";
        document.getElementById("inputAlamat").value = currentProfile.alamat || "";
        document.getElementById("inputKontakDaruratTipe").value = currentProfile.kontakDaruratTipe || "";
        document.getElementById("inputKontakDaruratNomor").value = currentProfile.kontakDaruratNomor || "";

        // Cek status pengajuan profil
        await checkProfileRequestStatus(session.username);
      }
    } catch (err) {
      console.error("Gagal memuat profil:", err);
      window.showToast("Gagal memuat data profil.", "error");
    }
  }

  /** Disable/enable form berdasarkan status kunci */
  function disableProfileForm(disabled) {
    const form = document.getElementById("profileForm");
    const inputs = form.querySelectorAll("input, select");
    const submitBtn = document.getElementById("btnSaveProfile");

    inputs.forEach((input) => { input.disabled = disabled; });
    submitBtn.disabled = disabled;
    submitBtn.style.opacity = disabled ? "0.5" : "1";
    submitBtn.style.cursor = disabled ? "not-allowed" : "pointer";
  }

  /**
   * Mencari ID dokumen pengajuan (profileRequests) berstatus "pending"
   * milik satu username, kalau ada — supaya pengajuan berikutnya
   * meng-update dokumen yang sama, bukan menumpuk dokumen baru.
   * Query ini equality-only (dua `.where`), jadi TIDAK butuh
   * composite index.
   * @param {string} username
   * @returns {Promise<string|null>}
   */
  async function findPendingRequestId(username) {
    const snapshot = await db.collection("profileRequests")
      .where("username", "==", username)
      .where("status", "==", "pending")
      .get();
    return snapshot.empty ? null : snapshot.docs[0].id;
  }

  /**
   * Cek status pengajuan profil terakhir milik satu username.
   *
   * Sengaja HANYA pakai filter `where("username", ...)` lalu sort
   * di JS — bukan `.orderBy("submittedAt")` digabung `.where(...)`,
   * karena kombinasi itu butuh composite index di Firestore yang
   * kalau belum dibuat bikin query ini gagal diam-diam (cuma
   * ke-log di console, banner status ga pernah muncul).
   * @param {string} username
   */
  async function checkProfileRequestStatus(username) {
    try {
      const snapshot = await db.collection("profileRequests")
        .where("username", "==", username)
        .get();

      const pendingBanner = document.getElementById("profilePendingBanner");
      const rejectedBanner = document.getElementById("profileRejectedBanner");
      const rejectedReason = document.getElementById("profileRejectedReason");

      if (snapshot.empty) {
        pendingBanner.style.display = "none";
        rejectedBanner.style.display = "none";
        return;
      }

      const requests = snapshot.docs.map((d) => d.data());
      requests.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      const request = requests[0];

      if (request.status === "pending") {
        pendingBanner.style.display = "flex";
        rejectedBanner.style.display = "none";
        disableProfileForm(true);
      } else if (request.status === "rejected") {
        pendingBanner.style.display = "none";
        rejectedBanner.style.display = "flex";
        rejectedReason.textContent = request.rejectReason ? `: ${request.rejectReason}` : "";
        if (!isProfileLocked) disableProfileForm(false);
      } else {
        pendingBanner.style.display = "none";
        rejectedBanner.style.display = "none";
        if (!isProfileLocked) disableProfileForm(false);
      }
    } catch (err) {
      console.error("Gagal cek status pengajuan:", err);
      window.showToast("Gagal memuat status pengajuan profil.", "error");
    }
  }

  /* ================= SUBMIT FORM ================= */

  /** Handle submit form profil */
  async function handleProfileSubmit(e) {
    e.preventDefault();

    if (isProfileLocked) {
      window.showToast("Profil Anda dikunci oleh admin. Hubungi admin untuk membuka kunci.", "error");
      return;
    }

    const session = window.Auth.getSession();
    if (!session || !session.username) return;

    const form = e.target;
    if (!validateForm(form)) {
      window.showToast("Mohon lengkapi semua field dengan benar.", "error");
      return;
    }

    const btn = document.getElementById("btnSaveProfile");
    window.setButtonLoading(btn, true, "Menyimpan...");

    try {
      const newData = {
        nama: document.getElementById("inputNama").value.trim(),
        email: document.getElementById("inputEmail").value.trim(),
        telepon: document.getElementById("inputTelepon").value.trim(),
        alamat: document.getElementById("inputAlamat").value.trim(),
        kontakDaruratTipe: document.getElementById("inputKontakDaruratTipe").value,
        kontakDaruratNomor: document.getElementById("inputKontakDaruratNomor").value.trim(),
      };

      const oldData = {
        nama: currentProfile?.nama || "",
        email: currentProfile?.email || "",
        telepon: currentProfile?.telepon || "",
        alamat: currentProfile?.alamat || "",
        kontakDaruratTipe: currentProfile?.kontakDaruratTipe || "",
        kontakDaruratNomor: currentProfile?.kontakDaruratNomor || "",
      };

      const hasChanges = Object.keys(newData).some((key) => newData[key] !== oldData[key]);
      if (!hasChanges) {
        window.showToast("Tidak ada perubahan data.", "info");
        window.setButtonLoading(btn, false);
        return;
      }

      if (CURRENT_EMPLOYEE.role === "admin") {
        // Admin: perubahan langsung berlaku, tidak perlu approval.
        await db.collection("profiles").doc(session.username).set({
          ...newData,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        window.showToast("Data profil berhasil disimpan!", "success");
        currentProfile = { ...currentProfile, ...newData };
      } else {
        // Staff: perubahan masuk antrian persetujuan admin. Kalau
        // masih ada pengajuan "pending" sebelumnya, update dokumen
        // yang sama — jangan numpuk dokumen baru tiap submit.
        const existingPendingId = await findPendingRequestId(session.username);
        const requestData = {
          username: session.username,
          nama: currentProfile?.nama || session.username,
          old: oldData,
          new: newData,
          status: "pending",
          submittedAt: new Date().toISOString(),
          reviewedAt: null,
          reviewedBy: null,
          rejectReason: null,
        };

        if (existingPendingId) {
          await db.collection("profileRequests").doc(existingPendingId).set(requestData, { merge: true });
        } else {
          await db.collection("profileRequests").add(requestData);
        }

        window.showToast("Pengajuan perubahan data diri berhasil dikirim. Menunggu persetujuan admin.", "success");
        disableProfileForm(true);
      }

      await checkProfileRequestStatus(session.username);
    } catch (err) {
      console.error("Gagal mengirim pengajuan:", err);
      window.showToast("Gagal mengirim pengajuan perubahan.", "error");
    } finally {
      window.setButtonLoading(btn, false);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const profileForm = document.getElementById("profileForm");
    if (!profileForm) return; // bukan halaman Profil

    if (typeof db === "undefined") {
      window.showToast("Gagal memuat modul penyimpanan.", "error");
      return;
    }

    // Validasi saat blur & hapus error saat mulai mengetik lagi.
    profileForm.querySelectorAll("input[required], select[required]").forEach((field) => {
      field.addEventListener("blur", () => {
        if (field.value.trim().length > 0) validateField(field);
      });
      field.addEventListener("input", () => setFieldError(field, false));
      field.addEventListener("change", () => setFieldError(field, false));
    });

    loadProfile();

    profileForm.addEventListener("submit", handleProfileSubmit);
  });
})();
