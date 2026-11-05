/* =====================================================================
   TartiliKu - Mulai Instan (BOOT - dimuat paling akhir)
   Berkas : js/17-instant-start.js  (urutan muat ke-17 dari 17)
   Tugas  : Menampilkan menu/halaman terakhir langsung dari salinan profil di
            perangkat, tanpa menunggu Firebase.
   ===================================================================== */

// ===== MULAI INSTAN =====
// Kalau pengguna pernah masuk dan akunnya sudah disetujui, menu (atau halaman terakhir
// yang dibaca) langsung ditampilkan dari salinan profil di perangkat, tanpa menunggu
// Firebase dimuat. Setelah login terverifikasi, data diperbarui diam-diam.
// Kalau ternyata sesi sudah berakhir, layar masuk akan menggantikannya.
(function instantStart() {
    try {
        const raw = localStorage.getItem('tartili_profile_cache');
        if (!raw) return;
        const cache = JSON.parse(raw);
        if (!cache || !cache.uid || !cache.profile) return;
        if (Date.now() - (cache.savedAt || 0) > 30 * 24 * 3600 * 1000) return;
        const role = cache.profile.role;
        if (role !== 'Siswa' && role !== 'Guru') return;

        window.currentUserProfile = Object.assign({ uid: cache.uid }, cache.profile);
        window.__instantShown = true;
        window.__instantUid = cache.uid;

        ['login-screen', 'verify-screen', 'menu-screen', 'read-screen',
         'bookmarks-screen', 'admin-screen', 'teacher-admin-screen', 'class-members-screen'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });

        updateUserGreeting();
        setupDashboardAccess();

        const restoreRead = localStorage.getItem('tartili_active_screen') === 'read';
        const lastRead = JSON.parse(localStorage.getItem('tartili_last_read') || 'null');
        if (restoreRead && lastRead && lastRead.jilid && lastRead.page != null) {
            openJilid(lastRead.jilid, lastRead.page);
        } else {
            document.getElementById('menu-screen').classList.add('active');
            appState = 'menu';
            updateMenuCoverFocus();
        }
    } catch (e) {
        window.__instantShown = false;
        console.warn('Mulai instan dilewati:', e);
    }
})();
