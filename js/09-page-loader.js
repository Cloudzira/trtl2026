/* =====================================================================
   TartiliKu - Cache & Pemuatan Gambar Halaman
   Berkas : js/09-page-loader.js  (urutan muat ke-9 dari 17)
   Tugas  : Menyimpan gambar halaman ke cache, memuat halaman
            sebelum/sesudahnya (prefetch), dan menampilkan satu halaman.
   Isi    : trimPageCache, matchPageCache, ensurePageCached,
            getNeighborPageIds, shouldSkipPrefetch,
            schedulePrefetchNeighbors, loadPageData
   ===================================================================== */

// ===== CACHE & PRELOAD GAMBAR HALAMAN =====
const MAX_CACHED_PAGES = 24;
const pageFetchInFlight = new Map();

function trimPageCache(cache) {
    cache.keys().then((keys) => {
        if (keys.length > MAX_CACHED_PAGES) {
            return Promise.all(keys.slice(0, keys.length - MAX_CACHED_PAGES).map((req) => cache.delete(req)));
        }
    }).catch(() => {});
}

// Mencari gambar halaman di cache offline permanen, lalu cache sementara.
async function matchPageCache(jilid, page) {
    const keys = getPageImageKeys(jilid, page);
    for (const name of [OFFLINE_IMAGE_CACHE, TARTILI_PAGE_IMAGE_CACHE]) {
        const cache = await window.caches.open(name);
        for (const k of keys) {
            const hit = await cache.match(k);
            if (hit) return hit;
        }
    }
    return null;
}

// Memastikan gambar halaman ada di cache. Urutan percobaan (untuk tiap kemungkinan nama berkas):
//   1) Cloudinary dengan transformasi (WebP kecil)
//   2) Cloudinary gambar asli
// persist = true -> simpan di cache offline PERMANEN (tidak ikut dibuang otomatis).
// Kalau sedang diunduh (mis. oleh preload), permintaan yang sama menunggu
// unduhan itu, bukan mengunduh dua kali.
function ensurePageCached(jilid, page, persist = false) {
    const key = getPageImageUrl(jilid, page);
    const flightKey = (persist ? 'P|' : 'N|') + key;
    if (pageFetchInFlight.has(flightKey)) return pageFetchInFlight.get(flightKey);
    const p = (async () => {
        const keys = getPageImageKeys(jilid, page);
        const offlineCache = await window.caches.open(OFFLINE_IMAGE_CACHE);
        for (const k of keys) { if (await offlineCache.match(k)) return; }
        const normalCache = await window.caches.open(TARTILI_PAGE_IMAGE_CACHE);
        for (const k of keys) {
            const hit = await normalCache.match(k);
            if (hit) {
                if (persist) await offlineCache.put(key, hit.clone());
                return;
            }
        }

        const target = persist ? offlineCache : normalCache;
        const variants = getPageIdVariants(page);
        const useTransform = !isImageTransformDisabled();

        let lastError = null;
        for (const idPart of variants) {
            let transformedFailed = false;
            // 1) Cloudinary dengan transformasi (WebP kecil)
            if (useTransform) {
                try {
                    const res = await fetch(buildPageImageUrl(jilid, idPart, true));
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    await target.put(key, res.clone());
                    if (!persist) trimPageCache(normalCache);
                    return;
                } catch (err) { lastError = err; transformedFailed = true; }
            }
            // 2) Cloudinary gambar asli
            try {
                const res = await fetch(buildPageImageUrl(jilid, idPart, false));
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                await target.put(key, res.clone());
                // Transformasi gagal tapi gambar asli ada -> matikan transformasi
                if (useTransform && transformedFailed) {
                    try { localStorage.setItem('tartili_img_transform_off', '1'); } catch (e) {}
                }
                if (!persist) trimPageCache(normalCache);
                return;
            } catch (err) { lastError = err; }
        }
        throw lastError || new Error('Gagal mengunduh gambar halaman');
    })();
    pageFetchInFlight.set(flightKey, p);
    const done = () => pageFetchInFlight.delete(flightKey);
    p.then(done, done);
    return p;
}

function getNeighborPageIds(jilid, page) {
    const pages = getFullPageList(jilid);
    const i = pages.indexOf(String(page));
    const out = [];
    if (i >= 0 && i + 1 < pages.length) out.push(pages[i + 1]);
    if (i > 0) out.push(pages[i - 1]);
    return out;
}

function shouldSkipPrefetch() {
    const c = navigator.connection;
    return !!(c && (c.saveData || /2g/.test(c.effectiveType || '')));
}

// Setelah halaman aktif tampil, unduh halaman sesudah & sebelumnya di
// latar belakang supaya saat digeser langsung muncul.
function schedulePrefetchNeighbors(requestId) {
    if (!window.caches || shouldSkipPrefetch()) return;
    const jilid = currentJilid, page = currentPage;
    const run = () => {
        if (requestId !== pageLoadRequestId) return;
        getNeighborPageIds(jilid, page).forEach((p) => {
            ensurePageCached(jilid, p).catch(() => {});
        });
    };
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1500 });
    else setTimeout(run, 400);
}

function loadPageData() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    resetRecording();

    localStorage.setItem('tartili_last_read', JSON.stringify({ jilid: currentJilid, page: currentPage }));
    updateBookmarkButtonState();

    const container = document.getElementById('imageContainer');
    const spinner = document.getElementById('loadingSpinner');
    const imgPath = getPageImageUrl(currentJilid, currentPage);
    // Cadangan kalau pemuatan lewat cache gagal: coba URL langsung (semua kemungkinan nama)
    const directFallbacks = [];
    getPageIdVariants(currentPage).forEach((idPart) => {
        [true, false].forEach((tr) => {
            const u = buildPageImageUrl(currentJilid, idPart, tr);
            if (u !== imgPath && !directFallbacks.includes(u)) directFallbacks.push(u);
        });
    });
    const requestId = ++pageLoadRequestId;
    loadJilidConfig(currentJilid); // mulai muat data suara paralel dengan gambar

    if (currentPageObjectUrl) {
        URL.revokeObjectURL(currentPageObjectUrl);
        currentPageObjectUrl = null;
    }

    if (spinner) spinner.style.display = 'block';
    container.innerHTML = "";
    container.style.backgroundImage = '';
    stopPagePlayer(true);
    hidePagePlayer();
    updateJilidBadge();

    let img = new Image();
    img.draggable = false;
    img.alt = `${getJilidTitle(currentJilid)}, halaman ${currentPage}`;
    img.onload = function() {
        if (requestId !== pageLoadRequestId) return;
        if (spinner) spinner.style.display = 'none';
        container.style.backgroundImage = '';
        container.innerHTML = "";
        container.appendChild(img);

        const blocksJilid = currentJilid;
        const blocksPage = currentPage;
        loadJilidConfig(blocksJilid).then((cfg) => {
            if (requestId !== pageLoadRequestId) return;
            const blocks = cfg && cfg[blocksPage];
            if (!blocks) return;
            let audioWarmed = false;
            blocks.forEach(block => {
                let [top, left, width, height, soundFile] = block;
                const soundBlock = document.createElement('div');
                soundBlock.className = 'sound-block';
                soundBlock.style.cssText = `top: ${top}%; left: ${left}%; width: ${width}%; height: ${height}%;`;
                soundBlock.onclick = () => {
                    playSound(soundFile);
                    // Ketukan pertama di halaman ini: siapkan audio blok lainnya di latar belakang
                    if (!audioWarmed) {
                        audioWarmed = true;
                        prefetchPageAudio(blocksJilid, blocksPage, blocks, soundFile);
                    }
                };
                container.appendChild(soundBlock);
            });
            setPagePlayerBlocks(blocksJilid, blocksPage, blocks);
        });

        schedulePrefetchNeighbors(requestId);
    };
    img.onerror = function() {
        if (requestId !== pageLoadRequestId) return;
        if (directFallbacks.length) {
            img.src = directFallbacks.shift();
            return;
        }
        if (spinner) spinner.style.display = 'none';
        container.style.backgroundImage = '';
        container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444;font-size:13px;">Gagal memuat halaman</div>`;
    };

    const loadCachedImage = async () => {
        if (!window.caches) return imgPath;
        try {
            // Halaman belum ada di perangkat: tampilkan pratinjau buram kecil dulu
            // sementara gambar penuh diunduh.
            if (!(await matchPageCache(currentJilid, currentPage)) && requestId === pageLoadRequestId && navigator.onLine) {
                const lqip = `${CLOUDINARY_BASE_URL}/image/upload/f_webp,q_20,w_48,e_blur:300/t${currentJilid}_${getPageIdVariants(currentPage)[0]}.jpg`;
                container.style.backgroundImage = `url("${lqip}")`;
                container.style.backgroundSize = '100% 100%';
                container.style.backgroundRepeat = 'no-repeat';
            }
            await ensurePageCached(currentJilid, currentPage);
            const response = await matchPageCache(currentJilid, currentPage);
            if (!response) return imgPath;
            return URL.createObjectURL(await response.blob());
        } catch (error) {
            console.warn('Cache gambar halaman tidak tersedia:', error);
            return imgPath;
        }
    };

    loadCachedImage().then((imageSource) => {
        if (requestId !== pageLoadRequestId) {
            if (imageSource.startsWith('blob:')) URL.revokeObjectURL(imageSource);
            return;
        }
        if (imageSource.startsWith('blob:')) currentPageObjectUrl = imageSource;
        img.src = imageSource;
    });

    // Jilid di Pintasan berubah (mis. lewat halaman berikut/riwayat): susun ulang daftar halamannya
    const jilidSelectRead = document.getElementById('jumpJilidRead');
    if (jilidSelectRead && String(jilidSelectRead.value) !== String(currentJilid)) {
        jilidSelectRead.value = currentJilid;
        updatePageOptions('Read');
    }
    let numList = getNumericPageList(currentJilid);
    if (numList.includes(currentPage.toString())) {
        document.getElementById('jumpPageSelectRead').value = currentPage;
    }
}
