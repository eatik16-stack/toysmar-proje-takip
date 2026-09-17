// Mevcut projeleri içe aktarma (görev bölüm 7) + 6. bölümün ekran parçaları:
// proje kartında Kayıtlar sekmesi, İşlerim'de bölüm süzgeci.
// Ön koşul: yönetici girişli, sürüm 2 kataloğu, "Sevkiyat Kilidi Parkı" (SK) projesi.

export async function importScenario(t) {
  const ok = t.ok;
  const APP = "test/index.html";
  const txt = t.text;
  const toastText = function () {
    return t.eval(function () { const x = document.getElementById("toast"); return x && !x.hidden ? x.textContent : ""; });
  };

  /* ---------- proje kartında Kayıtlar sekmesi ---------- */
  await t.click('[data-nav="projeler"]'); await t.wait(300);
  let d = await t.db();
  const skKey = Object.keys(d).find(function (k) { return k.startsWith("projects/") && d[k].code === "SK"; });
  await t.click('[data-open-proj="' + skKey.split("/")[1] + '"]'); await t.wait(400);
  ok("proje kartında Kayıtlar sekmesi var", (await t.count('[data-ptab="kayitlar"]')) === 1);
  await t.click('[data-ptab="kayitlar"]'); await t.wait(700);
  const plog = await txt("#main");
  ok("projenin kayıtları listeleniyor (kilit aşımı dahil)", plog.includes("kilit aşıldı") && plog.includes("sipariş durumu"), plog.slice(-300));
  ok("başka projenin kaydı karışmadı", !plog.includes("Görünürlük Parkı") && !plog.includes("Vida siparişi"));

  /* ---------- İşlerim: bölüm süzgeci ---------- */
  await t.click('[data-nav="isler"]'); await t.wait(300);
  ok("bölümlü departmanda bölüm süzgeci var", (await t.count('[data-mysection="metal"]')) === 1 && (await t.count('[data-mysection="kaplama"]')) === 1);
  ok("tümünde bölüm etiketi görünüyor", (await txt("#main")).includes("Kaynak makinesi") && (await t.count("#main tbody .tag")) >= 1);
  await t.click('[data-mysection="metal"]'); await t.wait(200);
  ok("Metal süzgecinde metal işi var", (await txt("#main")).includes("Kaynak makinesi"));
  await t.click('[data-mysection="kaplama"]'); await t.wait(200);
  ok("Kaplama süzgecinde metal işi yok", !(await txt("#main")).includes("Kaynak makinesi") && (await txt("#main")).includes("Açık iş yok"));
  await t.click('[data-mysection=""]'); await t.wait(200);

  /* ---------- içe aktarma ---------- */
  const raw = await t.fetchText("tools/toysmar-mevcut-projeler.json");
  const json = JSON.parse(raw);
  const total = json.projects.length;
  const codeless = json.projects.filter(function (p) { return !p.code; }).map(function (p, i) { return p; });
  const taskTotal = json.projects.reduce(function (n, p) { return n + Object.keys(p.tasks || {}).length; }, 0);
  d = await t.db();
  const before = Object.keys(d).filter(function (k) { return k.startsWith("projects/"); }).length;

  await t.click('[data-nav="ayarlar"]'); await t.wait(400);
  ok("Ayarlar'da içe aktarma paneli var", (await t.count("#imp-json")) === 1 && (await t.count("[data-impparse]")) === 1);
  await t.eval(new Function('document.getElementById("imp-json").value = ' + JSON.stringify(raw) + ';'));
  await t.click("[data-impparse]"); await t.wait(500);
  ok("özet penceresi açıldı: " + total + " proje", (await txt("#modal-root")).includes(total + " proje"), (await txt("#modal-root")).slice(0, 200));
  ok("kodu boş projeler kod bekliyor", (await t.count("#modal-root [data-impcode]")) === codeless.length, String(await t.count("#modal-root [data-impcode]")));
  ok("tam proje olmayanlar not aldı", (await txt("#modal-root")).includes("tam proje değil"));
  ok("kodlu projeler eklenecek", (await txt("#modal-root")).includes((total - codeless.length) + " eklenecek"));

  // Kodu boş projelere kod ver: ER, IS, YP, ZP …
  const idx = await t.eval(function () {
    return [].map.call(document.querySelectorAll("#modal-root [data-impcode]"), function (x) { return x.getAttribute("data-impcode"); });
  });
  const newCodes = ["ER", "IS", "YP", "ZP", "QA", "QB"];
  for (let i = 0; i < idx.length; i++) {
    await t.fill('[data-impcode="' + idx[i] + '"]', newCodes[i]); await t.change('[data-impcode="' + idx[i] + '"]'); await t.wait(150);
  }
  ok("kod verilince hepsi eklenecek", (await txt("#modal-root")).includes(total + " eklenecek"), (await txt("#modal-root")).slice(0, 200));
  await t.click("[data-msave]"); await t.wait(1500);
  d = await t.db();
  const projs = Object.keys(d).filter(function (k) { return k.startsWith("projects/"); });
  ok(total + " proje aktarıldı", projs.length === before + total, String(projs.length - before));
  const imported = Object.keys(d).filter(function (k) { return k.startsWith("tasks/") && d[k].importedFrom === "excel"; });
  ok(taskTotal + " iş emri aktarıldı", imported.length === taskTotal, String(imported.length));
  const apKey = projs.find(function (k) { return d[k].code === "AP"; });
  const ap = d[apKey], apId = apKey.split("/")[1];
  ok("AP projesi alanlarıyla geldi", ap.name.indexOf("AYŞE ERDOĞAN") === 0 && ap.theme === "SOFT" && ap.salesperson === "BYM" && ap.startDate === "2026-06-29", JSON.stringify(ap));
  ok("ISO olmayan termin nota düştü", ap.dueDate === "" && ap.note.indexOf("03-07.08.2026") !== -1, ap.note);
  const apTasks = imported.filter(function (k) { return d[k].projectId === apId; }).map(function (k) { return d[k]; });
  const ap2d = apTasks.find(function (x) { return x.stepId === "t-2d"; });
  const apMetal = apTasks.find(function (x) { return x.stepId === "u-metal-panel"; });
  ok("tamamlanmış adım Excel aktarımı olarak kapalı", !!ap2d && ap2d.status === "tamam" && ap2d.completedBy === "excel-aktarim" && ap2d.completedAt === "");
  ok("adetli adım gerekeniyle açık", !!apMetal && apMetal.qty === "95" && apMetal.status === "bekliyor");
  const apAcc = d["accounting/" + apId];
  ok("muhasebe bilgisi ayrı belgeye yazıldı", !!apAcc && apAcc.total === "3100000" && apAcc.shippingIncluded === "dahil" && apAcc.installIncluded === "dahil" &&
    apAcc.paymentDetail.indexOf("senet") !== -1, JSON.stringify(apAcc));
  ok("kilit özeti yazıldı", !!d["locks/" + apId] && Object.keys(d["locks/" + apId].items).length === apTasks.length);
  const sipVer = imported.map(function (k) { return d[k]; }).find(function (x) { return x.orderStatus === "siparis-verildi"; });
  ok("“sipariş verildi” durumu kaleme geçti", !!sipVer && sipVer.status !== "tamam");
  const devam = imported.map(function (k) { return d[k]; }).find(function (x) { return x.status === "devam"; });
  ok("“devam” açık ve notlu", !!devam && devam.note.indexOf("İmalatta (Excel)") !== -1);
  ok("günlüğe tek satır yazıldı", Object.keys(d).filter(function (k) { return k.startsWith("log/") && d[k].action === "ice-aktarim"; }).length === 1);
  ok("proje listesine düştü", (await txt("#main")).includes("AYŞE ERDOĞAN") && (await txt("#main tbody")).includes("AP"));

  /* ---------- ikinci çalıştırma: kopya yok ---------- */
  await t.click('[data-nav="ayarlar"]'); await t.wait(400);
  await t.eval(new Function('document.getElementById("imp-json").value = ' + JSON.stringify(raw) + ';'));
  await t.click("[data-impparse]"); await t.wait(500);
  ok("ikinci çalıştırmada kodlular atlanacak", (await txt("#modal-root")).includes((total - codeless.length) + " atlanacak"), (await txt("#modal-root")).slice(0, 200));
  await t.click("[data-msave]"); await t.wait(600);
  d = await t.db();
  ok("kopya oluşmadı", Object.keys(d).filter(function (k) { return k.startsWith("projects/"); }).length === before + total && (await toastText()).includes("Aktarılacak proje yok"));
  await t.click("#modal-root .modal-foot [data-mclose]"); await t.wait(100);
}
