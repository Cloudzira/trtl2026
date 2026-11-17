/* =====================================================================
   TartiliKu - Autentikasi (hanya Google)
   Berkas : js/03-auth.js  (urutan muat ke-3 dari 17)
   Tugas  : Masuk dan pendaftaran HANYA lewat akun Google, supaya tidak ada
            akun dengan email asal/palsu. Pengguna baru melengkapi data
            (nama, peran, kode kelas) di layar "Lengkapi Pendaftaran".
   Isi    : isInAppBrowser, handleGoogleSignIn, toggleGoogleRoleFields,
            submitGoogleRegistration, cancelGoogleRegistration
   ===================================================================== */

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
        else if (code === 'auth/account-exists-with-different-credential') showErr('Email ini sudah terdaftar dengan cara masuk lain. Hubungi Admin agar akun Anda dipindahkan ke Google.');
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
