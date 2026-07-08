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
    
    // Load data profil yang tersimpan
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
        // Simpan data profil ke localStorage
        const profileData = {
          nama: form.elements.nama.value.trim(),
          email: form.elements.email.value.trim(),
          telepon: form.elements.telepon.value.trim(),
          alamat: form.elements.alamat.value.trim(),
          updatedAt: new Date().toISOString()
        };
        
        const profileKey = `profile_${CURRENT_EMPLOYEE.id}`;
        localStorage.setItem(profileKey, JSON.stringify(profileData));
        
        window.showToast('Data profil berhasil disimpan!', 'success');
        
      } catch (error) {
        console.error('Save profile error:', error);
        window.showToast('Gagal menyimpan data profil.', 'error');
      } finally {
        window.setButtonLoading(btnSave, false);
      }
    });
  });
  
  /** Load data profil dari localStorage dan isi form. @param {HTMLFormElement} form */
  function loadProfileData(form) {
    try {
      const profileKey = `profile_${CURRENT_EMPLOYEE.id}`;
      const raw = localStorage.getItem(profileKey);
      
      if (raw) {
        const data = JSON.parse(raw);
        if (data.nama) form.elements.nama.value = data.nama;
        if (data.email) form.elements.email.value = data.email;
        if (data.telepon) form.elements.telepon.value = data.telepon;
        if (data.alamat) form.elements.alamat.value = data.alamat;
      }
    } catch (e) {
      console.error('Load profile error:', e);
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
