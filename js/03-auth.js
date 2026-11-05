/* =====================================================================
   TartiliKu - Autentikasi (Masuk, Daftar, Lupa Sandi, Google)
   Berkas : js/03-auth.js  (urutan muat ke-3 dari 17)
   Tugas  : Form masuk/daftar, kata sandi, pemulihan sandi, dan pendaftaran
            lewat akun Google.
   Isi    : switchAuthMode, toggleRoleFields, handleAuthSubmit,
            handleForgotPassword, isInAppBrowser, handleGoogleSignIn,
            toggleGoogleRoleFields, submitGoogleRegistration,
            cancelGoogleRegistration, togglePasswordVisibility
   ===================================================================== */

// ===== MASUK / DAFTAR (email & kata sandi) =====
let isRegisterMode = false;
function switchAuthMode(mode) {
    isRegisterMode = (mode === 'register');
    const loginBtn = document.getElementById('modeLoginBtn');
    const regBtn = document.getElementById('modeRegisterBtn');
    const regFields = document.getElementById('registerFields');
    const submitBtn = document.getElementById('authSubmitBtn');

    if (isRegisterMode) {
        loginBtn.classList.remove('active');
        regBtn.classList.add('active');
        regFields.classList.add('show');
        submitBtn.innerText = "Daftar Akun";
    } else {
        regBtn.classList.remove('active');
        loginBtn.classList.add('active');
        regFields.classList.remove('show');
        submitBtn.innerText = "Masuk Sekarang";
    }
    // "Lupa kata sandi?" hanya relevan di mode Masuk
    const forgot = document.getElementById('btnForgot');
    if (forgot) forgot.style.display = isRegisterMode ? 'none' : 'block';
    const info = document.getElementById('loginInfo');
    if (info) info.style.display = 'none';
    toggleRoleFields();
}

function toggleRoleFields() {
    const role = document.getElementById('authRole').value;
    const classCodeInput = document.getElementById('authClassCode');
    const teacherClassNameInput = document.getElementById('authTeacherClassName');

    if (role === 'Guru') {
        classCodeInput.style.display = 'none';
        teacherClassNameInput.style.display = 'block';
    } else {
        classCodeInput.style.display = 'block';
        teacherClassNameInput.style.display = 'none';
    }
}

async function handleAuthSubmit() {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const errorDiv = document.getElementById('loginError');

    if (!navigator.onLine) {
        errorDiv.innerText = "Anda sedang offline. Masuk atau daftar membutuhkan internet.";
        errorDiv.style.display = 'block';
        return;
    }

    if (!email || !password) {
        errorDiv.innerText = "Email dan kata sandi wajib diisi.";
        errorDiv.style.display = 'block';
        return;
    }

    try {
        if (isRegisterMode) {
            const name = document.getElementById('authName').value || email.split('@')[0];
            const role = document.getElementById('authRole').value;

            let classCode = "";
            let teacherClassName = "";

            if (role === 'Guru') {
                teacherClassName = document.getElementById('authTeacherClassName').value || 'Kelas Guru';
                classCode = 'KLS-' + Math.random().toString(36).substring(2, 7).toUpperCase();
            } else {
                classCode = document.getElementById('authClassCode').value.trim();
                if (!classCode) {
                    errorDiv.innerText = "Kode kelas dari guru wajib diisi bagi siswa.";
                    errorDiv.style.display = 'block';
                    return;
                }
            }

            const userCredential = await window.createUserWithEmailAndPassword(window.firebaseAuth, email, password);
            const user = userCredential.user;

            await window.setDoc(window.doc(window.firebaseDb, "users", user.uid), {
                name: name,
                email: email,
                role: role,
                classCode: classCode,
                teacherClassName: teacherClassName,
                isMasterApproved: false,
                isTeacherApproved: (role === 'Guru'),
                createdAt: new Date().toISOString()
            });

            // NOTIFIKASI MASTER ADMIN SAAT PENDAFTAR BARU
            await window.addDoc(window.collection(window.firebaseDb, "notifications"), {
                targetUserId: "ALL_ADMINS",
                title: "Pendaftar Baru!",
                message: `Pengguna baru "${name}" (${role}) telah mendaftar dan menunggu verifikasi.`,
                actionUrl: 'admin-approval',
                readBy: [],
                createdAt: window.serverTimestamp()
            });

            // NOTIFIKASI GURU SAAT SISWA BARU MENDAFTAR KE KELASNYA
            // Tujuannya "CLASS_<kode kelas>" (bukan ID guru), karena siswa yang
            // belum disetujui tidak boleh membaca data guru. Kalau gagal,
            // pendaftaran tetap berhasil.
            if (role === 'Siswa') {
                try {
                    await window.addDoc(window.collection(window.firebaseDb, "notifications"), {
                        targetUserId: "CLASS_" + classCode,
                        title: "Siswa Baru Mendaftar",
                        message: `Siswa "${name}" mendaftar ke kelas Anda dan menunggu persetujuan Anda.`,
                        actionUrl: 'teacher-approval',
                        readBy: [],
                        createdAt: window.serverTimestamp()
                    });
                } catch (e) {
                    console.warn('Notifikasi ke guru gagal dikirim:', e);
                }
            }

            errorDiv.style.display = 'none';
            showToast('Pendaftaran berhasil! Akun menunggu persetujuan Admin.');
        } else {
            await window.signInWithEmailAndPassword(window.firebaseAuth, email, password);
            errorDiv.style.display = 'none';
            showToast('Berhasil masuk!');
        }
    } catch (err) {
        console.error(err);
        errorDiv.innerText = isRegisterMode ? "Gagal mendaftar (Email sudah terpakai / sandi terlalu pendek)." : "Email atau kata sandi salah.";
        errorDiv.style.display = 'block';
    }
}

// ===== LUPA KATA SANDI =====
// Mengirim tautan pengaturan ulang ke email. Pesan sengaja netral (tidak membocorkan apakah email terdaftar).
async function handleForgotPassword() {
    const errorDiv = document.getElementById('loginError');
    const infoDiv = document.getElementById('loginInfo');
    const btn = document.getElementById('btnForgot');
    const email = (document.getElementById('authEmail').value || '').trim();
    errorDiv.style.display = 'none'; infoDiv.style.display = 'none';
    if (!email) { errorDiv.innerText = 'Isi email Anda di kolom email dulu, lalu tekan "Lupa kata sandi?".'; errorDiv.style.display = 'block'; return; }
    if (!navigator.onLine) { errorDiv.innerText = 'Tidak ada koneksi internet.'; errorDiv.style.display = 'block'; return; }
    if (typeof window.sendPasswordResetEmail !== 'function') { errorDiv.innerText = 'Layanan belum siap. Muat ulang halaman, lalu coba lagi.'; errorDiv.style.display = 'block'; return; }
    try {
        if (btn) btn.disabled = true;
        await window.sendPasswordResetEmail(window.firebaseAuth, email);
        infoDiv.innerText = 'Jika email itu terdaftar, tautan untuk mengatur ulang kata sandi sudah dikirim. Periksa kotak masuk dan folder spam.';
        infoDiv.style.display = 'block';
    } catch (err) {
        console.error(err);
        const code = err && err.code;
        errorDiv.innerText = code === 'auth/invalid-email' ? 'Format email tidak valid.'
            : code === 'auth/too-many-requests' ? 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.'
            : code === 'auth/network-request-failed' ? 'Koneksi internet bermasalah. Coba lagi.'
            : 'Tautan belum bisa dikirim. Coba lagi.';
        errorDiv.style.display = 'block';
    } finally {
        if (btn) btn.disabled = false;
    }
}
window.handleForgotPassword = handleForgotPassword;

// ===== MASUK / DAFTAR DENGAN GOOGLE =====
function isInAppBrowser() {
    return /(FBAN|FBAV|Instagram|Line\/|MicroMessenger|TikTok|musical_ly|; wv\))/i.test(navigator.userAgent || '');
}

async function handleGoogleSignIn() {
    const errorDiv = document.getElementById('loginError');
    const btn = document.getElementById('btnGoogle');
    const showErr = (msg) => { if (errorDiv) { errorDiv.innerText = msg; errorDiv.style.display = 'block'; } };
    if (errorDiv) errorDiv.style.display = 'none';
    if (!navigator.onLine) { showErr('Tidak ada koneksi internet.'); return; }
    if (typeof window.signInWithPopup !== 'function' || !window.GoogleAuthProvider) { showErr('Layanan masuk belum siap. Muat ulang halaman, lalu coba lagi.'); return; }
    if (isInAppBrowser()) {
        showErr('Google tidak mengizinkan masuk dari browser di dalam aplikasi (Instagram, Facebook, TikTok, dll.). Buka tautan ini di Chrome atau Safari.');
        return;
    }
    try {
        if (btn) btn.disabled = true;
        const provider = new window.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await window.signInWithPopup(window.firebaseAuth, provider);
        showToast('Berhasil masuk dengan Google!');
    } catch (err) {
        console.error(err);
        const code = err && err.code;
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;   // dibatalkan pengguna
        if (code === 'auth/popup-blocked') showErr('Popup diblokir browser. Izinkan popup untuk situs ini, lalu coba lagi.');
        else if (code === 'auth/unauthorized-domain') showErr('Alamat situs ini belum diizinkan di Firebase (Authentication > Settings > Authorized domains).');
        else if (code === 'auth/operation-not-allowed') showErr('Masuk dengan Google belum diaktifkan di Firebase (Authentication > Sign-in method).');
        else if (code === 'auth/account-exists-with-different-credential') showErr('Email ini sudah terdaftar dengan cara lain. Masuk dengan email dan kata sandi.');
        else if (code === 'auth/network-request-failed') showErr('Koneksi internet bermasalah. Coba lagi.');
        else showErr('Gagal masuk dengan Google. Coba lagi.');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function toggleGoogleRoleFields() {
    const role = document.getElementById('gcRole').value;
    document.getElementById('gcClassCode').style.display = role === 'Guru' ? 'none' : 'block';
    document.getElementById('gcTeacherClassName').style.display = role === 'Guru' ? 'block' : 'none';
}

// Pendaftaran lanjutan untuk akun Google baru: membuat profil + memberi tahu Admin (dan guru kelasnya)
async function submitGoogleRegistration() {
    const pend = window.__pendingGoogleUser;
    const errorDiv = document.getElementById('gcError');
    const showErr = (msg) => { errorDiv.innerText = msg; errorDiv.style.display = 'block'; };
    errorDiv.style.display = 'none';
    if (!pend) { showErr('Sesi tidak ditemukan. Silakan masuk ulang.'); return; }
    if (!navigator.onLine) { showErr('Tidak ada koneksi internet.'); return; }

    const name = ((document.getElementById('gcName').value || '').trim() || pend.email.split('@')[0]).slice(0, 100);
    const role = document.getElementById('gcRole').value;
    let classCode = '', teacherClassName = '';
    if (role === 'Guru') {
        teacherClassName = (document.getElementById('gcTeacherClassName').value || '').trim() || 'Kelas Guru';
        classCode = 'KLS-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    } else {
        classCode = (document.getElementById('gcClassCode').value || '').trim();
        if (!classCode) { showErr('Kode kelas dari guru wajib diisi bagi siswa.'); return; }
    }

    const btn = document.getElementById('gcSubmit');
    try {
        btn.disabled = true;
        await window.setDoc(window.doc(window.firebaseDb, 'users', pend.uid), {
            name: name,
            email: pend.email,
            role: role,
            classCode: classCode,
            teacherClassName: teacherClassName,
            isMasterApproved: false,
            isTeacherApproved: (role === 'Guru'),
            createdAt: new Date().toISOString()
        });
        await window.addDoc(window.collection(window.firebaseDb, 'notifications'), {
            targetUserId: 'ALL_ADMINS',
            title: 'Pendaftar Baru!',
            message: `Pengguna baru "${name}" (${role}) telah mendaftar dan menunggu verifikasi.`,
            actionUrl: 'admin-approval',
            readBy: [],
            createdAt: window.serverTimestamp()
        });
        if (role === 'Siswa') {
            try {
                await window.addDoc(window.collection(window.firebaseDb, 'notifications'), {
                    targetUserId: 'CLASS_' + classCode,
                    title: 'Siswa Baru Mendaftar',
                    message: `Siswa "${name}" mendaftar ke kelas Anda dan menunggu persetujuan Anda.`,
                    actionUrl: 'teacher-approval',
                    readBy: [],
                    createdAt: window.serverTimestamp()
                });
            } catch (e) { console.warn('Notifikasi ke guru gagal dikirim:', e); }
        }
        window.__pendingGoogleUser = null;
        showToast('Pendaftaran berhasil! Akun menunggu persetujuan Admin.');
        setTimeout(() => location.reload(), 700);   // muat ulang agar alur persetujuan berjalan seperti biasa
    } catch (err) {
        console.error(err);
        showErr('Pendaftaran belum berhasil' + (err && err.code ? ` (${err.code})` : '') + '. Coba lagi.');
        btn.disabled = false;
    }
}

async function cancelGoogleRegistration() {
    window.__pendingGoogleUser = null;
    try { await window.signOut(window.firebaseAuth); } catch (e) { /* abaikan */ }
}

window.handleGoogleSignIn = handleGoogleSignIn;
window.toggleGoogleRoleFields = toggleGoogleRoleFields;
window.submitGoogleRegistration = submitGoogleRegistration;
window.cancelGoogleRegistration = cancelGoogleRegistration;

// ===== TAMPILKAN / SEMBUNYIKAN KATA SANDI =====
function togglePasswordVisibility() {
    const input = document.getElementById('authPassword');
    const btn = document.getElementById('btnTogglePass');
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    if (btn) {
        btn.classList.toggle('on', show);
        btn.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
    }
}
