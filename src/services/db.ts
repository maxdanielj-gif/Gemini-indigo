const DB_NAME = 'indigo_ai_db';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event);
      reject("Error opening database");
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

export const saveToDB = async (key: string, data: any): Promise<void> => {
  console.log(`db.ts: saveToDB key=${key}`);
  const db = await initDB();
  
  // Ensure data is serializable for IndexedDB (strips functions, etc.)
  let serializableData = data;
  if (typeof data === 'object' && data !== null && !(data instanceof Blob) && !(data instanceof ArrayBuffer)) {
    try {
      // Only stringify/parse if it's not already a string (to avoid double stringification)
      if (typeof data !== 'string') {
        serializableData = JSON.parse(JSON.stringify(data));
      }
    } catch (e) {
      console.warn("Failed to sanitize data for IndexedDB, attempting direct save:", e);
      serializableData = data;
    }
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(serializableData, key);

    transaction.oncomplete = () => {
        console.log(`db.ts: saveToDB key=${key} complete`);
        resolve();
    };
    transaction.onerror = (event) => {
      console.error("IndexedDB save error:", event);
      reject("Error saving to DB");
    };
  });
};

export const loadFromDB = async (key: string): Promise<any> => {
  console.log(`db.ts: loadFromDB key=${key}`);
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
        console.log(`db.ts: loadFromDB key=${key} success, result=`, request.result);
        resolve(request.result);
    };
    request.onerror = () => {
        console.error(`db.ts: loadFromDB key=${key} error`);
        reject("Error loading from DB");
    };
  });
};

export const deleteFromDB = async (key: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(key);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject("Error deleting from DB");
  });
};

export const clearDB = async (): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.clear();

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject("Error clearing DB");
    });
};
