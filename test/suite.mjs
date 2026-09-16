// Uçtan uca regresyon: tüm akışlar sırayla. Sürücüden bağımsızdır;
// test/run.mjs Playwright ile, test/runner.html tarayıcıdaki iframe ile çağırır.
//
// Sürücü sözleşmesi: ok, section, goto, click, fill, change, select, press,
// wait, db, text, count, prop, eval, fetchText, errors.

import { quoteScenario } from "./quote-scenario.mjs";
import { jobScenario } from "./job-scenario.mjs";
import { priceScenario } from "./price-scenario.mjs";
import { stepsScenario } from "./steps-scenario.mjs";
import { visibilityScenario } from "./visibility-scenario.mjs";

export async function runSuite(t) {
  const ok = t.ok;
  const APP = "test/index.html";
  const txt = t.text;
  const db = t.db;
  const toastText = function () {
    return t.eval(function () { const x = document.getElementById("toast"); return x && !x.hidden ? x.textContent : ""; });
  };

  await t.goto(APP);

  t.section("1) Giriş ve kurulum");
  ok("yetkili kullanıcı uygulamaya girdi", (await txt("body")).includes("Kurulum"), await txt("h1"));
  await t.click("[data-doseed]");
  await t.wait(600);
  let d = await db();
  ok("65 adımlık katalog yazıldı", (d["config/catalog"]?.steps || []).length === 65, String((d["config/catalog"]?.steps || []).length));
  ok("katalog sürümü 2", d["config/catalog"]?.version === 2, String(d["config/catalog"]?.version));
  ok("9 departman yazıldı", (d["config/org"]?.departments || []).length === 9, String((d["config/org"]?.departments || []).length));
  ok("Üretim Planlama dört bölüme ayrıldı", ((d["config/catalog"]?.sections || {})["d-uretim"] || []).length === 4);
  ok("yönetici personel kaydı açıldı", (d["config/org"]?.people || []).length === 1);
  ok("adım tipleri dörde çıktı", (d["config/catalog"].steps || []).some(function (s) { return s.type === "file"; }) &&
    (d["config/catalog"].steps || []).some(function (s) { return s.type === "text"; }));

  t.section("2) Proje oluşturma");
  await t.click('[data-nav="yeni"]'); await t.wait(300);
  await t.fill("#w-name", "Menemen Belediyesi");
  await t.click('[data-wnext="2"]'); await t.wait(300);
  ok("proje kodu olmadan ilerlenmiyor", (await t.count("#w-code")) === 1 && (await toastText()).includes("Proje kodu"));
  await t.fill("#w-code", "m1");
  await t.click('[data-wnext="2"]'); await t.wait(300);
  ok("kod 2-4 büyük harf olmalı", (await t.count("#w-code")) === 1 && (await toastText()).includes("büyük harf"));
  await t.fill("#w-code", "mb");
  ok("kod kendiliğinden büyük harfe çevrildi", (await t.prop("#w-code", "value")) === "MB");
  await t.fill("#w-company", "Menemen Belediyesi Fen İşleri");
  await t.fill("#w-contact", "0232 000 00 00");
  await t.fill("#w-salesperson", "BYM");
  await t.fill("#w-theme", "ORMAN");
  await t.fill("#w-dueDate", "2026-11-20"); await t.change("#w-dueDate");
  await t.click('[data-wnext="2"]'); await t.wait(300);
  ok("bölümlü departmanda adımlar bölüm başlığıyla listelendi", (await t.count("#main .sec-title")) >= 4, String(await t.count("#main .sec-title")));
  await t.click('[data-pick="t-2d"]');
  await t.click('[data-pick="u-metal-panel"]');
  await t.click('[data-pick="sa-aktivite-masa"]');
  await t.click('[data-wnext="3"]'); await t.wait(300);
  await t.fill('[data-wrow="sa-aktivite-masa"] [data-wf="qty"]', "10");
  await t.change('[data-wrow="sa-aktivite-masa"] [data-wf="qty"]');
  ok("atama ekranında bölümlü adımın bölüm seçicisi var", (await t.count('[data-wrow="u-metal-panel"] [data-wf="section"]')) === 1);
  await t.click("[data-wsave]"); await t.wait(700);
  d = await db();
  const projKeys = Object.keys(d).filter(function (k) { return k.startsWith("projects/"); });
  const taskKeys = Object.keys(d).filter(function (k) { return k.startsWith("tasks/"); });
  ok("proje kaydedildi", projKeys.length === 1);
  ok("3 iş emri kaydedildi", taskKeys.length === 3, String(taskKeys.length));
  ok("bölümlü adımın iş emri bölümüyle açıldı", taskKeys.some(function (k) { return d[k].stepId === "u-metal-panel" && d[k].section === "metal"; }));
  ok("proje detayına geçildi", (await txt("h1")).includes("Menemen"));
  ok("proje kodu ve yeni alanlar kaydedildi", d[projKeys[0]].code === "MB" && d[projKeys[0]].company === "Menemen Belediyesi Fen İşleri" &&
    d[projKeys[0]].salesperson === "BYM" && d[projKeys[0]].contact === "0232 000 00 00", JSON.stringify(d[projKeys[0]]));
  ok("panel sayısı alanı projeden kalktı", d[projKeys[0]].panelCount === undefined);
  ok("kartta kod ve cari unvan görünüyor", (await txt("#main h1")).includes("MB") && (await txt("#main")).includes("Fen İşleri"));
  ok("iş emirleri departman · bölüm bantlarıyla gruplandı", (await txt("#main")).includes("Üretim Planlama · Metal"));

  t.section("2b) Proje kodu benzersiz, muhasebe sekmesi");
  await t.click('[data-nav="yeni"]'); await t.wait(300);
  await t.fill("#w-code", "MB"); await t.fill("#w-name", "Kopya kod");
  await t.click('[data-wnext="2"]'); await t.wait(300);
  ok("aynı kodla ikinci proje açılamıyor", (await t.count("#w-code")) === 1 && (await toastText()).includes("başka bir projede"));
  await t.click('[data-nav="projeler"]'); await t.wait(300);
  ok("proje listesinde kod sütunu var", (await txt("#main thead")).includes("Kod") && (await txt("#main tbody")).includes("MB"));
  await t.click('[data-open-proj="' + projKeys[0].split("/")[1] + '"]'); await t.wait(300);
  ok("yöneticide Muhasebe sekmesi var", (await t.count('[data-ptab="muhasebe"]')) === 1);
  await t.click('[data-ptab="muhasebe"]'); await t.wait(300);
  await t.fill("#acc-total", "3100000");
  await t.select("#acc-shippingIncluded", "dahil");
  await t.select("#acc-installIncluded", "haric");
  await t.fill("#acc-shippingNote", "gümrük dahil");
  await t.fill("#acc-paymentDetail", "ön ödeme 1 milyon, kalan 8 senet");
  await t.click("[data-accsave]"); await t.wait(500);
  d = await db();
  const acc = d["accounting/" + projKeys[0].split("/")[1]];
  ok("muhasebe bilgileri ayrı koleksiyona yazıldı", !!acc && acc.total === "3100000" && acc.shippingIncluded === "dahil" &&
    acc.installIncluded === "haric" && acc.paymentDetail.indexOf("senet") !== -1, JSON.stringify(acc));
  ok("proje belgesine muhasebe bilgisi karışmadı", d[projKeys[0]].total === undefined && d[projKeys[0]].accounting === undefined);
  ok("muhasebe kaydı günlüğe yazıldı", Object.keys(d).some(function (k) { return k.startsWith("log/") && d[k].action === "muhasebe"; }));
  await t.click('[data-edit-proj]'); await t.wait(300);
  await t.fill("#m-code", "MB2");
  await t.click("[data-msave]"); await t.wait(300);
  ok("düzenlemede geçersiz kod reddedildi", (await t.count("#modal-root #m-code")) === 1);
  await t.fill("#m-code", "MBP");
  await t.fill("#m-drafter", "EMRE");
  await t.click("[data-msave]"); await t.wait(500);
  d = await db();
  ok("proje bilgileri düzenlendi (kod, çizim ve takip)", d[projKeys[0]].code === "MBP" && d[projKeys[0]].drafter === "EMRE");
  await t.click('[data-ptab="isler"]'); await t.wait(200);

  t.section("3) Gereken / yapılan adet kuralı");
  const amKey = taskKeys.find(function (k) { return d[k].stepId === "sa-aktivite-masa"; });
  const amId = amKey.split("/")[1];
  const amRow = '[data-task="' + amId + '"]';
  await t.click(amRow + " [data-toggle]"); await t.wait(350);
  d = await db();
  ok("eksik adetle tamamlanmadı", d[amKey].status !== "tamam", d[amKey].status);
  ok("uyarı mesajı çıktı", (await toastText()).includes("eksik") || (await toastText()).includes("adedi girin"));
  await t.fill(amRow + ' [data-f="doneQty"]', "5");
  await t.change(amRow + ' [data-f="doneQty"]'); await t.wait(350);
  await t.click(amRow + " [data-toggle]"); await t.wait(350);
  d = await db();
  ok("5/10 iken hâlâ tamamlanmıyor", d[amKey].status !== "tamam");
  await t.click(amRow + " [data-qall]"); await t.wait(400);
  d = await db();
  ok("“tümü” yapılanı 10 yaptı", String(d[amKey].doneQty) === "10", String(d[amKey].doneQty));
  await t.click(amRow + " [data-toggle]"); await t.wait(400);
  d = await db();
  ok("10/10 olunca tamamlandı", d[amKey].status === "tamam");
  ok("tamamlayan kişi kaydedildi", !!d[amKey].completedByName);

  t.section("4) Gereken artınca yeniden açılma");
  await t.fill(amRow + ' [data-f="qty"]', "15");
  await t.change(amRow + ' [data-f="qty"]'); await t.wait(400);
  d = await db();
  ok("adım yeniden açıldı", d[amKey].status === "devam", d[amKey].status);

  t.section("5) Eksik kapatma (yönetici)");
  await t.click(amRow + " [data-shortclose]"); await t.wait(400);
  d = await db();
  ok("eksik kapatıldı", d[amKey].status === "tamam" && d[amKey].shortClosed === true);

  t.section("6) Personel ekleme ve giriş yetkisi");
  await t.click('[data-nav="ayarlar"]'); await t.wait(350);
  await t.click("[data-addperson]"); await t.wait(250);
  await t.fill("#m-name", "Ayşe Yılmaz");
  await t.select("#m-dept", "d-uretim"); await t.wait(100);
  ok("bölümlü departman seçilince bölüm alanı açıldı", !(await t.prop("#m-section-wrap", "hidden")));
  await t.select("#m-section", "metal");
  await t.fill("#m-email", "ayse@toysmar.test");
  await t.select("#m-role", "personel");
  await t.click("[data-msave]"); await t.wait(600);
  d = await db();
  const ayse = (d["config/org"]?.people || []).find(function (p) { return p.name === "Ayşe Yılmaz"; });
  ok("personel listeye eklendi", !!ayse);
  ok("personelin bölümü kaydedildi", !!ayse && ayse.dept === "d-uretim" && ayse.section === "metal");
  ok("giriş yetkisi verildi", !!d["allowed/ayse@toysmar.test"], Object.keys(d).filter(function (k) { return k.startsWith("allowed/"); }).join(","));
  ok("rolü personel, bölümü yetki kaydında da var", d["allowed/ayse@toysmar.test"]?.role === "personel" && d["allowed/ayse@toysmar.test"]?.section === "metal");

  t.section("7) Departman ve katalog adımı ekleme");
  await t.click("[data-adddept]"); await t.wait(250);
  await t.fill("#m-name", "Kaynak");
  await t.click("[data-msave]"); await t.wait(500);
  d = await db();
  ok("departman eklendi", (d["config/org"]?.departments || []).some(function (x) { return x.name === "Kaynak"; }));
  await t.click("[data-addstep]"); await t.wait(250);
  await t.fill("#m-name", "Elektrik Tesisatı");
  await t.select("#m-dept", "d-uretim"); await t.wait(100);
  await t.select("#m-section", "metal");
  await t.select("#m-type", "qty");
  await t.fill("#m-unit", "metre");
  await t.click("[data-msave]"); await t.wait(500);
  d = await db();
  const newStep = (d["config/catalog"]?.steps || []).find(function (x) { return x.name === "Elektrik Tesisatı"; });
  ok("katalog adımı eklendi", !!newStep);
  ok("adım bölümüyle kaydedildi, sürüm korundu", !!newStep && newStep.section === "metal" && d["config/catalog"].version === 2);

  t.section("8) Arşivleme — veri silinmiyor");
  await t.click('[data-nav="projeler"]'); await t.wait(350);
  const pid = projKeys[0].split("/")[1];
  await t.click('[data-arch="' + pid + '"]'); await t.wait(500);
  d = await db();
  ok("proje arşivlendi", d[projKeys[0]].archived === true);
  ok("iş emirleri duruyor", Object.keys(d).filter(function (k) { return k.startsWith("tasks/"); }).length === 3);
  ok("arşivli proje listeden düştü", !(await txt("#main")).includes("Menemen"));
  await t.click("[data-togglearch]"); await t.wait(350);
  ok("arşiv görünümünde geri geldi", (await txt("#main")).includes("Menemen"));

  t.section("9) Değişiklik günlüğü");
  d = await db();
  const logs = Object.keys(d).filter(function (k) { return k.startsWith("log/"); });
  ok("günlüğe kayıt yazıldı", logs.length > 5, String(logs.length));
  ok("kayıtta kullanıcı var", !!d[logs[0]].byName);
  await t.click('[data-nav="kayitlar"]'); await t.wait(600);
  ok("kayıtlar ekranı doluyor", (await txt("#main")).includes("proje-olustur") || (await txt("#main")).includes("is-emri"));

  t.section("10b) Teklif hazırlama ve yazdırma");
  await t.goto(APP);
  await t.wait(300);
  await t.click("[data-nav=teklifler]");
  await t.wait(500);
  if (await t.count("[data-qseed]")) { await t.click("[data-qseed]"); await t.wait(1200); }
  ok("teklif katalogu yüklendi", (await t.count("[data-qnew]")) === 1);
  await t.click("[data-qnew]");
  await t.wait(700);
  await t.fill("[data-qf='customer.company']", "Deneme Oyun A.Ş.");
  await t.wait(200);
  if (await t.count("[data-qaddprod]")) { await t.click("[data-qaddprod]"); await t.wait(500); }
  ok("müşteri bilgisi girildi", (await t.prop("[data-qf='customer.company']", "value")).includes("Deneme"));
  await t.click("[data-qpreview]");
  await t.wait(800);
  ok("önizleme açıldı", (await t.count("[data-qprint]")) >= 1);
  await t.eval(function () {
    window.__printed = false;
    window.print = function () { window.__printed = true; };
  });
  await t.click("[data-qprint]");
  await t.wait(300);
  ok("yazdırma tetiklendi", await t.eval(function () { return window.__printed === true; }));
  const src = await t.fetchText("js/quote-app.js");
  ok("doPrint senkron kaldı", /\n\s*function doPrint\s*\(/.test(src) && !/async function doPrint\s*\(/.test(src),
     "Safari print() cagrisini dokunus baglami disinda yok sayar");

  t.section("10) Giriş kapısı");
  await t.goto(APP + "?as=yabanci@baska.test");
  ok("listede olmayan hesap uygulamaya giremedi", (await t.count("#nav")) === 0);
  ok("listede olmayan hesaba erişim talebi formu çıktı", (await txt("h1")) === "Erişim izni iste", await txt("h1"));
  ok("reddedilen hesabın e-postası gösteriliyor", (await txt("body")).includes("yabanci@baska.test"));
  await t.goto(APP + "?as=ayse@toysmar.test");
  ok("yetkili personel girebildi", (await t.count("#nav")) === 1 && !(await txt("body")).includes("Erişim izni iste"), await txt("h1"));
  ok("personelde yönetici menüsü yok", !(await txt("#nav")).includes("Ayarlar"), await txt("#nav"));
  await t.click('[data-nav="projeler"]'); await t.wait(300);
  await t.click("[data-togglearch]"); await t.wait(300);
  await t.click('[data-open-proj="' + projKeys[0].split("/")[1] + '"]'); await t.wait(300);
  ok("personelde Muhasebe sekmesi yok, tutar görünmüyor", (await t.count('[data-ptab="muhasebe"]')) === 0 && !(await txt("#main")).includes("3100000"));
  ok("personel proje kartını görüyor", (await txt("#main h1")).includes("Menemen"));
  await t.goto(APP + "?as=yok");
  ok("çıkış yapılmışsa giriş ekranı", (await txt("body")).includes("Google ile giriş"));

  t.section("11) Şifreyle hesap açma ve erişim talebi");
  ok("giriş ekranında şifre alanı var", (await t.count("#form-login #g-pass")) === 1);
  await t.click('[data-gate="talep"]'); await t.wait(300);
  await t.fill("#g-name", "Mehmet Demir");
  await t.fill("#g-email", "mehmet@toysmar.test");
  await t.fill("#g-gorev", "Kaynak ustası");
  await t.fill("#g-pass", "sifre123");
  await t.fill("#g-pass2", "sifre123");
  await t.click('#form-request button[type="submit"]'); await t.wait(700);
  ok("doğrulama ekranına geçildi", (await txt("body")).includes("doğrulayın"), await txt("h1"));
  d = await db();
  ok("doğrulanmadan talep yazılmadı", !d["requests/mehmet@toysmar.test"]);
  await t.eval(function () { window.__MOCK_VERIFY__("mehmet@toysmar.test"); });
  await t.click("#btn-verified"); await t.wait(800);
  d = await db();
  const req = d["requests/mehmet@toysmar.test"];
  ok("doğrulanınca talep yazıldı", !!req);
  ok("talepte görev var", req?.gorev === "Kaynak ustası", String(req?.gorev));
  ok("talep bekliyor durumunda", req?.status === "bekliyor");
  ok("kullanıcı bekleme ekranında", (await txt("body")).includes("Talebiniz iletildi"), await txt("h1"));

  t.section("12) Yönetici talebi göreve göre rolle onaylar");
  await t.goto(APP);
  ok("yöneticide Talepler menüsü var", (await txt("#nav")).includes("Talepler"), await txt("#nav"));
  await t.click('[data-nav="talepler"]'); await t.wait(400);
  ok("bekleyen talep listelendi", (await txt("#main")).includes("Mehmet Demir"));
  ok("başvuranın görevi gösteriliyor", (await txt("#main")).includes("Kaynak ustası"));
  await t.select('[data-reqdept="mehmet@toysmar.test"]', "d-uretim");
  await t.select('[data-reqrole="mehmet@toysmar.test"]', "sef");
  await t.click('[data-approve="mehmet@toysmar.test"]'); await t.wait(900);
  d = await db();
  ok("giriş yetkisi verildi", !!d["allowed/mehmet@toysmar.test"]);
  ok("seçilen rol yazıldı", d["allowed/mehmet@toysmar.test"]?.role === "sef", String(d["allowed/mehmet@toysmar.test"]?.role));
  ok("seçilen departman yazıldı", d["allowed/mehmet@toysmar.test"]?.dept === "d-uretim", String(d["allowed/mehmet@toysmar.test"]?.dept));
  ok("personel kaydı açıldı", (d["config/org"]?.people || []).some(function (p) { return p.name === "Mehmet Demir"; }));
  ok("talep onaylandı olarak kapandı", d["requests/mehmet@toysmar.test"]?.status === "onaylandi");

  t.section("13) Rol hangi ekranları açıyor");
  await t.goto(APP + "?as=mehmet@toysmar.test");
  let nav = await txt("#nav");
  ok("şef Panel görüyor", nav.includes("Panel"), nav);
  ok("şefte Yeni Proje yok", !nav.includes("Yeni Proje"), nav);
  ok("şefte Kayıtlar yok", !nav.includes("Kayıtlar"), nav);
  ok("şefte Ayarlar yok", !nav.includes("Ayarlar"), nav);
  ok("şefte Talepler yok", !nav.includes("Talepler"), nav);
  await t.goto(APP + "?as=ayse@toysmar.test");
  nav = await txt("#nav");
  ok("personelde Panel yok", !nav.includes("Panel"), nav);
  ok("personel İşlerim görüyor", nav.includes("İşlerim"), nav);

  t.section("14) Şifreyle giriş");
  await t.goto(APP + "?as=yok");
  await t.fill("#g-email", "mehmet@toysmar.test");
  await t.fill("#g-pass", "sifre123");
  await t.click('#form-login button[type="submit"]'); await t.wait(900);
  ok("doğru şifreyle girildi", !(await txt("body")).includes("Erişim izni iste") && (await txt("#nav")).includes("Projeler"), await txt("h1"));
  await t.goto(APP + "?as=yok");
  await t.fill("#g-email", "mehmet@toysmar.test");
  await t.fill("#g-pass", "yanlissifre");
  await t.click('#form-login button[type="submit"]'); await t.wait(700);
  ok("yanlış şifre reddedildi", /hatalı/i.test(await toastText()), await toastText());
  ok("yanlış şifrede giriş ekranında kalındı", (await txt("body")).includes("Giriş yap"));

  t.section("15) Teklif modülü");
  await t.goto(APP);
  await quoteScenario(t);

  t.section("16) Fiyatlar yalnızca satış rollerinde");
  await t.eval(function () {
    const d = JSON.parse(sessionStorage.getItem("toysmar.mockdb") || "{}");
    d["allowed/satis@toysmar.test"] = { name: "Ayşe Satış", role: "satis", dept: "", personId: "" };
    sessionStorage.setItem("toysmar.mockdb", JSON.stringify(d));
    localStorage.setItem("toysmar.view", "teklifler");
  });
  await t.goto(APP + "?as=satis@toysmar.test");
  nav = await txt("#nav");
  ok("satış Teklifler görüyor", nav.includes("Teklifler"), nav);
  ok("satışta Panel ve Yeni Proje yok", !nav.includes("Panel") && !nav.includes("Yeni Proje"), nav);
  await t.click('[data-qfilter="tumu"]'); await t.wait(300);
  ok("satış teklif listesini okuyabiliyor", (await txt("#main")).includes("TKL-"), await txt("h1"));
  await t.eval(function () {
    const d = JSON.parse(sessionStorage.getItem("toysmar.mockdb") || "{}");
    const k = Object.keys(d).find(function (x) { return x.startsWith("quotes/") && d[x].customer && d[x].customer.company === "Deneme Oyun A.Ş."; });
    if (k) { d[k].status = "gonderildi"; d[k].sentAt = new Date().toISOString(); }
    sessionStorage.setItem("toysmar.mockdb", JSON.stringify(d));
  });
  await t.goto(APP + "?as=satis@toysmar.test");
  await t.click('[data-qfilter="gonderildi"]'); await t.wait(300);
  await t.click("tr[data-qopen]"); await t.wait(400);
  ok("satış gönderilmiş teklifi açtı", (await t.count("[data-qrevise]")) === 1, await txt("h1"));
  ok("satışta “Taslağa geri al” yok (yalnızca yönetici)", (await t.count('[data-confirm^="qback"]')) === 0);
  await t.eval(function () { localStorage.setItem("toysmar.view", "teklifler"); });
  await t.goto(APP + "?as=ayse@toysmar.test");
  nav = await txt("#nav");
  ok("personelde Teklifler yok", !nav.includes("Teklifler"), nav);
  ok("personel teklif ekranına zorla giremiyor", (await txt("h1")) !== "Teklifler", await txt("h1"));
  ok("personelde fiyat görünmüyor", !(await txt("body")).includes("₺"));

  t.section("17) Proje dışı iş emirleri");
  await t.eval(function () { localStorage.setItem("toysmar.view", "panel"); });
  await t.goto(APP);
  await jobScenario(t);
  await t.goto(APP + "?as=ayse@toysmar.test");
  nav = await txt("#nav");
  ok("personel Proje Dışı İşler sekmesini görüyor", nav.includes("Proje Dışı İşler"), nav);
  await t.click('[data-nav="projedisi"]'); await t.wait(400);
  ok("personel de başka departmana iş emri açabiliyor", (await t.count("[data-newjob]")) >= 1);

  t.section("18) Fiyat listesi (Google Sheet köprüsü)");
  await t.eval(function () { localStorage.setItem("toysmar.view", "teklifler"); });
  await t.goto(APP);
  await priceScenario(t);
  await t.eval(function () { localStorage.setItem("toysmar.view", "teklif-ayar"); });
  await t.goto(APP + "?as=satis@toysmar.test");
  ok("satış rolünde fiyat listesi kaynağı paneli yok", (await t.count("#src-url")) === 0 && (await txt("h1")) === "Teklif ayarları", await txt("h1"));
  ok("satış listeden gelen ürünleri görüyor", (await txt("#main")).includes("Trambolin 305"));

  t.section("19) Süreç adımları: tipler, kilitler, görünürlük");
  await t.eval(function () { localStorage.setItem("toysmar.view", "projeler"); });
  await t.goto(APP);
  await stepsScenario(t);

  t.section("20) Görünürlük: rol, departman, bölüm");
  await visibilityScenario(t);

  const errors = t.errors();
  ok("JS hatası yok", !errors.length, errors.slice(0, 3).join(" | "));
}
