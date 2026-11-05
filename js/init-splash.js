/* =====================================================================
   TartiliKu - Layar Pembuka (Splash)
   Berkas : js/init-splash.js
   Tugas  : Menampilkan splash sampai layar pertama (login / menu) siap,
            minimal beberapa saat; menampilkan pesan bila terlalu lama dimuat.
            Dijalankan tepat setelah elemen #splash-screen.
   ===================================================================== */

// Splash tampil sampai halaman pertama (login / menu) siap, minimal 0,4 detik.
(function () {
    var splash = document.getElementById('splash-screen');
    if (!splash) return;
    try { var t = localStorage.getItem('tartili_theme') || window.TARTILI_DEFAULT_THEME || 'future-theme'; if (window.applyTartiliTheme) window.applyTartiliTheme(t, false); else document.body.className = t; } catch (e) {}
    var MIN_SHOW_MS = 400, SLOW_MS = 10000;
    var hidden = false, pending = false, slowTimer = null;
    function hideSplash() {
        if (hidden) return;
        hidden = true;
        clearTimeout(slowTimer);
        observer.disconnect();
        splash.classList.add('hide');
        setTimeout(function () { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 600);
    }
    function tryHide() {
        if (hidden || pending || !document.querySelector('.screen.active')) return;
        pending = true;
        setTimeout(hideSplash, Math.max(0, MIN_SHOW_MS - performance.now()));
    }
    var observer = new MutationObserver(tryHide);
    observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('DOMContentLoaded', tryHide);
    // Kalau terlalu lama (mis. offline saat pertama kali dibuka), tampilkan pesan
    slowTimer = setTimeout(function () {
        var s = document.getElementById('splashStatus'), b = document.getElementById('splashRetry');
        if (s) s.textContent = navigator.onLine
            ? 'Memuat lebih lama dari biasanya...'
            : 'Anda sedang offline. Buka aplikasi sekali saat online agar bisa dipakai offline.';
        if (b) b.style.display = 'inline-block';
    }, SLOW_MS);
    window.addEventListener('online', function () { if (!hidden) location.reload(); });
})();
