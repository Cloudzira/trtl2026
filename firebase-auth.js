
        import { initializeApp } from "https://esm.sh/firebase@10.8.0/app";
        import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://esm.sh/firebase@10.8.0/auth?deps=@firebase/app@0.9.27";
        import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc, addDoc, onSnapshot, orderBy, serverTimestamp } from "https://esm.sh/firebase@10.8.0/firestore?deps=@firebase/app@0.9.27";
        
        const firebaseConfig = {
            apiKey: "AIzaSyDCkiYKe-lKkbb0czz9y9ZBGN9SgOhbjmw",
            authDomain: "tartili.firebaseapp.com",
            projectId: "tartili",
            storageBucket: "tartili.firebasestorage.app",
            messagingSenderId: "677535626906",
            appId: "1:677535626906:web:bc08dffdac958357e69123"
        };

        try {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            window.firebaseAuth = auth;
            window.firebaseDb = db;
            window.signInWithEmailAndPassword = signInWithEmailAndPassword;
            window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
            window.signOut = signOut;
            window.doc = doc;
            window.setDoc = setDoc;
            window.getDoc = getDoc;
            window.updateDoc = updateDoc;
            window.deleteDoc = deleteDoc;
            window.collection = collection;
            window.query = query;
            window.where = where;
            window.getDocs = getDocs;
            window.addDoc = addDoc;
            window.onSnapshot = onSnapshot;
            window.orderBy = orderBy;
            window.serverTimestamp = serverTimestamp;

            onAuthStateChanged(auth, async (user) => {
                const loginScreen = document.getElementById('login-screen');
                const adminLoginScreen = document.getElementById('admin-login-screen');
                const verifyScreen = document.getElementById('verify-screen');
                const menuScreen = document.getElementById('menu-screen');
                const readScreen = document.getElementById('read-screen');
                const bookmarksScreen = document.getElementById('bookmarks-screen');
                const adminScreen = document.getElementById('admin-screen');
                const teacherAdminScreen = document.getElementById('teacher-admin-screen');
                const classMembersScreen = document.getElementById('class-members-screen');

                if (user) {
                    try {
                        const userDocRef = doc(db, "users", user.uid);
                        const userSnap = await getDoc(userDocRef);
                        
                        if (userSnap.exists()) {
                            window.currentUserProfile = { uid: user.uid, ...userSnap.data() };
                        } else {
                            window.currentUserProfile = { 
                                uid: user.uid,
                                name: user.email.split('@')[0], 
                                role: user.email === 'awanproject70@gmail.com' ? 'Admin' : 'Siswa', 
                                classCode: '', 
                                isMasterApproved: user.email === 'awanproject70@gmail.com',
                                isTeacherApproved: true 
                            };
                        }

                        const profile = window.currentUserProfile;

                        // Setup real-time notifications for user
                        initRealtimeNotifications(user.uid, profile);

                        // Bypass Approval untuk Master Admin
                        if (user.email === 'awanproject70@gmail.com' || profile.role === 'Admin') {
                            await updateUserGreeting();
                            setupDashboardAccess();
                            hideAllScreens();
                            adminScreen.classList.add('active');
                            window.appState = 'admin';
                            await loadMasterPendingUsers();
                            return;
                        }

                        // Level 1 Check: Master Admin Approval
                        if (!profile.isMasterApproved) {
                            hideAllScreens();
                            verifyScreen.classList.add('active');
                            const verifyTitle = document.getElementById('verifyTitle');
                            const verifyDesc = document.getElementById('verifyEmailTarget');
                            if (verifyTitle) verifyTitle.innerText = "Menunggu Persetujuan Admin";
                            if (verifyDesc) verifyDesc.innerText = `Akun ${user.email} sedang menunggu verifikasi awal dari Admin.`;
                            window.appState = 'verify';
                            return;
                        }

                        // Level 2 Check: Teacher Approval for Students
                        if (profile.role === 'Siswa' && !profile.isTeacherApproved) {
                            hideAllScreens();
                            verifyScreen.classList.add('active');
                            const verifyTitle = document.getElementById('verifyTitle');
                            const verifyDesc = document.getElementById('verifyEmailTarget');
                            if (verifyTitle) verifyTitle.innerText = "Menunggu Persetujuan Guru";
                            if (verifyDesc) verifyDesc.innerText = `Akun Anda telah disetujui Admin Utama, namun sedang menunggu konfirmasi dari Guru (Kode Kelas ${profile.classCode || '-'}).`;
                            window.appState = 'verify';
                            return;
                        }

                        await updateUserGreeting();
                        setupDashboardAccess();

                        hideAllScreens();
                        const restoreRead = localStorage.getItem('tartili_active_screen') === 'read';
                        const lastRead = JSON.parse(localStorage.getItem('tartili_last_read') || 'null');
                        if (restoreRead && lastRead && lastRead.jilid && lastRead.page != null && typeof window.openJilid === 'function') {
                            window.openJilid(lastRead.jilid, lastRead.page);
                            return;
                        } else if (bookmarksScreen.classList.contains('active')) {
                            window.appState = 'bookmarks';
                        } else if (classMembersScreen.classList.contains('active')) {
                            window.appState = 'class-members';
                        } else {
                            menuScreen.classList.add('active');
                            window.appState = 'menu';
                            updateMenuCoverFocus();
                        }

                    } catch (err) {
                        console.error("Gagal memuat profil pengguna:", err);
                    }
                } else {
                    window.currentUserProfile = null;
                    if (window.unsubNotifications) window.unsubNotifications();
                    hideAllScreens();
                    loginScreen.classList.add('active');
                    window.appState = 'login';
                }
            });
        } catch (e) {
            console.error("Gagal memuat Firebase:", e);
        }

        function hideAllScreens() {
            ['login-screen', 'admin-login-screen', 'verify-screen', 'menu-screen', 'read-screen', 'bookmarks-screen', 'admin-screen', 'teacher-admin-screen', 'class-members-screen'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('active');
            });
        }

        // --- REALTIME NOTIFIKASI SITEM ---
        function initRealtimeNotifications(userId, profile) {
            if (window.unsubNotifications) window.unsubNotifications();
            
            // Catatan: query TIDAK memakai orderBy() supaya tidak perlu
            // composite index tambahan di Firestore. Urutan terbaru->terlama
            // dilakukan di JavaScript (lihat sort di bawah).
            const q = query(
                collection(window.firebaseDb, "notifications"),
                where("targetUserId", "in", [userId, "ALL_ADMINS", "ROLE_" + profile.role])
            );

            window.unsubNotifications = onSnapshot(q, (snapshot) => {
                let unreadCount = 0;
                const container = document.getElementById('notificationListContainer');
                if (container) container.innerHTML = "";

                if (snapshot.empty) {
                    if (container) container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px; font-size:12px;">Tidak ada notifikasi.</div>`;
                }

                const sortedDocs = snapshot.docs.slice().sort((a, b) => {
                    const ta = a.data().createdAt ? a.data().createdAt.toMillis() : 0;
                    const tb = b.data().createdAt ? b.data().createdAt.toMillis() : 0;
                    return tb - ta; // terbaru di atas
                });

                sortedDocs.forEach(docSnap => {
                    const data = docSnap.data();
                    const notifId = docSnap.id;

                    // Notifikasi setoran yang sudah dinilai lebih dari 24 jam
                    // dibersihkan otomatis (baik notifikasinya maupun dokumen
                    // setoran aslinya) -- tidak perlu tampil lagi di daftar.
                    if (data.actionUrl === 'setoran') {
                        cleanupExpiredSetoranNotif(notifId, data.setoranId);
                    }
                    // Notifikasi hasil penilaian untuk siswa juga disimpan
                    // 24 jam (dihitung sejak notifikasinya dibuat, karena
                    // itu persis waktu penilaian selesai dikirim guru).
                    if (data.actionUrl === 'setoran_hasil') {
                        cleanupExpiredHasilNotif(notifId, data.createdAt);
                    }

                    const isRead = data.readBy && data.readBy.includes(userId);
                    if (!isRead) unreadCount++;

                    if (container) {
                        const item = document.createElement('div');
                        item.className = `notif-item ${isRead ? 'read' : 'unread'}`;
                        item.onclick = () => markNotificationRead(notifId, userId, data);
                        item.innerHTML = `
                            <div style="font-weight:700; font-size:12px; color:var(--text-main); display:flex; justify-content:space-between;">
                                <span>${data.title}</span>
                                <span style="font-size:10px; opacity:0.7;">${data.createdAt ? new Date(data.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                            </div>
                            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${data.message}</div>
                        `;
                        container.appendChild(item);
                    }
                });

                // Update badge counter UI
                const badgeEl = document.getElementById('notifBadgeCount');
                if (badgeEl) {
                    if (unreadCount > 0) {
                        badgeEl.innerText = unreadCount > 9 ? '9+' : unreadCount;
                        badgeEl.style.display = 'flex';
                    } else {
                        badgeEl.style.display = 'none';
                    }
                }
            }, (err) => console.log("Notif snapshot info:", err));
        }

        // Membersihkan otomatis notifikasi + dokumen setoran yang SUDAH
        // DINILAI dan usianya (sejak dinilai) sudah lewat 24 jam. Dipanggil
        // tiap kali daftar notifikasi dirender (lihat listenForNotifications).
        const RETENSI_SETORAN_JAM = 24;
        async function cleanupExpiredSetoranNotif(notifId, setoranId) {
            try {
                const setoranSnap = await getDoc(doc(window.firebaseDb, "setoran", setoranId));
                if (!setoranSnap.exists()) {
                    // Dokumen aslinya sudah tidak ada (mis. dibersihkan dari
                    // sumber lain) -- notifikasinya ikut dibersihkan saja.
                    await deleteDoc(doc(window.firebaseDb, "notifications", notifId));
                    return;
                }
                const d = setoranSnap.data();
                if (d.status !== 'dinilai' || !d.gradedAt) return; // belum dinilai, biarkan

                const jamSejakDinilai = (Date.now() - d.gradedAt.toMillis()) / (1000 * 60 * 60);
                if (jamSejakDinilai >= RETENSI_SETORAN_JAM) {
                    await deleteDoc(doc(window.firebaseDb, "setoran", setoranId));
                    await deleteDoc(doc(window.firebaseDb, "notifications", notifId));
                }
            } catch (e) {
                console.log("Cleanup setoran info:", e);
            }
        }

        // Membersihkan otomatis notifikasi HASIL PENILAIAN untuk siswa
        // setelah 24 jam sejak dibuat (tidak perlu cek dokumen lain, karena
        // seluruh data hasil sudah tersisip langsung di notifikasinya).
        async function cleanupExpiredHasilNotif(notifId, createdAt) {
            try {
                if (!createdAt) return;
                const jamSejakDibuat = (Date.now() - createdAt.toMillis()) / (1000 * 60 * 60);
                if (jamSejakDibuat >= RETENSI_SETORAN_JAM) {
                    await deleteDoc(doc(window.firebaseDb, "notifications", notifId));
                }
            } catch (e) {
                console.log("Cleanup hasil info:", e);
            }
        }

        async function markNotificationRead(notifId, userId, data) {
            // Notifikasi setoran (rekaman siswa) MAUPUN hasil penilaian
            // (untuk siswa) SENGAJA TIDAK dihapus saat dibuka -- supaya
            // guru/siswa masih bisa membukanya lagi (dengar ulang / baca
            // ulang nilai & catatan) sampai akhirnya dibersihkan otomatis
            // 24 jam kemudian (lihat cleanupExpiredSetoranNotif() dan
            // cleanupExpiredHasilNotif()). Supaya tidak terus dihitung di
            // badge notifikasi merah, ditandai "sudah dibaca" saja (bukan
            // dihapus).
            if (data.actionUrl === 'setoran' || data.actionUrl === 'setoran_hasil') {
                try {
                    const notifRef = doc(window.firebaseDb, "notifications", notifId);
                    const readBy = data.readBy || [];
                    if (!readBy.includes(userId)) {
                        await updateDoc(notifRef, { readBy: [...readBy, userId] });
                    }
                } catch (e) {
                    console.error("Gagal menandai notifikasi terbaca:", e);
                }
            } else {
                try {
                    // Notifikasi lain yang sudah dibuka langsung DIHAPUS (bukan
                    // cuma ditandai terbaca), supaya daftar notifikasi bersih.
                    const notifRef = doc(window.firebaseDb, "notifications", notifId);
                    await deleteDoc(notifRef);
                } catch (e) {
                    console.error("Gagal menghapus notifikasi:", e);
                }
            }

            if (data.actionUrl === 'setoran') {
                toggleNotifModal(false);
                openSetoranReview(data.setoranId, notifId);
            } else if (data.actionUrl === 'setoran_hasil') {
                toggleNotifModal(false);
                lihatHasilSetoran(data);
            }
        }
        window.markNotificationRead = markNotificationRead;
    