const DB_NAME = "megaphone-db";

const DB_VERSION = 1;

const STORE = "recordings";

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE, {
          keyPath: "slot"
        });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

export async function getAllRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function update(slot, changes) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const request = store.get(slot);
    request.onsuccess = () => {
      const base = request.result || {
        slot: slot,
        label: null,
        data: null,
        mimeType: null,
        durationMs: 0,
        createdAt: 0
      };
      store.put({
        ...base,
        ...changes,
        slot: slot
      });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function saveRecording(slot, {data: data, mimeType: mimeType, durationMs: durationMs}) {
  return update(slot, {
    data: data,
    mimeType: mimeType,
    durationMs: durationMs,
    createdAt: Date.now()
  });
}

export function saveLabel(slot, label) {
  return update(slot, {
    label: label
  });
}

export function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {});
}
