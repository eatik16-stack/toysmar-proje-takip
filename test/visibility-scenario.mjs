// Görünürlük senaryosu (karar 6): yönetici, planlamacı, muhasebe ve satış her
// şeyi; şef departmanının tamamını; personel yalnızca bölümünü görür. Herkes
// başka departmana iş emri açabilir, "Açtıklarım"da izler ama kapatamaz.
// Ön koşul (önceki bölümlerden): ayse@toysmar.test personel · Üretim Planlama · Metal,
// mehmet@toysmar.test şef · Üretim Planlama, "Dosya testi" projesi (Metal işi yok).

export async function visibilityScenario(t) {
  const ok = t.ok;
  const APP = "test/index.html";
  const txt = t.text;
  const taskNames = function () {
    return t.eval(function () {
      return [].map.call(document.querySelectorAll("#main [data-task] .tn"), function (x) { return x.textContent.trim(); });
    });
  };

  // Kurulum: üç yeni kişi, beş departmana yayılan bir proje.
  await t.eval(function () {
    const d = JSON.parse(sessionStorage.getItem("toysmar.mockdb") || "{}");
    const org = d["config/org"];
    const add = function (id, name, dept, section, email, role) {
      org.people.push({ id: id, name: name, dept: dept, section: section, email: email });
      d["allowed/" + email] = { name: name, role: role, dept: dept, section: section, personId: id };
    };
    add("p-kemal", "Kemal Kaplama", "d-uretim", "kaplama", "kemal@toysmar.test", "personel");
    add("p-selin", "Selin Tedarik", "d-satinalma", "", "selin@toysmar.test", "sef");
    add("p-mali", "Mali Müşavir", "d-muhasebe", "", "mali@toysmar.test", "muhasebe");
    d["config/org"] = org;
    d["projects/gr"] = { code: "GR", name: "Görünürlük Parkı", status: "aktif", archived: false,
      startDate: "2026-09-01", dueDate: "2026-12-01", createdAt: "2026-09-01T00:00:00.000Z", createdBy: "yonetici@toysmar.test" };
    const task = function (id, stepId, name, group, dept, section, type, extra) {
      d["tasks/" + id] = Object.assign({ projectId: "gr", stepId: stepId, name: name, group: group, dept: dept, section: section,
        type: type, unit: "", assignee: "", qty: "", doneQty: "", shortClosed: false, status: "bekliyor", dueDate: "2026-11-01",
        completedAt: "", completedBy: "", completedByName: "", order: 1, createdAt: "2026-09-01T00:00:00.000Z" }, extra || {});
    };
    task("gr-metal", "u-metal-panel", "GR metal panel", "uretim", "d-uretim", "metal", "qty", { unit: "adet", qty: "5" });
    task("gr-kaplama", "u-kaplama-panel", "GR kaplama", "uretim", "d-uretim", "kaplama", "check");
    task("gr-dikis", "u-dikis-firma", "GR dikiş firması", "uretim", "d-uretim", "dikis", "text");
    task("gr-satin", "sa-aktivite-masa", "GR satın alma masa", "satinalma", "d-satinalma", "", "qty", { unit: "adet", qty: "3" });
    task("gr-muh", "m-siparis-onay", "GR sipariş onayı", "muhasebe", "d-muhasebe", "", "check");
    sessionStorage.setItem("toysmar.mockdb", JSON.stringify(d));
    localStorage.setItem("toysmar.view", "projeler");
  });

  /* ---------- personel: yalnızca kendi bölümü ---------- */
  await t.goto(APP + "?as=ayse@toysmar.test");
  let nav = await txt("#nav");
  ok("personelde Panel yok", !nav.includes("Panel"), nav);
  let main = await txt("#main");
  ok("personel yalnızca bölümünde işi olan projeleri listeliyor", main.includes("Görünürlük Parkı") && !main.includes("Dosya testi"), main.slice(0, 300));
  await t.click('[data-open-proj="gr"]'); await t.wait(400);
  let names = await taskNames();
  ok("metal ustası yalnızca Metal bölümünün işini görüyor", names.length === 1 && names[0] === "GR metal panel", names.join(" | "));

  await t.click('[data-nav="projedisi"]'); await t.wait(300);
  ok("personel de iş emri açabiliyor", (await t.count("[data-newjob]")) >= 1);
  await t.click("[data-newjob]"); await t.wait(250);
  await t.fill("#m-name", "Vida siparişi");
  await t.select("#m-dept", "d-satinalma"); await t.wait(100);
  await t.click("[data-msave]"); await t.wait(600);
  let d = await t.db();
  const jobKey = Object.keys(d).find(function (k) { return k.startsWith("tasks/") && d[k].name === "Vida siparişi"; });
  const job = jobKey ? d[jobKey] : null;
  const jobId = jobKey ? jobKey.split("/")[1] : "";
  ok("başka departmana iş emri açıldı", !!job && job.dept === "d-satinalma" && job.projectId === "");
  ok("açan kişi ve departmanı iş emrinde", !!job && job.openedBy === "ayse@toysmar.test" && job.openedByDept === "d-uretim" && !!job.openedByName, JSON.stringify(job));
  await t.click('[data-jobfilter="actiklarim"]'); await t.wait(300);
  names = await taskNames();
  ok("“Açtıklarım” süzgecinde görünüyor", names.length === 1 && names[0] === "Vida siparişi", names.join(" | "));
  ok("açan kişi kapatamıyor, durumu izliyor", (await t.count('[data-task="' + jobId + '"] [data-toggle]')) === 0 && (await txt("#main")).includes("açtınız"));

  /* ---------- kaplama personeli ---------- */
  await t.eval(function () { localStorage.setItem("toysmar.view", "projeler"); });
  await t.goto(APP + "?as=kemal@toysmar.test");
  await t.click('[data-open-proj="gr"]'); await t.wait(400);
  names = await taskNames();
  ok("kaplama personeli yalnızca Kaplama işini görüyor", names.length === 1 && names[0] === "GR kaplama", names.join(" | "));
  ok("bölümüne açık işi kapatabiliyor", (await t.count('[data-task="gr-kaplama"] [data-toggle]')) === 1);

  /* ---------- şef: departmanının tüm bölümleri ---------- */
  await t.eval(function () { localStorage.setItem("toysmar.view", "projeler"); });
  await t.goto(APP + "?as=mehmet@toysmar.test");
  nav = await txt("#nav");
  ok("şef Panel görüyor", nav.includes("Panel"), nav);
  await t.click('[data-open-proj="gr"]'); await t.wait(400);
  names = await taskNames();
  ok("Üretim Planlama şefi Metal, Kaplama ve Dikiş'i görüyor, Satın Alma'yı görmüyor",
    names.length === 3 && names.indexOf("GR metal panel") !== -1 && names.indexOf("GR kaplama") !== -1 && names.indexOf("GR dikiş firması") !== -1,
    names.join(" | "));
  await t.click('[data-nav="projedisi"]'); await t.wait(300);
  await t.click('[data-jobfilter="tumu"]'); await t.wait(200);
  ok("şef başka departmanın işini görmüyor", !(await txt("#main")).includes("Vida siparişi"));

  /* ---------- satın alma şefi ---------- */
  await t.eval(function () { localStorage.setItem("toysmar.view", "projeler"); });
  await t.goto(APP + "?as=selin@toysmar.test");
  main = await txt("#main");
  ok("Satın Alma şefi yalnızca kalemi olan projeleri görüyor", main.includes("Görünürlük Parkı") && !main.includes("Dosya testi"), main.slice(0, 300));
  await t.click('[data-open-proj="gr"]'); await t.wait(400);
  names = await taskNames();
  ok("Satın Alma şefi yalnızca satın alma kalemini görüyor", names.length === 1 && names[0] === "GR satın alma masa", names.join(" | "));
  await t.click('[data-nav="projedisi"]'); await t.wait(300);
  ok("başka departmanın açtığı iş hedef departmanda görünüyor", (await txt("#main")).includes("Vida siparişi"));
  await t.click('[data-task="' + jobId + '"] [data-toggle]'); await t.wait(400);
  d = await t.db();
  ok("hedef departman iş emrini kapattı", d[jobKey].status === "tamam" && d[jobKey].completedBy === "selin@toysmar.test", JSON.stringify(d[jobKey]));

  /* ---------- muhasebe: her şeyi görür, kendi departmanını yürütür ---------- */
  await t.eval(function () { localStorage.setItem("toysmar.view", "projeler"); });
  await t.goto(APP + "?as=mali@toysmar.test");
  nav = await txt("#nav");
  ok("muhasebe Panel ve Projeler görüyor, proje açamıyor", nav.includes("Panel") && nav.includes("Projeler") && !nav.includes("Yeni Proje") && !nav.includes("Ayarlar"), nav);
  main = await txt("#main");
  ok("muhasebe tüm projeleri listeliyor", main.includes("Görünürlük Parkı") && main.includes("Dosya testi"));
  await t.click('[data-open-proj="gr"]'); await t.wait(400);
  names = await taskNames();
  ok("muhasebe projedeki tüm iş emirlerini görüyor", names.length === 5, names.join(" | "));
  ok("muhasebe sekmesi var", (await t.count('[data-ptab="muhasebe"]')) === 1);
  ok("muhasebe başka departmanın işini kapatamıyor", (await t.count('[data-task="gr-satin"] [data-toggle]')) === 0);
  await t.click('[data-task="gr-muh"] [data-toggle]'); await t.wait(400);
  d = await t.db();
  ok("muhasebe kendi departmanının işini kapattı", d["tasks/gr-muh"].status === "tamam");
  await t.click('[data-ptab="muhasebe"]'); await t.wait(300);
  ok("muhasebe sekmesi açıldı", (await t.count("#main [data-acc]")) > 0);

  /* ---------- yönetici: rol listesi ---------- */
  await t.eval(function () { localStorage.setItem("toysmar.view", "ayarlar"); });
  await t.goto(APP);
  await t.click("[data-addperson]"); await t.wait(250);
  ok("personel penceresinde muhasebe rolü seçilebiliyor", (await t.count('#m-role option[value="muhasebe"]')) === 1);
  await t.click("#modal-root .modal-foot [data-mclose]"); await t.wait(100);
  await t.click('[data-nav="talepler"]'); await t.wait(300);
  main = await txt("#main");
  ok("rol tablosunda muhasebe ve görünürlük sütunu var", main.includes("Muhasebe") && main.includes("Gördüğü iş emirleri"));
}
