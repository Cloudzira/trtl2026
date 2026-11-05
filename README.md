# TartiliKu

Aplikasi web (PWA) untuk belajar membaca Al-Qur'an dengan metode Tartili.
Siswa membaca per halaman, merekam bacaan, lalu guru menilai. Bisa dipakai offline.

## Struktur Folder

```
trtl2026-main/
├── index.html              Kerangka halaman (semua layar & popup), TANPA logika
├── manifest.json           Data PWA (nama, ikon, warna) agar bisa dipasang di HP
├── sw.js                   Service Worker: penyimpanan cache untuk mode offline
├── firestore.rules         Aturan keamanan database Firestore (tempel di Firebase Console)
├── *.png                   Ikon & favicon (harus tetap di folder utama)
│
├── css/
│   └── styles.css          Seluruh tampilan. Daftar isi ada di bagian paling atas berkas
│
├── data/
│   └── tartili1.js … 6.js  Posisi blok suara tiap halaman, satu berkas per jilid
│
└── js/
    ├── init-*.js           Skrip kecil yang harus jalan paling awal (tinggi layar, tema, splash)
    ├── firebase-auth.js    Firebase: login, status pengguna, notifikasi realtime (modul ES)
    ├── 01-config.js … 17-instant-start.js   Logika aplikasi, DIMUAT BERURUTAN (lihat bawah)
    ├── belajar.js          Fitur belajar tambahan: tandai blok, talaqqi, laporan, tebak bunyi
    └── bintang.js          Bintang & Peta Perjalanan
```

## Urutan Muat Skrip (penting!)

Berkas `js/01…17` memakai variabel dan fungsi **global** yang dipakai bersama, jadi urutannya
tidak boleh ditukar. Urutan yang sama tertulis di bagian bawah `index.html`.

| No | Berkas | Isi singkat |
|----|--------|-------------|
| 01 | `01-config.js` | Nama cache, jumlah halaman & nama tiap jilid |
| 02 | `02-app-shell.js` | Service Worker, status offline, panduan, **tema**, toast |
| 03 | `03-auth.js` | Masuk, daftar, lupa sandi, Google |
| 04 | `04-content-protection.js` | Tanda air & pencegah simpan gambar |
| 05 | `05-dashboards.js` | Sapaan, dashboard admin & guru, daftar kelas |
| 06 | `06-grading-and-history.js` | Penilaian setoran, riwayat, keluar akun |
| 07 | `07-bookmarks.js` | Bookmark & halaman terakhir dibaca |
| 08 | `08-reader.js` | State pembaca, alamat gambar/audio, menu, buka jilid, ganti halaman |
| 09 | `09-page-loader.js` | Cache & pemuatan gambar halaman |
| 10 | `10-page-player.js` | Pemutar audio satu halaman |
| 11 | `11-recording.js` | Rekam suara & cek kualitas |
| 12 | `12-setoran-upload.js` | Kirim setoran ke Apps Script/Filebase |
| 13 | `13-touch-and-zoom.js` | Zoom halaman & kunci zoom browser |
| 14 | `14-pwa-install.js` | Tombol "Pasang Aplikasi" |
| 15 | `15-offline-manager.js` | Simpan jilid untuk offline |
| 16 | `16-fullscreen.js` | Layar penuh |
| 17 | `17-instant-start.js` | **Boot**: langsung tampilkan menu dari salinan profil lokal |

Tiap berkas diawali komentar berisi **tugas** dan **daftar fungsi** di dalamnya.

## Cara Mengubah Hal yang Sering Diubah

| Ingin… | Ubah di… |
|--------|----------|
| Jumlah halaman suatu jilid | `JILID_PAGE_COUNT` di `js/01-config.js` |
| Nama khusus jilid | `JILID_NAMES` di `js/01-config.js` |
| Menambah tema warna | 1 baris di `TARTILI_THEMES` (`js/init-theme-registry.js`) + 1 blok `body.nama-theme {…}` di `css/styles.css` |
| Posisi blok suara | `data/tartiliN.js` (angka dalam persen: atas, kiri, lebar, tinggi) |
| Menambah jilid baru | Tambah `data/tartiliN.js`, lalu isi `JILID_PAGE_COUNT`, `allAudioConfig` (`08-reader.js`), `OFFLINE_JILID_LIST` (`15-offline-manager.js`) |
| Mematikan tanda air | `PAGE_WATERMARK_ENABLED` di `js/04-content-protection.js` |
| Alamat Apps Script | `FILEBASE_UPLOAD_URL` di `js/12-setoran-upload.js` |
| Memaksa pengguna memuat ulang cache | Naikkan `VERSION` di `sw.js` |

## Catatan Penting

* **Berkas baru wajib didaftarkan** di `SHELL_FILES` pada `sw.js` agar ikut tersimpan untuk mode offline.
* Setiap kali isi berkas aplikasi berubah dan ingin langsung dipakai semua pengguna, naikkan `VERSION` di `sw.js`.
* Urutan aturan di `css/styles.css` ikut menentukan tampilan (aturan bawah menimpa aturan atas). Jangan memindahkan blok CSS tanpa menguji tampilannya.
* Pengaturan gaya penulisan ada di `.editorconfig` (indentasi 4 spasi, UTF-8, LF).
