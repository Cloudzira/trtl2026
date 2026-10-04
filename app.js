
        // CATATAN: Fitur cache offline (Service Worker) DIHAPUS karena
        // menyebabkan gangguan pada permintaan jaringan lain di aplikasi
        // (Firestore, gambar, audio setoran ikut gagal dimuat). Kode di
        // bawah ini secara aktif membersihkan Service Worker yang mungkin
        // sudah terpasang di browser pengguna dari versi sebelumnya.
        const TARTILI_PAGE_IMAGE_CACHE = 'tartili-page-images-v1';
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                registrations.forEach((reg) => reg.unregister());
            });
            if (window.caches) {
                caches.keys().then((names) => {
                    names.filter((name) => name !== TARTILI_PAGE_IMAGE_CACHE).forEach((name) => caches.delete(name));
                });
            }
        }

        const savedTheme = localStorage.getItem('tartili_theme') || 'light-theme';
        document.body.className = savedTheme;
        updateThemeToggleIcon();

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

        async function updateUserGreeting() {
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
            document.getElementById('menu-screen').classList.remove('active');
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
                    audioUrl: d.audioUrl,
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
                    `<iframe src="${d.audioUrl}" style="width:100%; height:44px; border:none;" allow="autoplay"></iframe>`;
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
                <iframe src="${data.audioUrl}" style="width:100%; height:44px; border:none; margin-bottom:12px;" allow="autoplay"></iframe>
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
        let savedBookmarks = JSON.parse(localStorage.getItem('tartili_bookmarks')) || [];
        
        let currentJilid = savedLastRead.jilid, currentPage = savedLastRead.page, appState = 'menu', selectedMenuCoverIndex = 0, currentAudio = null;
        let mediaRecorder, audioChunks = [], recordedAudioBlob = null; 
        let recordedAudioMimeType = 'audio/webm';
        let isPlayingRecording = false;
        let currentReviewSetoranId = null; // diisi saat guru meninjau 1 setoran lewat notifikasi
        
        const CLOUDINARY_BASE_URL = "https://res.cloudinary.com/ycfss0no";
        const LEGACY_MEDIA_BASE_URL = "https://xdicoipqprrkczagarra.supabase.co/storage/v1/object/public/media-tartili/allfiles/";
        const getPageImageUrl = (jilid, page) => {
            const pageId = /^\d+$/.test(String(page)) ? String(page).padStart(2, '0') : page;
            return `${CLOUDINARY_BASE_URL}/image/upload/t${jilid}_h${pageId}.jpg`;
        };
        const getPageAudioUrl = (jilid, page, soundFile) => {
            const soundId = String(soundFile).replace(/\.[^.]+$/, '');
            return `${CLOUDINARY_BASE_URL}/video/upload/t${jilid}_h${page}_${soundId}.mp3`;
        };
        let scale = 1, initialDistance = null;
        let pageLoadRequestId = 0, currentPageObjectUrl = null;
        let touchStartX = 0, touchEndX = 0;
        const minSwipeDistance = 50;

        const allAudioConfig = {
            "1": typeof tartili1Config !== 'undefined' ? tartili1Config : {},
            "2": typeof tartili2Config !== 'undefined' ? tartili2Config : {},
            "3": typeof tartili3Config !== 'undefined' ? tartili3Config : {},
            "4": typeof tartili4Config !== 'undefined' ? tartili4Config : {},
            "5": typeof tartili5Config !== 'undefined' ? tartili5Config : {},
            "6": typeof tartili6Config !== 'undefined' ? tartili6Config : {}
        };

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
            document.getElementById('menu-screen').classList.remove('active');
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
            localStorage.setItem('tartili_bookmarks', JSON.stringify(savedBookmarks));
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
            
            localStorage.setItem('tartili_bookmarks', JSON.stringify(savedBookmarks));
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

        function loadPageData() {
            if (currentAudio) { currentAudio.pause(); currentAudio = null; }
            resetRecording();
            
            localStorage.setItem('tartili_last_read', JSON.stringify({ jilid: currentJilid, page: currentPage }));
            updateBookmarkButtonState();

            const container = document.getElementById('imageContainer');
            const spinner = document.getElementById('loadingSpinner');
            const imgPath = getPageImageUrl(currentJilid, currentPage);
            const legacyImgPath = `${LEGACY_MEDIA_BASE_URL}tar${currentJilid}/halaman${currentPage}/halaman${currentPage}.jpg`;
            const requestId = ++pageLoadRequestId;

            if (currentPageObjectUrl) {
                URL.revokeObjectURL(currentPageObjectUrl);
                currentPageObjectUrl = null;
            }
            
            if (spinner) spinner.style.display = 'block';
            container.innerHTML = "";

            let img = new Image();
            img.alt = `Tartili jilid ${currentJilid}, halaman ${currentPage}`;
            img.onload = function() {
                if (requestId !== pageLoadRequestId) return;
                if (spinner) spinner.style.display = 'none';
                container.innerHTML = "";
                container.appendChild(img);

                if (allAudioConfig[currentJilid] && allAudioConfig[currentJilid][currentPage]) {
                    allAudioConfig[currentJilid][currentPage].forEach(block => {
                        let [top, left, width, height, soundFile] = block;
                        const soundBlock = document.createElement('div');
                        soundBlock.className = 'sound-block';
                        soundBlock.style.cssText = `top: ${top}%; left: ${left}%; width: ${width}%; height: ${height}%;`;
                        soundBlock.onclick = () => playSound(soundFile);
                        container.appendChild(soundBlock);
                    });
                }
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

                const cacheKey = new URL(imgPath, window.location.href).href;
                try {
                    const cache = await window.caches.open(TARTILI_PAGE_IMAGE_CACHE);
                    let response = await cache.match(cacheKey);
                    if (!response) {
                        response = await fetch(cacheKey);
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        await cache.put(cacheKey, response.clone());
                        const cachedPages = await cache.keys();
                        if (cachedPages.length > 12) {
                            await Promise.all(cachedPages.slice(0, cachedPages.length - 12).map((request) => cache.delete(request)));
                        }
                    }
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
            audioChunks = []; recordedAudioBlob = null;
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

            // Minta mikrofon dengan pengaturan kualitas suara TERBAIK untuk
            // MEREKAM (bukan untuk panggilan video). echoCancellation,
            // noiseSuppression, dan autoGainControl SENGAJA dimatikan --
            // ketiganya didesain untuk panggilan real-time, dan kalau
            // diaktifkan malah sering membuat suara terdengar "teredam"/
            // robotic di banyak HP & browser. Sample rate tetap dijaga
            // tinggi untuk kejernihan alami suara.
            const constraints = {
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
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
        // (lihat panduan di Code.gs). Kunci rahasia Filebase TIDAK ditaruh di sini,
        // supaya aman - kunci itu hanya ada di dalam Apps Script.
        const FILEBASE_UPLOAD_URL = "https://script.google.com/macros/s/AKfycbyq5eWrNHSbS6pnReJp-mzFU9MwIIqsztEJHZ06goB22iB99IGQbfTmWT6UVm04cbFK/exec";
        const FILEBASE_SECRET_KEY = "@awanawan"; // harus sama persis dengan SHARED_SECRET di Code.gs
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
            if (!recordedAudioBlob) { showToast('Belum ada rekaman untuk dikirim.'); return; }
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
                const fileExt = recordedAudioMimeType.includes('mp4') ? 'm4a' : recordedAudioMimeType.includes('ogg') ? 'ogg' : 'webm';
                const fileName = `${profile.uid}_${Date.now()}.${fileExt}`;
                const base64Audio = await blobToBase64(recordedAudioBlob);

                const uploadRes = await fetch(FILEBASE_UPLOAD_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // hindari preflight CORS di Apps Script
                    body: JSON.stringify({
                        secret: FILEBASE_SECRET_KEY,
                        audioBase64: base64Audio,
                        fileName: fileName,
                        mimeType: recordedAudioMimeType
                    })
                });
                const uploadData = await uploadRes.json();
                if (!uploadData.success) throw new Error(uploadData.error || 'Upload gagal');

                showUploadingOverlay('Menyimpan data setoran...');

                // Filebase bucket bersifat privat, jadi pemutaran audio TIDAK
                // memakai URL Filebase langsung, melainkan lewat Apps Script
                // (doGet) yang mengambilkan filenya secara aman.
                const audioUrl = `${FILEBASE_UPLOAD_URL}?key=${encodeURIComponent(uploadData.key)}&secret=${encodeURIComponent(FILEBASE_SECRET_KEY)}`;

                const setoranRef = await window.addDoc(window.collection(window.firebaseDb, "setoran"), {
                    studentUid: profile.uid,
                    studentName: profile.name || 'Siswa',
                    classCode: profile.classCode,
                    jilid: currentJilid,
                    halaman: currentPage,
                    audioUrl: audioUrl,
                    storagePath: fileName,
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
                showToast('Gagal mengirim rekaman. Coba lagi.');
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
