// Firestore veri katmanı: gerçek zamanlı okuma + yazma yardımcıları.
// Her değiştirici işlem "log" koleksiyonuna da bir satır yazar; o koleksiyon
// salt eklemedir (kurallarda update/delete kapalı), yani geçmiş kaybolmaz.

import { fb } from "./fb.js";
import { myEmail, myName, myRole, isAdmin, canPlan } from "./auth.js";
import { uid } from "./util.js";

export const data = {
  groups: [], steps: [],          // config/catalog
  depts: [],  people: [],         // config/org
  members: [],                    // allowed/*  (giriş yetkisi olanlar)
  requests: [],                   // requests/* (bekleyen erişim talepleri)
  projects: [], tasks: [],
  loaded: { catalog: false, org: false, members: false, projects: false, tasks: false }
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

export async function saveCatalog(groups, steps, logText) {
  const f = await fb();
  await f.setDoc(f.doc(f.db, "config", "catalog"), {
    groups: groups, steps: steps, updatedAt: new Date().toISOString()
  });
  if (logText) writeLog("ayar", "config/catalog", logText);
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

// Talebi onaylar: personel kaydı yoksa açar, seçilen rolle giriş yetkisi verir.
export async function approveRequest(req, role) {
  const f = await fb();
  const key = String(req.email || req.id || "").trim().toLowerCase();
  if (!key) throw new Error("Talepte e-posta yok.");

  let person = data.people.filter(function (p) {
    return String(p.email || "").toLowerCase() === key;
  })[0];

  if (!person) {
    person = { id: uid(), name: req.name || key, dept: (data.depts[0] || {}).id || "", email: key };
    await saveOrg(data.depts, data.people.concat([person]),
      "personel eklendi (talep onayı): " + person.name);
  }

  await f.setDoc(f.doc(f.db, "allowed", key), {
    name: req.name || person.name,
    role: role,
    dept: person.dept || "",
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
