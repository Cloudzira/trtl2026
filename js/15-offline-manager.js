/* =====================================================================
   TartiliKu - Simpan Jilid untuk Offline
   Berkas : js/15-offline-manager.js  (urutan muat ke-15 dari 17)
   Tugas  : Mengunduh gambar + audio satu jilid ke perangkat, menampilkan
            status, dan menghapusnya.
   Isi    : getJilidAudioUrls, formatBytes, getJilidOfflineStatus,
            renderOfflineRow, refreshOfflineRow, refreshOfflineStorage,
            openOfflineManager, closeOfflineManager, downloadAudioToCache,
            downloadJilidOffline, deleteJilidOffline
   ===================================================================== */

// =====================================================================
// SIMPAN JILID UNTUK OFFLINE
// Mengunduh semua gambar halaman + semua suara satu jilid ke penyimpanan
// perangkat. Status dihitung langsung dari isi cache (bukan dari catatan),
// jadi selalu sesuai kenyataan.
// =====================================================================
const offlineDownloads = {}; // jilid -> { cancelled, done, total, failed }
const OFFLINE_JILID_LIST = [1, 2, 3, 4, 5, 6, 7];

function getJilidAudioUrls(jilid, cfg) {
    const urls = [];
    if (!cfg) return urls;
    Object.keys(cfg).forEach((page) => {
        (cfg[page] || []).forEach((block) => urls.push(getPageAudioUrl(jilid, page, block[4])));
    });
    return Array.from(new Set(urls));
}

function formatBytes(n) {
    if (!n) return '0 MB';
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
    return (n / (1024 * 1024)).toFixed(n < 100 * 1024 * 1024 ? 1 : 0) + ' MB';
}

async function getJilidOfflineStatus(jilid) {
    const cfg = await loadJilidConfig(jilid);
    const audioUrls = getJilidAudioUrls(jilid, cfg);
    const pages = getFullPageList(jilid);
    const imgCache = await caches.open(OFFLINE_IMAGE_CACHE);
    const cachedUrls = new Set((await imgCache.keys()).map((r) => r.url));
    const mediaCache = await caches.open(MEDIA_CACHE_NAME);
    const cachedAudio = new Set((await mediaCache.keys()).map((r) => r.url));
    return {
        pagesTotal: pages.length,
        pagesDone: pages.filter((p) => getPageImageKeys(jilid, p).some((k) => cachedUrls.has(k))).length,
        audioTotal: audioUrls.length,
        audioDone: audioUrls.filter((u) => cachedAudio.has(u)).length
    };
}

function renderOfflineRow(jilid, status) {
    const sub = document.getElementById('offline-sub-' + jilid);
    const bar = document.getElementById('offline-bar-' + jilid);
    const btn = document.getElementById('offline-btn-' + jilid);
    const del = document.getElementById('offline-del-' + jilid);
    if (!sub || !bar || !btn || !del) return;
    const running = offlineDownloads[jilid];
    if (running) {
        const pct = running.total ? Math.round((running.done / running.total) * 100) : 0;
        sub.textContent = `Mengunduh... ${pct}%` + (running.failed ? ` (${running.failed} gagal)` : '');
        bar.style.width = pct + '%';
        btn.textContent = 'Batal';
        btn.onclick = () => { running.cancelled = true; };
        btn.disabled = false;
        del.style.display = 'none';
        return;
    }
    if (!status) { sub.textContent = 'Memeriksa...'; bar.style.width = '0%'; btn.disabled = true; del.style.display = 'none'; return; }
    const total = status.pagesTotal + status.audioTotal;
    const done = status.pagesDone + status.audioDone;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const complete = total > 0 && done >= total;
    bar.style.width = pct + '%';
    btn.disabled = false;
    btn.onclick = () => downloadJilidOffline(jilid);
    if (complete) {
        sub.textContent = `✓ Tersimpan (${status.pagesDone} halaman, ${status.audioDone} suara)`;
        btn.textContent = 'Perbarui';
    } else if (done > 0) {
        sub.textContent = `Tersimpan sebagian: ${pct}%`;
        btn.textContent = 'Lengkapi';
    } else {
        sub.textContent = 'Belum disimpan';
        btn.textContent = 'Unduh';
    }
    del.style.display = done > 0 ? 'inline-block' : 'none';
}

async function refreshOfflineRow(jilid) {
    renderOfflineRow(jilid, null);
    try { renderOfflineRow(jilid, await getJilidOfflineStatus(jilid)); }
    catch (e) { const sub = document.getElementById('offline-sub-' + jilid); if (sub) sub.textContent = 'Tidak dapat memeriksa'; }
}

async function refreshOfflineStorage() {
    const el = document.getElementById('offlineStorageText');
    if (!el) return;
    try {
        if (navigator.storage && navigator.storage.estimate) {
            const est = await navigator.storage.estimate();
            el.textContent = `Ruang yang dipakai aplikasi: ${formatBytes(est.usage || 0)}`;
            return;
        }
    } catch (e) { /* abaikan */ }
    el.textContent = '';
}

function openOfflineManager() {
    const list = document.getElementById('offlineList');
    if (!list) return;
    if (!window.caches) { showToast('Browser Anda belum mendukung penyimpanan offline.'); return; }
    list.innerHTML = '';
    OFFLINE_JILID_LIST.forEach((j) => {
        const row = document.createElement('div');
        row.className = 'offline-row';
        row.innerHTML =
            '<div class="offline-row-info">' +
                '<div class="offline-row-title">' + getJilidFullLabel(j) + '</div>' +
                '<div class="offline-row-sub" id="offline-sub-' + j + '">Memeriksa...</div>' +
                '<div class="offline-bar"><div class="offline-bar-fill" id="offline-bar-' + j + '"></div></div>' +
            '</div>' +
            '<div class="offline-row-actions">' +
                '<button type="button" class="offline-btn" id="offline-btn-' + j + '">...</button>' +
                '<button type="button" class="offline-btn-del" id="offline-del-' + j + '" onclick="deleteJilidOffline(' + j + ')">Hapus</button>' +
            '</div>';
        list.appendChild(row);
    });
    document.getElementById('offline-modal').classList.add('open');
    OFFLINE_JILID_LIST.forEach((j) => refreshOfflineRow(j));
    refreshOfflineStorage();
}

function closeOfflineManager() {
    const m = document.getElementById('offline-modal');
    if (m) m.classList.remove('open');
}

async function downloadAudioToCache(cache, url) {
    if (await cache.match(url)) return;
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    await cache.put(url, res);
}

async function downloadJilidOffline(jilid) {
    if (!window.caches) { showToast('Browser Anda belum mendukung penyimpanan offline.'); return; }
    if (!navigator.onLine) { showToast('Anda sedang offline. Sambungkan internet untuk mengunduh.'); return; }
    if (offlineDownloads[jilid]) return;
    if (!confirm('Unduh ' + getJilidFullLabel(jilid) + ' untuk dibaca tanpa internet?\n\nSemua halaman dan suara jilid ini akan disimpan di perangkat dan memakai data internet. Disarankan memakai Wi-Fi.')) return;

    const state = { cancelled: false, done: 0, total: 0, failed: 0 };
    offlineDownloads[jilid] = state;
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* abaikan */ }
    renderOfflineRow(jilid, null);
    const sub = document.getElementById('offline-sub-' + jilid);
    if (sub) sub.textContent = 'Menyiapkan...';

    try {
        const cfg = await loadJilidConfig(jilid);
        const pages = getFullPageList(jilid);
        const audioUrls = getJilidAudioUrls(jilid, cfg);
        const mediaCache = await caches.open(MEDIA_CACHE_NAME);
        const tasks = [
            ...pages.map((p) => () => ensurePageCached(jilid, p, true)),
            ...audioUrls.map((u) => () => downloadAudioToCache(mediaCache, u))
        ];
        state.total = tasks.length;
        let next = 0;
        const worker = async () => {
            while (!state.cancelled) {
                if (!navigator.onLine) { state.cancelled = true; state.lostConnection = true; return; }
                const i = next++;
                if (i >= tasks.length) return;
                try { await tasks[i](); } catch (e) { state.failed++; }
                state.done++;
                renderOfflineRow(jilid, null);
            }
        };
        await Promise.all(Array.from({ length: 5 }, worker));
    } catch (e) {
        console.warn('Unduhan offline gagal:', e);
    }

    const finished = !state.cancelled;
    delete offlineDownloads[jilid];
    await refreshOfflineRow(jilid);
    refreshOfflineStorage();
    if (state.lostConnection) showToast('Koneksi terputus. Yang sudah tersimpan aman, tekan Lengkapi untuk melanjutkan.');
    else if (!finished) showToast('Unduhan dibatalkan. Yang sudah tersimpan tetap aman.');
    else if (state.failed) showToast('Selesai, tetapi ' + state.failed + ' berkas gagal. Tekan Lengkapi untuk mencoba lagi.');
    else showToast(getJilidFullLabel(jilid) + ' siap dipakai offline.');
}

async function deleteJilidOffline(jilid) {
    if (offlineDownloads[jilid]) return;
    if (!confirm('Hapus data offline ' + getJilidFullLabel(jilid) + ' dari perangkat ini?')) return;
    try {
        const imgCache = await caches.open(OFFLINE_IMAGE_CACHE);
        const re = new RegExp('/image/upload/(?:[^/]+/)?t' + jilid + '_');
        for (const req of await imgCache.keys()) { if (re.test(req.url)) await imgCache.delete(req); }
        const mediaCache = await caches.open(MEDIA_CACHE_NAME);
        const audioRe = new RegExp('/video/upload/t' + jilid + '_h');
        for (const req of await mediaCache.keys()) { if (audioRe.test(req.url)) await mediaCache.delete(req); }
    } catch (e) { console.warn('Gagal menghapus data offline:', e); }
    await refreshOfflineRow(jilid);
    refreshOfflineStorage();
    showToast('Data offline ' + getJilidFullLabel(jilid) + ' dihapus.');
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeOfflineManager(); closeInstallHelp(); } });
