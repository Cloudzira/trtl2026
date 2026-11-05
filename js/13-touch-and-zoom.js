/* =====================================================================
   TartiliKu - Gestur Zoom Halaman & Penguncian Zoom Browser
   Berkas : js/13-touch-and-zoom.js  (urutan muat ke-13 dari 17)
   Tugas  : Cubit/roda mouse untuk memperbesar halaman baca, dan pencegah zoom
            bawaan browser.
   ===================================================================== */

// ===== ZOOM HALAMAN BACA (cubit 2 jari & Ctrl + roda mouse) =====
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

// ===== KUNCI ZOOM BAWAAN BROWSER (agar tampilan tidak bergeser) =====
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
