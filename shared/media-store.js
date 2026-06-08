/* Shared media store
   This small helper keeps uploaded media in the browser so lessons can reuse images
   and videos without passing large files around in page code. */
(function () {
    const DB_NAME = 'simpMediaStore';
    const DB_VERSION = 1;
    const STORE_NAME = 'media';
    const REF_PREFIX = 'simp-media:';
    let dbPromise = null;

    function openDb() {
        if (dbPromise) {
            return dbPromise;
        }

        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        return dbPromise;
    }

    async function withStore(mode, callback) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, mode);
            const store = transaction.objectStore(STORE_NAME);
            const request = callback(store);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function createId(file) {
        const safeName = String(file?.name || 'media').replace(/[^a-z0-9._-]+/gi, '-');
        return `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;
    }

    function createRef(id) {
        return `${REF_PREFIX}${id}`;
    }

    function parseRef(ref) {
        const value = String(ref || '');
        return value.startsWith(REF_PREFIX) ? value.slice(REF_PREFIX.length) : '';
    }

    async function saveFile(file) {
        const id = createId(file);
        await withStore('readwrite', (store) => store.put({
            id,
            blob: file,
            name: file?.name || '',
            type: file?.type || '',
            size: Number(file?.size) || 0,
            createdAt: Date.now()
        }));
        return {
            id,
            ref: createRef(id)
        };
    }

    async function getFile(refOrId) {
        const id = parseRef(refOrId) || String(refOrId || '');
        if (!id) {
            return null;
        }

        return withStore('readonly', (store) => store.get(id));
    }

    async function getObjectUrl(refOrId) {
        const record = await getFile(refOrId);
        if (!record?.blob) {
            return '';
        }

        return URL.createObjectURL(record.blob);
    }

    window.SIMPMediaStore = {
        REF_PREFIX,
        createRef,
        parseRef,
        saveFile,
        getFile,
        getObjectUrl
    };
})();
