// Firestore veri katmanı: gerçek zamanlı okuma + yazma yardımcıları.
// Her değiştirici işlem "log" koleksiyonuna da bir satır yazar; o koleksiyon
// salt eklemedir (kurallarda update/delete kapalı), yani geçmiş kaybolmaz.

import { fb } from "./fb.js";
import {
  myEmail, myName, myRole, isAdmin, canPlan, canSell, canAccount,
  seesAll, myDept, mySection, myPersonId
} from "./auth.js";
import { uid, byId } from "./util.js";
import { CATALOG_VERSION, DEFAULT_SECTIONS, LEGACY_DEPT_MAP } from "./seed.js";

export const data = {
  groups: [], steps: [],          // config/catalog
  sections: {},                   // config/catalog.sections — departman → bölümler
  catalogVersion: 0,              // config/catalog.version (0: yüklenmemiş, 1: eski, 2: güncel)
  depts: [],  people: [],         // config/org
  members: [],                    // allowed/*  (giriş yetkisi olanlar)
  requests: [],                   // requests/* (bekleyen erişim talepleri)
  projects: [], tasks: [],
  files: [],                      // files/*    (iş emrine bağlı dosya kayıtları)
  locks: {},                      // locks/<projectId> — kilitler için iş emri durum özeti
  accounting: {},                 // accounting/<projectId> (yalnızca yönetici ve muhasebe)
  quotes: [],                     // quotes/*   (yalnızca satış rollerinde)
  sales: null,                    // sales/settings
  products: [],                   // sales/catalog
  catalogMeta: null,              // sales/catalog.lastImport
  loaded: { catalog: false, org: false, members: false, projects: false, tasks: false,
            quotes: false, sales: false, products: false }
};

let unsubs = [];

function rowsOf(snap) {
  const out = [];
  snap.forEach(function (d) {
    const o = Object.assign({}, d.data());
    o.id = d.id;
    out.push(o);
  });
  return out;
}

export async function subscribeAll(onChange, onError) {
  const f = await fb();
  stopAll();

  const fail = function (label) {
    return function (e) {
      if (onError) onError(label, e);
    };
  };

  unsubs.push(f.onSnapshot(f.doc(f.db, "config", "catalog"), function (s) {
    const d = (s.exists() && s.data()) || {};
    data.steps = Array.isArray(d.steps) ? d.steps.slice() : [];
    data.groups = Array.isArray(d.groups) ? d.groups.slice() : [];
    data.sections = (d.sections && typeof d.sections === "object") ? d.sections : {};
    data.catalogVersion = data.steps.length ? (Number(d.version) || 1) : 0;
    data.loaded.catalog = true; onChange();
  }, fail("katalog")));

  unsubs.push(f.onSnapshot(f.doc(f.db, "config", "org"), function (s) {
    const d = (s.exists() && s.data()) || {};
    data.depts = Array.isArray(d.departments) ? d.departments.slice() : [];
    data.people = Array.isArray(d.people) ? d.people.slice() : [];
    data.loaded.org = true; onChange();
  }, fail("departman/personel")));

  unsubs.push(f.onSnapshot(f.collection(f.db, "allowed"), function (s) {
    data.members = rowsOf(s);
    data.loaded.members = true; onChange();
  }, fail("giriş yetkileri")));

  // Talepleri yalnızca yönetici okuyabilir; diğer rollerde kurallar reddeder.
  if (isAdmin()) {
    unsubs.push(f.onSnapshot(f.collection(f.db, "requests"), function (s) {
      data.requests = rowsOf(s);
      onChange();
    }, fail("erişim talepleri")));
  } else {
    data.requests = [];
  }

  unsubs.push(f.onSnapshot(f.collection(f.db, "projects"), function (s) {
    data.projects = rowsOf(s);
    data.loaded.projects = true; onChange();
  }, fail("projeler")));

  // Şef ve personel yalnızca kapsamındaki iş emirlerini ve dosyaları çeker;
  // kurallar da yalnızca bu sorgulara izin verir (koleksiyonun tamamı reddedilir).
  subscribeScoped(f, "tasks", function (rows, complete) {
    data.tasks = rows.filter(canSeeTask);
    if (complete) data.loaded.tasks = true;
    onChange();
  }, fail("iş emirleri"));

  subscribeScoped(f, "files", function (rows) {
    data.files = rows;
    onChange();
  }, fail("dosyalar"));

  // Kilit özeti: projedeki iş emirlerinin durumları (js/locks.js). Görünürlük
  // kapsamı dışındaki iş emirleri de buradan değerlendirilir; gizli bilgi taşımaz.
  unsubs.push(f.onSnapshot(f.collection(f.db, "locks"), function (s) {
    const map = {};
    rowsOf(s).forEach(function (r) { map[r.id] = r; });
    data.locks = map;
    onChange();
  }, fail("kilit özeti")));

  // Muhasebe bilgileri proje belgesinde değil, ayrı koleksiyonda: diğer roller okuyamaz.
  if (canAccount()) {
    unsubs.push(f.onSnapshot(f.collection(f.db, "accounting"), function (s) {
      const map = {};
      rowsOf(s).forEach(function (r) { map[r.id] = r; });
      data.accounting = map;
      onChange();
    }, fail("muhasebe bilgileri")));
  } else {
    data.accounting = {};
  }

  // Fiyatlar yalnızca satış rollerine açık; diğer rollerde kurallar reddeder.
  if (canSell()) {
    unsubs.push(f.onSnapshot(f.collection(f.db, "quotes"), function (s) {
      data.quotes = rowsOf(s);
      data.loaded.quotes = true; onChange();
    }, fail("teklifler")));
    unsubs.push(f.onSnapshot(f.doc(f.db, "sales", "settings"), function (s) {
      data.sales = (s.exists() && s.data()) || null;
      data.loaded.sales = true; onChange();
    }, fail("teklif ayarları")));
    unsubs.push(f.onSnapshot(f.doc(f.db, "sales", "catalog"), function (s) {
      const d = (s.exists() && s.data()) || {};
      data.products = Array.isArray(d.products) ? d.products.slice() : [];
      data.catalogMeta = d.lastImport || null;   // son fiyat listesi içe aktarımı
      data.loaded.products = true; onChange();
    }, fail("ürün kataloğu")));
  } else {
    data.quotes = []; data.sales = null; data.products = [];
  }
}

export function stopAll() {
  unsubs.forEach(function (u) { try { u(); } catch (e) {} });
  unsubs = [];
}

/* ---------------- görünürlük kapsamı (karar 6) ---------------- */

// Giriş yapanın departmanı, bölümü ve personel kimliği: önce yetki kaydından,
// yoksa personel listesinden.
function scope() {
  const p = mePerson();
  return {
    dept: myDept() || (p && p.dept) || "",
    section: mySection() || (p && p.section) || "",
    personId: myPersonId() || (p && p.id) || ""
  };
}

// Kapsamlı rollerin (şef, personel) sorguları. Bölümlü personelde kendi bölümü
// ve bölümsüz iş emirleri iki ayrı sorgudur; yalnızca eşitlik içerdiklerinden
// Firestore bileşik dizin istemez. Herkes kendi açtığı ve kendine atanan işi görür.
function scopedQueries(f, col) {
  const c = f.collection(f.db, col), sc = scope(), qs = [];
  if (sc.dept) {
    if (myRole() === "personel" && sc.section) {
      qs.push(f.query(c, f.where("dept", "==", sc.dept), f.where("section", "==", sc.section)));
      qs.push(f.query(c, f.where("dept", "==", sc.dept), f.where("section", "==", "")));
    } else {
      qs.push(f.query(c, f.where("dept", "==", sc.dept)));
    }
  }
  if (col === "tasks") {
    qs.push(f.query(c, f.where("openedBy", "==", myEmail())));
    if (sc.personId) qs.push(f.query(c, f.where("assignee", "==", sc.personId)));
  } else {
    qs.push(f.query(c, f.where("uploadedBy", "==", myEmail())));
  }
  return qs;
}

// Her şeyi gören rollerde koleksiyonun tamamı, diğerlerinde kapsam sorguları
// dinlenir; parçalar kimliğe göre birleştirilir.
function subscribeScoped(f, col, apply, onErr) {
  if (seesAll()) {
    unsubs.push(f.onSnapshot(f.collection(f.db, col), function (s) { apply(rowsOf(s), true); }, onErr));
    return;
  }
  const qs = scopedQueries(f, col);
  const parts = qs.map(function () { return null; });
  qs.forEach(function (q, i) {
    unsubs.push(f.onSnapshot(q, function (s) {
      parts[i] = rowsOf(s);
      const map = {};
      parts.forEach(function (rows) { (rows || []).forEach(function (r) { map[r.id] = r; }); });
      apply(Object.keys(map).map(function (k) { return map[k]; }), parts.every(Boolean));
    }, onErr));
  });
}

// Kimin hangi iş emrini gördüğü: yönetici, planlamacı, muhasebe ve satış
// hepsini; şef departmanının tamamını; personel bölümünü (bölümü yoksa
// departmanını). Herkes kendi açtığı ve kendine atanan işi görür.
// Aynı sınır firestore.rules içinde (tasks okuma).
export function canSeeTask(t) {
  if (seesAll()) return true;
  const sc = scope();
  if (t.openedBy && t.openedBy === myEmail()) return true;
  if (sc.personId && t.assignee === sc.personId) return true;
  if (!sc.dept || t.dept !== sc.dept) return false;
  if (myRole() === "sef") return true;
  return !sc.section || !t.section || t.section === sc.section;
}

/* ---------------- günlük ---------------- */

export async function writeLog(action, target, detail) {
  try {
    const f = await fb();
    await f.addDoc(f.collection(f.db, "log"), {
      at: f.serverTimestamp(),
      atISO: new Date().toISOString(),
      by: myEmail(),
      byName: myName(),
      action: action,
      target: target || "",
      detail: detail || ""
    });
  } catch (e) {
    // Günlük yazılamazsa asıl iş yine de sürsün.
    console.warn("log yazılamadı", e);
  }
}

export async function loadLog(n) {
  const f = await fb();
  const q = f.query(f.collection(f.db, "log"), f.orderBy("atISO", "desc"), f.limit(n || 60));
  const s = await f.getDocs(q);
  return rowsOf(s);
}

// Proje kartındaki Kayıtlar sekmesi: projeye ve iş emirlerine ait son kayıtlar.
export async function loadProjectLog(pid) {
  const ids = {}; ids[pid] = true;
  data.tasks.forEach(function (t) { if (t.projectId === pid) ids[t.id] = true; });
  const rows = await loadLog(500);
  return rows.filter(function (r) { return ids[r.target]; });
}

// Excel'den çıkarılmış projeleri toplu yazar (js/import.js hazırlar).
// Her proje: belge + iş emirleri + kilit özeti + muhasebe. Günlüğe tek satır.
export async function importProjects(items, source) {
  const f = await fb();
  let batch = f.writeBatch(f.db), ops = 0, taskCount = 0;
  const flush = async function () { if (ops) { await batch.commit(); batch = f.writeBatch(f.db); ops = 0; } };
  for (const it of items) {
    if (ops > 380) await flush();
    batch.set(f.doc(f.db, "projects", it.id), it.project); ops++;
    it.tasks.forEach(function (t) {
      const body = Object.assign({}, t); delete body.id;
      batch.set(f.doc(f.db, "tasks", t.id), body); ops++; taskCount++;
    });
    batch.set(f.doc(f.db, "locks", it.id), lockPatch(it.tasks), { merge: true }); ops++;
    batch.set(f.doc(f.db, "accounting", it.id), it.accounting); ops++;
  }
  await flush();
  writeLog("ice-aktarim", "excel", items.length + " proje, " + taskCount + " iş emri aktarıldı" + (source ? " (" + source + ")" : ""));
  return { projects: items.length, tasks: taskCount };
}

/* ---------------- yazma ---------------- */

// Kilit özetine yazılan alanlar: kilidin değerlendirmesi için gereken en az bilgi.
export function lockEntry(t) {
  return {
    name: t.name || "", stepId: t.stepId || "", group: t.group || "", dept: t.dept || "", section: t.section || "",
    type: t.type || "check", unit: t.unit || "", qty: t.qty == null ? "" : String(t.qty), doneQty: t.doneQty == null ? "" : String(t.doneQty),
    status: t.status || "bekliyor", orderStatus: t.orderStatus || "", shortClosed: !!t.shortClosed
  };
}

function lockPatch(tasks) {
  const items = {};
  tasks.forEach(function (t) { items[t.id] = t === null ? null : lockEntry(t); });
  return { items: items, updatedAt: new Date().toISOString() };
}

export async function saveTask(id, patch, logText) {
  const f = await fb();
  await f.updateDoc(f.doc(f.db, "tasks", id), patch);
  const t = byId(data.tasks, id);
  if (t && t.projectId) {
    await f.setDoc(f.doc(f.db, "locks", t.projectId), lockPatch([Object.assign({}, t, patch)]), { merge: true });
  }
  if (logText) writeLog("is-emri", id, logText);
}

export async function saveProject(id, patch, logText) {
  const f = await fb();
  await f.updateDoc(f.doc(f.db, "projects", id), patch);
  if (logText) writeLog("proje", id, logText);
}

// Proje kodu (panel kodu) benzersizdir; arşivdeki projeler de sayılır.
export function normalizeCode(code) {
  return String(code || "").trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, "");
}

export function codeTaken(code, exceptId) {
  const c = normalizeCode(code);
  if (!c) return false;
  return data.projects.some(function (p) { return p.id !== exceptId && normalizeCode(p.code) === c; });
}

// Muhasebe bilgileri: tutar, ödeme ve konuşulan detay, nakliye/montaj dahil mi, borç-alacak.
export function accountingOf(pid) {
  return data.accounting[pid] || {
    total: "", paymentDetail: "", discussedDetail: "", shippingIncluded: "", installIncluded: "",
    shippingNote: "", balance: ""
  };
}

export async function saveAccounting(pid, body, logText) {
  const f = await fb();
  await f.setDoc(f.doc(f.db, "accounting", pid), Object.assign({}, body, {
    updatedAt: new Date().toISOString(), updatedBy: myEmail()
  }));
  writeLog("muhasebe", pid, logText || "muhasebe bilgileri güncellendi");
}

export async function createProject(projectId, project, tasks) {
  const f = await fb();
  const batch = f.writeBatch(f.db);
  batch.set(f.doc(f.db, "projects", projectId), project);
  tasks.forEach(function (t) {
    const tid = t.id; const body = Object.assign({}, t); delete body.id;
    batch.set(f.doc(f.db, "tasks", tid), body);
  });
  batch.set(f.doc(f.db, "locks", projectId), lockPatch(tasks), { merge: true });
  await batch.commit();
  writeLog("proje-olustur", projectId, project.name + " — " + tasks.length + " iş emri");
}

export async function addTasks(projectId, tasks) {
  const f = await fb();
  const batch = f.writeBatch(f.db);
  tasks.forEach(function (t) {
    const tid = t.id; const body = Object.assign({}, t); delete body.id;
    batch.set(f.doc(f.db, "tasks", tid), body);
  });
  batch.set(f.doc(f.db, "locks", projectId), lockPatch(tasks), { merge: true });
  await batch.commit();
  writeLog("adim-ekle", projectId, tasks.length + " adım eklendi");
}

// Proje dışı iş emri: projectId boş olan iş emridir. Aynı koleksiyonda durduğu
// için yetki, adet kuralı ve İşlerim ekranı proje iş emirleriyle aynı çalışır.
export async function createJob(task) {
  const f = await fb();
  const id = task.id; const body = Object.assign({}, task); delete body.id;
  await f.setDoc(f.doc(f.db, "tasks", id), body);
  writeLog("is-emri-olustur", id, "proje dışı: " + task.name + " · " + deptName(task.dept));
}

// Kalıcı silme yalnızca yöneticide (kurallar da öyle).
export async function deleteTask(id, name) {
  const f = await fb();
  const t = byId(data.tasks, id);
  await f.deleteDoc(f.doc(f.db, "tasks", id));
  if (t && t.projectId) {
    const items = {}; items[id] = null;
    await f.setDoc(f.doc(f.db, "locks", t.projectId), { items: items, updatedAt: new Date().toISOString() }, { merge: true });
  }
  writeLog("is-emri-sil", id, (name || "") + " silindi");
}

export async function archiveProject(id, on, name) {
  const f = await fb();
  await f.updateDoc(f.doc(f.db, "projects", id), {
    archived: !!on,
    archivedAt: on ? new Date().toISOString() : "",
    archivedBy: on ? myEmail() : ""
  });
  writeLog(on ? "proje-arsivle" : "proje-geri-al", id, name || "");
}

// Kalıcı silme yalnızca yöneticide; uygulama bunu istisna olarak sunar.
export async function hardDeleteProject(id, name, taskIds) {
  const f = await fb();
  const batch = f.writeBatch(f.db);
  (taskIds || []).forEach(function (tid) { batch.delete(f.doc(f.db, "tasks", tid)); });
  batch.delete(f.doc(f.db, "projects", id));
  batch.delete(f.doc(f.db, "locks", id));
  await batch.commit();
  writeLog("proje-sil", id, (name || "") + " — " + (taskIds || []).length + " iş emri kalıcı silindi");
}

export async function saveOrg(departments, people, logText) {
  const f = await fb();
  await f.setDoc(f.doc(f.db, "config", "org"), {
    departments: departments, people: people, updatedAt: new Date().toISOString()
  });
  if (logText) writeLog("ayar", "config/org", logText);
}

export async function saveCatalog(groups, steps, logText, sections) {
  const f = await fb();
  await f.setDoc(f.doc(f.db, "config", "catalog"), {
    groups: groups, steps: steps,
    sections: sections || data.sections || {},
    version: sections ? CATALOG_VERSION : (data.catalogVersion || 1),
    updatedAt: new Date().toISOString()
  });
  if (logText) writeLog("ayar", "config/catalog", logText);
}

// Sürüm 1 → 2 geçişi: yeni katalog ve departmanlar yazılır; personel, giriş
// yetkileri ve açık iş emirleri eski departmandan yeni departman + bölüme taşınır.
// Adım kimlikleri iş emirlerinde değişmez (seed.js LEGACY_STEP_MAP ekranda eşler).
export function migrationPlan(newDepts, newSteps) {
  const known = {}; newDepts.forEach(function (d) { known[d.id] = true; });
  const extraDepts = data.depts.filter(function (d) { return !known[d.id] && !LEGACY_DEPT_MAP[d.id]; });
  const move = function (deptId) {
    const m = LEGACY_DEPT_MAP[deptId];
    return m ? m : { dept: deptId, section: "" };
  };
  const people = data.people.map(function (p) {
    const m = move(p.dept);
    return Object.assign({}, p, { dept: m.dept, section: p.section || m.section || "" });
  });
  const members = data.members.filter(function (m) { return LEGACY_DEPT_MAP[m.dept]; }).map(function (m) {
    const mv = move(m.dept);
    return { id: m.id, patch: { dept: mv.dept, section: m.section || mv.section || "" } };
  });
  const tasks = data.tasks.filter(function (t) { return LEGACY_DEPT_MAP[t.dept]; }).map(function (t) {
    const mv = move(t.dept);
    return { id: t.id, patch: { dept: mv.dept, section: t.section || mv.section || "" } };
  });
  return {
    depts: newDepts.concat(extraDepts), extraDepts: extraDepts, people: people, members: members, tasks: tasks,
    steps: newSteps, oldSteps: data.steps.length, movedPeople: people.filter(function (p, i) { return p.dept !== data.people[i].dept; }).length
  };
}

export async function migrateToV2(plan, groups, sections) {
  const f = await fb();
  const batch = f.writeBatch(f.db);
  batch.set(f.doc(f.db, "config", "catalog"), {
    groups: groups, steps: plan.steps, sections: sections, version: CATALOG_VERSION,
    updatedAt: new Date().toISOString()
  });
  batch.set(f.doc(f.db, "config", "org"), {
    departments: plan.depts, people: plan.people, updatedAt: new Date().toISOString()
  });
  plan.members.forEach(function (m) { batch.update(f.doc(f.db, "allowed", m.id), m.patch); });
  plan.tasks.forEach(function (t) { batch.update(f.doc(f.db, "tasks", t.id), t.patch); });
  await batch.commit();
  writeLog("ayar", "config/catalog", "katalog sürüm 2'ye geçti: " + plan.steps.length + " adım, " +
    plan.depts.length + " departman; " + plan.people.length + " personel, " + plan.tasks.length + " iş emri taşındı");
}

export function sectionsOf(deptId) {
  const list = (data.sections || {})[deptId];
  return Array.isArray(list) ? list : [];
}

export function sectionName(deptId, sectionId) {
  if (!sectionId) return "";
  const s = sectionsOf(deptId).filter(function (x) { return x.id === sectionId; })[0];
  return s ? s.name : sectionId;
}

// Kişinin (dept, section) çiftine göre atanabilecek personel.
export function peopleFor(deptId, sectionId) {
  return data.people.filter(function (p) {
    if (deptId && p.dept !== deptId) return false;
    if (sectionId && p.section && p.section !== sectionId) return false;
    return true;
  });
}

export async function saveMember(email, body) {
  const f = await fb();
  const key = String(email || "").trim().toLowerCase();
  if (!key) throw new Error("E-posta gerekli.");
  await f.setDoc(f.doc(f.db, "allowed", key), body);
  writeLog("yetki-ver", key, (body.name || "") + " · " + (body.role || ""));
}

export async function removeMember(email) {
  const f = await fb();
  const key = String(email || "").trim().toLowerCase();
  await f.deleteDoc(f.doc(f.db, "allowed", key));
  writeLog("yetki-al", key, "giriş yetkisi kaldırıldı");
}

/* ---------------- erişim talepleri ---------------- */

export function pendingRequests() {
  return data.requests.filter(function (r) { return (r.status || "bekliyor") === "bekliyor"; })
    .sort(function (a, b) { return String(a.at || "").localeCompare(String(b.at || "")); });
}

// Talebi onaylar: personel kaydı yoksa açar, seçilen rol ve departmanla
// giriş yetkisi verir. Departman önemli — şefin kapsamı ve iş emri
// atamaları bunun üzerinden yürüyor.
export async function approveRequest(req, role, dept, section) {
  const f = await fb();
  const key = String(req.email || req.id || "").trim().toLowerCase();
  if (!key) throw new Error("Talepte e-posta yok.");
  const deptId = dept || (data.depts[0] || {}).id || "";
  const secId = sectionsOf(deptId).length ? (section || "") : "";

  let person = data.people.filter(function (p) {
    return String(p.email || "").toLowerCase() === key;
  })[0];

  if (!person) {
    person = { id: uid(), name: req.name || key, dept: deptId, section: secId, email: key };
    await saveOrg(data.depts, data.people.concat([person]),
      "personel eklendi (talep onayı): " + person.name);
  } else if (person.dept !== deptId || (person.section || "") !== secId) {
    const moved = Object.assign({}, person, { dept: deptId, section: secId });
    await saveOrg(data.depts, data.people.map(function (p) {
      return p.id === moved.id ? moved : p;
    }), "personel departmanı güncellendi: " + moved.name);
    person = moved;
  }

  await f.setDoc(f.doc(f.db, "allowed", key), {
    name: req.name || person.name,
    role: role,
    dept: person.dept || "",
    section: person.section || "",
    personId: person.id
  });
  await f.updateDoc(f.doc(f.db, "requests", key), {
    status: "onaylandi", role: role,
    decidedAt: new Date().toISOString(), decidedBy: myEmail()
  });
  writeLog("talep-onay", key, (req.name || "") + " · " + role);
}

export async function rejectRequest(req) {
  const f = await fb();
  const key = String(req.email || req.id || "").trim().toLowerCase();
  await f.updateDoc(f.doc(f.db, "requests", key), {
    status: "reddedildi",
    decidedAt: new Date().toISOString(), decidedBy: myEmail()
  });
  writeLog("talep-red", key, req.name || "");
}

/* ---------------- türetilmiş ---------------- */

export function projTasks(pid) {
  return data.tasks.filter(function (t) { return t.projectId === pid; })
    .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
}

export function progress(pid) {
  const ts = projTasks(pid);
  let done = 0;
  for (let i = 0; i < ts.length; i++) if (ts[i].status === "tamam") done++;
  return { done: done, total: ts.length, pct: ts.length ? Math.round(done / ts.length * 100) : 0 };
}

// Şef ve personel yalnızca kapsamında iş emri bulunan projeleri görür.
export function visibleProjects() {
  if (seesAll()) return data.projects.slice();
  const has = {};
  data.tasks.forEach(function (t) { if (t.projectId) has[t.projectId] = true; });
  return data.projects.filter(function (p) { return has[p.id]; });
}

export function activeProjects() {
  return visibleProjects().filter(function (p) { return !p.archived; });
}

export function isJob(t) { return !!t && !t.projectId; }

// Proje dışı iş emirleri.
export function jobs() {
  return data.tasks.filter(isJob);
}

// Aktif (arşivlenmemiş) projelerin iş emirleri.
export function activeProjectTasks() {
  const ids = {};
  activeProjects().forEach(function (p) { ids[p.id] = true; });
  return data.tasks.filter(function (t) { return t.projectId && ids[t.projectId]; });
}

export function deptName(id) {
  for (let i = 0; i < data.depts.length; i++) if (data.depts[i].id === id) return data.depts[i].name;
  return "—";
}

export function personName(id) {
  if (!id) return "";
  for (let i = 0; i < data.people.length; i++) if (data.people[i].id === id) return data.people[i].name;
  return "—";
}

// Giriş yapan kişinin personel kaydı (e-posta üzerinden eşleşir).
export function mePerson() {
  const e = myEmail();
  if (!e) return null;
  for (let i = 0; i < data.people.length; i++) {
    if (String(data.people[i].email || "").toLowerCase() === e) return data.people[i];
  }
  return null;
}

// Kimin hangi iş emrini kapatabileceği: planlayan roller hepsini; şef ve
// muhasebe kendi departmanınınkini; personel kendine ya da bölümüne (bölümü
// yoksa departmanına) açık, kişiye atanmamış işi. Başka departmana iş açan
// kişi onu izler ama kapatamaz. Aynı sınır firestore.rules içinde (tasks update).
export function canEditTask(t) {
  if (canPlan()) return true;
  const sc = scope(), role = myRole();
  if (role === "sef" || role === "muhasebe") return !!(sc.dept && t.dept === sc.dept);
  if (sc.personId && t.assignee === sc.personId) return true;
  return role === "personel" && !t.assignee && !!sc.dept && t.dept === sc.dept &&
    (!sc.section || !t.section || t.section === sc.section);
}
