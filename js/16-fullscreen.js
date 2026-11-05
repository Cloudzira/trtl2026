/* =====================================================================
   TartiliKu - Layar Penuh
   Berkas : js/16-fullscreen.js  (urutan muat ke-16 dari 17)
   Tugas  : Tombol layar penuh (disembunyikan otomatis di perangkat yang tidak
            mendukung).
   Isi    : fsActive, fsSupported, toggleFullscreen, updateFullscreenUI
   ===================================================================== */

// ===== LAYAR PENUH =====
// Tombol di sebelah tombol unduh. Disembunyikan otomatis di perangkat yang tidak mendukung
// (mis. iPhone) karena Safari iPhone tidak mengizinkan layar penuh untuk halaman web.
const FS_ICON_ON = '<svg viewBox="0 0 24 24"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
const FS_ICON_OFF = '<svg viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
function fsActive() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
function fsSupported() {
    const d = document.documentElement;
    return !!(d.requestFullscreen || d.webkitRequestFullscreen) && document.fullscreenEnabled !== false;
}
async function toggleFullscreen() {
    try {
        if (fsActive()) {
            (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
            const d = document.documentElement;
            await (d.requestFullscreen || d.webkitRequestFullscreen).call(d);
        }
    } catch (e) {
        showToast('Layar penuh tidak bisa dibuka di perangkat ini.');
    }
}
function updateFullscreenUI() {
    const btn = document.getElementById('btnFullscreen');
    if (!btn) return;
    if (!fsSupported()) { btn.style.display = 'none'; return; }
    const on = fsActive();
    btn.innerHTML = on ? FS_ICON_ON : FS_ICON_OFF;
    btn.title = on ? 'Keluar layar penuh' : 'Layar penuh';
    btn.setAttribute('aria-label', btn.title);
}
document.addEventListener('fullscreenchange', updateFullscreenUI);
document.addEventListener('webkitfullscreenchange', updateFullscreenUI);
updateFullscreenUI();
window.toggleFullscreen = toggleFullscreen;
