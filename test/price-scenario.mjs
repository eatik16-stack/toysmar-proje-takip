// Fiyat listesi (Google Sheet köprüsü) içe aktarma senaryosu.
// Sürücü sözleşmesi test/quote-scenario.mjs ile aynıdır.
// Ön koşul: yönetici girişli, teklif modülü kurulu (quote-scenario sonrası).
// Köprü çağrısı gerçek ağa çıkmaz: window.__MOCK_PRICE_LIST__ sabit yanıt verir.

const V1 = {
  kaynak: "Toysmar Takip - 2026 / 28/07 GÜNCEL..", listeTarihi: "27.08.2026", kur: 49,
  alindi: "2026-09-15T10:00:00.000Z", adet: 6,
  uyarilar: ["Yinelenen kod TPT-125: satır 6 ve 7"],
  urunler: [
    { kod: "TYT-1001", kodHam: "TYT-1001", ad: "Çocuk Salıncak 90 cm", ebat: "120 çap H149 cm", fiyat: 3224, grup: "TEKLİ TRAMBOLİNLER (Bireysel)", satir: 4 },
    { kod: "TPT-305", kodHam: "TPT-305", ad: "Trambolin 305 cm Ağlı", ebat: "305 çap H250 cm", fiyat: 12500, grup: "TEKLİ TRAMBOLİNLER (Bireysel)", satir: 5 },
    { kod: "TPT-125", kodHam: "TPT-125", ad: "Trambolin 111×111", ebat: "111×111 cm", fiyat: 4100, grup: "TEKLİ TRAMBOLİNLER (Bireysel)", satir: 6 },
    { kod: "TPT-125", kodHam: "TPT- 125", ad: "Trambolin 125×125", ebat: "125×125 cm", fiyat: 4600, grup: "TEKLİ TRAMBOLİNLER (Bireysel)", satir: 7 },
    { kod: "TSO-8", kodHam: "TSO-8", ad: "Olimpik Trambolin 8 Kişilik", ebat: "", fiyat: 0, grup: "TİCARİ OLİMPİK", satir: 12 },
    { kod: "SP-TUNEL", kodHam: "SP-TUNEL", ad: "Softplay Tünel", ebat: "200 cm", fiyat: 8900, grup: "SOFTPLAY HAREKETLİ", satir: 20 }
  ]
};

// İkinci liste: üç fiyat değişti, TSO-8 düştü, TSO-10 geldi.
const V2 = JSON.parse(JSON.stringify(V1));
V2.listeTarihi = "10.09.2026"; V2.uyarilar = [];
V2.urunler = V2.urunler.filter(function (u) { return u.kod !== "TSO-8"; });
V2.urunler.forEach(function (u) {
  if (u.kod === "TPT-305") u.fiyat = 13750;
  if (u.kodHam === "TPT-125") u.fiyat = 4300;
  if (u.kod === "SP-TUNEL") u.fiyat = 9500;
});
V2.urunler.push({ kod: "TSO-10", kodHam: "TSO-10", ad: "Olimpik Trambolin 10 Kişilik", ebat: "", fiyat: 52000, grup: "TİCARİ OLİMPİK", satir: 13 });
V2.adet = V2.urunler.length;

export async function priceScenario(t) {
  const ok = t.ok;
  const catalog = async function () { return ((await t.db())["sales/catalog"] || {}).products || []; };
  const byId = function (list, id) { return list.filter(function (p) { return p.id === id; })[0]; };
  const sheet = function (list) { return list.filter(function (p) { return p.source === "sheet"; }); };
  const manualNames = function (list) { return list.filter(function (p) { return p.source !== "sheet"; }).map(function (p) { return p.name; }).join("|"); };

  const before = await catalog();
  const manualBefore = manualNames(before);

  /* ---------- kaynak ayarı (yalnızca yönetici) ---------- */
  await t.click('[data-nav="teklifler"]'); await t.wait(300);
  await t.click('[data-nav="teklif-ayar"]'); await t.wait(500);
  ok("kaynak paneli yöneticide görünüyor", (await t.count("#src-url")) === 1);
  await t.fill("#src-url", "https://script.google.com/macros/s/ORNEK/exec");
  await t.fill("#src-key", "gizli-anahtar-123");
  await t.click("[data-srcsave]"); await t.wait(400);
  let d = await t.db();
  ok("köprü adresi ve anahtar kaydedildi", d["sales/source"] && d["sales/source"].url.indexOf("/exec") > 0 && d["sales/source"].key === "gizli-anahtar-123");

  /* ---------- ilk içe aktarma ---------- */
  await t.eval(function () {
    window.__PRICE_CALLS__ = [];
    window.__PRICE_BODY__ = window.__PRICE_V1__;
    window.__MOCK_PRICE_LIST__ = function (url, key) {
      window.__PRICE_CALLS__.push({ url: url, key: key });
      return Promise.resolve(JSON.parse(JSON.stringify(window.__PRICE_BODY__)));
    };
  });
  await t.eval(new Function("window.__PRICE_V1__ = " + JSON.stringify(V1) + "; window.__PRICE_V2__ = " + JSON.stringify(V2) + "; window.__PRICE_BODY__ = window.__PRICE_V1__;"));
  await t.click("[data-srcimport]"); await t.wait(600);
  ok("köprü kayıtlı anahtarla çağrıldı", (await t.eval(function () { return window.__PRICE_CALLS__[0] && window.__PRICE_CALLS__[0].key; })) === "gizli-anahtar-123");
  ok("özet penceresi açıldı", (await t.count("#modal-root .modal")) === 1);
  const sum1 = await t.text("#modal-root .modal-body");
  ok("özet: 6 yeni, yinelenen kod uyarısı", sum1.indexOf("6") !== -1 && sum1.indexOf("TPT-125-2") !== -1 && sum1.indexOf("Yinelenen kod") !== -1, sum1.slice(0, 200));
  await t.click("[data-msave]"); await t.wait(600);
  let cat = await catalog();
  ok("6 listeden ürün yazıldı, elle eklenenler duruyor", sheet(cat).length === 6 && manualNames(cat) === manualBefore,
    sheet(cat).length + " / " + (manualNames(cat) === manualBefore));
  ok("gruplar doğru", byId(cat, "TPT-305").group === "TEKLİ TRAMBOLİNLER (Bireysel)" && byId(cat, "SP-TUNEL").group === "SOFTPLAY HAREKETLİ");
  ok("yinelenen kod -2 eki aldı, ham kod korundu", !!byId(cat, "TPT-125-2") && byId(cat, "TPT-125-2").codeRaw === "TPT- 125" && byId(cat, "TPT-125-2").name === "Trambolin 125×125");
  ok("fiyatı 0 gelen ürün priceMissing", byId(cat, "TSO-8").priceMissing === true && byId(cat, "TPT-305").priceMissing === false);
  ok("fiyat ve ebat kaydedildi", byId(cat, "TPT-305").price === 12500 && byId(cat, "TPT-305").size === "305 çap H250 cm");
  d = await t.db();
  const meta = (d["sales/catalog"] || {}).lastImport;
  ok("son içe aktarma bilgisi yazıldı", !!meta && meta.count === 6 && meta.listDate === "27.08.2026" && meta.added === 6);
  ok("ekranda son güncelleme görünüyor", (await t.text("#main")).indexOf("27.08.2026") !== -1);
  let log = Object.keys(d).filter(function (k) { return k.startsWith("log/"); }).map(function (k) { return d[k]; });
  ok("günlüğe fiyat listesi kaydı yazıldı", log.some(function (r) { return r.action === "fiyat-listesi" && /6 ürün/.test(r.detail); }));

  /* ---------- değişiklik yoksa yazılmaz ---------- */
  await t.click("[data-srcimport]"); await t.wait(500);
  ok("aynı liste: pencere açılmadı, “Katalog güncel”", (await t.count("#modal-root .modal")) === 0 &&
    (await t.eval(function () { const x = document.getElementById("toast"); return x && !x.hidden ? x.textContent : ""; })).indexOf("Katalog güncel") === 0);

  /* ---------- hata mesajları ---------- */
  await t.eval(function () { window.__MOCK_PRICE_LIST__ = function () { return Promise.resolve({ hata: "yetkisiz" }); }; });
  await t.click("[data-srcimport]"); await t.wait(400);
  ok("yanlış anahtar anlaşılır mesaj veriyor", (await t.eval(function () { return document.getElementById("toast").textContent; })).indexOf("Anahtar hatalı") === 0);
  await t.eval(function () { window.__MOCK_PRICE_LIST__ = function () { return Promise.resolve({ hata: "Fiyat listesi sayfası bulunamadı (gid 1)" }); }; });
  await t.click("[data-srcimport]"); await t.wait(400);
  ok("sayfa yoksa anlaşılır mesaj", (await t.eval(function () { return document.getElementById("toast").textContent; })).indexOf("Sayfa bulunamadı") === 0);
  await t.eval(function () {
    window.__MOCK_PRICE_LIST__ = function (url, key) { window.__PRICE_CALLS__.push({ url: url, key: key }); return Promise.resolve(JSON.parse(JSON.stringify(window.__PRICE_BODY__))); };
  });

  /* ---------- elle eklenen ürün ---------- */
  await t.fill("#pn-name", "Özel Maskot Heykeli");
  await t.click("[data-padd]"); await t.wait(400);
  cat = await catalog();
  ok("elle eklenen ürün source=manuel", !!cat.filter(function (p) { return p.name === "Özel Maskot Heykeli"; })[0] && cat.filter(function (p) { return p.name === "Özel Maskot Heykeli"; })[0].source === "manuel");

  /* ---------- teklifte ürün seçici ---------- */
  await t.click('[data-nav="teklifler"]'); await t.wait(300);
  await t.click("[data-qnew]"); await t.wait(400);
  await t.fill("#qf-customer-company", "Ege Park"); await t.change("#qf-customer-company");
  await t.wait(200);
  await t.fill("#q-add", ""); await t.wait(100);
  ok("kutu boşken gruplar listeleniyor", (await t.count("#q-add-results .qgrp")) >= 3, String(await t.count("#q-add-results .qgrp")));
  await t.click('[data-qaddgroup="TİCARİ OLİMPİK"]'); await t.wait(150);
  ok("grup seçilince o grubun ürünleri", (await t.count("#q-add-results .qres")) === 1 && (await t.text("#q-add-results")).indexOf("Olimpik Trambolin 8") !== -1);
  ok("fiyatsız ürün etiketli", (await t.text("#q-add-results")).indexOf("fiyat girilmedi") !== -1);
  await t.click("[data-qaddgroupclear]"); await t.wait(100);
  await t.fill("#q-add", "trambolin 305"); await t.wait(150);
  const hits = await t.eval(function () { return [].map.call(document.querySelectorAll("#q-add-results .qres[data-qaddprod]"), function (b) { return b.getAttribute("data-qaddprod"); }); });
  ok("“trambolin 305” araması doğru satırı buluyor", hits.length === 1 && hits[0] === "TPT-305", hits.join(","));
  await t.fill("#q-add", "TÜNEL"); await t.wait(150);
  ok("Türkçe büyük harf araması", (await t.eval(function () { const b = document.querySelector("#q-add-results .qres[data-qaddprod]"); return b && b.getAttribute("data-qaddprod"); })) === "SP-TUNEL");
  await t.fill("#q-add", "trambolin 305"); await t.wait(150);
  await t.press("#q-add", "Enter"); await t.wait(400);
  const line = await t.eval(function () {
    const r = document.querySelector("#q-lines .ql:last-child");
    return { name: r.querySelector("[data-lf=name]").value, note: r.querySelector("[data-lf=note]").value, price: r.querySelector("[data-lf=price]").value, odak: document.activeElement.id };
  });
  ok("seçilen ürünün liste fiyatı kaleme kopyalandı", line.price === "12.500", line.price);
  ok("ebat açıklamaya düştü, odak miktarda", line.note === "305 çap H250 cm" && /-qty$/.test(line.odak), line.note + " / " + line.odak);
  await t.fill("#q-add", "olimpik 8"); await t.wait(150);
  await t.press("#q-add", "Enter"); await t.wait(400);
  const line2 = await t.eval(function () {
    const r = document.querySelector("#q-lines .ql:last-child");
    return { price: r.querySelector("[data-lf=price]").value, odak: document.activeElement.id };
  });
  ok("fiyatsız ürün: fiyat boş ve odaklı", line2.price === "" && /-price$/.test(line2.odak), JSON.stringify(line2));
  await t.wait(1700);
  const quotes = await t.db();
  const qk = Object.keys(quotes).filter(function (k) { return k.startsWith("quotes/") && quotes[k].customer && quotes[k].customer.company === "Ege Park"; })[0];
  ok("kalem fiyatı teklife kaydedildi", !!qk && quotes[qk].items[0].price === 12500 && quotes[qk].items[0].productId === "TPT-305");

  /* ---------- ikinci içe aktarma: fiyat değişimi teklifi etkilemez ---------- */
  await t.click('[data-nav="teklifler"]'); await t.wait(300);
  await t.click('[data-nav="teklif-ayar"]'); await t.wait(500);
  await t.eval(function () { window.__PRICE_BODY__ = window.__PRICE_V2__; });
  await t.click("[data-srcimport]"); await t.wait(600);
  const sum2 = await t.text("#modal-root .modal-body");
  const kpis = await t.eval(function () {
    const o = {}; document.querySelectorAll("#modal-root .imp-kpi").forEach(function (k) { o[k.textContent.replace(/^\d+/, "").trim()] = Number(k.querySelector("b").textContent); }); return o;
  });
  ok("özet: 3 fiyat değişti, 1 yeni, 1 düştü", kpis["fiyat değişti"] === 3 && kpis["yeni"] === 1 && kpis["listeden düştü"] === 1, JSON.stringify(kpis));
  ok("özette eski → yeni fiyat ve yüzde", sum2.indexOf("12.500,00") !== -1 && sum2.indexOf("13.750,00") !== -1 && sum2.indexOf("+10%") !== -1);
  await t.click("[data-msave]"); await t.wait(600);
  cat = await catalog();
  ok("sadece üç fiyat değişti", byId(cat, "TPT-305").price === 13750 && byId(cat, "TPT-125").price === 4300 && byId(cat, "SP-TUNEL").price === 9500 && byId(cat, "TYT-1001").price === 3224 && byId(cat, "TPT-125-2").price === 4600);
  ok("listeden düşen silinmedi, pasif oldu", !!byId(cat, "TSO-8") && byId(cat, "TSO-8").active === false);
  ok("yeni ürün geldi", !!byId(cat, "TSO-10") && byId(cat, "TSO-10").price === 52000);
  ok("elle eklenen ürünler dokunulmadı", cat.some(function (p) { return p.name === "Özel Maskot Heykeli" && p.source === "manuel"; }) && manualNames(cat).indexOf(manualBefore) === 0);
  const q2 = await t.db();
  ok("tekliftaki kalem fiyatı değişmedi (12.500)", q2[qk].items[0].price === 12500, String(q2[qk].items[0].price));
  ok("pasif ürün katalog listesinde etiketli, varsayılan gizli", (await t.text("#main")).indexOf("Olimpik Trambolin 8") === -1 && (await t.count("[data-pinactive]")) === 1);
  await t.click("[data-pinactive]"); await t.wait(200);
  ok("“Pasifleri göster” ile listeden düşen görünüyor", (await t.text("#main")).indexOf("listeden düştü") !== -1);

  /* ---------- pasif ürün seçicide yok, eski teklifte duruyor ---------- */
  await t.click('[data-nav="teklifler"]'); await t.wait(300);
  await t.click('[data-qfilter="tumu"]'); await t.wait(200);
  await t.click('tr[data-qopen="' + qk.split("/")[1] + '"]'); await t.wait(400);
  ok("eski teklifte fiyatsız kalem duruyor", (await t.count("#q-lines .ql:not(.ql-head)")) === 2);
  await t.fill("#q-add", "olimpik 8"); await t.wait(150);
  ok("pasif ürün seçicide çıkmıyor", (await t.count("#q-add-results .qres[data-qaddprod]")) === 0);
  await t.fill("#q-add", "olimpik 10"); await t.wait(150);
  ok("yeni ürün seçicide var", (await t.count("#q-add-results .qres[data-qaddprod]")) === 1);
  await t.fill("#q-add", ""); await t.wait(100);
  await t.eval(function () { delete window.__MOCK_PRICE_LIST__; });
}
