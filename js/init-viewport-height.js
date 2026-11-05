/* =====================================================================
   TartiliKu - Tinggi Layar Nyata (--app-h)
   Berkas : js/init-viewport-height.js
   Tugas  : Mengisi variabel CSS --app-h dengan tinggi layar yang benar-benar
            terlihat, agar panel bawah & popup tidak keluar layar di HP.
            Dijalankan paling awal (di <head>).
   ===================================================================== */

// Tinggi layar yang BENAR-BENAR terlihat (px). Dipakai CSS (var --app-h) supaya panel di bagian bawah,
// popup, dan notifikasi tidak keluar layar di HP (tinggi "100vh/100dvh" kadang lebih besar dari yang terlihat).
(function () {
    function setAppHeight() {
        var h = window.innerHeight || document.documentElement.clientHeight;
        if (h > 0) document.documentElement.style.setProperty('--app-h', h + 'px');
    }
    setAppHeight();
    window.addEventListener('resize', setAppHeight);
    window.addEventListener('orientationchange', function () { setTimeout(setAppHeight, 120); setTimeout(setAppHeight, 500); });
    window.addEventListener('pageshow', setAppHeight);
    window.addEventListener('load', function () { setTimeout(setAppHeight, 300); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) setAppHeight(); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', setAppHeight);
})();
