/* =====================================================================
   TartiliKu - Kirim Setoran (Apps Script / Filebase)
   Berkas : js/12-setoran-upload.js  (urutan muat ke-12 dari 17)
   Tugas  : Mengunggah rekaman setoran siswa lewat Apps Script dengan token
            login Firebase.
   Isi    : callFilebaseApi, extractSetoranKey, setoranPlayerHtml,
            loadSetoranAudio, blobToBase64, showUploadingOverlay,
            hideUploadingOverlay, kirimSetoran
   ===================================================================== */

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

// ===== KIRIM SETORAN (unggah rekaman siswa) =====
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
