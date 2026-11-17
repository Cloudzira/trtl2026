/* =====================================================================
   TartiliKu - Sapaan, Dashboard Admin & Guru, Daftar Kelas
   Berkas : js/05-dashboards.js  (urutan muat ke-5 dari 17)
   Tugas  : Sapaan pengguna, akses dashboard sesuai peran, persetujuan
            pendaftar (admin & guru), dan daftar anggota kelas.
   Isi    : updateUserGreeting, openAdminUsersModal (daftar guru & siswa terdaftar), isAdminProfile, setupDashboardAccess,
            openMasterAdminScreen, closeMasterAdminModal, updateAdminBadge,
            refreshAdminPendingBadge, loadMasterPendingUsers,
            approveMasterUser, deleteStudentFromClass, deleteUserAccount,
            openTeacherAdminScreen, loadTeacherPendingStudents,
            approveStudent, openClassMembersScreen, loadClassMembersList,
            goBackFromClassMembers
   ===================================================================== */

// ===== SAPAAN PENGGUNA DI MENU UTAMA =====
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

// ===== AKSES DASHBOARD SESUAI PERAN (admin / guru / siswa) =====
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

    const btnUsers = document.getElementById('btnAdminUsers');
    if (btnUsers) btnUsers.style.setProperty('display', isMaster ? 'flex' : 'none', 'important');

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
    // Tombol Peta Perjalanan & chip bintang (khusus siswa) diatur oleh bintang.js
    if (typeof window.bintangOnProfile === 'function') window.bintangOnProfile();
}

// ===== MASTER ADMIN PANEL =====
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

// ===== PENGGUNA TERDAFTAR (ADMIN): daftar guru & siswa + hapus =====
// Menampilkan akun yang SUDAH disetujui Admin. Yang masih menunggu ada di popup
// "Setujui Pendaftar Baru". Menghapus = menghapus profil di database (akun Google-nya
// tidak ikut terhapus dari Firebase Auth, tetapi tidak bisa memakai aplikasi lagi
// sampai mendaftar ulang dan disetujui).
let adminUsersTab = 'Guru';
let adminUsersData = { Guru: [], Siswa: [] };

async function openAdminUsersModal() {
    const modal = document.getElementById('adminUsersModal');
    if (modal) modal.classList.add('active');
    await loadAdminUsers();
}
function closeAdminUsersModal() {
    const modal = document.getElementById('adminUsersModal');
    if (modal) modal.classList.remove('active');
}
function setAdminUsersTab(tab) {
    adminUsersTab = tab;
    document.getElementById('auTabGuru').classList.toggle('active', tab === 'Guru');
    document.getElementById('auTabSiswa').classList.toggle('active', tab === 'Siswa');
    renderAdminUsers();
}

async function loadAdminUsers() {
    const box = document.getElementById('adminUsersContainer');
    if (!box) return;
    box.innerHTML = `<div class="au-empty">Memuat pengguna...</div>`;
    try {
        const col = window.collection(window.firebaseDb, 'users');
        const [snapG, snapS] = await Promise.all([
            window.getDocs(window.query(col, window.where('role', '==', 'Guru'))),
            window.getDocs(window.query(col, window.where('role', '==', 'Siswa')))
        ]);
        const pick = (snap) => snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((u) => u.isMasterApproved === true)
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'id'));
        adminUsersData = { Guru: pick(snapG), Siswa: pick(snapS) };
        renderAdminUsers();
    } catch (e) {
        console.error(e);
        box.innerHTML = `<div class="au-empty" style="color:#ef4444;">Gagal memuat pengguna.</div>`;
    }
}

function renderAdminUsers() {
    const box = document.getElementById('adminUsersContainer');
    if (!box) return;
    const cg = document.getElementById('auCountGuru');
    const cs = document.getElementById('auCountSiswa');
    if (cg) cg.textContent = adminUsersData.Guru.length;
    if (cs) cs.textContent = adminUsersData.Siswa.length;

    const q = ((document.getElementById('auSearch') || {}).value || '').trim().toLowerCase();
    // Peta kode kelas -> guru, untuk menampilkan nama guru di daftar siswa
    const guruByClass = {};
    adminUsersData.Guru.forEach((g) => { if (g.classCode) guruByClass[g.classCode] = g; });

    const list = adminUsersData[adminUsersTab].filter((u) => !q ||
        [u.name, u.email, u.classCode, u.teacherClassName].some((v) => String(v || '').toLowerCase().includes(q)));

    if (!list.length) {
        box.innerHTML = `<div class="au-empty">${q ? 'Tidak ada hasil.' : (adminUsersTab === 'Guru' ? 'Belum ada guru terdaftar.' : 'Belum ada siswa terdaftar.')}</div>`;
        return;
    }
    box.innerHTML = '';
    list.forEach((u) => {
        const row = document.createElement('div');
        row.className = 'au-row';
        let info;
        if (u.role === 'Guru') {
            const n = adminUsersData.Siswa.filter((s) => s.classCode === u.classCode).length;
            info = `Kelas ${riwayatEsc(u.teacherClassName || '-')} · Kode ${riwayatEsc(u.classCode || '-')} · ${n} siswa`;
        } else {
            const g = guruByClass[u.classCode];
            info = `Kode ${riwayatEsc(u.classCode || '-')}${g ? ' · Guru: ' + riwayatEsc(g.name) : ' · guru tidak ditemukan'}` +
                (u.isTeacherApproved ? '' : ' · <b style="color:#f59e0b;">menunggu guru</b>');
        }
        row.innerHTML = `
            <div class="au-main">
                <div class="au-name">${riwayatEsc(u.name || '-')}</div>
                <div class="au-sub">${riwayatEsc(u.email || '-')}</div>
                <div class="au-sub">${info}</div>
            </div>
            <button type="button" class="au-del" data-id="${u.id}" data-name="${riwayatEsc(u.name || '')}" data-role="${u.role}" title="Hapus ${u.role}" aria-label="Hapus ${u.role}">
                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
            </button>`;
        row.querySelector('.au-del').onclick = (ev) => {
            const d = ev.currentTarget.dataset;
            deleteRegisteredUser(d.id, d.name, d.role);
        };
        box.appendChild(row);
    });
}

async function deleteRegisteredUser(userId, userName, role) {
    if (!navigator.onLine) { showToast('Anda sedang offline. Belum bisa menghapus.'); return; }
    const nama = userName || (role === 'Guru' ? 'guru ini' : 'siswa ini');
    let pesan = `Hapus ${role} "${nama}"?\n\nPengguna tidak bisa lagi memakai aplikasi sampai mendaftar ulang dan disetujui. Tindakan ini tidak dapat dibatalkan.`;
    if (role === 'Guru') {
        const g = adminUsersData.Guru.find((x) => x.id === userId);
        const n = g ? adminUsersData.Siswa.filter((s) => s.classCode === g.classCode).length : 0;
        if (n > 0) pesan += `\n\nPERHATIAN: kelas guru ini masih punya ${n} siswa. Siswa tidak ikut terhapus, tetapi tidak akan punya guru untuk menilai setoran mereka.`;
    }
    if (!confirm(pesan)) return;
    try {
        await window.deleteDoc(window.doc(window.firebaseDb, 'users', userId));
        showToast(`${role} ${nama} berhasil dihapus.`);
        await loadAdminUsers();
    } catch (e) {
        console.error(e);
        showToast('Gagal menghapus' + (e && e.code ? ` (${e.code})` : '') + '.');
    }
}
window.openAdminUsersModal = openAdminUsersModal;
window.closeAdminUsersModal = closeAdminUsersModal;
window.setAdminUsersTab = setAdminUsersTab;
window.renderAdminUsers = renderAdminUsers;

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

// ===== TEACHER PANEL =====
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

// ===== CLASS MEMBERS SCREEN =====
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
                            <button class="riwayat-del bj-report-btn" data-id="${sId}" data-name="${riwayatEsc(sData.name)}" onclick="bjOpenReport(this.dataset.id, this.dataset.name)" title="Laporan orang tua" aria-label="Laporan orang tua">
                                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="14" y2="17"></line></svg>
                            </button>
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
