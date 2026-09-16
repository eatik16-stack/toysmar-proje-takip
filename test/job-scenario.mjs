// Proje dışı iş emirleri uçtan uca senaryosu.
// Sürücü sözleşmesi test/quote-scenario.mjs ile aynıdır.
// Ön koşul: yönetici (yonetici@toysmar.test) girişli, üretim kataloğu yüklü.

export async function jobScenario(t) {
  const ok = t.ok;
  const iso = function (days) {
    const d = new Date(); d.setDate(d.getDate() + days);
    const m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  };
  const jobsIn = async function () {
    const d = await t.db();
    return Object.keys(d).filter(function (k) { return k.startsWith("tasks/") && !d[k].projectId; })
      .map(function (k) { return Object.assign({ id: k.split("/")[1] }, d[k]); });
  };
  const jobNamed = async function (name) {
    return (await jobsIn()).find(function (x) { return x.name === name; });
  };
  const kpis = function () {
    return t.eval(function () {
      const o = {};
      document.querySelectorAll("#main .kpis .kpi").forEach(function (k) {
        o[k.querySelector(".l").textContent] = Number(k.querySelector(".n").textContent);
      });
      return o;
    });
  };
  const before = (await jobsIn()).length;
  let d = await t.db();
  const me = (d["config/org"].people || []).find(function (p) { return p.email === "yonetici@toysmar.test"; });

  /* ---------- sekme ve yeni iş emri ---------- */
  await t.click('[data-nav="projedisi"]'); await t.wait(400);
  ok("Proje Dışı İşler sekmesi açıldı", (await t.text("#main h1")) === "Proje dışı işler", await t.text("#main h1"));
  await t.click("[data-newjob]"); await t.wait(300);
  ok("yeni iş emri penceresi açıldı", (await t.count("#modal-root #m-name")) === 1);
  await t.click("[data-msave]"); await t.wait(300);
  ok("adı boş iş emri açılmadı", (await jobsIn()).length === before && (await t.count("#modal-root #m-name")) === 1);

  await t.fill("#m-name", "Kaynak makinesi bakımı");
  await t.fill("#m-spec", "Yıllık bakım, tel besleme ünitesi kontrolü");
  await t.select("#m-dept", "d-uretim"); await t.wait(100);
  ok("bölümlü departmanda bölüm alanı açıldı", !(await t.prop("#m-section-wrap", "hidden")));
  await t.select("#m-section", "metal"); await t.wait(100);
  ok("sorumlu listesi departman ve bölüme göre süzüldü",
    (await t.eval(function () { return [].map.call(document.querySelectorAll("#m-assignee option"), function (o) { return o.textContent; }).join("|"); })).includes("Test Yöneticisi"));
  await t.select("#m-assignee", me.id);
  await t.fill("#m-dueDate", iso(-2)); await t.change("#m-dueDate");
  await t.click("[data-msave]"); await t.wait(500);
  const j1 = await jobNamed("Kaynak makinesi bakımı");
  ok("proje dışı iş emri açıldı", !!j1 && j1.projectId === "" && j1.status === "bekliyor");
  ok("departman, bölüm, sorumlu, termin kaydedildi", !!j1 && j1.dept === "d-uretim" && j1.section === "metal" && j1.assignee === me.id && j1.dueDate === iso(-2),
    JSON.stringify(j1 && { dept: j1.dept, section: j1.section }));
  ok("açan kişi kaydedildi", !!j1 && j1.createdByName === "Test Yöneticisi", j1 && j1.createdByName);

  /* ---------- pencere açıkken gelen güncelleme yazılanı silmez ---------- */
  await t.click("[data-newjob]"); await t.wait(300);
  await t.fill("#m-name", "Numune panel");
  await t.eval(function () {
    const M = window.__TOYSMAR_MOCK__, db = window.__MOCK_DB__;
    const k = Object.keys(db).find(function (x) { return x.startsWith("tasks/") && db[x].name === "Kaynak makinesi bakımı"; });
    return M.updateDoc(M.doc(null, "tasks", k.split("/")[1]), { note: "başka oturumdan güncelleme" });
  });
  await t.wait(300);
  ok("başka bir güncelleme gelince pencerede yazılan kaybolmadı", (await t.prop("#m-name", "value")) === "Numune panel",
    await t.prop("#m-name", "value"));
  await t.select("#m-dept", "d-tasarim"); await t.wait(100);
  ok("bölümsüz departmanda bölüm alanı gizli", await t.prop("#m-section-wrap", "hidden"));
  await t.select("#m-type", "qty"); await t.wait(100);
  await t.click("[data-msave]"); await t.wait(300);
  ok("adet takipli işte gereken adet zorunlu", !(await jobNamed("Numune panel")));
  await t.fill("#m-qty", "10");
  await t.fill("#m-unit", "adet");
  await t.fill("#m-dueDate", iso(20)); await t.change("#m-dueDate");
  await t.click("#m-urgent");
  await t.click("[data-msave]"); await t.wait(500);
  const j2 = await jobNamed("Numune panel");
  ok("adet takipli acil iş emri açıldı", !!j2 && j2.type === "qty" && j2.qty === "10" && j2.urgent === true && j2.dept === "d-tasarim");
  ok("sorumlusu atanmamış iş departmanın işi olarak açıldı", !!j2 && j2.assignee === "" && j2.section === "");

  /* ---------- liste, sayılar ve süzgeçler ---------- */
  let k = await kpis();
  ok("KPI: açık 2, geciken 1, acil 1", k["Açık iş"] === 2 && k["Geciken"] === 1 && k["Acil"] === 1, JSON.stringify(k));
  ok("açık süzgeçte iki satır", (await t.count("#main [data-task]")) === 2, String(await t.count("#main [data-task]")));
  ok("departman bantlarıyla gruplandı, bölüm etiketi satırda",
    (await t.text("#main")).includes("Tasarım") && (await t.text("#main")).includes("Üretim Planlama") &&
    (await t.eval(function () { return [].map.call(document.querySelectorAll("#main [data-task] .tspec .tag"), function (x) { return x.textContent; }).join("|"); })).includes("Metal"));
  ok("acil etiketi görünüyor", (await t.count("#main .tag-urgent")) === 1);
  await t.click('[data-jobfilter="gecikti"]'); await t.wait(250);
  ok("geciken süzgeci", (await t.count("#main [data-task]")) === 1 && (await t.text("#main")).includes("Kaynak makinesi bakımı"));
  await t.click('[data-jobfilter="acil"]'); await t.wait(250);
  ok("acil süzgeci", (await t.count("#main [data-task]")) === 1 && (await t.text("#main")).includes("Numune panel"));
  await t.click('[data-jobfilter="tumu"]'); await t.wait(250);
  await t.select("#job-dept", "d-tasarim"); await t.wait(250);
  ok("departman süzgeci", (await t.count("#main [data-task]")) === 1);
  await t.select("#job-dept", ""); await t.wait(250);
  await t.fill("#job-search", "tel besleme"); await t.wait(250);
  ok("açıklamada arama", (await t.count("#main [data-task]")) === 1 && (await t.text("#main")).includes("Kaynak makinesi bakımı"));
  await t.fill("#job-search", ""); await t.wait(250);

  /* ---------- adet kuralı proje dışı işte de geçerli ---------- */
  const row2 = '#main [data-task="' + j2.id + '"]';
  await t.click(row2 + " [data-toggle]"); await t.wait(300);
  ok("gereken adet girilmeden tamamlanmadı", (await jobNamed("Numune panel")).status !== "tamam");
  await t.fill(row2 + ' [data-f="doneQty"]', "10"); await t.change(row2 + ' [data-f="doneQty"]'); await t.wait(400);
  await t.click(row2 + " [data-toggle]"); await t.wait(400);
  const j2b = await jobNamed("Numune panel");
  ok("10/10 olunca tamamlandı", j2b.status === "tamam" && !!j2b.completedByName);
  await t.click('[data-jobfilter="tamam"]'); await t.wait(250);
  ok("tamamlanan süzgecinde görünüyor", (await t.count("#main [data-task]")) === 1);
  await t.click('[data-jobfilter="acik"]'); await t.wait(250);

  /* ---------- düzenleme ---------- */
  await t.click('[data-editjob="' + j1.id + '"]'); await t.wait(300);
  await t.fill("#m-name", "Kaynak makinesi yıllık bakımı");
  await t.click("#m-urgent");
  await t.click("[data-msave]"); await t.wait(500);
  const j1b = await jobNamed("Kaynak makinesi yıllık bakımı");
  ok("iş emri adı ve acil işareti düzenlendi", !!j1b && j1b.urgent === true && j1b.dept === "d-uretim" && j1b.section === "metal");

  /* ---------- panel: iki yarı ---------- */
  await t.click('[data-nav="panel"]'); await t.wait(400);
  const sides = await t.eval(function () {
    return [].map.call(document.querySelectorAll(".side"), function (s) {
      const o = { title: s.querySelector("h2").textContent, kpi: {}, att: "" };
      s.querySelectorAll(".kpi").forEach(function (x) { o.kpi[x.querySelector(".l").textContent] = Number(x.querySelector(".n").textContent); });
      const tb = s.querySelector("table.att"); o.att = tb ? tb.textContent : "";
      return o;
    });
  });
  ok("panel iki yarıya ayrıldı", sides.length === 2 && sides[0].title === "Proje işleri" && sides[1].title === "Proje dışı işler",
    sides.map(function (s) { return s.title; }).join(" | "));
  ok("proje dışı yarının metrikleri doğru (açık 1, geciken 1, acil 1)",
    sides[1] && sides[1].kpi["Açık iş"] === 1 && sides[1].kpi["Geciken"] === 1 && sides[1].kpi["Acil"] === 1, JSON.stringify(sides[1] && sides[1].kpi));
  ok("geciken acil iş proje dışı dikkat listesinde", sides[1] && sides[1].att.includes("Kaynak makinesi yıllık bakımı"));
  ok("proje dışı iş proje yarısına karışmadı", sides[0] && !sides[0].att.includes("Kaynak makinesi"));
  ok("departman yükünde proje dışı iş ayrı gösteriliyor", (await t.text("#main")).includes("proje dışı iş"));

  /* ---------- İşlerim ---------- */
  await t.click('[data-nav="isler"]'); await t.wait(400);
  ok("atanan kişinin İşlerim ekranında görünüyor", (await t.text("#main")).includes("Kaynak makinesi yıllık bakımı"));
  ok("İşlerim'de “Proje dışı” etiketi var", (await t.count("#main .tag-job")) >= 1);

  /* ---------- silme (yönetici) ---------- */
  await t.click('[data-nav="projedisi"]'); await t.wait(300);
  await t.click('[data-jobfilter="tumu"]'); await t.wait(250);
  await t.click('[data-editjob="' + j2.id + '"]'); await t.wait(300);
  await t.click('[data-confirm="deljob:' + j2.id + '"]'); await t.wait(300);
  ok("silmeden önce onay istendi", (await t.text('[data-confirm="deljob:' + j2.id + '"]')) === "Emin misiniz?");
  await t.click('[data-confirm="deljob:' + j2.id + '"]'); await t.wait(500);
  ok("iş emri silindi", !(await jobNamed("Numune panel")));
  d = await t.db();
  const log = Object.keys(d).filter(function (x) { return x.startsWith("log/"); }).map(function (x) { return d[x].action; });
  ok("günlükte oluşturma ve silme kaydı var", log.indexOf("is-emri-olustur") !== -1 && log.indexOf("is-emri-sil") !== -1);
}
