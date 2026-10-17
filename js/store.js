/* localStorage is the source of truth for rendering. Signed in, each account gets its own key and
   every change is stamped and queued for Sync. With no cloud config it is a plain on-device log. */

const Store = (() => {
  const LOCAL_KEY = "jw.gym.v1";
  const ACCOUNT_KEY = "jw.gym.account";
  const KINDS = ["sessions", "checkins"];
  const FIELDS = ["draft", "swaps", "settings"];
  const cfg = window.APP_CONFIG || {};
  const cloud = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  /* settings.week maps each weekday to a PROGRAM day id, or null for rest. restLabels holds optional rest-day notes. */
  function exampleWeek() {
    const week = {}, restLabels = {};
    PROGRAM.exampleWeek.forEach(([d, w]) => {
      const k = d.toLowerCase().slice(0, 3);
      const id = Object.keys(PROGRAM.days).find((x) => PROGRAM.days[x].name === w);
      week[k] = id || null;
      const note = id ? "" : w.replace(/^rest\s*\/?\s*/i, "");
      if (note) restLabels[k] = note[0].toUpperCase() + note.slice(1);
    });
    return { week, restLabels };
  }

  function normSettings(s) {
    const src = s && typeof s === "object" ? s : {};
    const out = { ...empty().settings, ...src };
    const def = exampleWeek();
    const w = src.week && typeof src.week === "object" ? src.week : null;
    const l = src.restLabels && typeof src.restLabels === "object" ? src.restLabels : w ? {} : def.restLabels;
    out.week = Object.fromEntries(DAYS.map((k) => [k, w ? (PROGRAM.order.includes(w[k]) ? w[k] : null) : def.week[k]]));
    out.restLabels = Object.fromEntries(DAYS.filter((k) => typeof l[k] === "string" && l[k]).map((k) => [k, l[k]]));
    return out;
  }

  const empty = () => ({
    version: 1,
    sessions: [],
    checkins: [],
    draft: null,
    swaps: {},
    settings: { kcal: DIET.kcalStart, lastBackup: null, ...exampleWeek() },
  });

  const emptyMeta = () => ({
    stamps: { sessions: {}, checkins: {} },
    tombs: { sessions: {}, checkins: {} },
    dirty: { sessions: {}, checkins: {} },
    state: {},
    stateDirty: {},
    cursor: {},
    flags: {},
  });

  function normalize(d) {
    const base = empty();
    const { sync, ...rest } = d;
    return {
      ...base,
      ...rest,
      sessions: Array.isArray(d.sessions) ? d.sessions : [],
      checkins: Array.isArray(d.checkins) ? d.checkins : [],
      swaps: d.swaps && typeof d.swaps === "object" ? d.swaps : {},
      settings: normSettings(d.settings),
    };
  }

  function normalizeMeta(m) {
    const base = emptyMeta();
    if (!m || typeof m !== "object") return base;
    const out = { ...base, ...m };
    ["stamps", "tombs", "dirty"].forEach((k) => (out[k] = { ...base[k], ...(m[k] || {}) }));
    return out;
  }

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error("Could not read saved data", e);
    }
    return null;
  }

  let account = null;
  let key = LOCAL_KEY;
  let db, meta, shadow;
  const listeners = [];

  /* JSON of every record as last saved; save() diffs against it to find what app.js changed. */
  function snapshot() {
    shadow = {};
    KINDS.forEach((k) => (shadow[k] = new Map(db[k].map((r) => [r.id, JSON.stringify(r)]))));
    FIELDS.forEach((f) => (shadow[f] = JSON.stringify(db[f])));
  }

  function open(uid) {
    account = uid || null;
    key = account ? `${LOCAL_KEY}:${account}` : LOCAL_KEY;
    const d = read(key);
    db = d ? normalize(d) : empty();
    meta = normalizeMeta(d && d.sync);
    snapshot();
  }

  open(cloud ? localStorage.getItem(ACCOUNT_KEY) : null);

  /* Stamps only move forward, even if the device clock jumps back. */
  function stamp(prev) {
    const p = prev ? Date.parse(prev) : 0;
    return new Date(Math.max(Date.now(), p + 1)).toISOString();
  }

  function track() {
    KINDS.forEach((kind) => {
      const seen = new Set();
      db[kind].forEach((r) => {
        seen.add(r.id);
        const j = JSON.stringify(r);
        if (shadow[kind].get(r.id) === j) return;
        shadow[kind].set(r.id, j);
        meta.stamps[kind][r.id] = stamp(meta.stamps[kind][r.id] || meta.tombs[kind][r.id]);
        delete meta.tombs[kind][r.id];
        meta.dirty[kind][r.id] = 1;
      });
      shadow[kind].forEach((_, id) => {
        if (seen.has(id)) return;
        shadow[kind].delete(id);
        meta.tombs[kind][id] = stamp(meta.stamps[kind][id]);
        delete meta.stamps[kind][id];
        meta.dirty[kind][id] = 1;
      });
    });
    FIELDS.forEach((f) => {
      const j = JSON.stringify(db[f]);
      if (shadow[f] === j) return;
      shadow[f] = j;
      meta.state[f] = stamp(meta.state[f]);
      meta.stateDirty[f] = 1;
    });
  }

  function persist() {
    localStorage.setItem(key, JSON.stringify(account ? { ...db, sync: meta } : db));
  }

  function save() {
    if (account) track();
    persist();
    if (account) listeners.forEach((fn) => fn());
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

  /* Adds another log into the current one. `overwrite` lets incoming records replace same-id/same-week ones.
     Everything merged in is re-stamped so it syncs. */
  function mergeIn(d, overwrite) {
    const src = normalize(d);
    KINDS.forEach((kind) => {
      src[kind].forEach((r) => {
        if (!r || !r.id) return;
        if (kind === "checkins") {
          const j = db.checkins.findIndex((x) => x.week === r.week && x.id !== r.id);
          if (j >= 0) {
            if (!overwrite) return;
            db.checkins.splice(j, 1);
          }
        }
        const i = db[kind].findIndex((x) => x.id === r.id);
        if (i >= 0 && !overwrite) return;
        if (i >= 0) db[kind][i] = r;
        else db[kind].push(r);
        shadow[kind].delete(r.id);
      });
    });
    if (!db.draft && src.draft) db.draft = src.draft;
    const fresh = (f) => overwrite || !meta.state[f];
    db.swaps = fresh("swaps") ? { ...db.swaps, ...src.swaps } : { ...src.swaps, ...db.swaps };
    db.settings = normSettings(fresh("settings") ? { ...db.settings, ...src.settings } : { ...src.settings, ...db.settings });
    FIELDS.forEach((f) => (shadow[f] = undefined));
  }

  function importJson(text) {
    const d = JSON.parse(text);
    if (!d || !Array.isArray(d.sessions)) throw new Error("This file is not a Jin-Woo gym backup.");
    if (account) mergeIn(d, true);
    else db = normalize(d);
    save();
  }

  function reset() {
    db = empty();
    save();
  }

  /* ---------- Accounts ---------- */

  function useAccount(id) {
    if ((id || null) === account) return;
    open(id);
    if (account) localStorage.setItem(ACCOUNT_KEY, account);
    else localStorage.removeItem(ACCOUNT_KEY);
  }

  /* Removes this device's copy of an account. Only safe once nothing is pending. */
  function forget(id) {
    localStorage.removeItem(`${LOCAL_KEY}:${id}`);
    if (id === account) useAccount(null);
  }

  /* The signed-out log on this device, offered for upload on first sign-in. */
  function localData() {
    const d = read(LOCAL_KEY);
    if (!d) return null;
    const n = normalize(d);
    if (!n.sessions.length && !n.checkins.length && !n.draft) return null;
    const last = n.sessions[n.sessions.length - 1];
    return { data: n, sessions: n.sessions.length, checkins: n.checkins.length, draft: !!n.draft, sig: `${n.sessions.length}:${n.checkins.length}:${last ? last.id : ""}:${!!n.draft}` };
  }

  function adoptLocal() {
    const raw = localStorage.getItem(LOCAL_KEY);
    const d = raw && JSON.parse(raw);
    if (!d || !account) return;
    mergeIn(d, false);
    save();
    localStorage.setItem(`${LOCAL_KEY}.backup-${new Date().toISOString().slice(0, 19).replace(/:/g, "")}`, raw);
    localStorage.removeItem(LOCAL_KEY);
  }

  function flag(name, value) {
    if (value === undefined) return meta.flags[name];
    meta.flags[name] = value;
    persist();
  }

  /* ---------- Sync plumbing ---------- */

  function pendingCount() {
    if (!account) return 0;
    return KINDS.reduce((n, k) => n + Object.keys(meta.dirty[k]).length, 0) + (Object.keys(meta.stateDirty).length ? 1 : 0);
  }

  /* Rows waiting to be pushed. `record` is null for a deletion. Read and serialize in the same tick. */
  function pending() {
    const out = { sessions: [], checkins: [], state: null };
    KINDS.forEach((kind) => {
      const byId = new Map(db[kind].map((r) => [r.id, r]));
      Object.keys(meta.dirty[kind]).forEach((id) => {
        const tomb = meta.tombs[kind][id];
        const rec = tomb ? null : byId.get(id);
        if (!tomb && !rec) return void delete meta.dirty[kind][id];
        out[kind].push({ id, stamp: tomb || meta.stamps[kind][id], record: rec });
      });
    });
    if (Object.keys(meta.stateDirty).length) {
      out.state = { draft: db.draft, swaps: db.swaps, settings: db.settings, stamps: { ...meta.state } };
    }
    return out;
  }

  /* A row is clean only if it was not edited again while the push was in flight. */
  function markPushed(kind, list) {
    list.forEach(({ id, stamp: s }) => {
      if (meta.tombs[kind][id] === s) {
        delete meta.tombs[kind][id];
        delete meta.dirty[kind][id];
      } else if (meta.stamps[kind][id] === s) {
        delete meta.dirty[kind][id];
      }
    });
    persist();
  }

  function markStatePushed(stamps) {
    FIELDS.forEach((f) => {
      if (meta.state[f] && meta.state[f] === stamps[f]) delete meta.stateDirty[f];
    });
    persist();
  }

  /* Last write wins per record. rows: [{ id, stamp, deleted, record }]. Returns true if visible data changed. */
  function applyRemote(kind, rows) {
    let changed = false;
    rows.forEach((row) => {
      const local = meta.stamps[kind][row.id] || meta.tombs[kind][row.id];
      if (local && Date.parse(local) === Date.parse(row.stamp)) {
        delete meta.dirty[kind][row.id];
        delete meta.tombs[kind][row.id];
        // Same version: take the server's form ("84.0" comes back as "84") so every device holds identical data.
        const j = !row.deleted && JSON.stringify(row.record);
        const i = j ? db[kind].findIndex((r) => r.id === row.id) : -1;
        if (i >= 0 && shadow[kind].get(row.id) !== j) {
          db[kind][i] = row.record;
          shadow[kind].set(row.id, j);
          changed = true;
        }
        return;
      }
      if (meta.dirty[kind][row.id] && local && Date.parse(local) > Date.parse(row.stamp)) return;
      delete meta.dirty[kind][row.id];
      delete meta.tombs[kind][row.id];
      const i = db[kind].findIndex((r) => r.id === row.id);
      if (row.deleted) {
        delete meta.stamps[kind][row.id];
        shadow[kind].delete(row.id);
        if (i >= 0) {
          db[kind].splice(i, 1);
          changed = true;
        }
      } else {
        meta.stamps[kind][row.id] = row.stamp;
        shadow[kind].set(row.id, JSON.stringify(row.record));
        if (i >= 0) db[kind][i] = row.record;
        else db[kind].push(row.record);
        changed = true;
      }
    });
    if (kind === "checkins" && dedupeWeeks()) changed = true;
    persist();
    return changed;
  }

  /* Two devices can each create a check-in for the same week offline. Every device keeps the same one
     (newest stamp, then highest id) and deletes the other, so they converge. */
  function dedupeWeeks() {
    const keep = new Map();
    const newer = (a, b) => {
      const sa = Date.parse(meta.stamps.checkins[a.id] || 0), sb = Date.parse(meta.stamps.checkins[b.id] || 0);
      return sa !== sb ? sa > sb : a.id > b.id;
    };
    db.checkins.forEach((c) => {
      const k = keep.get(c.week);
      if (!k || newer(c, k)) keep.set(c.week, c);
    });
    const losers = db.checkins.filter((c) => keep.get(c.week) !== c);
    losers.forEach((c) => {
      shadow.checkins.delete(c.id);
      meta.tombs.checkins[c.id] = stamp(meta.stamps.checkins[c.id]);
      delete meta.stamps.checkins[c.id];
      meta.dirty.checkins[c.id] = 1;
    });
    if (losers.length) db.checkins = db.checkins.filter((c) => keep.get(c.week) === c);
    return losers.length > 0;
  }

  /* Same rule, per field of the user_state blob. row: { draft, swaps, settings, stamps: { draft, swaps, settings } } */
  function applyRemoteState(row) {
    let changed = false;
    FIELDS.forEach((f) => {
      const r = row.stamps[f];
      if (!r) return;
      const l = meta.state[f];
      if (l && Date.parse(l) === Date.parse(r)) return void delete meta.stateDirty[f];
      if (meta.stateDirty[f] && l && Date.parse(l) > Date.parse(r)) return;
      delete meta.stateDirty[f];
      meta.state[f] = r;
      if (f === "draft") db.draft = row.draft || null;
      else if (f === "swaps") db.swaps = row.swaps && typeof row.swaps === "object" ? row.swaps : {};
      else db.settings = normSettings(row.settings);
      shadow[f] = JSON.stringify(db[f]);
      changed = true;
    });
    persist();
    return changed;
  }

  const cursor = (kind) => meta.cursor[kind] || null;
  function setCursor(kind, iso) {
    meta.cursor[kind] = iso;
    persist();
  }

  const onSave = (fn) => listeners.push(fn);

  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  return {
    get db() { return db; },
    get account() { return account; },
    cloud, DAYS,
    save, uid, finishedSessions, exportJson, importJson, reset,
    useAccount, forget, localData, adoptLocal, flag,
    pendingCount, pending, markPushed, markStatePushed, applyRemote, applyRemoteState, cursor, setCursor, onSave,
  };
})();
