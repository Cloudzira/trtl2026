/* =====================================================================
   TartiliKu - Kerangka Aplikasi (Service Worker, Online/Offline, Panduan, Tema, Toast)
   Berkas : js/02-app-shell.js  (urutan muat ke-2 dari 17)
   Tugas  : Hal-hal yang ada di SEMUA layar: pendaftaran Service Worker,
            penanda offline, mode hemat efek, panduan/tentang, tema warna, dan
            notifikasi singkat (toast).
   Isi    : updateOnlineStatus, showUpdateBanner, showGuideTab,
            openGuideModal, closeGuideModal, openAboutModal,
            closeAboutModal, getCurrentThemeId, applyTheme,
            updateThemeColorMeta, renderThemePicker, openThemePicker,
            closeThemePicker, selectTheme, updateThemeToggleIcon, showToast,
            toggleNotifModal
   ===================================================================== */

// ===== SERVICE WORKER (offline) =====
// Service Worker baru (sw.js) bersifat TERBATAS: hanya mengurus berkas
// aplikasi, modul Firebase/font, sampul, dan audio. Firestore, login, dan
// upload setoran tidak disentuh sama sekali.

// ===== SERVICE WORKER (agar bisa dipakai offline) =====
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

// ===== NOTIFIKASI SINGKAT (TOAST) & MODAL NOTIFIKASI =====
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
