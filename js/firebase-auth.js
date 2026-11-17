/* =====================================================================
   TartiliKu - Firebase: Inisialisasi, Login, Notifikasi Realtime
   Berkas : js/firebase-auth.js  (modul ES, dimuat di <head> dengan type="module")
   Tugas  : Menyiapkan Firebase (Auth + Firestore), memantau status login,
            mengatur layar sesuai peran (admin/guru/siswa), dan notifikasi
            realtime setoran/penilaian. Fungsi penting dipasang ke `window`
            supaya bisa dipakai oleh skrip biasa (app.js dan modul lainnya).
   ===================================================================== */

import { initializeApp } from "https://esm.sh/firebase@10.8.0/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://esm.sh/firebase@10.8.0/auth?deps=@firebase/app@0.9.27";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc, addDoc, onSnapshot, orderBy, serverTimestamp } from "https://esm.sh/firebase@10.8.0/firestore?deps=@firebase/app@0.9.27";

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
    // Cache offline Firestore: data yang pernah dibuka (profil, penanda halaman, dll.)
    // tetap terbaca saat tidak ada internet. Kalau browser tidak mendukung,
    // otomatis kembali ke cara biasa.
    let db;
    try {
        db = initializeFirestore(app, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        });
    } catch (e) {
        console.warn('Cache offline Firestore tidak aktif:', e);
        db = getFirestore(app);
    }

    window.firebaseAuth = auth;
    window.firebaseDb = db;
    window.signOut = signOut;
    window.GoogleAuthProvider = GoogleAuthProvider;
    window.signInWithPopup = signInWithPopup;
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
        const verifyScreen = document.getElementById('verify-screen');
        const menuScreen = document.getElementById('menu-screen');
        const readScreen = document.getElementById('read-screen');
        const bookmarksScreen = document.getElementById('bookmarks-screen');
        const adminScreen = document.getElementById('admin-screen');
        const teacherAdminScreen = document.getElementById('teacher-admin-screen');
        const classMembersScreen = document.getElementById('class-members-screen');

        if (user) {
            // Hanya akun Google yang diterima. Sesi lama dari login email/kata sandi
            // dikeluarkan, lalu pengguna diminta masuk dengan Google.
            const viaGoogle = (user.providerData || []).some((p) => p.providerId === 'google.com');
            if (!viaGoogle) {
                try { await signOut(auth); } catch (e) { /* abaikan */ }
                try { sessionStorage.setItem('tartili_login_notice', 'Masuk dengan email dan kata sandi sudah tidak dipakai. Silakan masuk dengan akun Google.'); } catch (e) { /* abaikan */ }
                return;
            }
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userDocRef);

                if (userSnap.exists()) {
                    window.currentUserProfile = { uid: user.uid, ...userSnap.data() };
                } else {
                    // Akun Google yang baru pertama kali masuk (belum punya profil TartiliKu):
                    // minta pengguna melengkapi pendaftaran (nama, peran, kode kelas).
                    const isGoogleUser = (user.providerData || []).some((p) => p.providerId === 'google.com');
                    if (isGoogleUser && user.email !== 'awanproject70@gmail.com') {
                        window.currentUserProfile = null;
                        window.__instantShown = false;
                        window.__pendingGoogleUser = { uid: user.uid, email: user.email, name: user.displayName || '' };
                        hideAllScreens();
                        const gcScreen = document.getElementById('google-complete-screen');
                        const gcEmail = document.getElementById('gcEmail');
                        const gcName = document.getElementById('gcName');
                        if (gcEmail) gcEmail.textContent = user.email;
                        if (gcName && !gcName.value) gcName.value = user.displayName || '';
                        if (gcScreen) gcScreen.classList.add('active');
                        return;
                    }
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
                if (typeof window.loadBookmarksForUser === 'function') {
                    window.loadBookmarksForUser(user.uid, profile.role);
                }

                // Setup real-time notifications for user
                initRealtimeNotifications(user.uid, profile);

                // Master Admin: tanpa persetujuan, langsung ke menu (sama seperti Siswa & Guru).
                // Persetujuan pendaftar baru ada di popup pada kartu sapaan.
                if (user.email === 'awanproject70@gmail.com' || profile.role === 'Admin') {
                    await updateUserGreeting();
                    setupDashboardAccess();
                    if (typeof window.refreshAdminPendingBadge === 'function') window.refreshAdminPendingBadge();
                    window.__instantShown = false;
                    hideAllScreens();
                    const adminRestoreRead = localStorage.getItem('tartili_active_screen') === 'read';
                    const adminLastRead = JSON.parse(localStorage.getItem('tartili_last_read') || 'null');
                    if (adminRestoreRead && adminLastRead && adminLastRead.jilid && adminLastRead.page != null && typeof window.openJilid === 'function') {
                        window.openJilid(adminLastRead.jilid, adminLastRead.page);
                    } else {
                        menuScreen.classList.add('active');
                        window.appState = 'menu';
                        updateMenuCoverFocus();
                    }
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

                // Simpan salinan profil di perangkat supaya buka aplikasi berikutnya langsung
                // menampilkan menu tanpa menunggu pemuatan Firebase.
                try {
                    localStorage.setItem('tartili_profile_cache', JSON.stringify({
                        uid: user.uid,
                        savedAt: Date.now(),
                        profile: {
                            name: profile.name || '',
                            role: profile.role,
                            classCode: profile.classCode || '',
                            teacherClassName: profile.teacherClassName || '',
                            isMasterApproved: true,
                            isTeacherApproved: true
                        }
                    }));
                } catch (e) { /* abaikan */ }

                await updateUserGreeting();
                setupDashboardAccess();

                // Layar sudah tampil dari salinan profil (mulai instan) dan akunnya sama:
                // cukup perbarui data, tidak perlu berpindah layar lagi.
                if (window.__instantShown && window.__instantUid === user.uid &&
                    (menuScreen.classList.contains('active') || readScreen.classList.contains('active'))) {
                    window.__instantShown = false;
                    return;
                }
                window.__instantShown = false;

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
            window.__instantShown = false;
            try { localStorage.removeItem('tartili_profile_cache'); } catch (e) { /* abaikan */ }
            if (typeof window.loadBookmarksForUser === 'function') {
                window.loadBookmarksForUser(null);
            }
            if (window.unsubNotifications) window.unsubNotifications();
            notifVisible = [];
            updateNotifIndicators(0);
            hideAllScreens();
            loginScreen.classList.add('active');
            window.appState = 'login';
            try {
                const notice = sessionStorage.getItem('tartili_login_notice');
                if (notice) {
                    sessionStorage.removeItem('tartili_login_notice');
                    const errEl = document.getElementById('loginError');
                    if (errEl) { errEl.innerText = notice; errEl.style.display = 'block'; }
                }
            } catch (e) { /* abaikan */ }
        }
    });
} catch (e) {
    console.error("Gagal memuat Firebase:", e);
}

function hideAllScreens() {
    ['login-screen', 'google-complete-screen', 'verify-screen', 'menu-screen', 'read-screen', 'bookmarks-screen', 'admin-screen', 'teacher-admin-screen', 'class-members-screen'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
}

// --- REALTIME NOTIFIKASI ---
// Fitur: daftar bertanda jenis & waktu relatif, tandai semua dibaca, bersihkan yang
// sudah dibaca, notifikasi perangkat (saat aplikasi terbuka/di latar), lencana ikon
// aplikasi, dan judul tab "(n)". Hanya notifikasi BARU (setelah muat awal) yang
// memunculkan pemberitahuan, jadi tidak ada banjir notifikasi saat membuka aplikasi.
let notifVisible = [];   // salinan daftar yang sedang tampil (untuk "tandai semua dibaca")
const BASE_TITLE = document.title;

const NOTIF_TYPES = {
    setoran:          { tag: 'Setoran',   cls: 'nt-setoran' },
    setoran_hasil:    { tag: 'Hasil',     cls: 'nt-hasil' },
    'admin-approval': { tag: 'Pendaftar', cls: 'nt-daftar' },
    'teacher-approval': { tag: 'Pendaftar', cls: 'nt-daftar' }
};

function notifTimeLabel(ts) {
    if (!ts) return '';
    const d = ts.toDate();
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return diffMin + ' mnt lalu';
    const jam = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const hariLalu = Math.round((start(new Date()) - start(d)) / 86400000);
    if (hariLalu === 0) return jam;
    if (hariLalu === 1) return 'Kemarin ' + jam;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + jam;
}

function updateNotifIndicators(unread) {
    const badgeEl = document.getElementById('notifBadgeCount');
    if (badgeEl) {
        if (unread > 0) { badgeEl.innerText = unread > 9 ? '9+' : unread; badgeEl.style.display = 'flex'; }
        else badgeEl.style.display = 'none';
    }
    const chip = document.getElementById('notifCountChip');
    if (chip) { chip.innerText = unread; chip.style.display = unread > 0 ? 'inline-block' : 'none'; }
    document.title = unread > 0 ? `(${unread}) ${BASE_TITLE}` : BASE_TITLE;
    try {
        if (unread > 0 && navigator.setAppBadge) navigator.setAppBadge(unread);
        else if (navigator.clearAppBadge) navigator.clearAppBadge();
    } catch (e) { /* abaikan */ }
}

// Pemberitahuan di perangkat (butuh izin). Lewat Service Worker agar tetap jalan di PWA.
async function showDeviceNotification(title, body, tag) {
    try {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const opts = { body: body, tag: tag, icon: 'icon-192.png', badge: 'icon-192.png', renotify: false };
        const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
        if (reg && reg.showNotification) await reg.showNotification(title, opts);
        else new Notification(title, opts);
    } catch (e) { console.log('Notifikasi perangkat info:', e); }
}

function renderNotifPermBanner() {
    const box = document.getElementById('notifPermBanner');
    if (!box) return;
    if (!('Notification' in window)) { box.style.display = 'none'; return; }
    if (Notification.permission === 'default') {
        box.style.display = 'flex';
        box.innerHTML = '<span>Aktifkan agar setoran &amp; hasil penilaian muncul sebagai pemberitahuan di perangkat.</span><button type="button" onclick="enableDeviceNotifications()">Aktifkan</button>';
    } else if (Notification.permission === 'denied') {
        box.style.display = 'flex';
        box.innerHTML = '<span>Pemberitahuan perangkat diblokir. Izinkan lewat pengaturan situs di browser.</span>';
    } else {
        box.style.display = 'none';
    }
}
async function enableDeviceNotifications() {
    try { await Notification.requestPermission(); } catch (e) { /* abaikan */ }
    renderNotifPermBanner();
    if (Notification.permission === 'granted' && typeof showToast === 'function') showToast('Notifikasi perangkat aktif.');
}
window.enableDeviceNotifications = enableDeviceNotifications;
window.renderNotifPermBanner = renderNotifPermBanner;

function initRealtimeNotifications(userId, profile) {
    if (window.unsubNotifications) window.unsubNotifications();
    renderNotifPermBanner();

    // Catatan: query TIDAK memakai orderBy() supaya tidak perlu composite index.
    // Urutan terbaru->terlama dilakukan di JavaScript.
    // "ALL_ADMINS" HANYA untuk admin; "CLASS_<kode>" HANYA untuk guru kelas itu.
    const notifCol = collection(window.firebaseDb, "notifications");
    const authUser = window.firebaseAuth && window.firebaseAuth.currentUser;
    const isAdminUser = profile.role === 'Admin' ||
        (authUser && authUser.email === 'awanproject70@gmail.com');

    let lastNotifSig = null;
    let initialized = false;            // muat awal selesai -> notifikasi berikutnya dianggap "baru"
    const seen = new Set();
    notifVisible = [];

    const handleSnapshot = (snapshot, ready) => {
        const sortedDocs = snapshot.docs.slice().sort((a, b) => {
            const ta = a.data().createdAt ? a.data().createdAt.toMillis() : 0;
            const tb = b.data().createdAt ? b.data().createdAt.toMillis() : 0;
            return tb - ta; // terbaru di atas
        });

        // Hasil penilaian yang sudah lewat 24 jam tidak ditampilkan lagi; pembersihan
        // dicoba SEKALI per notifikasi agar tidak terjadi perulangan yang membuat daftar berkedip.
        const nowMs = Date.now();
        const isExpiredHasil = (d) => d.actionUrl === 'setoran_hasil' && d.createdAt &&
            (nowMs - d.createdAt.toMillis()) / (1000 * 60 * 60) >= RETENSI_SETORAN_JAM;
        sortedDocs.forEach((ds) => {
            const d = ds.data();
            if (d.actionUrl === 'setoran') cleanupExpiredSetoranNotif(ds.id, d.setoranId);
            if (d.actionUrl === 'setoran_hasil') cleanupExpiredHasilNotif(ds.id, d.createdAt);
        });
        const visibleDocs = sortedDocs.filter((ds) => !isExpiredHasil(ds.data()));

        // Isi daftar tidak berubah -> tidak perlu menggambar ulang (mencegah berkedip)
        const sig = visibleDocs.map((ds) => ds.id + ':' + (((ds.data().readBy || []).includes(userId)) ? 1 : 0)).join('|');
        if (sig === lastNotifSig) return;
        lastNotifSig = sig;
        notifVisible = visibleDocs;

        // Deteksi notifikasi baru (bukan muat awal, bukan tulisan lokal sendiri)
        if (ready) {
            if (!initialized) {
                visibleDocs.forEach((ds) => seen.add(ds.id));
                initialized = true;
            } else {
                const fresh = visibleDocs.filter((ds) => {
                    if (seen.has(ds.id)) return false;
                    seen.add(ds.id);
                    const d = ds.data();
                    return !ds.metadata.hasPendingWrites && d.createdAt && !(d.readBy || []).includes(userId);
                });
                if (fresh.length) {
                    const d = fresh[0].data();
                    const judul = fresh.length > 1 ? `${fresh.length} notifikasi baru` : d.title;
                    const isi = fresh.length > 1 ? 'Buka TartiliKu untuk melihatnya.' : d.message;
                    if (typeof showToast === 'function') showToast('🔔 ' + judul);
                    if (document.visibilityState !== 'visible') showDeviceNotification(judul, isi, 'tartili-' + fresh[0].id);
                }
            }
        }

        let unreadCount = 0;
        const container = document.getElementById('notificationListContainer');
        if (container) container.innerHTML = "";

        if (visibleDocs.length === 0 && container) {
            container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:28px 20px; font-size:12px;">Tidak ada notifikasi.</div>`;
        }
        const esc = window.riwayatEsc || String;

        visibleDocs.forEach(docSnap => {
            const data = docSnap.data();
            const notifId = docSnap.id;
            const isRead = data.readBy && data.readBy.includes(userId);
            if (!isRead) unreadCount++;

            if (container) {
                const type = NOTIF_TYPES[data.actionUrl] || { tag: 'Info', cls: 'nt-info' };
                const item = document.createElement('div');
                item.className = `notif-item ${isRead ? 'read' : 'unread'}`;
                item.onclick = () => markNotificationRead(notifId, userId, data);
                item.innerHTML = `
                    <div class="notif-row">
                        <span class="notif-tag ${type.cls}">${type.tag}</span>
                        <span class="notif-time">${notifTimeLabel(data.createdAt)}</span>
                    </div>
                    <div class="notif-title">${esc(data.title)}</div>
                    <div class="notif-msg">${esc(data.message)}</div>`;
                container.appendChild(item);
            }
        });

        const toolbar = document.getElementById('notifToolbar');
        if (toolbar) toolbar.style.display = visibleDocs.length ? 'flex' : 'none';
        updateNotifIndicators(unreadCount);
    };

    const onNotifError = (err) => console.log("Notif snapshot info:", err);

    const sharedTargets = [];
    if (isAdminUser) sharedTargets.push("ALL_ADMINS");
    if (profile.role === 'Guru' && profile.classCode) sharedTargets.push("CLASS_" + profile.classCode);

    if (sharedTargets.length) {
        // Notifikasi pribadi + notifikasi bersama (beberapa listener, digabung).
        // "ready" baru true setelah SEMUA listener menjawab sekali.
        let ownDocs = [];
        const sharedDocs = {};
        const answered = new Set();
        const total = 1 + sharedTargets.length;
        const emit = () => {
            let docs = ownDocs.slice();
            sharedTargets.forEach(tg => { docs = docs.concat(sharedDocs[tg] || []); });
            handleSnapshot({ empty: docs.length === 0, docs: docs }, answered.size >= total);
        };
        const unsubs = [];
        unsubs.push(onSnapshot(query(notifCol, where("targetUserId", "==", userId)),
            (snap) => { ownDocs = snap.docs; answered.add('own'); emit(); }, onNotifError));
        sharedTargets.forEach(tg => {
            unsubs.push(onSnapshot(query(notifCol, where("targetUserId", "==", tg)),
                (snap) => { sharedDocs[tg] = snap.docs; answered.add(tg); emit(); }, onNotifError));
        });
        window.unsubNotifications = () => { unsubs.forEach(u => u()); };
    } else {
        // Siswa: HANYA notifikasi yang ditujukan ke akunnya sendiri
        window.unsubNotifications = onSnapshot(
            query(notifCol, where("targetUserId", "==", userId)),
            (snap) => handleSnapshot(snap, true), onNotifError);
    }
}

// Tandai semua notifikasi yang tampil sebagai sudah dibaca (tidak menghapus apa pun)
async function markAllNotificationsRead() {
    const user = window.firebaseAuth && window.firebaseAuth.currentUser;
    if (!user) return;
    const targets = notifVisible.filter((ds) => !((ds.data().readBy || []).includes(user.uid)));
    if (!targets.length) { if (typeof showToast === 'function') showToast('Semua notifikasi sudah dibaca.'); return; }
    try {
        await Promise.all(targets.map((ds) =>
            updateDoc(doc(window.firebaseDb, "notifications", ds.id), { readBy: [...(ds.data().readBy || []), user.uid] })));
        if (typeof showToast === 'function') showToast('Semua notifikasi ditandai dibaca.');
    } catch (e) {
        console.error(e);
        if (typeof showToast === 'function') showToast('Gagal menandai notifikasi.');
    }
}

// Hapus notifikasi yang sudah dibaca. Notifikasi setoran & hasil penilaian TIDAK ikut
// dihapus (masih dibutuhkan untuk dengar ulang/lihat nilai; dibersihkan otomatis 24 jam).
async function clearReadNotifications() {
    const user = window.firebaseAuth && window.firebaseAuth.currentUser;
    if (!user) return;
    const targets = notifVisible.filter((ds) => {
        const d = ds.data();
        return (d.readBy || []).includes(user.uid) && d.actionUrl !== 'setoran' && d.actionUrl !== 'setoran_hasil';
    });
    if (!targets.length) { if (typeof showToast === 'function') showToast('Tidak ada notifikasi dibaca yang bisa dibersihkan.'); return; }
    if (!confirm(`Hapus ${targets.length} notifikasi yang sudah dibaca?`)) return;
    try {
        await Promise.all(targets.map((ds) => deleteDoc(doc(window.firebaseDb, "notifications", ds.id))));
        if (typeof showToast === 'function') showToast('Notifikasi dibersihkan.');
    } catch (e) {
        console.error(e);
        if (typeof showToast === 'function') showToast('Gagal membersihkan notifikasi.');
    }
}
window.markAllNotificationsRead = markAllNotificationsRead;
window.clearReadNotifications = clearReadNotifications;

// Membersihkan otomatis notifikasi + dokumen setoran yang SUDAH
// DINILAI dan usianya (sejak dinilai) sudah lewat 24 jam. Dipanggil
// tiap kali daftar notifikasi dirender (lihat listenForNotifications).
const RETENSI_SETORAN_JAM = 24;
const cleanupTried = new Set();   // notifikasi yang sudah pernah dicoba dibersihkan (sekali per sesi)
async function cleanupExpiredSetoranNotif(notifId, setoranId) {
    if (!setoranId || cleanupTried.has('s:' + notifId)) return;
    cleanupTried.add('s:' + notifId);
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
        if (!createdAt || cleanupTried.has('h:' + notifId)) return;
        const jamSejakDibuat = (Date.now() - createdAt.toMillis()) / (1000 * 60 * 60);
        if (jamSejakDibuat >= RETENSI_SETORAN_JAM) {
            cleanupTried.add('h:' + notifId);
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
    } else if (data.actionUrl === 'admin-approval') {
        // Pendaftar baru -> buka popup persetujuan Admin
        toggleNotifModal(false);
        if (typeof window.openMasterAdminScreen === 'function') window.openMasterAdminScreen();
    } else if (data.actionUrl === 'teacher-approval') {
        // Siswa baru mendaftar -> buka panel guru untuk menyetujui
        toggleNotifModal(false);
        if (typeof window.openTeacherAdminScreen === 'function') window.openTeacherAdminScreen();
    }
}
window.markNotificationRead = markNotificationRead;
