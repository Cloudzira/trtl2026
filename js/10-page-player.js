/* =====================================================================
   TartiliKu - Pemutar Audio Satu Halaman & Suara
   Berkas : js/10-page-player.js  (urutan muat ke-10 dari 17)
   Tugas  : Pemutar audio per halaman (play/jeda/kecepatan), pemanasan audio,
            dan suara blok.
   Isi    : ppEl, ppUpdateUI, ppHighlight, ppEnsureVisible,
            setPagePlayerBlocks, hidePagePlayer, ppBuildAudio,
            ppPlayCurrent, ppFinish, startPagePlayer, togglePagePlayer,
            stopPagePlayer, cyclePagePlayerRate, prefetchPageAudio,
            playSound, resetRecording
   ===================================================================== */

// ===== PEMUTAR AUDIO 1 HALAMAN =====
// Memutar semua blok suara di halaman aktif secara berurutan (urutan data = urutan baca),
// dengan blok yang sedang bunyi menyala. Bisa dijeda, dihentikan, dan diatur kecepatannya.
var pagePlayerState = { blocks: [], jilid: null, page: null, index: 0, playing: false, paused: false,
                        audio: null, nextAudio: null, nextIndex: -1, timer: null, seq: 0, resumeNext: false };
var PAGE_PLAYER_RATES = [1, 0.75, 1.25];
var pagePlayerRate = (function () {
    const r = parseFloat(localStorage.getItem('tartili_page_rate'));
    return PAGE_PLAYER_RATES.includes(r) ? r : 1;
})();

function ppEl(id) { return document.getElementById(id); }

function ppUpdateUI() {
    const st = pagePlayerState;
    const active = st && st.playing;
    const extra = ppEl('ppExtra'), play = ppEl('ppIconPlay'), pause = ppEl('ppIconPause'), main = ppEl('ppMain');
    if (extra) extra.style.display = active ? 'flex' : 'none';
    if (play) play.style.display = (active && !st.paused) ? 'none' : 'block';
    if (pause) pause.style.display = (active && !st.paused) ? 'block' : 'none';
    if (main) {
        const label = !active ? 'Putar semua audio halaman ini' : (st.paused ? 'Lanjutkan' : 'Jeda');
        main.title = label; main.setAttribute('aria-label', label);
    }
    const speed = ppEl('ppSpeed');
    if (speed) speed.textContent = String(pagePlayerRate).replace('.', ',') + '×';
    const count = ppEl('ppCount');
    if (count && st) count.textContent = `${Math.min(st.index + 1, st.blocks.length)}/${st.blocks.length}`;
}

function ppHighlight(index) {
    const container = ppEl('imageContainer');
    if (!container) return;
    container.querySelectorAll('.sound-block.playing').forEach((el) => el.classList.remove('playing'));
    if (index == null || index < 0) return;
    const el = container.querySelectorAll('.sound-block')[index];
    if (el) { el.classList.add('playing'); ppEnsureVisible(el); }
}

// Pastikan blok yang sedang bunyi terlihat di layar (terutama mode landscape, saat halaman perlu digulir)
function ppEnsureVisible(el) {
    const area = document.getElementById('scrollArea');
    if (!el || !area) return;
    const r = el.getBoundingClientRect();
    const a = area.getBoundingClientRect();
    const margin = 36;
    if (r.top >= a.top + margin && r.bottom <= a.bottom - margin) return;   // sudah terlihat penuh
    const delta = (r.top + r.height / 2) - (a.top + a.height / 2);
    try { area.scrollBy({ top: delta, behavior: 'smooth' }); } catch (e) { area.scrollTop += delta; }
}

// Dipanggil setiap halaman selesai memasang blok suara
function setPagePlayerBlocks(jilid, page, blocks) {
    stopPagePlayer(true);
    pagePlayerState.blocks = blocks || [];
    pagePlayerState.jilid = jilid;
    pagePlayerState.page = page;
    const box = ppEl('pagePlayer');
    if (box) box.style.display = pagePlayerState.blocks.length ? 'flex' : 'none';
    ppUpdateUI();
    // Petunjuk satu kali saja
    if (pagePlayerState.blocks.length && !localStorage.getItem('tartili_hint_pageplayer')) {
        try { localStorage.setItem('tartili_hint_pageplayer', '1'); } catch (e) { /* abaikan */ }
        showToast('Ketuk ▶ di pojok kanan atas untuk memutar semua audio halaman ini.');
    }
}

function hidePagePlayer() {
    const box = ppEl('pagePlayer');
    if (box) box.style.display = 'none';
}

function ppBuildAudio(i) {
    const st = pagePlayerState;
    const a = new Audio(getPageAudioUrl(st.jilid, st.page, st.blocks[i][4]));
    a.preload = 'auto';
    a.defaultPlaybackRate = pagePlayerRate;
    a.playbackRate = pagePlayerRate;
    return a;
}

function ppPlayCurrent() {
    const st = pagePlayerState;
    if (!st.playing) return;
    const i = st.index;
    if (i >= st.blocks.length) { ppFinish(); return; }

    const seq = ++st.seq;
    const a = (st.nextAudio && st.nextIndex === i) ? st.nextAudio : ppBuildAudio(i);
    st.nextAudio = null; st.nextIndex = -1;
    a.defaultPlaybackRate = pagePlayerRate;
    a.playbackRate = pagePlayerRate;
    st.audio = a;
    ppHighlight(i);
    ppUpdateUI();

    const advance = () => {
        if (seq !== st.seq || !st.playing) return;
        // jeda singkat antar blok supaya tiap bunyi terdengar jelas
        st.resumeNext = true;
        st.timer = setTimeout(() => {
            st.timer = null; st.resumeNext = false;
            if (seq !== st.seq || !st.playing || st.paused) return;
            st.index = i + 1;
            ppPlayCurrent();
        }, 350);
    };
    a.onended = advance;
    a.onerror = () => { if (seq === st.seq && st.playing) { st.index = i + 1; ppPlayCurrent(); } };
    const p = a.play();
    if (p && p.catch) p.catch(() => { if (seq === st.seq && st.playing && !st.paused) { st.index = i + 1; ppPlayCurrent(); } });

    // siapkan audio berikutnya supaya tidak ada jeda unduh
    if (i + 1 < st.blocks.length) { st.nextAudio = ppBuildAudio(i + 1); st.nextIndex = i + 1; }
}

function ppFinish() {
    const st = pagePlayerState;
    st.playing = false; st.paused = false; st.index = 0; st.audio = null; st.nextAudio = null; st.resumeNext = false;
    ppHighlight(-1);
    ppUpdateUI();
}

function startPagePlayer() {
    const st = pagePlayerState;
    if (!st.blocks.length) return;
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }   // hentikan ketukan blok tunggal
    st.playing = true; st.paused = false; st.index = 0; st.resumeNext = false;
    // pemanasan audio seluruh halaman (sama seperti setelah ketukan pertama)
    prefetchPageAudio(st.jilid, st.page, st.blocks, null);
    ppPlayCurrent();
}

function togglePagePlayer() {
    const st = pagePlayerState;
    if (!st.playing) { startPagePlayer(); return; }
    if (!st.paused) {
        st.paused = true;
        if (st.timer) { clearTimeout(st.timer); st.timer = null; }
        if (st.audio) st.audio.pause();
    } else {
        st.paused = false;
        if (st.resumeNext) {            // dijeda saat jeda antar blok -> lanjut ke blok berikutnya
            st.resumeNext = false;
            st.index = st.index + 1;
            ppPlayCurrent();
        } else if (st.audio) {
            const p = st.audio.play();
            if (p && p.catch) p.catch(() => {});
        }
    }
    ppUpdateUI();
}

// silent = true: dipanggil otomatis (ganti halaman, ketuk blok tunggal), tanpa mengubah tampilan tombol berlebihan
function stopPagePlayer(silent) {
    const st = pagePlayerState;
    if (!st) return;
    st.seq++;
    if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    if (st.audio) { try { st.audio.pause(); } catch (e) { /* abaikan */ } }
    st.audio = null; st.nextAudio = null; st.nextIndex = -1; st.resumeNext = false;
    const was = st.playing;
    st.playing = false; st.paused = false; st.index = 0;
    if (was || !silent) { ppHighlight(-1); }
    ppUpdateUI();
}

function cyclePagePlayerRate() {
    const idx = PAGE_PLAYER_RATES.indexOf(pagePlayerRate);
    pagePlayerRate = PAGE_PLAYER_RATES[(idx + 1) % PAGE_PLAYER_RATES.length];
    try { localStorage.setItem('tartili_page_rate', String(pagePlayerRate)); } catch (e) { /* abaikan */ }
    const st = pagePlayerState;
    if (st.audio) { st.audio.defaultPlaybackRate = pagePlayerRate; st.audio.playbackRate = pagePlayerRate; }
    if (st.nextAudio) { st.nextAudio.defaultPlaybackRate = pagePlayerRate; st.nextAudio.playbackRate = pagePlayerRate; }
    ppUpdateUI();
}

window.togglePagePlayer = togglePagePlayer;
window.stopPagePlayer = stopPagePlayer;
window.cyclePagePlayerRate = cyclePagePlayerRate;

// Pemanasan audio: setelah siswa mengetuk satu blok, audio blok lain di halaman yang sama
// diunduh pelan-pelan di latar belakang (maksimal 3 sekaligus) supaya ketukan berikutnya langsung bunyi.
// Tidak dilakukan saat Penghemat Data aktif atau koneksi sangat lambat.
const warmedAudioUrls = new Set();
function prefetchPageAudio(jilid, page, blocks, exceptSoundFile) {
    if (!blocks || shouldSkipPrefetch()) return;
    const urls = [];
    blocks.forEach((b) => {
        if (!b || !b[4] || b[4] === exceptSoundFile) return;
        const u = getPageAudioUrl(jilid, page, b[4]);
        if (!warmedAudioUrls.has(u)) urls.push(u);
    });
    if (!urls.length || urls.length > 80) return;
    let i = 0;
    const next = () => {
        if (i >= urls.length) return;
        const u = urls[i++];
        warmedAudioUrls.add(u);
        fetch(u, { mode: 'no-cors' }).catch(() => {}).then(() => setTimeout(next, 40));
    };
    next(); next(); next();
}

function playSound(soundFile) {
    stopPagePlayer(true);
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
    currentAudio = new Audio(getPageAudioUrl(currentJilid, currentPage, soundFile));
    const p = currentAudio.play();
    if (p && p.catch) p.catch((err) => console.warn('Audio tidak bisa diputar:', err));
}

function resetRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') { mediaRecorder.stop(); }
    audioChunks = []; recordedAudioBlob = null; recordingQualityIssue = '';
    const playbackEl = document.getElementById('playbackAudioEl');
    if (playbackEl) { playbackEl.pause(); playbackEl.removeAttribute('src'); }
    const btnRec = document.getElementById('btnRec');
    const btnStop = document.getElementById('btnStop');
    const btnPlay = document.getElementById('btnPlay');
    const btnSend = document.getElementById('btnSend');
    if (btnRec) { btnRec.disabled = false; btnRec.classList.remove('is-recording'); }
    if (btnStop) btnStop.disabled = true;
    if (btnPlay) { btnPlay.disabled = true; btnPlay.innerText = '▶ Play'; }
    if (btnSend) { btnSend.disabled = true; btnSend.innerText = 'Kirim'; }
}

// Daftar format audio dari kualitas terbaik ke yang paling umum
// didukung -- dipilih otomatis sesuai kemampuan browser pengguna.
const PREFERRED_AUDIO_MIME_TYPES = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
    'audio/mp4'
];
