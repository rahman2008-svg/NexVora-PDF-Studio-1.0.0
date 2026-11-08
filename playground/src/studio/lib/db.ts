// Small IndexedDB store for NexVora-specific data (custom fonts).
// Template projects themselves reuse the existing playground project store.
const DB_NAME = 'nexvora-studio';
const DB_VERSION = 1;

const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('fonts')) db.createObjectStore('fonts', { keyPath: 'name' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
  });

const tx = async <T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
};

export type StoredFont = { name: string; data: ArrayBuffer; size: number; addedAt: number };

export const listFonts = () => tx<StoredFont[]>('fonts', 'readonly', (s) => s.getAll());
export const putFont = (font: StoredFont) => tx('fonts', 'readwrite', (s) => s.put(font));
export const deleteFont = (name: string) => tx('fonts', 'readwrite', (s) => s.delete(name));
export const clearFonts = () => tx('fonts', 'readwrite', (s) => s.clear());
