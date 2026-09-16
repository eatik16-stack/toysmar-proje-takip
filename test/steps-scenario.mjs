// Süreç adımları senaryosu: katalog sürüm geçişi, adım tipleri, kilitler,
// görünürlük. Sürücü sözleşmesi test/suite.mjs başında yazılı.
// Ön koşul: yönetici girişli, sürüm 2 kataloğu yüklü.

export async function stepsScenario(t) {
  const ok = t.ok;
  const APP = "test/index.html";
  const toastText = function () {
    return t.eval(function () { const x = document.getElementById("toast"); return x && !x.hidden ? x.textContent : ""; });
  };
  // Satırdaki gizli dosya kutusuna sahte bir dosya bırakır (Playwright ve iframe sürücüsünde aynı çalışır).
  const upload = async function (taskId, name, type, content) {
    await t.eval(new Function(
      'const inp = document.querySelector(\'[data-upload="' + taskId + '"]\');' +
      'const dt = new DataTransfer();' +
      'dt.items.add(new File([' + JSON.stringify(content || "x") + '], ' + JSON.stringify(name) + ', { type: ' + JSON.stringify(type || "") + ' }));' +
      'inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true }));'));
    await t.wait(600);
  };
  const filesIn = async function () {
    const d = await t.db();
    return Object.keys(d).filter(function (k) { return k.startsWith("files/"); }).map(function (k) { return Object.assign({ id: k.split("/")[1] }, d[k]); });
  };

  /* ---------- dosya ve metin tipinde adımlar ---------- */
  await t.click('[data-nav="yeni"]'); await t.wait(300);
  await t.fill("#w-code", "DT"); await t.fill("#w-name", "Dosya testi");
  await t.click('[data-wnext="2"]'); await t.wait(300);
  await t.click('[data-pick="m-findeks"]'); await t.click('[data-pick="u-dikis-firma"]'); await t.click('[data-pick="t-2d"]');
  await t.click('[data-wnext="3"]'); await t.wait(300);
  await t.click("[data-wsave]"); await t.wait(700);
  let d = await t.db();
  const pidKey = Object.keys(d).find(function (k) { return k.startsWith("projects/") && d[k].code === "DT"; });
  const pid = pidKey.split("/")[1];
  const taskOf = function (stepId) {
    const k = Object.keys(d).find(function (x) { return x.startsWith("tasks/") && d[x].projectId === pid && d[x].stepId === stepId; });
    return Object.assign({ id: k.split("/")[1] }, d[k]);
  };
  const fTask = taskOf("m-findeks"), xTask = taskOf("u-dikis-firma"), cTask = taskOf("t-2d");
  ok("dosya tipinde adım açıldı", fTask.type === "file" && cTask.type === "check" && xTask.type === "text");

  await t.click('[data-task="' + fTask.id + '"] [data-toggle]'); await t.wait(300);
  d = await t.db();
  ok("dosya yüklenmeden dosya adımı tamamlanamıyor", d["tasks/" + fTask.id].status !== "tamam" && (await toastText()).includes("dosya yükleyin"));
  ok("dosya adımında yükleme bağlantısı var", (await t.count('[data-upload="' + fTask.id + '"]')) === 1);
  await upload(fTask.id, "findeks-raporu.pdf", "application/pdf", "%PDF-1.4 test");
  let files = await filesIn();
  const f1 = files.find(function (f) { return f.taskId === fTask.id; });
  ok("dosya kaydı yazıldı (proje, iş emri, yol, adres)", !!f1 && f1.projectId === pid && f1.path.indexOf("projeler/" + pid + "/" + fTask.id + "/") === 0 &&
    f1.url.indexOf("mock://") === 0 && f1.archived === false && f1.uploadedByName === "Test Yöneticisi", JSON.stringify(f1));
  ok("dosya satırda bağlantı olarak görünüyor", (await t.text('[data-task="' + fTask.id + '"]')).includes("findeks-raporu.pdf"));
  await t.click('[data-task="' + fTask.id + '"] [data-toggle]'); await t.wait(400);
  d = await t.db();
  ok("dosya yüklenince adım tamamlandı", d["tasks/" + fTask.id].status === "tamam");

  await t.eval(function () { window.__MOCK_STORAGE_FAIL__ = "storage/unknown"; });
  await upload(cTask.id, "cizim.pdf", "application/pdf", "x");
  ok("depolama kapalıyken anlaşılır uyarı", (await toastText()).includes("Depolama"), await toastText());
  ok("depolama kapalıyken dosya kaydı yazılmadı", !(await filesIn()).some(function (f) { return f.taskId === cTask.id; }));
  await t.eval(function () { window.__MOCK_STORAGE_FAIL__ = ""; });
  await upload(cTask.id, "zararli.exe", "application/octet-stream", "x");
  ok("izin verilmeyen dosya türü reddedildi", (await toastText()).includes("kabul edilmiyor"));
  await upload(cTask.id, "2d-cizim.dwg", "", "x");
  files = await filesIn();
  ok("tamamlandı-işaretli adıma isteğe bağlı dosya eklendi", files.some(function (f) { return f.taskId === cTask.id && f.name === "2d-cizim.dwg"; }));

  const xRow = '[data-task="' + xTask.id + '"]';
  ok("metin adımında metin kutusu var", (await t.count(xRow + ' [data-f="text"]')) === 1);
  await t.click(xRow + " [data-toggle]"); await t.wait(300);
  ok("metin girilmeden tamamlanamıyor", (await toastText()).includes("metni girin"));
  await t.fill(xRow + ' [data-f="text"]', "ÖZEN REKLAM"); await t.wait(400);
  d = await t.db();
  ok("metin girilince adım tamamlandı", d["tasks/" + xTask.id].text === "ÖZEN REKLAM" && d["tasks/" + xTask.id].status === "tamam" && !!d["tasks/" + xTask.id].completedByName);
  await t.fill(xRow + ' [data-f="text"]', ""); await t.wait(400);
  d = await t.db();
  ok("metin silinince adım yeniden açıldı", d["tasks/" + xTask.id].status === "bekliyor" && d["tasks/" + xTask.id].text === "");

  ok("Dosyalar sekmesinde sayı var", (await t.text('[data-ptab="dosyalar"]')).includes("2"));
  await t.click('[data-ptab="dosyalar"]'); await t.wait(300);
  ok("Dosyalar sekmesi adıma göre gruplu", (await t.text("#main")).includes("Findeks raporu") && (await t.text("#main")).includes("2D çizim") &&
    (await t.count("#main .fline")) === 2);
  await t.click('[data-filearch="' + f1.id + '"]'); await t.wait(400);
  d = await t.db();
  ok("arşive alınan dosya silinmedi, işaretlendi", !!d["files/" + f1.id] && d["files/" + f1.id].archived === true);
  ok("arşivdeki dosya listeden düştü", (await t.count("#main .fline")) === 1);
  await t.click("[data-filesarch]"); await t.wait(300);
  ok("“Arşivdekiler” ile geri görünüyor", (await t.count("#main .fline")) === 2 && (await t.text("#main")).includes("arşiv"));
  await t.click("[data-filesarch]"); await t.wait(200);
  await t.click('[data-ptab="isler"]'); await t.wait(200);
  ok("dosya adımı dosyası arşive alınınca yeniden açılabilir durumda", (await t.text('[data-task="' + fTask.id + '"]')).includes("dosya"));

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
  d = await t.db();
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
