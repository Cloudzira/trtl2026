/* =====================================================================
   TartiliKu - Perlindungan Konten
   Berkas : js/04-content-protection.js  (urutan muat ke-4 dari 17)
   Tugas  : Tanda air nama pengguna di halaman baca + pencegah klik-kanan /
            seret / seleksi pada gambar.
   Isi    : applyPageWatermark
   ===================================================================== */

// ===== PERLINDUNGAN KONTEN (pencegah, bukan penjamin 100%) =====
// Gambar halaman & rekaman tidak bisa diklik-kanan / ditahan-lama untuk disimpan,
// tidak bisa diseret, dan diberi tanda air nama pengguna agar tangkapan layar
// yang disebar bisa dikenali asalnya. Ubah ke false untuk mematikan tanda air.
const PAGE_WATERMARK_ENABLED = true;

function applyPageWatermark() {
    const root = document.documentElement;
    const profile = window.currentUserProfile;
    if (!PAGE_WATERMARK_ENABLED || !profile) { root.style.removeProperty('--page-watermark'); return; }
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
    const label = esc((profile.name || 'Pengguna').slice(0, 24)) + ' • TartiliKu';
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='170'>" +
        "<text x='120' y='90' text-anchor='middle' transform='rotate(-28 120 85)' " +
        "font-family='Arial, sans-serif' font-size='14' font-weight='700' fill='#000' fill-opacity='0.085'>" + label + "</text></svg>";
    root.style.setProperty('--page-watermark', 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")');
}

// Matikan menu klik-kanan / tahan-lama pada gambar halaman & pemutar rekaman
document.addEventListener('contextmenu', (e) => {
    if (e.target && e.target.closest && e.target.closest('.image-container, .setoran-player, audio, .bj-stage, .bj-cropbox')) e.preventDefault();
});
document.addEventListener('dragstart', (e) => {
    if (e.target && e.target.closest && e.target.closest('.image-container, .bj-stage, .bj-cropbox')) e.preventDefault();
});
// Cegah juga pemilihan/penyeretan lewat gestur (tahan-lama di layar sentuh) pada halaman di mode latihan
document.addEventListener('selectstart', (e) => {
    if (e.target && e.target.closest && e.target.closest('.bj-stage, .bj-cropbox')) e.preventDefault();
});
