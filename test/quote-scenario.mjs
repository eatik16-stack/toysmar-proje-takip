// Teklif modülü uçtan uca senaryosu.
//
// Sürücüden bağımsızdır: test/run.mjs Playwright sürücüsüyle çağırır; aynı dosya
// tarayıcı içinde DOM sürücüsüyle de koşturulabilir (Node olmayan makinede). Sürücü şu işlevleri verir:
//   ok(etiket, koşul, ek)   click(seçici)   fill(seçici, değer)   change(seçici)
//   select(seçici, değer)   press(seçici, tuş)   wait(ms)   db()   text(seçici)
//   count(seçici)   prop(seçici, ad)   eval(fn)
//
// Beklenen tutarlar elle hesaplandı; müşteriye yanlış fiyatlı belge gitmemesi
// bu testin asıl amacı.

export async function quoteScenario(t) {
  const ok = t.ok;
  const Y = new Date().getFullYear();
  // Numara, senaryo başlarken sayacın bir fazlasıdır (run.mjs 10b önceden teklif açıyor olabilir).
  let NO = "";
  const quotes = async function () {
    const d = await t.db();
    return Object.keys(d).filter(function (k) { return k.startsWith("quotes/"); })
      .map(function (k) { return Object.assign({ id: k.split("/")[1] }, d[k]); });
  };
  const byRev = async function (rev) {
    return (await quotes()).find(function (q) { return q.no === NO && (q.rev || 0) === rev; });
  };
  const lastLine = "#q-lines .ql:last-child";
  async function addProduct(term, qty, price) {
    await t.fill("#q-add", term);
    await t.wait(150);
    await t.press("#q-add", "Enter");
    await t.wait(400);
    await t.fill(lastLine + " [data-lf=qty]", qty); await t.change(lastLine + " [data-lf=qty]");
    await t.fill(lastLine + " [data-lf=price]", price); await t.change(lastLine + " [data-lf=price]");
    await t.wait(150);
  }

  /* ---------- hesap çekirdeği ---------- */
  const m = await t.eval(async function () {
    const x = await import("/js/money.js");
    return {
      a: x.parseNum("165.000"), b: x.parseNum("1.250,50"), c: x.parseNum("45.5"), d: x.parseNum("₺ 12.000"),
      e: x.parseNum(""), f: x.parseNum("0"),
      w1: x.amountWords(1001, "TRY"), w2: x.amountWords(110.5, "TRY"),
      clamp: x.calcTotals({ items: [{ qty: 1, price: 100 }], discountType: "tutar", discountValue: 500, vatRate: 20 }).grand,
      missing: x.calcTotals({ items: [{ qty: 1, price: null }, { kind: "head", name: "x" }, { qty: 2, price: 10 }] })
    };
  });
  ok("Türkçe sayı yazımları okunuyor", m.a === 165000 && m.b === 1250.5 && m.c === 45.5 && m.d === 12000,
    [m.a, m.b, m.c, m.d].join(","));
  ok("boş fiyat 0 değil, “girilmedi” sayılıyor", m.e === null && m.f === 0);
  ok("yazıyla tutar kenar durumları", m.w1 === "Yalnız bin bir Türk Lirası" && m.w2 === "Yalnız yüz on Türk Lirası elli Kuruş",
    m.w1 + " | " + m.w2);
  ok("iskonto ara toplamı aşamıyor", m.clamp === 0, String(m.clamp));
  ok("başlık satırı kalem sayılmıyor, fiyatsız kalem sayılıyor", m.missing.count === 2 && m.missing.missing === 1 && m.missing.sub === 20);

  /* ---------- kurulum ---------- */
  await t.click('[data-nav="teklifler"]'); await t.wait(400);
  if (await t.count("[data-qseed]")) { await t.click("[data-qseed]"); await t.wait(600); }
  let d = await t.db();
  ok("teklif kataloğu yüklendi (26 ürün)", (d["sales/catalog"]?.products || []).length === 26);
  ok("teklif ayarları yüklendi", !!d["sales/settings"]);
  const seqBefore = Number((d["sales/counter"] || {})["y" + Y]) || 0;
  NO = "TKL-" + Y + "-" + String(seqBefore + 1).padStart(4, "0");

  /* ---------- yeni teklif ve numara ---------- */
  await t.click("[data-qnew]"); await t.wait(400);
  await t.fill("#qf-customer-company", "Baktat AVM"); await t.change("#qf-customer-company");
  await t.wait(1700);
  let q0 = await byRev(0);
  ok("ilk kayıtta numara verildi (" + NO + ")", !!q0, (await quotes()).map(function (q) { return q.no; }).join(","));
  d = await t.db();
  ok("yıllık sayaç bir arttı", d["sales/counter"]?.["y" + Y] === seqBefore + 1, JSON.stringify(d["sales/counter"]));

  /* ---------- kalem ekleme ve toplam ---------- */
  await addProduct("roller", "1", "165.000");
  await addProduct("engel parkur", "45,5", "25000");
  await addProduct("tatami", "330", "450");
  await t.wait(1700);
  q0 = await byRev(0);
  ok("3 kalem kaydedildi", (q0.items || []).length === 3, String((q0.items || []).length));
  ok("birim katalogdan geldi", q0.items[1].unit === "Metre" && q0.items[2].unit === "m²",
    q0.items.map(function (l) { return l.unit; }).join(","));
  ok("miktar ve fiyat sayı olarak kaydedildi", q0.items[1].qty === 45.5 && q0.items[0].price === 165000);
  ok("ara toplam doğru (1.451.000)", q0.totals.sub === 1451000, String(q0.totals.sub));
  ok("KDV %20 ile genel toplam doğru (1.741.200)", q0.totals.grand === 1741200, String(q0.totals.grand));
  ok("ekrandaki toplam kayıtla aynı", (await t.text(".qt-grand")).includes("1.741.200,00"), await t.text(".qt-grand"));

  /* ---------- iskonto ve KDV ---------- */
  await t.fill("#qf-discountValue", "5"); await t.change("#qf-discountValue"); await t.wait(1700);
  q0 = await byRev(0);
  ok("%5 iskonto: net 1.378.450, genel 1.654.140", q0.totals.net === 1378450 && q0.totals.grand === 1654140,
    q0.totals.net + " / " + q0.totals.grand);
  await t.select("#qf-discountType", "tutar"); await t.wait(300);
  await t.fill("#qf-discountValue", "51.000"); await t.change("#qf-discountValue"); await t.wait(1700);
  q0 = await byRev(0);
  ok("51.000 ₺ iskonto: net 1.400.000, genel 1.680.000", q0.totals.net === 1400000 && q0.totals.grand === 1680000,
    q0.totals.net + " / " + q0.totals.grand);
  ok("yazıyla tutar", (await t.text(".qt-words")) === "Yalnız bir milyon altı yüz seksen bin Türk Lirası", await t.text(".qt-words"));
  await t.select("#qf-vatRate", "0"); await t.wait(1700);
  q0 = await byRev(0);
  ok("KDV eklenmeyince toplam net tutar", q0.totals.grand === 1400000 && q0.totals.vat === 0);
  ok("“KDV hariç” yazıyor", (await t.text(".qt-grand")).includes("KDV hariç"));
  await t.select("#qf-vatRate", "20"); await t.wait(1700);

  /* ---------- fiyatsız kalemle gönderilemez ---------- */
  await t.eval(function () {
    window.__prints = [];
    window.print = function () {
      window.__prints.push(!!document.querySelector("#print-root .qdoc-wm"));
      window.dispatchEvent(new Event("afterprint"));
    };
  });
  await t.click("[data-qaddblank]"); await t.wait(300);
  await t.fill(lastLine + " [data-lf=name]", "Fiyatı unutulan kalem"); await t.wait(1700);
  await t.click("[data-qpreview]"); await t.wait(400);
  await t.click("[data-qsend]"); await t.wait(600);
  q0 = await byRev(0);
  ok("fiyatsız kalem varken gönderilmedi", q0.status === "taslak", q0.status);
  ok("fiyatsız gönderimde baskı açılmadı", (await t.eval(function () { return window.__prints.length; })) === 0);
  await t.click("[data-qpreviewclose]"); await t.wait(300);
  await t.click(lastLine + " [data-ldel]"); await t.wait(1700);

  /* ---------- taslak baskı kilitlemez, gönderim kilitler ---------- */
  await t.click("[data-qpreview]"); await t.wait(400);
  await t.click('[data-qprint="taslak"]'); await t.wait(300);
  q0 = await byRev(0);
  ok("taslak baskı dokunuşla hemen açıldı (Safari için senkron)", (await t.eval(function () { return window.__prints.length; })) === 1);
  ok("taslak baskıda TASLAK filigranı var", (await t.eval(function () { return window.__prints[0]; })) === true);
  ok("taslak baskı teklifi kilitlemedi", q0.status === "taslak");
  await t.click("[data-qsend]"); await t.wait(900);
  q0 = await byRev(0);
  ok("gönderilince durum “gönderildi”", q0.status === "gonderildi", q0.status);
  ok("gönderim zamanı yazıldı", !!q0.sentAt);
  // Gönderme ağ işlemi olduğundan yazdırma kendiliğinden açılmaz; önizlemede Yazdır / PDF beklenir.
  ok("gönderimden sonra önizlemede kalındı", (await t.count('[data-qprint="1"]')) === 1);
  ok("gönderim yazdırmayı kendiliğinden açmadı", (await t.eval(function () { return window.__prints.length; })) === 1);
  await t.click('[data-qprint="1"]'); await t.wait(300);
  ok("gönderilen belgenin baskısında filigran yok", (await t.eval(function () { return window.__prints[1]; })) === false);
  await t.click("[data-qpreviewclose]"); await t.wait(400);
  ok("gönderilen teklifte fiyat kutusu kilitli", (await t.prop("#q-lines .ql:not(.ql-head) [data-lf=price]", "disabled")) === true);
  ok("gönderilen teklifte ürün eklenemiyor", (await t.count("#q-add")) === 0);
  ok("taşıma/silme düğmeleri yok", (await t.count("[data-ldel]")) === 0);

  await t.fill("#qf-notes", "Müşteri %5 iskonto istedi."); await t.wait(1700);
  q0 = await byRev(0);
  ok("kilitliyken iç not kaydedilebiliyor", q0.notes === "Müşteri %5 iskonto istedi.");
  ok("iç not kaydı tutarları değiştirmedi", q0.totals.grand === 1680000 && q0.items.length === 3);

  /* ---------- revizyon ---------- */
  await t.click("[data-qrevise]"); await t.wait(900);
  const r1 = await byRev(1);
  q0 = await byRev(0);
  ok("revizyon R1 olarak açıldı", !!r1 && r1.status === "taslak", r1 ? r1.status : "yok");
  ok("başlıkta -R1 görünüyor", (await t.text("#main h1")).includes(NO + "-R1"), await t.text("#main h1"));
  ok("R1 aynı numarayı taşıyor, önceki sürüme bağlı", r1.no === NO && r1.parentId === q0.id);
  ok("önceki sürüm revize edildi olarak işaretlendi", q0.supersededBy === r1.id && q0.status === "gonderildi");
  await t.fill("#q-lines .ql:not(.ql-head) [data-lf=price]", "150.000");
  await t.change("#q-lines .ql:not(.ql-head) [data-lf=price]");
  await t.wait(1700);
  const r1b = await byRev(1);
  q0 = await byRev(0);
  ok("R1'de fiyat değişince R1 toplamı değişti (1.662.000)", r1b.totals.grand === 1662000, String(r1b.totals.grand));
  ok("gönderilmiş ilk sürümün tutarı aynı kaldı (1.680.000)", q0.totals.grand === 1680000 && q0.items[0].price === 165000,
    q0.totals.grand + " / " + q0.items[0].price);
  await t.click('[data-nav="teklifler"]'); await t.wait(300);
  await t.click('[data-qfilter="tumu"]'); await t.wait(300);
  const listRows = await t.eval(function () {
    return [].map.call(document.querySelectorAll("tr[data-qopen]"), function (r) {
      return { id: r.getAttribute("data-qopen"), text: r.textContent };
    });
  });
  const rowsOfNo = listRows.filter(function (r) { return r.text.indexOf(NO) !== -1; }).map(function (r) { return r.id; });
  ok("listede bu teklifin yalnızca son sürümü var", rowsOfNo.length === 1 && rowsOfNo[0] === r1.id, JSON.stringify(rowsOfNo));
  await t.click('tr[data-qopen="' + r1.id + '"]'); await t.wait(400);

  /* ---------- kabul ve üretim projesi ---------- */
  await t.click("[data-qpreview]"); await t.wait(400);
  await t.click("[data-qsend]"); await t.wait(900);
  await t.click("[data-qpreviewclose]"); await t.wait(400);
  await t.click('[data-qstatus="kabul"]'); await t.wait(600);
  let acc = await byRev(1);
  ok("R1 kabul edildi", acc.status === "kabul" && !!acc.decidedAt, acc.status);
  await t.click("[data-qproject]"); await t.wait(500);
  ok("sihirbaz tekliften dolu açıldı", (await t.prop("#w-name", "value")) === "Baktat AVM", await t.prop("#w-name", "value"));
  ok("sihirbazda teklif bilgisi görünüyor", (await t.text("#main")).includes(NO + "-R1"));
  await t.fill("#w-code", "BA");
  await t.fill("#w-dueDate", "2026-12-20"); await t.change("#w-dueDate");
  await t.click('[data-wnext="2"]'); await t.wait(300);
  await t.click('[data-pick="t-2d"]'); await t.wait(150);
  await t.click('[data-wnext="3"]'); await t.wait(300);
  await t.click("[data-wsave]"); await t.wait(900);
  d = await t.db();
  acc = await byRev(1);
  const projKey = Object.keys(d).find(function (k) { return k.startsWith("projects/") && d[k].quoteId === acc.id; });
  ok("proje teklife bağlı olarak açıldı", !!projKey && d[projKey].quoteNo === NO + "-R1");
  ok("teklife proje bağlantısı yazıldı", !!projKey && acc.projectId === projKey.split("/")[1], acc.projectId);

  const log = Object.keys(d).filter(function (k) { return k.startsWith("log/"); }).map(function (k) { return d[k].action; });
  ["teklif-olustur", "teklif-durum", "teklif-revize", "teklif-proje"].forEach(function (a) {
    ok("günlükte " + a + " kaydı var", log.indexOf(a) !== -1);
  });
}
