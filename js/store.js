/* All data lives in this browser's localStorage. Export/import moves it between devices. */

const Store = (() => {
  const KEY = "jw.gym.v1";

  const empty = () => ({
    version: 1,
    sessions: [],
    checkins: [],
    draft: null,
    swaps: {},
    settings: { kcal: DIET.kcalStart, lastBackup: null },
  });

  function normalize(d) {
    const base = empty();
    return {
      ...base,
      ...d,
      sessions: Array.isArray(d.sessions) ? d.sessions : [],
      checkins: Array.isArray(d.checkins) ? d.checkins : [],
      swaps: d.swaps && typeof d.swaps === "object" ? d.swaps : {},
      settings: { ...base.settings, ...(d.settings || {}) },
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) {
      console.error("Could not read saved data", e);
    }
    return empty();
  }

  let db = load();

  function save() {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function finishedSessions() {
    return db.sessions.filter((s) => s.finishedAt).sort((a, b) => a.date.localeCompare(b.date));
  }

  function exportJson() {
    db.settings.lastBackup = new Date().toISOString();
    save();
    return JSON.stringify(db, null, 2);
  }

  function importJson(text) {
    const d = JSON.parse(text);
    if (!d || !Array.isArray(d.sessions)) throw new Error("This file is not a Jin-Woo gym backup.");
    db = normalize(d);
    save();
  }

  function reset() {
    db = empty();
    save();
  }

  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  return {
    get db() { return db; },
    save, uid, finishedSessions, exportJson, importJson, reset,
  };
})();
