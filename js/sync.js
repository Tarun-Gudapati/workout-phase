/* Accounts and background sync with Supabase. Inert when js/config.js is empty.
   Cycle: pull rows changed since the server cursor, merge (last write wins), then push the outbox. */

const Sync = (() => {
  const cfg = window.APP_CONFIG || {};
  const enabled = Store.cloud;
  const KINDS = ["sessions", "checkins"];
  const PROFILE_KEY = "jw.gym.profile:";
  const PAGE = 500;
  /* Re-read a little before the cursor: a write that started before our last pull may have committed after it. */
  const OVERLAP = 2 * 60 * 1000;
  const INTERVAL = 60 * 1000;

  let client = null;
  let user = null;
  let profile = null;
  let state = "idle";
  let lastError = "";
  let lastSync = null;
  let failures = 0;
  let retryAt = 0;
  let timer = null;
  let running = false;
  let again = false;
  let offeredLocal = false;
  let profileFresh = false;
  let waiters = [];
  const handlers = {};

  const on = (ev, fn) => (handlers[ev] = handlers[ev] || []).push(fn);
  const emit = (ev, arg) => (handlers[ev] || []).forEach((fn) => fn(arg));

  function setState(s) {
    state = s;
    emit("status");
  }

  const isNetwork = (e) => !navigator.onLine || /fetch|network|load failed|timed? ?out/i.test((e && (e.message || e.name)) || "");

  /* ---------- Row mapping ---------- */

  const iso = (v) => (v ? new Date(v).toISOString() : null);
  const numOrNull = (v) => {
    if (v === "" || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const str = (v) => (v == null ? "" : String(v));
  const CHECK_NUMS = ["weight", "waist", "kcal", "protein", "steps", "sleep"];

  const TO = {
    sessions: (x, uid) => {
      const r = x.record || {};
      return {
        user_id: uid, id: x.id, day_id: r.dayId || null, date: r.date || null, finished_at: r.finishedAt || null,
        notes: x.record ? r.notes || "" : null, entries: x.record ? r.entries || [] : null, updated_at: x.stamp, deleted: !x.record,
      };
    },
    checkins: (x, uid) => {
      const r = x.record || {};
      const row = { user_id: uid, id: x.id, week: r.week || null, creatine: !!r.creatine, perf_down: !!r.perfDown, notes: x.record ? r.notes || "" : null, updated_at: x.stamp, deleted: !x.record };
      CHECK_NUMS.forEach((k) => (row[k] = numOrNull(r[k])));
      return row;
    },
  };

  const FROM = {
    sessions: (r) => ({
      id: r.id, stamp: iso(r.updated_at), deleted: r.deleted,
      record: { id: r.id, dayId: r.day_id, date: iso(r.date), finishedAt: iso(r.finished_at), notes: r.notes || "", entries: r.entries || [] },
    }),
    checkins: (r) => {
      const rec = { id: r.id, week: r.week };
      CHECK_NUMS.forEach((k) => (rec[k] = str(r[k])));
      Object.assign(rec, { creatine: !!r.creatine, perfDown: !!r.perf_down, notes: r.notes || "" });
      return { id: r.id, stamp: iso(r.updated_at), deleted: r.deleted, record: rec };
    },
  };

  const fromState = (r) => ({
    draft: r.draft, swaps: r.swaps, settings: r.settings,
    stamps: { draft: iso(r.draft_at), swaps: iso(r.swaps_at), settings: iso(r.settings_at) },
  });

  /* ---------- Sync cycle ---------- */

  class Switched extends Error {}
  const check = (uid) => {
    if (Store.account !== uid || !user || user.id !== uid) throw new Switched("Account changed during sync");
  };
  const must = ({ data, error }) => {
    if (error) throw error;
    return data;
  };

  async function pull(kind, uid) {
    const cur = Store.cursor(kind);
    const since = cur ? new Date(Date.parse(cur) - OVERLAP).toISOString() : null;
    let max = cur, changed = false;
    for (let from = 0; ; from += PAGE) {
      let q = client.from(kind).select("*").eq("user_id", uid).order("synced_at").order("id").range(from, from + PAGE - 1);
      if (since) q = q.gte("synced_at", since);
      const rows = must(await q);
      check(uid);
      if (Store.applyRemote(kind, rows.map(FROM[kind]))) changed = true;
      rows.forEach((r) => {
        if (!max || Date.parse(r.synced_at) > Date.parse(max)) max = iso(r.synced_at);
      });
      if (rows.length < PAGE) break;
    }
    if (max && max !== cur) Store.setCursor(kind, max);
    return changed;
  }

  async function pullState(uid) {
    const row = must(await client.from("user_state").select("*").eq("user_id", uid).maybeSingle());
    check(uid);
    return row ? Store.applyRemoteState(fromState(row)) : false;
  }

  async function push(uid) {
    const p = Store.pending();
    let changed = false;
    for (const kind of KINDS) {
      for (let i = 0; i < p[kind].length; i += PAGE) {
        const batch = p[kind].slice(i, i + PAGE);
        const rows = batch.map((x) => TO[kind](x, uid));
        const saved = must(await client.from(kind).upsert(rows, { onConflict: "user_id,id" }).select("id"));
        check(uid);
        const ok = new Set(saved.map((r) => r.id));
        Store.markPushed(kind, batch.filter((x) => ok.has(x.id)));
        // The server skips rows older than what it has; fetch the winners.
        const lost = batch.filter((x) => !ok.has(x.id)).map((x) => x.id);
        if (lost.length) {
          const win = must(await client.from(kind).select("*").eq("user_id", uid).in("id", lost));
          check(uid);
          if (Store.applyRemote(kind, win.map(FROM[kind]))) changed = true;
        }
      }
    }
    if (p.state) {
      const s = p.state;
      const row = { user_id: uid, draft: s.draft, swaps: s.swaps, settings: s.settings, draft_at: s.stamps.draft || null, swaps_at: s.stamps.swaps || null, settings_at: s.stamps.settings || null };
      const merged = must(await client.from("user_state").upsert(row, { onConflict: "user_id" }).select("*").single());
      check(uid);
      Store.markStatePushed(s.stamps);
      if (Store.applyRemoteState(fromState(merged))) changed = true;
    }
    return changed;
  }

  async function ensureUser() {
    if (user) return true;
    const { data, error } = await client.auth.getSession();
    if (data && data.session) {
      adopt(data.session.user);
      return true;
    }
    if (error && isNetwork(error)) throw error;
    setState("signedout");
    return false;
  }

  function settle() {
    const w = waiters;
    waiters = [];
    w.forEach((fn) => fn());
  }

  async function run() {
    timer = null;
    if (running) return void (again = true);
    if (!enabled || !Store.account) return settle();
    if (!navigator.onLine) {
      setState("offline");
      return settle();
    }
    running = true;
    let ok = false;
    try {
      if (!(await ensureUser())) return;
      const uid = user.id;
      setState("syncing");
      let changed = false;
      for (const kind of KINDS) if (await pull(kind, uid)) changed = true;
      if (await pullState(uid)) changed = true;
      if (await push(uid)) changed = true;
      ok = true;
      failures = 0;
      retryAt = 0;
      lastError = "";
      lastSync = new Date().toISOString();
      setState("idle");
      if (changed) emit("data");
      if (!profileFresh) refreshProfile();
      offerLocal();
    } catch (e) {
      if (e instanceof Switched) return;
      failures++;
      lastError = (e && e.message) || String(e);
      const wait = Math.min(5 * 60 * 1000, 5000 * 2 ** (failures - 1));
      retryAt = Date.now() + wait;
      if (!isNetwork(e)) console.error("Sync failed", e);
      setState(isNetwork(e) ? "offline" : "error");
      clearTimeout(timer);
      timer = setTimeout(run, wait);
    } finally {
      running = false;
      const follow = again && ok;
      again = false;
      if (follow) schedule(0);
      else settle();
    }
  }

  /* `force` ignores the error backoff (manual sync, back online). */
  function schedule(delay = 2000, force) {
    if (!enabled || !Store.account) return;
    if (force) retryAt = 0;
    const wait = Math.max(delay, retryAt - Date.now());
    clearTimeout(timer);
    timer = setTimeout(run, wait);
    emit("status");
  }

  /* Resolves when the forced run (and any follow-up for edits made meanwhile) is done, even if it failed. */
  function syncNow() {
    if (!enabled || !Store.account) return Promise.resolve();
    return new Promise((resolve) => {
      waiters.push(resolve);
      setTimeout(resolve, 15000);
      schedule(0, true);
    });
  }

  function offerLocal() {
    if (offeredLocal) return;
    offeredLocal = true;
    const local = Store.localData();
    if (local && Store.flag("localDeclined") !== local.sig) emit("migrate", local);
  }

  /* ---------- Auth ---------- */

  function cachedProfile(id) {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY + id)) || null;
    } catch (e) {
      return null;
    }
  }

  function adopt(u) {
    const switched = Store.account !== u.id;
    user = u;
    if (switched) {
      Store.useAccount(u.id);
      offeredLocal = false;
      failures = 0;
      retryAt = 0;
    }
    profile = cachedProfile(u.id) || profile;
    if (switched) {
      profileFresh = false;
      emit("account");
    }
    if (navigator.onLine) refreshProfile();
  }

  async function refreshProfile() {
    if (!user) return;
    const { data, error } = await client.from("profiles").select("id, display_name, role, coach_code").eq("id", user.id).maybeSingle();
    if (error || !data || !user || data.id !== user.id) return;
    profile = { ...data, email: user.email };
    profileFresh = true;
    localStorage.setItem(PROFILE_KEY + user.id, JSON.stringify(profile));
    emit("profile");
  }

  function onAuth(event, session) {
    if (event === "PASSWORD_RECOVERY") emit("recovery");
    if (session && session.user) {
      adopt(session.user);
      if (event !== "TOKEN_REFRESHED" && event !== "USER_UPDATED") schedule(0, true);
    } else if (event === "SIGNED_OUT") {
      user = null;
      if (Store.account) setState("signedout");
    }
    // INITIAL_SESSION with no session also happens offline with an expired token; run() re-checks when online.
    emit("status");
  }

  const redirectUrl = () => location.origin + location.pathname;

  function start() {
    if (!enabled) return;
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    });
    if (Store.account) profile = cachedProfile(Store.account);
    // Supabase warns against awaiting its own calls inside this callback.
    client.auth.onAuthStateChange((event, session) => setTimeout(() => onAuth(event, session), 0));
    Store.onSave(() => schedule(2000));
    window.addEventListener("online", () => {
      client.auth.startAutoRefresh();
      schedule(0, true);
    });
    window.addEventListener("offline", () => {
      client.auth.stopAutoRefresh();
      setState("offline");
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") schedule(0);
    });
    setInterval(() => {
      if (navigator.onLine && document.visibilityState === "visible" && !timer && !running) schedule(0);
    }, INTERVAL);
    if (Store.account) schedule(0);
  }

  const auth = () => client.auth;
  const fail = (r) => {
    if (r.error) throw r.error;
    return r.data;
  };

  async function signUp(email, password, name) {
    const data = fail(await auth().signUp({ email, password, options: { data: { display_name: name }, emailRedirectTo: redirectUrl() } }));
    return { needsCode: !data.session };
  }

  const signIn = async (email, password) => fail(await auth().signInWithPassword({ email, password }));
  const verifyCode = async (email, token, type) => fail(await auth().verifyOtp({ email, token: token.trim(), type }));
  const resendCode = async (email) => fail(await auth().resend({ type: "signup", email, options: { emailRedirectTo: redirectUrl() } }));
  const sendReset = async (email) => fail(await auth().resetPasswordForEmail(email, { redirectTo: redirectUrl() }));
  const setPassword = async (password) => fail(await auth().updateUser({ password }));

  /* Keeps the device copy if anything is still unsynced, so a later sign-in can push it. */
  async function signOut() {
    const id = Store.account;
    await auth().signOut({ scope: "local" });
    user = null;
    profile = null;
    if (id) {
      if (Store.pendingCount()) Store.useAccount(null);
      else Store.forget(id);
      localStorage.removeItem(PROFILE_KEY + id);
    }
    clearTimeout(timer);
    timer = null;
    setState("idle");
    emit("account");
  }

  async function saveName(name) {
    fail(await client.from("profiles").update({ display_name: name }).eq("id", user.id));
    await refreshProfile();
  }

  function adoptLocal() {
    Store.adoptLocal();
    emit("data");
  }

  function declineLocal(local) {
    Store.flag("localDeclined", local.sig);
  }

  /* ---------- Coach links ---------- */

  async function all(build) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const rows = must(await build().range(from, from + 999));
      out.push(...rows);
      if (rows.length < 1000) return out;
    }
  }

  const joinCoach = async (code) => fail(await client.rpc("join_coach", { code }));
  const myCoaches = async () => fail(await client.rpc("my_coaches"));
  const unlinkCoach = async (coachId) => fail(await client.from("coach_athletes").delete().eq("coach_id", coachId).eq("athlete_id", user.id));
  const myAthletes = async () => fail(await client.rpc("my_athletes"));
  const removeAthlete = async (athleteId) => fail(await client.from("coach_athletes").delete().eq("coach_id", user.id).eq("athlete_id", athleteId));

  const toSession = (r) => FROM.sessions(r).record;
  const toCheckin = (r) => FROM.checkins(r).record;
  const byDate = (a, b) => a.date.localeCompare(b.date);

  async function athletesOverview(ids) {
    if (!ids.length) return { sessions: [], checkins: [] };
    const [sessions, checkins] = await Promise.all([
      all(() => client.from("sessions").select("user_id, id, date, finished_at").in("user_id", ids).eq("deleted", false).not("finished_at", "is", null).order("date")),
      all(() => client.from("checkins").select("*").in("user_id", ids).eq("deleted", false).order("week")),
    ]);
    return {
      sessions: sessions.map((r) => ({ userId: r.user_id, id: r.id, date: iso(r.date), finishedAt: iso(r.finished_at) })),
      checkins: checkins.map((r) => ({ userId: r.user_id, ...toCheckin(r) })),
    };
  }

  async function athleteDetail(id) {
    const [sessions, checkins] = await Promise.all([
      all(() => client.from("sessions").select("*").eq("user_id", id).eq("deleted", false).not("finished_at", "is", null).order("date").order("id")),
      all(() => client.from("checkins").select("*").eq("user_id", id).eq("deleted", false).order("week")),
    ]);
    return { sessions: sessions.map(toSession).sort(byDate), checkins: checkins.map(toCheckin) };
  }

  function status() {
    const pending = Store.pendingCount();
    const signedIn = !!Store.account;
    let s = state;
    if (signedIn && !navigator.onLine) s = "offline";
    else if (signedIn && s === "idle" && pending) s = "pending";
    return { enabled, signedIn, live: !!user, state: s, pending, lastSync, error: lastError };
  }

  return {
    enabled, start, on, status, schedule, syncNow,
    get user() { return user; },
    get profile() { return profile; },
    get isCoach() { return !!(profile && profile.role === "coach" && Store.account); },
    signUp, signIn, verifyCode, resendCode, sendReset, setPassword, signOut, saveName, refreshProfile,
    adoptLocal, declineLocal,
    joinCoach, myCoaches, unlinkCoach, myAthletes, removeAthlete, athletesOverview, athleteDetail,
  };
})();
