// Uçtan uca regresyon testi. Her revizeden sonra çalıştırılır:
//   node test/run.mjs
// Gerçek Firebase'e bağlanmaz; test/mock-firebase.js kullanılır.

// Playwright nerede kuruluysa oradan yüklenir.
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

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

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const errors = [];
let pass = 0, fail = 0;

function ok(label, cond, extra) {
  if (cond) { pass++; console.log("  ✓ " + label); }
  else { fail++; console.log("  ✗ " + label + (extra ? "  → " + extra : "")); }
}

const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.on("pageerror", function (e) { errors.push(e.message); });
page.on("console", function (m) { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.goto("http://localhost:4173/test/index.html");
await page.waitForTimeout(900);

const db = () => page.evaluate(() => window.__MOCK_DB__);
const txt = (sel) => page.textContent(sel);
const toastText = () => page.evaluate(() => { const t = document.getElementById("toast"); return t && !t.hidden ? t.textContent : ""; });

console.log("\n1) Giriş ve kurulum");
ok("yetkili kullanıcı uygulamaya girdi", (await txt("body")).includes("Kurulum"), await txt("h1"));
await page.click("[data-doseed]");
await page.waitForTimeout(600);
let d = await db();
ok("33 adımlık katalog yazıldı", (d["config/catalog"]?.steps || []).length === 33, String((d["config/catalog"]?.steps || []).length));
ok("7 departman yazıldı", (d["config/org"]?.departments || []).length === 7);
ok("yönetici personel kaydı açıldı", (d["config/org"]?.people || []).length === 1);

console.log("\n2) Proje oluşturma");
await page.click('[data-nav="yeni"]'); await page.waitForTimeout(300);
await page.fill("#w-name", "Menemen Belediyesi");
await page.fill("#w-theme", "ORMAN");
await page.fill("#w-dueDate", "2026-11-20");
await page.click('[data-wnext="2"]'); await page.waitForTimeout(300);
await page.click('[data-pick="s-cizim"]');
await page.click('[data-pick="s-metal"]');
await page.click('[data-pick="s-aktivite"]');
await page.click('[data-wnext="3"]'); await page.waitForTimeout(300);
const row = page.locator('[data-wrow="s-aktivite"]');
await row.locator('[data-wf="qty"]').fill("10");
await row.locator('[data-wf="qty"]').dispatchEvent("change");
await page.click("[data-wsave]"); await page.waitForTimeout(700);
d = await db();
const projKeys = Object.keys(d).filter(k => k.startsWith("projects/"));
const taskKeys = Object.keys(d).filter(k => k.startsWith("tasks/"));
ok("proje kaydedildi", projKeys.length === 1);
ok("3 iş emri kaydedildi", taskKeys.length === 3, String(taskKeys.length));
ok("proje detayına geçildi", (await txt("h1")).includes("Menemen"));

console.log("\n3) Gereken / yapılan adet kuralı");
const amKey = taskKeys.find(k => d[k].stepId === "s-aktivite");
const amId = amKey.split("/")[1];
const amRow = page.locator(`[data-task="${amId}"]`);
await amRow.locator("[data-toggle]").click(); await page.waitForTimeout(350);
d = await db();
ok("eksik adetle tamamlanmadı", d[amKey].status !== "tamam", d[amKey].status);
ok("uyarı mesajı çıktı", (await toastText()).includes("eksik") || (await toastText()).includes("adedi girin"));
await amRow.locator('[data-f="doneQty"]').fill("5");
await amRow.locator('[data-f="doneQty"]').dispatchEvent("change"); await page.waitForTimeout(350);
await amRow.locator("[data-toggle]").click(); await page.waitForTimeout(350);
d = await db();
ok("5/10 iken hâlâ tamamlanmıyor", d[amKey].status !== "tamam");
await amRow.locator("[data-qall]").click(); await page.waitForTimeout(400);
d = await db();
ok("“tümü” yapılanı 10 yaptı", String(d[amKey].doneQty) === "10", String(d[amKey].doneQty));
await amRow.locator("[data-toggle]").click(); await page.waitForTimeout(400);
d = await db();
ok("10/10 olunca tamamlandı", d[amKey].status === "tamam");
ok("tamamlayan kişi kaydedildi", !!d[amKey].completedByName);

console.log("\n4) Gereken artınca yeniden açılma");
await amRow.locator('[data-f="qty"]').fill("15");
await amRow.locator('[data-f="qty"]').dispatchEvent("change"); await page.waitForTimeout(400);
d = await db();
ok("adım yeniden açıldı", d[amKey].status === "devam", d[amKey].status);

console.log("\n5) Eksik kapatma (yönetici)");
await amRow.locator("[data-shortclose]").click(); await page.waitForTimeout(400);
d = await db();
ok("eksik kapatıldı", d[amKey].status === "tamam" && d[amKey].shortClosed === true);

console.log("\n6) Personel ekleme ve giriş yetkisi");
await page.click('[data-nav="ayarlar"]'); await page.waitForTimeout(350);
await page.click("[data-addperson]"); await page.waitForTimeout(250);
await page.fill("#m-name", "Ayşe Yılmaz");
await page.fill("#m-email", "ayse@toysmar.test");
await page.selectOption("#m-role", "personel");
await page.click("[data-msave]"); await page.waitForTimeout(600);
d = await db();
ok("personel listeye eklendi", (d["config/org"]?.people || []).some(p => p.name === "Ayşe Yılmaz"));
ok("giriş yetkisi verildi", !!d["allowed/ayse@toysmar.test"], Object.keys(d).filter(k => k.startsWith("allowed/")).join(","));
ok("rolü personel", d["allowed/ayse@toysmar.test"]?.role === "personel");

console.log("\n7) Departman ve katalog adımı ekleme");
await page.click("[data-adddept]"); await page.waitForTimeout(250);
await page.fill("#m-name", "Kaynak");
await page.click("[data-msave]"); await page.waitForTimeout(500);
d = await db();
ok("departman eklendi", (d["config/org"]?.departments || []).some(x => x.name === "Kaynak"));
await page.click("[data-addstep]"); await page.waitForTimeout(250);
await page.fill("#m-name", "Elektrik Tesisatı");
await page.selectOption("#m-type", "qty");
await page.fill("#m-unit", "metre");
await page.click("[data-msave]"); await page.waitForTimeout(500);
d = await db();
ok("katalog adımı eklendi", (d["config/catalog"]?.steps || []).some(x => x.name === "Elektrik Tesisatı"));

console.log("\n8) Arşivleme — veri silinmiyor");
await page.click('[data-nav="projeler"]'); await page.waitForTimeout(350);
const pid = projKeys[0].split("/")[1];
await page.click(`[data-arch="${pid}"]`); await page.waitForTimeout(500);
d = await db();
ok("proje arşivlendi", d[projKeys[0]].archived === true);
ok("iş emirleri duruyor", Object.keys(d).filter(k => k.startsWith("tasks/")).length === 3);
ok("arşivli proje listeden düştü", !(await txt("#main")).includes("Menemen"));
await page.click("[data-togglearch]"); await page.waitForTimeout(350);
ok("arşiv görünümünde geri geldi", (await txt("#main")).includes("Menemen"));

console.log("\n9) Değişiklik günlüğü");
d = await db();
const logs = Object.keys(d).filter(k => k.startsWith("log/"));
ok("günlüğe kayıt yazıldı", logs.length > 5, String(logs.length));
ok("kayıtta kullanıcı var", !!d[logs[0]].byName);
await page.click('[data-nav="kayitlar"]'); await page.waitForTimeout(600);
ok("kayıtlar ekranı doluyor", (await txt("#main")).includes("proje-olustur") || (await txt("#main")).includes("is-emri"));

console.log("\n10b) Teklif hazırlama ve yazdırma");
await page.goto("http://localhost:4173/test/index.html");
await page.waitForTimeout(1200);
await page.click("[data-nav=teklifler]");
await page.waitForTimeout(500);
const seed = await page.$("[data-qseed]");
if (seed) { await seed.click(); await page.waitForTimeout(1200); }
ok("teklif katalogu yüklendi", !!(await page.$("[data-qnew]")));
await page.click("[data-qnew]");
await page.waitForTimeout(700);
await page.fill("[data-qf='customer.company']", "Deneme Oyun A.Ş.");
await page.waitForTimeout(200);
const prod = await page.$("[data-qaddprod]");
if (prod) { await prod.click(); await page.waitForTimeout(500); }
ok("müşteri bilgisi girildi", (await page.inputValue("[data-qf='customer.company']")).includes("Deneme"));
await page.click("[data-qpreview]");
await page.waitForTimeout(800);
ok("önizleme açıldı", !!(await page.$("[data-qprint]")));
await page.evaluate(function () {
  window.__printed = false;
  window.print = function () { window.__printed = true; };
});
await page.click("[data-qprint]");
await page.waitForTimeout(300);
ok("yazdırma tetiklendi", await page.evaluate(function () { return window.__printed === true; }));
const src = await (await fetch("http://localhost:4173/js/quote-app.js")).text();
ok("doPrint senkron kaldı", /\n\s*function doPrint\s*\(/.test(src) && !/async function doPrint\s*\(/.test(src),
   "Safari print() cagrisini dokunus baglami disinda yok sayar");


console.log("\n10) Giriş kapısı");
await page.goto("http://localhost:4173/test/index.html?as=yabanci@baska.test");
await page.waitForTimeout(900);
ok("listede olmayan hesap reddedildi", (await txt("body")).includes("Erişim izni iste"), await txt("h1"));
ok("reddedilen hesabın e-postası gösteriliyor", (await txt("body")).includes("yabanci@baska.test"));
await page.goto("http://localhost:4173/test/index.html?as=ayse@toysmar.test");
await page.waitForTimeout(900);
ok("yetkili personel girebildi", !(await txt("body")).includes("Erişim yetkiniz yok"), await txt("h1"));
ok("personelde yönetici menüsü yok", !(await txt("#nav")).includes("Ayarlar"), await txt("#nav"));
await page.goto("http://localhost:4173/test/index.html?as=yok");
await page.waitForTimeout(900);
ok("çıkış yapılmışsa giriş ekranı", (await txt("body")).includes("Google ile giriş"));

console.log("\n11) Şifreyle hesap açma ve erişim talebi");
ok("giriş ekranında şifre alanı var", (await page.locator("#form-login #g-pass").count()) === 1);
await page.click('[data-gate="talep"]'); await page.waitForTimeout(300);
await page.fill("#g-name", "Mehmet Demir");
await page.fill("#g-email", "mehmet@toysmar.test");
await page.fill("#g-gorev", "Kaynak ustası");
await page.fill("#g-pass", "sifre123");
await page.fill("#g-pass2", "sifre123");
await page.click('#form-request button[type="submit"]'); await page.waitForTimeout(700);
ok("doğrulama ekranına geçildi", (await txt("body")).includes("doğrulayın"), await txt("h1"));
d = await db();
ok("doğrulanmadan talep yazılmadı", !d["requests/mehmet@toysmar.test"]);
await page.evaluate(() => window.__MOCK_VERIFY__("mehmet@toysmar.test"));
await page.click("#btn-verified"); await page.waitForTimeout(800);
d = await db();
const req = d["requests/mehmet@toysmar.test"];
ok("doğrulanınca talep yazıldı", !!req);
ok("talepte görev var", req?.gorev === "Kaynak ustası", String(req?.gorev));
ok("talep bekliyor durumunda", req?.status === "bekliyor");
ok("kullanıcı bekleme ekranında", (await txt("body")).includes("Talebiniz iletildi"), await txt("h1"));

console.log("\n12) Yönetici talebi göreve göre rolle onaylar");
await page.goto("http://localhost:4173/test/index.html");
await page.waitForTimeout(900);
ok("yöneticide Talepler menüsü var", (await txt("#nav")).includes("Talepler"), await txt("#nav"));
await page.click('[data-nav="talepler"]'); await page.waitForTimeout(400);
ok("bekleyen talep listelendi", (await txt("#main")).includes("Mehmet Demir"));
ok("başvuranın görevi gösteriliyor", (await txt("#main")).includes("Kaynak ustası"));
await page.selectOption('[data-reqrole="mehmet@toysmar.test"]', "sef");
await page.click('[data-approve="mehmet@toysmar.test"]'); await page.waitForTimeout(900);
d = await db();
ok("giriş yetkisi verildi", !!d["allowed/mehmet@toysmar.test"]);
ok("seçilen rol yazıldı", d["allowed/mehmet@toysmar.test"]?.role === "sef", String(d["allowed/mehmet@toysmar.test"]?.role));
ok("personel kaydı açıldı", (d["config/org"]?.people || []).some(p => p.name === "Mehmet Demir"));
ok("talep onaylandı olarak kapandı", d["requests/mehmet@toysmar.test"]?.status === "onaylandi");

console.log("\n13) Rol hangi ekranları açıyor");
await page.goto("http://localhost:4173/test/index.html?as=mehmet@toysmar.test");
await page.waitForTimeout(900);
let nav = await txt("#nav");
ok("şef Panel görüyor", nav.includes("Panel"), nav);
ok("şefte Yeni Proje yok", !nav.includes("Yeni Proje"), nav);
ok("şefte Kayıtlar yok", !nav.includes("Kayıtlar"), nav);
ok("şefte Ayarlar yok", !nav.includes("Ayarlar"), nav);
ok("şefte Talepler yok", !nav.includes("Talepler"), nav);
await page.goto("http://localhost:4173/test/index.html?as=ayse@toysmar.test");
await page.waitForTimeout(900);
nav = await txt("#nav");
ok("personelde Panel yok", !nav.includes("Panel"), nav);
ok("personel İşlerim görüyor", nav.includes("İşlerim"), nav);

console.log("\n14) Şifreyle giriş");
await page.goto("http://localhost:4173/test/index.html?as=yok");
await page.waitForTimeout(800);
await page.fill("#g-email", "mehmet@toysmar.test");
await page.fill("#g-pass", "sifre123");
await page.click('#form-login button[type="submit"]'); await page.waitForTimeout(900);
ok("doğru şifreyle girildi", !(await txt("body")).includes("Erişim izni iste") && (await txt("#nav")).includes("Projeler"), await txt("h1"));
await page.goto("http://localhost:4173/test/index.html?as=yok");
await page.waitForTimeout(800);
await page.fill("#g-email", "mehmet@toysmar.test");
await page.fill("#g-pass", "yanlissifre");
await page.click('#form-login button[type="submit"]'); await page.waitForTimeout(700);
ok("yanlış şifre reddedildi", /hatalı/i.test(await toastText()), await toastText());
ok("yanlış şifrede giriş ekranında kalındı", (await txt("body")).includes("Giriş yap"));

console.log("\nJS hataları: " + (errors.length ? errors.slice(0, 3).join(" | ") : "yok"));
if (errors.length) fail++;

await page.close();
await browser.close();
server.close();
console.log("\n" + pass + " geçti, " + fail + " kaldı\n");
process.exit(fail ? 1 : 0);
