/* Pure calculations: stats, comparisons, progression targets, weekly totals, diet rules. */

const Logic = (() => {
  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const round = (n, step = 0.25) => Math.round(n / step) * step;
  const fmtKg = (n) => {
    const r = round(n);
    return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0$/, "");
  };
  const e1rm = (kg, reps) => (kg > 0 && reps > 0 ? kg * (1 + reps / 30) : 0);

  const workSets = (entry) => (entry.sets || []).filter((s) => num(s.reps) > 0);

  function entryStats(entry) {
    const sets = workSets(entry);
    const out = { sets: sets.length, reps: 0, volume: 0, topKg: 0, best: null };
    sets.forEach((s) => {
      const kg = num(s.kg), reps = num(s.reps), e = e1rm(kg, reps);
      out.reps += reps;
      out.volume += kg * reps;
      out.topKg = Math.max(out.topKg, kg);
      const better = !out.best || (e > 0 ? e > out.best.e : reps > out.best.reps && out.best.e === 0);
      if (better) out.best = { kg, reps, e };
    });
    return out;
  }

  const fmtSet = (s) => (num(s.kg) > 0 ? `${fmtKg(num(s.kg))}×${num(s.reps)}` : `BW×${num(s.reps)}`);
  const fmtSets = (entry) => workSets(entry).map(fmtSet).join(", ");

  /* Most recent finished entry for this exercise, logged before `beforeIso`, ignoring session `excludeId`.
     `list` is a date-sorted list of finished sessions (another athlete's in the coach view). */
  function previousEntry(exId, beforeIso, excludeId, list = Store.finishedSessions()) {
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (s.id === excludeId) continue;
      if (beforeIso && s.date >= beforeIso) continue;
      const e = s.entries.find((x) => x.exId === exId && workSets(x).length);
      if (e) return { session: s, entry: e };
    }
    return null;
  }

  function previousSessionOfDay(dayId, beforeIso, excludeId, list = Store.finishedSessions()) {
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (s.id !== excludeId && s.dayId === dayId && (!beforeIso || s.date < beforeIso)) return s;
    }
    return null;
  }

  function compareEntry(cur, prev) {
    const c = entryStats(cur);
    const p = prev ? entryStats(prev) : null;
    if (!c.sets) return { verdict: "skip", c, p };
    if (!p || !p.sets) return { verdict: "new", c, p };
    const strength = c.best.e > 0 && p.best.e > 0
      ? (c.best.e - p.best.e) / p.best.e
      : (c.reps - p.reps) / Math.max(1, p.reps);
    const vol = p.volume > 0 ? (c.volume - p.volume) / p.volume : (c.reps - p.reps) / Math.max(1, p.reps);
    let verdict = strength > 0.01 ? "up" : strength < -0.01 ? "down" : "same";
    if (verdict === "same") verdict = vol > 0.03 ? "up" : vol < -0.03 ? "down" : "same";
    const lo = cur.target ? cur.target.reps[0] : 0;
    const heavier = c.topKg > p.topKg && workSets(cur).every((s) => num(s.reps) >= lo);
    if (heavier && verdict !== "up") verdict = "heavier";
    return { verdict, strength, vol, c, p };
  }

  /* Double progression: fill the rep range on every set, then add the smallest weight jump. */
  function suggestNext(entry) {
    const ex = EXERCISES[entry.exId];
    const [lo, hi] = entry.target.reps;
    const sets = workSets(entry);
    if (!sets.length) return { kind: "none", text: "No sets logged." };
    const reps = sets.map((s) => num(s.reps));
    const top = Math.max(...sets.map((s) => num(s.kg)));
    const enough = sets.length >= entry.target.sets;
    const rirs = sets.map((s) => s.rir).filter((r) => r !== "" && r != null).map(Number);
    const easy = rirs.length === sets.length && rirs.every((r) => r >= 3);
    const side = ex.perSide ? " per side" : "";
    const missing = enough ? "" : ` Do all ${entry.target.sets} sets.`;
    const easyNote = easy ? " Your RIR was 3+ on every set, so push closer to failure." : "";
    const pad = (arr) => Array.from({ length: Math.max(entry.target.sets, arr.length) }, (_, k) => (k < arr.length ? arr[k] : arr[arr.length - 1]));

    if (ex.inc === 0 || top === 0) {
      if (enough && reps.every((r) => r >= hi)) {
        return { kind: "up", kg: 0, targets: pad(reps), text: `Every set hit ${hi}+ reps. Add load or slow the lowering to 4-5 s.` };
      }
      return { kind: "reps", kg: 0, targets: pad(reps.map((r) => r + 1)), text: `Beat ${reps.join(", ")} reps by 1 rep on at least one set.${missing}` };
    }
    if (enough && reps.every((r) => r >= hi)) {
      const next = top + ex.inc;
      return { kind: "up", kg: next, targets: pad([lo]), text: `Every set hit ${hi}+ reps. Move up to ${fmtKg(next)} kg${side} and aim for ${lo}-${Math.min(hi, lo + 2)} reps.` };
    }
    if (reps.every((r) => r >= lo)) {
      const targets = reps.map((r) => Math.min(hi, r + 1));
      return { kind: "reps", kg: top, targets: pad(targets), text: `Stay at ${fmtKg(top)} kg${side}. Aim for ${targets.join(", ")} reps.${missing}${easyNote}` };
    }
    return { kind: "hold", kg: top, targets: pad(reps.map((r) => Math.max(r, lo))), text: `A set fell below ${lo} reps. Repeat ${fmtKg(top)} kg${side}. If it happens again, drop to ${fmtKg(Math.max(0, top - ex.inc))} kg.` };
  }

  function sessionStats(s) {
    const out = { sets: 0, reps: 0, volume: 0, minutes: 0 };
    s.entries.forEach((e) => {
      const st = entryStats(e);
      out.sets += st.sets;
      out.reps += st.reps;
      out.volume += st.volume;
    });
    if (s.finishedAt && s.date) out.minutes = Math.max(0, Math.round((new Date(s.finishedAt) - new Date(s.date)) / 60000));
    return out;
  }

  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseYmd = (k) => {
    const [y, m, d] = k.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  function weekStart(iso) {
    const d = iso ? new Date(iso) : new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return ymd(d);
  }
  function addWeeks(key, n) {
    const d = parseYmd(key);
    d.setDate(d.getDate() + n * 7);
    return ymd(d);
  }

  const dayKey = (d) => Store.DAYS[(d.getDay() + 6) % 7];
  /* Same integer for the same local calendar date on every device, whatever the time zone. */
  const dayNumber = (d = new Date()) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);

  /* This week (from Monday) against settings.week. A finished session clears a scheduled day if it is the
     same workout, done that day or later this week (a make-up). Today claims a session done today first. */
  function weekPlan(week, list = Store.finishedSessions(), now = new Date()) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const slots = [];
    for (let k = (today.getDay() + 6) % 7; k >= 0; k--) {
      const d = new Date(today);
      d.setDate(d.getDate() - k);
      slots.push({ key: dayKey(d), date: ymd(d), dayId: week[dayKey(d)] || null });
    }
    const cur = slots[slots.length - 1];
    const pool = list.map((s) => ({ s, day: ymd(new Date(s.date)) })).filter((p) => p.day >= slots[0].date && p.day <= cur.date);
    const used = new Set();
    const claim = (slot, exact) => {
      const hit = pool.find((p) => !used.has(p.s.id) && p.s.dayId === slot.dayId && (exact ? p.day === slot.date : p.day >= slot.date));
      if (hit) used.add(hit.s.id);
      return hit ? hit.s : null;
    };
    const doneToday = cur.dayId ? claim(cur, true) : null;
    const missed = slots.slice(0, -1).filter((sl) => sl.dayId && !claim(sl, false));
    const t = new Date(today);
    t.setDate(t.getDate() + 1);
    return {
      today: cur, doneToday, missed,
      trainedToday: pool.filter((p) => p.day === cur.date).map((p) => p.s),
      tomorrow: { key: dayKey(t), dayId: week[dayKey(t)] || null },
    };
  }

  function weekTotals(key, list = Store.finishedSessions()) {
    const out = { sessions: 0, sets: 0, reps: 0, volume: 0, muscles: {} };
    list.filter((s) => weekStart(s.date) === key).forEach((s) => {
      out.sessions++;
      s.entries.forEach((e) => {
        const st = entryStats(e);
        out.sets += st.sets;
        out.reps += st.reps;
        out.volume += st.volume;
        const m = EXERCISES[e.exId] ? EXERCISES[e.exId].muscle : "other";
        out.muscles[m] = (out.muscles[m] || 0) + st.sets;
      });
    });
    return out;
  }

  const pct = (cur, prev) => (prev > 0 ? (cur - prev) / prev : null);

  /* The page-6 decision table, checked top to bottom on 2 weeks of check-ins. */
  function dietDecision(checkins) {
    const list = [...checkins].sort((a, b) => a.week.localeCompare(b.week));
    const n = list.length;
    if (n < 3) {
      return { action: "wait", title: "Need more check-ins", text: `Log ${3 - n} more weekly check-in${3 - n > 1 ? "s" : ""}. The rules compare 2 weeks of change.` };
    }
    const cur = list[n - 1], mid = list[n - 2], base = list[n - 3];
    const w0 = num(base.weight), w1 = num(cur.weight);
    if (!w0 || !w1) return { action: "wait", title: "Missing weight", text: "Add the 7-day average weight to each check-in." };
    const weeks = Math.max(1, Math.round((parseYmd(cur.week) - parseYmd(base.week)) / (7 * 864e5)));
    const rate = (w0 - w1) / weeks;
    const waistKnown = num(base.waist) > 0 && num(cur.waist) > 0;
    const waistDown = waistKnown && num(cur.waist) <= num(base.waist) - 0.5;
    const rateText = `${rate >= 0 ? "Down" : "Up"} ${Math.abs(rate).toFixed(2)} kg/week over ${weeks} weeks.`;

    if (cur.creatine || mid.creatine) {
      return { action: "keep", rule: 2, rate, title: "Creatine weeks: ignore the scale", text: `${rateText} Creatine adds ~1-2 kg of water. Do not remove calories because of the scale. Decide from waist, photos and lifts.` };
    }
    if (cur.perfDown && mid.perfDown) {
      return { action: "add", rule: 3, rate, delta: 150, title: "Add ~150 kcal/day", text: `Gym performance/energy fell for 2 weeks. Add ~150 kcal/day, mostly carbs around training. ${rateText}` };
    }
    if (rate > 0.6) {
      return { action: "add", rule: 4, rate, delta: 150, title: "Add ~150 kcal/day", text: `${rateText} That is faster than 0.6 kg/week. Add ~150 kcal/day, mostly carbs around training.` };
    }
    if (rate < 0.2 && !waistDown) {
      const note = waistKnown ? "" : " (Add waist measurements to make this rule more reliable.)";
      return { action: "remove", rule: 5, rate, delta: -150, title: "Remove ~150 kcal/day OR add ~3,000 steps", text: `${rateText} The waist is not decreasing. Pick ONE: remove ~150 kcal/day, or add ~3,000 average daily steps.${note}` };
    }
    if (rate < 0.2 && waistDown) {
      return { action: "keep", rule: 6, rate, title: "Keep calories (recomposition)", text: `${rateText} But the waist is down. Recomposition can hide scale change. Keep calories.` };
    }
    return { action: "keep", rule: 7, rate, title: "Keep calories", text: `${rateText} This is in the 0.2-0.6 kg/week band. Do nothing. Check again in 14 days.` };
  }

  return {
    num, round, fmtKg, e1rm, workSets, entryStats, fmtSet, fmtSets,
    previousEntry, previousSessionOfDay, compareEntry, suggestNext, sessionStats,
    ymd, parseYmd, weekStart, addWeeks, weekTotals, pct, dietDecision, dayKey, dayNumber, weekPlan,
  };
})();
