/* In-app dialogs that replace the browser's confirm() and alert(). All return Promises. */
const UI = (() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  let close = null;

  /* buttons: [{ label, value, kind: "acc" | "danger" | "" }]. Resolves with the value, or null when dismissed. */
  function choose({ title = "", text = "", buttons }) {
    if (close) close(null);
    return new Promise((resolve) => {
      const el = document.createElement("div");
      el.className = "modal dlg";
      el.innerHTML = `<div class="sheet" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t">
        ${title ? `<h3 id="dlg-t">${esc(title)}</h3>` : ""}
        ${text ? `<p class="muted">${esc(text)}</p>` : ""}
        <div class="dlg-actions">${buttons.map((b, i) => `<button class="btn full ${b.kind || ""}" data-i="${i}">${esc(b.label)}</button>`).join("")}</div>
      </div>`;
      const onKey = (ev) => { if (ev.key === "Escape") done(null); };
      const done = (v) => {
        close = null;
        document.removeEventListener("keydown", onKey);
        el.remove();
        resolve(v);
      };
      el.addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-i]");
        if (b) done(buttons[+b.dataset.i].value);
        else if (ev.target === el) done(null);
      });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(el);
      close = done;
      const first = el.querySelector(".acc, .danger") || el.querySelector("button");
      if (first) first.focus({ preventScroll: true });
    });
  }

  const ask = ({ title, text, ok = "OK", cancel = "Cancel", danger = false }) =>
    choose({ title, text, buttons: [{ label: ok, value: true, kind: danger ? "danger" : "acc" }, { label: cancel, value: false }] }).then(Boolean);

  const tell = (title, text = "") => choose({ title, text, buttons: [{ label: "OK", value: true, kind: "acc" }] });

  return { choose, ask, tell };
})();
