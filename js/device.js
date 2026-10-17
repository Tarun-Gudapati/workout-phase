/* Phone integration: screen wake lock, haptic and sound cues, install prompt. Everything no-ops where unsupported. */

const Device = (() => {
  const INSTALL_KEY = "bt.install.dismissed";

  /* ---------- Wake lock ---------- */

  let lock = null;
  let wantLock = false;

  async function acquire() {
    if (!wantLock || lock || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    try {
      const l = await navigator.wakeLock.request("screen");
      if (!wantLock) return void l.release().catch(() => {});
      lock = l;
      l.addEventListener("release", () => {
        if (lock === l) lock = null;
      });
    } catch (e) {
      lock = null;
    }
  }

  function keepAwake(on) {
    wantLock = !!on;
    if (wantLock) return void acquire();
    if (lock) {
      const l = lock;
      lock = null;
      l.release().catch(() => {});
    }
  }

  /* The browser drops the lock whenever the page is hidden. */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") acquire();
  });

  /* ---------- Haptics and sound ---------- */

  const canVibrate = typeof navigator.vibrate === "function";
  const PATTERNS = { set: 30, rest: [90, 60, 90] };
  let audio = null;

  /* iOS only allows audio that was started from a tap, so the context is created on the first tap. */
  function unlockAudio() {
    if (audio || !Store.db.settings.sound) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      audio = new Ctx();
    } catch (e) {
      audio = null;
    }
  }

  function beep() {
    if (!audio) return;
    if (audio.state === "suspended") audio.resume().catch(() => {});
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  function cue(kind) {
    const s = Store.db.settings;
    if (canVibrate && s.vibrate !== false) {
      try {
        navigator.vibrate(PATTERNS[kind] || 30);
      } catch (e) {}
    }
    if (kind === "rest" && s.sound) beep();
  }

  /* ---------- Install ---------- */

  let deferred = null;
  let onChange = () => {};

  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    onChange();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    localStorage.setItem(INSTALL_KEY, "installed");
    onChange();
  });

  const SHARE_ICON = `<svg class="share-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l4 4-1.4 1.4L13 6.8V15h-2V6.8L9.4 8.4 8 7zM5 10h3v2H7v8h10v-8h-1v-2h3v12H5z"/></svg>`;

  function installCard() {
    if (standalone() || localStorage.getItem(INSTALL_KEY)) return "";
    const close = `<button class="link" data-act="install-dismiss">Not now</button>`;
    if (deferred) {
      return `<section class="panel install">
        <div class="install-head"><b>Install Beyond Training</b>${close}</div>
        <p class="small muted">Open it from your home screen, full screen and offline in the gym.</p>
        <button class="btn acc full" data-act="install">Install app</button>
      </section>`;
    }
    if (isIos()) {
      return `<section class="panel install">
        <div class="install-head"><b>Add to your home screen</b>${close}</div>
        <p class="small muted">Open it full screen and offline in the gym.</p>
        <ol class="install-steps small"><li>Tap Share ${SHARE_ICON} in the browser bar.</li><li>Tap <b>Add to Home Screen</b>.</li></ol>
      </section>`;
    }
    return "";
  }

  async function install() {
    if (!deferred) return;
    const e = deferred;
    deferred = null;
    try {
      await e.prompt();
      const r = await e.userChoice;
      if (r && r.outcome === "accepted") localStorage.setItem(INSTALL_KEY, "installed");
    } catch (err) {}
    onChange();
  }

  function dismissInstall() {
    localStorage.setItem(INSTALL_KEY, "dismissed");
    onChange();
  }

  return {
    keepAwake, cue, unlockAudio, beep, canVibrate,
    installCard, install, dismissInstall, standalone, isIos,
    get awake() { return !!lock; },
    onInstallChange(fn) { onChange = fn; },
  };
})();
