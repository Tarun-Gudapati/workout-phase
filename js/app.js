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
    ${ex.similar ? `<p class="small muted">Image shows a similar movement.</p>` : ""}
    <ol class="cues">${ex.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>
    <a class="btn yt full" href="${ytUrl(ex)}" target="_blank" rel="noopener">Watch on YouTube</a>
  </div>`;
}

const repsText = (t, ex) => `${t.sets} × ${t.reps[0]}-${t.reps[1]}${ex.perSide ? " /side" : ""} · RIR ${esc(t.rir)}`;

const fmtNum = (v, fmt) => (fmt === "k" ? (v >= 1000 ? (v / 1000).toFixed(1) + "k" : fmtInt(v)) : fmt === "1" ? (+v).toFixed(1) : fmtInt(v));

function stat(value, label, delta, fmt = "int") {
  return `<div class="stat"><div class="n">${fmtNum(value, fmt)}</div><span class="mono">${label}</span>${delta === undefined ? "" : `<div class="d ${deltaCls(delta)}">${pctText(delta)}</div>`}</div>`;
}

/* Progress ring. `pct` 0-100, `inner` is the HTML in the middle. */
function ring(pct, inner, { size = "", color = "var(--accent)", width = 9 } = {}) {
  const r = 50 - width / 2 - 1, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct || 0));
  return `<div class="ring ${size}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="${r}" stroke-width="${width}"/>
    <circle class="val" cx="50" cy="50" r="${r}" stroke-width="${width}" stroke="${color}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - p / 100)).toFixed(1)}"${p ? "" : ' style="display:none"'}/></svg>
    <div class="in"><div>${inner}</div></div></div>`;
}

function label(left, right = "") {
  return `<div class="label mono"><span>${left}</span><b>${right}</b></div>`;
}

function rankFor(n) {
  let i = 0;
  while (i + 1 < RANKS.length && n >= RANKS[i + 1].at) i++;
  const cur = RANKS[i], next = RANKS[i + 1];
  return { i, cur, next, toNext: next ? next.at - n : 0, pct: next ? Math.round(((n - cur.at) / (next.at - cur.at)) * 100) : 100 };
}

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

/* coach.js calls this after async renders. */
function animateIn() {}

/* ---------- Router ---------- */

const VIEWS = () => ({
  train: renderTrain, log: renderLog, summary: renderSummary, history: renderHistory, progress: renderProgress, body: renderBody, plan: renderPlan, ranks: renderRanks, levels: renderRanks,
  account: Account.render, coach: Coach.render,
});

const currentView = () => (location.hash.replace(/^#\/?/, "") || "train").split("/")[0];

function paint(keepScroll) {
  const y = window.scrollY;
  const h = location.hash.replace(/^#\/?/, "") || "train";
  const [view, arg] = h.split("/");
  document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("active", a.dataset.tab === (["log", "summary", "ranks", "levels"].includes(view) ? "train" : view)));
  (VIEWS()[view] || renderTrain)(arg);
  Device.keepAwake(view === "log" && !!Store.db.draft);
  document.documentElement.classList.toggle("on-log", view === "log");
  renderTopRight(view);
  updateRest();
  window.scrollTo(0, keepScroll ? y : 0);
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
  return `<div class="stats">
    ${stat(cur.sessions, "Workouts", Logic.pct(cur.sessions, prev.sessions))}
    ${stat(cur.sets, "Hard sets", Logic.pct(cur.sets, prev.sets))}
    ${stat(cur.volume, "Volume kg", Logic.pct(cur.volume, prev.volume), "k")}
  </div>`;
}

const restNote = (key) => Store.db.settings.restLabels[key] || "";
const ARROW = `<span class="go" aria-hidden="true">›</span>`;

function tomorrowText(t) {
  const d = t.dayId && PROGRAM.days[t.dayId];
  return `Tomorrow: ${d ? esc(d.name) : "Rest"}`;
}

function trainHero(plan, lastOf) {
  const t = plan.today;
  const d = t.dayId && PROGRAM.days[t.dayId];
  const draft = Store.db.draft;
  const meta = `<div class="meta"><span>Today · ${DAY_NAMES[t.key]}</span><span>${fmtDate(new Date())}</span></div>`;
  if (!d) {
    const note = restNote(t.key);
    return `<section class="hero rest-day">
      ${meta}
      <h1>Rest day</h1>
      <p class="lede">${note ? esc(note) + " · " : ""}${tomorrowText(plan.tomorrow)}</p>
    </section>`;
  }
  if (plan.doneToday) {
    const st = Logic.sessionStats(plan.doneToday);
    return `<section class="hero cleared">
      ${meta}
      <h1>${esc(d.name)} <span class="check">✓</span></h1>
      <p class="lede">${st.sets} sets · ${fmtInt(st.volume)} kg · ${tomorrowText(plan.tomorrow)}</p>
      <a class="cta ghost" href="#/summary/${plan.doneToday.id}">See summary</a>
    </section>`;
  }
  const last = lastOf(t.dayId);
  const live = draft && draft.dayId === t.dayId && !draft.editingId;
  return `<section class="hero">
    ${meta}
    <h1>${esc(d.name)}</h1>
    <p class="lede">${d.slots.length} exercises · ${last ? "last " + agoText(last.date) : "first time"}</p>
    ${live
      ? `<a class="cta" href="#/log">Continue workout</a>`
      : `<button class="cta" data-start="${t.dayId}">Start workout</button>`}
  </section>`;
}

function missedNote(plan) {
  if (!plan.missed.length) return "";
  return `<section class="panel warn">
    <div class="eyebrow warn-text">Missed this week</div>
    ${plan.missed.map((m) => `<div class="missed-row"><span><b>${esc(PROGRAM.days[m.dayId].name)}</b> <span class="muted small">${DAY_NAMES[m.key].slice(0, 3)}</span></span><button class="btn sm" data-start="${m.dayId}">Start</button></div>`).join("")}
  </section>`;
}

/* Three rings: rank progress, workouts this week vs plan, hard sets vs last week. */
function homeRings(fin) {
  const R = rankFor(fin.length);
  const wk = Logic.weekStart();
  const cur = Logic.weekTotals(wk), prev = Logic.weekTotals(Logic.addWeeks(wk, -1));
  const planned = Store.DAYS.filter((k) => Store.db.settings.week[k]).length || 1;
  const setGoal = Math.max(prev.sets, 1);
  return `<a class="rings" href="#/ranks" aria-label="${R.cur.letter}-Rank. See all ranks">
    <div class="ring-cell">${ring(R.pct, `<b class="letter">${R.cur.letter}</b>`)}<span class="cap"><b>${R.cur.letter}-Rank</b>${R.next ? `${R.toNext} to ${R.next.letter}` : "Top rank"}</span></div>
    <div class="ring-cell">${ring((cur.sessions / planned) * 100, `<b>${cur.sessions}/${planned}</b>`, { color: "var(--ink)" })}<span class="cap"><b>This week</b>workouts</span></div>
    <div class="ring-cell">${ring((cur.sets / setGoal) * 100, `<b>${cur.sets}</b>`, { color: "var(--good)" })}<span class="cap"><b>Hard sets</b>${prev.sets ? `last week ${prev.sets}` : "this week"}</span></div>
  </a>`;
}

function renderTrain() {
  const db = Store.db;
  const fin = Store.finishedSessions();
  const plan = Logic.weekPlan(db.settings.week, fin);
  const t = plan.today;
  const pending = t.dayId && !plan.doneToday ? t.dayId : null;
  const lastOf = (id) => [...fin].reverse().find((s) => s.dayId === id);
  const backupDue = !Store.account && fin.length >= 3 && (!db.settings.lastBackup || daysAgo(db.settings.lastBackup) >= 14);
  const liveOther = db.draft && (db.draft.editingId || db.draft.dayId !== pending);

  app.innerHTML = `
    ${liveOther ? `<section class="panel accent">
      <div class="eyebrow">${db.draft.editingId ? "Editing a saved workout" : `In progress · started ${fmtTime(db.draft.date)}`}</div>
      <h3>${esc(PROGRAM.days[db.draft.dayId].name)}</h3>
      <div class="row"><a class="btn acc" href="#/log">Continue</a><button class="btn" data-act="discard">${db.draft.editingId ? "Cancel edit" : "Discard"}</button></div>
    </section>` : ""}
    ${backupDue ? `<section class="panel warn"><b>Back up your log.</b> <a class="link" href="#/history">Export</a></section>` : ""}

    ${trainHero(plan, lastOf)}
    ${homeRings(fin)}
    ${missedNote(plan)}

    ${label("Workouts")}
    <ol class="daylist">
      ${PROGRAM.order.map((id) => {
        const d = PROGRAM.days[id], l = lastOf(id);
        return `<li><button class="dayrow${id === pending ? " next" : ""}" data-start="${id}">
          <span class="name">${esc(d.name)}</span>${ARROW}
          <span class="info">${esc(d.focus)}${l ? " · " + agoText(l.date) : ""}</span>
        </button></li>`;
      }).join("")}
    </ol>

    ${Device.installCard()}
  `;
}

function renderRanks() {
  const n = Store.finishedSessions().length;
  const R = rankFor(n);
  const rungs = RANKS.map((rk, i) => {
    const state = i < R.i ? "done" : i === R.i ? "here" : "locked";
    const right = state === "done" ? "✓" : state === "here" ? "You" : `${rk.at - n} to go`;
    return `<li class="rung ${state}">
      <span class="badge" aria-hidden="true">${rk.letter}</span>
      <div class="rung-body"><b>${rk.letter}-Rank · ${esc(rk.name)}</b><p class="small muted">${esc(rk.text)}</p></div>
      <span class="state">${right}</span>
    </li>`;
  }).reverse().join("");
  app.innerHTML = `
    <section class="panel rank-hero">
      ${ring(R.pct, `<b class="letter">${R.cur.letter}</b>`, { size: "lg", width: 7 })}
      <h2>${R.cur.letter}-Rank · ${esc(R.cur.name)}</h2>
      <p class="muted">${R.next ? `${plural(R.toNext, "workout")} to ${R.next.letter}-Rank` : "Top rank reached"}</p>
    </section>
    <ol class="ladder">${rungs}</ol>
    <p class="small muted" style="padding:10px 4px">Every finished workout counts. Ranks reward showing up.</p>
  `;
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

const stepText = (d) => (logIndex(d) < d.entries.length ? `${logIndex(d) + 1} of ${d.entries.length}` : "Review");

function logPos(d) {
  const cur = logIndex(d), n = d.entries.length;
  const dot = (i, text, name, ok) => `<button class="dot${i === cur ? " on" : ""}${ok ? " ok" : ""}" data-goto="${i}" aria-label="${esc(name)}"${i === cur ? ' aria-current="step"' : ""}>${text}</button>`;
  return d.entries.map((e, i) => dot(i, two(i + 1), `Exercise ${i + 1}: ${EXERCISES[e.exId].name}`, entryDone(e))).join("") + dot(n, "✓", "Review and finish", false);
}

function renderLog() {
  const d = Store.db.draft;
  if (!d) {
    app.innerHTML = `<h1 class="page-title">No workout</h1><a class="cta" href="#/train">Go to Train</a>`;
    return;
  }
  const day = PROGRAM.days[d.dayId];
  const p = logProgress(d);
  app.innerHTML = `
    <div class="log-head">
      <div class="row1"><h1>${esc(day.name)}${d.editingId ? ` <span class="muted">· edit</span>` : ""}</h1>
        <span class="r"><span class="step" id="log-step">${stepText(d)}</span><br><span class="mono" id="log-count">${p.done}/${p.total} sets</span></span></div>
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
    <button class="btn big" data-nav="back" ${i === 0 ? "disabled" : ""}>Back</button>
    <button class="btn acc big" data-nav="next">${i === n - 1 ? "Review" : "Next"}</button>
  </div>`;
}

function exerciseScreen(d, e, i) {
  const ex = EXERCISES[e.exId];
  const prev = Logic.previousEntry(e.exId, d.editingId ? d.date : null, d.editingId);
  const prevSets = prev ? Logic.workSets(prev.entry) : [];
  const sug = prev ? Logic.suggestNext({ ...prev.entry, target: e.target }) : null;
  const note = previousNote(e.exId, d);
  const rirOpts = (v) => ["", "0", "1", "2", "3", "4"].map((o) => `<option value="${o}" ${String(v) === o ? "selected" : ""}>${o === "" ? "–" : o === "4" ? "4+" : o}</option>`).join("");
  return `<article class="ex-screen" data-i="${i}">
    <div class="ex-head"><span>${esc(ex.muscle)}</span>${tierBadge(ex.tier)}</div>
    <div class="ex-title">${esc(ex.name)}</div>
    <div class="ex-sub">${repsText(e.target, ex)}</div>
    ${exMedia(ex, `data-howto="${i}"`)}
    <div class="target">
      ${prev
        ? `<div class="t-main">${esc(sug.text)}</div><div class="t-last">Last time: ${esc(Logic.fmtSets(prev.entry))}</div>`
        : `<div class="t-main">First time</div><div class="t-last">Pick a weight for ${e.target.reps[0]}-${e.target.reps[1]} reps.</div>`}
    </div>
    ${note ? `<div class="prev-note"><span class="mono">Your note last time</span>${esc(note.text)}</div>` : ""}
    <div class="ex-actions">
      <button class="link" data-howto="${i}">How to</button>
      <button class="link" data-swap="${i}">Swap</button>
    </div>
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
    <details class="note-box"${e.notes ? " open" : ""}><summary>Note for you and your PT</summary>
      <textarea id="enote-${i}" data-enote="${i}" rows="2" aria-label="Note" placeholder="How did it feel?">${esc(e.notes || "")}</textarea></details>
  </article>
  ${logNav(i, d.entries.length)}`;
}

function reviewScreen(d) {
  const p = logProgress(d);
  const rows = d.entries.map((e, i) => {
    const ex = EXERCISES[e.exId];
    const done = Logic.workSets(e).length, plan = e.target.sets;
    return `<button class="rev-row" data-goto="${i}">
      <span class="rev-main"><b>${esc(ex.name)}</b><span class="small muted">${esc(Logic.fmtSets(e)) || "No sets logged"}</span>${e.notes ? `<span class="small ex-note">${esc(e.notes)}</span>` : ""}</span>
      <span class="small ${done >= plan ? "up" : "warn-text"}">${done}/${plan}</span>
    </button>`;
  }).join("");
  return `<h2 class="page-title" style="font-size:1.4rem;margin:8px 0 0">Review</h2>
    ${p.done < p.total ? `<p class="small muted">${p.total - p.done} empty set${p.total - p.done > 1 ? "s" : ""} won't be saved.</p>` : ""}
    <section class="panel review">${rows}</section>
    <section class="panel">
      <label class="lbl" for="notes">Workout notes</label>
      <textarea id="notes" data-notes rows="3">${esc(d.notes)}</textarea>
    </section>
    <button class="btn danger full" data-act="discard">${d.editingId ? "Cancel edit" : "Discard workout"}</button>
    <div class="lognav stick">
      <button class="btn big" data-nav="back">Back</button>
      <button class="btn acc big" data-act="finish">${d.editingId ? "Save changes" : "Finish workout"}</button>
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
  restBar.innerHTML = `<span><b>${clock(secs)}</b><span class="small muted">Rest</span></span><span class="mono">${done ? "Go" : `of ${clock(target)}`}</span>`;
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

/* The rank reached by this workout, if it was the one that crossed a threshold. */
function rankUpFor(s) {
  const k = Store.finishedSessions().findIndex((x) => x.id === s.id);
  if (k < 0) return null;
  const before = rankFor(k), after = rankFor(k + 1);
  return after.i > before.i ? after : null;
}

function renderSummary(id) {
  const s = Store.db.sessions.find((x) => x.id === id);
  if (!s) {
    app.innerHTML = `<h1 class="page-title">Not found</h1><a class="btn" href="#/history">Log</a>`;
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

  let headline;
  if (!comparable) headline = `First ${day.name} logged.`;
  else if (up === comparable) headline = `Better on all ${up} exercises.`;
  else headline = `Better on ${up} of ${comparable}${same ? `, same on ${same}` : ""}${down ? `, lower on ${down}` : ""}.`;

  const tips = [];
  if (comparable && down / comparable >= 0.5) {
    tips.push(prevS && mostlyDown(prevS)
      ? "Two sessions in a row mostly lower. Check sleep and food, and tick 'performance falling' in Body."
      : "Most lifts lower today. Repeat the same weights next time.");
  }
  skipped.forEach((r) => tips.push(`Skipped ${r.ex.name}. Do it earlier next time or swap it.`));
  const allRir = s.entries.flatMap((e) => e.sets).filter((x) => x.rir !== "" && x.rir != null);
  if (allRir.length >= 4 && allRir.filter((x) => num(x.rir) >= 3).length / allRir.length > 0.5) tips.push("Most sets had 3+ reps left. Push closer to failure.");
  if (st.minutes > 100) tips.push(`${st.minutes} min session. Keep rests to 2-3 min on big lifts.`);

  const rankUp = rankUpFor(s);
  const fact = workoutFact(s.id);
  const verdictLabel = { up: "Better", heavier: "Heavier", same: "Same", down: "Lower", new: "New", skip: "Skipped" };

  app.innerHTML = `
    <section class="panel done-hero">
      ${ring(comparable ? (up / comparable) * 100 : 100, comparable ? `<b>${up}/${comparable}</b><span>better</span>` : `<b>✓</b>`, { color: "var(--good)" })}
      <h1>Workout complete</h1>
      <p class="headline">${esc(headline)}${prs ? ` <b class="accent-text">${plural(prs, "new PR")}</b>` : ""}</p>
      <p class="mono" style="margin-top:6px">${esc(day.name)} · ${fmtDate(s.date)}${st.minutes ? ` · ${st.minutes} min` : ""}</p>
    </section>
    ${rankUp ? `<section class="panel rankup" role="status">
      <div class="badge">${rankUp.cur.letter}</div>
      <h3>Rank up · ${rankUp.cur.letter}-Rank</h3>
      <p class="small muted">${esc(rankUp.cur.name)}. ${esc(rankUp.cur.text)}</p>
      <a class="link" href="#/ranks">See ranks</a>
    </section>` : ""}

    <div class="stats">
      ${stat(st.sets, "Sets", ps ? Logic.pct(st.sets, ps.sets) : null)}
      ${stat(st.reps, "Reps", ps ? Logic.pct(st.reps, ps.reps) : null)}
      ${stat(st.volume, "Volume kg", ps ? Logic.pct(st.volume, ps.volume) : null, "k")}
    </div>

    ${label("Exercises", prevS ? `vs ${agoText(prevS.date)}` : "")}
    <section class="panel list">
    ${rows.map((r) => {
      const c = r.cmp;
      return `<div class="cmp-row">
        <div class="cmp-head"><span class="ex-name">${esc(r.ex.name)}</span><span class="chips">${r.pr ? `<span class="chip c-pr">PR</span>` : ""}<span class="chip c-${c.verdict}">${verdictLabel[c.verdict]}</span></span></div>
        <div class="small muted">${esc(Logic.fmtSets(r.e)) || "–"}</div>
        ${r.e.notes ? `<span class="small ex-note">${esc(r.e.notes)}</span>` : ""}
        ${c.verdict !== "skip" ? `<div class="next"><b>Next:</b> ${esc(r.sug.text)}</div>` : ""}
      </div>`;
    }).join("")}
    </section>

    ${tips.length ? `<section class="panel"><ul class="tips">${tips.slice(0, 3).map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>` : ""}
    ${s.notes ? `<section class="panel"><div class="lbl">Notes</div><p>${esc(s.notes)}</p></section>` : ""}

    <section class="panel dyk">
      <div class="eyebrow">Did you know</div>
      <p>${esc(fact.text)}</p>
      <p class="source">${esc(fact.source)}</p>
    </section>

    <a class="cta" href="#/train">Done</a>
    <button class="btn full" data-edit="${s.id}">Edit workout</button>
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
    <h1 class="page-title">Log</h1>
    ${!fin.length ? `<p class="muted">No workouts yet.</p>` : ""}
    ${groups.map((g) => `${label(`Week of ${fmtWeek(g.wk)}`, plural(g.items.length, "workout"))}
      <div class="hist-group">${g.items.map((s) => {
        const st = Logic.sessionStats(s);
        const notes = s.entries.filter((e) => e.notes).length;
        return `<a class="hist" href="#/summary/${s.id}"><span><span class="name">${esc(PROGRAM.days[s.dayId].name)}</span><br><span class="small muted">${fmtDate(s.date)}${notes ? ` · ${plural(notes, "note")}` : ""}</span></span><span class="r">${st.sets} sets · ${fmtInt(st.volume)} kg</span></a>`;
      }).join("")}</div>`).join("")}
    ${label("Backup", lb ? "last " + agoText(lb) : "never")}
    <section class="panel">
      <p class="small muted">${Store.account
        ? "Synced to your account and saved on this device for offline use."
        : `Saved on this device only. Export now and then.${Sync.enabled ? ` Or <a class="link" href="#/account">sign in</a> to sync.` : ""}`}</p>
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

function renderProgress(arg) {
  const fin = Store.finishedSessions();
  if (!fin.length) {
    app.innerHTML = `<h1 class="page-title">Stats</h1><p class="muted">Finish a workout to see progress.</p>`;
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
  const hist = fin.map((s) => ({ s, e: s.entries.find((e) => e.exId === sel && Logic.workSets(e).length) })).filter((x) => x.e);
  const bw = hist.every((h) => !Logic.entryStats(h.e).best.e);
  const points = hist.map((h) => {
    const st = Logic.entryStats(h.e);
    return { label: fmtWeek(Logic.ymd(new Date(h.s.date))), y: bw ? st.reps : st.best.e };
  });
  const firstP = points[0], lastP = points[points.length - 1];
  const since = points.length >= 2 ? Logic.pct(lastP.y, firstP.y) : null;

  app.innerHTML = `
    <h1 class="page-title">Stats</h1>
    ${label("This week", "vs last week")}
    ${weekStats()}

    ${label("Lift progress", bw ? "total reps" : "est. 1RM")}
    <section class="panel">
      <select id="ex-pick" class="full">${exIds.map((id) => `<option value="${id}" ${id === sel ? "selected" : ""}>${esc(EXERCISES[id].name)}</option>`).join("")}</select>
      <div style="display:flex;justify-content:space-between;align-items:end;margin-top:16px">
        <div><div class="bignum">${lastP.y.toFixed(1)}</div><span class="mono">${bw ? "reps" : "kg"} · latest</span></div>
        <div class="r"><div class="${deltaCls(since)}" style="font-weight:700">${pctText(since)}</div><span class="mono">since ${esc(firstP.label)}</span></div>
      </div>
      ${lineChart(points, bw ? "reps" : "kg")}
      <details class="more"><summary>History</summary>
      <table class="mini"><thead><tr><th>Date</th><th>Sets</th><th class="r">${bw ? "Reps" : "1RM"}</th></tr></thead><tbody>
        ${hist.slice().reverse().map((h) => {
          const st = Logic.entryStats(h.e);
          return `<tr><td>${fmtDate(h.s.date)}</td><td class="small">${esc(Logic.fmtSets(h.e))}</td><td class="r">${bw ? st.reps : st.best.e.toFixed(1)}</td></tr>`;
        }).join("")}
      </tbody></table>
      ${bw ? "" : `<p class="small muted">1RM = kg × (1 + reps/30), from your best set.</p>`}
      </details>
    </section>

    <section class="panel"><details class="more"><summary>Week by week</summary>
      <table class="mini"><thead><tr><th>Week of</th><th class="r">Workouts</th><th class="r">Sets</th><th class="r">Volume</th><th class="r">Δ</th></tr></thead><tbody>
        ${totals.map((w, i) => {
          const p = Logic.pct(w.t.volume, prevOf(i).volume);
          return `<tr><td>${fmtWeek(w.k)}</td><td class="r">${w.t.sessions}</td><td class="r">${w.t.sets}</td><td class="r">${fmtInt(w.t.volume)}</td><td class="r ${deltaCls(p)}">${pctText(p)}</td></tr>`;
        }).join("")}
      </tbody></table>
    </details></section>

    <section class="panel"><details class="more"><summary>Sets per muscle</summary>
      <table class="mini"><thead><tr><th>Muscle</th><th class="r">This week</th><th class="r">Last</th></tr></thead><tbody>
        ${MUSCLES.map((m) => {
          const a = cur.muscles[m] || 0, b = last.muscles[m] || 0;
          return `<tr><td>${esc(m)}</td><td class="r"><b>${a}</b></td><td class="r muted">${b}</td></tr>`;
        }).join("")}
      </tbody></table>
    </details></section>
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
    if (db.settings.appliedFor === latestWeek) applyHtml = `<p class="small muted">Applied for this check-in.</p>`;
    else if (next < DIET.kcalFloor) applyHtml = `<p class="small warn-text">${fmtInt(next)} kcal is below the ~${fmtInt(DIET.kcalFloor)} floor. Add ~3,000 steps instead.</p>`;
    else applyHtml = `<button class="btn acc" data-apply="${dec.delta}">Set target to ${fmtInt(next)} kcal</button>${dec.delta < 0 ? `<button class="btn" data-steps="1">Add steps instead</button>` : ""}`;
  }
  const d = (a, b, unit) => {
    if (!num(a) || !num(b)) return "";
    const v = num(a) - num(b);
    const cls = Math.abs(v) < 0.05 ? "same" : v < 0 ? "up" : "down";
    return ` <span class="${cls}">${v > 0 ? "+" : ""}${v.toFixed(1)}${unit}</span>`;
  };

  app.innerHTML = `
    <h1 class="page-title">Body</h1>
    <section class="panel">
      <div class="bignum">${fmtInt(kcal)}</div><span class="mono">kcal / day target</span>
      <h3 style="margin-top:16px">${esc(dec.title)}</h3>
      <p class="small muted">${esc(dec.text)}</p>
      ${applyHtml ? `<div class="row">${applyHtml}</div>` : ""}
    </section>

    <section class="panel"><details class="more"${list.length && list[0].week === Logic.weekStart() ? "" : " open"}><summary>Weekly check-in</summary>
      <form id="checkin" class="form">
        <label>Week<input type="date" name="week" value="${Logic.weekStart()}" required></label>
        <label>Avg weight kg<input type="number" step="0.01" inputmode="decimal" enterkeyhint="next" name="weight" required></label>
        <label>Waist cm<input type="number" step="0.1" inputmode="decimal" enterkeyhint="next" name="waist"></label>
        <label>Avg kcal<input type="number" step="1" inputmode="numeric" enterkeyhint="next" name="kcal"></label>
        <label>Protein g<input type="number" step="1" inputmode="numeric" enterkeyhint="next" name="protein"></label>
        <label>Steps<input type="number" step="1" inputmode="numeric" enterkeyhint="next" name="steps"></label>
        <label>Sleep h<input type="number" step="0.1" inputmode="decimal" enterkeyhint="next" name="sleep"></label>
        <label class="check"><input type="checkbox" name="creatine"> First 4 weeks of creatine</label>
        <label class="check"><input type="checkbox" name="perfDown"> Performance falling</label>
        <label class="wide">Notes<textarea name="notes" rows="2"></textarea></label>
        <button class="btn acc big wide" type="submit">Save check-in</button>
      </form>
      <p class="small muted">Use 7-day averages. Weigh each morning before food.</p>
    </details></section>

    ${list.length ? `${label("Check-ins", plural(list.length, "week"))}
      <section class="panel list">${list.map((c, i) => {
        const p = list[i + 1];
        return `<details class="more checkin"><summary><span>${fmtWeek(c.week)} <span class="small muted">· ${c.weight ? num(c.weight).toFixed(1) + " kg" : "–"}${p ? d(c.weight, p.weight, "") : ""}</span></span></summary>
          <div class="grid2 small">
            <span>Waist <b>${c.waist ? num(c.waist).toFixed(1) + " cm" : "–"}</b>${p ? d(c.waist, p.waist, "") : ""}</span>
            <span class="muted">Kcal ${c.kcal ? fmtInt(c.kcal) : "–"}</span>
            <span class="muted">Protein ${c.protein ? fmtInt(c.protein) + " g" : "–"}</span>
            <span class="muted">Steps ${c.steps ? fmtInt(c.steps) : "–"}</span>
            <span class="muted">Sleep ${c.sleep ? num(c.sleep).toFixed(1) + " h" : "–"}</span>
          </div>
          ${c.creatine || c.perfDown ? `<div class="small warn-text">${[c.creatine && "Creatine weeks", c.perfDown && "Performance falling"].filter(Boolean).join(" · ")}</div>` : ""}
          ${c.notes ? `<div class="small">${esc(c.notes)}</div>` : ""}
          <button class="link danger-text" data-delcheck="${c.id}">Delete</button>
        </details>`;
      }).join("")}</section>` : ""}
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
  return `<section class="panel myweek">
    ${Store.DAYS.map((k) => {
      const id = s.week[k];
      return `<div class="wk-row${k === tk ? " today" : ""}${id ? "" : " off"}">
        <label class="wk-day" for="wk-${k}"><b>${DAY_NAMES[k]}</b></label>
        <select id="wk-${k}" data-week="${k}">${PROGRAM.order.map((o) => `<option value="${o}" ${o === id ? "selected" : ""}>${esc(PROGRAM.days[o].name)}</option>`).join("")}<option value="" ${id ? "" : "selected"}>Rest</option></select>
        ${id ? "" : `<input class="wk-info" data-restlabel="${k}" value="${esc(s.restLabels[k] || "")}" placeholder="Rest note (optional)" aria-label="${DAY_NAMES[k]} rest note" maxlength="40">`}
      </div>`;
    }).join("")}
    <p class="small muted" style="padding:6px 0 10px">${train} training · ${7 - train} rest</p>
  </section>`;
}

function feedbackPrefs() {
  const s = Store.db.settings;
  const toggle = (key, on, text, note) => `<label class="toggle"><input type="checkbox" data-pref="${key}" ${on ? "checked" : ""}><span><b>${text}</b><span class="small muted">${note}</span></span></label>`;
  return `<section class="panel">
    ${Device.canVibrate
      ? toggle("vibrate", s.vibrate !== false, "Vibrate", "On each set and when rest is done.")
      : `<p class="small muted">No vibration on this phone. The rest bar turns white when rest is done.</p>`}
    ${toggle("sound", !!s.sound, "Beep when rest is done", "")}
  </section>`;
}

function renderPlan(tab) {
  tab = tab === "diet" ? "diet" : "training";
  const sub = `<div class="subtabs"><a href="#/plan/training" class="${tab === "training" ? "active" : ""}">Training</a><a href="#/plan/diet" class="${tab === "diet" ? "active" : ""}">Diet</a></div>`;
  if (tab === "training") {
    app.innerHTML = `
      <h1 class="page-title">Plan</h1>${sub}
      ${label("My week")}
      ${weekEditor()}
      ${label("Workouts", "tap to see exercises")}
      ${PROGRAM.order.map((id) => {
        const d = PROGRAM.days[id];
        return `<section class="panel"><details class="more"><summary><span>${esc(d.name)} <span class="small muted">· ${esc(d.focus)}</span></span></summary>
          ${d.slots.map((sl, k) => {
            const ex = EXERCISES[sl.ex];
            const key = `${id}-${k}`;
            return `<div class="plan-ex">
              <div class="ex-top">${thumb(ex, `data-planhow="${key}"`)}
                <div class="ex-info"><div class="ex-name">${esc(ex.name)}</div><div class="small muted">${repsText(sl, ex)} ${tierBadge(ex.tier)}</div></div></div>
              <div class="howto-wrap hidden" id="planhow-${key}">${howto(ex)}</div>
            </div>`;
          }).join("")}
        </details></section>`;
      }).join("")}
      ${label("Feedback")}
      ${feedbackPrefs()}
      <p class="small muted" style="padding:8px 4px">Tiers (S+, S, A) come from Jeff Nippard's exercise tier lists. RIR = reps left in the tank. Images: <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">free-exercise-db</a>.</p>
    `;
  } else {
    const sec = (title, body, open = false) => `<section class="panel"><details class="more"${open ? " open" : ""}><summary>${title}</summary>${body}</details></section>`;
    app.innerHTML = `
      <h1 class="page-title">Plan</h1>${sub}
      ${sec("Daily targets", `<table class="mini"><tbody>${DIET.targets.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="r"><b>${esc(b)}</b></td></tr>`).join("")}</tbody></table>`, true)}
      ${sec("Base day", `<table class="mini"><thead><tr><th>Meal</th><th class="r">kcal</th><th class="r">Protein</th></tr></thead><tbody>
          ${DIET.baseDay.map(([t, m, f, k, p]) => `<tr><td class="small"><b>${esc(m)}</b> <span class="muted">${esc(t)}</span><br><span class="muted">${esc(f)}</span></td><td class="r">${esc(k)}</td><td class="r">${esc(p)} g</td></tr>`).join("")}
        </tbody></table>`)}
      ${sec("Idli day swap", `<table class="mini"><thead><tr><th>Base</th><th>Idli day</th><th class="r">Δ</th></tr></thead><tbody>
          ${DIET.idliDay.map(([t, a, b, c]) => `<tr><td class="small">${esc(a)}</td><td class="small">${esc(b)}</td><td class="r small">${esc(c)}</td></tr>`).join("")}
        </tbody></table>`)}
      ${sec("14-day calorie rules", `<table class="mini"><tbody>${DIET.rules.map(([a, b]) => `<tr><td class="small"><b>${esc(a)}</b><br><span class="muted">${esc(b)}</span></td></tr>`).join("")}</tbody></table>
        <p class="small muted">Body applies these for you. Floor: ~${fmtInt(DIET.kcalFloor)} kcal.</p>`)}
      <a class="cta ghost" href="assets/Beyond_Training_Diet_Protocol_v2.1.pdf" target="_blank" rel="noopener">Full diet PDF</a>
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
