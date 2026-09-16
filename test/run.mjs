// Uçtan uca regresyon testi (Playwright). Her revizeden sonra çalıştırılır:
//   node test/run.mjs
// Gerçek Firebase'e bağlanmaz; test/mock-firebase.js kullanılır.
// Akışın kendisi test/suite.mjs içindedir; Node olmayan makinede aynı akış
// test/runner.html ile tarayıcıda koşar.

let chromium;
for (const p of [process.env.PLAYWRIGHT_PATH, "playwright",
                 "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs"]) {
  if (!p) continue;
  try { ({ chromium } = await import(p)); break; } catch (e) {}
}
if (!chromium) {
  console.error("Playwright bulunamadı. Kurulum: npm i -D playwright");
  process.exit(1);
}

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runSuite } from "./suite.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json" };
const BASE = "http://localhost:4173/";

const server = http.createServer(function (req, res) {
  const url = req.url.split("?")[0];
  if (url === "/favicon.ico") { res.writeHead(204); res.end(); return; }
  const p = path.join(ROOT, decodeURIComponent(url));
  fs.readFile(p, function (err, buf) {
    if (err) { res.writeHead(404); res.end("404"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
    res.end(buf);
  });
});
await new Promise(function (r) { server.listen(4173, r); });

// Önceden kurulmuş Chromium varsa (inceleme ortamı) o kullanılır; yoksa Playwright'ın
// kendi indirdiği tarayıcı (GitHub Actions: npx playwright install chromium).
const PRESET_CHROMIUM = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium";
const browser = await chromium.launch(fs.existsSync(PRESET_CHROMIUM) ? { executablePath: PRESET_CHROMIUM } : {});
const errors = [];
let pass = 0, fail = 0;

const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.on("pageerror", function (e) { errors.push(e.message); });
page.on("console", function (m) { if (m.type() === "error") errors.push("console: " + m.text()); });

const driver = {
  ok: function (label, cond, extra) {
    if (cond) { pass++; console.log("  ✓ " + label); }
    else { fail++; console.log("  ✗ " + label + (extra ? "  → " + extra : "")); }
  },
  section: function (title) { console.log("\n" + title); },
  goto: async function (url) { await page.goto(BASE + url); await page.waitForTimeout(900); },
  click: (s) => page.click(s),
  fill: (s, v) => page.fill(s, v),
  change: (s) => page.dispatchEvent(s, "change"),
  select: (s, v) => page.selectOption(s, v),
  press: (s, k) => page.press(s, k),
  wait: (ms) => page.waitForTimeout(ms),
  db: () => page.evaluate(() => window.__MOCK_DB__),
  text: (s) => page.textContent(s),
  count: (s) => page.locator(s).count(),
  prop: (s, p) => page.$eval(s, (el, name) => el[name], p),
  eval: (fn) => page.evaluate(fn),
  fetchText: async (url) => (await fetch(BASE + url)).text(),
  errors: () => errors.slice()
};

try {
  await runSuite(driver);
} catch (e) {
  fail++;
  console.log("  ✗ senaryo çöktü  → " + ((e && e.stack) || e));
}

await page.close();
await browser.close();
server.close();
console.log("\n" + pass + " geçti, " + fail + " kaldı\n");
process.exit(fail ? 1 : 0);
