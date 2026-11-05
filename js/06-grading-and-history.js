/* =====================================================================
   TartiliKu - Penilaian Setoran, Tinjau Setoran, Riwayat, Keluar
   Berkas : js/06-grading-and-history.js  (urutan muat ke-6 dari 17)
   Tugas  : Guru menilai setoran, siswa melihat hasil & riwayat setoran, serta
            tombol keluar akun.
   Isi    : submitPenilaian, openSetoranReview, exitSetoranReview,
            backToNotifFromReview, kirimPenilaianReview, lihatHasilSetoran,
            riwayatEsc, riwayatMillis, renderRiwayatList,
            openRiwayatSetoran, closeRiwayatSetoran, hapusRiwayatSetoran,
            handleLogout
   ===================================================================== */

// ===== SETORAN BACAAN SISWA (GURU) =====
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
        // Blok yang ditandai guru (merah = salah, kuning = kurang) dari fitur "Tandai blok"
        const marks = (typeof window.bjGetReviewMarks === 'function') ? window.bjGetReviewMarks() : { salah: [], kurang: [] };

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
            setoranId: setoranId,
            salah: marks.salah,
            kurang: marks.kurang,
            createdAt: window.serverTimestamp(),
            readBy: []
        });

        // Setoran TIDAK langsung dihapus -- disimpan dulu selama 24 jam
        // supaya guru masih bisa membuka & mendengarkan ulang lewat
        // notifikasi yang sama (lihat cleanupExpiredSetoranNotif()).
        await window.updateDoc(setoranRef, {
            nilai: nilaiFinal,
            feedback: feedbackFinal,
            salah: marks.salah,
            kurang: marks.kurang,
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
                salah: marks.salah,
                kurang: marks.kurang,
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

// ===== TINJAU 1 SETORAN LEWAT HALAMAN BACA (dibuka dari notifikasi) =====
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
        if (typeof window.bjOnReviewOpen === 'function') window.bjOnReviewOpen(d);
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
    if (typeof window.bjOnReviewExit === 'function') window.bjOnReviewExit();
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

// ===== LIHAT HASIL PENILAIAN (SISWA) =====
// Menerima data notifikasi LANGSUNG (bukan mengambil ulang dokumen
// "setoran" dari Firestore), karena dokumen setoran yang sudah
// dinilai langsung dihapus oleh submitPenilaian(). Semua data yang
// dibutuhkan (nilai, catatan, audio, jilid, halaman) sudah disisipkan
// ke dalam notifikasinya sendiri.
function lihatHasilSetoran(data) {
    window.__lastHasil = data;
    const nTanda = ((data.salah || []).length + (data.kurang || []).length);
    const contentEl = document.getElementById('hasilSetoranContent');
    contentEl.innerHTML = `
                ${typeof window.bintangResultHtml === 'function' ? window.bintangResultHtml(data) : ''}
                <div style="font-size:13px; color:var(--text-muted); margin-bottom:8px;">${getJilidFullLabel(data.jilid)} • Halaman ${data.halaman}</div>
                ${setoranPlayerHtml(data, 'margin-bottom:12px;')}
                <div style="font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:2px;">Nilai</div>
                <div style="font-size:22px; font-weight:800; color:var(--accent-solid); margin-bottom:12px;">${data.nilai != null ? data.nilai : '-'}</div>
                <div style="font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:2px;">Catatan Guru</div>
                <div style="font-size:13px; color:var(--text-main); background:var(--input-bg); padding:10px; border-radius:10px;">${riwayatEsc(data.feedback) || 'Tidak ada catatan.'}</div>
                ${nTanda ? `<button type="button" class="bj-btn" style="width:100%; margin-top:12px;" onclick="bjOpenFixFromResult()">Perbaiki ${nTanda} blok yang ditandai guru</button>` : ''}
            `;
    document.getElementById('hasilSetoranModal').classList.add('active');
}
window.lihatHasilSetoran = lihatHasilSetoran;

// ===== RIWAYAT SETORAN SISWA =====
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
        const nTanda = ((it.salah || []).length + (it.kurang || []).length);
        const fixBtn = nTanda ? `<button type="button" class="riwayat-fix" onclick="bjOpenFixFromRiwayat('${riwayatEsc(it.id)}')">Perbaiki ${nTanda} blok</button>` : '';

        return `
                    <div class="riwayat-item">
                        <div class="riwayat-info">
                            <div class="riwayat-title">${riwayatEsc(getJilidFullLabel(it.jilid))} • Hal. ${riwayatEsc(it.halaman)}</div>
                            <div class="riwayat-meta">${tgl}, ${jam}${guru}</div>
                            ${note}
                            ${fixBtn}
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

// ===== KELUAR AKUN =====
function handleLogout() {
    window.signOut(window.firebaseAuth).catch((error) => { console.error("Gagal keluar", error); });
}
