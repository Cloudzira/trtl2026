
        // ===== SERVICE WORKER (offline) =====
        // Service Worker baru (sw.js) bersifat TERBATAS: hanya mengurus berkas
        // aplikasi, modul Firebase/font, sampul, dan audio. Firestore, login, dan
        // upload setoran tidak disentuh sama sekali.
        const TARTILI_PAGE_IMAGE_CACHE = 'tartili-page-images-v3';   // cache sementara (24 halaman terakhir)

        // Jumlah halaman bernomor tiap jilid (di luar halaman pembuka a-g dan 0).
        // Jilid baru / jumlah halaman berubah: cukup ubah angka di sini.
        // (Harus di bagian paling atas, karena dipakai saat aplikasi pertama kali dimuat.)
        const JILID_PAGE_COUNT = { 1: 44, 2: 44, 3: 44, 4: 44, 5: 44, 6: 48, 7: 62 };

        // Nama khusus jilid (selain "Jilid N"). Jilid 7 bernama Tartili Ghorib.
        const JILID_NAMES = { 7: 'Tartili Ghorib' };
        // "Jilid 3"  /  "Jilid 7 (Tartili Ghorib)"
        function getJilidFullLabel(jilid) {
            const nama = JILID_NAMES[String(jilid)];
            return nama ? `Jilid ${jilid} (${nama})` : `Jilid ${jilid}`;
        }
        // "Tartili Jilid 3"  /  "Tartili Ghorib (Jilid 7)"
        function getJilidTitle(jilid) {
            const nama = JILID_NAMES[String(jilid)];
            return nama ? `${nama} (Jilid ${jilid})` : `Tartili Jilid ${jilid}`;
        }
        // Lencana nama di pojok kiri atas halaman baca (hanya untuk jilid yang punya nama khusus)
        function updateJilidBadge() {
            const el = document.getElementById('jilidBadge');
            if (!el) return;
            const nama = JILID_NAMES[String(currentJilid)];
            if (nama) { el.innerHTML = `<b>${nama}</b> · Jilid ${currentJilid}`; el.style.display = 'block'; }
            else { el.style.display = 'none'; }
        }
        const OFFLINE_IMAGE_CACHE = 'tartili-offline-pages-v2';      // halaman yang diunduh permanen untuk offline
        const MEDIA_CACHE_NAME = 'tartili-media-v1';                 // audio (sama dengan yang dipakai sw.js)
        if ('serviceWorker' in navigator) {
            // Service Worker memberi tahu kalau ada versi baru aplikasi
            navigator.serviceWorker.addEventListener('message', (e) => {
                if (e.data && e.data.type === 'UPDATE_READY') showUpdateBanner();
            });
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').catch((err) => {
                    console.warn('Service Worker gagal didaftarkan:', err);
                });
                // Setelah semuanya termuat, minta SW menyimpan modul Firebase & font
                // yang baru saja dipakai supaya aplikasi bisa dibuka offline.
                navigator.serviceWorker.ready.then((reg) => {
                    setTimeout(() => {
                        try {
                            const urls = performance.getEntriesByType('resource')
                                .map((e) => e.name)
                                .filter((u) => /^https:\/\/(esm\.sh|fonts\.bunny\.net)\//.test(u));
                            if (reg.active && urls.length) reg.active.postMessage({ type: 'CACHE_EXTERNAL', urls });
                        } catch (e) { /* abaikan */ }
                    }, 2500);
                });
            });
            // Bersihkan cache peninggalan versi lama (yang bukan milik TartiliKu)
            if (window.caches) {
                caches.keys().then((names) => {
                    names.filter((name) => !name.startsWith('tartili-')).forEach((name) => caches.delete(name));
                });
            }
        }

        // ===== STATUS ONLINE / OFFLINE =====
        function updateOnlineStatus(showMessage) {
            const offline = !navigator.onLine;
            document.body.classList.toggle('is-offline', offline);
            if (showMessage) {
                showToast(offline
                    ? 'Anda sedang offline. Halaman yang sudah pernah dibuka tetap bisa dibaca.'
                    : 'Kembali online.');
            }
        }
        window.addEventListener('online', () => updateOnlineStatus(true));
        window.addEventListener('offline', () => updateOnlineStatus(true));

        const savedTheme = localStorage.getItem('tartili_theme') || window.TARTILI_DEFAULT_THEME || 'future-theme';
        updateOnlineStatus(false);
        applyTheme(savedTheme, false);

        // MODE HEMAT EFEK: pada HP dengan RAM kecil, efek blur kaca (backdrop-filter)
        // dimatikan supaya animasi dan geser halaman lebih lancar.
        (function detectLowEndDevice() {
            try {
                const mem = navigator.deviceMemory;
                const cores = navigator.hardwareConcurrency;
                const isTouch = 'ontouchstart' in window;
                if ((mem && mem <= 4) || (cores && cores <= 4 && isTouch)) {
                    document.documentElement.classList.add('lite-fx');
                }
            } catch (e) { /* abaikan */ }
        })();

        // ===== INFO VERSI BARU =====
        function showUpdateBanner() {
            if (document.getElementById('updateBanner')) return;
            const bar = document.createElement('div');
            bar.id = 'updateBanner';
            bar.className = 'update-banner';
            bar.innerHTML = '<span>Versi baru tersedia</span><button type="button" id="updateBannerBtn">Muat ulang</button>';
            document.body.appendChild(bar);
            document.getElementById('updateBannerBtn').onclick = () => location.reload();
        }

        // ===== PANDUAN PENGGUNAAN & TENTANG APLIKASI =====
        function showGuideTab(name) {
            ['siswa', 'guru', 'admin', 'tips'].forEach((k) => {
                const tab = document.getElementById('guideTab-' + k);
                const panel = document.getElementById('guide-' + k);
                if (tab) tab.classList.toggle('active', k === name);
                if (panel) panel.classList.toggle('active', k === name);
            });
            const body = document.querySelector('#guideModal .guide-body');
            if (body) body.scrollTop = 0;
        }

        // Tab panduan yang ditampilkan menurut peran (urutan = urutan tampil, yang pertama = tab awal).
        // Panduan Admin hanya terlihat oleh Admin. Sebelum masuk (halaman login) tampil Siswa, Guru, dan Tips.
        const GUIDE_TABS_BY_ROLE = {
            guest: ['siswa', 'guru', 'tips'],
            Siswa: ['siswa', 'tips'],
            Guru:  ['guru', 'siswa', 'tips'],
            Admin: ['admin', 'guru', 'siswa', 'tips']
        };

        function openGuideModal() {
            const modal = document.getElementById('guideModal');
            if (!modal) return;
            const profile = window.currentUserProfile;
            const roleKey = !profile ? 'guest' : (isAdminProfile(profile) ? 'Admin' : (profile.role === 'Guru' ? 'Guru' : 'Siswa'));
            const visible = GUIDE_TABS_BY_ROLE[roleKey];
            ['siswa', 'guru', 'admin', 'tips'].forEach((k) => {
                const tab = document.getElementById('guideTab-' + k);
                if (!tab) return;
                const idx = visible.indexOf(k);
                tab.style.display = idx === -1 ? 'none' : '';
                tab.style.order = idx === -1 ? 0 : idx;
            });
            showGuideTab(visible[0]);
            modal.classList.add('active');
        }
        function closeGuideModal() {
            const modal = document.getElementById('guideModal');
            if (modal) modal.classList.remove('active');
        }

        function openAboutModal() {
            const modal = document.getElementById('aboutModal');
            if (modal) modal.classList.add('active');
        }
        function closeAboutModal() {
            const modal = document.getElementById('aboutModal');
            if (modal) modal.classList.remove('active');
        }

        window.showGuideTab = showGuideTab;
        window.openGuideModal = openGuideModal;
        window.closeGuideModal = closeGuideModal;
        window.openAboutModal = openAboutModal;
        window.closeAboutModal = closeAboutModal;

        // Ketuk area gelap di luar kotak = tutup popup
        ['guideModal', 'aboutModal'].forEach((id) => {
            const m = document.getElementById(id);
            if (m) m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
        });

        // ===== TEMA =====
        // Daftar tema ada di <head> index.html (window.TARTILI_THEMES).
        // Menambah tema baru: tambah 1 baris di daftar itu + 1 blok warna di styles.css.
        function getCurrentThemeId() {
            const first = (document.body.className || '').split(' ')[0];
            return window.getTartiliTheme ? window.getTartiliTheme(first).id : first;
        }

        function applyTheme(id, persist) {
            if (window.applyTartiliTheme) {
                window.applyTartiliTheme(id, persist);
            } else {
                document.body.className = id;
                if (persist) localStorage.setItem('tartili_theme', id);
            }
            updateThemeToggleIcon();
            renderThemePicker();
        }

        // Warna status bar HP (atas) mengikuti tema aktif
        function updateThemeColorMeta() {
            const meta = document.getElementById('metaThemeColor');
            if (!meta || !window.getTartiliTheme) return;
            meta.setAttribute('content', window.getTartiliTheme(getCurrentThemeId()).bar);
        }

        function renderThemePicker() {
            const box = document.getElementById('themeListContainer');
            if (!box || !window.TARTILI_THEMES) return;
            const current = getCurrentThemeId();
            box.innerHTML = window.TARTILI_THEMES.map(t => `
                <button class="theme-card ${t.id === current ? 'active' : ''}" onclick="selectTheme('${t.id}')" aria-label="Tema ${t.name}">
                    <span class="theme-preview" style="background:${t.sw[2]};">
                        <span class="tp-dot" style="background:${t.sw[0]};"></span>
                        <span class="tp-dot" style="background:${t.sw[1]};"></span>
                        <span class="tp-bar" style="background:linear-gradient(135deg, ${t.sw[0]}, ${t.sw[1]});"></span>
                        ${t.id === current ? '<span class="tp-check">✓</span>' : ''}
                    </span>
                    <span class="theme-name">${t.name}</span>
                    <span class="theme-desc">${t.desc}</span>
                </button>`).join('');
        }

        function openThemePicker() {
            renderThemePicker();
            const modal = document.getElementById('themeModal');
            if (modal) modal.classList.add('active');
        }

        function closeThemePicker() {
            const modal = document.getElementById('themeModal');
            if (modal) modal.classList.remove('active');
        }

        function selectTheme(id) {
            applyTheme(id, true);
            showToast(`Tema ${window.getTartiliTheme(id).name} diaktifkan`);
        }

        window.openThemePicker = openThemePicker;
        window.closeThemePicker = closeThemePicker;
        window.selectTheme = selectTheme;

        // Ikon tombol tema (palet warna)
        function updateThemeToggleIcon() {
            const btn = document.querySelector('.btn-theme-toggle');
            if (btn) {
                btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.5-1.9-.3-1 .4-2.1 1.5-2.1H17a4 4 0 0 0 4-4c0-5-4-10-9-10z"></path><circle cx="7.5" cy="11" r="1"></circle><circle cx="10" cy="7" r="1"></circle><circle cx="15" cy="7.5" r="1"></circle></svg>`;
            }
        }

        function showToast(message) {
            const toast = document.getElementById('toastNotification');
            toast.innerText = message;
            toast.style.transform = 'translateX(-50%) translateY(0)';
            setTimeout(() => {
                toast.style.transform = 'translateX(-50%) translateY(100px)';
            }, 3000);
        }

        function toggleNotifModal(show) {
            const el = document.getElementById('notifModal');
            if (show) el.classList.add('active');
            else el.classList.remove('active');
        }

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

        function showAdminLoginScreen() {
            document.getElementById('login-screen').classList.remove('active');
            document.getElementById('admin-login-screen').classList.add('active');
        }

        function backToLoginScreen() {
            document.getElementById('admin-login-screen').classList.remove('active');
            document.getElementById('login-screen').classList.add('active');
        }

        async function handleAdminLogin() {
            const email = document.getElementById('adminAuthEmail').value;
            const password = document.getElementById('adminAuthPassword').value;
            const errorDiv = document.getElementById('adminLoginError');

            if (!email || !password) {
                errorDiv.innerText = "Email dan kata sandi admin wajib diisi.";
                errorDiv.style.display = 'block';
                return;
            }

            try {
                await window.signInWithEmailAndPassword(window.firebaseAuth, email, password);
                errorDiv.style.display = 'none';
                showToast('Berhasil masuk sebagai Admin!');
            } catch (err) {
                console.error(err);
                errorDiv.innerText = "Email atau kata sandi admin salah.";
                errorDiv.style.display = 'block';
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

        // ===== PERLINDUNGAN KONTEN (pencegah, bukan penjamin 100%) =====
        // Gambar halaman & rekaman tidak bisa diklik-kanan / ditahan-lama untuk disimpan,
        // tidak bisa diseret, dan diberi tanda air nama pengguna agar tangkapan layar
        // yang disebar bisa dikenali asalnya. Ubah ke false untuk mematikan tanda air.
        const PAGE_WATERMARK_ENABLED = true;

        function applyPageWatermark() {
            const root = document.documentElement;
            const profile = window.currentUserProfile;
            if (!PAGE_WATERMARK_ENABLED || !profile) { root.style.removeProperty('--page-watermark'); return; }
            const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
            const label = esc((profile.name || 'Pengguna').slice(0, 24)) + ' • TartiliKu';
            const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='170'>" +
                "<text x='120' y='90' text-anchor='middle' transform='rotate(-28 120 85)' " +
                "font-family='Arial, sans-serif' font-size='14' font-weight='700' fill='#000' fill-opacity='0.085'>" + label + "</text></svg>";
            root.style.setProperty('--page-watermark', 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")');
        }

        // Matikan menu klik-kanan / tahan-lama pada gambar halaman & pemutar rekaman
        document.addEventListener('contextmenu', (e) => {
            if (e.target && e.target.closest && e.target.closest('.image-container, .setoran-player, audio')) e.preventDefault();
        });
        document.addEventListener('dragstart', (e) => {
            if (e.target && e.target.closest && e.target.closest('.image-container')) e.preventDefault();
        });

        async function updateUserGreeting() {
            applyPageWatermark();
            if (!window.currentUserProfile) return;
            const profile = window.currentUserProfile;
            
            const usernameEl = document.getElementById('userUsernameText');
            const classEl = document.getElementById('userClassText');
            const teacherNameEl = document.getElementById('userTeacherNameText');
            const roleEl = document.getElementById('userRoleBadge');

            if (usernameEl) usernameEl.innerText = profile.name || 'Pengguna';
            if (roleEl) roleEl.innerHTML = `${profile.role || 'Siswa'} 👥`;

            // Avatar inisial + salam sesuai waktu
            const avatarEl = document.getElementById('userAvatar');
            if (avatarEl) {
                const firstChar = String(profile.name || '').trim().charAt(0);
                avatarEl.innerText = firstChar ? firstChar.toUpperCase() : '👤';
            }
            const motivEl = document.getElementById('userMotivationText');
            if (motivEl) {
                const hour = new Date().getHours();
                const waktu = hour < 11 ? 'pagi' : (hour < 15 ? 'siang' : (hour < 18 ? 'sore' : 'malam'));
                const kegiatan = profile.role === 'Guru' ? 'selamat mengajar' : (profile.role === 'Admin' ? 'selamat bertugas' : 'selamat belajar');
                motivEl.innerText = `Selamat ${waktu}, ${kegiatan} TARTILI`;
            }

            // Admin tidak punya kelas/guru: sembunyikan chip-nya
            if (classEl) classEl.style.display = '';
            if (isAdminProfile(profile)) {
                if (roleEl) roleEl.innerHTML = 'Admin 👥';
                if (classEl) classEl.style.display = 'none';
                if (teacherNameEl) teacherNameEl.style.display = 'none';
                return;
            }

            if (profile.role === 'Guru') {
                if (classEl) classEl.innerText = `Kelas ${profile.teacherClassName}`;
                if (teacherNameEl) teacherNameEl.style.display = 'none';
            } else {
                if (classEl) classEl.innerText = `Kelas Memuat...`;
                if (teacherNameEl) {
                    teacherNameEl.style.display = 'inline';
                    teacherNameEl.innerText = "Guru: Memuat...";

                    // Nama guru disimpan di perangkat (berlaku 12 jam): tampil seketika dan hemat pembacaan Firestore
                    let tc = null;
                    try { tc = JSON.parse(localStorage.getItem('tartili_teacher_cache') || 'null'); } catch (e) { tc = null; }
                    const tcMatch = tc && tc.classCode === profile.classCode;
                    if (tcMatch) {
                        teacherNameEl.innerText = `Guru: ${tc.name}`;
                        if (classEl) classEl.innerText = `Kelas ${tc.className || profile.classCode || '-'}`;
                        if (Date.now() - (tc.savedAt || 0) < 12 * 3600 * 1000) return;
                    }
                    // Firebase belum siap (mulai instan): nanti diperbarui lagi setelah login terverifikasi
                    if (typeof window.getDocs !== 'function' || !window.firebaseDb) return;
                    try {
                        const q = window.query(window.collection(window.firebaseDb, "users"), window.where("role", "==", "Guru"), window.where("classCode", "==", profile.classCode));
                        const snap = await window.getDocs(q);
                        if (!snap.empty) {
                            const teacherData = snap.docs[0].data();
                            try {
                                localStorage.setItem('tartili_teacher_cache', JSON.stringify({
                                    classCode: profile.classCode, name: teacherData.name,
                                    className: teacherData.teacherClassName || '', savedAt: Date.now()
                                }));
                            } catch (e) { /* abaikan */ }
                            teacherNameEl.innerText = `Guru: ${teacherData.name}`;
                            if (classEl) classEl.innerText = `Kelas ${teacherData.teacherClassName || profile.classCode || '-'}`;
                        } else {
                            teacherNameEl.innerText = `Guru: -`;
                            if (classEl) classEl.innerText = `Kelas ${profile.classCode || '-'}`;
                        }
                    } catch (e) {
                        teacherNameEl.innerText = `Guru: -`;
                        if (classEl) classEl.innerText = `Kelas ${profile.classCode || '-'}`;
                    }
                }
            }
        }

        const ADMIN_EMAIL = 'awanproject70@gmail.com';
        function isAdminProfile(profile) {
            if (!profile) return false;
            const authUser = window.firebaseAuth && window.firebaseAuth.currentUser;
            return profile.role === 'Admin' || profile.email === ADMIN_EMAIL || !!(authUser && authUser.email === ADMIN_EMAIL);
        }

        function setupDashboardAccess() {
            const btnMaster = document.getElementById('btnMasterAdminPanel');
            const btnTeacher = document.getElementById('btnTeacherPanel');
            if (!btnMaster || !btnTeacher) return;

            const profile = window.currentUserProfile;
            const isMaster = isAdminProfile(profile);

            // Gunakan setProperty(..., 'important') supaya visibilitas tombol
            // Admin/Guru TIDAK BISA ditimpa oleh aturan CSS !important lain
            // (mis. aturan "paksa semua tombol tampil" di landing-hero-actions).
            if (isMaster) {
                btnMaster.style.setProperty('display', 'flex', 'important');
            } else {
                btnMaster.style.setProperty('display', 'none', 'important');
            }

            if (profile.role === 'Guru') {
                btnTeacher.style.setProperty('display', 'flex', 'important');
            } else {
                btnTeacher.style.setProperty('display', 'none', 'important');
            }

            // Penanda peran pada <body> (dipakai CSS, mis. menyembunyikan panel setoran untuk Admin)
            document.body.classList.toggle('role-admin', !!isMaster);

            // Tombol Riwayat Setoran hanya untuk siswa
            const btnRiwayat = document.getElementById('btnRiwayatSetoran');
            if (btnRiwayat) {
                const isStudent = !isMaster && profile.role !== 'Guru' && profile.role !== 'Admin';
                btnRiwayat.style.setProperty('display', isStudent ? 'flex' : 'none', 'important');
            }
        }

        // --- MASTER ADMIN PANEL ---
        // Admin: popup "Setujui Pendaftar Baru" (dibuka dari kartu sapaan atau dari notifikasi)
        async function openMasterAdminScreen() {
            const modal = document.getElementById('adminApprovalModal');
            if (modal) modal.classList.add('active');
            await loadMasterPendingUsers();
        }
        function closeMasterAdminModal() {
            const modal = document.getElementById('adminApprovalModal');
            if (modal) modal.classList.remove('active');
        }
        window.openMasterAdminScreen = openMasterAdminScreen;
        window.closeMasterAdminModal = closeMasterAdminModal;

        // Lencana angka di tombol admin = jumlah pendaftar yang menunggu persetujuan
        function updateAdminBadge(n) {
            const b = document.getElementById('adminPendingBadge');
            if (!b) return;
            b.textContent = n > 99 ? '99+' : String(n);
            b.style.display = n > 0 ? 'flex' : 'none';
        }
        async function refreshAdminPendingBadge() {
            try {
                const q = window.query(window.collection(window.firebaseDb, "users"), window.where("isMasterApproved", "==", false));
                const snap = await window.getDocs(q);
                updateAdminBadge(snap.size);
            } catch (e) { /* abaikan: hanya lencana */ }
        }
        window.refreshAdminPendingBadge = refreshAdminPendingBadge;

        async function loadMasterPendingUsers() {
            const container = document.getElementById('pendingMasterUsersContainer');
            if (!container) return;
            container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px;">Memuat data pendaftar...</div>`;

            try {
                const q = window.query(window.collection(window.firebaseDb, "users"), window.where("isMasterApproved", "==", false));
                const querySnapshot = await window.getDocs(q);
                
                container.innerHTML = "";
                updateAdminBadge(querySnapshot.size);
                if (querySnapshot.empty) {
                    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px;">Tidak ada akun yang menunggu persetujuan.</div>`;
                    return;
                }

                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const userId = docSnap.id;

                    let item = document.createElement('div');
                    item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--input-bg); border: 1px solid var(--border-color); border-radius: 12px; gap: 8px;";
                    item.innerHTML = `
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 700; font-size: 13px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${riwayatEsc(data.name)} <span class="badge-role" style="margin-left: 6px;">${riwayatEsc(data.role)}</span></div>
                            <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Email: ${riwayatEsc(data.email)}</div>
                            <div style="font-size: 10px; color: var(--text-muted);">${data.role === 'Guru' ? 'Kelas ' + riwayatEsc(data.teacherClassName) : 'Kode Kelas ' + riwayatEsc(data.classCode || '-')}</div>
                        </div>
                        <div style="display: flex; gap: 6px; flex-shrink: 0;">
                            <button onclick="approveMasterUser('${userId}')" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 11px; cursor: pointer;">Setujui</button>
                            <button data-id="${userId}" data-name="${riwayatEsc(data.name)}" onclick="deleteUserAccount(this.dataset.id, this.dataset.name)" style="background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 6px 10px; border-radius: 8px; font-weight: 700; font-size: 11px; cursor: pointer;" title="Tolak / Hapus">Hapus</button>
                        </div>
                    `;
                    container.appendChild(item);
                });
            } catch (e) {
                console.error(e);
                container.innerHTML = `<div style="text-align:center; color:#ef4444; padding:20px;">Gagal memuat data.</div>`;
            }
        }

        async function approveMasterUser(userId) {
            try {
                await window.updateDoc(window.doc(window.firebaseDb, "users", userId), { isMasterApproved: true });
                
                // NOTIFIKASI KE USER KETIKA DISETUJUI ADMIN
                await window.addDoc(window.collection(window.firebaseDb, "notifications"), {
                    targetUserId: userId,
                    title: "Akun Disetujui!",
                    message: "Akun Anda telah disetujui. Selamat belajar!",
                    readBy: [],
                    createdAt: window.serverTimestamp()
                });

                showToast('Akun berhasil disetujui Admin!');
                loadMasterPendingUsers();
            } catch (e) {
                console.error(e);
                showToast('Gagal menyetujui akun.');
            }
        }

        // Guru menghapus siswa dari kelasnya (dari daftar pendaftar atau daftar anggota).
        // Yang dihapus adalah profil siswa di database, sehingga siswa tidak lagi
        // bisa memakai aplikasi (akan kembali ke layar menunggu persetujuan).
        async function deleteStudentFromClass(userId, userName, source) {
            if (!navigator.onLine) { showToast('Anda sedang offline. Siswa belum bisa dihapus.'); return; }
            const nama = userName || 'siswa ini';
            const pesan = source === 'pending'
                ? `Tolak dan hapus pendaftaran "${nama}"?`
                : `Hapus siswa "${nama}" dari kelas Anda?\n\nSiswa tidak akan bisa lagi memakai aplikasi dan tidak bisa mengirim setoran. Tindakan ini tidak dapat dibatalkan.`;
            if (!confirm(pesan)) return;
            try {
                await window.deleteDoc(window.doc(window.firebaseDb, "users", userId));
                showToast(`Siswa ${nama} berhasil dihapus.`);
                if (source === 'members') await loadClassMembersList();
                else await loadTeacherPendingStudents();
            } catch (e) {
                console.error(e);
                showToast('Gagal menghapus siswa' + (e && e.code ? ` (${e.code})` : '') + '.');
            }
        }
        window.deleteStudentFromClass = deleteStudentFromClass;

        async function deleteUserAccount(userId, userName) {
            if (!confirm(`Apakah Anda yakin ingin menghapus/menolak pendaftaran akun "${userName}"?`)) return;
            try {
                await window.deleteDoc(window.doc(window.firebaseDb, "users", userId));
                showToast(`Akun ${userName} berhasil dihapus.`);
                loadMasterPendingUsers();
            } catch (e) {
                console.error(e);
                showToast('Gagal menghapus akun.');
            }
        }

        // --- TEACHER PANEL ---
        async function openTeacherAdminScreen() {
            appState = 'teacher-admin';
            document.getElementById('teacher-admin-screen').classList.add('active');
            
            const profile = window.currentUserProfile;
            const codeDisplay = document.getElementById('teacherClassCodeDisplay');
            if (codeDisplay) codeDisplay.innerText = profile.classCode || '-';

            await loadTeacherPendingStudents();
        }

        async function loadTeacherPendingStudents() {
            const container = document.getElementById('pendingStudentContainer');
            if (!container) return;
            container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px;">Memuat data siswa...</div>`;

            try {
                const teacherClassCode = window.currentUserProfile.classCode;
                const q = window.query(
                    window.collection(window.firebaseDb, "users"), 
                    window.where("role", "==", "Siswa"),
                    window.where("classCode", "==", teacherClassCode),
                    window.where("isTeacherApproved", "==", false)
                );
                const querySnapshot = await window.getDocs(q);
                
                container.innerHTML = "";
                if (querySnapshot.empty) {
                    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px;">Belum ada siswa baru yang mendaftar ke kelas Anda.</div>`;
                    return;
                }

                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const userId = docSnap.id;

                    let item = document.createElement('div');
                    item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--input-bg); border: 1px solid var(--border-color); border-radius: 12px;";
                    item.innerHTML = `
                        <div>
                            <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">${riwayatEsc(data.name)}</div>
                            <div style="font-size: 11px; color: var(--text-muted);">Email: ${riwayatEsc(data.email)}</div>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button onclick="approveStudent('${userId}')" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 11px; cursor: pointer;">Terima</button>
                            <button data-id="${userId}" data-name="${riwayatEsc(data.name)}" onclick="deleteStudentFromClass(this.dataset.id, this.dataset.name, 'pending')" style="background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 6px 10px; border-radius: 8px; font-weight: 700; font-size: 11px; cursor: pointer;">Tolak</button>
                        </div>
                    `;
                    container.appendChild(item);
                });
            } catch (e) {
                console.error(e);
                container.innerHTML = `<div style="text-align:center; color:#ef4444; padding:20px;">Gagal memuat siswa kelas.</div>`;
            }
        }

        async function approveStudent(userId) {
            try {
                await window.updateDoc(window.doc(window.firebaseDb, "users", userId), { isTeacherApproved: true });
                
                // NOTIFIKASI KE SISWA KETIKA DISETUJUI GURU
                await window.addDoc(window.collection(window.firebaseDb, "notifications"), {
                    targetUserId: userId,
                    title: "Diterima di Kelas!",
                    message: "Guru pengampu telah menyetujui Anda untuk bergabung di kelas.",
                    readBy: [],
                    createdAt: window.serverTimestamp()
                });

                showToast('Siswa berhasil diterima di kelas!');
                loadTeacherPendingStudents();
            } catch (e) {
                console.error(e);
                showToast('Gagal menerima siswa.');
            }
        }

        // --- CLASS MEMBERS SCREEN ---
        let previousScreenBeforeMembers = 'menu';

        async function openClassMembersScreen() {
            if (appState === 'teacher-admin') {
                previousScreenBeforeMembers = 'teacher-admin';
                document.getElementById('teacher-admin-screen').classList.remove('active');
            } else {
                previousScreenBeforeMembers = 'menu';
                document.getElementById('menu-screen').classList.remove('active');
            }

            appState = 'class-members';
            document.getElementById('class-members-screen').classList.add('active');

            await loadClassMembersList();
        }

        async function loadClassMembersList() {
            const container = document.getElementById('classMembersContainer');
            const titleEl = document.getElementById('classMembersTitle');
            const subtitleEl = document.getElementById('classMembersSubtitle');
            if (!container) return;

            container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px;">Memuat anggota kelas...</div>`;

            try {
                const profile = window.currentUserProfile;
                const classCode = profile.classCode;

                if (titleEl) titleEl.innerText = profile.role === 'Guru' ? `Anggota Kelas (${profile.teacherClassName})` : `Anggota Kelas`;
                if (subtitleEl) subtitleEl.innerText = profile.role === 'Guru' ? `Daftar siswa yang aktif di kelas Anda:` : `Daftar siswa dan guru dalam kelas Anda:`;

                const qTeacher = window.query(window.collection(window.firebaseDb, "users"), window.where("role", "==", "Guru"), window.where("classCode", "==", classCode));
                const snapTeacher = await window.getDocs(qTeacher);

                const qStudents = window.query(
                    window.collection(window.firebaseDb, "users"), 
                    window.where("role", "==", "Siswa"),
                    window.where("classCode", "==", classCode),
                    window.where("isTeacherApproved", "==", true)
                );
                const snapStudents = await window.getDocs(qStudents);

                container.innerHTML = "";

                if (!snapTeacher.empty) {
                    snapTeacher.forEach(docSnap => {
                        const tData = docSnap.data();
                        const tId = docSnap.id;
                        let item = document.createElement('div');
                        item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(var(--accent-rgb), 0.1); border: 1px solid var(--accent-solid); border-radius: 12px;";
                        item.innerHTML = `
                            <div>
                                <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">👨‍🏫 ${riwayatEsc(tData.name)} <span class="badge-role" style="margin-left: 6px;">Guru Pengampu</span></div>
                                <div style="font-size: 11px; color: var(--text-muted);">Email: ${riwayatEsc(tData.email)}</div>
                            </div>
                        `;
                        container.appendChild(item);
                    });
                }

                if (snapStudents.empty) {
                    let emptyItem = document.createElement('div');
                    emptyItem.style.cssText = "text-align:center; color:var(--text-muted); padding:15px; font-size:12px;";
                    emptyItem.innerText = "Belum ada siswa lain yang aktif di kelas ini.";
                    container.appendChild(emptyItem);
                    return;
                }

                snapStudents.forEach((docSnap) => {
                    const sData = docSnap.data();
                    const sId = docSnap.id;
                    let item = document.createElement('div');
                    item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--input-bg); border: 1px solid var(--border-color); border-radius: 12px;";
                    item.innerHTML = `
                        <div>
                            <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">👤 ${riwayatEsc(sData.name)}</div>
                            <div style="font-size: 11px; color: var(--text-muted);">Email: ${riwayatEsc(sData.email)}</div>
                        </div>
                        <div style="display:flex; gap:6px; align-items:center;">
                            <span style="font-size: 10px; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.12); padding: 3px 8px; border-radius: 6px;">Aktif</span>
                            ${window.currentUserProfile && window.currentUserProfile.role === 'Guru' ? `
                            <button class="riwayat-del" data-id="${sId}" data-name="${riwayatEsc(sData.name)}" onclick="deleteStudentFromClass(this.dataset.id, this.dataset.name, 'members')" title="Hapus siswa dari kelas" aria-label="Hapus siswa dari kelas">
                                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                            </button>` : ''}
                        </div>
                    `;
                    container.appendChild(item);
                });

            } catch (e) {
                console.error(e);
                container.innerHTML = `<div style="text-align:center; color:#ef4444; padding:20px;">Gagal memuat daftar anggota kelas.</div>`;
            }
        }

        function goBackFromClassMembers() {
            document.getElementById('class-members-screen').classList.remove('active');
            if (previousScreenBeforeMembers === 'teacher-admin') {
                document.getElementById('teacher-admin-screen').classList.add('active');
                appState = 'teacher-admin';
            } else {
                document.getElementById('menu-screen').classList.add('active');
                appState = 'menu';
            }
        }

        // --- SETORAN BACAAN SISWA (GURU) ---
        // Fungsi INTI: simpan nilai & feedback ke Firestore + kirim notifikasi
        // ke siswa. Dipakai oleh tampilan halaman baca saat guru meninjau
        // 1 setoran lewat notifikasi (kirimPenilaianReview). Mengembalikan
        // true/false untuk tahu berhasil atau tidak.
        async function submitPenilaian(setoranId, nilai, feedback) {
            try {
                const setoranRef = window.doc(window.firebaseDb, "setoran", setoranId);
                const setoranSnap = await window.getDoc(setoranRef);
                if (!setoranSnap.exists()) { showToast('Data setoran tidak ditemukan.'); return false; }
                const d = setoranSnap.data();
                const profile = window.currentUserProfile;
                const nilaiFinal = nilai === '' ? null : Number(nilai);
                const feedbackFinal = feedback || null;

                // Data lengkap (nilai, catatan, audio, jilid, halaman) disisipkan
                // LANGSUNG ke notifikasi hasil untuk siswa -- supaya siswa tetap
                // bisa melihat hasilnya kapan pun, walau dokumen setoran aslinya
                // nanti ikut dihapus otomatis (24 jam setelah dinilai).
                await window.addDoc(window.collection(window.firebaseDb, "notifications"), {
                    targetUserId: d.studentUid,
                    title: "📋 Rekaman Anda Telah Dinilai",
                    message: `Guru telah menilai setoran ${getJilidFullLabel(d.jilid)} Hal. ${d.halaman} Anda.`,
                    senderId: profile.uid,
                    senderName: profile.name || 'Guru',
                    actionUrl: 'setoran_hasil',
                    jilid: d.jilid,
                    halaman: d.halaman,
                    audioUrl: d.audioUrl || '',
                    audioKey: extractSetoranKey(d),
                    nilai: nilaiFinal,
                    feedback: feedbackFinal,
                    createdAt: window.serverTimestamp(),
                    readBy: []
                });

                // Setoran TIDAK langsung dihapus -- disimpan dulu selama 24 jam
                // supaya guru masih bisa membuka & mendengarkan ulang lewat
                // notifikasi yang sama (lihat cleanupExpiredSetoranNotif()).
                await window.updateDoc(setoranRef, {
                    nilai: nilaiFinal,
                    feedback: feedbackFinal,
                    status: 'dinilai',
                    gradedAt: window.serverTimestamp()
                });

                // Perbarui riwayat siswa (nilai + catatan). Memakai updateDoc supaya
                // riwayat yang sudah dihapus siswa tidak muncul lagi. Kalau gagal,
                // penilaian tetap dianggap berhasil.
                try {
                    await window.updateDoc(window.doc(window.firebaseDb, "riwayat_setoran", setoranId), {
                        status: 'dinilai',
                        nilai: nilaiFinal,
                        feedback: feedbackFinal,
                        guruName: profile.name || 'Guru',
                        gradedAt: window.serverTimestamp()
                    });
                } catch (e) {
                    console.warn('Riwayat setoran tidak diperbarui:', e);
                }

                return true;
            } catch (e) {
                console.error(e);
                showToast('Gagal mengirim penilaian.');
                return false;
            }
        }

        // --- TINJAU 1 SETORAN LEWAT HALAMAN BACA (dibuka dari notifikasi) ---
        // Membuka halaman baca persis di Jilid & Halaman yang disetorkan
        // siswa, dengan panel bawah diganti jadi panel penilaian guru
        // (bukan panel rekam siswa).
        async function openSetoranReview(setoranId) {
            try {
                const snap = await window.getDoc(window.doc(window.firebaseDb, "setoran", setoranId));
                if (!snap.exists()) { showToast('Data setoran tidak ditemukan.'); return; }
                const d = snap.data();

                openJilid(d.jilid, d.halaman);
                currentReviewSetoranId = setoranId;

                // Sembunyikan panel Halaman & Pintasan -- guru cukup lihat
                // panel penilaian saja, tidak perlu navigasi/pindah kelas.
                // Pakai setProperty(...,'important') karena mode landscape
                // punya aturan CSS "display: flex !important" untuk kedua
                // panel ini -- inline style biasa tidak akan menang melawannya.
                document.querySelector('#read-screen .page-nav-panel').style.setProperty('display', 'none', 'important');
                document.querySelector('#read-screen .shortcut-panel').style.setProperty('display', 'none', 'important');

                document.getElementById('studentRecordPanel').style.display = 'none';
                const reviewPanel = document.getElementById('teacherReviewPanel');
                reviewPanel.style.display = 'flex';
                document.getElementById('reviewStudentName').innerText = d.studentName || 'Siswa';
                document.getElementById('reviewAudioContainer').innerHTML =
                    setoranPlayerHtml(d);
                document.getElementById('reviewNilaiInput').value = d.nilai != null ? d.nilai : '';
                document.getElementById('reviewFeedbackInput').value = d.feedback || '';
                document.getElementById('btnKirimPenilaianReview').innerText = d.status === 'dinilai' ? 'Perbarui Penilaian' : 'Kirim Penilaian';
            } catch (e) {
                console.error(e);
                showToast('Gagal membuka setoran.');
            }
        }
        window.openSetoranReview = openSetoranReview;

        // Mengembalikan halaman baca ke kondisi normal (panel rekam siswa,
        // Pintasan & Halaman muncul lagi), dipanggil otomatis oleh
        // goToMenu() saat guru menekan tombol kembali dari mode tinjauan.
        function exitSetoranReview() {
            currentReviewSetoranId = null;
            document.getElementById('teacherReviewPanel').style.display = 'none';
            document.getElementById('studentRecordPanel').style.display = 'flex';
            // removeProperty (bukan set ke '') supaya override paksa tadi
            // benar-benar hilang dan CSS kembali menentukan tampilannya sendiri.
            document.querySelector('#read-screen .page-nav-panel').style.removeProperty('display');
            document.querySelector('#read-screen .shortcut-panel').style.removeProperty('display');
        }

        // Tombol "← Kembali" di panel penilaian: keluar dari halaman baca,
        // balik ke Panel Guru, lalu langsung buka lagi popup notifikasi
        // supaya guru bisa pilih setoran lain untuk dinilai.
        function backToNotifFromReview() {
            exitSetoranReview();
            document.getElementById('read-screen').classList.remove('active');
            document.getElementById('menu-screen').classList.add('active');
            appState = 'menu';
            updateMenuCoverFocus();
            toggleNotifModal(true);
        }
        window.backToNotifFromReview = backToNotifFromReview;

        async function kirimPenilaianReview() {
            if (!currentReviewSetoranId) return;
            const nilai = document.getElementById('reviewNilaiInput').value.trim();
            const feedback = document.getElementById('reviewFeedbackInput').value.trim();

            if (nilai === '' && feedback === '') { showToast('Isi nilai atau feedback terlebih dahulu.'); return; }

            const ok = await submitPenilaian(currentReviewSetoranId, nilai, feedback);
            if (ok) {
                showToast('Penilaian berhasil dikirim ke siswa!');
                // Setelah dinilai, otomatis kembali ke popup notifikasi --
                // notifikasinya TETAP ADA (tidak dihapus) selama 24 jam,
                // jadi guru masih bisa membukanya lagi untuk dengar ulang
                // atau memperbarui penilaian (lihat cleanupExpiredSetoranNotif()).
                backToNotifFromReview();
            }
        }
        window.kirimPenilaianReview = kirimPenilaianReview;

        // --- LIHAT HASIL PENILAIAN (SISWA) ---
        // Menerima data notifikasi LANGSUNG (bukan mengambil ulang dokumen
        // "setoran" dari Firestore), karena dokumen setoran yang sudah
        // dinilai langsung dihapus oleh submitPenilaian(). Semua data yang
        // dibutuhkan (nilai, catatan, audio, jilid, halaman) sudah disisipkan
        // ke dalam notifikasinya sendiri.
        function lihatHasilSetoran(data) {
            const contentEl = document.getElementById('hasilSetoranContent');
            contentEl.innerHTML = `
                <div style="font-size:13px; color:var(--text-muted); margin-bottom:8px;">${getJilidFullLabel(data.jilid)} • Halaman ${data.halaman}</div>
                ${setoranPlayerHtml(data, 'margin-bottom:12px;')}
                <div style="font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:2px;">Nilai</div>
                <div style="font-size:22px; font-weight:800; color:var(--accent-solid); margin-bottom:12px;">${data.nilai != null ? data.nilai : '-'}</div>
                <div style="font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:2px;">Catatan Guru</div>
                <div style="font-size:13px; color:var(--text-main); background:var(--input-bg); padding:10px; border-radius:10px;">${data.feedback || 'Tidak ada catatan.'}</div>
            `;
            document.getElementById('hasilSetoranModal').classList.add('active');
        }
        window.lihatHasilSetoran = lihatHasilSetoran;

        // --- RIWAYAT SETORAN SISWA ---
        // Data ringkas (jilid, halaman, nilai, catatan) disimpan di koleksi
        // "riwayat_setoran" dan TIDAK ikut dihapus otomatis 24 jam seperti
        // dokumen setoran/audionya. Siswa bisa menghapus riwayatnya sendiri.
        let riwayatItems = [];

        function riwayatEsc(v) {
            return String(v == null ? '' : v)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }

        function riwayatMillis(item) {
            const t = item.createdAt;
            return (t && typeof t.toMillis === 'function') ? t.toMillis() : Date.now();
        }

        function renderRiwayatList() {
            const box = document.getElementById('riwayatListContainer');
            const summary = document.getElementById('riwayatSummary');
            if (!box) return;

            if (!riwayatItems.length) {
                if (summary) summary.style.display = 'none';
                box.innerHTML = '<div class="riwayat-empty">Belum ada riwayat setoran.<br>Setoran yang Anda kirim ke guru akan tercatat di sini.</div>';
                return;
            }

            // Ringkasan: jumlah setoran + rata-rata nilai
            const graded = riwayatItems.filter(it => it.status === 'dinilai' && typeof it.nilai === 'number');
            if (summary) {
                let avgText = '';
                if (graded.length) {
                    const avg = Math.round(graded.reduce((s, it) => s + it.nilai, 0) / graded.length * 10) / 10;
                    avgText = `<span>Rata-rata nilai <b>${avg}</b></span>`;
                }
                summary.innerHTML = `<span><b>${riwayatItems.length}</b> setoran</span>${avgText}`;
                summary.style.display = 'flex';
            }

            box.innerHTML = riwayatItems.map(it => {
                const ms = riwayatMillis(it);
                const tgl = new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                const jam = new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

                let scoreHtml;
                if (it.status === 'dinilai' && typeof it.nilai === 'number') {
                    const cls = it.nilai >= 80 ? 'high' : (it.nilai >= 60 ? 'mid' : 'low');
                    scoreHtml = `<div class="riwayat-score ${cls}">${riwayatEsc(it.nilai)}</div>`;
                } else if (it.status === 'dinilai') {
                    scoreHtml = '<div class="riwayat-score">✓</div>';
                } else {
                    scoreHtml = '<div class="riwayat-score pending">Menunggu</div>';
                }

                const guru = (it.status === 'dinilai' && it.guruName) ? ` • Guru: ${riwayatEsc(it.guruName)}` : '';
                const note = it.feedback ? `<div class="riwayat-note">“${riwayatEsc(it.feedback)}”</div>` : '';

                return `
                    <div class="riwayat-item">
                        <div class="riwayat-info">
                            <div class="riwayat-title">${riwayatEsc(getJilidFullLabel(it.jilid))} • Hal. ${riwayatEsc(it.halaman)}</div>
                            <div class="riwayat-meta">${tgl}, ${jam}${guru}</div>
                            ${note}
                        </div>
                        ${scoreHtml}
                        <button class="riwayat-del" onclick="hapusRiwayatSetoran('${riwayatEsc(it.id)}')" title="Hapus riwayat" aria-label="Hapus riwayat">
                            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                        </button>
                    </div>`;
            }).join('');
        }

        async function openRiwayatSetoran() {
            const modal = document.getElementById('riwayatModal');
            const box = document.getElementById('riwayatListContainer');
            const summary = document.getElementById('riwayatSummary');
            if (!modal || !box) return;
            modal.classList.add('active');
            if (summary) summary.style.display = 'none';
            box.innerHTML = '<div class="riwayat-empty">Memuat riwayat...</div>';

            const profile = window.currentUserProfile;
            if (!profile || !profile.uid) {
                box.innerHTML = '<div class="riwayat-empty">Sesi tidak valid, silakan masuk ulang.</div>';
                return;
            }
            try {
                const q = window.query(
                    window.collection(window.firebaseDb, "riwayat_setoran"),
                    window.where("studentUid", "==", profile.uid)
                );
                const snap = await window.getDocs(q);
                riwayatItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                riwayatItems.sort((a, b) => riwayatMillis(b) - riwayatMillis(a)); // terbaru di atas
                renderRiwayatList();
            } catch (e) {
                console.error('Gagal memuat riwayat setoran:', e);
                box.innerHTML = '<div class="riwayat-empty">Riwayat belum bisa dimuat.<br>Periksa koneksi internet Anda, lalu coba lagi.</div>';
            }
        }
        window.openRiwayatSetoran = openRiwayatSetoran;

        function closeRiwayatSetoran() {
            const modal = document.getElementById('riwayatModal');
            if (modal) modal.classList.remove('active');
        }
        window.closeRiwayatSetoran = closeRiwayatSetoran;

        async function hapusRiwayatSetoran(id) {
            if (!navigator.onLine) { showToast('Anda sedang offline. Riwayat belum bisa dihapus.'); return; }
            if (!confirm('Hapus riwayat setoran ini?')) return;
            try {
                await window.deleteDoc(window.doc(window.firebaseDb, "riwayat_setoran", id));
                riwayatItems = riwayatItems.filter(it => it.id !== id);
                renderRiwayatList();
                showToast('Riwayat dihapus.');
            } catch (e) {
                console.error('Gagal menghapus riwayat:', e);
                showToast('Gagal menghapus riwayat.');
            }
        }
        window.hapusRiwayatSetoran = hapusRiwayatSetoran;

        function handleLogout() {
            window.signOut(window.firebaseAuth).catch((error) => { console.error("Gagal keluar", error); });
        }

        let savedLastRead = JSON.parse(localStorage.getItem('tartili_last_read')) || { jilid: 1, page: 'a' };
        const LEGACY_BOOKMARKS_KEY = 'tartili_bookmarks';
        let savedBookmarks = [];
        let savedBookmarksUserId = null;
        let bookmarkSyncReadyUserId = null;
        let unsubscribeBookmarks = null;

        function getBookmarksStorageKey(userId) {
            return `tartili_bookmarks_${userId}`;
        }

        function parseBookmarkList(value) {
            try {
                const parsed = JSON.parse(value || '[]');
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                return [];
            }
        }

        function loadBookmarksForUser(userId, role) {
            if (unsubscribeBookmarks) {
                unsubscribeBookmarks();
                unsubscribeBookmarks = null;
            }

            savedBookmarksUserId = userId || null;
            bookmarkSyncReadyUserId = null;

            if (!savedBookmarksUserId) {
                savedBookmarks = [];
                updateBookmarkButtonState();
                if (document.getElementById('bookmarks-screen').classList.contains('active')) {
                    renderBookmarksList();
                }
                return;
            }

            const currentUserId = savedBookmarksUserId;
            const userRef = window.doc(window.firebaseDb, 'users', currentUserId);
            savedBookmarks = parseBookmarkList(localStorage.getItem(getBookmarksStorageKey(currentUserId)));
            updateBookmarkButtonState();

            unsubscribeBookmarks = window.onSnapshot(userRef, (snapshot) => {
                if (savedBookmarksUserId !== currentUserId) return;

                const userData = snapshot.exists() ? snapshot.data() : {};
                if (Array.isArray(userData.bookmarks)) {
                    savedBookmarks = userData.bookmarks;
                    bookmarkSyncReadyUserId = currentUserId;
                    localStorage.setItem(getBookmarksStorageKey(currentUserId), JSON.stringify(savedBookmarks));
                    updateBookmarkButtonState();
                    if (document.getElementById('bookmarks-screen').classList.contains('active')) {
                        renderBookmarksList();
                    }
                    return;
                }

                if (bookmarkSyncReadyUserId === currentUserId) return;
                bookmarkSyncReadyUserId = currentUserId;

                const localBookmarksKey = getBookmarksStorageKey(currentUserId);
                const localBookmarks = localStorage.getItem(localBookmarksKey);
                let migratedLegacyBookmarks = false;
                if (localBookmarks !== null) {
                    savedBookmarks = parseBookmarkList(localBookmarks);
                } else if (role === 'Guru' && localStorage.getItem(LEGACY_BOOKMARKS_KEY) !== null) {
                    savedBookmarks = parseBookmarkList(localStorage.getItem(LEGACY_BOOKMARKS_KEY));
                    migratedLegacyBookmarks = true;
                } else {
                    savedBookmarks = [];
                }

                localStorage.setItem(localBookmarksKey, JSON.stringify(savedBookmarks));
                updateBookmarkButtonState();
                if (document.getElementById('bookmarks-screen').classList.contains('active')) {
                    renderBookmarksList();
                }

                window.setDoc(userRef, { bookmarks: savedBookmarks }, { merge: true }).then(() => {
                    if (migratedLegacyBookmarks) localStorage.removeItem(LEGACY_BOOKMARKS_KEY);
                }).catch((error) => {
                    console.error('Gagal memigrasikan bookmark ke Firestore:', error);
                    showToast('Bookmark tersimpan di perangkat ini, tetapi gagal disinkronkan.');
                });
            }, (error) => {
                if (savedBookmarksUserId !== currentUserId) return;
                console.error('Gagal memuat bookmark dari Firestore:', error);
                savedBookmarks = parseBookmarkList(localStorage.getItem(getBookmarksStorageKey(currentUserId)));
                bookmarkSyncReadyUserId = currentUserId;
                updateBookmarkButtonState();
                if (document.getElementById('bookmarks-screen').classList.contains('active')) {
                    renderBookmarksList();
                }
                showToast('Bookmark tersimpan di perangkat ini, tetapi gagal disinkronkan.');
            });
        }

        function persistBookmarks() {
            if (!savedBookmarksUserId || bookmarkSyncReadyUserId !== savedBookmarksUserId) return;

            const currentUserId = savedBookmarksUserId;
            const bookmarks = [...savedBookmarks];
            localStorage.setItem(getBookmarksStorageKey(currentUserId), JSON.stringify(bookmarks));
            window.setDoc(window.doc(window.firebaseDb, 'users', currentUserId), { bookmarks }, { merge: true }).catch((error) => {
                console.error('Gagal menyinkronkan bookmark ke Firestore:', error);
                showToast('Bookmark tersimpan di perangkat ini, tetapi gagal disinkronkan.');
            });
        }

        window.loadBookmarksForUser = loadBookmarksForUser;
        
        let currentJilid = savedLastRead.jilid, currentPage = savedLastRead.page, appState = 'menu', selectedMenuCoverIndex = 0, currentAudio = null;
        let mediaRecorder, audioChunks = [], recordedAudioBlob = null; 
        let recordedAudioMimeType = 'audio/webm';
        let isPlayingRecording = false;
        let currentReviewSetoranId = null; // diisi saat guru meninjau 1 setoran lewat notifikasi
        
        const CLOUDINARY_BASE_URL = "https://res.cloudinary.com/ycfss0no";
        const LEGACY_MEDIA_BASE_URL = "https://xdicoipqprrkczagarra.supabase.co/storage/v1/object/public/media-tartili/allfiles/";
        // Transformasi Cloudinary untuk gambar halaman:
        //  f_webp  = kirim format WebP (lebih kecil dari JPG)
        //  q_auto:good = kualitas otomatis tingkat "baik" (lebih tajam dari q_auto biasa)
        //  c_limit,w_2400 = lebar maksimal 2400px (tidak pernah memperbesar gambar kecil)
        // Kalau masih kurang tajam saat di-zoom naikkan 2400 (mis. 3000); kalau terlalu
        // berat/lambat, turunkan lagi. Angka lebih besar = file lebih besar.
        const PAGE_IMAGE_TRANSFORM = "f_webp,q_auto:good,c_limit,w_2400";
        // Nama berkas halaman di Cloudinary (Public ID):
        //   halaman bernomor : t{jilid}_h01 ... t{jilid}_h44   (contoh t2_h05)
        //   halaman pembuka  : t{jilid}_a ... t{jilid}_g        (contoh t2_a)
        //   halaman nol      : t{jilid}_0                        (cadangan: t{jilid}_h00)
        // Fungsi ini mengembalikan daftar kemungkinan nama; yang pertama adalah nama utama.
        const getPageIdVariants = (page) => {
            const p = String(page);
            if (p === '0') return ['0', 'h00'];
            if (/^\d+$/.test(p)) return ['h' + p.padStart(2, '0')];
            return [p, 'h' + p];
        };
        const buildPageImageUrl = (jilid, idPart, transformed) =>
            `${CLOUDINARY_BASE_URL}/image/upload/${transformed ? PAGE_IMAGE_TRANSFORM + '/' : ''}t${jilid}_${idPart}.jpg`;
        const getTransformedPageImageUrl = (jilid, page) => buildPageImageUrl(jilid, getPageIdVariants(page)[0], true);
        // URL tanpa transformasi (gambar asli di Cloudinary)
        const getPlainPageImageUrl = (jilid, page) => buildPageImageUrl(jilid, getPageIdVariants(page)[0], false);
        const getPageImageUrl = (jilid, page) =>
            isImageTransformDisabled() ? getPlainPageImageUrl(jilid, page) : getTransformedPageImageUrl(jilid, page);
        // Kunci cache untuk satu halaman (bertransformasi & polos)
        const getPageImageKeys = (jilid, page) =>
            Array.from(new Set([getPageImageUrl(jilid, page), getTransformedPageImageUrl(jilid, page), getPlainPageImageUrl(jilid, page)]));
        const normalizePageId = (page) => /^\d+$/.test(String(page)) ? String(page).padStart(2, '0') : String(page);
        // Kalau transformasi Cloudinary ditolak (404) tapi gambar asli ada, ingat
        // pilihan ini supaya tidak mencoba URL yang gagal lagi di kunjungan berikutnya.
        const isImageTransformDisabled = () => localStorage.getItem('tartili_img_transform_off') === '1';
        const getPageAudioUrl = (jilid, page, soundFile) => {
            const soundId = String(soundFile).replace(/\.[^.]+$/, '');
            return `${CLOUDINARY_BASE_URL}/video/upload/t${jilid}_h${page}_${soundId}.mp3`;
        };
        let scale = 1, initialDistance = null;
        let pageLoadRequestId = 0, currentPageObjectUrl = null;
        let touchStartX = 0, touchEndX = 0;
        const minSwipeDistance = 50;

        // Data blok suara per jilid (tartili1.js ... tartili6.js) dimuat SAAT
        // DIBUTUHKAN saja, bukan ketujuh-tujuhnya di awal.
        const allAudioConfig = { "1": null, "2": null, "3": null, "4": null, "5": null, "6": null, "7": null };
        const jilidConfigPromises = {};

        function readLoadedJilidConfig(jilid) {
            switch (String(jilid)) {
                case '1': return typeof tartili1Config !== 'undefined' ? tartili1Config : null;
                case '2': return typeof tartili2Config !== 'undefined' ? tartili2Config : null;
                case '3': return typeof tartili3Config !== 'undefined' ? tartili3Config : null;
                case '4': return typeof tartili4Config !== 'undefined' ? tartili4Config : null;
                case '5': return typeof tartili5Config !== 'undefined' ? tartili5Config : null;
                case '6': return typeof tartili6Config !== 'undefined' ? tartili6Config : null;
                case '7': return typeof tartili7Config !== 'undefined' ? tartili7Config : null;
            }
            return null;
        }

        function loadJilidConfig(jilid) {
            const key = String(jilid);
            if (allAudioConfig[key]) return Promise.resolve(allAudioConfig[key]);
            if (jilidConfigPromises[key]) return jilidConfigPromises[key];

            // Kalau ternyata sudah termuat (mis. tag <script> lama masih ada di HTML)
            const already = readLoadedJilidConfig(key);
            if (already) { allAudioConfig[key] = already; return Promise.resolve(already); }

            jilidConfigPromises[key] = new Promise((resolve) => {
                const s = document.createElement('script');
                s.src = `tartili${key}.js`;
                s.async = true;
                s.onload = () => {
                    const cfg = readLoadedJilidConfig(key) || {};
                    allAudioConfig[key] = cfg;
                    resolve(cfg);
                };
                s.onerror = () => {
                    // Gagal (mis. offline): jangan disimpan, supaya bisa dicoba lagi nanti
                    delete jilidConfigPromises[key];
                    s.remove();
                    resolve({});
                };
                document.head.appendChild(s);
            });
            return jilidConfigPromises[key];
        }

        history.replaceState({ screen: 'menu' }, '', '');

        window.addEventListener('popstate', function(event) {
            if (appState === 'read') {
                if (currentAudio) { currentAudio.pause(); currentAudio = null; }
                resetRecording();
                goToMenu();
            } else if (appState === 'bookmarks' || appState === 'admin' || appState === 'teacher-admin' || appState === 'class-members') {
                goToMenu();
            } else {
                history.back();
            }
        });

        function isPortrait() { return window.innerHeight > window.innerWidth; }

        window.addEventListener('resize', () => {
            if (isPortrait()) { resetZoom(); }
            const container = document.getElementById('imageContainer');
            if (appState === 'read' && (!container.innerHTML || container.innerHTML.trim() === '')) {
                loadPageData();
            }
        });

        updatePageOptions('Menu');
        updatePageOptions('Read'); 
        updatePageOptions('Bookmarks');
        updateMenuCoverFocus();

        function openBookmarksScreen() {
            appState = 'bookmarks';
            stopPagePlayer(true);
            document.getElementById('read-screen').classList.remove('active');
            document.getElementById('bookmarks-screen').classList.add('active');
            renderBookmarksList();
            updatePageOptions('Bookmarks');
            history.pushState({ screen: 'bookmarks' }, '', '');
        }

        function renderBookmarksList() {
            const container = document.getElementById('bookmarksListContainer');
            if (!container) return;
            container.innerHTML = "";

            if (savedBookmarks.length === 0) {
                container.innerHTML = `<div style="display:flex; flex-direction: column; align-items:center; justify-content:center; height: 180px; color:var(--text-muted); font-size:13px; padding:20px; text-align:center; gap: 8px;"><span style="font-size: 36px;">📖</span><span>Belum ada halaman tersimpan.</span></div>`;
                return;
            }

            const reversedBookmarks = [...savedBookmarks].reverse();

            reversedBookmarks.forEach((b, revIndex) => {
                const originalIndex = savedBookmarks.length - 1 - revIndex;

                let item = document.createElement('div');
                item.className = 'bookmark-item';
                item.setAttribute('onclick', `openJilid(${b.jilid}, '${b.page}')`);
                item.innerHTML = `
                    <div class="bookmark-item-content">
                        <div class="bookmark-item-icon">
                            <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:var(--accent-solid);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;"><path d="M6 2C4.89543 2 4 2.89543 4 4V22L12 17L20 22V4C20 2.89543 19.1046 2 18 2H6ZM9 5H15C15.5523 5 16 5.44772 16 6C16 6.55228 15.5523 7 15 7H9C8.44772 7 8 6.55228 8 6C8 5.44772 8.44772 5 9 5Z"/></svg>
                        </div>
                        <div class="bookmark-item-info">
                            <span class="bookmark-item-title">${getJilidTitle(b.jilid)}</span>
                            <span class="bookmark-item-subtitle">Halaman ${b.page}</span>
                        </div>
                    </div>
                    <button class="bookmark-item-delete" onclick="removeBookmark(${originalIndex}, event)" title="Hapus">✕</button>
                `;
                container.appendChild(item);
            });
        }

        function removeBookmark(index, event) {
            event.stopPropagation();
            savedBookmarks.splice(index, 1);
            persistBookmarks();
            renderBookmarksList();
            updateBookmarkButtonState();
            showToast('Halaman dihapus dari simpanan');
        }

        function goToMenu() {
            if (currentAudio) { currentAudio.pause(); currentAudio = null; }
            resetRecording();

            // Kalau sebelumnya guru sedang meninjau 1 setoran (dibuka lewat
            // notifikasi), tetap kembalikan ke Menu Utama juga (bukan Panel
            // Guru) supaya konsisten dengan tombol "Kembali" di panel
            // penilaian (lihat backToNotifFromReview()).
            if (currentReviewSetoranId) {
                exitSetoranReview();
            }

            appState = 'menu';
            stopPagePlayer(true);
            localStorage.setItem('tartili_active_screen', 'menu');
            document.getElementById('read-screen').classList.remove('active');
            document.getElementById('bookmarks-screen').classList.remove('active');
            document.getElementById('admin-screen').classList.remove('active');
            document.getElementById('teacher-admin-screen').classList.remove('active');
            document.getElementById('class-members-screen').classList.remove('active');
            document.getElementById('menu-screen').classList.add('active');
            updateMenuCoverFocus();
            history.replaceState({ screen: 'menu' }, '', '');
        }

        function updateMenuCoverFocus() {
            for (let i = 0; i < 7; i++) {
                let btn = document.getElementById('cover-btn-' + i);
                if (btn) {
                    if (i === selectedMenuCoverIndex) btn.classList.add('keyboard-focused');
                    else btn.classList.remove('keyboard-focused');
                }
            }
        }

        function getNumericPageList(jilid) {
            let list = [], max = JILID_PAGE_COUNT[String(jilid)] || 44;
            for (let i = 1; i <= max; i++) list.push(i.toString());
            return list;
        }

        function getFullPageList(jilid) {
            let list = ['a', 'b', 'c', 'd', 'e', 'f', 'g', '0'];
            return list.concat(getNumericPageList(jilid));
        }

        function updatePageOptions(context) {
            let selectId = 'jumpJilidMenu';
            let targetSelectId = 'jumpPageSelectMenu';
            if (context === 'Read') {
                selectId = 'jumpJilidRead';
                targetSelectId = 'jumpPageSelectRead';
            } else if (context === 'Bookmarks') {
                selectId = 'jumpJilidBookmarks';
                targetSelectId = 'jumpPageSelectBookmarks';
            }
            
            let jilidEl = document.getElementById(selectId);
            let select = document.getElementById(targetSelectId);
            if (!jilidEl || !select) return;
            
            let jilid = parseInt(jilidEl.value);
            select.innerHTML = "";
            getNumericPageList(jilid).forEach(p => { 
                let opt = document.createElement('option'); 
                opt.value = p; opt.text = p; 
                select.appendChild(opt); 
            });
        }

        function directOpen(context) {
            let jilidId = 'jumpJilidMenu';
            let pageId = 'jumpPageSelectMenu';
            if (context === 'Read') {
                jilidId = 'jumpJilidRead';
                pageId = 'jumpPageSelectRead';
            } else if (context === 'Bookmarks') {
                jilidId = 'jumpJilidBookmarks';
                pageId = 'jumpPageSelectBookmarks';
            }
            const jilid = parseInt(document.getElementById(jilidId).value);
            const page = document.getElementById(pageId).value;
            openJilid(jilid, page);
        }

        function openJilid(jilid, page) {
            currentJilid = jilid; currentPage = page; appState = 'read';
            localStorage.setItem('tartili_active_screen', 'read');
            document.getElementById('read-screen').classList.add('active');
            document.getElementById('menu-screen').classList.remove('active');
            document.getElementById('bookmarks-screen').classList.remove('active');
            document.getElementById('admin-screen').classList.remove('active');
            document.getElementById('teacher-admin-screen').classList.remove('active');
            document.getElementById('class-members-screen').classList.remove('active');
            // Pilihan jilid di Pintasan disamakan dulu dengan jilid yang dibuka,
            // baru daftar halamannya disusun (supaya jumlah halamannya sesuai jilid).
            const jilidSelectRead = document.getElementById('jumpJilidRead');
            if (jilidSelectRead) jilidSelectRead.value = jilid;
            updatePageOptions('Read');
            
            let numList = getNumericPageList(currentJilid);
            let targetPage = numList.includes(currentPage.toString()) ? currentPage.toString() : "1";
            document.getElementById('jumpPageSelectRead').value = targetPage;
            
            resetZoom();
            loadPageData();
            history.pushState({ screen: 'read' }, '', '');
        }

        function resetZoom() { scale = 1; updateImageTransform(); }

        function updateImageTransform() {
            const container = document.getElementById('imageContainer');
            if (container) container.style.transform = `scale(${scale})`;
        }

        function changePage(delta) {
            let pages = getFullPageList(currentJilid);
            let currentIndex = pages.indexOf(currentPage.toString());
            let newIndex = currentIndex + delta;
            if (newIndex >= 0 && newIndex < pages.length) {
                currentPage = pages[newIndex];
                resetZoom();
                loadPageData();
            }
        }

        function toggleBookmark() {
            let index = savedBookmarks.findIndex(b => b.jilid === currentJilid && b.page === currentPage);
            
            if (index > -1) {
                savedBookmarks.splice(index, 1);
                showToast('Halaman dihapus dari simpanan');
            } else {
                savedBookmarks.push({ jilid: currentJilid, page: currentPage });
                showToast('Halaman berhasil disimpan!');
            }
            
            persistBookmarks();
            updateBookmarkButtonState();
        }

        function updateBookmarkButtonState() {
            const btn = document.getElementById('btnBookmark');
            if (!btn) return;
            let isSaved = savedBookmarks.some(b => b.jilid === currentJilid && b.page === currentPage);
            if (isSaved) {
                btn.classList.add('saved');
                btn.title = "Hapus Simpanan (Unsave)";
            } else {
                btn.classList.remove('saved');
                btn.title = "Simpan Halaman (Save)";
            }
        }

        // ===== CACHE & PRELOAD GAMBAR HALAMAN =====
        const MAX_CACHED_PAGES = 24;
        const pageFetchInFlight = new Map();

        function trimPageCache(cache) {
            cache.keys().then((keys) => {
                if (keys.length > MAX_CACHED_PAGES) {
                    return Promise.all(keys.slice(0, keys.length - MAX_CACHED_PAGES).map((req) => cache.delete(req)));
                }
            }).catch(() => {});
        }

        // Mencari gambar halaman di cache offline permanen, lalu cache sementara.
        async function matchPageCache(jilid, page) {
            const keys = getPageImageKeys(jilid, page);
            for (const name of [OFFLINE_IMAGE_CACHE, TARTILI_PAGE_IMAGE_CACHE]) {
                const cache = await window.caches.open(name);
                for (const k of keys) {
                    const hit = await cache.match(k);
                    if (hit) return hit;
                }
            }
            return null;
        }

        // Memastikan gambar halaman ada di cache. Urutan percobaan (untuk tiap kemungkinan nama berkas):
        //   1) Cloudinary dengan transformasi (WebP kecil)
        //   2) Cloudinary gambar asli
        // persist = true -> simpan di cache offline PERMANEN (tidak ikut dibuang otomatis).
        // Kalau sedang diunduh (mis. oleh preload), permintaan yang sama menunggu
        // unduhan itu, bukan mengunduh dua kali.
        function ensurePageCached(jilid, page, persist = false) {
            const key = getPageImageUrl(jilid, page);
            const flightKey = (persist ? 'P|' : 'N|') + key;
            if (pageFetchInFlight.has(flightKey)) return pageFetchInFlight.get(flightKey);
            const p = (async () => {
                const keys = getPageImageKeys(jilid, page);
                const offlineCache = await window.caches.open(OFFLINE_IMAGE_CACHE);
                for (const k of keys) { if (await offlineCache.match(k)) return; }
                const normalCache = await window.caches.open(TARTILI_PAGE_IMAGE_CACHE);
                for (const k of keys) {
                    const hit = await normalCache.match(k);
                    if (hit) {
                        if (persist) await offlineCache.put(key, hit.clone());
                        return;
                    }
                }

                const target = persist ? offlineCache : normalCache;
                const variants = getPageIdVariants(page);
                const useTransform = !isImageTransformDisabled();

                let lastError = null;
                for (const idPart of variants) {
                    let transformedFailed = false;
                    // 1) Cloudinary dengan transformasi (WebP kecil)
                    if (useTransform) {
                        try {
                            const res = await fetch(buildPageImageUrl(jilid, idPart, true));
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                            await target.put(key, res.clone());
                            if (!persist) trimPageCache(normalCache);
                            return;
                        } catch (err) { lastError = err; transformedFailed = true; }
                    }
                    // 2) Cloudinary gambar asli
                    try {
                        const res = await fetch(buildPageImageUrl(jilid, idPart, false));
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        await target.put(key, res.clone());
                        // Transformasi gagal tapi gambar asli ada -> matikan transformasi
                        if (useTransform && transformedFailed) {
                            try { localStorage.setItem('tartili_img_transform_off', '1'); } catch (e) {}
                        }
                        if (!persist) trimPageCache(normalCache);
                        return;
                    } catch (err) { lastError = err; }
                }
                throw lastError || new Error('Gagal mengunduh gambar halaman');
            })();
            pageFetchInFlight.set(flightKey, p);
            const done = () => pageFetchInFlight.delete(flightKey);
            p.then(done, done);
            return p;
        }

        function getNeighborPageIds(jilid, page) {
            const pages = getFullPageList(jilid);
            const i = pages.indexOf(String(page));
            const out = [];
            if (i >= 0 && i + 1 < pages.length) out.push(pages[i + 1]);
            if (i > 0) out.push(pages[i - 1]);
            return out;
        }

        function shouldSkipPrefetch() {
            const c = navigator.connection;
            return !!(c && (c.saveData || /2g/.test(c.effectiveType || '')));
        }

        // Setelah halaman aktif tampil, unduh halaman sesudah & sebelumnya di
        // latar belakang supaya saat digeser langsung muncul.
        function schedulePrefetchNeighbors(requestId) {
            if (!window.caches || shouldSkipPrefetch()) return;
            const jilid = currentJilid, page = currentPage;
            const run = () => {
                if (requestId !== pageLoadRequestId) return;
                getNeighborPageIds(jilid, page).forEach((p) => {
                    ensurePageCached(jilid, p).catch(() => {});
                });
            };
            if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1500 });
            else setTimeout(run, 400);
        }

        function loadPageData() {
            if (currentAudio) { currentAudio.pause(); currentAudio = null; }
            resetRecording();
            
            localStorage.setItem('tartili_last_read', JSON.stringify({ jilid: currentJilid, page: currentPage }));
            updateBookmarkButtonState();

            const container = document.getElementById('imageContainer');
            const spinner = document.getElementById('loadingSpinner');
            const imgPath = getPageImageUrl(currentJilid, currentPage);
            // Cadangan kalau pemuatan lewat cache gagal: coba URL langsung (semua kemungkinan nama)
            const directFallbacks = [];
            getPageIdVariants(currentPage).forEach((idPart) => {
                [true, false].forEach((tr) => {
                    const u = buildPageImageUrl(currentJilid, idPart, tr);
                    if (u !== imgPath && !directFallbacks.includes(u)) directFallbacks.push(u);
                });
            });
            const requestId = ++pageLoadRequestId;
            loadJilidConfig(currentJilid); // mulai muat data suara paralel dengan gambar

            if (currentPageObjectUrl) {
                URL.revokeObjectURL(currentPageObjectUrl);
                currentPageObjectUrl = null;
            }
            
            if (spinner) spinner.style.display = 'block';
            container.innerHTML = "";
            container.style.backgroundImage = '';
            stopPagePlayer(true);
            hidePagePlayer();
            updateJilidBadge();

            let img = new Image();
            img.draggable = false;
            img.alt = `${getJilidTitle(currentJilid)}, halaman ${currentPage}`;
            img.onload = function() {
                if (requestId !== pageLoadRequestId) return;
                if (spinner) spinner.style.display = 'none';
                container.style.backgroundImage = '';
                container.innerHTML = "";
                container.appendChild(img);

                const blocksJilid = currentJilid;
                const blocksPage = currentPage;
                loadJilidConfig(blocksJilid).then((cfg) => {
                    if (requestId !== pageLoadRequestId) return;
                    const blocks = cfg && cfg[blocksPage];
                    if (!blocks) return;
                    let audioWarmed = false;
                    blocks.forEach(block => {
                        let [top, left, width, height, soundFile] = block;
                        const soundBlock = document.createElement('div');
                        soundBlock.className = 'sound-block';
                        soundBlock.style.cssText = `top: ${top}%; left: ${left}%; width: ${width}%; height: ${height}%;`;
                        soundBlock.onclick = () => {
                            playSound(soundFile);
                            // Ketukan pertama di halaman ini: siapkan audio blok lainnya di latar belakang
                            if (!audioWarmed) {
                                audioWarmed = true;
                                prefetchPageAudio(blocksJilid, blocksPage, blocks, soundFile);
                            }
                        };
                        container.appendChild(soundBlock);
                    });
                    setPagePlayerBlocks(blocksJilid, blocksPage, blocks);
                });

                schedulePrefetchNeighbors(requestId);
            };
            img.onerror = function() {
                if (requestId !== pageLoadRequestId) return;
                if (directFallbacks.length) {
                    img.src = directFallbacks.shift();
                    return;
                }
                if (spinner) spinner.style.display = 'none';
                container.style.backgroundImage = '';
                container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444;font-size:13px;">Gagal memuat halaman</div>`;
            };

            const loadCachedImage = async () => {
                if (!window.caches) return imgPath;
                try {
                    // Halaman belum ada di perangkat: tampilkan pratinjau buram kecil dulu
                    // sementara gambar penuh diunduh.
                    if (!(await matchPageCache(currentJilid, currentPage)) && requestId === pageLoadRequestId && navigator.onLine) {
                        const lqip = `${CLOUDINARY_BASE_URL}/image/upload/f_webp,q_20,w_48,e_blur:300/t${currentJilid}_${getPageIdVariants(currentPage)[0]}.jpg`;
                        container.style.backgroundImage = `url("${lqip}")`;
                        container.style.backgroundSize = '100% 100%';
                        container.style.backgroundRepeat = 'no-repeat';
                    }
                    await ensurePageCached(currentJilid, currentPage);
                    const response = await matchPageCache(currentJilid, currentPage);
                    if (!response) return imgPath;
                    return URL.createObjectURL(await response.blob());
                } catch (error) {
                    console.warn('Cache gambar halaman tidak tersedia:', error);
                    return imgPath;
                }
            };

            loadCachedImage().then((imageSource) => {
                if (requestId !== pageLoadRequestId) {
                    if (imageSource.startsWith('blob:')) URL.revokeObjectURL(imageSource);
                    return;
                }
                if (imageSource.startsWith('blob:')) currentPageObjectUrl = imageSource;
                img.src = imageSource;
            });

            // Jilid di Pintasan berubah (mis. lewat halaman berikut/riwayat): susun ulang daftar halamannya
            const jilidSelectRead = document.getElementById('jumpJilidRead');
            if (jilidSelectRead && String(jilidSelectRead.value) !== String(currentJilid)) {
                jilidSelectRead.value = currentJilid;
                updatePageOptions('Read');
            }
            let numList = getNumericPageList(currentJilid);
            if (numList.includes(currentPage.toString())) { 
                document.getElementById('jumpPageSelectRead').value = currentPage; 
            }
        }

        // ===== PEMUTAR AUDIO 1 HALAMAN =====
        // Memutar semua blok suara di halaman aktif secara berurutan (urutan data = urutan baca),
        // dengan blok yang sedang bunyi menyala. Bisa dijeda, dihentikan, dan diatur kecepatannya.
        var pagePlayerState = { blocks: [], jilid: null, page: null, index: 0, playing: false, paused: false,
                                audio: null, nextAudio: null, nextIndex: -1, timer: null, seq: 0, resumeNext: false };
        var PAGE_PLAYER_RATES = [1, 0.75, 1.25];
        var pagePlayerRate = (function () {
            const r = parseFloat(localStorage.getItem('tartili_page_rate'));
            return PAGE_PLAYER_RATES.includes(r) ? r : 1;
        })();

        function ppEl(id) { return document.getElementById(id); }

        function ppUpdateUI() {
            const st = pagePlayerState;
            const active = st && st.playing;
            const extra = ppEl('ppExtra'), play = ppEl('ppIconPlay'), pause = ppEl('ppIconPause'), main = ppEl('ppMain');
            if (extra) extra.style.display = active ? 'flex' : 'none';
            if (play) play.style.display = (active && !st.paused) ? 'none' : 'block';
            if (pause) pause.style.display = (active && !st.paused) ? 'block' : 'none';
            if (main) {
                const label = !active ? 'Putar semua audio halaman ini' : (st.paused ? 'Lanjutkan' : 'Jeda');
                main.title = label; main.setAttribute('aria-label', label);
            }
            const speed = ppEl('ppSpeed');
            if (speed) speed.textContent = String(pagePlayerRate).replace('.', ',') + '×';
            const count = ppEl('ppCount');
            if (count && st) count.textContent = `${Math.min(st.index + 1, st.blocks.length)}/${st.blocks.length}`;
        }

        function ppHighlight(index) {
            const container = ppEl('imageContainer');
            if (!container) return;
            container.querySelectorAll('.sound-block.playing').forEach((el) => el.classList.remove('playing'));
            if (index == null || index < 0) return;
            const el = container.querySelectorAll('.sound-block')[index];
            if (el) { el.classList.add('playing'); ppEnsureVisible(el); }
        }

        // Pastikan blok yang sedang bunyi terlihat di layar (terutama mode landscape, saat halaman perlu digulir)
        function ppEnsureVisible(el) {
            const area = document.getElementById('scrollArea');
            if (!el || !area) return;
            const r = el.getBoundingClientRect();
            const a = area.getBoundingClientRect();
            const margin = 36;
            if (r.top >= a.top + margin && r.bottom <= a.bottom - margin) return;   // sudah terlihat penuh
            const delta = (r.top + r.height / 2) - (a.top + a.height / 2);
            try { area.scrollBy({ top: delta, behavior: 'smooth' }); } catch (e) { area.scrollTop += delta; }
        }

        // Dipanggil setiap halaman selesai memasang blok suara
        function setPagePlayerBlocks(jilid, page, blocks) {
            stopPagePlayer(true);
            pagePlayerState.blocks = blocks || [];
            pagePlayerState.jilid = jilid;
            pagePlayerState.page = page;
            const box = ppEl('pagePlayer');
            if (box) box.style.display = pagePlayerState.blocks.length ? 'flex' : 'none';
            ppUpdateUI();
            // Petunjuk satu kali saja
            if (pagePlayerState.blocks.length && !localStorage.getItem('tartili_hint_pageplayer')) {
                try { localStorage.setItem('tartili_hint_pageplayer', '1'); } catch (e) { /* abaikan */ }
                showToast('Ketuk ▶ di pojok kanan atas untuk memutar semua audio halaman ini.');
            }
        }

        function hidePagePlayer() {
            const box = ppEl('pagePlayer');
            if (box) box.style.display = 'none';
        }

        function ppBuildAudio(i) {
            const st = pagePlayerState;
            const a = new Audio(getPageAudioUrl(st.jilid, st.page, st.blocks[i][4]));
            a.preload = 'auto';
            a.defaultPlaybackRate = pagePlayerRate;
            a.playbackRate = pagePlayerRate;
            return a;
        }

        function ppPlayCurrent() {
            const st = pagePlayerState;
            if (!st.playing) return;
            const i = st.index;
            if (i >= st.blocks.length) { ppFinish(); return; }

            const seq = ++st.seq;
            const a = (st.nextAudio && st.nextIndex === i) ? st.nextAudio : ppBuildAudio(i);
            st.nextAudio = null; st.nextIndex = -1;
            a.defaultPlaybackRate = pagePlayerRate;
            a.playbackRate = pagePlayerRate;
            st.audio = a;
            ppHighlight(i);
            ppUpdateUI();

            const advance = () => {
                if (seq !== st.seq || !st.playing) return;
                // jeda singkat antar blok supaya tiap bunyi terdengar jelas
                st.resumeNext = true;
                st.timer = setTimeout(() => {
                    st.timer = null; st.resumeNext = false;
                    if (seq !== st.seq || !st.playing || st.paused) return;
                    st.index = i + 1;
                    ppPlayCurrent();
                }, 350);
            };
            a.onended = advance;
            a.onerror = () => { if (seq === st.seq && st.playing) { st.index = i + 1; ppPlayCurrent(); } };
            const p = a.play();
            if (p && p.catch) p.catch(() => { if (seq === st.seq && st.playing && !st.paused) { st.index = i + 1; ppPlayCurrent(); } });

            // siapkan audio berikutnya supaya tidak ada jeda unduh
            if (i + 1 < st.blocks.length) { st.nextAudio = ppBuildAudio(i + 1); st.nextIndex = i + 1; }
        }

        function ppFinish() {
            const st = pagePlayerState;
            st.playing = false; st.paused = false; st.index = 0; st.audio = null; st.nextAudio = null; st.resumeNext = false;
            ppHighlight(-1);
            ppUpdateUI();
        }

        function startPagePlayer() {
            const st = pagePlayerState;
            if (!st.blocks.length) return;
            if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }   // hentikan ketukan blok tunggal
            st.playing = true; st.paused = false; st.index = 0; st.resumeNext = false;
            // pemanasan audio seluruh halaman (sama seperti setelah ketukan pertama)
            prefetchPageAudio(st.jilid, st.page, st.blocks, null);
            ppPlayCurrent();
        }

        function togglePagePlayer() {
            const st = pagePlayerState;
            if (!st.playing) { startPagePlayer(); return; }
            if (!st.paused) {
                st.paused = true;
                if (st.timer) { clearTimeout(st.timer); st.timer = null; }
                if (st.audio) st.audio.pause();
            } else {
                st.paused = false;
                if (st.resumeNext) {            // dijeda saat jeda antar blok -> lanjut ke blok berikutnya
                    st.resumeNext = false;
                    st.index = st.index + 1;
                    ppPlayCurrent();
                } else if (st.audio) {
                    const p = st.audio.play();
                    if (p && p.catch) p.catch(() => {});
                }
            }
            ppUpdateUI();
        }

        // silent = true: dipanggil otomatis (ganti halaman, ketuk blok tunggal), tanpa mengubah tampilan tombol berlebihan
        function stopPagePlayer(silent) {
            const st = pagePlayerState;
            if (!st) return;
            st.seq++;
            if (st.timer) { clearTimeout(st.timer); st.timer = null; }
            if (st.audio) { try { st.audio.pause(); } catch (e) { /* abaikan */ } }
            st.audio = null; st.nextAudio = null; st.nextIndex = -1; st.resumeNext = false;
            const was = st.playing;
            st.playing = false; st.paused = false; st.index = 0;
            if (was || !silent) { ppHighlight(-1); }
            ppUpdateUI();
        }

        function cyclePagePlayerRate() {
            const idx = PAGE_PLAYER_RATES.indexOf(pagePlayerRate);
            pagePlayerRate = PAGE_PLAYER_RATES[(idx + 1) % PAGE_PLAYER_RATES.length];
            try { localStorage.setItem('tartili_page_rate', String(pagePlayerRate)); } catch (e) { /* abaikan */ }
            const st = pagePlayerState;
            if (st.audio) { st.audio.defaultPlaybackRate = pagePlayerRate; st.audio.playbackRate = pagePlayerRate; }
            if (st.nextAudio) { st.nextAudio.defaultPlaybackRate = pagePlayerRate; st.nextAudio.playbackRate = pagePlayerRate; }
            ppUpdateUI();
        }

        window.togglePagePlayer = togglePagePlayer;
        window.stopPagePlayer = stopPagePlayer;
        window.cyclePagePlayerRate = cyclePagePlayerRate;

        // Pemanasan audio: setelah siswa mengetuk satu blok, audio blok lain di halaman yang sama
        // diunduh pelan-pelan di latar belakang (maksimal 3 sekaligus) supaya ketukan berikutnya langsung bunyi.
        // Tidak dilakukan saat Penghemat Data aktif atau koneksi sangat lambat.
        const warmedAudioUrls = new Set();
        function prefetchPageAudio(jilid, page, blocks, exceptSoundFile) {
            if (!blocks || shouldSkipPrefetch()) return;
            const urls = [];
            blocks.forEach((b) => {
                if (!b || !b[4] || b[4] === exceptSoundFile) return;
                const u = getPageAudioUrl(jilid, page, b[4]);
                if (!warmedAudioUrls.has(u)) urls.push(u);
            });
            if (!urls.length || urls.length > 80) return;
            let i = 0;
            const next = () => {
                if (i >= urls.length) return;
                const u = urls[i++];
                warmedAudioUrls.add(u);
                fetch(u, { mode: 'no-cors' }).catch(() => {}).then(() => setTimeout(next, 40));
            };
            next(); next(); next();
        }

        function playSound(soundFile) {
            stopPagePlayer(true);
            if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
            currentAudio = new Audio(getPageAudioUrl(currentJilid, currentPage, soundFile));
            const p = currentAudio.play();
            if (p && p.catch) p.catch((err) => console.warn('Audio tidak bisa diputar:', err));
        }

        function resetRecording() {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') { mediaRecorder.stop(); }
            audioChunks = []; recordedAudioBlob = null; recordingQualityIssue = '';
            const playbackEl = document.getElementById('playbackAudioEl');
            if (playbackEl) { playbackEl.pause(); playbackEl.removeAttribute('src'); }
            const btnRec = document.getElementById('btnRec');
            const btnStop = document.getElementById('btnStop');
            const btnPlay = document.getElementById('btnPlay');
            const btnSend = document.getElementById('btnSend');
            if (btnRec) { btnRec.disabled = false; btnRec.classList.remove('is-recording'); }
            if (btnStop) btnStop.disabled = true;
            if (btnPlay) { btnPlay.disabled = true; btnPlay.innerText = '▶ Play'; }
            if (btnSend) { btnSend.disabled = true; btnSend.innerText = 'Kirim'; }
        }

        // Daftar format audio dari kualitas terbaik ke yang paling umum
        // didukung -- dipilih otomatis sesuai kemampuan browser pengguna.
        const PREFERRED_AUDIO_MIME_TYPES = [
            'audio/webm;codecs=opus',
            'audio/ogg;codecs=opus',
            'audio/webm',
            'audio/mp4'
        ];

        // ===== PEMERIKSAAN KUALITAS REKAMAN =====
        // Setelah merekam, suara dianalisis: terlalu pelan, terlalu keras (pecah),
        // terlalu berisik, atau terlalu pendek. Siswa langsung diberi saran sebelum
        // mengirim, karena rekaman ini yang akan dinilai guru.
        let recordingQualityIssue = '';
        let nextRecordingUsesAutoGain = false;

        function decodeAudioBlob(blob) {
            return blob.arrayBuffer().then((ab) => {
                const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
                if (!Ctx) return null;
                const ctx = new Ctx(1, 1, 44100);
                return new Promise((resolve, reject) => ctx.decodeAudioData(ab, resolve, reject));
            });
        }

        async function analyzeRecordingQuality(blob) {
            try {
                const buf = await decodeAudioBlob(blob);
                if (!buf) return null;
                const data = buf.getChannelData(0);
                const sr = buf.sampleRate;
                const win = Math.floor(sr * 0.05);
                const rmsList = [];
                let peak = 0, clipped = 0;
                for (let i = 0; i < data.length; i += win) {
                    let sum = 0, n = 0;
                    const end = Math.min(i + win, data.length);
                    for (let j = i; j < end; j++) {
                        const a = Math.abs(data[j]);
                        if (a > peak) peak = a;
                        if (a >= 0.985) clipped++;
                        sum += a * a; n++;
                    }
                    rmsList.push(Math.sqrt(sum / Math.max(1, n)));
                }
                rmsList.sort((a, b) => a - b);
                const db = (x) => 20 * Math.log10(Math.max(x, 1e-6));
                const p10 = rmsList[Math.floor(rmsList.length * 0.1)] || 0;
                const p90 = rmsList[Math.floor(rmsList.length * 0.9)] || 0;
                return {
                    duration: buf.duration,
                    peakDb: db(peak),
                    levelDb: db(p90),
                    snrDb: db(p90) - db(p10),
                    clippedPct: (clipped / Math.max(1, data.length)) * 100
                };
            } catch (e) {
                console.warn('Analisis rekaman dilewati:', e);
                return null;
            }
        }

        // Mengembalikan teks saran (kosong = kualitas baik)
        function describeRecordingIssue(q) {
            if (!q) return '';
            if (q.duration < 1) return 'Rekaman terlalu pendek.';
            if (q.levelDb < -48 || q.peakDb < -30) {
                nextRecordingUsesAutoGain = true;
                return 'Hampir tidak ada suara yang terekam. Periksa mikrofon, lalu rekam ulang.';
            }
            if (q.peakDb < -18 || q.levelDb < -38) {
                nextRecordingUsesAutoGain = true;
                return 'Suara terlalu pelan. Dekatkan mikrofon (sekitar 10-15 cm) lalu rekam ulang. Rekaman berikutnya dibantu penguat otomatis.';
            }
            if (q.clippedPct > 0.5) {
                nextRecordingUsesAutoGain = false;
                return 'Suara terlalu keras sehingga pecah. Jauhkan mikrofon sedikit atau baca lebih pelan, lalu rekam ulang.';
            }
            if (q.snrDb < 8) return 'Suara latar terlalu berisik dibanding suara bacaan. Pindah ke tempat lebih sepi lalu rekam ulang.';
            return '';
        }

        async function checkRecordingQualityAfterStop(blob) {
            recordingQualityIssue = '';
            const q = await analyzeRecordingQuality(blob);
            if (blob !== recordedAudioBlob) return; // sudah diganti rekaman lain
            recordingQualityIssue = describeRecordingIssue(q);
            if (recordingQualityIssue) showToast(recordingQualityIssue);
        }

        function startRecording() {
            // Kalau sebelumnya sedang memutar ulang rekaman lama, hentikan dulu
            const playbackEl = document.getElementById('playbackAudioEl');
            if (playbackEl && !playbackEl.paused) {
                playbackEl.pause();
                playbackEl.currentTime = 0;
                isPlayingRecording = false;
                const btnPlayEl = document.getElementById('btnPlay');
                if (btnPlayEl) btnPlayEl.innerText = '▶ Play';
            }

            // Minta mikrofon dengan pengaturan kualitas suara terbaik untuk MEREKAM.
            // Peredam gema & peredam bising dimatikan (membuat suara teredam/robotic).
            // Penguat otomatis (autoGainControl) mati secara bawaan supaya suara alami,
            // tetapi otomatis dinyalakan di rekaman berikutnya kalau rekaman sebelumnya
            // terdeteksi terlalu pelan.
            recordingQualityIssue = '';
            const constraints = {
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: nextRecordingUsesAutoGain,
                    sampleRate: 48000,
                    channelCount: 1
                }
            };

            navigator.mediaDevices.getUserMedia(constraints).then(stream => {
                // Pilih format audio terbaik yang didukung browser ini
                let chosenMimeType = '';
                for (const type of PREFERRED_AUDIO_MIME_TYPES) {
                    if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) { chosenMimeType = type; break; }
                }

                // Bitrate dinaikkan ke 128 kbps (jauh lebih jernih dari bawaan
                // browser yang biasanya sekitar 32-64 kbps untuk rekaman suara).
                const recorderOptions = { audioBitsPerSecond: 128000 };
                if (chosenMimeType) recorderOptions.mimeType = chosenMimeType;

                mediaRecorder = new MediaRecorder(stream, recorderOptions);
                audioChunks = [];
                mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
                mediaRecorder.onstop = () => {
                    recordedAudioMimeType = mediaRecorder.mimeType || 'audio/webm';
                    recordedAudioBlob = new Blob(audioChunks, { type: recordedAudioMimeType });
                    stream.getTracks().forEach(t => t.stop());
                    checkRecordingQualityAfterStop(recordedAudioBlob);
                    document.getElementById('btnPlay').disabled = false;
                    document.getElementById('btnSend').disabled = false;
                };
                mediaRecorder.start();
                document.getElementById('btnRec').disabled = true;
                document.getElementById('btnRec').classList.add('is-recording');
                document.getElementById('btnStop').disabled = false;
                document.getElementById('btnPlay').disabled = true;
                document.getElementById('btnSend').disabled = true;
                showToast('Merekam suara...');
            }).catch(e => { console.error(e); showToast('Akses mikrofon ditolak/tidak didukung.'); });
        }

        function stopRecording() {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                document.getElementById('btnRec').classList.remove('is-recording');
                document.getElementById('btnRec').disabled = false; // boleh rekam ulang sebelum dikirim
                document.getElementById('btnStop').disabled = true;
                showToast('Rekaman selesai. Dengarkan dulu, atau rekam ulang kalau ada yang salah.');
            }
        }

        // Tombol Play: dengarkan ulang hasil rekaman sebelum dikirim
        function playRecording() {
            if (!recordedAudioBlob) { showToast('Belum ada rekaman.'); return; }
            const playbackEl = document.getElementById('playbackAudioEl');
            const btnPlay = document.getElementById('btnPlay');

            if (isPlayingRecording) {
                playbackEl.pause();
                playbackEl.currentTime = 0;
                isPlayingRecording = false;
                btnPlay.innerText = '▶ Play';
                return;
            }

            playbackEl.src = URL.createObjectURL(recordedAudioBlob);
            playbackEl.play();
            isPlayingRecording = true;
            btnPlay.innerText = '⏸ Pause';

            playbackEl.onended = () => { isPlayingRecording = false; btnPlay.innerText = '▶ Play'; };
        }
        window.playRecording = playRecording;

        // ==========================================
        // ==========================================
        // KONFIGURASI PENYIMPANAN AUDIO (FILEBASE VIA APPS SCRIPT)
        // ==========================================
        // Isi URL Web App Apps Script Anda di bawah ini setelah proses deploy
        // (lihat panduan di Code.gs). Kunci rahasia Filebase TIDAK ditaruh di sini.
        // Setiap permintaan membuktikan diri dengan TOKEN LOGIN FIREBASE milik
        // pengguna (berlaku singkat), lalu Apps Script yang memeriksanya.
         const FILEBASE_UPLOAD_URL = "https://script.google.com/macros/s/AKfycbwKj91_XK1XKKblERh6YA2R55fyj1CDNGLDFA15ghKn6319zHXtM-RSWiigVLEWUHs2/exec";
        // ===== AUTENTIKASI KE APPS SCRIPT (token login Firebase) =====
        async function callFilebaseApi(payload) {
            const user = window.firebaseAuth && window.firebaseAuth.currentUser;
            if (!user) throw new Error('Sesi login tidak ditemukan, silakan masuk ulang.');
            const idToken = await user.getIdToken(); // diperbarui otomatis kalau hampir kedaluwarsa
            const res = await fetch(FILEBASE_UPLOAD_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // hindari preflight CORS di Apps Script
                body: JSON.stringify({ ...payload, idToken })
            });
            const data = await res.json();
            if (!data.success) {
                const err = new Error(data.error || 'Permintaan ke server gagal');
                err.fromServer = true;
                throw err;
            }
            return data;
        }

        // Mengambil nama file rekaman dari data setoran/notifikasi (data baru maupun lama)
        function extractSetoranKey(src) {
            if (!src) return '';
            if (src.audioKey) return String(src.audioKey);
            if (src.storagePath) return String(src.storagePath);
            if (src.audioUrl) {
                try { return new URL(src.audioUrl).searchParams.get('key') || ''; } catch (e) { /* abaikan */ }
            }
            return '';
        }

        // Pemutar rekaman: tombol dulu, audio baru diambil (dengan token) saat ditekan
        function setoranPlayerHtml(src, extraStyle) {
            const key = extractSetoranKey(src).replace(/[^A-Za-z0-9._\/-]/g, '');
            const style = extraStyle || '';
            if (!key) return `<div class="setoran-player-msg" style="${style}">Rekaman tidak tersedia.</div>`;
            return `<div class="setoran-player" data-key="${key}" style="${style}">` +
                   `<button type="button" class="setoran-play-btn" onclick="loadSetoranAudio(this)">▶ Putar Rekaman</button></div>`;
        }

        const setoranAudioCache = {};
        async function loadSetoranAudio(btn) {
            const box = btn.closest('.setoran-player');
            if (!box) return;
            if (!navigator.onLine) { showToast('Anda sedang offline. Rekaman tidak bisa dimuat.'); return; }
            const key = box.dataset.key;
            btn.disabled = true;
            btn.textContent = 'Memuat rekaman...';
            try {
                let url = setoranAudioCache[key];
                if (!url) {
                    const data = await callFilebaseApi({ action: 'get', key });
                    const bin = atob(data.audioBase64);
                    const bytes = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                    url = URL.createObjectURL(new Blob([bytes], { type: data.mimeType || 'audio/webm' }));
                    setoranAudioCache[key] = url;
                }
                box.innerHTML = '<audio controls autoplay controlsList="nodownload noplaybackrate" style="width:100%; height:40px; display:block;"></audio>';
                box.firstChild.src = url;
            } catch (e) {
                console.error(e);
                btn.disabled = false;
                btn.textContent = '▶ Putar Rekaman';
                showToast(e && e.fromServer ? e.message : 'Gagal memuat rekaman. Coba lagi.');
            }
        }

        const SETORAN_RETENTION_DAYS = 7; // Rekaman otomatis dihapus setelah 7 hari (dicek tiap guru buka halaman Setoran)

        function blobToBase64(blob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }

        // Tombol Kirim: kirim rekaman ke Apps Script -> Apps Script yang upload
        // ke Filebase (kunci rahasia aman di server), lalu simpan data setoran
        // di Firestore, lalu kirim notifikasi ke guru pemilik kelas.
        // Mencegah siswa menutup/refresh tab saat proses kirim sedang
        // berlangsung -- browser akan menampilkan dialog konfirmasi bawaan.
        let isUploadingSetoran = false;
        window.addEventListener('beforeunload', (e) => {
            if (isUploadingSetoran) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        function showUploadingOverlay(text) {
            const el = document.getElementById('uploadingOverlay');
            document.getElementById('uploadingOverlayText').innerText = text;
            el.style.display = 'flex';
        }
        function hideUploadingOverlay() {
            document.getElementById('uploadingOverlay').style.display = 'none';
        }

        async function kirimSetoran() {
            if (!navigator.onLine) { showToast('Anda sedang offline. Rekaman belum bisa dikirim, coba lagi saat online.'); return; }
            if (!recordedAudioBlob) { showToast('Belum ada rekaman untuk dikirim.'); return; }
            if (recordingQualityIssue && !confirm(recordingQualityIssue + '\n\nRekaman ini yang akan dinilai guru.\nTekan OK untuk tetap mengirim, atau Batal untuk merekam ulang.')) return;
            const profile = window.currentUserProfile || {};
            if (!profile.uid) { showToast('Sesi tidak valid, silakan masuk ulang.'); return; }
            if (!profile.classCode) { showToast('Kelas Anda belum terdaftar, hubungi guru.'); return; }
            if (!FILEBASE_UPLOAD_URL || FILEBASE_UPLOAD_URL.includes('PASTE_URL')) {
                showToast('Penyimpanan audio belum dikonfigurasi. Hubungi admin.');
                return;
            }

            const btnSend = document.getElementById('btnSend');
            btnSend.disabled = true;
            btnSend.innerText = 'Mengirim...';
            isUploadingSetoran = true;
            showUploadingOverlay('Mengunggah rekaman...');

            try {
                const base64Audio = await blobToBase64(recordedAudioBlob);

                // Nama file dibuat oleh server (acak & terikat ke akun ini).
                const uploadData = await callFilebaseApi({
                    action: 'upload',
                    audioBase64: base64Audio,
                    mimeType: recordedAudioMimeType
                });
                const audioKey = uploadData.key;

                showUploadingOverlay('Menyimpan data setoran...');

                // Filebase bucket bersifat privat, jadi pemutaran audio TIDAK
                // memakai URL Filebase langsung, melainkan lewat Apps Script
                // (doGet) yang mengambilkan filenya secara aman.

                const setoranRef = await window.addDoc(window.collection(window.firebaseDb, "setoran"), {
                    studentUid: profile.uid,
                    studentName: profile.name || 'Siswa',
                    classCode: profile.classCode,
                    jilid: currentJilid,
                    halaman: currentPage,
                    audioUrl: '',
                    audioKey: audioKey,
                    storagePath: audioKey,
                    status: 'pending',
                    nilai: null,
                    feedback: null,
                    createdAt: window.serverTimestamp()
                });

                // Catat ke riwayat siswa (data ringkas, tanpa audio). Kalau gagal,
                // pengiriman setoran tetap berjalan seperti biasa.
                try {
                    await window.setDoc(window.doc(window.firebaseDb, "riwayat_setoran", setoranRef.id), {
                        studentUid: profile.uid,
                        studentName: profile.name || 'Siswa',
                        classCode: profile.classCode,
                        setoranId: setoranRef.id,
                        jilid: currentJilid,
                        halaman: currentPage,
                        status: 'menunggu',
                        nilai: null,
                        feedback: null,
                        guruName: null,
                        createdAt: window.serverTimestamp(),
                        gradedAt: null
                    });
                } catch (e) {
                    console.warn('Riwayat setoran tidak tersimpan:', e);
                }

                showUploadingOverlay('Mengirim notifikasi ke guru...');

                // Notifikasi dikirim ke KELAS ("CLASS_<kode kelas>"), jadi siswa tidak
                // perlu membaca data guru. Guru pemilik kelas menerimanya di daftar
                // notifikasinya.
                try {
                    await window.addDoc(window.collection(window.firebaseDb, "notifications"), {
                        targetUserId: "CLASS_" + profile.classCode,
                        title: "🎙️ Setoran Bacaan Baru",
                        message: `${profile.name || 'Siswa'} (Kelas ${profile.classCode}) mengirim rekaman ${getJilidFullLabel(currentJilid)} - Hal. ${currentPage}.`,
                        senderId: profile.uid,
                        senderName: profile.name || 'Siswa',
                        actionUrl: 'setoran',
                        setoranId: setoranRef.id,
                        createdAt: window.serverTimestamp(),
                        readBy: []
                    });
                } catch (e) {
                    console.error('Notifikasi setoran ke guru gagal:', e);
                    showToast('Rekaman tersimpan, tetapi notifikasi ke guru gagal terkirim' + (e && e.code ? ` (${e.code})` : '') + '.');
                    resetRecording();
                    return;
                }

                showToast('Rekaman berhasil dikirim ke guru!');
                resetRecording();
            } catch (e) {
                console.error(e);
                const kode = e && (e.code || e.name);
                showToast(e && e.fromServer ? e.message : ('Gagal mengirim rekaman' + (kode ? ` (${kode})` : '') + '. Coba lagi.'));
                btnSend.disabled = false;
                btnSend.innerText = 'Kirim';
            } finally {
                isUploadingSetoran = false;
                hideUploadingOverlay();
            }
        }
        window.kirimSetoran = kirimSetoran;

        const scrollArea = document.getElementById('scrollArea');
        if (scrollArea) {
            scrollArea.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    if (!isPortrait()) {
                        initialDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                    }
                    return;
                }
                if (e.touches.length === 1) {
                    touchStartX = e.touches[0].clientX;
                }
            }, {passive: true});

            scrollArea.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2 && !isPortrait() && initialDistance) {
                    let currentDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                    let delta = (currentDistance - initialDistance) * 0.005;
                    scale = Math.min(Math.max(1, scale + delta), 2.5);
                    updateImageTransform();
                    initialDistance = currentDistance;
                }
            }, {passive: true});

            scrollArea.addEventListener('touchend', (e) => {
                if (e.changedTouches.length === 1 && scale === 1) {
                    touchEndX = e.changedTouches[0].clientX;
                    let diff = touchStartX - touchEndX;
                    if (Math.abs(diff) > minSwipeDistance) {
                        if (diff > 0) changePage(1);
                        else changePage(-1);
                    }
                }
            }, {passive: true});

            // Navigasi panah kiri/kanan keyboard (laptop/desktop) untuk
            // pindah halaman -- hanya aktif saat halaman baca terbuka, dan
            // TIDAK aktif kalau pengguna sedang mengetik di kotak input
            // (misal kolom Nilai/Catatan di panel penilaian guru).
            window.addEventListener('keydown', (e) => {
                if (appState !== 'read') return;
                const activeTag = document.activeElement ? document.activeElement.tagName : '';
                if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;

                if (e.key === 'ArrowRight') { e.preventDefault(); changePage(1); }
                else if (e.key === 'ArrowLeft') { e.preventDefault(); changePage(-1); }
            });

            // Zoom dengan scroll mouse (laptop/desktop, mode landscape) --
            // scroll ke atas memperbesar, scroll ke bawah memperkecil,
            // memakai batas & rumus yang sama dengan pinch-zoom di HP.
            scrollArea.addEventListener('wheel', (e) => {
                if (appState !== 'read' || isPortrait()) return;
                e.preventDefault();
                let delta = -e.deltaY * 0.0015;
                scale = Math.min(Math.max(1, scale + delta), 2.5);
                updateImageTransform();
            }, { passive: false });
        }
    

    // 1. Ubah meta viewport secara otomatis via JavaScript
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

    // 2. Mencegah zoom dari Keyboard (Ctrl +, Ctrl -, Ctrl 0)
    window.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
            e.preventDefault();
        }
    }, { passive: false });

    // 3. Mencegah zoom dari Scroll Mouse (Ctrl + Roda Mouse)
    window.addEventListener('wheel', function (e) {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
        }
    }, { passive: false });

    // 4. Mencegah Gesture Pinch Zoom pada HP/Touchpad
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    document.addEventListener('gesturechange', function (e) { e.preventDefault(); });
    document.addEventListener('gestureend', function (e) { e.preventDefault(); });

        // ===== PASANG APLIKASI (PWA) DI HP & LAPTOP =====
        // Chrome/Edge (Android & komputer) memberi sinyal "bisa dipasang" -> tombol Pasang muncul.
        // iPhone/iPad (Safari) tidak punya sinyal itu, jadi ditampilkan petunjuk manual.
        let deferredInstallPrompt = null;

        function isAppInstalled() {
            return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        }
        function isIOSDevice() {
            return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        }
        function updateInstallButtons() {
            const canShow = !isAppInstalled() && (!!deferredInstallPrompt || isIOSDevice());
            document.querySelectorAll('.install-app-trigger').forEach((el) => {
                el.style.display = canShow ? '' : 'none';
            });
        }
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredInstallPrompt = e;
            updateInstallButtons();
        });
        window.addEventListener('appinstalled', () => {
            deferredInstallPrompt = null;
            updateInstallButtons();
            showToast('Aplikasi TartiliKu berhasil dipasang.');
        });

        async function installApp() {
            if (deferredInstallPrompt) {
                const promptEvent = deferredInstallPrompt;
                deferredInstallPrompt = null;
                promptEvent.prompt();
                try { await promptEvent.userChoice; } catch (e) { /* abaikan */ }
                updateInstallButtons();
                return;
            }
            showInstallHelp();
        }

        function showInstallHelp() {
            const desc = document.getElementById('installHelpDesc');
            const steps = document.getElementById('installHelpSteps');
            if (!desc || !steps) return;
            let items;
            if (isIOSDevice()) {
                desc.textContent = 'Di iPhone/iPad, pemasangan dilakukan dari Safari.';
                items = [
                    'Buka tartili.vercel.app memakai <b>Safari</b> (bukan Chrome).',
                    'Ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas).',
                    'Pilih <b>Tambah ke Layar Utama</b>, lalu ketuk <b>Tambah</b>.'
                ];
            } else {
                desc.textContent = 'Browser ini belum menampilkan tombol pasang otomatis.';
                items = [
                    'Gunakan <b>Chrome</b> atau <b>Edge</b>.',
                    'Di komputer: klik ikon pasang di kanan kolom alamat, atau menu ⋮ → <b>Instal TartiliKu</b>.',
                    'Di Android: menu ⋮ → <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.'
                ];
            }
            steps.innerHTML = items.map((t) => '<li>' + t + '</li>').join('');
            document.getElementById('install-help-modal').classList.add('open');
        }
        function closeInstallHelp() {
            const m = document.getElementById('install-help-modal');
            if (m) m.classList.remove('open');
        }
        updateInstallButtons();

        // =====================================================================
        // SIMPAN JILID UNTUK OFFLINE
        // Mengunduh semua gambar halaman + semua suara satu jilid ke penyimpanan
        // perangkat. Status dihitung langsung dari isi cache (bukan dari catatan),
        // jadi selalu sesuai kenyataan.
        // =====================================================================
        const offlineDownloads = {}; // jilid -> { cancelled, done, total, failed }
        const OFFLINE_JILID_LIST = [1, 2, 3, 4, 5, 6, 7];

        function getJilidAudioUrls(jilid, cfg) {
            const urls = [];
            if (!cfg) return urls;
            Object.keys(cfg).forEach((page) => {
                (cfg[page] || []).forEach((block) => urls.push(getPageAudioUrl(jilid, page, block[4])));
            });
            return Array.from(new Set(urls));
        }

        function formatBytes(n) {
            if (!n) return '0 MB';
            if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
            return (n / (1024 * 1024)).toFixed(n < 100 * 1024 * 1024 ? 1 : 0) + ' MB';
        }

        async function getJilidOfflineStatus(jilid) {
            const cfg = await loadJilidConfig(jilid);
            const audioUrls = getJilidAudioUrls(jilid, cfg);
            const pages = getFullPageList(jilid);
            const imgCache = await caches.open(OFFLINE_IMAGE_CACHE);
            const cachedUrls = new Set((await imgCache.keys()).map((r) => r.url));
            const mediaCache = await caches.open(MEDIA_CACHE_NAME);
            const cachedAudio = new Set((await mediaCache.keys()).map((r) => r.url));
            return {
                pagesTotal: pages.length,
                pagesDone: pages.filter((p) => getPageImageKeys(jilid, p).some((k) => cachedUrls.has(k))).length,
                audioTotal: audioUrls.length,
                audioDone: audioUrls.filter((u) => cachedAudio.has(u)).length
            };
        }

        function renderOfflineRow(jilid, status) {
            const sub = document.getElementById('offline-sub-' + jilid);
            const bar = document.getElementById('offline-bar-' + jilid);
            const btn = document.getElementById('offline-btn-' + jilid);
            const del = document.getElementById('offline-del-' + jilid);
            if (!sub || !bar || !btn || !del) return;
            const running = offlineDownloads[jilid];
            if (running) {
                const pct = running.total ? Math.round((running.done / running.total) * 100) : 0;
                sub.textContent = `Mengunduh... ${pct}%` + (running.failed ? ` (${running.failed} gagal)` : '');
                bar.style.width = pct + '%';
                btn.textContent = 'Batal';
                btn.onclick = () => { running.cancelled = true; };
                btn.disabled = false;
                del.style.display = 'none';
                return;
            }
            if (!status) { sub.textContent = 'Memeriksa...'; bar.style.width = '0%'; btn.disabled = true; del.style.display = 'none'; return; }
            const total = status.pagesTotal + status.audioTotal;
            const done = status.pagesDone + status.audioDone;
            const pct = total ? Math.round((done / total) * 100) : 0;
            const complete = total > 0 && done >= total;
            bar.style.width = pct + '%';
            btn.disabled = false;
            btn.onclick = () => downloadJilidOffline(jilid);
            if (complete) {
                sub.textContent = `✓ Tersimpan (${status.pagesDone} halaman, ${status.audioDone} suara)`;
                btn.textContent = 'Perbarui';
            } else if (done > 0) {
                sub.textContent = `Tersimpan sebagian: ${pct}%`;
                btn.textContent = 'Lengkapi';
            } else {
                sub.textContent = 'Belum disimpan';
                btn.textContent = 'Unduh';
            }
            del.style.display = done > 0 ? 'inline-block' : 'none';
        }

        async function refreshOfflineRow(jilid) {
            renderOfflineRow(jilid, null);
            try { renderOfflineRow(jilid, await getJilidOfflineStatus(jilid)); }
            catch (e) { const sub = document.getElementById('offline-sub-' + jilid); if (sub) sub.textContent = 'Tidak dapat memeriksa'; }
        }

        async function refreshOfflineStorage() {
            const el = document.getElementById('offlineStorageText');
            if (!el) return;
            try {
                if (navigator.storage && navigator.storage.estimate) {
                    const est = await navigator.storage.estimate();
                    el.textContent = `Ruang yang dipakai aplikasi: ${formatBytes(est.usage || 0)}`;
                    return;
                }
            } catch (e) { /* abaikan */ }
            el.textContent = '';
        }

        function openOfflineManager() {
            const list = document.getElementById('offlineList');
            if (!list) return;
            if (!window.caches) { showToast('Browser Anda belum mendukung penyimpanan offline.'); return; }
            list.innerHTML = '';
            OFFLINE_JILID_LIST.forEach((j) => {
                const row = document.createElement('div');
                row.className = 'offline-row';
                row.innerHTML =
                    '<div class="offline-row-info">' +
                        '<div class="offline-row-title">' + getJilidFullLabel(j) + '</div>' +
                        '<div class="offline-row-sub" id="offline-sub-' + j + '">Memeriksa...</div>' +
                        '<div class="offline-bar"><div class="offline-bar-fill" id="offline-bar-' + j + '"></div></div>' +
                    '</div>' +
                    '<div class="offline-row-actions">' +
                        '<button type="button" class="offline-btn" id="offline-btn-' + j + '">...</button>' +
                        '<button type="button" class="offline-btn-del" id="offline-del-' + j + '" onclick="deleteJilidOffline(' + j + ')">Hapus</button>' +
                    '</div>';
                list.appendChild(row);
            });
            document.getElementById('offline-modal').classList.add('open');
            OFFLINE_JILID_LIST.forEach((j) => refreshOfflineRow(j));
            refreshOfflineStorage();
        }

        function closeOfflineManager() {
            const m = document.getElementById('offline-modal');
            if (m) m.classList.remove('open');
        }

        async function downloadAudioToCache(cache, url) {
            if (await cache.match(url)) return;
            const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            await cache.put(url, res);
        }

        async function downloadJilidOffline(jilid) {
            if (!window.caches) { showToast('Browser Anda belum mendukung penyimpanan offline.'); return; }
            if (!navigator.onLine) { showToast('Anda sedang offline. Sambungkan internet untuk mengunduh.'); return; }
            if (offlineDownloads[jilid]) return;
            if (!confirm('Unduh ' + getJilidFullLabel(jilid) + ' untuk dibaca tanpa internet?\n\nSemua halaman dan suara jilid ini akan disimpan di perangkat dan memakai data internet. Disarankan memakai Wi-Fi.')) return;

            const state = { cancelled: false, done: 0, total: 0, failed: 0 };
            offlineDownloads[jilid] = state;
            try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* abaikan */ }
            renderOfflineRow(jilid, null);
            const sub = document.getElementById('offline-sub-' + jilid);
            if (sub) sub.textContent = 'Menyiapkan...';

            try {
                const cfg = await loadJilidConfig(jilid);
                const pages = getFullPageList(jilid);
                const audioUrls = getJilidAudioUrls(jilid, cfg);
                const mediaCache = await caches.open(MEDIA_CACHE_NAME);
                const tasks = [
                    ...pages.map((p) => () => ensurePageCached(jilid, p, true)),
                    ...audioUrls.map((u) => () => downloadAudioToCache(mediaCache, u))
                ];
                state.total = tasks.length;
                let next = 0;
                const worker = async () => {
                    while (!state.cancelled) {
                        if (!navigator.onLine) { state.cancelled = true; state.lostConnection = true; return; }
                        const i = next++;
                        if (i >= tasks.length) return;
                        try { await tasks[i](); } catch (e) { state.failed++; }
                        state.done++;
                        renderOfflineRow(jilid, null);
                    }
                };
                await Promise.all(Array.from({ length: 5 }, worker));
            } catch (e) {
                console.warn('Unduhan offline gagal:', e);
            }

            const finished = !state.cancelled;
            delete offlineDownloads[jilid];
            await refreshOfflineRow(jilid);
            refreshOfflineStorage();
            if (state.lostConnection) showToast('Koneksi terputus. Yang sudah tersimpan aman, tekan Lengkapi untuk melanjutkan.');
            else if (!finished) showToast('Unduhan dibatalkan. Yang sudah tersimpan tetap aman.');
            else if (state.failed) showToast('Selesai, tetapi ' + state.failed + ' berkas gagal. Tekan Lengkapi untuk mencoba lagi.');
            else showToast(getJilidFullLabel(jilid) + ' siap dipakai offline.');
        }

        async function deleteJilidOffline(jilid) {
            if (offlineDownloads[jilid]) return;
            if (!confirm('Hapus data offline ' + getJilidFullLabel(jilid) + ' dari perangkat ini?')) return;
            try {
                const imgCache = await caches.open(OFFLINE_IMAGE_CACHE);
                const re = new RegExp('/image/upload/(?:[^/]+/)?t' + jilid + '_');
                for (const req of await imgCache.keys()) { if (re.test(req.url)) await imgCache.delete(req); }
                const mediaCache = await caches.open(MEDIA_CACHE_NAME);
                const audioRe = new RegExp('/video/upload/t' + jilid + '_h');
                for (const req of await mediaCache.keys()) { if (audioRe.test(req.url)) await mediaCache.delete(req); }
            } catch (e) { console.warn('Gagal menghapus data offline:', e); }
            await refreshOfflineRow(jilid);
            refreshOfflineStorage();
            showToast('Data offline ' + getJilidFullLabel(jilid) + ' dihapus.');
        }

        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeOfflineManager(); closeInstallHelp(); } });

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

                ['login-screen', 'admin-login-screen', 'verify-screen', 'menu-screen', 'read-screen',
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
