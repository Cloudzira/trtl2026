/* =====================================================================
   TartiliKu - Konfigurasi & Pembantu Jilid
   Berkas : js/01-config.js  (urutan muat ke-1 dari 17)
   Tugas  : Nama cache, jumlah halaman tiap jilid, nama khusus jilid, dan
            fungsi label jilid.
   Isi    : getJilidFullLabel, getJilidTitle
   ===================================================================== */

const TARTILI_PAGE_IMAGE_CACHE = 'tartili-page-images-v3';   // cache sementara (24 halaman terakhir)

// Jumlah halaman bernomor tiap jilid (di luar halaman pembuka a-g dan 0).
// Jilid baru / jumlah halaman berubah: cukup ubah angka di sini.
// (Harus di bagian paling atas, karena dipakai saat aplikasi pertama kali dimuat.)
const JILID_PAGE_COUNT = { 1: 44, 2: 44, 3: 44, 4: 44, 5: 44, 6: 48, 7: 62 };

// Nama khusus jilid (selain "Jilid N"). Jilid 7 bernama Tartili Ghorib.
const JILID_NAMES = { 7: 'Tartili Ghorib' };
// "Jilid 3"  /  "Jilid 7 (Tartili Ghorib)"
function getJilidFullLabel(jilid) {
    const nama = JILID_NAMES[String(jilid)];
    return nama ? `Jilid ${jilid} (${nama})` : `Jilid ${jilid}`;
}
// "Tartili Jilid 3"  /  "Tartili Ghorib (Jilid 7)"
function getJilidTitle(jilid) {
    const nama = JILID_NAMES[String(jilid)];
    return nama ? `${nama} (Jilid ${jilid})` : `Tartili Jilid ${jilid}`;
}

const OFFLINE_IMAGE_CACHE = 'tartili-offline-pages-v2';      // halaman yang diunduh permanen untuk offline
const MEDIA_CACHE_NAME = 'tartili-media-v1';                 // audio (sama dengan yang dipakai sw.js)
