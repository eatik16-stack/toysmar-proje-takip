// Mevcut projeleri içe aktarma (görev bölüm 7): Excel'den çıkarılmış
// tools/toysmar-mevcut-projeler.json dosyası Ayarlar'dan yüklenir, özet
// gösterilir, onaylanınca proje + iş emirleri + muhasebe bilgisi yazılır.
// Aynı kodlu proje ikinci kez aktarılmaz; kodu boş projeler için kullanıcı
// özet penceresinde kod verir, vermezse o proje atlanır.

import { data, normalizeCode } from "./store.js";
import { myEmail } from "./auth.js";
import { uid, byId } from "./util.js";
import { canonicalStepId } from "./seed.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Tam proje olmayan kayıtlar (görev bölüm 7): 2 = Erva Çikolata (bedelsiz montaj),
// 12 = İ Spor (yedek parça). Tutarı olmayan ya da açıklaması bunu söyleyen
// projeler de aynı notu alır; içe aktarılır ama not düşülür.
const PARTIAL_BY_NO = { 2: "bedelsiz montaj", 12: "yedek parça" };
function partialReason(p) {
  if (PARTIAL_BY_NO[p.no]) return PARTIAL_BY_NO[p.no];
  const d = String(p.description || "");
  if (/bedelsiz/i.test(d)) return "bedelsiz";
  if (/yedek\s*par[çc]a/i.test(d)) return "yedek parça";
  const total = p.accounting && p.accounting.total;
  if (total !== "" && total != null && Number(total) < 1) return "tutarı yok";
  return "";
}

export function parseImportJson(text) {
  let j;
  try { j = JSON.parse(text); } catch (e) { throw new Error("JSON okunamadı: " + e.message); }
  const list = Array.isArray(j) ? j : (j && Array.isArray(j.projects) ? j.projects : null);
  if (!list) throw new Error("Beklenen biçim: { \"projects\": [ ... ] }");
  return { source: (j && j.source) || "", projects: list };
}

function stepOf(id) { return byId(data.steps, canonicalStepId(id)); }

// Özet satırları: eklenecek / atlanacak (kod zaten var) / kod bekliyor.
export function importPlan(json, codes) {
  const taken = {};
  data.projects.forEach(function (p) { if (p.code) taken[normalizeCode(p.code)] = true; });
  const seen = {};
  return json.projects.map(function (p, i) {
    const code = normalizeCode((codes && codes[i]) || p.code || "");
    const ids = Object.keys(p.tasks || {});
    const unknown = ids.filter(function (id) { return !stepOf(id); });
    const row = {
      index: i, no: p.no, name: p.name || "", code: code, codeFromFile: !!p.code,
      taskCount: ids.length - unknown.length, unknown: unknown,
      done: ids.filter(function (id) { return (p.tasks[id] || {}).status === "tamamlandi"; }).length,
      notes: []
    };
    if (!code) row.action = "kodsuz";
    else if (!/^[A-ZÇĞİÖŞÜ]{2,4}$/.test(code)) { row.action = "kodsuz"; row.notes.push("kod 2-4 büyük harf olmalı"); }
    else if (taken[code] || seen[code]) { row.action = "atla"; row.notes.push("bu kod zaten var"); }
    else { row.action = "ekle"; seen[code] = true; }
    const partial = partialReason(p);
    if (partial) row.notes.push("tam proje değil (" + partial + ")");
    if (unknown.length) row.notes.push("katalogda olmayan adım atlanır: " + unknown.join(", "));
    return row;
  });
}

function shippingFlag(text, word) {
  const t = String(text || "").toLocaleLowerCase("tr-TR");
  if (!t) return "";
  const has = t.indexOf(word) !== -1 || /dahil/.test(t) && !/nakliye|montaj/.test(t);
  if (!has && !/dahil|hari[çc]/.test(t)) return "";
  if (/hari[çc]/.test(t) && t.indexOf(word) !== -1) return "haric";
  return /dahil/.test(t) ? "dahil" : "";
}

// Plan → yazılacak belgeler (proje, iş emirleri, muhasebe).
export function buildImport(json, plan) {
  const now = new Date().toISOString();
  return plan.filter(function (r) { return r.action === "ekle"; }).map(function (row) {
    const p = json.projects[row.index];
    const pid = uid();
    const due = ISO.test(String(p.dueDate || "")) ? p.dueDate : "";
    const notes = [];
    const partial = partialReason(p);
    if (partial) notes.push("Aktarım notu: tam proje değil (" + partial + ")");
    if (p.note) notes.push(p.note);
    if (p.dueDate && !due && p.dueDate !== "-") notes.push("Termin (Excel): " + p.dueDate);
    if (p.installer) notes.push("Montajcı: " + p.installer);
    if (p.loadDate) notes.push("Yükleme: " + p.loadDate);
    if (p.installDate) notes.push("Montaj: " + p.installDate);
    const project = {
      code: row.code, name: p.name || "", description: p.description || "",
      company: p.company || "", customer: p.customer || "", contact: "", address: p.address || "",
      theme: p.theme || "", startDate: ISO.test(String(p.orderDate || "")) ? p.orderDate : "", dueDate: due,
      salesperson: p.salesperson || "", designer3d: p.designer3d || "", drafter: p.drafter || "",
      note: notes.join(" · "),
      status: p.projectStatus === "tamamlandi" ? "tamam" : "aktif", archived: false,
      createdAt: now, createdBy: myEmail(), quoteId: "", quoteNo: "",
      importedFrom: json.source || "excel", excelRow: p.excelRow || null
    };
    const tasks = Object.keys(p.tasks || {}).map(function (id) {
      const st = stepOf(id); if (!st) return null;
      const v = p.tasks[id] || {};
      const s0 = v.status || "";
      const done = s0 === "tamamlandi";
      const t = {
        id: uid(), projectId: pid, stepId: st.id, name: st.name, group: st.group,
        type: st.type || "check", unit: st.unit || "", dept: st.dept, section: st.section || "", assignee: "",
        qty: v.qty == null ? "" : String(v.qty), doneQty: v.doneQty == null ? "" : String(v.doneQty), shortClosed: false,
        spec: v.spec || "", supplier: v.supplier || "",
        orderStatus: v.orderStatus || (s0 === "siparis-verildi" ? "siparis-verildi" : ""),
        note: [v.note || "", s0 === "devam" ? "İmalatta (Excel)" : "", v.assigneeNote || ""].filter(Boolean).join(" · "),
        text: v.text || "",
        dueDate: due, status: done ? "tamam" : (s0 === "devam" ? "devam" : "bekliyor"),
        completedAt: done ? (v.completedAt || "") : "", completedBy: done ? "excel-aktarim" : "",
        completedByName: done ? "Excel aktarımı" : "",
        order: (st.order || 0) * 10, createdAt: now, importedFrom: "excel"
      };
      return t;
    }).filter(Boolean);
    const a = p.accounting || {};
    const accounting = {
      total: a.total == null ? "" : String(a.total), paymentDetail: a.paymentDetail || "", discussedDetail: a.discussedDetail || "",
      shippingIncluded: shippingFlag(a.shipping, "nakliye"), installIncluded: shippingFlag(a.shipping, "montaj"),
      shippingNote: a.shipping || "", balance: a.balance == null ? "" : String(a.balance),
      updatedAt: now, updatedBy: myEmail()
    };
    return { id: pid, project: project, tasks: tasks, accounting: accounting };
  });
}
