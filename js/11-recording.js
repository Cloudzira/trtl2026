/* =====================================================================
   TartiliKu - Rekaman Suara & Pemeriksaan Kualitas
   Berkas : js/11-recording.js  (urutan muat ke-11 dari 17)
   Tugas  : Merekam bacaan siswa, memeriksa kualitas rekaman, dan memutar
            ulang.
   Isi    : decodeAudioBlob, analyzeRecordingQuality,
            describeRecordingIssue, checkRecordingQualityAfterStop,
            startRecording, stopRecording, playRecording
   ===================================================================== */

// ===== PEMERIKSAAN KUALITAS REKAMAN =====
// Setelah merekam, suara dianalisis: terlalu pelan, terlalu keras (pecah),
// terlalu berisik, atau terlalu pendek. Siswa langsung diberi saran sebelum
// mengirim, karena rekaman ini yang akan dinilai guru.
let recordingQualityIssue = '';
let nextRecordingUsesAutoGain = false;

function decodeAudioBlob(blob) {
    return blob.arrayBuffer().then((ab) => {
        const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!Ctx) return null;
        const ctx = new Ctx(1, 1, 44100);
        return new Promise((resolve, reject) => ctx.decodeAudioData(ab, resolve, reject));
    });
}

async function analyzeRecordingQuality(blob) {
    try {
        const buf = await decodeAudioBlob(blob);
        if (!buf) return null;
        const data = buf.getChannelData(0);
        const sr = buf.sampleRate;
        const win = Math.floor(sr * 0.05);
        const rmsList = [];
        let peak = 0, clipped = 0;
        for (let i = 0; i < data.length; i += win) {
            let sum = 0, n = 0;
            const end = Math.min(i + win, data.length);
            for (let j = i; j < end; j++) {
                const a = Math.abs(data[j]);
                if (a > peak) peak = a;
                if (a >= 0.985) clipped++;
                sum += a * a; n++;
            }
            rmsList.push(Math.sqrt(sum / Math.max(1, n)));
        }
        rmsList.sort((a, b) => a - b);
        const db = (x) => 20 * Math.log10(Math.max(x, 1e-6));
        const p10 = rmsList[Math.floor(rmsList.length * 0.1)] || 0;
        const p90 = rmsList[Math.floor(rmsList.length * 0.9)] || 0;
        return {
            duration: buf.duration,
            peakDb: db(peak),
            levelDb: db(p90),
            snrDb: db(p90) - db(p10),
            clippedPct: (clipped / Math.max(1, data.length)) * 100
        };
    } catch (e) {
        console.warn('Analisis rekaman dilewati:', e);
        return null;
    }
}

// Mengembalikan teks saran (kosong = kualitas baik)
function describeRecordingIssue(q) {
    if (!q) return '';
    if (q.duration < 1) return 'Rekaman terlalu pendek.';
    if (q.levelDb < -48 || q.peakDb < -30) {
        nextRecordingUsesAutoGain = true;
        return 'Hampir tidak ada suara yang terekam. Periksa mikrofon, lalu rekam ulang.';
    }
    if (q.peakDb < -18 || q.levelDb < -38) {
        nextRecordingUsesAutoGain = true;
        return 'Suara terlalu pelan. Dekatkan mikrofon (sekitar 10-15 cm) lalu rekam ulang. Rekaman berikutnya dibantu penguat otomatis.';
    }
    if (q.clippedPct > 0.5) {
        nextRecordingUsesAutoGain = false;
        return 'Suara terlalu keras sehingga pecah. Jauhkan mikrofon sedikit atau baca lebih pelan, lalu rekam ulang.';
    }
    if (q.snrDb < 8) return 'Suara latar terlalu berisik dibanding suara bacaan. Pindah ke tempat lebih sepi lalu rekam ulang.';
    return '';
}

async function checkRecordingQualityAfterStop(blob) {
    recordingQualityIssue = '';
    const q = await analyzeRecordingQuality(blob);
    if (blob !== recordedAudioBlob) return; // sudah diganti rekaman lain
    recordingQualityIssue = describeRecordingIssue(q);
    if (recordingQualityIssue) showToast(recordingQualityIssue);
}

function startRecording() {
    // Kalau sebelumnya sedang memutar ulang rekaman lama, hentikan dulu
    const playbackEl = document.getElementById('playbackAudioEl');
    if (playbackEl && !playbackEl.paused) {
        playbackEl.pause();
        playbackEl.currentTime = 0;
        isPlayingRecording = false;
        const btnPlayEl = document.getElementById('btnPlay');
        if (btnPlayEl) btnPlayEl.innerText = '▶ Play';
    }

    // Minta mikrofon dengan pengaturan kualitas suara terbaik untuk MEREKAM.
    // Peredam gema & peredam bising dimatikan (membuat suara teredam/robotic).
    // Penguat otomatis (autoGainControl) mati secara bawaan supaya suara alami,
    // tetapi otomatis dinyalakan di rekaman berikutnya kalau rekaman sebelumnya
    // terdeteksi terlalu pelan.
    recordingQualityIssue = '';
    const constraints = {
        audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: nextRecordingUsesAutoGain,
            sampleRate: 48000,
            channelCount: 1
        }
    };

    navigator.mediaDevices.getUserMedia(constraints).then(stream => {
        // Pilih format audio terbaik yang didukung browser ini
        let chosenMimeType = '';
        for (const type of PREFERRED_AUDIO_MIME_TYPES) {
            if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) { chosenMimeType = type; break; }
        }

        // Bitrate dinaikkan ke 128 kbps (jauh lebih jernih dari bawaan
        // browser yang biasanya sekitar 32-64 kbps untuk rekaman suara).
        const recorderOptions = { audioBitsPerSecond: 128000 };
        if (chosenMimeType) recorderOptions.mimeType = chosenMimeType;

        mediaRecorder = new MediaRecorder(stream, recorderOptions);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            recordedAudioMimeType = mediaRecorder.mimeType || 'audio/webm';
            recordedAudioBlob = new Blob(audioChunks, { type: recordedAudioMimeType });
            stream.getTracks().forEach(t => t.stop());
            checkRecordingQualityAfterStop(recordedAudioBlob);
            document.getElementById('btnPlay').disabled = false;
            document.getElementById('btnSend').disabled = false;
        };
        mediaRecorder.start();
        document.getElementById('btnRec').disabled = true;
        document.getElementById('btnRec').classList.add('is-recording');
        document.getElementById('btnStop').disabled = false;
        document.getElementById('btnPlay').disabled = true;
        document.getElementById('btnSend').disabled = true;
        showToast('Merekam suara...');
    }).catch(e => { console.error(e); showToast('Akses mikrofon ditolak/tidak didukung.'); });
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        document.getElementById('btnRec').classList.remove('is-recording');
        document.getElementById('btnRec').disabled = false; // boleh rekam ulang sebelum dikirim
        document.getElementById('btnStop').disabled = true;
        showToast('Rekaman selesai. Dengarkan dulu, atau rekam ulang kalau ada yang salah.');
    }
}

// Tombol Play: dengarkan ulang hasil rekaman sebelum dikirim
function playRecording() {
    if (!recordedAudioBlob) { showToast('Belum ada rekaman.'); return; }
    const playbackEl = document.getElementById('playbackAudioEl');
    const btnPlay = document.getElementById('btnPlay');

    if (isPlayingRecording) {
        playbackEl.pause();
        playbackEl.currentTime = 0;
        isPlayingRecording = false;
        btnPlay.innerText = '▶ Play';
        return;
    }

    playbackEl.src = URL.createObjectURL(recordedAudioBlob);
    playbackEl.play();
    isPlayingRecording = true;
    btnPlay.innerText = '⏸ Pause';

    playbackEl.onended = () => { isPlayingRecording = false; btnPlay.innerText = '▶ Play'; };
}
window.playRecording = playRecording;
