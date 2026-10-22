/* =====================================================================
   TartiliKu - Fitur belajar tambahan (dimuat SETELAH app.js)
   1. Guru: "Tandai blok" saat menilai (merah = salah, kuning = kurang)
   1b. Siswa: "Perbaiki blok" yang ditandai guru (dengar contoh, rekam ulang, bandingkan)
   2. Mode Talaqqi: dengar -> tirukan -> bandingkan (rekaman hanya di perangkat)
   6. Guru: Laporan orang tua (kirim lewat WhatsApp)
   7. Tebak Bunyi: dengar bunyi, ketuk blok yang cocok
   Memakai fungsi/variabel global di app.js (loadJilidConfig, getPageAudioUrl, dst).
   ===================================================================== */
(function () {
    'use strict';

    const KKM = 75;   // nilai minimal "lulus" untuk Laporan Orang Tua
    const $ = (id) => document.getElementById(id);
    const esc = (s) => (typeof riwayatEsc === 'function' ? riwayatEsc(s) : String(s == null ? '' : s));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // ---------------------------------------------------------------- modal dinamis
    const closers = {};
    function ensureModal(id) {
        let m = $(id);
        if (!m) {
            m = document.createElement('div');
            m.id = id; m.className = 'modal-overlay';
            m.innerHTML = `<div class="modal-box bj-box"><div class="modal-header"><h3 id="${id}-title"></h3>` +
                `<button class="modal-close-btn" aria-label="Tutup">✕</button></div><div class="bj-body" id="${id}-body"></div></div>`;
            document.body.appendChild(m);
            m.querySelector('.modal-close-btn').addEventListener('click', () => closeModal(id));
        }
        return m;
    }
    function openModal(id, title, onClose) {
        const m = ensureModal(id);
        $(id + '-title').textContent = title;
        closers[id] = onClose || null;
        m.classList.add('active');
        return $(id + '-body');
    }
    function closeModal(id) {
        const m = $(id);
        if (m) m.classList.remove('active');
        const fn = closers[id]; closers[id] = null;
        if (fn) { try { fn(); } catch (e) { /* abaikan */ } }
    }

    // ---------------------------------------------------------------- audio & rekaman
    let bjAudio = null;
    function stopAllAudio() {
        try { if (typeof stopPagePlayer === 'function') stopPagePlayer(true); } catch (e) { /* abaikan */ }
        try { if (typeof currentAudio !== 'undefined' && currentAudio) currentAudio.pause(); } catch (e) { /* abaikan */ }
        if (bjAudio) { try { bjAudio.pause(); } catch (e) { /* abaikan */ } bjAudio = null; }
    }
    // Memutar satu berkas audio sampai selesai. Hasil: { ok, duration }
    function playAudioUrl(url) {
        return new Promise((resolve) => {
            if (bjAudio) { try { bjAudio.pause(); } catch (e) { /* abaikan */ } }
            const a = new Audio(url); bjAudio = a;
            let done = false;
            const fin = (ok) => { if (done) return; done = true; resolve({ ok, duration: isFinite(a.duration) ? a.duration : 0 }); };
            a.onended = () => fin(true);
            a.onerror = () => fin(false);
            a.onpause = () => { if (!a.ended) fin(false); };
            const p = a.play();
            if (p && p.catch) p.catch(() => fin(false));
        });
    }
    async function recorderStart() {
        if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('no-recorder');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        const finished = new Promise((res) => {
            rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); res(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); };
        });
        rec.start();
        return { stop: () => { if (rec.state !== 'inactive') rec.stop(); return finished; } };
    }

    // ---------------------------------------------------------------- data halaman
    async function getPageData(jilid, page) {
        const cfg = await loadJilidConfig(jilid);
        const blocks = (cfg && cfg[page]) || [];
        let src = null, revoke = () => {};
        try {
            await ensurePageCached(jilid, page);
            const resp = await matchPageCache(jilid, page);
            if (resp) { const u = URL.createObjectURL(await resp.blob()); src = u; revoke = () => URL.revokeObjectURL(u); }
        } catch (e) { /* pakai alamat langsung */ }
        if (!src) src = getPageImageUrl(jilid, page);
        const ar = await new Promise((res) => {
            const im = new Image();
            im.onload = () => res(im.naturalWidth / im.naturalHeight || 1 / 1.414);
            im.onerror = () => res(1 / 1.414);
            im.src = src;
        });
        return { jilid, page, blocks, src, ar, revoke };
    }
    const blockUrl = (pd, i) => getPageAudioUrl(pd.jilid, pd.page, pd.blocks[i][4]);

    function buildStage(host, pd, onTap) {
        host.innerHTML = '';
        const st = document.createElement('div'); st.className = 'bj-stage';
        const img = document.createElement('img');
        img.src = pd.src; img.draggable = false; img.alt = `${getJilidTitle(pd.jilid)}, halaman ${pd.page}`;
        st.appendChild(img);
        const els = pd.blocks.map((b, i) => {
            const el = document.createElement('button');
            el.type = 'button'; el.className = 'bj-b';
            el.style.cssText = `top:${b[0]}%;left:${b[1]}%;width:${b[2]}%;height:${b[3]}%`;
            el.setAttribute('aria-label', `Blok ${i + 1}`);
            el.addEventListener('click', () => onTap(i, el));
            st.appendChild(el);
            return el;
        });
        host.appendChild(st);
        return els;
    }
    function barsHtml(heights) { return heights.map((h) => `<i style="--h:${h}px"></i>`).join(''); }
    const BARS_A = [14, 26, 38, 22, 34, 44, 30, 18, 28, 40, 24, 12, 20, 32, 16];
    const BARS_B = [10, 22, 30, 18, 28, 36, 24, 14, 26, 34, 20, 10, 16, 28, 12];

    // ---------------------------------------------------------------- menu latihan
    function currentPageBlocks() {
        const cfg = (typeof allAudioConfig !== 'undefined') ? allAudioConfig[String(currentJilid)] : null;
        return (cfg && cfg[currentPage]) || [];
    }
    function openPracticeMenu() {
        if (!currentPageBlocks().length) { showToast('Halaman ini belum punya audio untuk dilatih.'); return; }
        stopAllAudio();
        const body = openModal('bjPracticeModal', '🎯 Mode Latihan');
        body.innerHTML = `
            <div class="bj-sub">${esc(getJilidFullLabel(currentJilid))} • Halaman ${esc(currentPage)}</div>
            <button type="button" class="bj-card" id="bjGoTalaqqi">
                <b>🎧 Mode Talaqqi</b><span>Dengar contoh, tirukan, lalu bandingkan dengan suaramu. Rekaman hanya di perangkat ini.</span>
            </button>
            <button type="button" class="bj-card" id="bjGoGuess">
                <b>👂 Tebak Bunyi</b><span>Dengarkan bunyinya, lalu ketuk blok yang cocok di halaman.</span>
            </button>`;
        $('bjGoTalaqqi').onclick = openTalaqqi;
        $('bjGoGuess').onclick = openGuess;
    }

    // ================================================================ 2. MODE TALAQQI
    async function openTalaqqi() {
        closeModal('bjPracticeModal');
        const jilid = currentJilid, page = currentPage;
        const session = { alive: true, runId: 0, rec: null };
        const body = openModal('bjTalaqqiModal', '🎧 Mode Talaqqi', () => {
            session.alive = false; stopAllAudio();
            if (session.rec) { session.rec.stop().catch(() => {}); session.rec = null; }
            if (pd) pd.revoke();
        });
        let pd = null;
        body.innerHTML = '<div class="bj-note">Memuat halaman…</div>';
        pd = await getPageData(jilid, page);
        if (!session.alive) { pd.revoke(); return; }
        if (!pd.blocks.length) { body.innerHTML = '<div class="bj-note">Halaman ini belum punya audio.</div>'; return; }

        let idx = 0;
        body.innerHTML = `
            <div class="bj-sub" id="tlInfo"></div>
            <div class="bj-steps"><span class="bj-chip" id="tlS1">1 Dengar</span><span class="bj-chip" id="tlS2">2 Tirukan</span><span class="bj-chip" id="tlS3">3 Bandingkan</span></div>
            <div class="bj-cropwrap" id="tlCrop"></div>
            <div class="bj-wave"><div class="bj-wave-label">Contoh</div><div class="bj-bars" id="tlBarsA">${barsHtml(BARS_A)}</div></div>
            <div class="bj-wave"><div class="bj-wave-label">Suaramu (hanya tersimpan di HP)</div><div class="bj-bars me" id="tlBarsB">${barsHtml(BARS_B)}</div></div>
            <div class="bj-status" id="tlStatus" aria-live="polite"></div>
            <div class="bj-actions"><button type="button" class="bj-btn ghost" id="tlRepeat">Ulangi</button><button type="button" class="bj-btn" id="tlNext">Blok berikutnya</button></div>`;

        const setStep = (n) => [1, 2, 3].forEach((k) => $('tlS' + k).classList.toggle('on', k === n));
        const setLive = (id, on) => $(id).classList.toggle('live', !!on);
        const status = (t) => { $('tlStatus').textContent = t; };
        const crop = (i) => {
            const [top, left, w, h] = pd.blocks[i];
            $('tlCrop').innerHTML = `<div class="bj-cropbox" style="--ar:${(w * pd.ar) / h}"><img alt="" src="${pd.src}" style="width:${10000 / w}%;left:${(-left / w) * 100}%;top:${(-top / h) * 100}%"></div>`;
        };
        function cancelRun() {
            session.runId++;
            stopAllAudio();
            if (session.rec) { session.rec.stop().catch(() => {}); session.rec = null; }
            setLive('tlBarsA', false); setLive('tlBarsB', false);
        }
        async function waitAlive(ms, alive) { const end = Date.now() + ms; while (Date.now() < end && alive()) await sleep(100); }

        async function runBlock() {
            cancelRun();
            const my = session.runId;
            const alive = () => session.alive && my === session.runId;
            $('tlInfo').textContent = `${getJilidFullLabel(jilid)} • Hal. ${page} • blok ${idx + 1} dari ${pd.blocks.length}`;
            $('tlNext').textContent = idx >= pd.blocks.length - 1 ? 'Selesai' : 'Blok berikutnya';
            crop(idx);
            const url = blockUrl(pd, idx);

            setStep(1); status('Dengarkan dulu…'); setLive('tlBarsA', true);
            const r1 = await playAudioUrl(url);
            setLive('tlBarsA', false);
            if (!alive()) return;
            if (!r1.ok) { status('Audio blok ini belum bisa diputar.'); setStep(0); return; }

            setStep(2);
            let rec = null;
            try { rec = await recorderStart(); } catch (e) { rec = null; }
            if (!alive()) { if (rec) rec.stop().catch(() => {}); return; }
            if (!rec) { status('Izinkan mikrofon untuk menirukan dan membandingkan suaramu.'); setStep(0); return; }
            session.rec = rec;
            status('Sekarang tirukan…'); setLive('tlBarsB', true);
            await waitAlive(Math.min(9000, Math.max(2500, (r1.duration || 2) * 1000 * 1.8 + 800)), alive);
            const blob = await rec.stop(); session.rec = null;
            setLive('tlBarsB', false);
            if (!alive()) return;

            setStep(3); status('Bandingkan: contoh, lalu suaramu…');
            setLive('tlBarsA', true); await playAudioUrl(url); setLive('tlBarsA', false);
            if (!alive()) return;
            const mine = URL.createObjectURL(blob);
            setLive('tlBarsB', true); await playAudioUrl(mine); setLive('tlBarsB', false);
            URL.revokeObjectURL(mine);
            if (!alive()) return;
            status('Selesai. Ulangi kalau belum puas, atau lanjut ke blok berikutnya.');
        }

        $('tlRepeat').onclick = () => runBlock();
        $('tlNext').onclick = () => {
            if (idx >= pd.blocks.length - 1) { closeModal('bjTalaqqiModal'); showToast('Latihan Talaqqi satu halaman selesai. Barakallah!'); return; }
            idx++; runBlock();
        };
        runBlock();
    }

    // ================================================================ 7. TEBAK BUNYI
    function streakInfo() {
        let s = null; try { s = JSON.parse(localStorage.getItem('tartili_streak') || 'null'); } catch (e) { s = null; }
        if (!s) return 0;
        const today = ymd(new Date()), yest = ymd(new Date(Date.now() - 864e5));
        return (s.last === today || s.last === yest) ? s.count : 0;
    }
    function bumpStreak() {
        let s = null; try { s = JSON.parse(localStorage.getItem('tartili_streak') || 'null'); } catch (e) { s = null; }
        s = s || { last: '', count: 0 };
        const today = ymd(new Date()), yest = ymd(new Date(Date.now() - 864e5));
        if (s.last !== today) { s.count = (s.last === yest) ? s.count + 1 : 1; s.last = today; }
        try { localStorage.setItem('tartili_streak', JSON.stringify(s)); } catch (e) { /* abaikan */ }
        return s.count;
    }
    function shuffle(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

    async function openGuess() {
        closeModal('bjPracticeModal');
        const jilid = currentJilid, page = currentPage;
        const session = { alive: true };
        let pd = null;
        const body = openModal('bjGuessModal', '👂 Tebak Bunyi', () => { session.alive = false; stopAllAudio(); if (pd) pd.revoke(); });
        body.innerHTML = '<div class="bj-note">Memuat halaman…</div>';
        pd = await getPageData(jilid, page);
        if (!session.alive) { pd.revoke(); return; }
        if (pd.blocks.length < 2) { body.innerHTML = '<div class="bj-note">Halaman ini terlalu sedikit blok untuk permainan.</div>'; return; }

        let order, qi, score, target, locked, els;
        function start() {
            order = shuffle(pd.blocks.map((_, i) => i)).slice(0, Math.min(8, pd.blocks.length));
            qi = 0; score = 0;
            body.innerHTML = `
                <div class="bj-sub">${esc(getJilidFullLabel(jilid))} • Hal. ${esc(page)} • <span id="tbQ"></span></div>
                <div class="bj-card static" style="flex-direction:row;align-items:center;justify-content:center;gap:14px">
                    <button type="button" class="bj-btn round" id="tbPlay" aria-label="Putar bunyi">▶</button>
                    <span class="bj-sub">Ketuk untuk<br>mendengar lagi</span>
                </div>
                <div id="tbStage"></div>
                <div class="bj-feedback" id="tbFb" style="display:none"></div>
                <div class="bj-row"><span class="bj-chip on" id="tbScore"></span><span class="bj-chip" id="tbStreak"></span></div>
                <button type="button" class="bj-btn" id="tbNext" style="display:none"></button>`;
            els = buildStage($('tbStage'), pd, onTap);
            $('tbPlay').onclick = () => playTarget();
            $('tbNext').onclick = () => { qi++; if (qi >= order.length) finish(); else question(); };
            question();
        }
        function question() {
            locked = false; target = order[qi];
            els.forEach((e) => e.classList.remove('ok', 'bad'));
            $('tbQ').textContent = `soal ${qi + 1} dari ${order.length}`;
            $('tbScore').textContent = `Skor ${score}/${qi}`;
            const n = streakInfo(); $('tbStreak').textContent = n ? `Beruntun ${n} hari` : 'Mulai beruntun hari ini';
            $('tbFb').style.display = 'none'; $('tbNext').style.display = 'none';
            playTarget();
        }
        function playTarget() { playAudioUrl(blockUrl(pd, target)); }
        function onTap(i) {
            if (locked) return;
            locked = true; stopAllAudio();
            const right = i === target;
            if (right) score++; else els[i].classList.add('bad');
            els[target].classList.add('ok');
            $('tbFb').style.display = 'block';
            $('tbFb').innerHTML = right ? '<b>Benar!</b> Pendengaranmu tepat.' : '<b>Belum tepat.</b> Blok yang benar ditandai hijau.';
            $('tbScore').textContent = `Skor ${score}/${qi + 1}`;
            const last = qi + 1 >= order.length;
            $('tbNext').textContent = last ? 'Lihat hasil' : 'Soal berikutnya';
            $('tbNext').style.display = 'block';
        }
        function finish() {
            const pct = score / order.length;
            const stars = pct >= 0.9 ? 3 : (pct >= 0.6 ? 2 : 1);
            const n = bumpStreak();
            body.innerHTML = `
                <div class="bj-card static" style="text-align:center;align-items:center">
                    <div style="font-size:34px">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
                    <b>Skor ${score} dari ${order.length}</b>
                    <span>Beruntun ${n} hari. ${stars === 3 ? 'Luar biasa!' : 'Terus berlatih, ya!'}</span>
                </div>
                <div class="bj-actions"><button type="button" class="bj-btn ghost" id="tbClose">Tutup</button><button type="button" class="bj-btn" id="tbAgain">Main lagi</button></div>`;
            $('tbClose').onclick = () => closeModal('bjGuessModal');
            $('tbAgain').onclick = start;
        }
        start();
    }

    // ================================================================ 1. GURU: TANDAI BLOK
    let reviewData = null;
    let reviewMarks = { salah: new Set(), kurang: new Set() };

    function updateReviewSummary() {
        const el = $('reviewMarkSummary'); if (!el) return;
        const s = reviewMarks.salah.size, k = reviewMarks.kurang.size;
        el.textContent = (s || k) ? `${s} salah • ${k} kurang` : 'Belum ada tanda';
    }
    window.bjOnReviewOpen = function (d) {
        reviewData = d;
        reviewMarks = { salah: new Set(d.salah || []), kurang: new Set(d.kurang || []) };
        updateReviewSummary();
        const f = $('reviewMarkFloat'); if (f) f.style.display = 'flex';
    };
    window.bjOnReviewExit = function () {
        reviewData = null; reviewMarks = { salah: new Set(), kurang: new Set() };
        const f = $('reviewMarkFloat'); if (f) f.style.display = 'none';
    };
    window.bjGetReviewMarks = function () {
        const f = (s) => Array.from(s).sort((a, b) => a - b);
        return { salah: f(reviewMarks.salah), kurang: f(reviewMarks.kurang) };
    };

    async function openMarking() {
        if (!reviewData) return;
        const d = reviewData;
        const session = { alive: true };
        let pd = null;
        const body = openModal('bjMarkModal', '✍️ Tandai Blok', () => { session.alive = false; stopAllAudio(); if (pd) pd.revoke(); updateReviewSummary(); });
        body.innerHTML = '<div class="bj-note">Memuat halaman…</div>';
        pd = await getPageData(d.jilid, d.halaman);
        if (!session.alive) { pd.revoke(); return; }
        if (!pd.blocks.length) { body.innerHTML = '<div class="bj-note">Halaman ini tidak punya blok untuk ditandai.</div>'; return; }

        let tool = 'salah';
        body.innerHTML = `
            <div class="bj-sub">${esc(d.studentName || 'Siswa')} • ${esc(getJilidFullLabel(d.jilid))} • Hal. ${esc(d.halaman)}</div>
            <div>${setoranPlayerHtml(d)}</div>
            <div class="bj-tools" role="group" aria-label="Alat penanda">
                <button type="button" class="bj-chip" data-tool="dengar">Dengar</button>
                <button type="button" class="bj-chip" data-tool="benar">Benar</button>
                <button type="button" class="bj-chip" data-tool="kurang">Kurang</button>
                <button type="button" class="bj-chip on" data-tool="salah">Salah</button>
            </div>
            <div class="bj-sub" id="mkHint"></div>
            <div id="mkStage"></div>
            <div class="bj-actions"><button type="button" class="bj-btn" id="mkDone">Selesai menandai</button></div>`;
        const hint = () => {
            const s = reviewMarks.salah.size, k = reviewMarks.kurang.size;
            $('mkHint').textContent = `${s} blok salah • ${k} blok kurang. Pilih alat, lalu ketuk blok di halaman.`;
        };
        const els = buildStage($('mkStage'), pd, (i) => {
            if (tool === 'dengar') { playAudioUrl(blockUrl(pd, i)); return; }
            // mengetuk lagi blok yang sudah bertanda sama = menghapus tanda
            const had = (tool === 'salah' && reviewMarks.salah.has(i)) || (tool === 'kurang' && reviewMarks.kurang.has(i));
            reviewMarks.salah.delete(i); reviewMarks.kurang.delete(i);
            if (!had) { if (tool === 'salah') reviewMarks.salah.add(i); else if (tool === 'kurang') reviewMarks.kurang.add(i); }
            paint();
        });
        function paint() {
            els.forEach((e, i) => { e.classList.toggle('r', reviewMarks.salah.has(i)); e.classList.toggle('y', reviewMarks.kurang.has(i)); });
            hint();
        }
        body.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => {
            tool = b.dataset.tool;
            body.querySelectorAll('[data-tool]').forEach((x) => x.classList.toggle('on', x === b));
        }));
        $('mkDone').onclick = () => closeModal('bjMarkModal');
        paint();
    }

    // ================================================================ 1b. SISWA: PERBAIKI BLOK
    async function openFix(opts) {
        const salah = opts.salah || [], kurang = opts.kurang || [];
        if (!salah.length && !kurang.length) { showToast('Tidak ada blok yang ditandai guru.'); return; }
        const doneKey = 'tartili_fix_' + (opts.key || `${opts.jilid}_${opts.halaman}`);
        let done = new Set(); try { done = new Set(JSON.parse(localStorage.getItem(doneKey) || '[]')); } catch (e) { done = new Set(); }
        const session = { alive: true, rec: null };
        let pd = null;
        const body = openModal('bjFixModal', '🛠️ Perbaiki Blok', () => {
            session.alive = false; stopAllAudio();
            if (session.rec) { session.rec.stop().catch(() => {}); session.rec = null; }
            if (pd) pd.revoke();
        });
        body.innerHTML = '<div class="bj-note">Memuat halaman…</div>';
        pd = await getPageData(opts.jilid, opts.halaman);
        if (!session.alive) { pd.revoke(); return; }

        let sel = -1, recording = false, lastBlob = null;
        body.innerHTML = `
            <div class="bj-sub">${esc(getJilidFullLabel(opts.jilid))} • Hal. ${esc(opts.halaman)}${opts.nilai != null ? ' • Nilai ' + esc(opts.nilai) : ''}</div>
            ${opts.feedback ? `<div class="bj-feedback" style="display:block">Catatan guru: “${esc(opts.feedback)}”</div>` : ''}
            <div id="fxStage"></div>
            <div class="bj-row" id="fxChips"></div>
            <div class="bj-status" id="fxStatus" aria-live="polite">Ketuk blok bertanda, dengar contoh, lalu rekam ulang hanya blok itu.</div>
            <div class="bj-actions"><button type="button" class="bj-btn ghost" id="fxHear" disabled>Dengar contoh</button><button type="button" class="bj-btn" id="fxRec" disabled>Rekam ulang</button></div>
            <button type="button" class="bj-btn" id="fxDone" style="display:none">Sudah diperbaiki</button>`;
        const els = buildStage($('fxStage'), pd, (i) => select(i));
        const flagged = new Set([...salah, ...kurang]);
        function paint() {
            els.forEach((e, i) => {
                e.classList.toggle('r', salah.includes(i) && !done.has(i));
                e.classList.toggle('y', kurang.includes(i) && !done.has(i));
                e.classList.toggle('pulse', salah.includes(i) && !done.has(i));
                e.classList.toggle('ok', done.has(i));
                e.classList.toggle('sel', i === sel);
            });
            const left = [...flagged].filter((i) => !done.has(i)).length;
            $('fxChips').innerHTML = `<span class="bj-chip">${left} perlu diperbaiki</span><span class="bj-chip on">${done.size} selesai</span>`;
            if (flagged.size && left === 0) $('fxStatus').textContent = 'Semua blok sudah diperbaiki. Barakallah!';
        }
        function select(i) {
            if (recording) return;
            sel = i; lastBlob = null; $('fxDone').style.display = 'none';
            $('fxHear').disabled = false; $('fxRec').disabled = false;
            $('fxStatus').textContent = `Blok ${i + 1} dipilih. Dengar contoh, lalu rekam ulang.`;
            paint();
        }
        $('fxHear').onclick = () => { if (sel >= 0) playAudioUrl(blockUrl(pd, sel)); };
        $('fxRec').onclick = async () => {
            if (sel < 0) return;
            if (!recording) {
                try { session.rec = await recorderStart(); } catch (e) { showToast('Izinkan mikrofon untuk merekam ulang blok ini.'); return; }
                recording = true; stopAllAudio();
                $('fxRec').textContent = 'Selesai merekam'; $('fxHear').disabled = true;
                $('fxStatus').textContent = 'Merekam… bacalah blok ini dengan jelas.';
            } else {
                recording = false;
                $('fxRec').textContent = 'Rekam ulang'; $('fxRec').disabled = true;
                lastBlob = await session.rec.stop(); session.rec = null;
                if (!session.alive) return;
                $('fxStatus').textContent = 'Membandingkan: contoh, lalu suaramu…';
                await playAudioUrl(blockUrl(pd, sel));
                if (!session.alive) return;
                const mine = URL.createObjectURL(lastBlob);
                await playAudioUrl(mine); URL.revokeObjectURL(mine);
                if (!session.alive) return;
                $('fxHear').disabled = false; $('fxRec').disabled = false;
                $('fxStatus').textContent = 'Kalau sudah pas, tekan “Sudah diperbaiki”. Kalau belum, rekam ulang.';
                $('fxDone').style.display = 'block';
            }
        };
        $('fxDone').onclick = () => {
            if (sel < 0) return;
            done.add(sel);
            try { localStorage.setItem(doneKey, JSON.stringify([...done])); } catch (e) { /* abaikan */ }
            $('fxDone').style.display = 'none'; sel = -1;
            $('fxHear').disabled = true; $('fxRec').disabled = true;
            $('fxStatus').textContent = 'Tersimpan. Pilih blok bertanda berikutnya.';
            paint();
        };
        paint();
    }
    window.bjOpenFixFromResult = function () {
        const d = window.__lastHasil; if (!d) return;
        const m = $('hasilSetoranModal'); if (m) m.classList.remove('active');
        openFix({ jilid: d.jilid, halaman: d.halaman, salah: d.salah, kurang: d.kurang, nilai: d.nilai, feedback: d.feedback, key: d.setoranId });
    };
    window.bjOpenFixFromRiwayat = function (id) {
        const it = (typeof riwayatItems !== 'undefined' ? riwayatItems : []).find((x) => x.id === id); if (!it) return;
        const m = $('riwayatModal'); if (m) m.classList.remove('active');
        openFix({ jilid: it.jilid, halaman: it.halaman, salah: it.salah, kurang: it.kurang, nilai: it.nilai, feedback: it.feedback, key: it.id });
    };

    // ================================================================ 6. LAPORAN ORANG TUA
    async function openReport(uid, name) {
        const prof = window.currentUserProfile;
        if (!prof || !prof.classCode) { showToast('Kode kelas tidak ditemukan.'); return; }
        const body = openModal('bjReportModal', '📄 Laporan Orang Tua');
        body.innerHTML = '<div class="bj-note">Menyusun laporan…</div>';
        let items = [];
        try {
            const q = window.query(window.collection(window.firebaseDb, 'riwayat_setoran'),
                window.where('classCode', '==', prof.classCode), window.where('studentUid', '==', uid));
            const snap = await window.getDocs(q);
            items = snap.docs.map((d) => d.data());
        } catch (e) {
            console.error(e);
            body.innerHTML = '<div class="bj-note">Laporan belum bisa dimuat. Periksa koneksi internet dan aturan Firestore.</div>';
            return;
        }
        const ms = (t) => (t && typeof t.toMillis === 'function') ? t.toMillis() : 0;
        const weekAgo = Date.now() - 7 * 864e5;
        const recent = items.filter((it) => ms(it.createdAt) >= weekAgo);
        const graded = recent.filter((it) => it.status === 'dinilai' && typeof it.nilai === 'number');
        const lulus = new Set(graded.filter((it) => it.nilai >= KKM).map((it) => `${it.jilid}-${it.halaman}`)).size;
        const avg = graded.length ? Math.round(graded.reduce((s, it) => s + it.nilai, 0) / graded.length) : null;
        const nMarks = (it) => (it.salah || []).length + (it.kurang || []).length;
        const seen = new Set(), perlu = [];
        graded.filter((it) => it.nilai < KKM || nMarks(it) > 0).forEach((it) => {
            const k = `${it.jilid}-${it.halaman}`; if (seen.has(k)) return; seen.add(k);
            perlu.push(`${getJilidFullLabel(it.jilid)} Hal. ${it.halaman}${nMarks(it) ? ` (${nMarks(it)} blok)` : ''}`);
        });
        const lastNote = recent.filter((it) => it.feedback).sort((a, b) => ms(b.gradedAt || b.createdAt) - ms(a.gradedAt || a.createdAt))[0];
        const fmt = (t) => new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        const range = `${fmt(weekAgo)} – ${fmt(Date.now())}`;
        const defaultNote = lastNote ? lastNote.feedback : 'Mohon didampingi ananda berlatih membaca di rumah.';

        body.innerHTML = `
            <div class="bj-card static report">
                <div class="bj-row" style="justify-content:space-between;align-items:flex-start">
                    <div><div class="bj-sub">Ananda</div><b style="font-size:17px">${esc(name)}</b></div>
                    <div class="bj-sub" style="text-align:right">Kelas ${esc(prof.classCode)}<br>${range}</div>
                </div>
                <div class="bj-row" style="margin:10px 0">
                    <div class="bj-stat"><b>${lulus}</b><span>halaman lulus</span></div>
                    <div class="bj-stat"><b>${avg == null ? '-' : avg}</b><span>rata-rata nilai</span></div>
                </div>
                <div class="bj-sub">Perlu dilatih di rumah</div>
                <div class="bj-row" style="flex-wrap:wrap">${perlu.length ? perlu.slice(0, 4).map((p) => `<span class="bj-chip warn">${esc(p)}</span>`).join('') : '<span class="bj-sub">Tidak ada pekan ini.</span>'}</div>
            </div>
            <label class="bj-sub" for="bjRepNote">Catatan guru (boleh diubah)</label>
            <textarea id="bjRepNote" class="bj-textarea" rows="3"></textarea>
            <div class="bj-sub">Halaman lulus = nilai ${KKM} ke atas.${graded.length ? '' : ' Belum ada setoran dinilai pekan ini.'}</div>
            <div class="bj-actions"><button type="button" class="bj-btn ghost" id="bjRepCopy">Salin teks</button><button type="button" class="bj-btn wa" id="bjRepWa">Kirim ke WhatsApp</button></div>`;
        $('bjRepNote').value = defaultNote;
        const buildText = () => {
            const note = $('bjRepNote').value.trim();
            return [
                '*Laporan Belajar Pekan Ini - TartiliKu*',
                `Ananda: ${name}`,
                `Kelas: ${prof.teacherClassName || prof.classCode} (${range})`,
                '',
                `Halaman lulus: ${lulus}`,
                `Rata-rata nilai: ${avg == null ? '-' : avg}`,
                '',
                'Perlu dilatih di rumah:',
                perlu.length ? perlu.slice(0, 4).map((p) => `- ${p}`).join('\n') : '- (tidak ada pekan ini)',
                note ? `\nCatatan guru: ${note}` : '',
                `\n- ${prof.name || 'Guru'}`
            ].join('\n');
        };
        $('bjRepWa').onclick = () => { window.open('https://wa.me/?text=' + encodeURIComponent(buildText()), '_blank', 'noopener'); };
        $('bjRepCopy').onclick = async () => {
            try { await navigator.clipboard.writeText(buildText()); showToast('Teks laporan disalin.'); }
            catch (e) { showToast('Tidak bisa menyalin otomatis.'); }
        };
    }

    window.bjOpenPracticeMenu = openPracticeMenu;
    window.bjOpenMarking = openMarking;
    window.bjOpenReport = openReport;
})();
