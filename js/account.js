/* Account screen: sign in / sign up / reset with email codes, sync status, coach linking. */

const Account = (() => {
  const LOCAL_OK = "jw.gym.local-only";
  const root = document.getElementById("app");
  const sheet = document.getElementById("modal");
  let mode = "signin";
  let email = "";
  let msg = null;
  let recovery = false;
  let coaches = { uid: null, list: null, error: "" };
  let offered = null;

  const wantsAuth = () => Sync.enabled && !Store.account && !localStorage.getItem(LOCAL_OK);
  const needsSignIn = () => !Store.account || Sync.status().state === "signedout";

  const STATE_TEXT = { idle: "Synced", syncing: "Syncing", pending: "Saving", offline: "Offline", error: "Sync error", signedout: "Sign in" };

  function pill() {
    if (!Sync.enabled) return "";
    const s = Sync.status();
    if (!s.signedIn) return `<a class="pill" href="#/account">Sign in</a>`;
    const n = s.pending && (s.state === "offline" || s.state === "error" || s.state === "signedout") ? ` · ${s.pending}` : "";
    return `<a class="pill sync s-${s.state}" href="#/account" aria-label="Account and sync status">${STATE_TEXT[s.state]}${n}</a>`;
  }

  function statusLine() {
    const s = Sync.status();
    const when = s.lastSync ? ` Last sync ${fmtTime(s.lastSync)}.` : "";
    const waiting = s.pending ? `${s.pending} change${s.pending > 1 ? "s" : ""} waiting to upload.` : "Everything on this device is uploaded.";
    switch (s.state) {
      case "offline": return `Offline. ${waiting} They upload when you are back online.`;
      case "error": return `Sync failed: ${s.error}. ${waiting} It retries by itself.`;
      case "signedout": return `Your session ended. Sign in again to sync. ${waiting}`;
      case "syncing": return `Syncing…${when}`;
      default: return `${waiting}${when}`;
    }
  }

  function say(text, bad) {
    msg = text ? { text, bad } : null;
    const el = document.getElementById("acct-msg");
    if (el) {
      el.textContent = text || "";
      el.className = `small ${bad ? "danger-text" : "up"}`;
    }
  }
  const msgHtml = () => `<p id="acct-msg" class="small ${msg && msg.bad ? "danger-text" : "up"}" aria-live="polite">${msg ? esc(msg.text) : ""}</p>`;

  const field = (lbl, name, type, extra = "") => `<label class="wide">${lbl}<input type="${type}" name="${name}" ${extra}></label>`;
  const emailField = () => field("Email", "email", "email", `autocomplete="email" required value="${esc(email)}"`);
  const codeField = () => field("Code from the email", "code", "text", `inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,10}" required`);
  const newPassField = (lbl = "New password · 8+ characters") => field(lbl, "password", "password", `autocomplete="new-password" minlength="8" required`);
  const submit = (text, cls = "acc") => `<button class="btn ${cls} big wide" type="submit">${text}</button>`;

  function authForm() {
    switch (mode) {
      case "signup":
        return `<form id="acct-signup" class="form">${field("Name", "name", "text", `autocomplete="name" required`)}${emailField()}${newPassField("Password · 8+ characters")}${submit("Create account")}</form>`;
      case "code":
        return `<p class="small">Enter the code we emailed to <b>${esc(email)}</b>. The code works inside the installed app, even if the email link opens another browser.</p>
          <form id="acct-code" class="form">${codeField()}${submit("Confirm email")}</form>
          <button class="link" data-acct="resend">Send a new code</button>`;
      case "reset":
        return `<p class="small muted">We email you a code to set a new password.</p><form id="acct-reset" class="form">${emailField()}${submit("Send reset code")}</form>`;
      case "resetcode":
        return `<p class="small">Enter the code we emailed to <b>${esc(email)}</b> and choose a new password.</p>
          <form id="acct-resetcode" class="form">${codeField()}${newPassField()}${submit("Set new password")}</form>`;
      default:
        return `<form id="acct-signin" class="form">${emailField()}${field("Password", "password", "password", `autocomplete="current-password" required`)}${submit("Sign in")}</form>
          <button class="link" data-acct-mode="reset">Forgot password?</button>`;
    }
  }

  function renderAuth() {
    const tab = (m, t) => `<a href="#/account" data-acct-mode="${m}" class="${mode === m ? "active" : ""}">${t}</a>`;
    const s = Sync.status();
    root.innerHTML = `
      <h1 class="display page-title kinetic">Account</h1>
      ${s.signedIn ? `<section class="panel warn" data-reveal><b>Signed out.</b> <span class="small muted">${esc(statusLine())}</span></section>` : ""}
      <p class="small muted">An account backs up your log and syncs it between your devices. The app still works offline in the gym.</p>
      <div class="subtabs">${tab("signin", "Sign in")}${tab("signup", "Create account")}</div>
      <section class="panel sys" data-reveal>${authForm()}${msgHtml()}</section>
      ${!Store.account ? `${label("Or")}
        <section class="panel" data-reveal>
          <p class="small">Keep the log only in this browser, like before. You can sign in later and upload it.</p>
          <button class="btn full" data-acct="local">Continue on this device only</button>
        </section>` : ""}
    `;
  }

  function coachSection() {
    const p = Sync.profile;
    const own = p && p.role === "coach" ? `<section class="panel accent" data-reveal>
        <div class="mono">Your coach code</div><div class="bignum">${esc(p.coach_code)}</div>
        <p class="small">Athletes enter this code here to share their log with you.</p>
        <div class="row"><a class="btn primary" href="#/coach">Open coach view</a><button class="btn" data-acct="copy">Copy code</button></div>
      </section>` : "";
    if (!navigator.onLine) return `${own}<section class="panel" data-reveal><p class="small muted">Connect to the internet to see or change your coach.</p></section>`;
    const c = coaches.uid === Store.account ? coaches : null;
    const list = !c || !c.list
      ? `<p class="small muted">${c && c.error ? esc(c.error) : "Loading…"}</p>`
      : c.list.length
        ? c.list.map((x) => `<div class="cmp-head"><span><b>${esc(x.display_name || "Coach")}</b><br><span class="mono muted">since ${fmtDate(x.linked_at)}</span></span><button class="link danger-text" data-acct-unlink="${esc(x.coach_id)}">Unlink</button></div>`).join("")
        : `<p class="small muted">No coach linked.</p>`;
    return `${own}<section class="panel" data-reveal>
        ${list}
        <form id="acct-join" class="form" style="margin-top:12px">${field("Coach code", "code", "text", `autocapitalize="characters" autocomplete="off" maxlength="12" required`)}${submit("Join coach", "")}</form>
        <p class="small muted">A coach can see your workouts, check-ins and calorie target. They cannot change anything. Unlink any time.</p>
      </section>`;
  }

  function loadCoaches() {
    const uid = Store.account;
    if (!navigator.onLine || !Sync.user || (coaches.uid === uid && (coaches.list || coaches.loading))) return;
    coaches = { uid, list: null, error: "", loading: true };
    Sync.myCoaches()
      .then((list) => (coaches = { uid, list, error: "" }))
      .catch((e) => (coaches = { uid, list: null, error: e.message || "Could not load coaches." }))
      .then(() => {
        if (location.hash.startsWith("#/account") && Store.account === uid) render();
      });
  }

  function renderSignedIn() {
    const p = Sync.profile || {};
    const s = Sync.status();
    root.innerHTML = `
      <h1 class="display page-title kinetic">Account</h1>
      ${recovery ? `<section class="panel accent" data-reveal><h3>Set a new password</h3><form id="acct-pass" class="form">${newPassField()}${submit("Save password")}</form></section>` : ""}
      ${label("(01) Signed in", STATE_TEXT[s.state])}
      <section class="panel sys" data-reveal>
        <div class="ex-name">${esc(p.display_name || "")}</div>
        <div class="mono muted">${esc(p.email || (Sync.user && Sync.user.email) || "")}</div>
        <p class="small" id="acct-status">${esc(statusLine())}</p>
        <div class="row"><button class="btn acc" data-acct="sync">Sync now</button><button class="btn" data-acct="signout">Sign out</button></div>
        ${msgHtml()}
      </section>
      ${label("(02) Coach", p.role === "coach" ? "coach account" : "")}
      ${coachSection()}
      ${label("(03) Profile")}
      <section class="panel" data-reveal>
        <form id="acct-name" class="form">${field("Display name · coaches see this", "name", "text", `required value="${esc(p.display_name || "")}"`)}${submit("Save name", "")}</form>
        ${recovery ? "" : `<form id="acct-pass" class="form" style="margin-top:12px">${newPassField("Change password")}${submit("Save password", "")}</form>`}
      </section>
    `;
    loadCoaches();
  }

  function render() {
    if (!Sync.enabled) {
      root.innerHTML = `<h1 class="display page-title kinetic">Account</h1>
        <section class="panel sys" data-reveal><p class="small">Cloud sync is not set up for this app. Your log is saved only in this browser on this device. Use Log → Export backup to move it.</p></section>`;
      return;
    }
    if (needsSignIn()) renderAuth();
    else renderSignedIn();
  }

  /* Keeps typed form values: only the status text changes. */
  function refreshStatus() {
    const el = document.getElementById("acct-status");
    if (el) el.textContent = statusLine();
  }

  const done = () => {
    msg = null;
    mode = "signin";
    location.hash = "#/train";
  };

  const ACTIONS = {
    "acct-signin": async (v) => {
      email = v.email.trim();
      try {
        await Sync.signIn(email, v.password);
      } catch (e) {
        if (e.code === "email_not_confirmed") {
          mode = "code";
          await Sync.resendCode(email).catch(() => {});
          msg = { text: "Confirm your email first. We sent a new code." };
          return render();
        }
        throw e;
      }
      done();
    },
    "acct-signup": async (v) => {
      email = v.email.trim();
      const r = await Sync.signUp(email, v.password, v.name.trim());
      if (!r.needsCode) return done();
      mode = "code";
      msg = { text: "Check your email for the code." };
      render();
    },
    "acct-code": async (v) => {
      await Sync.verifyCode(email, v.code.replace(/\s/g, ""), "email");
      done();
    },
    "acct-reset": async (v) => {
      email = v.email.trim();
      await Sync.sendReset(email);
      mode = "resetcode";
      msg = { text: "Code sent. It can take a minute to arrive." };
      render();
    },
    "acct-resetcode": async (v) => {
      await Sync.verifyCode(email, v.code.replace(/\s/g, ""), "recovery");
      await Sync.setPassword(v.password);
      done();
    },
    "acct-pass": async (v, form) => {
      await Sync.setPassword(v.password);
      const wasRecovery = recovery;
      recovery = false;
      form.reset();
      if (wasRecovery) render();
      say("Password saved.");
    },
    "acct-name": async (v) => {
      await Sync.saveName(v.name.trim());
      say("Name saved.");
    },
    "acct-join": async (v, form) => {
      const c = await Sync.joinCoach(v.code);
      form.reset();
      coaches = { uid: null, list: null, error: "" };
      msg = { text: `Linked to ${c.display_name || "your coach"}.` };
      render();
    },
  };

  root.addEventListener("submit", async (ev) => {
    const form = ev.target;
    const act = ACTIONS[form.id];
    if (!act) return;
    ev.preventDefault();
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    say("");
    try {
      await act(Object.fromEntries(new FormData(form)), form);
    } catch (e) {
      say(e.message || String(e), true);
    } finally {
      btn.disabled = false;
    }
  });

  async function signOut() {
    if (navigator.onLine) await Sync.syncNow();
    const n = Store.pendingCount();
    if (n && !confirm(`${n} change${n > 1 ? "s have" : " has"} not uploaded yet. ${n > 1 ? "They stay" : "It stays"} on this device and ${n > 1 ? "upload" : "uploads"} the next time you sign in here. Sign out anyway?`)) return;
    await Sync.signOut();
    mode = "signin";
    msg = null;
    coaches = { uid: null, list: null, error: "" };
    if (location.hash === "#/account") route();
    else location.hash = "#/account";
  }

  root.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-acct], [data-acct-mode], [data-acct-unlink]");
    if (!b) return;
    ev.preventDefault();
    const ds = b.dataset;
    try {
      if (ds.acctMode) {
        mode = ds.acctMode;
        msg = null;
        return render();
      }
      if (ds.acctUnlink) {
        if (!confirm("Unlink this coach? They lose access to your log.")) return;
        await Sync.unlinkCoach(ds.acctUnlink);
        coaches = { uid: null, list: null, error: "" };
        return render();
      }
      switch (ds.acct) {
        case "local":
          localStorage.setItem(LOCAL_OK, "1");
          location.hash = "#/train";
          return;
        case "sync":
          b.disabled = true;
          await Sync.syncNow();
          return render();
        case "signout":
          return await signOut();
        case "resend":
          await Sync.resendCode(email);
          return say("New code sent.");
        case "copy":
          await navigator.clipboard.writeText(Sync.profile.coach_code);
          return say("Code copied.");
      }
    } catch (e) {
      say(e.message || String(e), true);
    }
  });

  /* ---------- First sign-in: upload the signed-out log ---------- */

  function offerLocal(local) {
    offered = local;
    const parts = [`${local.sessions} workout${local.sessions === 1 ? "" : "s"}`, `${local.checkins} check-in${local.checkins === 1 ? "" : "s"}`];
    if (local.draft) parts.push("a workout in progress");
    sheet.innerHTML = `<div class="sheet">
      <div class="mono muted">Found on this device</div>
      <h3>Upload your log?</h3>
      <p class="small">This browser has ${parts.join(", ")} saved without an account. Upload them to your account? They are added to what is already there. Nothing in your account is overwritten.</p>
      <p class="small muted">A backup copy stays in this browser either way.</p>
      <button class="btn acc full" data-acct="adopt">Upload to my account</button>
      <button class="btn full" data-acct="keep">Keep them separate</button>
    </div>`;
    sheet.classList.remove("hidden");
  }

  sheet.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-acct]");
    if (!b || !offered) return;
    if (b.dataset.acct === "adopt") Sync.adoptLocal();
    else if (b.dataset.acct === "keep") Sync.declineLocal(offered);
    else return;
    offered = null;
    closeModal();
    rerender();
  });

  return {
    render, pill, refreshStatus, offerLocal, wantsAuth,
    recover() {
      recovery = true;
      location.hash = "#/account";
    },
  };
})();
