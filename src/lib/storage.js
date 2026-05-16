import { get, set } from 'idb-keyval';

// IndexedDB via idb-keyval com fallback para localStorage
export const storage = {
  async get(key) {
    try {
      const v = await get(key);
      if (v !== undefined) return v;
      // migrate from localStorage if present
      const ls = localStorage.getItem(key);
      if (ls) { const parsed = JSON.parse(ls); await set(key, parsed); return parsed; }
      return null;
    } catch {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
    }
  },
  async set(key, value) {
    try { await set(key, value); } catch {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    }
  },
};
