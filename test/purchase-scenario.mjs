// Satın alma kalemleri ve kilitler (karar 2, 4, 6a): sipariş durumu ve
// tedarikçi, tek tablo, "Malzemeler geldi" / Sevkiyat / Montaj kilitleri,
// yönetici kilit aşımı, panelde eksik malzeme sayacı, tekliften ön seçim.
// Ön koşul: yönetici girişli, sürüm 2 kataloğu, kabul edilmiş bir teklif (15. bölüm).

export async function purchaseScenario(t) {
  const ok = t.ok;
  const APP = "test/index.html";
  const txt = t.text;
  const toastText = function () {
    return t.eval(function () { const x = document.getElementById("toast"); return x && !x.hidden ? x.textContent : ""; });
  };
  const kpiOf = function (label) {
    return t.eval(new Function(
      'const k = [].find.call(document.querySelectorAll("#main .kpi"), function (x) { return x.querySelector(".l").textContent.trim() === ' + JSON.stringify(label) + '; });' +
      'return k ? Number(k.querySelector(".n").textContent) : null;'));
  };
  const lockText = function (id) { return t.text('[data-task="' + id + '"] .lock'); };

  /* ---------- proje: üretim + satın alma + depo + kalite + sevkiyat + montaj + muhasebe ---------- */
  await t.click('[data-nav="yeni"]'); await t.wait(300);
  await t.fill("#w-code", "SK"); await t.fill("#w-name", "Sevkiyat Kilidi Parkı");
  await t.click('[data-wnext="2"]'); await t.wait(300);
  const picks = ["u-metal-panel", "sa-isikli-150", "sa-palmiye", "dp-malzeme", "dp-koli", "dp-yukleme-listesi", "k-kontrol", "sv-tamam", "mo-tamam", "m-odeme-tamam"];
  for (const p of picks) await t.click('[data-pick="' + p + '"]');
  await t.click('[data-wnext="3"]'); await t.wait(300);
  await t.fill('[data-wrow="u-metal-panel"] [data-wf="qty"]', "5"); await t.change('[data-wrow="u-metal-panel"] [data-wf="qty"]');
  await t.fill('[data-wrow="sa-isikli-150"] [data-wf="qty"]', "2"); await t.change('[data-wrow="sa-isikli-150"] [data-wf="qty"]');
  await t.fill('[data-wrow="sa-palmiye"] [data-wf="qty"]', "3"); await t.change('[data-wrow="sa-palmiye"] [data-wf="qty"]');
  await t.click("[data-wsave]"); await t.wait(700);
  let d = await t.db();
  const pidKey = Object.keys(d).find(function (k) { return k.startsWith("projects/") && d[k].code === "SK"; });
  const pid = pidKey.split("/")[1];
  const taskOf = function (stepId) {
    const k = Object.keys(d).find(function (x) { return x.startsWith("tasks/") && d[x].projectId === pid && d[x].stepId === stepId; });
    return Object.assign({ id: k.split("/")[1] }, d[k]);
  };
  const T = {};
  picks.forEach(function (p) { T[p] = taskOf(p); });
  const isikli = T["sa-isikli-150"].id, palmiye = T["sa-palmiye"].id, metal = T["u-metal-panel"].id;
  const malzeme = T["dp-malzeme"].id, sev = T["sv-tamam"].id, mon = T["mo-tamam"].id;

  ok("satın alma kalemleri tek tabloda", (await t.count("#main table.purchase")) === 1 && (await t.count("#main table.purchase tbody tr")) === 2);
  ok("tabloda tedarikçi ve sipariş durumu sütunları var", (await txt("#main table.purchase thead")).includes("Tedarikçi") && (await txt("#main table.purchase thead")).includes("Sipariş durumu"));
  ok("sipariş durumu beş seçenekli", (await t.count('[data-task="' + isikli + '"] [data-f="orderStatus"] option')) === 6);
  ok("satın alma kalemi tedarikçi alanıyla açıldı", T["sa-isikli-150"].supplier === "" && T["sa-isikli-150"].orderStatus === "");

  await t.select('[data-task="' + isikli + '"] [data-f="orderStatus"]', "siparis-verildi"); await t.wait(300);
  await t.fill('[data-task="' + isikli + '"] [data-f="supplier"]', "Koçak Park"); await t.change('[data-task="' + isikli + '"] [data-f="supplier"]'); await t.wait(300);
  await t.select('[data-task="' + palmiye + '"] [data-f="orderStatus"]', "imalatta"); await t.wait(300);
  d = await t.db();
  ok("sipariş durumu ve tedarikçi kaydedildi", d["tasks/" + isikli].orderStatus === "siparis-verildi" && d["tasks/" + isikli].supplier === "Koçak Park" &&
    d["tasks/" + palmiye].orderStatus === "imalatta", JSON.stringify(d["tasks/" + isikli]));

  /* ---------- kilitler ---------- */
  await t.click('[data-task="' + malzeme + '"] [data-toggle]'); await t.wait(300);
  d = await t.db();
  ok("kalemler gelmeden “Malzemeler geldi” kapanmıyor", d["tasks/" + malzeme].status !== "tamam" && (await toastText()).includes("önce"), await toastText());
  let lt = await lockText(malzeme);
  ok("bekleyen kalemler durumlarıyla listeleniyor", lt.includes("sipariş verildi") && lt.includes("imalatta"), lt);
  await t.click('[data-task="' + sev + '"] [data-toggle]'); await t.wait(300);
  d = await t.db();
  lt = await lockText(sev);
  ok("sevkiyat kilidi: üretim, satın alma, depo ve kalite bekliyor", d["tasks/" + sev].status !== "tamam" && lt.includes("0/5") && lt.includes("imalatta") && lt.includes("Koli"), lt);
  ok("muhasebe adımı sevkiyat kilidine dahil değil", !lt.includes("Ödeme"), lt);
  await t.click('[data-task="' + mon + '"] [data-toggle]'); await t.wait(300);
  d = await t.db();
  ok("montaj, sevkiyat bitmeden kapanmıyor", d["tasks/" + mon].status !== "tamam" && (await lockText(mon)).includes("Sevkiyat"));

  /* ---------- panel: eksik malzeme ---------- */
  await t.click('[data-nav="panel"]'); await t.wait(400);
  const missingBefore = await kpiOf("Eksik malzeme");
  ok("panelde eksik malzeme sayacı var", missingBefore !== null && missingBefore >= 2, String(missingBefore));

  await t.click('[data-nav="projeler"]'); await t.wait(300);
  await t.click('[data-open-proj="' + pid + '"]'); await t.wait(400);
  await t.select('[data-task="' + isikli + '"] [data-f="orderStatus"]', "geldi"); await t.wait(300);
  await t.select('[data-task="' + palmiye + '"] [data-f="orderStatus"]', "geldi"); await t.wait(300);
  d = await t.db();
  ok("“geldi” olunca gelen adet gereken kadar sayıldı", d["tasks/" + isikli].doneQty === "2" && d["tasks/" + palmiye].doneQty === "3", d["tasks/" + isikli].doneQty);
  await t.click('[data-nav="panel"]'); await t.wait(400);
  ok("eksik malzeme sayacı iki azaldı", (await kpiOf("Eksik malzeme")) === missingBefore - 2, String(await kpiOf("Eksik malzeme")));

  /* ---------- koşullar sağlanınca kilit açılır ---------- */
  await t.click('[data-nav="projeler"]'); await t.wait(300);
  await t.click('[data-open-proj="' + pid + '"]'); await t.wait(400);
  await t.click('[data-task="' + malzeme + '"] [data-toggle]'); await t.wait(400);
  d = await t.db();
  ok("kalemler gelince “Malzemeler geldi” kapandı", d["tasks/" + malzeme].status === "tamam" && !d["tasks/" + malzeme].lockOverride);
  await t.click('[data-task="' + metal + '"] [data-qall]'); await t.wait(300);
  await t.click('[data-task="' + metal + '"] [data-toggle]'); await t.wait(300);
  for (const id of [T["dp-koli"].id, T["dp-yukleme-listesi"].id, T["k-kontrol"].id]) {
    await t.click('[data-task="' + id + '"] [data-toggle]'); await t.wait(300);
  }
  await t.click('[data-task="' + sev + '"] [data-toggle]'); await t.wait(400);
  d = await t.db();
  ok("üretim, satın alma, depo, kalite bitince sevkiyat kapandı (ödeme açıkken)", d["tasks/" + sev].status === "tamam" &&
    d["tasks/" + T["m-odeme-tamam"].id].status !== "tamam", d["tasks/" + sev].status);
  await t.click('[data-task="' + mon + '"] [data-toggle]'); await t.wait(400);
  d = await t.db();
  ok("sevkiyat bitince montaj kapandı", d["tasks/" + mon].status === "tamam");

  /* ---------- yönetici kilidi aşar ---------- */
  await t.click('[data-task="' + sev + '"] [data-toggle]'); await t.wait(300);        // geri al
  await t.click('[data-task="' + T["k-kontrol"].id + '"] [data-toggle]'); await t.wait(300);  // kaliteyi geri al
  d = await t.db();
  ok("sevkiyat geri alındı, kalite açık", d["tasks/" + sev].status !== "tamam" && d["tasks/" + T["k-kontrol"].id].status !== "tamam");
  ok("yöneticide “Kilidi aş” düğmesi var", (await t.count('[data-task="' + sev + '"] [data-override]')) === 1);
  await t.click('[data-task="' + sev + '"] [data-override]'); await t.wait(400);
  d = await t.db();
  ok("kilit aşılarak kapandı ve etiketlendi", d["tasks/" + sev].status === "tamam" && d["tasks/" + sev].lockOverride === true &&
    String(d["tasks/" + sev].lockOverrideNote || "").includes("kontrol"), JSON.stringify(d["tasks/" + sev].lockOverrideNote));
  ok("satırda “kilit aşıldı” etiketi", (await txt('[data-task="' + sev + '"]')).includes("kilit aşıldı"));
  const log = Object.keys(d).filter(function (k) { return k.startsWith("log/"); }).map(function (k) { return d[k].detail || ""; });
  ok("kilit aşımı günlüğe yazıldı", log.some(function (x) { return x.indexOf("kilit aşıldı") !== -1; }));

  /* ---------- şef kilidi aşamaz ---------- */
  await t.eval(function () {
    const d = JSON.parse(sessionStorage.getItem("toysmar.mockdb") || "{}");
    d["allowed/sevk@toysmar.test"] = { name: "Sevkiyat Şefi", role: "sef", dept: "d-sevkiyat", section: "", personId: "p-sevk" };
    d["config/org"].people.push({ id: "p-sevk", name: "Sevkiyat Şefi", dept: "d-sevkiyat", section: "", email: "sevk@toysmar.test" });
    sessionStorage.setItem("toysmar.mockdb", JSON.stringify(d));
    localStorage.setItem("toysmar.view", "projeler");
  });
  await t.goto(APP + "?as=sevk@toysmar.test");
  await t.click('[data-open-proj="' + pid + '"]'); await t.wait(400);
  await t.click('[data-task="' + sev + '"] [data-toggle]'); await t.wait(300);   // geri al
  d = await t.db();
  ok("şef sevkiyatı geri alabildi", d["tasks/" + sev].status !== "tamam");
  ok("şefte “Kilidi aş” yok", (await t.count('[data-task="' + sev + '"] [data-override]')) === 0);
  await t.click('[data-task="' + sev + '"] [data-toggle]'); await t.wait(300);
  d = await t.db();
  ok("şef kilitli sevkiyatı kapatamıyor", d["tasks/" + sev].status !== "tamam" && (await toastText()).includes("önce"));

  /* ---------- tekliften satın alma ön seçimi ---------- */
  await t.eval(function () {
    const d = JSON.parse(sessionStorage.getItem("toysmar.mockdb") || "{}");
    const k = Object.keys(d).find(function (x) { return x.startsWith("quotes/") && d[x].status === "kabul"; });
    const q = Object.assign({}, d[k], {
      no: "TKL-ONSECIM", rev: 0, projectId: "", supersededBy: "", status: "kabul",
      customer: Object.assign({}, d[k].customer, { company: "Ön Seçim AVM" }),
      items: [
        { id: "i1", kind: "line", productId: "", code: "", name: "Palmiye", unit: "adet", qty: 3, price: 1000 },
        { id: "i2", kind: "line", productId: "", code: "", name: "Işıklı kaydırak 150 mavi", unit: "adet", qty: 2, price: 5000 },
        { id: "i3", kind: "line", productId: "", code: "", name: "Trambolin 305", unit: "adet", qty: 1, price: 2000 }
      ]
    });
    d["quotes/q-onsecim"] = q;
    sessionStorage.setItem("toysmar.mockdb", JSON.stringify(d));
    localStorage.setItem("toysmar.view", "teklifler");
  });
  await t.goto(APP);
  await t.click('[data-qfilter="tumu"]'); await t.wait(300);
  await t.click('tr[data-qopen="q-onsecim"]'); await t.wait(400);
  ok("kabul edilmiş teklifte proje düğmesi var", (await t.count("[data-qproject]")) === 1);
  await t.click("[data-qproject]"); await t.wait(500);
  await t.fill("#w-code", "OS");
  await t.click('[data-wnext="2"]'); await t.wait(300);
  ok("eşleşen kalemler satın alma adımı olarak ön seçildi", (await t.count('[data-pick="sa-palmiye"].on')) === 1 && (await t.count('[data-pick="sa-isikli-150"].on')) === 1);
  const main = await txt("#main");
  ok("eşleşmeyen kalem serbest kalem olarak listelendi", main.includes("2 kalem") && main.includes("Trambolin 305"), main.slice(0, 400));
  await t.click('[data-wnext="3"]'); await t.wait(300);
  ok("ön seçilen kalemin adedi ve özelliği tekliften geldi", (await t.prop('[data-wrow="sa-palmiye"] [data-wf="qty"]', "value")) === "3" &&
    (await t.prop('[data-wrow="sa-isikli-150"] [data-wf="spec"]', "value")).includes("mavi"));
}
