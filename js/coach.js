/* Coach view: linked athletes and a read-only detail page. Live data, online only. */

const Coach = (() => {
  const root = document.getElementById("app");
  let token = 0;
  let cache = null;
  let showAll = false;

  const title = (t = "Clients") => `<h1 class="page-title">${esc(t)}</h1>`;
  const exName = (id) => (EXERCISES[id] ? EXERCISES[id].name : id);
  const dayName = (id) => (PROGRAM.days[id] ? PROGRAM.days[id].name : id || "Workout");
  const VERDICT = { up: "Better", heavier: "Heavier", same: "Same", down: "Lower", new: "New", skip: "Skipped" };

  function trend(a, b, unit, goodDown = true) {
    if (!num(a) || !num(b)) return "";
    const v = num(a) - num(b);
    const cls = Math.abs(v) < 0.05 ? "same" : (v < 0) === goodDown ? "up" : "down";
    return ` <span class="${cls}">${v > 0 ? "+" : ""}${v.toFixed(1)}${unit}</span>`;
  }

  async function list() {
    const athletes = await Sync.myAthletes();
    const data = await Sync.athletesOverview(athletes.map((a) => a.athlete_id));
    const wk = Logic.weekStart();
    const code = Sync.profile ? Sync.profile.coach_code : "";
    const rows = athletes.map((a) => {
      const ss = data.sessions.filter((s) => s.userId === a.athlete_id);
      const cs = data.checkins.filter((c) => c.userId === a.athlete_id);
      const last = ss[ss.length - 1];
      const c = cs[cs.length - 1], p = cs[cs.length - 2];
      const body = c
        ? `${c.weight ? num(c.weight).toFixed(1) + " kg" : "–"}${p ? trend(c.weight, p.weight, "") : ""}${c.waist ? ` · ${num(c.waist).toFixed(1)} cm${p ? trend(c.waist, p.waist, "") : ""}` : ""}`
        : "No check-in";
      return `<a class="hist" href="#/coach/${encodeURIComponent(a.athlete_id)}">
        <span><span class="name">${esc(a.display_name || "Athlete")}</span><br><span class="mono muted">${last ? `Last ${fmtDate(last.date)} · ${agoText(last.date)}` : "No workouts yet"}</span></span>
        <span class="r mono">${ss.filter((s) => Logic.weekStart(s.date) === wk).length} this week<br>${body}</span></a>`;
    });
    return `${title()}
      ${label("Your PT code", "share with clients")}
      <section class="panel framed">
        <div class="bignum">${esc(code)}</div>
        <p class="small muted">Clients enter this under Account → Your PT. You see their workouts and check-ins (read only).</p>
        <div class="row"><button class="btn acc" data-coach="copy">Copy code</button></div>
      </section>
      ${label("Clients", `${athletes.length}`)}
      ${rows.length ? rows.join("") : `<p class="muted">No clients yet. Share your code.</p>`}`;
  }

  function lifts(sessions) {
    const ids = [...new Set(sessions.flatMap((s) => s.entries.filter((e) => Logic.workSets(e).length).map((e) => e.exId)))];
    return ids.map((exId) => {
      const hist = sessions.map((s) => s.entries.find((e) => e.exId === exId && Logic.workSets(e).length)).filter(Boolean).map(Logic.entryStats);
      const bw = hist.every((st) => !st.best.e);
      const y = (st) => (bw ? st.reps : st.best.e);
      const first = hist[0], last = hist[hist.length - 1];
      return { exId, bw, n: hist.length, latest: y(last), best: last.best, change: hist.length > 1 ? Logic.pct(y(last), y(first)) : null };
    }).sort((a, b) => b.n - a.n);
  }

  function sessionCard(s, all) {
    const st = Logic.sessionStats(s);
    const rows = s.entries.map((e) => {
      const prev = Logic.previousEntry(e.exId, s.date, s.id, all);
      const c = Logic.compareEntry(e, prev && prev.entry);
      return `<tr${e.notes ? ` class="has-note"` : ""}><td>${esc(exName(e.exId))}</td><td class="small">${esc(Logic.fmtSets(e)) || "–"}</td><td class="r"><span class="chip c-${c.verdict}">${VERDICT[c.verdict]}</span></td></tr>
        ${e.notes ? `<tr class="note-row"><td colspan="3"><span class="small ex-note">${esc(e.notes)}</span></td></tr>` : ""}`;
    }).join("");
    return `<article class="panel">
      <div class="cmp-head"><span class="ex-name">${esc(dayName(s.dayId))}</span><span class="mono muted">${fmtDate(s.date)}</span></div>
      <div class="mono muted">${st.sets} sets · ${fmtInt(st.volume)} kg${st.minutes ? ` · ${st.minutes} min` : ""}</div>
      <table class="mini"><tbody>${rows}</tbody></table>
      ${s.notes ? `<p class="small muted">${esc(s.notes)}</p>` : ""}
    </article>`;
  }

  function detailHtml({ athlete: a, sessions, checkins }) {
    const wk = Logic.weekStart();
    const cur = Logic.weekTotals(wk, sessions);
    const prev = Logic.weekTotals(Logic.addWeeks(wk, -1), sessions);
    const kcal = (a.settings && a.settings.kcal) || DIET.kcalStart;
    const dec = Logic.dietDecision(checkins);
    const top = lifts(sessions);
    const recent = sessions.slice().reverse();
    const shown = showAll ? recent : recent.slice(0, 10);
    const checks = checkins.slice().reverse();
    const week = a.settings && a.settings.week;
    const weekText = week ? Store.DAYS.map((k) => `${DAY_NAMES[k].slice(0, 3)} ${PROGRAM.order.includes(week[k]) ? PROGRAM.days[week[k]].name : "Rest"}`).join(" · ") : "";
    return `${title(a.display_name || "Athlete")}
      <p class="mono muted">${sessions.length} workouts logged · read only · <a class="link" href="#/coach">All clients</a></p>
      ${label("This week", "vs last week")}
      <div class="stats">
        ${stat(cur.sessions, "Workouts", Logic.pct(cur.sessions, prev.sessions))}
        ${stat(cur.sets, "Hard sets", Logic.pct(cur.sets, prev.sets))}
        ${stat(cur.volume, "Volume kg", Logic.pct(cur.volume, prev.volume), "k")}
      </div>
      ${weekText ? `<p class="small muted"><span class="mono">Their week</span> ${esc(weekText)}</p>` : ""}
      ${label("Diet", `target ${fmtInt(kcal)} kcal`)}
      <section class="panel framed decision d-${dec.action}"><h3>${esc(dec.title)}</h3><p class="small">${esc(dec.text)}</p></section>
      ${label("Key lifts", "latest vs first")}
      <section class="panel">
        ${top.length ? `<table class="mini"><thead><tr><th>Exercise</th><th class="r">Latest</th><th class="r">Δ</th></tr></thead><tbody>
          ${top.map((l) => `<tr><td>${esc(exName(l.exId))} <span class="mono muted">×${l.n}</span></td><td class="r">${l.bw ? `${l.latest} reps` : `${l.latest.toFixed(1)} kg`}</td><td class="r ${deltaCls(l.change)}">${pctText(l.change)}</td></tr>`).join("")}
        </tbody></table><p class="small muted">Best set as estimated 1RM (total reps for bodyweight moves).</p>` : `<p class="small muted">No workouts yet.</p>`}
      </section>
      ${label("Check-ins", `${checkins.length} weeks`)}
      <section class="panel">
        ${checks.length ? `<table class="mini"><thead><tr><th>Week</th><th class="r">Kg</th><th class="r">Waist</th><th class="r">Kcal</th><th class="r">Prot.</th><th class="r">Steps</th></tr></thead><tbody>
          ${checks.map((c, i) => {
            const p = checks[i + 1];
            const flags = [c.creatine && "creatine", c.perfDown && "perf. falling"].filter(Boolean).join(" · ");
            return `<tr><td>${fmtWeek(c.week)}${flags ? `<br><span class="mono warn-text">${flags}</span>` : ""}</td>
              <td class="r">${c.weight ? num(c.weight).toFixed(1) : "–"}${p ? `<br><span class="small">${trend(c.weight, p.weight, "")}</span>` : ""}</td>
              <td class="r">${c.waist ? num(c.waist).toFixed(1) : "–"}</td><td class="r">${c.kcal ? fmtInt(c.kcal) : "–"}</td>
              <td class="r">${c.protein ? fmtInt(c.protein) : "–"}</td><td class="r">${c.steps ? fmtInt(c.steps) : "–"}</td></tr>`;
          }).join("")}
        </tbody></table>` : `<p class="small muted">No check-ins yet.</p>`}
      </section>
      ${label("Workouts", `${recent.length} total`)}
      ${shown.map((s) => sessionCard(s, sessions)).join("")}
      ${recent.length > shown.length ? `<button class="btn full" data-coach="all">Show all ${recent.length} workouts</button>` : ""}
      <button class="btn danger full" data-coach-remove="${esc(a.athlete_id)}">Remove client</button>`;
  }

  async function detail(id) {
    const athletes = await Sync.myAthletes();
    const athlete = athletes.find((a) => a.athlete_id === id);
    if (!athlete) return `${title("Not found")}<p class="muted">This client is not linked to you.</p><a class="btn" href="#/coach">All clients</a>`;
    const data = await Sync.athleteDetail(id);
    cache = { id, athlete, ...data };
    return detailHtml(cache);
  }

  function show(html) {
    root.innerHTML = html;
    animateIn();
  }

  function render(arg) {
    const t = ++token;
    if (!Sync.isCoach) return show(`${title()}<p class="muted">This view is for PT accounts.</p>`);
    if (!navigator.onLine) return show(`${title()}<section class="panel warn"><b>You are offline.</b> <span class="small muted">Client data loads live. Connect and try again.</span></section>`);
    const id = arg ? decodeURIComponent(arg) : null;
    if (id && cache && cache.id === id) return show(detailHtml(cache));
    if (!id) showAll = false;
    root.innerHTML = `${title()}<p class="mono muted">Loading…</p>`;
    const hash = location.hash;
    (id ? detail(id) : list())
      .then((html) => {
        if (t === token && location.hash === hash) show(html);
      })
      .catch((e) => {
        if (t === token && location.hash === hash) show(`${title()}<section class="panel warn"><b>Could not load.</b> <span class="small">${esc(e.message || String(e))}</span><div class="row"><button class="btn" data-coach="retry">Retry</button></div></section>`);
      });
  }

  root.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-coach], [data-coach-remove]");
    if (!b) return;
    const ds = b.dataset;
    if (ds.coachRemove) {
      if (!(await UI.ask({ title: "Remove this client?", text: "You lose access until they link again.", ok: "Remove", danger: true }))) return;
      try {
        await Sync.removeAthlete(ds.coachRemove);
        cache = null;
        location.hash = "#/coach";
      } catch (e) {
        UI.tell("Could not remove", e.message || String(e));
      }
      return;
    }
    switch (ds.coach) {
      case "copy":
        navigator.clipboard.writeText(Sync.profile.coach_code).then(() => (b.textContent = "Copied"), () => {});
        return;
      case "all":
        showAll = true;
        return rerender();
      case "retry":
        cache = null;
        return rerender();
    }
  });

  /* Detail pages are re-fetched each time the coach opens them from the list. */
  window.addEventListener("hashchange", () => {
    if (location.hash === "#/coach") cache = null;
  });

  return { render };
})();
