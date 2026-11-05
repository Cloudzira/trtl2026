/* =====================================================================
   TartiliKu - Daftar Tema & Fungsi Pasang Tema
   Berkas : js/init-theme-registry.js
   Tugas  : Daftar semua tema warna (TARTILI_THEMES), fungsi getTartiliTheme /
            applyTartiliTheme, dan warna status bar sejak awal. Dijalankan di
            <head> sebelum halaman tampil supaya tidak berkedip.
   ===================================================================== */

// ===== DAFTAR TEMA =====
// id    : nama class pada <body> (juga disimpan di localStorage 'tartili_theme')
// dark  : true untuk tema gelap (body otomatis diberi class 'is-dark')
// bar   : warna status bar HP (sama dengan warna latar tema)
// sw    : 3 warna contoh untuk kartu pilihan tema [aksen 1, aksen 2, latar]
// Tema bawaan (untuk pengguna yang belum pernah memilih): Futuristik
window.TARTILI_DEFAULT_THEME = 'future-theme';
window.TARTILI_THEMES = [
    { id: 'future-theme',    name: 'Futuristik',  desc: 'Neon cyan & magenta', dark: true,  bar: '#04050d', sw: ['#00e5ff', '#ff2bd6', '#04050d'] },
    { id: 'bluenight-theme', name: 'Blue Night',  desc: 'Biru malam elegan',   dark: true,  bar: '#070d1f', sw: ['#60a5fa', '#6366f1', '#070d1f'] },
    { id: 'emerald-theme',   name: 'Emerald',     desc: 'Hijau zamrud mewah',  dark: true,  bar: '#03120d', sw: ['#34d399', '#d4af37', '#03120d'] },
    { id: 'dark-theme',      name: 'Gelap',       desc: 'Hijau & biru muda',   dark: true,  bar: '#020617', sw: ['#34d399', '#22d3ee', '#020617'] },
    { id: 'aesthetic-theme', name: 'Aestetik',    desc: 'Pastel rose & sage',  dark: false, bar: '#fbf6f1', sw: ['#e8a0b4', '#a7c4b0', '#fbf6f1'] },
    { id: 'lavender-theme',  name: 'Lavender',    desc: 'Ungu lembut tenang',  dark: false, bar: '#f5f3ff', sw: ['#a78bfa', '#7c3aed', '#f5f3ff'] },
    { id: 'kids-theme',      name: 'Ceria Anak',  desc: 'Warna-warni ceria',   dark: false, bar: '#fff7e0', sw: ['#ffb703', '#ff5d8f', '#fff7e0'] },
    { id: 'light-theme',     name: 'Terang',      desc: 'Pink & ungu lembut',  dark: false, bar: '#fdf4ff', sw: ['#f472b6', '#a855f7', '#fdf4ff'] }
];
window.getTartiliTheme = function (id) {
    var list = window.TARTILI_THEMES;
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; }
    // id tidak dikenal / belum pernah memilih -> tema bawaan
    for (var j = 0; j < list.length; j++) { if (list[j].id === window.TARTILI_DEFAULT_THEME) return list[j]; }
    return list[0];
};
// Pasang tema: class <body>, warna status bar HP, dan (opsional) simpan pilihan
window.applyTartiliTheme = function (id, persist) {
    var t = window.getTartiliTheme(id);
    if (document.body) document.body.className = t.id + (t.dark ? ' is-dark' : '');
    var meta = document.getElementById('metaThemeColor');
    if (meta) meta.setAttribute('content', t.bar);
    if (persist) { try { localStorage.setItem('tartili_theme', t.id); } catch (e) {} }
    return t;
};
// Warna status bar sejak awal (sebelum halaman tampil), tanpa berkedip
(function () {
    try {
        var t = window.getTartiliTheme(localStorage.getItem('tartili_theme'));
        document.getElementById('metaThemeColor').setAttribute('content', t.bar);
    } catch (e) {}
})();
