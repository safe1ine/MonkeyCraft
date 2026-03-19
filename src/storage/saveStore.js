const DB_NAME = "mini-mc-save";
const DB_VERSION = 1;
const CHUNK_STORE = "chunks";
const META_STORE = "meta";

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

export class SaveStore {
  constructor() {
    this.db = null;
    this.saveTimers = new Map();
  }

  async init() {
    if (this.db) return;
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CHUNK_STORE)) {
          db.createObjectStore(CHUNK_STORE);
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Unable to open IndexedDB"));
    });
  }

  async loadChunk(key) {
    await this.init();
    const tx = this.db.transaction(CHUNK_STORE, "readonly");
    const store = tx.objectStore(CHUNK_STORE);
    return requestToPromise(store.get(key));
  }

  async saveChunkNow(key, payload) {
    await this.init();
    const tx = this.db.transaction(CHUNK_STORE, "readwrite");
    const store = tx.objectStore(CHUNK_STORE);
    await requestToPromise(store.put(payload, key));
  }

  scheduleChunkSave(key, payload, delayMs = 800) {
    const timer = this.saveTimers.get(key);
    if (timer) {
      clearTimeout(timer);
    }
    const id = setTimeout(async () => {
      this.saveTimers.delete(key);
      try {
        await this.saveChunkNow(key, payload);
      } catch (err) {
        console.error("save chunk failed", key, err);
      }
    }, delayMs);
    this.saveTimers.set(key, id);
  }

  async flushChunk(key, payload) {
    const timer = this.saveTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(key);
    }
    await this.saveChunkNow(key, payload);
  }

  async loadPlayer() {
    await this.init();
    const tx = this.db.transaction(META_STORE, "readonly");
    const store = tx.objectStore(META_STORE);
    return requestToPromise(store.get("player"));
  }

  async savePlayer(playerData) {
    await this.init();
    const tx = this.db.transaction(META_STORE, "readwrite");
    const store = tx.objectStore(META_STORE);
    await requestToPromise(store.put(playerData, "player"));
  }
}
