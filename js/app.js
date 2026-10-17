/* UI: hash router + views. */

const app = document.getElementById("app");
const modal = document.getElementById("modal");
const restBar = document.getElementById("rest");
const { num, fmtKg } = Logic;

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const fmtWeek = (key) => Logic.parseYmd(key).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const fmtInt = (n) => Math.round(n).toLocaleString("en-IN");
const two = (n) => String(n).padStart(2, "0");
const daysAgo = (iso) => {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(iso); b.setHours(0, 0, 0, 0);
  return Math.round((a - b) / 864e5);
};
const agoText = (iso) => {
  const d = daysAgo(iso);
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};
const pctText = (p) => (p == null ? "—" : `${p >= 0 ? "+" : ""}${(p * 100).toFixed(1)}%`);
const deltaCls = (p) => (p == null ? "muted" : p > 0.005 ? "up" : p < -0.005 ? "down" : "same");
const imgSrc = (ex, f) => `img/ex/${ex.img}-${f}.jpg`;
const IMG = `width="640" height="427" loading="lazy" decoding="async"`;
const DAY_NAMES = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const ytUrl = (ex) => "https://www.youtube.com/results?search_query=" + encodeURIComponent("Jeff Nippard " + ex.yt);

function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
}

function split(text) {
  return esc(text).split(" ").map((w, i) => `<span class="w"><span style="animation-delay:${i * 70}ms">${w}</span></span>`).join(" ");
}

function tierBadge(t) {
  if (!t) return "";
  const cls = t === "S+" ? "splus" : t === "Pick" ? "pick" : t.toLowerCase();
  return `<span class="tier t-${cls}">${t === "Pick" ? "Nippard pick" : esc(t) + " tier"}</span>`;
}

function thumb(ex, attrs = "") {
  return `<button class="thumb" ${attrs} aria-label="How to do ${esc(ex.name)}">
    <img src="${imgSrc(ex, 0)}" alt="" ${IMG}><img class="f2" src="${imgSrc(ex, 1)}" alt="" ${IMG}></button>`;
}

const mmap = (ex) => `<div class="mmap">${MuscleMap.svg(ex.muscle, ex.secondary || [])}</div>`;

function muscleLegend(ex) {
  const sec = ex.secondary || [];
  return `<p class="mm-legend small"><span class="key p"></span><b>Main:</b> ${esc(ex.muscle)}${sec.length ? ` <span class="muted">·</span> <span class="key s"></span><b>Helpers:</b> ${esc(sec.join(", "))}` : ""}</p>`;
}

const caution = (ex) => (ex.caution ? `<p class="caution small"><b>Careful</b>${esc(ex.caution)}</p>` : "");

function exMedia(ex, attrs = "") {
  return `<div class="ex-media">
    <button class="photo" ${attrs} aria-label="How to do ${esc(ex.name)}"><img src="${imgSrc(ex, 0)}" alt="" ${IMG}><img class="f2" src="${imgSrc(ex, 1)}" alt="" ${IMG}></button>
    ${mmap(ex)}
  </div>`;
}

function howto(ex) {
  return `<div class="howto">
    <div class="frames"><img src="${imgSrc(ex, 0)}" alt="${esc(ex.name)} start" ${IMG}><img src="${imgSrc(ex, 1)}" alt="${esc(ex.name)} end" ${IMG}></div>
    <div class="howto-mm">${mmap(ex)}<div>${muscleLegend(ex)}${caution(ex)}</div></div>
    ${ex.similar ? `<p class="small muted">The image shows a similar movement. Use the cues and the video for exact form.</p>` : ""}
    <ol class="cues">${ex.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>
    <a class="btn yt full" href="${ytUrl(ex)}" target="_blank" rel="noopener">Watch Jeff Nippard on YouTube ↗</a>
  </div>`;
}

const repsText = (t, ex) => `${t.sets} × ${t.reps[0]}-${t.reps[1]}${ex.perSide ? " /side" : ""} · RIR ${esc(t.rir)}`;

function stat(value, label, delta, fmt = "int") {
  return `<div class="stat"><div class="n" data-count="${value}" data-fmt="${fmt}">0</div><div class="mono muted">${label}</div><div class="d ${deltaCls(delta)}">${pctText(delta)}</div></div>`;
}

function label(left, right = "") {
  return `<div class="label mono"><span>${left}</span><b>${right}</b></div>`;
}

function trainingLevel(n) {
  let i = 0;
  while (i + 1 < LEVELS.length && n >= LEVELS[i + 1].at) i++;
  const cur = LEVELS[i], next = LEVELS[i + 1];
  return { i, cur, next, toNext: next ? next.at - n : 0, pct: next ? Math.round(((n - cur.at) / (next.at - cur.at)) * 100) : 100 };
}

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

function levelCard(n) {
  const L = trainingLevel(n);
  return `<a class="panel framed level-card" href="#/levels" data-reveal aria-label="Training level ${esc(L.cur.name)}. See all levels">
    <span class="lv-num mono">Level ${L.i + 1}</span>
    <span class="lv-main"><b class="lv-name">${esc(L.cur.name)}</b>
      <span class="bar"><i style="width:${L.pct}%"></i></span>
      <span class="small muted">${L.next ? `${plural(L.toNext, "workout")} to ${esc(L.next.name)}` : "Top level. Keep the habit going."}</span></span>
    <span class="go" aria-hidden="true">→</span>
  </a>`;
}

function foot() {
  return `<footer class="foot"><div class="big" aria-hidden="true">Beyond</div><span class="mono">Beyond Training</span><span class="mono">${Store.account ? "Synced to your account" : "Data stays on this device"}</span></footer>`;
}

/* ---------- Motion ---------- */

let observer;
function animateIn() {
  if (observer) observer.disconnect();
  observer = new IntersectionObserver((items) => {
    items.forEach((it) => {
      if (it.isIntersecting) {
        it.target.classList.add("in");
        observer.unobserve(it.target);
      }
    });
  }, { threshold: 0 });
  app.querySelectorAll("[data-reveal]").forEach((el, i) => {
    el.style.transitionDelay = `${(i % 5) * 60}ms`;
    observer.observe(el);
  });
  app.querySelectorAll("[data-count]").forEach(countUp);
}

window.addEventListener("scroll", () => {
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80) {
    app.querySelectorAll("[data-reveal]:not(.in)").forEach((el) => el.classList.add("in"));
  }
}, { passive: true });

function countUp(el) {
  const target = parseFloat(el.dataset.count) || 0;
  const fmt = el.dataset.fmt;
  const show = (v) => (fmt === "k" ? (v >= 1000 ? (v / 1000).toFixed(1) + "k" : fmtInt(v)) : fmt === "1" ? v.toFixed(1) : fmtInt(v));
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return (el.textContent = show(target));
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / 900);
    el.textContent = show(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function tickClock() {
  const el = document.getElementById("clock");
  if (el) el.textContent = `WK ${isoWeek()} · ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}
tickClock();
setInterval(tickClock, 20000);

/* ---------- Router ---------- */

const VIEWS = () => ({
  train: renderTrain, log: renderLog, summary: renderSummary, history: renderHistory, progress: renderProgress, body: renderBody, plan: renderPlan, levels: renderLevels,
  account: Account.render, coach: Coach.render,
});

const currentView = () => (location.hash.replace(/^#\/?/, "") || "train").split("/")[0];

function paint(keepScroll) {
  const y = window.scrollY;
  const h = location.hash.replace(/^#\/?/, "") || "train";
  const [view, arg] = h.split("/");
  document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("active", a.dataset.tab === (["log", "summary", "levels"].includes(view) ? "train" : view)));
  (VIEWS()[view] || renderTrain)(arg);
  Device.keepAwake(view === "log" && !!Store.db.draft);
  document.documentElement.classList.toggle("on-log", view === "log");
  renderTopRight(view);
  updateRest();
  if (keepScroll) {
    app.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("in"));
    app.querySelectorAll("[data-count]").forEach((el) => countUp(el));
    window.scrollTo(0, y);
  } else {
    animateIn();
    window.scrollTo(0, 0);
  }
}

function route() {
  closeModal();
  paint(false);
}
const rerender = () => paint(true);
window.addEventListener("hashchange", route);

let topHtml = null;
function renderTopRight(view) {
  document.querySelector('.tabs a[data-tab="coach"]').classList.toggle("hidden", !Sync.isCoach);
  const d = Store.db.draft;
  const html = (d && view !== "log" ? `<a class="pill live" href="#/log">${esc(PROGRAM.days[d.dayId].name)} live</a>` : "") + Account.pill();
  if (html !== topHtml) document.getElementById("top-right").innerHTML = topHtml = html;
}

/* ---------- Train ---------- */

function weekStats() {
  const wk = Logic.weekStart();
  const cur = Logic.weekTotals(wk);
  const prev = Logic.weekTotals(Logic.addWeeks(wk, -1));
  return `<div class="stats" data-reveal>
    ${stat(cur.sessions, "Workouts", Logic.pct(cur.sessions, prev.sessions))}
    ${stat(cur.sets, "Hard sets", Logic.pct(cur.sets, prev.sets))}
    ${stat(cur.volume, "Volume kg", Logic.pct(cur.volume, prev.volume), "k")}
  </div>
  <p class="small muted">Week from Monday ${fmtWeek(wk)}. Last week: ${prev.sessions} workouts, ${prev.sets} sets, ${fmtInt(prev.volume)} kg. Compare at the end of the week.</p>`;
}

const restNote = (key) => Store.db.settings.restLabels[key] || "";

function nextUp(t) {
  const d = t.dayId && PROGRAM.days[t.dayId];
  const note = restNote(t.key);
  return `<section class="panel framed next-up" data-reveal>
    <div class="mono muted">Tomorrow · ${DAY_NAMES[t.key]}</div>
    <h3>${d ? esc(d.name) : "Rest"}</h3>
    <p class="small muted">${d ? `${esc(d.focus)} · ${d.slots.length} exercises` : `Recovery day${note ? " · " + esc(note) : ""}`}</p>
  </section>`;
}

function trainHero(plan, lastOf) {
  const t = plan.today;
  const d = t.dayId && PROGRAM.days[t.dayId];
  const draft = Store.db.draft;
  const meta = (extra = "") => `<div class="meta mono"><span>Today · ${DAY_NAMES[t.key]}${extra}</span><span>${fmtDate(new Date())}</span></div>`;
  if (!d) {
    const note = restNote(t.key);
    const trained = plan.trainedToday.map((s) => PROGRAM.days[s.dayId] ? PROGRAM.days[s.dayId].name : "Workout");
    return `<section class="hero rest-day">
      ${meta(note ? " · " + esc(note) : "")}
      <h1 class="display kinetic">Rest</h1>
      <p class="lede split"><b>${split("Recovery day.")}</b> ${split("Muscles grow while you rest. Walk, stretch, eat your protein and sleep 7-8 hours.")}</p>
      ${trained.length ? `<p class="mono up">Trained today · ${esc(trained.join(", "))}</p>` : ""}
      <details class="anyway"><summary class="btn full">Train anyway</summary>
        <div class="anyway-list">${PROGRAM.order.map((id) => `<button class="btn" data-start="${id}">${esc(PROGRAM.days[id].name)}</button>`).join("")}</div>
      </details>
    </section>`;
  }
  if (plan.doneToday) {
    const st = Logic.sessionStats(plan.doneToday);
    return `<section class="hero cleared">
      ${meta(` · <b class="up">Cleared</b>`)}
      <h1 class="display kinetic${d.name.length > 5 ? " long" : ""}"><span class="outline">${esc(d.name)}</span></h1>
      <p class="lede"><b>Workout done.</b> ${st.sets} sets, ${fmtInt(st.volume)} kg. Eat, rest and sleep well.</p>
      <a class="cta ghost" href="#/summary/${plan.doneToday.id}"><span>See summary</span><span class="arrow">↗</span></a>
    </section>`;
  }
  const last = lastOf(t.dayId);
  const live = draft && draft.dayId === t.dayId && !draft.editingId;
  return `<section class="hero">
    ${meta()}
    <h1 class="display kinetic${d.name.length > 5 ? " long" : ""}">${esc(d.name)}</h1>
    <p class="lede split"><b>${split(d.focus + ".")}</b> ${split(`${d.slots.length} exercises. ${last ? "Last time " + agoText(last.date) + "." : "First time."}`)}</p>
    ${live
      ? `<a class="cta" href="#/log"><span>Continue workout</span><span class="arrow">→</span></a>`
      : `<button class="cta" data-start="${t.dayId}"><span>Start workout</span><span class="arrow">→</span></button>`}
  </section>`;
}

function missedNote(plan) {
  if (!plan.missed.length) return "";
  return `<section class="panel warn missed" data-reveal>
    <div class="mono warn-text">Missed this week</div>
    ${plan.missed.map((m) => `<div class="missed-row"><span><b>${esc(PROGRAM.days[m.dayId].name)}</b> <span class="mono muted">${DAY_NAMES[m.key].slice(0, 3)} ${fmtWeek(m.date)}</span></span><button class="btn sm" data-start="${m.dayId}">Start</button></div>`).join("")}
    <p class="small muted">Make one up if you have time. If not, skip it and stay on plan.</p>
  </section>`;
}

let factShift = 0;
const factText = () => FACTS[(((Logic.dayNumber() * 7 + factShift) % FACTS.length) + FACTS.length) % FACTS.length];

function renderTrain() {
  const db = Store.db;
  const fin = Store.finishedSessions();
  const plan = Logic.weekPlan(db.settings.week, fin);
  const t = plan.today;
  const pending = t.dayId && !plan.doneToday ? t.dayId : null;
  const lastOf = (id) => [...fin].reverse().find((s) => s.dayId === id);
  const showId = pending || plan.tomorrow.dayId || t.dayId;
  const names = showId ? PROGRAM.days[showId].slots.map((s) => EXERCISES[db.swaps[s.id] || s.ex].name) : [];
  const backupDue = !Store.account && fin.length >= 3 && (!db.settings.lastBackup || daysAgo(db.settings.lastBackup) >= 14);

  app.innerHTML = `
    ${db.draft ? `<section class="panel accent" data-reveal>
      <div class="mono">${db.draft.editingId ? "Editing a saved workout" : `Workout in progress · started ${fmtTime(db.draft.date)}`}</div>
      <h3 style="font-size:2.6rem;margin-top:6px">${esc(PROGRAM.days[db.draft.dayId].name)}</h3>
      <div class="row"><a class="btn primary" href="#/log">Continue</a><button class="btn" data-act="discard">${db.draft.editingId ? "Cancel edit" : "Discard"}</button></div>
    </section>` : ""}
    ${backupDue ? `<section class="panel warn" data-reveal><b>Back up your log.</b> <span class="muted">It is saved only in this browser.</span> <a class="link" href="#/history">Export</a></section>` : ""}

    ${trainHero(plan, lastOf)}
    ${missedNote(plan)}
    ${pending ? "" : nextUp(plan.tomorrow)}
    ${names.length ? `<div class="marquee" aria-hidden="true"><div class="track">${[...names, ...names].map((x) => `<span>${esc(x)}</span><em>✦</em>`).join("")}</div></div>` : ""}

    <section class="panel framed fact" data-reveal>
      <div class="fact-head"><span class="mono fact-label">Did you know</span><button class="link" data-act="fact">Another</button></div>
      <p id="fact-text" aria-live="polite">${esc(factText())}</p>
    </section>

    ${label("(01) This week", "vs last week")}
    ${weekStats()}

    ${label("(02) Training level", `${plural(fin.length, "workout")} done`)}
    ${levelCard(fin.length)}

    ${label("(03) All workouts", "start any day")}
    <ol class="daylist">
      ${PROGRAM.order.map((id, i) => {
        const d = PROGRAM.days[id], l = lastOf(id);
        return `<li data-reveal><button class="dayrow${id === pending ? " next" : ""}" data-start="${id}">
          <span class="idx mono">${two(i + 1)}</span><span class="name">${esc(d.name)}</span><span class="go">↗</span>
          <span class="info">${esc(d.focus)} · ${l ? "Last " + fmtDate(l.date) : "Not done yet"}</span>
        </button></li>`;
      }).join("")}
    </ol>

    ${Device.installCard()}
    ${foot()}
  `;
}

const LOCK_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/></svg>`;

function renderLevels() {
  const n = Store.finishedSessions().length;
  const L = trainingLevel(n);
  const rungs = LEVELS.map((lv, i) => {
    const state = i < L.i ? "done" : i === L.i ? "here" : "locked";
    const mark = state === "done" ? "✓" : state === "here" ? String(i + 1) : LOCK_ICON;
    const status = state === "done" ? `<span class="mono up">Done</span>` : state === "locked" ? `<span class="mono muted">Locked · ${plural(lv.at - n, "workout")} to go</span>` : "";
    return `<li class="rung ${state}" data-reveal>
      <span class="rung-mark" aria-hidden="true">${mark}</span>
      <div class="rung-body">
        <div class="rung-head"><b>${esc(lv.name)}</b><span class="mono muted">${lv.at ? plural(lv.at, "workout") : "Start"}</span></div>
        <p class="small muted">${esc(lv.text)}</p>
        ${state === "here" ? `<div class="here-tag mono">You are here</div>
          <div class="bar"><i style="width:${L.pct}%"></i></div>
          <p class="small">${L.next ? `${n} of ${L.next.at} workouts · ${plural(L.toNext, "workout")} to ${esc(L.next.name)}` : "Top level reached."}</p>` : status}
      </div>
    </li>`;
  }).reverse().join("");
  app.innerHTML = `
    <a class="btn sm back-btn" href="#/train">← Train</a>
    <h1 class="display page-title kinetic">Levels</h1>
    <p class="small muted">${plural(n, "workout")} completed. You are <b class="up">${esc(L.cur.name)}</b>.</p>
    <ol class="ladder">${rungs}</ol>
    <section class="panel small muted" data-reveal><p>Levels count completed workouts. They measure consistency, not strength. Strength is tracked per exercise in Stats.</p></section>
    ${foot()}
  `;
  /* Runs after paint() resets the scroll, so the current level is on screen. */
  requestAnimationFrame(() => {
    const here = app.querySelector(".rung.here");
    if (!here) return;
    const r = here.getBoundingClientRect();
    if (r.bottom > innerHeight - 110) window.scrollTo({ top: r.top + scrollY - innerHeight * 0.3, behavior: "instant" });
  });
}

function startWorkout(dayId) {
  const db = Store.db;
  if (db.draft && !confirm("A workout is already in progress. Discard it and start a new one?")) return;
  const day = PROGRAM.days[dayId];
  db.draft = {
    id: Store.uid(),
    dayId,
    date: new Date().toISOString(),
    notes: "",
    current: 0,
    entries: day.slots.map((sl) => {
      const exId = db.swaps[sl.id] || sl.ex;
      return { slotId: sl.id, exId, target: { sets: sl.sets, reps: sl.reps, rir: sl.rir }, sets: blankSets(exId, sl.sets, sl.reps), notes: "" };
    }),
  };
  Store.save();
  location.hash = "#/log";
}

/* New sets start at the suggested weight. `goal` holds the target reps for that set. */
function blankSets(exId, count, reps) {
  const prev = Logic.previousEntry(exId);
  let kg = "", goals = [];
  if (prev) {
    const sug = Logic.suggestNext({ ...prev.entry, target: { ...prev.entry.target, sets: count, reps } });
    if (sug.kg > 0) kg = fmtKg(sug.kg);
    goals = sug.targets || [];
  }
  return Array.from({ length: count }, (_, k) => ({ kg, reps: "", rir: "", done: false, goal: goals[k] != null ? String(goals[k]) : "" }));
}

/* ---------- Log ---------- */

function logProgress(d) {
  const total = d.entries.reduce((n, e) => n + e.sets.length, 0);
  const done = d.entries.reduce((n, e) => n + e.sets.filter((s) => num(s.reps) > 0).length, 0);
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

const logIndex = (d) => Math.max(0, Math.min(d.entries.length, Math.floor(num(d.current))));
const entryDone = (e) => e.sets.length > 0 && e.sets.every((s) => num(s.reps) > 0);

function updateLogProgress() {
  const d = Store.db.draft;
  if (!d) return;
  const p = logProgress(d);
  const bar = document.getElementById("log-bar");
  const txt = document.getElementById("log-count");
  const step = document.getElementById("log-step");
  const pos = document.getElementById("log-pos");
  if (bar) bar.style.width = p.pct + "%";
  if (txt) txt.textContent = `${p.done}/${p.total} sets`;
  if (step) step.textContent = stepText(d);
  if (pos) {
    pos.innerHTML = logPos(d);
    centerDot();
  }
}

function centerDot() {
  const pos = document.getElementById("log-pos");
  const on = pos && pos.querySelector(".on");
  if (on) pos.scrollLeft = on.offsetLeft - pos.offsetLeft - (pos.clientWidth - on.offsetWidth) / 2;
}

const stepText = (d) => (logIndex(d) < d.entries.length ? `Exercise ${logIndex(d) + 1} of ${d.entries.length}` : "Review");

function logPos(d) {
  const cur = logIndex(d), n = d.entries.length;
  const dot = (i, text, name, ok) => `<button class="dot${i === cur ? " on" : ""}${ok ? " ok" : ""}" data-goto="${i}" aria-label="${esc(name)}"${i === cur ? ' aria-current="step"' : ""}>${text}</button>`;
  return d.entries.map((e, i) => dot(i, two(i + 1), `Exercise ${i + 1}: ${EXERCISES[e.exId].name}`, entryDone(e))).join("") + dot(n, "✓", "Review and finish", false);
}

function renderLog() {
  const d = Store.db.draft;
  if (!d) {
    app.innerHTML = `<h1 class="display page-title">No workout</h1><p class="muted">Start a workout from the Train tab.</p><a class="cta" href="#/train"><span>Go to Train</span><span class="arrow">→</span></a>`;
    return;
  }
  const day = PROGRAM.days[d.dayId];
  const p = logProgress(d);
  app.innerHTML = `
    <div class="log-head">
      <div class="row1"><h1 class="display">${esc(day.name)}${d.editingId ? " <span class='outline'>Edit</span>" : ""}</h1>
        <span class="r"><span class="mono step" id="log-step">${stepText(d)}</span><br><span class="mono muted" id="log-count">${p.done}/${p.total} sets</span></span></div>
      <div class="bar"><i id="log-bar" style="width:${p.pct}%"></i></div>
      <div class="dots" id="log-pos">${logPos(d)}</div>
    </div>
    <div id="log-body">${logBody(d)}</div>
  `;
  centerDot();
}

function logBody(d) {
  const i = logIndex(d);
  return i < d.entries.length ? exerciseScreen(d, d.entries[i], i) : reviewScreen(d);
}

/* Only the exercise area is repainted; focus returns to the nav button that was used. */
function goTo(i) {
  const d = Store.db.draft;
  const body = document.getElementById("log-body");
  if (!d || !body || currentView() !== "log") return;
  i = Math.max(0, Math.min(d.entries.length, i));
  if (i === logIndex(d)) return;
  const nav = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.nav : null;
  d.current = i;
  Store.save();
  body.innerHTML = logBody(d);
  updateLogProgress();
  window.scrollTo({ top: 0, behavior: "instant" });
  const b = nav && app.querySelector(`[data-nav="${nav}"]:not([disabled])`);
  if (b) b.focus({ preventScroll: true });
}

function previousNote(exId, d) {
  const fin = Store.finishedSessions();
  for (let i = fin.length - 1; i >= 0; i--) {
    const s = fin[i];
    if (s.id === d.editingId || (d.editingId && s.date >= d.date)) continue;
    const e = s.entries.find((x) => x.exId === exId && x.notes);
    if (e) return { date: s.date, text: e.notes };
  }
  return null;
}

function logNav(i, n) {
  return `<div class="lognav stick">
    <button class="btn big" data-nav="back" ${i === 0 ? "disabled" : ""}>← Back</button>
    <button class="btn acc big" data-nav="next">${i === n - 1 ? "Review" : "Next"} →</button>
  </div>`;
}

function exerciseScreen(d, e, i) {
  const ex = EXERCISES[e.exId];
  const prev = Logic.previousEntry(e.exId, d.editingId ? d.date : null, d.editingId);
  const prevSets = prev ? Logic.workSets(prev.entry) : [];
  const sug = prev ? Logic.suggestNext({ ...prev.entry, target: e.target }) : null;
  const note = previousNote(e.exId, d);
  const rirOpts = (v) => ["", "0", "1", "2", "3", "4"].map((o) => `<option value="${o}" ${String(v) === o ? "selected" : ""}>${o === "" ? "–" : o === "4" ? "4+" : o}</option>`).join("");
  return `<article class="panel ex ex-screen" data-i="${i}">
    <div class="ex-head mono"><span>${two(i + 1)} / ${two(d.entries.length)} · ${esc(ex.muscle)}</span>${tierBadge(ex.tier)}</div>
    <div class="ex-title">${esc(ex.name)}</div>
    <div class="ex-sub mono">${repsText(e.target, ex)}</div>
    ${exMedia(ex, `data-howto="${i}"`)}
    ${muscleLegend(ex)}
    ${caution(ex)}
    <div class="ex-info">
      ${prev
        ? `<div class="last"><span class="mono">Last · ${fmtDate(prev.session.date)}</span><br>${esc(Logic.fmtSets(prev.entry))}</div><div class="goal"><b>Today's target</b>${esc(sug.text)}</div>`
        : `<div class="goal"><b>First time</b>Pick a weight you can lift for ${e.target.reps[0]}-${e.target.reps[1]} reps with ${esc(e.target.rir)} reps left.</div>`}
    </div>
    ${note ? `<div class="prev-note small"><span class="mono">Last time you wrote · ${fmtDate(note.date)}</span>${esc(note.text)}</div>` : ""}
    <div class="ex-actions">
      <button class="link" data-howto="${i}">How to</button>
      <button class="link" data-swap="${i}">Swap</button>
      <a class="link" href="${ytUrl(ex)}" target="_blank" rel="noopener">Video ↗</a>
    </div>
    ${i === 0 ? `<p class="small muted">The weight starts at today's target. Grey reps are the target for that set. Type what you did, or tap ✓ on an empty set if you hit the target exactly. Everything saves as you type.</p>` : ""}
    <table class="sets">
      <thead><tr><th>Set</th><th>kg${ex.perSide ? " /side" : ""}</th><th>Reps</th><th>RIR</th><th></th></tr></thead>
      <tbody>
        ${e.sets.map((s, k) => {
          const p = prevSets[k] || prevSets[prevSets.length - 1];
          return `<tr class="${s.done ? "done" : ""}">
            <td class="c">${two(k + 1)}</td>
            <td><input type="number" inputmode="decimal" step="any" min="0" data-f="kg" data-i="${i}" data-k="${k}" enterkeyhint="next" aria-label="Set ${k + 1} kg" value="${esc(s.kg)}" placeholder="${p ? (num(p.kg) ? fmtKg(num(p.kg)) : "BW") : "kg"}"></td>
            <td><input type="number" inputmode="numeric" step="1" min="0" data-f="reps" data-i="${i}" data-k="${k}" enterkeyhint="${k === e.sets.length - 1 ? "done" : "next"}" aria-label="Set ${k + 1} reps" value="${esc(s.reps)}" placeholder="${s.goal ? esc(s.goal) : p ? num(p.reps) : e.target.reps[0] + "-" + e.target.reps[1]}"></td>
            <td><select data-f="rir" data-i="${i}" data-k="${k}" aria-label="Reps in reserve">${rirOpts(s.rir)}</select></td>
            <td><button class="tick ${s.done ? "on" : ""}" data-tick="${i}:${k}" aria-label="Set done">✓</button></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
    <div class="row small-btns"><button class="btn sm" data-addset="${i}">+ Set</button>${e.sets.length > 1 ? `<button class="btn sm" data-rmset="${i}">− Set</button>` : ""}</div>
    <label class="lbl ex-note-lbl" for="enote-${i}">Comment</label>
    <textarea id="enote-${i}" data-enote="${i}" rows="2" placeholder="How did it feel? Pain, machine taken, form cue">${esc(e.notes || "")}</textarea>
  </article>
  ${logNav(i, d.entries.length)}`;
}

function reviewScreen(d) {
  const p = logProgress(d);
  const rows = d.entries.map((e, i) => {
    const ex = EXERCISES[e.exId];
    const done = Logic.workSets(e).length, plan = e.target.sets;
    return `<button class="rev-row" data-goto="${i}">
      <span class="idx mono">${two(i + 1)}</span>
      <span class="rev-main"><b>${esc(ex.name)}</b><span class="small muted">${esc(Logic.fmtSets(e)) || "No sets logged"}</span>${e.notes ? `<span class="small ex-note">${esc(e.notes)}</span>` : ""}</span>
      <span class="mono ${done >= plan ? "up" : "warn-text"}">${done}/${plan} sets</span>
    </button>`;
  }).join("");
  return `<p class="small muted">${p.done < p.total ? `${p.total - p.done} set${p.total - p.done > 1 ? "s" : ""} without reps will not be saved. ` : ""}Tap an exercise to change it.</p>
    <section class="panel review">${rows}</section>
    <section class="panel">
      <label class="lbl" for="notes">Notes · sleep, energy, pain, busy gym</label>
      <textarea id="notes" data-notes rows="3">${esc(d.notes)}</textarea>
    </section>
    <button class="btn danger full" data-act="discard">${d.editingId ? "Cancel edit" : "Discard workout"}</button>
    <div class="lognav stick">
      <button class="btn big" data-nav="back">← Back</button>
      <button class="btn acc big" data-act="finish">${d.editingId ? "Save changes" : "Finish workout"} ✓</button>
    </div>`;
}

function openHowto(i) {
  const ex = EXERCISES[Store.db.draft.entries[i].exId];
  modal.innerHTML = `<div class="sheet" role="dialog" aria-label="How to do ${esc(ex.name)}">
    <div class="mono muted">How to</div>
    <h3>${esc(ex.name)}</h3>
    ${howto(ex)}
    <button class="btn full" data-act="close">Close</button>
  </div>`;
  modal.classList.remove("hidden");
}

function tickSet(i, k) {
  const d = Store.db.draft;
  const e = d.entries[i];
  const s = e.sets[k];
  if (!s.done) {
    const prev = Logic.previousEntry(e.exId, d.editingId ? d.date : null, d.editingId);
    const ps = prev ? Logic.workSets(prev.entry) : [];
    const p = ps[k] || ps[ps.length - 1];
    if (s.kg === "" && p) s.kg = num(p.kg) ? fmtKg(num(p.kg)) : "0";
    if (s.reps === "" && s.goal) s.reps = s.goal;
    else if (s.reps === "" && p) s.reps = String(num(p.reps));
    if (s.reps === "") {
      alert("Type the reps for this set first.");
      return;
    }
    s.done = true;
    d.restAt = Date.now();
    d.restEx = EXERCISES[e.exId].name;
    d.restFor = restSeconds(e.exId);
    Device.cue("set");
  } else {
    s.done = false;
  }
  Store.save();
  rerender();
}

function finishWorkout() {
  const db = Store.db;
  const d = db.draft;
  const filled = d.entries.reduce((n, e) => n + Logic.workSets(e).length, 0);
  if (!filled) {
    alert("Log at least one set with reps before you finish.");
    return;
  }
  const empty = d.entries.reduce((n, e) => n + e.sets.filter((s) => !num(s.reps)).length, 0);
  if (empty && !confirm(`${empty} set${empty > 1 ? "s have" : " has"} no reps and will not be saved. Finish anyway?`)) return;

  const session = {
    id: d.editingId || d.id,
    dayId: d.dayId,
    date: d.date,
    finishedAt: d.editingId ? d.finishedAt : new Date().toISOString(),
    notes: d.notes || "",
    entries: d.entries.map((e) => ({
      slotId: e.slotId,
      exId: e.exId,
      target: e.target,
      sets: e.sets.filter((s) => num(s.reps) > 0).map((s) => ({ kg: num(s.kg), reps: num(s.reps), rir: s.rir === "" ? "" : num(s.rir) })),
      notes: (e.notes || "").trim(),
    })),
  };
  const idx = db.sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) db.sessions[idx] = session;
  else db.sessions.push(session);
  db.draft = null;
  Store.save();
  location.hash = "#/summary/" + session.id;
}

function discardDraft() {
  const d = Store.db.draft;
  if (!d) return;
  if (!confirm(d.editingId ? "Cancel the edit? The saved workout stays as it was." : "Discard this workout? The sets you typed will be lost.")) return;
  Store.db.draft = null;
  Store.save();
  location.hash = "#/train";
  route();
}

function openSwap(i) {
  const d = Store.db.draft;
  const e = d.entries[i];
  const cur = EXERCISES[e.exId];
  const options = Object.entries(EXERCISES).filter(([id, x]) => x.group === cur.group && id !== e.exId);
  modal.innerHTML = `<div class="sheet">
    <div class="mono muted">Swap exercise</div>
    <h3>${esc(cur.name)}</h3>
    <p class="small muted">Use this when the machine is taken or missing. The app remembers your choice for next time.</p>
    ${options.length ? options.map(([id, x]) => `<button class="opt" data-pick="${i}:${id}">${thumb(x, "tabindex=-1")}<span><b>${esc(x.name)}</b> ${tierBadge(x.tier)}</span></button>`).join("") : `<p>No alternatives in this group.</p>`}
    <button class="btn full" data-act="close">Cancel</button>
  </div>`;
  modal.classList.remove("hidden");
}

function pickSwap(i, id) {
  const db = Store.db;
  const e = db.draft.entries[i];
  e.exId = id;
  e.sets = blankSets(id, e.target.sets, e.target.reps);
  const slot = Object.values(PROGRAM.days).flatMap((dd) => dd.slots).find((s) => s.id === e.slotId);
  if (slot && slot.ex === id) delete db.swaps[e.slotId];
  else db.swaps[e.slotId] = id;
  Store.save();
  closeModal();
  rerender();
}

function closeModal() {
  modal.classList.add("hidden");
  modal.innerHTML = "";
}

/* ---------- Rest timer ---------- */

function updateRest() {
  const d = Store.db.draft;
  const onLog = location.hash.startsWith("#/log");
  const secs = d && d.restAt ? Math.floor((Date.now() - d.restAt) / 1000) : 0;
  const show = !!(d && d.restAt && onLog && secs <= 600);
  document.body.classList.toggle("resting", show);
  if (!show) {
    restBar.classList.add("hidden");
    return;
  }
  const target = d.restFor || 120;
  const done = secs >= target;
  if (done && restCued !== d.restAt) {
    restCued = d.restAt;
    if (secs < target + 5) Device.cue("rest");
  }
  const clock = (n) => `${Math.floor(n / 60)}:${two(n % 60)}`;
  restBar.classList.toggle("done", done);
  restBar.innerHTML = `<span><b>${clock(secs)}</b><span class="small">${esc(d.restEx || "")}</span></span><span class="mono">${done ? "Rest done · go" : `Rest ${clock(target)}`}</span>`;
  restBar.classList.remove("hidden");
}

/* Big compound lifts get 3 minutes, smaller lifts 90 seconds. */
const COMPOUND = ["chest-press", "shoulder-press", "row", "lat", "squat", "single-leg", "hinge"];
const restSeconds = (exId) => (COMPOUND.includes(EXERCISES[exId].group) ? 180 : 90);
let restCued = null;
setInterval(updateRest, 1000);

/* ---------- Summary ---------- */

function mostlyDown(session) {
  let down = 0, comparable = 0;
  session.entries.forEach((e) => {
    const prev = Logic.previousEntry(e.exId, session.date, session.id);
    const c = Logic.compareEntry(e, prev && prev.entry);
    if (["up", "heavier", "same", "down"].includes(c.verdict)) comparable++;
    if (c.verdict === "down") down++;
  });
  return comparable >= 2 && down / comparable >= 0.5;
}

/* Best estimated 1RM (or reps for bodyweight) beats every earlier session for this exercise. */
function isPR(entry, session) {
  const cur = Logic.entryStats(entry).best;
  if (!cur) return false;
  let best = null;
  Store.finishedSessions().forEach((s) => {
    if (s.id === session.id || s.date >= session.date) return;
    s.entries.filter((e) => e.exId === entry.exId).forEach((e) => {
      const b = Logic.entryStats(e).best;
      if (b && (!best || (b.e || b.reps) > (best.e || best.reps))) best = b;
    });
  });
  return !!best && (cur.e || cur.reps) > (best.e || best.reps) + 0.01;
}

/* Stable per session, so a reload shows the same fact. */
function workoutFact(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return WORKOUT_FACTS[h % WORKOUT_FACTS.length];
}

/* The level reached by this workout, if it was the one that crossed a threshold. */
function levelUpFor(s) {
  const k = Store.finishedSessions().findIndex((x) => x.id === s.id);
  if (k < 0) return null;
  const before = trainingLevel(k), after = trainingLevel(k + 1);
  return after.i > before.i ? after : null;
}

function renderSummary(id) {
  const s = Store.db.sessions.find((x) => x.id === id);
  if (!s) {
    app.innerHTML = `<h1 class="display page-title">Not found</h1><a class="btn" href="#/history">Log</a>`;
    return;
  }
  const day = PROGRAM.days[s.dayId];
  const st = Logic.sessionStats(s);
  const prevS = Logic.previousSessionOfDay(s.dayId, s.date, s.id);
  const ps = prevS ? Logic.sessionStats(prevS) : null;
  const rows = s.entries.map((e) => {
    const prev = Logic.previousEntry(e.exId, s.date, s.id);
    return { e, ex: EXERCISES[e.exId], prev, cmp: Logic.compareEntry(e, prev && prev.entry), sug: Logic.suggestNext(e), pr: isPR(e, s) };
  });
  const count = (v) => rows.filter((r) => r.cmp.verdict === v).length;
  const heavier = count("heavier");
  const up = count("up") + heavier, same = count("same"), down = count("down"), skipped = rows.filter((r) => r.cmp.verdict === "skip");
  const comparable = up + same + down;
  const prs = rows.filter((r) => r.pr).length;
  const heavierNote = heavier ? ` (${heavier} at a heavier weight)` : "";

  let headline;
  if (!comparable) headline = `First ${day.name} logged. Next time this page compares every exercise with today.`;
  else if (up === comparable) headline = `Better on every exercise (${up} of ${comparable})${heavierNote}.`;
  else headline = `Better on ${up} of ${comparable} exercises${heavierNote}${same ? `, same on ${same}` : ""}${down ? `, lower on ${down}` : ""}.`;

  const tips = [];
  if (comparable && down / comparable >= 0.5) {
    if (prevS && mostlyDown(prevS)) {
      tips.push("Two " + day.name + " sessions in a row are mostly lower. Check sleep and food first. Diet rule #3: if performance falls for 2 weeks, add ~150 kcal/day, mostly carbs around training. Tick 'performance falling' in this week's Body check-in.");
    } else {
      tips.push("Most lifts are lower today. One bad day is normal on a cut. Repeat the same weights next time before you change anything.");
    }
  }
  if (comparable && up + same === comparable) tips.push("You kept or beat every lift in a calorie deficit. That is the goal of Phase 1.");
  skipped.forEach((r) => tips.push(`You skipped ${r.ex.name}. Next time, do it earlier in the session or swap it.`));
  const allRir = s.entries.flatMap((e) => e.sets).filter((x) => x.rir !== "" && x.rir != null);
  if (allRir.length >= 4 && allRir.filter((x) => num(x.rir) >= 3).length / allRir.length > 0.5) tips.push("Most sets had 3+ reps in reserve. Push closer to failure: aim for RIR 0-2.");
  if (st.minutes > 100) tips.push(`This session took ${st.minutes} min. Rest 2-3 min on big lifts and 1-2 min on small lifts.`);
  rows.filter((r) => r.cmp.verdict !== "skip").slice(0, 3).forEach((r) => tips.push(`${r.ex.name}: ${r.sug.text}`));

  const levelUp = levelUpFor(s);
  const fact = workoutFact(s.id);
  const verdictLabel = { up: "Better", heavier: "Heavier", same: "Same", down: "Lower", new: "New", skip: "Skipped" };

  app.innerHTML = `
    <section class="hero">
      <div class="meta mono"><span>${esc(day.name)} · ${fmtDate(s.date)}</span><span>${st.minutes ? st.minutes + " min" : ""}</span></div>
      <h1 class="display complete kinetic"><span class="outline">Workout</span><br>Complete</h1>
      <p class="headline">${esc(headline)}</p>
      ${prs ? `<p class="mono up">${prs} new PR${prs > 1 ? "s" : ""}</p>` : ""}
    </section>
    ${levelUp ? `<section class="panel framed levelup" role="status">
      <div class="mono">Level up</div>
      <h3>${esc(levelUp.cur.name)}</h3>
      <p class="small">${esc(levelUp.cur.text)}</p>
      <div class="bar"><i></i></div>
      <a class="link" href="#/levels">See all levels</a>
    </section>` : ""}

    ${label(`(01) vs last ${esc(day.name)}`, prevS ? `${fmtDate(prevS.date)} · ${agoText(prevS.date)}` : "first time")}
    <div class="stats" data-reveal>
      ${stat(st.sets, "Sets", ps ? Logic.pct(st.sets, ps.sets) : null)}
      ${stat(st.reps, "Reps", ps ? Logic.pct(st.reps, ps.reps) : null)}
      ${stat(st.volume, "Volume kg", ps ? Logic.pct(st.volume, ps.volume) : null, "k")}
    </div>

    ${label("(02) Exercise by exercise", comparable ? `${up}/${comparable} better` : "")}
    ${rows.map((r) => {
      const c = r.cmp;
      const best = c.c.best ? (c.c.best.e ? `best ${fmtKg(c.c.best.kg)}×${c.c.best.reps} · est. 1RM ${c.c.best.e.toFixed(1)}` : `best ${c.c.best.reps} reps`) : "";
      const change = c.strength != null ? `<span class="${deltaCls(c.strength)}">${pctText(c.strength)} strength</span> · <span class="${deltaCls(c.vol)}">${pctText(c.vol)} volume</span>` : "";
      return `<article class="panel cmp v-${c.verdict}" data-reveal>
        <div class="cmp-head"><span class="ex-name">${esc(r.ex.name)}</span><span class="chips">${r.pr ? `<span class="chip c-pr">PR</span>` : ""}<span class="chip c-${c.verdict}">${verdictLabel[c.verdict]}</span></span></div>
        <div class="small"><span class="mono muted">Today</span> ${esc(Logic.fmtSets(r.e)) || "–"} ${best ? `<span class="muted">· ${best}</span>` : ""}</div>
        ${r.prev ? `<div class="small muted"><span class="mono">Last · ${fmtDate(r.prev.session.date)}</span> ${esc(Logic.fmtSets(r.prev.entry))}</div>` : ""}
        ${change ? `<div class="small mono" style="margin-top:6px">${change}</div>` : ""}
        ${r.e.notes ? `<p class="small ex-note">${esc(r.e.notes)}</p>` : ""}
        ${c.verdict !== "skip" ? `<div class="next"><b>Next time</b>${esc(r.sug.text)}</div>` : ""}
      </article>`;
    }).join("")}

    ${label("(03) Make the next one better")}
    <section class="panel accent" data-reveal><ul class="tips">${tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>

    <section class="panel framed dyk" data-reveal>
      <div class="mono fact-label">Did you know</div>
      <p>${esc(fact.text)}</p>
      <p class="source">Source: ${esc(fact.source)}</p>
    </section>

    ${label("(04) This week", "vs last week")}
    ${weekStats()}

    ${s.notes ? `<section class="panel" data-reveal><div class="lbl">Notes</div><p>${esc(s.notes)}</p></section>` : ""}
    <a class="cta" href="#/train"><span>Done</span><span class="arrow">→</span></a>
    <button class="btn full" data-edit="${s.id}">Edit this workout</button>
  `;
}

function editSession(id) {
  const db = Store.db;
  const s = db.sessions.find((x) => x.id === id);
  if (!s) return;
  if (db.draft && !confirm("A workout is in progress. Replace it with this edit?")) return;
  db.draft = {
    id: s.id, editingId: s.id, dayId: s.dayId, date: s.date, finishedAt: s.finishedAt, notes: s.notes || "", current: 0,
    entries: s.entries.map((e) => ({ ...e, notes: e.notes || "", sets: e.sets.map((x) => ({ kg: String(x.kg), reps: String(x.reps), rir: x.rir === "" ? "" : String(x.rir), done: true })) })),
  };
  Store.save();
  location.hash = "#/log";
}

/* ---------- History ---------- */

function renderHistory() {
  const fin = Store.finishedSessions().slice().reverse();
  const groups = [];
  fin.forEach((s) => {
    const wk = Logic.weekStart(s.date);
    let g = groups.find((x) => x.wk === wk);
    if (!g) groups.push((g = { wk, items: [] }));
    g.items.push(s);
  });
  const lb = Store.db.settings.lastBackup;
  app.innerHTML = `
    <h1 class="display page-title kinetic">Log</h1>
    ${!fin.length ? `<p class="muted">No workouts yet. Finish a workout and it shows here.</p>` : ""}
    ${groups.map((g) => `${label(`Week of ${fmtWeek(g.wk)}`, `${g.items.length} workout${g.items.length > 1 ? "s" : ""}`)}
      ${g.items.map((s) => {
        const st = Logic.sessionStats(s);
        const notes = s.entries.filter((e) => e.notes).length;
        return `<a class="hist" href="#/summary/${s.id}" data-reveal><span><span class="name">${esc(PROGRAM.days[s.dayId].name)}</span><br><span class="mono muted">${fmtDate(s.date)}${notes ? ` · ${notes} comment${notes > 1 ? "s" : ""}` : ""}</span></span><span class="r mono">${st.sets} sets<br>${fmtInt(st.volume)} kg ↗</span></a>`;
      }).join("")}`).join("")}
    ${label("Backup", lb ? "last " + agoText(lb) : "never backed up")}
    <section class="panel framed" data-reveal>
      ${Store.account
        ? `<p class="small">Your log syncs to your account and stays available offline on this device. Export a file backup any time. Importing adds the file to your account.</p>`
        : `<p class="small">Your log is saved only in this browser on this device. If you clear browser data, the log is gone. Export a backup every 1-2 weeks.${Sync.enabled ? ` Or <a class="link" href="#/account">sign in</a> to sync it.` : ""}</p>`}
      <div class="row">
        <button class="btn acc" data-act="export">Export backup</button>
        <button class="btn" data-act="import">Import backup</button>
      </div>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
      <button class="btn danger full" data-act="reset">Delete all data</button>
    </section>
  `;
}

function exportBackup() {
  const blob = new Blob([Store.exportJson()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `beyond-training-backup-${Logic.ymd(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  rerender();
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const msg = Store.account
        ? "Importing adds the backup to your account. Workouts and check-ins in the file replace the same entries in your account. Continue?"
        : "Importing replaces all data on this device with the backup. Continue?";
      if (!confirm(msg)) return;
      Store.importJson(reader.result);
      alert("Backup imported.");
      route();
    } catch (err) {
      alert("Import failed: " + err.message);
    }
  };
  reader.readAsText(file);
}

/* ---------- Progress ---------- */

function lineChart(points, unit) {
  if (points.length < 2) return `<p class="small muted">Log this exercise at least twice to see a chart.</p>`;
  const W = 320, H = 150, P = 26;
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (max - min < 1) { min -= 1; max += 1; }
  const x = (i) => P + (i * (W - P * 1.4)) / (points.length - 1);
  const y = (v) => H - P + 6 - ((v - min) / (max - min)) * (H - P * 1.7);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  const area = `${path} L${x(points.length - 1).toFixed(1)},${H - P + 6} L${x(0).toFixed(1)},${H - P + 6} Z`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Progress chart">
    <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--accent)"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>
    <text x="0" y="${y(max) + 3}" class="axis">${max.toFixed(0)}</text>
    <text x="0" y="${y(min) + 3}" class="axis">${min.toFixed(0)}</text>
    <line x1="${P}" y1="${y(max)}" x2="${W}" y2="${y(max)}" class="grid"/>
    <line x1="${P}" y1="${y(min)}" x2="${W}" y2="${y(min)}" class="grid"/>
    <path d="${area}" class="area"/>
    <path d="${path}" class="line"/>
    ${points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="4" class="dot"><title>${esc(p.label)}: ${p.y.toFixed(1)} ${unit}</title></circle>`).join("")}
    <text x="${P}" y="${H - 2}" class="axis">${esc(points[0].label)}</text>
    <text x="${W}" y="${H - 2}" class="axis" text-anchor="end">${esc(points[points.length - 1].label)}</text>
  </svg>`;
}

function slotTarget(exId) {
  for (const d of Object.values(PROGRAM.days)) {
    const sl = d.slots.find((s) => s.ex === exId);
    if (sl) return { sets: sl.sets, reps: sl.reps, rir: sl.rir };
  }
  return null;
}

function renderProgress(arg) {
  const fin = Store.finishedSessions();
  if (!fin.length) {
    app.innerHTML = `<h1 class="display page-title kinetic">Stats</h1><p class="muted">Finish your first workout to see progress here.</p>`;
    return;
  }
  const thisWk = Logic.weekStart();
  const firstWk = Logic.weekStart(fin[0].date);
  const weeks = [];
  for (let k = thisWk, n = 0; k >= firstWk && n < 10; k = Logic.addWeeks(k, -1), n++) weeks.push(k);
  const totals = weeks.map((k) => ({ k, t: Logic.weekTotals(k) }));
  const prevOf = (i) => (totals[i + 1] ? totals[i + 1].t : Logic.weekTotals(Logic.addWeeks(totals[i].k, -1)));
  const cur = totals[0].t, last = prevOf(0);

  const exIds = [...new Set(fin.flatMap((s) => s.entries.filter((e) => Logic.workSets(e).length).map((e) => e.exId)))];
  const sel = arg && exIds.includes(arg) ? arg : exIds[0];
  const ex = EXERCISES[sel];
  const hist = fin.map((s) => ({ s, e: s.entries.find((e) => e.exId === sel && Logic.workSets(e).length) })).filter((x) => x.e);
  const bw = hist.every((h) => !Logic.entryStats(h.e).best.e);
  const points = hist.map((h) => {
    const st = Logic.entryStats(h.e);
    return { label: fmtWeek(Logic.ymd(new Date(h.s.date))), y: bw ? st.reps : st.best.e };
  });
  const firstP = points[0], lastP = points[points.length - 1];
  const since = points.length >= 2 ? Logic.pct(lastP.y, firstP.y) : null;
  const tgt = slotTarget(sel);

  app.innerHTML = `
    <h1 class="display page-title kinetic">Stats</h1>

    ${label("(01) Exercise progress", bw ? "total reps" : "est. 1RM kg")}
    <section class="panel framed" data-reveal>
      <select id="ex-pick" class="full">${exIds.map((id) => `<option value="${id}" ${id === sel ? "selected" : ""}>${esc(EXERCISES[id].name)}</option>`).join("")}</select>
      <div style="display:flex;justify-content:space-between;align-items:end;margin-top:14px">
        <div><div class="bignum" data-count="${lastP.y}" data-fmt="1">0</div><div class="mono muted">${bw ? "reps" : "kg est. 1RM"} · latest</div></div>
        <div class="r"><div class="mono ${deltaCls(since)}" style="font-size:1rem">${pctText(since)}</div><div class="mono muted">since ${esc(firstP.label)}</div></div>
      </div>
      ${lineChart(points, bw ? "reps" : "kg")}
      <p class="small muted">${bw ? "Total reps per session." : "Best set each session as an estimated 1-rep max: kg × (1 + reps/30). It lets you compare 60×10 with 65×7."}</p>
      <table class="mini"><thead><tr><th>Date</th><th>Sets</th><th class="r">${bw ? "Reps" : "1RM"}</th></tr></thead><tbody>
        ${hist.slice().reverse().map((h) => {
          const st = Logic.entryStats(h.e);
          return `<tr><td>${fmtDate(h.s.date)}</td><td class="small">${esc(Logic.fmtSets(h.e))}</td><td class="r">${bw ? st.reps : st.best.e.toFixed(1)}</td></tr>`;
        }).join("")}
      </tbody></table>
      ${ex && tgt ? `<p class="mono muted" style="margin-top:10px">Plan target · ${repsText(tgt, ex)}</p>` : ""}
    </section>

    ${label("(02) Week by week", "volume vs previous")}
    <section class="panel" data-reveal>
      <table class="mini"><thead><tr><th>Week of</th><th class="r">Workouts</th><th class="r">Sets</th><th class="r">Volume</th><th class="r">Δ</th></tr></thead><tbody>
        ${totals.map((w, i) => {
          const p = Logic.pct(w.t.volume, prevOf(i).volume);
          return `<tr><td>${fmtWeek(w.k)}${i === 0 ? " <span class='mono up'>now</span>" : ""}</td><td class="r">${w.t.sessions}</td><td class="r">${w.t.sets}</td><td class="r">${fmtInt(w.t.volume)}</td><td class="r ${deltaCls(p)}">${pctText(p)}</td></tr>`;
        }).join("")}
      </tbody></table>
    </section>

    ${label("(03) Hard sets per muscle", "this week / last")}
    <section class="panel" data-reveal>
      <table class="mini"><tbody>
        ${MUSCLES.map((m) => {
          const a = cur.muscles[m] || 0, b = last.muscles[m] || 0;
          return `<tr><td>${esc(m)}</td><td class="r"><b>${a}</b></td><td class="r muted">${b}</td></tr>`;
        }).join("")}
      </tbody></table>
    </section>
  `;
}

/* ---------- Body (weekly check-in) ---------- */

function renderBody() {
  const db = Store.db;
  const list = [...db.checkins].sort((a, b) => b.week.localeCompare(a.week));
  const dec = Logic.dietDecision(db.checkins);
  const kcal = db.settings.kcal;
  const latestWeek = list[0] && list[0].week;
  let applyHtml = "";
  if (dec.delta) {
    const next = kcal + dec.delta;
    if (db.settings.appliedFor === latestWeek) applyHtml = `<p class="small muted">Already applied for the week of ${fmtWeek(latestWeek)}.</p>`;
    else if (next < DIET.kcalFloor) applyHtml = `<p class="small warn-text">Floor rule: ${fmtInt(next)} kcal is below ~${fmtInt(DIET.kcalFloor)}. Reassess performance, hunger, adherence and bodyweight before you cut more. Adding ~3,000 steps is the other option.</p>`;
    else applyHtml = `<button class="btn acc" data-apply="${dec.delta}">Set target to ${fmtInt(next)} kcal</button>${dec.delta < 0 ? `<button class="btn" data-steps="1">Add steps instead</button>` : ""}`;
  }
  const d = (a, b, unit) => {
    if (!num(a) || !num(b)) return "";
    const v = num(a) - num(b);
    const cls = Math.abs(v) < 0.05 ? "same" : v < 0 ? "up" : "down";
    return ` <span class="mono ${cls}">${v > 0 ? "+" : ""}${v.toFixed(1)}${unit}</span>`;
  };

  app.innerHTML = `
    <h1 class="display page-title kinetic">Body</h1>
    ${label("(01) Calorie target", `start ${fmtInt(DIET.kcalStart)} · floor ~${fmtInt(DIET.kcalFloor)}`)}
    <div class="stats" data-reveal style="grid-template-columns:1fr">
      <div class="stat"><div class="n" data-count="${kcal}">0</div><div class="mono muted">kcal / day · one decision every 14 days</div></div>
    </div>

    ${label("(02) 14-day rule", dec.rule ? `row #${dec.rule} · page 6` : "")}
    <section class="panel framed decision d-${dec.action}" data-reveal>
      <h3>${esc(dec.title)}</h3>
      <p class="small">${esc(dec.text)}</p>
      <div class="row">${applyHtml}</div>
    </section>

    ${label("(03) This week's check-in", "7-day averages")}
    <section class="panel" data-reveal>
      <p class="small muted">Weigh every morning after the bathroom and before food. Average the week.</p>
      <form id="checkin" class="form">
        <label>Week (any day in it)<input type="date" name="week" value="${Logic.weekStart()}" required></label>
        <label>Avg weight kg<input type="number" step="0.01" inputmode="decimal" enterkeyhint="next" name="weight" required></label>
        <label>Waist at navel cm<input type="number" step="0.1" inputmode="decimal" enterkeyhint="next" name="waist"></label>
        <label>Avg kcal<input type="number" step="1" inputmode="numeric" enterkeyhint="next" name="kcal"></label>
        <label>Avg protein g<input type="number" step="1" inputmode="numeric" enterkeyhint="next" name="protein"></label>
        <label>Avg steps<input type="number" step="1" inputmode="numeric" enterkeyhint="next" name="steps"></label>
        <label>Avg sleep h<input type="number" step="0.1" inputmode="decimal" enterkeyhint="next" name="sleep"></label>
        <label class="check"><input type="checkbox" name="creatine"> In the first 4 weeks of creatine</label>
        <label class="check"><input type="checkbox" name="perfDown"> Gym performance or energy clearly falling</label>
        <label class="wide">Notes<textarea name="notes" rows="2"></textarea></label>
        <button class="btn acc big wide" type="submit">Save check-in</button>
      </form>
    </section>

    ${list.length ? `${label("(04) Past check-ins", `${list.length} weeks`)}
      ${list.map((c, i) => {
        const p = list[i + 1];
        return `<article class="panel checkin" data-reveal>
          <div class="cmp-head"><span class="ex-name">Week of ${fmtWeek(c.week)}</span><button class="link danger-text" data-delcheck="${c.id}">Delete</button></div>
          <div class="grid2 small">
            <span>Weight <b>${c.weight ? num(c.weight).toFixed(2) + " kg" : "–"}</b>${p ? d(c.weight, p.weight, " kg") : ""}</span>
            <span>Waist <b>${c.waist ? num(c.waist).toFixed(1) + " cm" : "–"}</b>${p ? d(c.waist, p.waist, " cm") : ""}</span>
            <span class="muted">Kcal ${c.kcal ? fmtInt(c.kcal) : "–"}</span>
            <span class="muted">Protein ${c.protein ? fmtInt(c.protein) + " g" : "–"}</span>
            <span class="muted">Steps ${c.steps ? fmtInt(c.steps) : "–"}</span>
            <span class="muted">Sleep ${c.sleep ? num(c.sleep).toFixed(1) + " h" : "–"}</span>
          </div>
          ${c.creatine || c.perfDown ? `<div class="mono warn-text">${c.creatine ? "Creatine weeks · " : ""}${c.perfDown ? "Performance falling" : ""}</div>` : ""}
          ${c.notes ? `<div class="small">${esc(c.notes)}</div>` : ""}
        </article>`;
      }).join("")}` : ""}
  `;
}

function saveCheckin(form) {
  const db = Store.db;
  const f = new FormData(form);
  const week = Logic.weekStart(f.get("week") + "T12:00:00");
  const i = db.checkins.findIndex((x) => x.week === week);
  const c = {
    id: i >= 0 ? db.checkins[i].id : Store.uid(),
    week,
    weight: f.get("weight"), waist: f.get("waist"), kcal: f.get("kcal"), protein: f.get("protein"),
    steps: f.get("steps"), sleep: f.get("sleep"),
    creatine: f.get("creatine") === "on", perfDown: f.get("perfDown") === "on",
    notes: f.get("notes") || "",
  };
  if (i >= 0) {
    if (!confirm(`A check-in for the week of ${fmtWeek(week)} already exists. Replace it?`)) return;
    db.checkins[i] = c;
  } else {
    db.checkins.push(c);
  }
  Store.save();
  rerender();
}

/* ---------- Plan ---------- */

function weekEditor() {
  const s = Store.db.settings;
  const tk = Logic.dayKey(new Date());
  const train = Store.DAYS.filter((k) => s.week[k]).length;
  return `<section class="panel framed myweek" data-reveal>
    ${Store.DAYS.map((k) => {
      const id = s.week[k];
      return `<div class="wk-row${k === tk ? " today" : ""}${id ? "" : " off"}">
        <label class="wk-day" for="wk-${k}"><b>${DAY_NAMES[k]}</b>${k === tk ? `<span class="mono up">Today</span>` : ""}</label>
        <select id="wk-${k}" data-week="${k}">${PROGRAM.order.map((o) => `<option value="${o}" ${o === id ? "selected" : ""}>${esc(PROGRAM.days[o].name)}</option>`).join("")}<option value="" ${id ? "" : "selected"}>Rest</option></select>
        ${id
          ? `<span class="wk-info small muted">${esc(PROGRAM.days[id].focus)}</span>`
          : `<input class="wk-info" data-restlabel="${k}" value="${esc(s.restLabels[k] || "")}" placeholder="Rest note, e.g. badminton" aria-label="${DAY_NAMES[k]} rest note" maxlength="40">`}
      </div>`;
    }).join("")}
    <p class="small muted">${train} training day${train === 1 ? "" : "s"}, ${7 - train} rest day${train === 6 ? "" : "s"}. The Train tab shows the workout for today.${Store.account ? " Synced to your account." : ""}</p>
  </section>`;
}

function feedbackPrefs() {
  const s = Store.db.settings;
  const toggle = (key, on, text, note) => `<label class="toggle"><input type="checkbox" data-pref="${key}" ${on ? "checked" : ""}><span><b>${text}</b><span class="small muted">${note}</span></span></label>`;
  return `<section class="panel" data-reveal>
    ${Device.canVibrate
      ? toggle("vibrate", s.vibrate !== false, "Vibrate", "Short pulse when you tick a set and when the rest time is up.")
      : `<p class="small muted">This phone does not support vibration. The rest bar turns white when the rest time is up.</p>`}
    ${toggle("sound", !!s.sound, "Sound when rest is done", "A short beep. Plays only after you have tapped in the app.")}
  </section>`;
}

function renderPlan(tab) {
  tab = tab === "diet" ? "diet" : "training";
  const sub = `<div class="subtabs"><a href="#/plan/training" class="${tab === "training" ? "active" : ""}">Training</a><a href="#/plan/diet" class="${tab === "diet" ? "active" : ""}">Diet</a></div>`;
  if (tab === "training") {
    app.innerHTML = `
      <h1 class="display page-title kinetic">Plan</h1>${sub}
      ${label("(00) The split", "S+ in Nippard's split tier list")}
      <p class="small">Upper / lower + push / pull / legs. Each muscle gets about 2 sessions a week. Move the days to fit badminton. Do not put Legs the day before a long badminton session.</p>
      ${label("My week", "pick a workout or rest")}
      ${weekEditor()}
      ${label("Workout feedback", "vibration and sound")}
      ${feedbackPrefs()}
      <p class="small muted">When every set reaches the top of the rep range, add the smallest weight jump next time. The app calculates this for you.</p>
      ${PROGRAM.order.map((id, n) => {
        const d = PROGRAM.days[id];
        return `${label(`(${two(n + 1)}) ${esc(d.name)}`, esc(d.focus))}
          <section class="panel" data-reveal>
          ${d.slots.map((sl, k) => {
            const ex = EXERCISES[sl.ex];
            const key = `${id}-${k}`;
            return `<div class="plan-ex">
              <div class="ex-top" style="margin-top:0">${thumb(ex, `data-planhow="${key}"`)}
                <div class="ex-info"><div class="ex-name">${esc(ex.name)} ${tierBadge(ex.tier)}</div><div class="mono muted" style="margin:4px 0">${repsText(sl, ex)}</div>
                <button class="link" data-planhow="${key}">How to</button></div></div>
              <div class="howto-wrap hidden" id="planhow-${key}">${howto(ex)}</div>
            </div>`;
          }).join("")}
        </section>`;
      }).join("")}
      <section class="panel small muted" data-reveal>
        <p><b class="up">Badges.</b> S+, S and A are tiers from Jeff Nippard's exercise tier lists. "Nippard pick" means his first or backup choice for that muscle in his book. No badge means a standard exercise that is not from his S/A lists.</p>
        <p><b class="up">RIR.</b> Reps in reserve: how many more reps you could do. RIR 0 = no more reps possible.</p>
        <p>Exercise images: <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">free-exercise-db</a> (public domain).</p>
      </section>
      ${foot()}
    `;
  } else {
    app.innerHTML = `
      <h1 class="display page-title kinetic">Plan</h1>${sub}
      ${label("(01) Phase 1 targets", "~2,500 kcal · 175 g protein")}
      <section class="panel" data-reveal>
        <table class="mini"><tbody>${DIET.targets.map(([a, b, c]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td><td class="small muted">${esc(c)}</td></tr>`).join("")}</tbody></table>
      </section>
      ${label("(02) Base day")}
      <section class="panel" data-reveal>
        <table class="mini"><thead><tr><th>Time</th><th>Food</th><th class="r">kcal</th><th class="r">Prot.</th></tr></thead><tbody>
          ${DIET.baseDay.map(([t, m, f, k, p]) => `<tr><td class="small"><span class="mono">${esc(t)}</span><br><span class="muted">${esc(m)}</span></td><td class="small">${esc(f)}</td><td class="r">${esc(k)}</td><td class="r">${esc(p)} g</td></tr>`).join("")}
        </tbody></table>
      </section>
      ${label("(03) Idli day swap", "same kcal, 2 fruit")}
      <section class="panel" data-reveal>
        <table class="mini"><thead><tr><th>Time</th><th>Base</th><th>Idli day</th><th class="r">Δ</th></tr></thead><tbody>
          ${DIET.idliDay.map(([t, a, b, c]) => `<tr><td class="small mono">${esc(t)}</td><td class="small">${esc(a)}</td><td class="small">${esc(b)}</td><td class="r small">${esc(c)}</td></tr>`).join("")}
        </tbody></table>
        <p class="small muted">Chutney is extra. Log it. If you use more than 1 tbsp, take another 30 g of rice off dinner.</p>
      </section>
      ${label("(04) Every 14 days, ONE decision", "first row that matches")}
      <section class="panel accent" data-reveal>
        <table class="mini"><tbody>${DIET.rules.map(([a, b], i) => `<tr><td class="mono">${two(i + 1)}</td><td class="small"><b>${esc(a)}</b></td><td class="small">${esc(b)}</td></tr>`).join("")}</tbody></table>
        <p class="small"><b>Floor rule:</b> do not automatically cut below ~2,200 kcal. The Body tab applies these rules for you.</p>
      </section>
      <a class="cta" href="assets/Beyond_Training_Diet_Protocol_v2.1.pdf" target="_blank" rel="noopener"><span>Full diet PDF</span><span class="arrow">↗</span></a>
      ${foot()}
    `;
  }
}

/* ---------- Events ---------- */

app.addEventListener("input", (ev) => {
  const t = ev.target;
  const d = Store.db.draft;
  if (t.dataset.notes !== undefined && d) {
    d.notes = t.value;
    Store.save();
    return;
  }
  if (t.dataset.enote !== undefined && d) {
    d.entries[+t.dataset.enote].notes = t.value;
    Store.save();
    return;
  }
  if (t.dataset.restlabel) {
    const labels = Store.db.settings.restLabels;
    const v = t.value.trim();
    if (v) labels[t.dataset.restlabel] = v;
    else delete labels[t.dataset.restlabel];
    Store.save();
    return;
  }
  if (t.dataset.f && d) {
    const s = d.entries[+t.dataset.i].sets[+t.dataset.k];
    s[t.dataset.f] = t.value;
    Store.save();
    updateLogProgress();
  }
});

app.addEventListener("change", (ev) => {
  const t = ev.target;
  if (t.id === "ex-pick") location.hash = "#/progress/" + t.value;
  if (t.dataset.pref) {
    Store.db.settings[t.dataset.pref] = t.checked;
    Store.save();
    if (t.dataset.pref === "sound" && t.checked) {
      Device.unlockAudio();
      Device.beep();
    }
    if (t.dataset.pref === "vibrate" && t.checked) Device.cue("set");
    return;
  }
  if (t.dataset.week) {
    Store.db.settings.week[t.dataset.week] = t.value || null;
    Store.save();
    rerender();
  }
  if (t.id === "import-file" && t.files[0]) importBackup(t.files[0]);
});

app.addEventListener("submit", (ev) => {
  if (ev.target.id === "checkin") {
    ev.preventDefault();
    saveCheckin(ev.target);
  }
});

function toggleHowto(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("hidden");
}

app.addEventListener("click", (ev) => {
  Device.unlockAudio();
  const b = ev.target.closest("button, a");
  if (!b) return;
  const ds = b.dataset;
  if (ds.start) return startWorkout(ds.start);
  if (ds.goto !== undefined) return goTo(+ds.goto);
  if (ds.nav && Store.db.draft) return goTo(logIndex(Store.db.draft) + (ds.nav === "next" ? 1 : -1));
  if (ds.howto !== undefined) return openHowto(+ds.howto);
  if (ds.planhow !== undefined) return toggleHowto("planhow-" + ds.planhow);
  if (ds.swap !== undefined) return openSwap(+ds.swap);
  if (ds.tick) {
    const [i, k] = ds.tick.split(":").map(Number);
    return tickSet(i, k);
  }
  if (ds.addset !== undefined) {
    const e = Store.db.draft.entries[+ds.addset];
    const last = e.sets[e.sets.length - 1];
    e.sets.push({ kg: last ? last.kg : "", reps: "", rir: "", done: false, goal: last ? last.goal : "" });
    Store.save();
    return rerender();
  }
  if (ds.rmset !== undefined) {
    const e = Store.db.draft.entries[+ds.rmset];
    if (e.sets.length > 1) e.sets.pop();
    Store.save();
    return rerender();
  }
  if (ds.edit) return editSession(ds.edit);
  if (ds.delcheck) {
    if (!confirm("Delete this check-in?")) return;
    Store.db.checkins = Store.db.checkins.filter((c) => c.id !== ds.delcheck);
    Store.save();
    return rerender();
  }
  if (ds.apply || ds.steps) {
    const list = [...Store.db.checkins].sort((a, c) => c.week.localeCompare(a.week));
    if (ds.apply) Store.db.settings.kcal += +ds.apply;
    Store.db.settings.appliedFor = list[0] && list[0].week;
    Store.save();
    if (ds.steps) alert("Add ~3,000 average daily steps for the next 14 days. Keep calories the same.");
    return rerender();
  }
  switch (ds.act) {
    case "fact": {
      factShift++;
      const el = document.getElementById("fact-text");
      if (el) el.textContent = factText();
      return;
    }
    case "install": return Device.install();
    case "install-dismiss": return Device.dismissInstall();
    case "finish": return finishWorkout();
    case "discard": return discardDraft();
    case "export": return exportBackup();
    case "import": return document.getElementById("import-file").click();
    case "reset":
      if (confirm(`Delete ALL workouts and check-ins ${Store.account ? "in your account, on every device" : "on this device"}? Export a backup first if you want to keep them.`) && confirm("Are you sure? This cannot be undone.")) {
        Store.reset();
        route();
      }
      return;
  }
});

modal.addEventListener("click", (ev) => {
  if (ev.target === modal) return closeModal();
  const b = ev.target.closest("button");
  if (!b) return;
  if (b.dataset.pick) {
    const [i, id] = b.dataset.pick.split(":");
    return pickSwap(+i, id);
  }
  if (b.dataset.act === "close") closeModal();
});

/* Swipes and arrow keys move between exercises. Gestures that start in a field or the set table are left alone. */
let swipe = null;
app.addEventListener("touchstart", (ev) => {
  const t = ev.touches[0];
  swipe = currentView() === "log" && ev.touches.length === 1 && !ev.target.closest("input, textarea, select, table, .dots")
    ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
}, { passive: true });
/* Claiming a horizontal swipe stops Chrome's swipe-to-go-back from also firing. */
app.addEventListener("touchmove", (ev) => {
  if (!swipe || ev.touches.length !== 1) return;
  const t = ev.touches[0];
  const dx = Math.abs(t.clientX - swipe.x), dy = Math.abs(t.clientY - swipe.y);
  if (dx > 10 && dx > dy * 1.5 && ev.cancelable) ev.preventDefault();
}, { passive: false });
app.addEventListener("touchend", (ev) => {
  const s = swipe, d = Store.db.draft;
  swipe = null;
  if (!s || !d) return;
  const t = ev.changedTouches[0];
  const dx = t.clientX - s.x, dy = t.clientY - s.y;
  if (Date.now() - s.at > 800 || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  goTo(logIndex(d) + (dx < 0 ? 1 : -1));
}, { passive: true });

/* Enter ("next" on phone keyboards) walks kg → reps → next set. */
app.addEventListener("keydown", (ev) => {
  const t = ev.target;
  if (ev.key !== "Enter" || t.tagName !== "INPUT" || !t.dataset.f) return;
  ev.preventDefault();
  const fields = [...app.querySelectorAll("table.sets input[data-f]")];
  const next = fields[fields.indexOf(t) + 1];
  if (next) next.focus();
  else t.blur();
});

/* While the phone keyboard is open, the bottom bars step aside and the active set row stays in view. */
const coarse = matchMedia("(pointer: coarse)");
app.addEventListener("focusin", (ev) => {
  const t = ev.target;
  if (!coarse.matches || !/^(INPUT|TEXTAREA)$/.test(t.tagName) || t.type === "checkbox") return;
  document.body.classList.add("kb");
  setTimeout(() => {
    if (document.activeElement === t) (t.closest("tr") || t).scrollIntoView({ block: "center" });
  }, 350);
});
app.addEventListener("focusout", () => setTimeout(() => {
  if (!isTyping()) document.body.classList.remove("kb");
}, 120));

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && !modal.classList.contains("hidden")) return closeModal();
  if ((ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") || ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
  const a = document.activeElement;
  if (currentView() !== "log" || !Store.db.draft || !modal.classList.contains("hidden") || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
  ev.preventDefault();
  goTo(logIndex(Store.db.draft) + (ev.key === "ArrowRight" ? 1 : -1));
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

/* ---------- Sync ---------- */

const isTyping = () => {
  const a = document.activeElement;
  return !!a && app.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
};

/* A pull never repaints under the user's fingers: wait until they leave the field or close the sheet. */
let refreshDue = false;
function refreshFromSync() {
  const v = currentView();
  if (v === "account" || v === "coach") return renderTopRight(v);
  if (isTyping() || !modal.classList.contains("hidden")) {
    refreshDue = true;
    return;
  }
  refreshDue = false;
  rerender();
}
app.addEventListener("focusout", () => setTimeout(() => refreshDue && refreshFromSync(), 300));
modal.addEventListener("click", () => setTimeout(() => refreshDue && refreshFromSync(), 300));

Device.onInstallChange(() => currentView() === "train" && !isTyping() && rerender());

Sync.on("status", () => {
  renderTopRight(currentView());
  if (currentView() === "account") Account.refreshStatus();
});
Sync.on("data", refreshFromSync);
Sync.on("account", route);
Sync.on("profile", () => (isTyping() ? renderTopRight(currentView()) : paint(true)));
Sync.on("migrate", Account.offerLocal);
Sync.on("recovery", Account.recover);
Sync.start();

if (!location.hash && Account.wantsAuth()) history.replaceState(null, "", "#/account");
route();
