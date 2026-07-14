/* =========================================================
   VALIDATION — validasi form halaman Profil.
   
   Memvalidasi input Nama, Email, Telepon, dan Alamat.
   ========================================================= */

(function () {
  /** Validasi email dengan regex sederhana. @param {string} email @returns {boolean} */
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  /** Validasi nomor telepon Indonesia (minimal 10 digit, dimulai dengan 0 atau +62). @param {string} phone @returns {boolean} */
  function isValidPhone(phone) {
    const phoneRegex = /^(\+62|0)[0-9]{9,}$/;
    return phoneRegex.test(phone.replace(/[-\s]/g, ''));
  }
  
  /** Validasi field nama (tidak boleh kosong, minimal 2 karakter). @param {string} name @returns {boolean} */
  function isValidName(name) {
    return name.trim().length >= 2;
  }
  
  /** Validasi field alamat (tidak boleh kosong, minimal 5 karakter). @param {string} address @returns {boolean} */
  function isValidAddress(address) {
    return address.trim().length >= 5;
  }
  
  /** Menampilkan error pada field tertentu. @param {HTMLElement} field @param {boolean} isError */
  function setFieldError(field, isError) {
    const formField = field.closest('.form-field');
    if (isError) {
      formField.classList.add('has-error');
    } else {
      formField.classList.remove('has-error');
    }
  }
  
  /** Validasi satu field. @param {HTMLElement} field @returns {boolean} */
  function validateField(field) {
    const name = field.name;
    const value = field.value.trim();
    let isValid = true;
    
    switch (name) {
      case 'nama':
        isValid = isValidName(value);
        break;
      case 'email':
        isValid = isValidEmail(value);
        break;
      case 'telepon':
        isValid = isValidPhone(value);
        break;
      case 'alamat':
        isValid = isValidAddress(value);
        break;
      default:
        isValid = value.length > 0;
    }
    
    setFieldError(field, !isValid);
    return isValid;
  }
  
  /** Validasi seluruh form. @param {HTMLFormElement} form @returns {boolean} */
  function validateForm(form) {
    const fields = form.querySelectorAll('input[required]');
    let isFormValid = true;
    
    fields.forEach(field => {
      if (!validateField(field)) {
        isFormValid = false;
      }
    });
    
    return isFormValid;
  }
  
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('profileForm');
    if (!form) return; // Bukan halaman Profil
    
    const btnSave = document.getElementById('btnSaveProfile');
    
    // Validasi saat blur (field ditinggalkan)
    form.querySelectorAll('input[required]').forEach(field => {
      field.addEventListener('blur', () => {
        if (field.value.trim().length > 0) {
          validateField(field);
        }
      });
      
      // Hapus error saat user mulai mengetik
      field.addEventListener('input', () => {
        setFieldError(field, false);
      });
    });
    
    // Muat data profil (dari Firestore: profil resmi + cek pengajuan
    // yang masih menunggu persetujuan admin, khusus akun staff).
    loadProfileData(form);
    
    // Handle submit form
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!validateForm(form)) {
        window.showToast('Mohon lengkapi semua field dengan benar.', 'error');
        return;
      }
      
      window.setButtonLoading(btnSave, true, 'Menyimpan...');
      
      try {
        const newData = {
          nama: form.elements.nama.value.trim(),
          email: form.elements.email.value.trim(),
          telepon: form.elements.telepon.value.trim(),
          alamat: form.elements.alamat.value.trim(),
        };

        if (CURRENT_EMPLOYEE.role === 'admin') {
          // Admin: perubahan langsung berlaku, tidak perlu persetujuan.
          await db.collection('profiles').doc(CURRENT_EMPLOYEE.id).set({
            ...newData,
            updatedAt: new Date().toISOString(),
          }, { merge: true });

          window.showToast('Data profil berhasil disimpan!', 'success');
          setPendingBanner(false);
          setRejectedBanner(false, '');
        } else {
          // Staff: perubahan MASUK ANTRIAN, baru berlaku setelah
          // disetujui admin di halaman "Persetujuan Profil".
          const officialSnap = await db.collection('profiles').doc(CURRENT_EMPLOYEE.id).get();
          const oldData = officialSnap.exists ? officialSnap.data() : {};

          const existingPendingId = await findPendingRequestId(CURRENT_EMPLOYEE.id);
          const requestData = {
            username: CURRENT_EMPLOYEE.id,
            nama: CURRENT_EMPLOYEE.nama,
            old: {
              nama: oldData.nama || '',
              email: oldData.email || '',
              telepon: oldData.telepon || '',
              alamat: oldData.alamat || '',
            },
            new: newData,
            status: 'pending',
            submittedAt: new Date().toISOString(),
            reviewedAt: null,
            reviewedBy: null,
            rejectReason: null,
          };

          if (existingPendingId) {
            await db.collection('profileRequests').doc(existingPendingId).set(requestData, { merge: true });
          } else {
            await db.collection('profileRequests').add(requestData);
          }

          window.showToast('Perubahan diajukan — menunggu persetujuan admin.', 'info');
          setPendingBanner(true);
          setRejectedBanner(false, '');
        }

      } catch (error) {
        console.error('Save profile error:', error);
        window.showToast('Gagal menyimpan data profil.', 'error');
      } finally {
        window.setButtonLoading(btnSave, false);
      }
    });
  });

  /** Tampilkan/sembunyikan banner "menunggu persetujuan". @param {boolean} show */
  function setPendingBanner(show) {
    const el = document.getElementById('profilePendingBanner');
    if (el) el.style.display = show ? 'flex' : 'none';
  }

  /** Tampilkan/sembunyikan banner "pengajuan ditolak". @param {boolean} show @param {string} reason */
  function setRejectedBanner(show, reason) {
    const el = document.getElementById('profileRejectedBanner');
    const reasonEl = document.getElementById('profileRejectedReason');
    if (reasonEl) reasonEl.textContent = reason ? `: "${reason}"` : '';
    if (el) el.style.display = show ? 'flex' : 'none';
  }

  /**
   * Mencari ID dokumen pengajuan (profileRequests) berstatus "pending"
   * milik satu username, kalau ada — supaya pengajuan berikutnya
   * meng-update dokumen yang sama alih-alih menumpuk dokumen baru.
   * @param {string} username
   * @returns {Promise<string|null>}
   */
  async function findPendingRequestId(username) {
    const snapshot = await db.collection('profileRequests')
      .where('username', '==', username)
      .where('status', '==', 'pending')
      .get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].id;
  }

  /**
   * Mencari dokumen pengajuan TERAKHIR (apa pun statusnya) milik satu
   * username — dipakai untuk mendeteksi pengajuan yang baru saja
   * ditolak admin, supaya bannernya bisa ditampilkan sekali.
   * @param {string} username
   * @returns {Promise<object|null>}
   */
  async function findLatestRequest(username) {
    const snapshot = await db.collection('profileRequests')
      .where('username', '==', username)
      .get();
    if (snapshot.empty) return null;
    const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    return docs[0];
  }
  
  /** Muat data profil resmi (Firestore) & cek status pengajuan, lalu isi form. @param {HTMLFormElement} form */
  async function loadProfileData(form) {
    try {
      const officialSnap = await db.collection('profiles').doc(CURRENT_EMPLOYEE.id).get();
      const official = officialSnap.exists ? officialSnap.data() : null;

      let displayData = official;

      if (CURRENT_EMPLOYEE.role !== 'admin') {
        const latest = await findLatestRequest(CURRENT_EMPLOYEE.id);
        if (latest && latest.status === 'pending') {
          displayData = latest.new;
          setPendingBanner(true);
          setRejectedBanner(false, '');
        } else if (latest && latest.status === 'rejected') {
          setPendingBanner(false);
          setRejectedBanner(true, latest.rejectReason || '');
        } else {
          setPendingBanner(false);
          setRejectedBanner(false, '');
        }
      }

      if (displayData) {
        if (displayData.nama) form.elements.nama.value = displayData.nama;
        if (displayData.email) form.elements.email.value = displayData.email;
        if (displayData.telepon) form.elements.telepon.value = displayData.telepon;
        if (displayData.alamat) form.elements.alamat.value = displayData.alamat;
      }
    } catch (e) {
      console.error('Load profile error:', e);
      window.showToast('Gagal memuat data profil.', 'error');
    }
    
    // Update tampilan kartu profil
    updateProfileCard();
  }
  
  /** Update tampilan kartu profil di sidebar dan halaman profil. */
  function updateProfileCard() {
    const session = getSessionUser();
    if (!session) return;
    
    // Update kartu di halaman profil
    const profileAvatar = document.getElementById('profileAvatar');
    const profileName = document.getElementById('profileName');
    const profileRole = document.getElementById('profileRole');
    const profileUsername = document.getElementById('profileUsername');
    const infoUsername = document.getElementById('infoUsername');
    const infoRole = document.getElementById('infoRole');
    
    if (profileAvatar) {
      profileAvatar.textContent = session.nama.slice(0, 2).toUpperCase();
    }
    if (profileName) {
      profileName.textContent = session.nama;
    }
    if (profileRole) {
      profileRole.textContent = session.role === 'admin' ? 'Administrator' : 'Staff';
    }
    if (profileUsername) {
      profileUsername.textContent = `@${session.username}`;
    }
    if (infoUsername) {
      infoUsername.textContent = session.username;
    }
    if (infoRole) {
      infoRole.textContent = session.role === 'admin' ? 'Administrator' : 'Staff';
    }
  }
})();
