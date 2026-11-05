/* =====================================================================
   TartiliKu - Pasang Aplikasi (PWA)
   Berkas : js/14-pwa-install.js  (urutan muat ke-14 dari 17)
   Tugas  : Tombol "Pasang Aplikasi" dan petunjuk manual untuk iPhone/iPad.
   Isi    : isAppInstalled, isIOSDevice, updateInstallButtons, installApp,
            showInstallHelp, closeInstallHelp
   ===================================================================== */

// ===== PASANG APLIKASI (PWA) DI HP & LAPTOP =====
// Chrome/Edge (Android & komputer) memberi sinyal "bisa dipasang" -> tombol Pasang muncul.
// iPhone/iPad (Safari) tidak punya sinyal itu, jadi ditampilkan petunjuk manual.
let deferredInstallPrompt = null;

function isAppInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isIOSDevice() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function updateInstallButtons() {
    const canShow = !isAppInstalled() && (!!deferredInstallPrompt || isIOSDevice());
    document.querySelectorAll('.install-app-trigger').forEach((el) => {
        el.style.display = canShow ? '' : 'none';
    });
}
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateInstallButtons();
});
window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallButtons();
    showToast('Aplikasi TartiliKu berhasil dipasang.');
});

async function installApp() {
    if (deferredInstallPrompt) {
        const promptEvent = deferredInstallPrompt;
        deferredInstallPrompt = null;
        promptEvent.prompt();
        try { await promptEvent.userChoice; } catch (e) { /* abaikan */ }
        updateInstallButtons();
        return;
    }
    showInstallHelp();
}

function showInstallHelp() {
    const desc = document.getElementById('installHelpDesc');
    const steps = document.getElementById('installHelpSteps');
    if (!desc || !steps) return;
    let items;
    if (isIOSDevice()) {
        desc.textContent = 'Di iPhone/iPad, pemasangan dilakukan dari Safari.';
        items = [
            'Buka tartili.vercel.app memakai <b>Safari</b> (bukan Chrome).',
            'Ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas).',
            'Pilih <b>Tambah ke Layar Utama</b>, lalu ketuk <b>Tambah</b>.'
        ];
    } else {
        desc.textContent = 'Browser ini belum menampilkan tombol pasang otomatis.';
        items = [
            'Gunakan <b>Chrome</b> atau <b>Edge</b>.',
            'Di komputer: klik ikon pasang di kanan kolom alamat, atau menu ⋮ → <b>Instal TartiliKu</b>.',
            'Di Android: menu ⋮ → <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.'
        ];
    }
    steps.innerHTML = items.map((t) => '<li>' + t + '</li>').join('');
    document.getElementById('install-help-modal').classList.add('open');
}
function closeInstallHelp() {
    const m = document.getElementById('install-help-modal');
    if (m) m.classList.remove('open');
}
updateInstallButtons();
