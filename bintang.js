/* =====================================================================
   TartiliKu - Bintang & Peta Perjalanan (dimuat SETELAH app.js dan belajar.js)
   - Bintang per halaman dari nilai guru:  75-79 = 1 bintang, 80-89 = 2, 90 ke atas = 3
   - Peta perjalanan Jilid 1 sampai Tartili Ghorib (Jilid 7) dengan cincin kemajuan tiap jilid
   - Lencana koleksi, perayaan kecil (konfeti), dan maskot "Pelita" (lentera, bukan makhluk hidup)
   Data kemajuan dihitung dari riwayat setoran siswa sendiri dan disimpan sementara di perangkat.
   ===================================================================== */
(function () {
    'use strict';

    const KKM = 75;                       // nilai minimal lulus (sama dengan Laporan Orang Tua)
    const CACHE_MS = 3 * 60 * 1000;       // data kemajuan dianggap segar selama 3 menit
    const JILIDS = [1, 2, 3, 4, 5, 6, 7];
    const ROW = 118, TOP = 44;            // ukuran tata letak peta (px)
    const $ = (id) => document.getElementById(id);
    const esc = (s) => (typeof riwayatEsc === 'function' ? riwayatEsc(s) : String(s == null ? '' : s));
    const starsFor = (n) => (typeof n !== 'number') ? 0 : (n >= 90 ? 3 : (n >= 80 ? 2 : (n >= KKM ? 1 : 0)));
    const totalPages = (j) => (typeof JILID_PAGE_COUNT !== 'undefined' && JILID_PAGE_COUNT[j]) || 44;
    const jilidName = (j) => (typeof JILID_NAMES !== 'undefined' && JILID_NAMES[j]) || ('Jilid ' + j);

    // ------------------------------------------------------------ lencana: bendera lokal
    function getFlags() { try { return JSON.parse(localStorage.getItem('tartili_flags') || '{}') || {}; } catch (e) { return {}; } }
    window.bintangFlag = function (name) {
        const f = getFlags();
        if (!f[name]) { f[name] = true; try { localStorage.setItem('tartili_flags', JSON.stringify(f)); } catch (e) { /* abaikan */ } }
    };
    function streakNow() {
        let s = null; try { s = JSON.parse(localStorage.getItem('tartili_streak') || 'null'); } catch (e) { s = null; }
        if (!s) return 0;
        const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return (s.last === ymd(new Date()) || s.last === ymd(new Date(Date.now() - 864e5))) ? s.count : 0;
    }

    // ------------------------------------------------------------ data kemajuan
    let progress = null;   // { savedAt, best: { "3-12": 85, ... } }
    const cacheKey = () => 'tartili_progress_' + ((window.currentUserProfile && window.currentUserProfile.uid) || 'x');
    function readCache() { try { return JSON.parse(localStorage.getItem(cacheKey()) || 'null'); } catch (e) { return null; } }

    async function loadProgress(force) {
        const prof = window.currentUserProfile;
        if (!prof || !prof.uid) return progress;
        const cached = readCache();
        if (!force && cached && Date.now() - (cached.savedAt || 0) < CACHE_MS) { progress = cached; return progress; }
        if (typeof window.getDocs !== 'function' || !window.firebaseDb || !navigator.onLine) {
            progress = cached || progress; return progress;     // belum bisa memuat: pakai salinan lama
        }
        try {
            const q = window.query(window.collection(window.firebaseDb, 'riwayat_setoran'), window.where('studentUid', '==', prof.uid));
            const snap = await window.getDocs(q);
            const best = {};
            snap.docs.forEach((d) => {
                const x = d.data();
                if (x.status === 'dinilai' && typeof x.nilai === 'number') {
                    const k = `${x.jilid}-${x.halaman}`;
                    if (best[k] == null || x.nilai > best[k]) best[k] = x.nilai;
                }
            });
            progress = { savedAt: Date.now(), best };
            try { localStorage.setItem(cacheKey(), JSON.stringify(progress)); } catch (e) { /* abaikan */ }
        } catch (e) {
            console.warn('Kemajuan belum bisa dimuat:', e);
            progress = cached || progress;
        }
        return progress;
    }

    function computeStats(p) {
        const per = {};
        JILIDS.forEach((j) => { per[j] = { lulus: 0, stars: 0, total: totalPages(j), pages: {} }; });
        let totalStars = 0, totalLulus = 0, threeStar = 0;
        Object.entries((p && p.best) || {}).forEach(([k, n]) => {
            const [j, h] = k.split('-');
            const rec = per[j]; if (!rec) return;
            const s = starsFor(n);
            rec.stars += s; totalStars += s; if (s === 3) threeStar++;
            if (n >= KKM) { totalLulus++; if (/^\d+$/.test(h)) rec.lulus++; }
            rec.pages[h] = n;
        });
        const complete = (j) => per[j].total > 0 && per[j].lulus >= per[j].total;
        let current = JILIDS.find((j) => !complete(j)); if (!current) current = 7;
        return { per, totalStars, totalLulus, threeStar, current, complete, completeJilids: JILIDS.filter(complete).length };
    }

    // ------------------------------------------------------------ maskot Pelita (lentera)
    // Tanpa wajah, tanpa tokoh: ekspresinya lewat nyala api, cahaya, dan percikan.
    function pelitaSvg(level, celebrate) {
        const glow = [0.2, 0.45, 0.75, 1][Math.max(0, Math.min(3, level))];
        return `<svg class="pelita${celebrate ? ' celebrate' : ''}" viewBox="0 0 64 76" style="--glow:${glow}" aria-hidden="true" focusable="false">
            <ellipse class="pl-halo" cx="32" cy="40" rx="30" ry="30"></ellipse>
            <path class="pl-ring" d="M26 14 Q32 2 38 14" fill="none"></path>
            <rect class="pl-cap" x="20" y="14" width="24" height="7" rx="3"></rect>
            <path class="pl-glass" d="M22 21 h20 q4 0 4 5 v22 q0 7 -6 9 h-16 q-6 -2 -6 -9 v-22 q0 -5 4 -5z"></path>
            <path class="pl-flame" d="M32 28 c6 7 8 12 5 17 c-1.5 2.5 -8.5 2.5 -10 0 c-3 -5 -1 -10 5 -17z"></path>
            <path class="pl-core" d="M32 36 c3 3.5 3.5 6 2.2 8 c-.8 1.2 -3.6 1.2 -4.4 0 c-1.3 -2 -.8 -4.5 2.2 -8z"></path>
            <rect class="pl-base" x="19" y="57" width="26" height="7" rx="3"></rect>
            <rect class="pl-base" x="23" y="64" width="18" height="5" rx="2.5"></rect>
            <g class="pl-sparks">
                <path d="M8 22 l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6z"></path>
                <path d="M56 16 l1.3 2.7 2.7 1.3 -2.7 1.3 -1.3 2.7 -1.3 -2.7 -2.7 -1.3 2.7 -1.3z"></path>
                <path d="M54 46 l1.1 2.3 2.3 1.1 -2.3 1.1 -1.1 2.3 -1.1 -2.3 -2.3 -1.1 2.3 -1.1z"></path>
            </g>
        </svg>`;
    }
    const levelFor = (st) => (st.totalStars >= 100 ? 3 : (st.totalStars >= 30 ? 2 : (st.totalStars >= 1 ? 1 : 0)));

    // ------------------------------------------------------------ perayaan
    function confetti() {
        if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const box = document.createElement('div'); box.className = 'bs-confetti';
        const colors = ['var(--accent-solid)', 'rgb(var(--orb2-rgb))', '#ffd166', '#10b981', '#ffffff'];
        let html = '';
        for (let i = 0; i < 30; i++) {
            const size = 6 + Math.random() * 6;
            html += `<i class="bs-cf" style="left:${Math.random() * 100}%;width:${size}px;height:${size * 1.4}px;background:${colors[i % colors.length]};` +
                `animation-duration:${1.5 + Math.random() * 1.2}s;animation-delay:${Math.random() * 0.5}s"></i>`;
        }
        box.innerHTML = html;
        document.body.appendChild(box);
        setTimeout(() => box.remove(), 3600);
    }

    // ------------------------------------------------------------ chip & tombol di menu
    function updateChip() {
        const chip = $('userStarChip');
        if (!chip || !progress) return;
        chip.textContent = '★ ' + computeStats(progress).totalStars;
    }
    window.bintangOnProfile = async function () {
        const prof = window.currentUserProfile; if (!prof) return;
        const isStudent = !(typeof isAdminProfile === 'function' && isAdminProfile(prof)) && prof.role !== 'Guru' && prof.role !== 'Admin';
        const btn = $('btnPetaBintang'), chip = $('userStarChip');
        if (btn) btn.style.setProperty('display', isStudent ? 'flex' : 'none', 'important');
        if (chip) chip.style.display = isStudent ? '' : 'none';
        if (!isStudent) return;
        progress = readCache() || progress;
        updateChip();
        await loadProgress(false);
        updateChip();
    };

    // ------------------------------------------------------------ hasil penilaian: bintang + Pelita
    window.bintangResultHtml = function (data) {
        const n = (data && typeof data.nilai === 'number') ? data.nilai : null;
        const s = starsFor(n);
        const msg = n == null ? 'Guru sudah menilai setoranmu.'
            : s === 3 ? 'Luar biasa! Tiga bintang untukmu.'
            : s === 2 ? 'Bagus sekali! Dua bintang untukmu.'
            : s === 1 ? 'Lulus! Satu bintang untukmu.'
            : 'Belum lulus. Pelita temani kamu mengulang, ya!';
        if (s > 0) setTimeout(confetti, 250);
        setTimeout(() => loadProgress(true).then(updateChip), 800);
        return `<div class="bs-result">${pelitaSvg(s, s > 0)}
            <div class="bs-result-stars" aria-label="${s} dari 3 bintang">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</div>
            <div class="bs-result-msg">${msg}</div></div>`;
    };

    // ------------------------------------------------------------ lencana
    const BADGES = [
        { id: 'first',  icon: '✦',   name: 'Langkah Pertama',    desc: 'Lulus 1 halaman',                        ok: (s) => s.totalLulus >= 1 },
        { id: 'l5',     icon: '5',   name: 'Lima Halaman',       desc: 'Lulus 5 halaman',                        ok: (s) => s.totalLulus >= 5 },
        { id: 'l25',    icon: '25',  name: 'Dua Puluh Lima',     desc: 'Lulus 25 halaman',                       ok: (s) => s.totalLulus >= 25 },
        { id: 'l100',   icon: '100', name: 'Seratus Halaman',    desc: 'Lulus 100 halaman',                      ok: (s) => s.totalLulus >= 100 },
        { id: 'star3',  icon: '★',   name: 'Bintang Tiga',       desc: 'Dapat 3 bintang di satu halaman',        ok: (s) => s.threeStar >= 1 },
        { id: 's50',    icon: '✧',   name: 'Pengumpul Bintang',  desc: 'Kumpulkan 50 bintang',                   ok: (s) => s.totalStars >= 50 },
        { id: 'streak', icon: '7',   name: 'Tujuh Hari Beruntun', desc: 'Berlatih 7 hari berturut-turut',        ok: (s, f) => f.streak >= 7 },
        { id: 'bunyi',  icon: '♪',   name: 'Telinga Emas',       desc: 'Tebak Bunyi tanpa satu pun salah',       ok: (s, f) => !!f.telinga },
        { id: 'fix',    icon: '✔',   name: 'Pemburu Perbaikan',  desc: 'Perbaiki semua blok yang ditandai guru', ok: (s, f) => !!f.perbaiki },
        { id: 'tamat',  icon: '◆',   name: 'Tamat Jilid',        desc: 'Lulus semua halaman satu jilid',         ok: (s) => s.completeJilids >= 1 }
    ];

    // ------------------------------------------------------------ peta
    const rowOf = (j) => 7 - j;                               // Jilid 7 di puncak
    const nodeX = (j) => (rowOf(j) % 2 === 0 ? 66 : 34);
    const nodeY = (j) => TOP + rowOf(j) * ROW;

    function mapHtml(st) {
        const H = TOP * 2 + 6 * ROW;
        let segs = '', nodes = '', labels = '';
        for (let j = 1; j < 7; j++) {
            const x1 = nodeX(j), y1 = nodeY(j), x2 = nodeX(j + 1), y2 = nodeY(j + 1);
            const state = st.complete(j) ? 'done' : (j === st.current ? 'active' : 'locked');
            segs += `<path class="bs-seg ${state}" vector-effect="non-scaling-stroke" d="M${x1} ${y1} C${x1} ${y1 - 56} ${x2} ${y2 + 56} ${x2} ${y2}"></path>`;
        }
        JILIDS.forEach((j) => {
            const p = st.per[j];
            const pct = p.total ? Math.min(1, p.lulus / p.total) : 0;
            const C = 150.8;
            const done = st.complete(j), cur = j === st.current;
            const x = nodeX(j), y = nodeY(j), right = x > 50;
            nodes += `<button type="button" class="bs-node${done ? ' done' : ''}${cur ? ' cur' : ''}" data-j="${j}" style="left:${x}%;top:${y}px" aria-label="${esc(jilidName(j))}, ${p.lulus} dari ${p.total} halaman lulus">
                <svg viewBox="0 0 56 56" aria-hidden="true"><circle class="tr" cx="28" cy="28" r="24"></circle><circle class="pg" cx="28" cy="28" r="24" stroke-dasharray="${C}" stroke-dashoffset="${(C * (1 - pct)).toFixed(1)}" transform="rotate(-90 28 28)"></circle></svg>
                <span class="num">${done ? '★' : j}</span>${cur ? `<span class="bs-pin">${pelitaSvg(levelFor(st))}</span>` : ''}</button>`;
            const style = right ? `left:3%;width:calc(${x}% - 46px);text-align:right` : `left:calc(${x}% + 46px);width:calc(${100 - x}% - 50px);text-align:left`;
            labels += `<div class="bs-label" style="top:${y}px;${style}"><b>${esc(j === 7 ? jilidName(7) : 'Jilid ' + j)}</b><small>${p.lulus}/${p.total} halaman • ★ ${p.stars}</small></div>`;
        });
        return `<div class="bs-map" style="height:${H}px"><svg class="bs-svg" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">${segs}</svg>${labels}${nodes}</div>`;
    }

    function detailHtml(st, j) {
        const p = st.per[j];
        let dots = '';
        for (let n = 1; n <= p.total; n++) {
            const v = p.pages[String(n)];
            const cls = v == null ? 'n0' : (starsFor(v) ? 's' + starsFor(v) : 'try');
            dots += `<button type="button" class="bs-dot ${cls}" data-p="${n}" title="Hal. ${n}${v != null ? ' • nilai ' + v : ''}" aria-label="Halaman ${n}${v != null ? ', nilai ' + v : ', belum dinilai'}">${n}</button>`;
        }
        return `<div class="bs-detail-head"><b>${esc(typeof getJilidFullLabel === 'function' ? getJilidFullLabel(j) : 'Jilid ' + j)}</b>
            <span>${p.lulus}/${p.total} halaman lulus • ★ ${p.stars}</span></div>
            <div class="bs-dots">${dots}</div>
            <div class="bs-legend"><span class="bs-dot n0"></span>belum <span class="bs-dot try"></span>ulang <span class="bs-dot s1"></span>★ <span class="bs-dot s2"></span>★★ <span class="bs-dot s3"></span>★★★</div>
            <button type="button" class="bj-btn" id="bsOpenJilid" style="width:100%;margin-top:8px">Buka ${esc(jilidName(j))}</button>`;
    }

    async function openMap() {
        if (typeof bjOpenModal !== 'function') return;
        const body = bjOpenModal('bsMapModal', '🗺️ Peta Perjalanan');
        body.innerHTML = '<div class="bj-note">Memuat perjalananmu…</div>';
        const before = progress ? computeStats(progress).totalStars : null;
        const p = await loadProgress(false);
        const st = computeStats(p || { best: {} });
        const prof = window.currentUserProfile || {};
        const seenKey = 'tartili_stars_seen_' + (prof.uid || 'x');
        const seen = parseInt(localStorage.getItem(seenKey) || '-1', 10);
        const gained = seen >= 0 ? st.totalStars - seen : 0;
        try { localStorage.setItem(seenKey, String(st.totalStars)); } catch (e) { /* abaikan */ }

        const cur = st.per[st.current];
        const lvl = levelFor(st);
        let bubble;
        if (!p || !navigator.onLine && !Object.keys((p && p.best) || {}).length) bubble = 'Hubungkan internet agar bintangmu bisa dimuat.';
        else if (gained > 0) bubble = `Bintangmu bertambah ${gained}! Barakallah.`;
        else if (st.totalStars === 0) bubble = 'Halo! Aku Pelita. Setiap halaman yang lulus menambah bintang dan menerangi jalan kita.';
        else bubble = `Kamu punya ${st.totalStars} bintang. Tinggal ${Math.max(0, cur.total - cur.lulus)} halaman lagi untuk menamatkan ${jilidName(st.current)}.`;

        const flags = Object.assign({}, getFlags(), { streak: streakNow() });
        const badges = BADGES.map((b) => {
            const on = b.ok(st, flags);
            return `<div class="bs-badge${on ? ' on' : ''}" title="${esc(b.desc)}"><span class="bs-badge-ic">${b.icon}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div>`;
        }).join('');

        body.innerHTML = `
            <div class="bs-top"><div class="bs-mascot">${pelitaSvg(lvl, gained > 0)}</div><div class="bs-bubble" role="status">${esc(bubble)}</div></div>
            <div class="bj-row" style="flex-wrap:wrap"><span class="bj-chip on">★ ${st.totalStars} bintang</span><span class="bj-chip">${st.totalLulus} halaman lulus</span><span class="bj-chip">Beruntun ${flags.streak} hari</span></div>
            ${mapHtml(st)}
            <div class="bs-detail" id="bsDetail"></div>
            <div class="bs-section">Lencana</div>
            <div class="bs-badges">${badges}</div>
            <div class="bs-rules">Cara dapat bintang: nilai ${KKM}–79 = ★, 80–89 = ★★, 90 ke atas = ★★★. Bintang dihitung dari nilai terbaik tiap halaman.</div>`;

        const showDetail = (j) => {
            $('bsDetail').innerHTML = detailHtml(st, j);
            body.querySelectorAll('.bs-node').forEach((n) => n.classList.toggle('sel', Number(n.dataset.j) === j));
            $('bsOpenJilid').onclick = () => { bjCloseModal('bsMapModal'); if (typeof openJilid === 'function') openJilid(j, 'a'); };
            $('bsDetail').querySelectorAll('.bs-dot[data-p]').forEach((d) => d.addEventListener('click', () => {
                bjCloseModal('bsMapModal'); if (typeof openJilid === 'function') openJilid(j, d.dataset.p);
            }));
        };
        body.querySelectorAll('.bs-node').forEach((n) => n.addEventListener('click', () => showDetail(Number(n.dataset.j))));
        showDetail(st.current);
        // gulir peta ke stasiun saat ini
        const curNode = body.querySelector('.bs-node.cur');
        if (curNode && curNode.scrollIntoView) setTimeout(() => curNode.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
        if (gained > 0) confetti();
        updateChip();
    }
    window.bintangOpenMap = openMap;

    // saat file dimuat (mis. mulai instan), terapkan ke kartu sapaan kalau profil sudah ada
    if (window.currentUserProfile) window.bintangOnProfile();
})();
