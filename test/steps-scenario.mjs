// Süreç adımları senaryosu: katalog sürüm geçişi, adım tipleri, kilitler,
// görünürlük. Sürücü sözleşmesi test/suite.mjs başında yazılı.
// Ön koşul: yönetici girişli, sürüm 2 kataloğu yüklü.

export async function stepsScenario(t) {
  const ok = t.ok;
  const APP = "test/index.html";

  /* ---------- sürüm 1 katalogdan geçiş ---------- */
  // Eski kurulum taklit edilir: 33 adımlık katalog, eski departmanlar,
  // Metal'de bir personel, Kaplama'ya açık bir iş emri.
  await t.eval(function () {
    const d = JSON.parse(sessionStorage.getItem("toysmar.mockdb") || "{}");
    d["config/catalog"] = {
      groups: [{ id: "uretim", label: "Üretim Prosesi", order: 1 }],
      steps: [
        { id: "s-cizim", name: "Çizim", group: "uretim", dept: "d-cizim", type: "check", unit: "", order: 1 },
        { id: "s-metal", name: "Metal", group: "uretim", dept: "d-metal", type: "check", unit: "", order: 2 },
        { id: "s-kaplama", name: "Kaplama", group: "uretim", dept: "d-kaplama", type: "check", unit: "", order: 3 }
      ]
    };
    const org = d["config/org"] || { departments: [], people: [] };
    org.departments = [
      { id: "d-cizim", name: "Çizim / Tasarım" }, { id: "d-metal", name: "Metal" }, { id: "d-kaplama", name: "Kaplama" },
      { id: "d-mdf", name: "MDF" }, { id: "d-montaj", name: "Montaj" }, { id: "d-satinalma", name: "Satın Alma" },
      { id: "d-sevkiyat", name: "Sevkiyat" }, { id: "d-idari", name: "İdari" }
    ];
    org.people = (org.people || []).map(function (p) {
      if (p.name === "Ayşe Yılmaz") return Object.assign({}, p, { dept: "d-metal", section: "" });
      if (p.name === "Mehmet Demir") return Object.assign({}, p, { dept: "d-idari", section: "" });
      return p;
    });
    d["config/org"] = org;
    d["allowed/ayse@toysmar.test"].dept = "d-metal"; d["allowed/ayse@toysmar.test"].section = "";
    d["tasks/eski-kaplama"] = { projectId: "", stepId: "s-kaplama", name: "Eski kaplama işi", group: "uretim", type: "check",
      dept: "d-kaplama", assignee: "", status: "bekliyor", createdAt: "2026-01-01T00:00:00.000Z", order: 0 };
    sessionStorage.setItem("toysmar.mockdb", JSON.stringify(d));
    localStorage.setItem("toysmar.view", "panel");
  });
  await t.goto(APP);
  ok("eski katalogda yöneticiye geçiş uyarısı çıkıyor", (await t.text("#main")).includes("Adım kataloğu eski sürümde"));
  await t.click('[data-nav="ayarlar"]'); await t.wait(400);
  ok("Ayarlar'da geçiş paneli var", (await t.count('[data-confirm="migrate:v2"]')) === 1);
  await t.click('[data-confirm="migrate:v2"]'); await t.wait(300);
  ok("geçiş için ikinci onay istendi", (await t.text('[data-confirm="migrate:v2"]')).includes("Emin misiniz"));
  await t.click('[data-confirm="migrate:v2"]'); await t.wait(900);
  let d = await t.db();
  ok("katalog sürüm 2'ye geçti: 65 adım", d["config/catalog"].version === 2 && d["config/catalog"].steps.length === 65);
  const ayse = d["config/org"].people.find(function (p) { return p.name === "Ayşe Yılmaz"; });
  ok("Metal personeli Üretim Planlama · Metal bölümüne taşındı", !!ayse && ayse.dept === "d-uretim" && ayse.section === "metal", JSON.stringify(ayse));
  ok("giriş yetkisi kaydı da taşındı", d["allowed/ayse@toysmar.test"].dept === "d-uretim" && d["allowed/ayse@toysmar.test"].section === "metal");
  ok("Kaplama'daki açık iş Üretim Planlama · Kaplama'ya taşındı", d["tasks/eski-kaplama"].dept === "d-uretim" && d["tasks/eski-kaplama"].section === "kaplama");
  ok("eski adım kimliği iş emrinde korundu", d["tasks/eski-kaplama"].stepId === "s-kaplama");
  ok("yöneticinin eklediği departman (İdari) korundu", d["config/org"].departments.some(function (x) { return x.id === "d-idari"; }) &&
    d["config/org"].departments.length === 10, String(d["config/org"].departments.length));
  ok("geçiş uyarısı kalktı", (await t.count('[data-confirm="migrate:v2"]')) === 0);
  await t.click('[data-nav="projeler"]'); await t.wait(300);
  await t.click('[data-projview="matris"]'); await t.wait(300);
  ok("eski adım kimlikli iş emri matriste yeni sütuna oturdu", (await t.count("#main table.matrix")) === 1 &&
    (await t.text("#main")).includes("Kaplama — kaplama tamamlandı"));
  d = await t.db();
  const log = Object.keys(d).filter(function (k) { return k.startsWith("log/"); }).map(function (k) { return d[k].detail || ""; });
  ok("geçiş günlüğe yazıldı", log.some(function (x) { return x.indexOf("sürüm 2") !== -1; }));
}
