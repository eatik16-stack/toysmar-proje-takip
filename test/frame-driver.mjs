// Tarayıcı içi test sürücüsü: uygulamayı bir iframe'de açar ve DOM'u doğrudan
// sürer. Node/Playwright olmayan makinede test/runner.html bunu kullanır.
// Sözleşme test/run.mjs içindeki Playwright sürücüsüyle aynıdır.
//
// eval(fn): fonksiyonun KAYNAĞI iframe'in kendi kapsamında çalıştırılır; böylece
// senaryolardaki `document`, `window`, `sessionStorage` uygulamanın penceresini
// gösterir. Fonksiyon dış değişkenlere kapanamaz (Playwright'ta da öyle).

export function frameDriver(frame, log) {
  const out = { pass: 0, fail: 0, fails: [] };
  const win = function () { return frame.contentWindow; };
  const doc = function () { return frame.contentDocument; };
  const $ = function (sel) {
    const el = doc().querySelector(sel);
    if (!el) throw new Error("bulunamadı: " + sel);
    return el;
  };
  const setValue = function (el, v) {
    const proto = el.tagName === "TEXTAREA" ? win().HTMLTextAreaElement.prototype : win().HTMLInputElement.prototype;
    const d = Object.getOwnPropertyDescriptor(proto, "value");
    if (d && d.set) d.set.call(el, v); else el.value = v;
    // Playwright'ın fill'i gibi: input ve ardından change.
    el.dispatchEvent(new (win().Event)("input", { bubbles: true }));
    el.dispatchEvent(new (win().Event)("change", { bubbles: true }));
  };
  const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  // Yollar site köküne göredir ("test/index.html"), koşucunun klasörüne göre değil.
  const abs = function (url) { return new URL(url, location.origin + "/").href; };

  return {
    results: out,
    ok: function (label, cond, extra) {
      if (cond) { out.pass++; if (log) log("  ✓ " + label); }
      else { out.fail++; out.fails.push(label); if (log) log("  ✗ " + label + (extra ? "  → " + extra : "")); }
    },
    section: function (title) { if (log) log("\n" + title); },
    goto: function (url) {
      return new Promise(function (resolve) {
        const done = function () { frame.removeEventListener("load", done); wait(900).then(resolve); };
        frame.addEventListener("load", done);
        frame.src = abs(url) + (url.indexOf("?") === -1 ? "?" : "&") + "_=" + Date.now();
      });
    },
    click: async function (sel) { $(sel).click(); },
    fill: async function (sel, v) { const el = $(sel); el.focus(); setValue(el, v); },
    change: async function (sel) { $(sel).dispatchEvent(new (win().Event)("change", { bubbles: true })); },
    select: async function (sel, v) {
      const el = $(sel); el.value = v;
      el.dispatchEvent(new (win().Event)("input", { bubbles: true }));
      el.dispatchEvent(new (win().Event)("change", { bubbles: true }));
    },
    press: async function (sel, key) {
      const el = $(sel);
      el.dispatchEvent(new (win().KeyboardEvent)("keydown", { key: key, bubbles: true, cancelable: true }));
    },
    wait: wait,
    db: async function () { return JSON.parse(JSON.stringify(win().__MOCK_DB__ || {})); },
    text: async function (sel) { const el = doc().querySelector(sel); return el ? el.textContent : ""; },
    count: async function (sel) { return doc().querySelectorAll(sel).length; },
    prop: async function (sel, p) { return $(sel)[p]; },
    eval: async function (fn) { return win().eval("(" + fn.toString() + ")()"); },
    fetchText: async function (url) { return (await fetch(abs(url))).text(); },
    errors: function () {
      try { return JSON.parse(sessionStorage.getItem("toysmar.testerrors") || "[]"); } catch (e) { return []; }
    }
  };
}
