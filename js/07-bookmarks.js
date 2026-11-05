/* =====================================================================
   TartiliKu - Bookmark (Penanda Halaman)
   Berkas : js/07-bookmarks.js  (urutan muat ke-7 dari 17)
   Tugas  : Simpan/muat bookmark per pengguna (localStorage + Firestore).
   Isi    : getBookmarksStorageKey, parseBookmarkList, loadBookmarksForUser,
            persistBookmarks
   ===================================================================== */

// ===== BOOKMARK & HALAMAN TERAKHIR DIBACA =====
let savedLastRead = JSON.parse(localStorage.getItem('tartili_last_read')) || { jilid: 1, page: 'a' };
const LEGACY_BOOKMARKS_KEY = 'tartili_bookmarks';
let savedBookmarks = [];
let savedBookmarksUserId = null;
let bookmarkSyncReadyUserId = null;
let unsubscribeBookmarks = null;

function getBookmarksStorageKey(userId) {
    return `tartili_bookmarks_${userId}`;
}

function parseBookmarkList(value) {
    try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function loadBookmarksForUser(userId, role) {
    if (unsubscribeBookmarks) {
        unsubscribeBookmarks();
        unsubscribeBookmarks = null;
    }

    savedBookmarksUserId = userId || null;
    bookmarkSyncReadyUserId = null;

    if (!savedBookmarksUserId) {
        savedBookmarks = [];
        updateBookmarkButtonState();
        if (document.getElementById('bookmarks-screen').classList.contains('active')) {
            renderBookmarksList();
        }
        return;
    }

    const currentUserId = savedBookmarksUserId;
    const userRef = window.doc(window.firebaseDb, 'users', currentUserId);
    savedBookmarks = parseBookmarkList(localStorage.getItem(getBookmarksStorageKey(currentUserId)));
    updateBookmarkButtonState();

    unsubscribeBookmarks = window.onSnapshot(userRef, (snapshot) => {
        if (savedBookmarksUserId !== currentUserId) return;

        const userData = snapshot.exists() ? snapshot.data() : {};
        if (Array.isArray(userData.bookmarks)) {
            savedBookmarks = userData.bookmarks;
            bookmarkSyncReadyUserId = currentUserId;
            localStorage.setItem(getBookmarksStorageKey(currentUserId), JSON.stringify(savedBookmarks));
            updateBookmarkButtonState();
            if (document.getElementById('bookmarks-screen').classList.contains('active')) {
                renderBookmarksList();
            }
            return;
        }

        if (bookmarkSyncReadyUserId === currentUserId) return;
        bookmarkSyncReadyUserId = currentUserId;

        const localBookmarksKey = getBookmarksStorageKey(currentUserId);
        const localBookmarks = localStorage.getItem(localBookmarksKey);
        let migratedLegacyBookmarks = false;
        if (localBookmarks !== null) {
            savedBookmarks = parseBookmarkList(localBookmarks);
        } else if (role === 'Guru' && localStorage.getItem(LEGACY_BOOKMARKS_KEY) !== null) {
            savedBookmarks = parseBookmarkList(localStorage.getItem(LEGACY_BOOKMARKS_KEY));
            migratedLegacyBookmarks = true;
        } else {
            savedBookmarks = [];
        }

        localStorage.setItem(localBookmarksKey, JSON.stringify(savedBookmarks));
        updateBookmarkButtonState();
        if (document.getElementById('bookmarks-screen').classList.contains('active')) {
            renderBookmarksList();
        }

        window.setDoc(userRef, { bookmarks: savedBookmarks }, { merge: true }).then(() => {
            if (migratedLegacyBookmarks) localStorage.removeItem(LEGACY_BOOKMARKS_KEY);
        }).catch((error) => {
            console.error('Gagal memigrasikan bookmark ke Firestore:', error);
            showToast('Bookmark tersimpan di perangkat ini, tetapi gagal disinkronkan.');
        });
    }, (error) => {
        if (savedBookmarksUserId !== currentUserId) return;
        console.error('Gagal memuat bookmark dari Firestore:', error);
        savedBookmarks = parseBookmarkList(localStorage.getItem(getBookmarksStorageKey(currentUserId)));
        bookmarkSyncReadyUserId = currentUserId;
        updateBookmarkButtonState();
        if (document.getElementById('bookmarks-screen').classList.contains('active')) {
            renderBookmarksList();
        }
        showToast('Bookmark tersimpan di perangkat ini, tetapi gagal disinkronkan.');
    });
}

function persistBookmarks() {
    if (!savedBookmarksUserId || bookmarkSyncReadyUserId !== savedBookmarksUserId) return;

    const currentUserId = savedBookmarksUserId;
    const bookmarks = [...savedBookmarks];
    localStorage.setItem(getBookmarksStorageKey(currentUserId), JSON.stringify(bookmarks));
    window.setDoc(window.doc(window.firebaseDb, 'users', currentUserId), { bookmarks }, { merge: true }).catch((error) => {
        console.error('Gagal menyinkronkan bookmark ke Firestore:', error);
        showToast('Bookmark tersimpan di perangkat ini, tetapi gagal disinkronkan.');
    });
}

window.loadBookmarksForUser = loadBookmarksForUser;
