
        // ===== SERVICE WORKER (offline) =====
        // Service Worker baru (sw.js) bersifat TERBATAS: hanya mengurus berkas
        // aplikasi, modul Firebase/font, sampul, dan audio. Firestore, login, dan
        // upload setoran tidak disentuh sama sekali.
        const TARTILI_PAGE_IMAGE_CACHE = 'tartili-page-images-v3';   // cache sementara (24 halaman terakhir)
        const OFFLINE_IMAGE_CACHE = 'tartili-offline-pages-v2';      // halaman yang diunduh permanen untuk offline
        const MEDIA_CACHE_NAME = 'tartili-media-v1';                 // audio (sama dengan yang dipakai sw.js)
        if ('serviceWorker' in navigator) {
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

        const savedTheme = localStorage.getItem('tartili_theme') || 'light-theme';
        document.body.className = savedTheme;
        updateOnlineStatus(false);
        updateThemeToggleIcon();

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

        function toggleTheme() {
            if (document.body.classList.contains('light-theme')) {
                document.body.className = 'dark-theme';
                localStorage.setItem('tartili_theme', 'dark-theme');
            } else {
                document.body.className = 'light-theme';
                localStorage.setItem('tartili_theme', 'light-theme');
            }
            updateThemeToggleIcon();
            showToast(document.body.classList.contains('dark-theme') ? 'Mode Gelap diaktifkan' : 'Mode Terang diaktifkan');
        }

        function updateThemeToggleIcon() {
            const btn = document.querySelector('.btn-theme-toggle');
            if (btn) {
                const isDark = document.body.classList.contains('dark-theme');
                if (isDark) {
                    btn.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
                } else {
                    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
                }
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

            if (profile.role === 'Guru') {
                if (classEl) classEl.innerText = `Kelas ${profile.teacherClassName}`;
                if (teacherNameEl) teacherNameEl.style.display = 'none';
            } else {
                if (classEl) classEl.innerText = `Kelas Memuat...`;
                if (teacherNameEl) {
                    teacherNameEl.style.display = 'inline';
                    teacherNameEl.innerText = "Guru: Memuat...";
                    try {
                        const q = window.query(window.collection(window.firebaseDb, "users"), window.where("role", "==", "Guru"), window.where("classCode", "==", profile.classCode));
                        const snap = await window.getDocs(q);
                        if (!snap.empty) {
                            const teacherData = snap.docs[0].data();
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

        function setupDashboardAccess() {
            const btnMaster = document.getElementById('btnMasterAdminPanel');
            const btnTeacher = document.getElementById('btnTeacherPanel');
            if (!btnMaster || !btnTeacher) return;

            const profile = window.currentUserProfile;
            const isMaster = profile.email === 'awanproject70@gmail.com' || profile.role === 'Admin';

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
        }

        // --- MASTER ADMIN PANEL ---
        async function openMasterAdminScreen() {
            appState = 'admin';
            document.getElementById('menu-screen').classList.remove('active');
            document.getElementById('admin-screen').classList.add('active');
            await loadMasterPendingUsers();
        }

        async function loadMasterPendingUsers() {
            const container = document.getElementById('pendingMasterUsersContainer');
            if (!container) return;
            container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px;">Memuat data pendaftar...</div>`;

            try {
                const q = window.query(window.collection(window.firebaseDb, "users"), window.where("isMasterApproved", "==", false));
                const querySnapshot = await window.getDocs(q);
                
                container.innerHTML = "";
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
                            <div style="font-weight: 700; font-size: 13px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.name} <span class="badge-role" style="margin-left: 6px;">${data.role}</span></div>
                            <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Email: ${data.email}</div>
                            <div style="font-size: 10px; color: var(--text-muted);">${data.role === 'Guru' ? 'Kelas ' + data.teacherClassName : 'Kode Kelas ' + (data.classCode || '-')}</div>
                        </div>
                        <div style="display: flex; gap: 6px; flex-shrink: 0;">
                            <button onclick="approveMasterUser('${userId}')" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 11px; cursor: pointer;">Setujui</button>
                            <button onclick="deleteUserAccount('${userId}', '${data.name}')" style="background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 6px 10px; border-radius: 8px; font-weight: 700; font-size: 11px; cursor: pointer;" title="Tolak / Hapus">Hapus</button>
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
                            <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">${data.name}</div>
                            <div style="font-size: 11px; color: var(--text-muted);">Email: ${data.email}</div>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button onclick="approveStudent('${userId}')" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 11px; cursor: pointer;">Terima</button>
                            <button onclick="deleteUserAccount('${userId}', '${data.name}')" style="background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 6px 10px; border-radius: 8px; font-weight: 700; font-size: 11px; cursor: pointer;">Tolak</button>
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
                                <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">👨‍🏫 ${tData.name} <span class="badge-role" style="margin-left: 6px;">Guru Pengampu</span></div>
                                <div style="font-size: 11px; color: var(--text-muted);">Email: ${tData.email}</div>
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
                            <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">👤 ${sData.name}</div>
                            <div style="font-size: 11px; color: var(--text-muted);">Email: ${sData.email}</div>
                        </div>
                        <div style="display:flex; gap:6px; align-items:center;">
                            <span style="font-size: 10px; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.12); padding: 3px 8px; border-radius: 6px;">Aktif</span>
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
                    message: `Guru telah menilai setoran Jilid ${d.jilid} Hal. ${d.halaman} Anda.`,
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
                <div style="font-size:13px; color:var(--text-muted); margin-bottom:8px;">Jilid ${data.jilid} • Halaman ${data.halaman}</div>
                ${setoranPlayerHtml(data, 'margin-bottom:12px;')}
                <div style="font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:2px;">Nilai</div>
                <div style="font-size:22px; font-weight:800; color:var(--accent-solid); margin-bottom:12px;">${data.nilai != null ? data.nilai : '-'}</div>
                <div style="font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:2px;">Catatan Guru</div>
                <div style="font-size:13px; color:var(--text-main); background:var(--input-bg); padding:10px; border-radius:10px;">${data.feedback || 'Tidak ada catatan.'}</div>
            `;
            document.getElementById('hasilSetoranModal').classList.add('active');
        }
        window.lihatHasilSetoran = lihatHasilSetoran;

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
        const getPageImageUrl = (jilid, page) => {
            const pageId = /^\d+$/.test(String(page)) ? String(page).padStart(2, '0') : page;
            if (isImageTransformDisabled()) return getPlainPageImageUrl(jilid, page);
            return getTransformedPageImageUrl(jilid, page);
        };
        const getTransformedPageImageUrl = (jilid, page) => {
            const pageId = /^\d+$/.test(String(page)) ? String(page).padStart(2, '0') : page;
            return `${CLOUDINARY_BASE_URL}/image/upload/${PAGE_IMAGE_TRANSFORM}/t${jilid}_h${pageId}.jpg`;
        };
        // Semua kemungkinan kunci cache untuk satu halaman (URL sekarang, bertransformasi, polos)
        const getPageImageKeys = (jilid, page) =>
            Array.from(new Set([getPageImageUrl(jilid, page), getTransformedPageImageUrl(jilid, page), getPlainPageImageUrl(jilid, page)]));
        const normalizePageId = (page) => /^\d+$/.test(String(page)) ? String(page).padStart(2, '0') : String(page);
        // URL tanpa transformasi (gambar asli di Cloudinary)
        const getPlainPageImageUrl = (jilid, page) => {
            const pageId = /^\d+$/.test(String(page)) ? String(page).padStart(2, '0') : page;
            return `${CLOUDINARY_BASE_URL}/image/upload/t${jilid}_h${pageId}.jpg`;
        };
        const getLegacyPageImageUrl = (jilid, page) =>
            `${LEGACY_MEDIA_BASE_URL}tar${jilid}/halaman${page}/halaman${page}.jpg`;
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
        // DIBUTUHKAN saja, bukan keenam-enamnya di awal.
        const allAudioConfig = { "1": null, "2": null, "3": null, "4": null, "5": null, "6": null };
        const jilidConfigPromises = {};

        function readLoadedJilidConfig(jilid) {
            switch (String(jilid)) {
                case '1': return typeof tartili1Config !== 'undefined' ? tartili1Config : null;
                case '2': return typeof tartili2Config !== 'undefined' ? tartili2Config : null;
                case '3': return typeof tartili3Config !== 'undefined' ? tartili3Config : null;
                case '4': return typeof tartili4Config !== 'undefined' ? tartili4Config : null;
                case '5': return typeof tartili5Config !== 'undefined' ? tartili5Config : null;
                case '6': return typeof tartili6Config !== 'undefined' ? tartili6Config : null;
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
                            <span class="bookmark-item-title">Tartili Jilid ${b.jilid}</span>
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
            for (let i = 0; i < 6; i++) {
                let btn = document.getElementById('cover-btn-' + i);
                if (btn) {
                    if (i === selectedMenuCoverIndex) btn.classList.add('keyboard-focused');
                    else btn.classList.remove('keyboard-focused');
                }
            }
        }

        function getNumericPageList(jilid) {
            let list = [], max = (jilid === 6) ? 48 : 44;
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

        // Memastikan gambar halaman ada di cache. Urutan percobaan:
        //   1) Cloudinary dengan transformasi (WebP kecil)
        //   2) Cloudinary gambar asli
        //   3) Server cadangan (Supabase)
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
                const plain = getPlainPageImageUrl(jilid, page);
                const candidates = [key];
                if (plain !== key) candidates.push(plain);
                candidates.push(getLegacyPageImageUrl(jilid, page));

                let lastError = null;
                for (let i = 0; i < candidates.length; i++) {
                    try {
                        const res = await fetch(candidates[i]);
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        await target.put(key, res.clone());
                        // Transformasi gagal tapi gambar asli berhasil -> matikan transformasi
                        if (i === 1 && candidates[1] === plain && key !== plain) {
                            try { localStorage.setItem('tartili_img_transform_off', '1'); } catch (e) {}
                        }
                        if (!persist) trimPageCache(normalCache);
                        return;
                    } catch (err) {
                        lastError = err;
                    }
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
            const legacyImgPath = getLegacyPageImageUrl(currentJilid, currentPage);
            const requestId = ++pageLoadRequestId;
            loadJilidConfig(currentJilid); // mulai muat data suara paralel dengan gambar

            if (currentPageObjectUrl) {
                URL.revokeObjectURL(currentPageObjectUrl);
                currentPageObjectUrl = null;
            }
            
            if (spinner) spinner.style.display = 'block';
            container.innerHTML = "";

            let img = new Image();
            img.draggable = false;
            img.alt = `Tartili jilid ${currentJilid}, halaman ${currentPage}`;
            img.onload = function() {
                if (requestId !== pageLoadRequestId) return;
                if (spinner) spinner.style.display = 'none';
                container.innerHTML = "";
                container.appendChild(img);

                const blocksJilid = currentJilid;
                const blocksPage = currentPage;
                loadJilidConfig(blocksJilid).then((cfg) => {
                    if (requestId !== pageLoadRequestId) return;
                    const blocks = cfg && cfg[blocksPage];
                    if (!blocks) return;
                    blocks.forEach(block => {
                        let [top, left, width, height, soundFile] = block;
                        const soundBlock = document.createElement('div');
                        soundBlock.className = 'sound-block';
                        soundBlock.style.cssText = `top: ${top}%; left: ${left}%; width: ${width}%; height: ${height}%;`;
                        soundBlock.onclick = () => playSound(soundFile);
                        container.appendChild(soundBlock);
                    });
                });

                schedulePrefetchNeighbors(requestId);
            };
            img.onerror = function() {
                if (requestId !== pageLoadRequestId) return;
                if (!img.dataset.legacyFallbackTried) {
                    img.dataset.legacyFallbackTried = 'true';
                    img.src = legacyImgPath;
                    return;
                }
                if (spinner) spinner.style.display = 'none';
                container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444;font-size:13px;">Gagal memuat halaman</div>`;
            };

            const loadCachedImage = async () => {
                if (!window.caches) return imgPath;
                try {
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

            document.getElementById('jumpJilidRead').value = currentJilid;
            let numList = getNumericPageList(currentJilid);
            if (numList.includes(currentPage.toString())) { 
                document.getElementById('jumpPageSelectRead').value = currentPage; 
            }
        }

        function playSound(soundFile) {
            if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
            const soundPath = getPageAudioUrl(currentJilid, currentPage, soundFile);
            const legacySoundPath = `${LEGACY_MEDIA_BASE_URL}tar${currentJilid}/halaman${currentPage}/${soundFile}`;
            currentAudio = new Audio(soundPath);
            currentAudio.addEventListener('error', function fallbackToLegacyAudio() {
                if (currentAudio.src !== soundPath) return;
                currentAudio.src = legacySoundPath;
                currentAudio.play();
            }, { once: true });
            currentAudio.play();
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
        const FILEBASE_UPLOAD_URL = "https://script.google.com/macros/s/AKfycbyq5eWrNHSbS6pnReJp-mzFU9MwIIqsztEJHZ06goB22iB99IGQbfTmWT6UVm04cbFK/exec";
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

                showUploadingOverlay('Mengirim notifikasi ke guru...');

                // Cari guru pemilik kelas ini untuk dikirimi notifikasi
                const qTeacher = window.query(
                    window.collection(window.firebaseDb, "users"),
                    window.where("role", "==", "Guru"),
                    window.where("classCode", "==", profile.classCode)
                );
                const teacherSnap = await window.getDocs(qTeacher);
                for (const tDoc of teacherSnap.docs) {
                    await window.addDoc(window.collection(window.firebaseDb, "notifications"), {
                        targetUserId: tDoc.id,
                        title: "🎙️ Setoran Bacaan Baru",
                        message: `${profile.name || 'Siswa'} (Kelas ${profile.classCode}) mengirim rekaman Jilid ${currentJilid} - Hal. ${currentPage}.`,
                        senderId: profile.uid,
                        senderName: profile.name || 'Siswa',
                        actionUrl: 'setoran',
                        setoranId: setoranRef.id,
                        createdAt: window.serverTimestamp(),
                        readBy: []
                    });
                }

                showToast('Rekaman berhasil dikirim ke guru!');
                resetRecording();
            } catch (e) {
                console.error(e);
                showToast(e && e.fromServer ? e.message : 'Gagal mengirim rekaman. Coba lagi.');
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
        const OFFLINE_JILID_LIST = [1, 2, 3, 4, 5, 6];

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
            const cachedPageIds = new Set();
            const imgRe = new RegExp('/t' + jilid + '_h([^/.]+)\\.jpg');
            (await imgCache.keys()).forEach((req) => {
                const m = req.url.match(imgRe);
                if (m) cachedPageIds.add(m[1]);
            });
            const mediaCache = await caches.open(MEDIA_CACHE_NAME);
            const cachedAudio = new Set((await mediaCache.keys()).map((r) => r.url));
            return {
                pagesTotal: pages.length,
                pagesDone: pages.filter((p) => cachedPageIds.has(normalizePageId(p))).length,
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
                        '<div class="offline-row-title">Jilid ' + j + '</div>' +
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
            if (!confirm('Unduh Jilid ' + jilid + ' untuk dibaca tanpa internet?\n\nSemua halaman dan suara jilid ini akan disimpan di perangkat dan memakai data internet. Disarankan memakai Wi-Fi.')) return;

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
            else showToast('Jilid ' + jilid + ' siap dipakai offline.');
        }

        async function deleteJilidOffline(jilid) {
            if (offlineDownloads[jilid]) return;
            if (!confirm('Hapus data offline Jilid ' + jilid + ' dari perangkat ini?')) return;
            try {
                const imgCache = await caches.open(OFFLINE_IMAGE_CACHE);
                const re = new RegExp('/t' + jilid + '_h');
                for (const req of await imgCache.keys()) { if (re.test(req.url)) await imgCache.delete(req); }
                const mediaCache = await caches.open(MEDIA_CACHE_NAME);
                const audioRe = new RegExp('/video/upload/t' + jilid + '_h');
                for (const req of await mediaCache.keys()) { if (audioRe.test(req.url)) await mediaCache.delete(req); }
            } catch (e) { console.warn('Gagal menghapus data offline:', e); }
            await refreshOfflineRow(jilid);
            refreshOfflineStorage();
            showToast('Data offline Jilid ' + jilid + ' dihapus.');
        }

        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeOfflineManager(); closeInstallHelp(); } });
