// Injected into the page on every observation. Tags visible interactive elements with
// data-apx-ref="eN" and returns a compact description the model can act on.
(maxText) => {
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || s.opacity === "0") return false;
    if (el.closest("[hidden], [aria-hidden='true']")) return false;
    return true;
  };
  const clean = (t) => (t || "").replace(/\s+/g, " ").trim();
  const roleOf = (el) => {
    const explicit = el.getAttribute("role");
    if (explicit) return explicit;
    const t = el.tagName.toLowerCase();
    if (t === "a") return el.hasAttribute("href") ? "link" : "generic";
    if (t === "button" || t === "summary") return "button";
    if (t === "select") return "combobox";
    if (t === "textarea") return "textbox";
    if (t === "input") {
      const ty = (el.getAttribute("type") || "text").toLowerCase();
      if (ty === "checkbox") return "checkbox";
      if (ty === "radio") return "radio";
      if (ty === "submit" || ty === "button" || ty === "reset" || ty === "image") return "button";
      if (ty === "number") return "spinbutton";
      if (ty === "range") return "slider";
      if (ty === "hidden") return "hidden";
      return "textbox";
    }
    return t;
  };
  const nameOf = (el) => {
    const al = el.getAttribute("aria-label");
    if (al && clean(al)) return clean(al);
    const lb = el.getAttribute("aria-labelledby");
    if (lb) {
      const t = lb.split(/\s+/).map((id) => (document.getElementById(id) || {}).innerText || "").join(" ");
      if (clean(t)) return clean(t);
    }
    if (el.id) {
      try {
        const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (l && clean(l.innerText)) return clean(l.innerText);
      } catch (e) {}
    }
    const parentLabel = el.closest("label");
    if (parentLabel && clean(parentLabel.innerText)) return clean(parentLabel.innerText).slice(0, 80);
    const t = el.tagName.toLowerCase();
    if (t === "input" && ["submit", "button", "reset"].includes((el.type || "").toLowerCase())) return clean(el.value);
    const ph = el.getAttribute("placeholder");
    if (ph && clean(ph)) return clean(ph);
    const title = el.getAttribute("title");
    if (title && clean(title)) return clean(title);
    const img = el.querySelector("img[alt]");
    if (img && clean(img.alt)) return clean(img.alt);
    return clean(el.innerText || el.textContent).slice(0, 80);
  };

  document.querySelectorAll("[data-apx-ref]").forEach((el) => el.removeAttribute("data-apx-ref"));
  const selector = [
    "a[href]", "button", "input", "select", "textarea", "summary",
    "[role='button']", "[role='link']", "[role='tab']", "[role='menuitem']", "[role='checkbox']",
    "[role='radio']", "[role='switch']", "[role='option']", "[role='combobox']", "[onclick]",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  const seen = new Set();
  const elements = [];
  let i = 0;
  for (const el of document.querySelectorAll(selector)) {
    if (seen.has(el) || !isVisible(el)) continue;
    seen.add(el);
    const role = roleOf(el);
    if (role === "hidden") continue;
    const ref = "e" + ++i;
    el.setAttribute("data-apx-ref", ref);
    const item = { ref, role, name: nameOf(el) };
    const t = el.tagName.toLowerCase();
    if (t === "input" || t === "textarea" || t === "select") {
      const ty = (el.getAttribute("type") || "").toLowerCase();
      if (ty === "checkbox" || ty === "radio") item.checked = !!el.checked;
      else if (ty === "password") item.value = el.value ? "(filled)" : "";
      else item.value = String(el.value || "").slice(0, 100);
      if (t === "select") item.options = Array.from(el.options).slice(0, 20).map((o) => o.label || o.value);
    }
    if (el.disabled || el.getAttribute("aria-disabled") === "true") item.disabled = true;
    if (t === "a") item.href = el.getAttribute("href");
    elements.push(item);
    if (elements.length >= 150) break;
  }
  const headings = Array.from(document.querySelectorAll("h1,h2,h3"))
    .filter(isVisible)
    .map((h) => h.tagName.toLowerCase() + ": " + clean(h.innerText).slice(0, 120))
    .slice(0, 30);
  const alerts = Array.from(document.querySelectorAll("[role='alert'],[role='status'],[aria-live]"))
    .filter(isVisible)
    .map((a) => clean(a.innerText))
    .filter(Boolean)
    .slice(0, 10);
  let text = (document.body && document.body.innerText) || "";
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const truncated = text.length > maxText;
  return {
    url: location.href,
    title: document.title,
    headings,
    alerts,
    elements,
    text: truncated ? text.slice(0, maxText) + "\n…[truncated]" : text,
  };
}
