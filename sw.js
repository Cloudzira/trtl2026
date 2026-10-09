/* =====================================================================
   TartiliKu - Service Worker TERBATAS
   Hanya menangani:
     1) berkas aplikasi sendiri (HTML/JS/CSS/ikon)
     2) modul Firebase dari esm.sh dan font dari fonts.bunny.net
     3) sampul menu dan audio pelajaran dari Cloudinary
   TIDAK menyentuh: Firestore, Firebase Auth, upload setoran (Apps Script),
   gambar halaman (sudah di-cache oleh app.js), dan permintaan selain GET.
   ===================================================================== */
const VERSION = 'v1';                       // naikkan angka ini kalau ingin memaksa cache aplikasi dibuat ulang
const SHELL_CACHE = `tartili-shell-${VERSION}`;
const EXT_CACHE = `tartili-ext-${VERSION}`;
const MEDIA_CACHE = 'tartili-media-v1';     // sampul + audio (dibiarkan tetap supaya unduhan offline tidak hilang)
const PAGE_IMAGE_CACHE = 'tartili-page-images-v2'; // milik app.js, jangan dihapus
const KEEP = [SHELL_CACHE, EXT_CACHE, MEDIA_CACHE, PAGE_IMAGE_CACHE];

const SHELL_FILES = [
  './', 'app.js', 'styles.css', 'firebase-auth.js',
  'tartili1.js', 'tartili2.js', 'tartili3.js', 'tartili4.js', 'tartili5.js', 'tartili6.js',
  'manifest.json', 'favicon.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Satu berkas gagal tidak membatalkan yang lain
    await Promise.all(SHELL_FILES.map((f) =>
      cache.add(new Request(f, { cache: 'reload' })).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((n) => n.startsWith('tartili-') && !KEEP.includes(n))
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  // Halaman mengirim daftar modul/font eksternal yang sudah dimuat agar ikut disimpan
  if (data.type === 'CACHE_EXTERNAL' && Array.isArray(data.urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(EXT_CACHE);
      for (const u of data.urls.slice(0, 80)) {
        try {
          const host = new URL(u).hostname;
          if (host !== 'esm.sh' && host !== 'fonts.bunny.net') continue;
          if (await cache.match(u, { ignoreVary: true })) continue;
          const res = await fetch(u, { mode: 'cors', credentials: 'omit' });
          if (res.ok) await cache.put(u, res);
        } catch (e) { /* abaikan */ }
      }
    })());
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 1) Berkas aplikasi sendiri
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      event.respondWith(networkFirst(req, SHELL_CACHE, './', true));
    } else if (/\/tartili\d\.js$/.test(url.pathname)) {
      event.respondWith(staleWhileRevalidate(event, SHELL_CACHE));
    } else if (/\.(?:js|css|json|png|jpe?g|svg|ico|webp)$/.test(url.pathname)) {
      event.respondWith(networkFirst(req, SHELL_CACHE, null, false));
    }
    return;
  }

  // 2) Modul Firebase (versi dikunci, aman di-cache)
  if (url.hostname === 'esm.sh') {
    event.respondWith(cacheFirst(req, EXT_CACHE));
    return;
  }

  // 3) Font
  if (url.hostname === 'fonts.bunny.net') {
    event.respondWith(fontHandler(event));
    return;
  }

  // 4) Cloudinary: hanya sampul dan audio (gambar halaman diurus app.js)
  if (url.hostname === 'res.cloudinary.com') {
    if (/\/video\/upload\/[^/]+\.mp3$/i.test(url.pathname)) {
      event.respondWith(audioHandler(event));
    } else if (/\/image\/upload\/(?:[^/]+\/)?cover\d+\.jpg$/i.test(url.pathname)) {
      event.respondWith(coverHandler(event));
    }
    return;
  }
  // Selain itu (Firestore, Auth, Apps Script, dll.): tidak disentuh sama sekali
});

/* ---------- Strategi ---------- */

// Respons hasil redirect tidak boleh dipakai untuk navigasi -> bersihkan
async function cleanResponse(res) {
  if (!res || !res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

async function networkFirst(req, cacheName, fallbackKey, isNavigation) {
  const cache = await caches.open(cacheName);
  const fromCache = async () => {
    let hit = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
    if (!hit && fallbackKey) hit = await cache.match(fallbackKey, { ignoreSearch: true });
    return isNavigation ? cleanResponse(hit) : hit;
  };
  try {
    const netPromise = fetch(req);
    const cachedNow = await fromCache();
    // Kalau ada cache, jangan menunggu jaringan lambat lebih dari 4 detik
    const res = cachedNow
      ? await Promise.race([netPromise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))])
      : await netPromise;
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = await fromCache();
    if (hit) return hit;
    return Response.error();
  }
}

async function staleWhileRevalidate(event, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request, { ignoreVary: true });
  const update = fetch(event.request).then((res) => {
    if (res && res.ok) cache.put(event.request, res.clone());
    return res;
  }).catch(() => null);
  event.waitUntil(update);
  return cached || (await update) || Response.error();
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function fontHandler(event) {
  const cache = await caches.open(EXT_CACHE);
  const key = event.request.url;
  const cached = await cache.match(key, { ignoreVary: true });
  const update = fetch(key, { mode: 'cors', credentials: 'omit' }).then((res) => {
    if (res.ok) cache.put(key, res.clone());
    return res;
  }).catch(() => null);
  event.waitUntil(update);
  return cached || (await update) || Response.error();
}

async function coverHandler(event) {
  const cache = await caches.open(MEDIA_CACHE);
  const key = event.request.url;
  const hit = await cache.match(key, { ignoreVary: true });
  if (hit) return hit;
  try {
    const res = await fetch(key, { mode: 'cors', credentials: 'omit' });
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch (e) {
    try { return await fetch(event.request); } catch (e2) { return Response.error(); }
  }
}

// Audio: browser meminta potongan (Range). Cache API tidak otomatis melayani itu,
// jadi file utuh disimpan lalu dipotong sesuai permintaan.
async function audioHandler(event) {
  const req = event.request;
  const cache = await caches.open(MEDIA_CACHE);
  const key = req.url;
  let res = await cache.match(key, { ignoreVary: true });
  if (!res) {
    try {
      const net = await fetch(key, { mode: 'cors', credentials: 'omit' });
      if (!net.ok) return net;
      await cache.put(key, net.clone());
      res = net;
    } catch (e) {
      try { return await fetch(req); } catch (e2) { return Response.error(); }
    }
  }
  const range = req.headers.get('range');
  return range ? rangeResponse(res, range) : res;
}

async function rangeResponse(res, header) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return res;
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  let start, end;
  if (m[1] === '') { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
  else { start = parseInt(m[1], 10); end = m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1); }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`
    }
  });
}
