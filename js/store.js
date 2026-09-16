// Firestore veri katmanı: gerçek zamanlı okuma + yazma yardımcıları.
// Her değiştirici işlem "log" koleksiyonuna da bir satır yazar; o koleksiyon
// salt eklemedir (kurallarda update/delete kapalı), yani geçmiş kaybolmaz.

import { fb } from "./fb.js";
import { myEmail, myName, myRole, isAdmin, canPlan, canSell } from "./auth.js";
import { uid } from "./util.js";
import { CATALOG_VERSION, DEFAULT_SECTIONS, LEGACY_DEPT_MAP } from "./seed.js";

export const data = {
  groups: [], steps: [],          // config/catalog
  sections: {},                   // config/catalog.sections — departman → bölümler
  catalogVersion: 0,              // config/catalog.version (0: yüklenmemiş, 1: eski, 2: güncel)
  depts: [],  people: [],         // config/org
  members: [],                    // allowed/*  (giriş yetkisi olanlar)
  requests: [],                   // requests/* (bekleyen erişim talepleri)
  projects: [], tasks: [],
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

  unsubs.push(f.onSnapshot(f.collection(f.db, "tasks"), function (s) {
    data.tasks = rowsOf(s);
    data.loaded.tasks = true; onChange();
  }, fail("iş emirleri")));

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

/* ---------------- yazma ---------------- */

export async function saveTask(id, patch, logText) {
  const f = await fb();
  await f.updateDoc(f.doc(f.db, "tasks", id), patch);
  if (logText) writeLog("is-emri", id, logText);
}

export async function saveProject(id, patch, logText) {
  const f = await fb();
  await f.updateDoc(f.doc(f.db, "projects", id), patch);
  if (logText) writeLog("proje", id, logText);
}

export async function createProject(projectId, project, tasks) {
  const f = await fb();
  const batch = f.writeBatch(f.db);
  batch.set(f.doc(f.db, "projects", projectId), project);
  tasks.forEach(function (t) {
    const tid = t.id; const body = Object.assign({}, t); delete body.id;
    batch.set(f.doc(f.db, "tasks", tid), body);
  });
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
  await f.deleteDoc(f.doc(f.db, "tasks", id));
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
export async function approveRequest(req, role, dept) {
  const f = await fb();
  const key = String(req.email || req.id || "").trim().toLowerCase();
  if (!key) throw new Error("Talepte e-posta yok.");
  const deptId = dept || (data.depts[0] || {}).id || "";

  let person = data.people.filter(function (p) {
    return String(p.email || "").toLowerCase() === key;
  })[0];

  if (!person) {
    person = { id: uid(), name: req.name || key, dept: deptId, email: key };
    await saveOrg(data.depts, data.people.concat([person]),
      "personel eklendi (talep onayı): " + person.name);
  } else if (person.dept !== deptId) {
    const moved = Object.assign({}, person, { dept: deptId });
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

export function activeProjects() {
  return data.projects.filter(function (p) { return !p.archived; });
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

// Kimin hangi iş emrine dokunabileceği rolden çıkar:
// planlayan roller hepsine, şef kendi departmanına, personel kendi işine.
export function canEditTask(t) {
  if (canPlan()) return true;
  const p = mePerson();
  if (!p) return false;
  if (myRole() === "sef") return !!(p.dept && t.dept === p.dept);
  return t.assignee === p.id;
}
