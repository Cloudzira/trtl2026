/* =====================================================================
   TartiliKu - Pembaca: State, URL Gambar/Audio, Navigasi Menu & Halaman
   Berkas : js/08-reader.js  (urutan muat ke-8 dari 17)
   Tugas  : Variabel keadaan pembaca, pembuat alamat gambar/audio, pemuat
            konfigurasi jilid, menu utama, buka jilid, ganti halaman, dan
            tombol bookmark.
   Isi    : readLoadedJilidConfig, loadJilidConfig, isPortrait,
            openBookmarksScreen, renderBookmarksList, removeBookmark,
            goToMenu, updateMenuCoverFocus, getNumericPageList,
            getFullPageList, updatePageOptions, directOpen, openJilid,
            resetZoom, updateImageTransform, changePage, toggleBookmark,
            updateBookmarkButtonState, updateJilidBadge
   ===================================================================== */

// ===== KEADAAN (STATE) PEMBACA =====
let currentJilid = savedLastRead.jilid, currentPage = savedLastRead.page, appState = 'menu', selectedMenuCoverIndex = 0, currentAudio = null;
let mediaRecorder, audioChunks = [], recordedAudioBlob = null;
let recordedAudioMimeType = 'audio/webm';
let isPlayingRecording = false;
let currentReviewSetoranId = null; // diisi saat guru meninjau 1 setoran lewat notifikasi

// ===== ALAMAT GAMBAR & AUDIO (Cloudinary) =====
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
// ===== VARIABEL ZOOM & GESER HALAMAN =====
let scale = 1, initialDistance = null;
let pageLoadRequestId = 0, currentPageObjectUrl = null;
let touchStartX = 0, touchEndX = 0;
const minSwipeDistance = 50;

// ===== KONFIGURASI BLOK SUARA PER JILID (tartili1.js - tartili7.js dimuat saat dibutuhkan) =====
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
        s.src = `data/tartili${key}.js`;
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

// ===== ORIENTASI LAYAR =====
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

// ===== LAYAR BOOKMARK & MENU UTAMA =====
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

// ===== DAFTAR HALAMAN & BUKA JILID =====
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

// ===== ZOOM, GANTI HALAMAN, & TOMBOL BOOKMARK =====
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

// ===== LENCANA NAMA JILID =====
// Lencana nama di pojok kiri atas halaman baca (hanya untuk jilid yang punya nama khusus)
function updateJilidBadge() {
    const el = document.getElementById('jilidBadge');
    if (!el) return;
    const nama = JILID_NAMES[String(currentJilid)];
    if (nama) { el.innerHTML = `<b>${nama}</b> · Jilid ${currentJilid}`; el.style.display = 'block'; }
    else { el.style.display = 'none'; }
}
