/* =========================================================
   PROFIL — halaman untuk melihat dan mengedit data diri staff.
   Termasuk validasi kunci profil: staff tidak bisa edit jika
   profil dikunci oleh admin.
   ========================================================= */

(function () {
  let currentProfile = null;
  let isProfileLocked = false;

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

        // Isi form dengan data profil
        document.getElementById("inputNama").value = currentProfile.nama || "";
        document.getElementById("inputEmail").value = currentProfile.email || "";
        document.getElementById("inputTelepon").value = currentProfile.telepon || "";
        document.getElementById("inputAlamat").value = currentProfile.alamat || "";

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
    const inputs = form.querySelectorAll("input");
    const submitBtn = document.getElementById("btnSaveProfile");
    
    inputs.forEach(input => {
      input.disabled = disabled;
    });
    submitBtn.disabled = disabled;
    
    if (disabled) {
      submitBtn.style.opacity = "0.5";
      submitBtn.style.cursor = "not-allowed";
    } else {
      submitBtn.style.opacity = "1";
      submitBtn.style.cursor = "pointer";
    }
  }

  /** Cek status pengajuan profil terakhir */
  async function checkProfileRequestStatus(username) {
    try {
      const snapshot = await db.collection("profileRequests")
        .where("username", "==", username)
        .orderBy("submittedAt", "desc")
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const request = snapshot.docs[0].data();
        const pendingBanner = document.getElementById("profilePendingBanner");
        const rejectedBanner = document.getElementById("profileRejectedBanner");
        const rejectedReason = document.getElementById("profileRejectedReason");

        if (request.status === "pending") {
          pendingBanner.style.display = "flex";
          rejectedBanner.style.display = "none";
          disableProfileForm(true);
        } else if (request.status === "rejected") {
          pendingBanner.style.display = "none";
          rejectedBanner.style.display = "flex";
          rejectedReason.textContent = request.rejectReason ? `: ${request.rejectReason}` : "";
          disableProfileForm(false);
        } else {
          pendingBanner.style.display = "none";
          rejectedBanner.style.display = "none";
          if (!isProfileLocked) {
            disableProfileForm(false);
          }
        }
      }
    } catch (err) {
      console.error("Gagal cek status pengajuan:", err);
    }
  }

  /** Handle submit form profil */
  async function handleProfileSubmit(e) {
    e.preventDefault();

    // Cek jika profil dikunci
    if (isProfileLocked) {
      window.showToast("Profil Anda dikunci oleh admin. Hubungi admin untuk membuka kunci.", "error");
      return;
    }

    const session = window.Auth.getSession();
    if (!session || !session.username) return;

    // Validasi form
    const form = e.target;
    if (!form.checkValidity()) {
      window.showToast("Mohon lengkapi semua field yang wajib diisi.", "error");
      return;
    }

    const btn = document.getElementById("btnSaveProfile");
    window.setButtonLoading(btn, true, "Mengirim...");

    try {
      const newData = {
        nama: document.getElementById("inputNama").value.trim(),
        email: document.getElementById("inputEmail").value.trim(),
        telepon: document.getElementById("inputTelepon").value.trim(),
        alamat: document.getElementById("inputAlamat").value.trim(),
      };

      // Cek apakah ada perubahan
      const oldData = {
        nama: currentProfile.nama || "",
        email: currentProfile.email || "",
        telepon: currentProfile.telepon || "",
        alamat: currentProfile.alamat || "",
      };

      const hasChanges = Object.keys(newData).some(key => newData[key] !== oldData[key]);

      if (!hasChanges) {
        window.showToast("Tidak ada perubahan data.", "info");
        window.setButtonLoading(btn, false);
        return;
      }

      // Buat pengajuan perubahan
      await db.collection("profileRequests").add({
        username: session.username,
        nama: currentProfile.nama || session.username,
        old: oldData,
        new: newData,
        status: "pending",
        submittedAt: new Date().toISOString(),
      });

      window.showToast("Pengajuan perubahan data diri berhasil dikirim. Menunggu persetujuan admin.", "success");
      disableProfileForm(true);
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

    loadProfile();

    profileForm.addEventListener("submit", handleProfileSubmit);
  });
})();
