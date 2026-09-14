// Teklif modülünün olayları ve düzenleme akışı.
//
// Düzenleyici bir TASLAK kopya (S.q) üzerinde çalışır; yazılan her şey önce ona
// girer, kısa bir beklemeden sonra kendiliğinden kaydedilir. Başka ekranlardan
// gelen veri güncellemeleri düzenleyiciyi yeniden çizmez — yoksa yazarken imleç
// kaybolurdu. Yapısal değişikliklerde (satır ekle/sil, para birimi…) yeniden çizilir.

import { uid, byId, lsGet, lsSet, toast } from "./util.js";
import { data, writeLog } from "./store.js";
import { myEmail } from "./auth.js";
import { parseNum, fmtQty, fmtInputMoney, fmtMoney, lineTotal, calcTotals } from "./money.js";
import * as Q from "./quotes.js";
import * as QV from "./quote-views.js";

let C = null;       // { S, render, guard, go }
const SAVE_DELAY = 1200;

export function init(ctx) {
  C = ctx;
  const S = C.S;
  Object.assign(S, {
    q: null, qKey: "", qDirty: false, qSaving: false, qSaveError: "", qTimer: null, qRev: 0,
    qRemote: null, qBase: "", qPreview: false, qImg: {}, qPendingImage: null, qLogged: false,
    qAdd: "", qAddActive: 0, qFilter: "acik", qSearch: "", qRebuild: false,
    salesDraft: null, salesDirty: false, pSearch: ""
  });
  window.addEventListener("beforeunload", function (e) {
    if (S.qDirty || S.salesDirty) { e.preventDefault(); e.returnValue = ""; }
  });
  ["dragstart", "dragover", "dragleave", "drop", "dragend"].forEach(function (type) {
    document.addEventListener(type, onDrag);
  });
}

/* ==================== sürükle-bırak ==================== */

function clearDropMarks() {
  document.querySelectorAll(".ql.drop-before,.ql.drop-after,.ql.dragging").forEach(function (r) {
    r.classList.remove("drop-before", "drop-after", "dragging");
  });
}

function onDrag(e) {
  const s = C.S;
  if (s.view !== "teklif" || !s.q || Q.isLocked(s.q)) return;
  const t = e.target && e.target.closest ? e.target : null;
  if (e.type === "dragstart") {
    const grip = t && t.closest("[data-drag]");
    if (!grip) return;
    s.qDrag = grip.getAttribute("data-drag");
    try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", s.qDrag); } catch (err) {}
    const row = grip.closest(".ql");
    if (row) row.classList.add("dragging");
    return;
  }
  if (!s.qDrag) return;
  const row = t && t.closest("[data-line]");
  if (e.type === "dragover") {
    if (!row) return;
    e.preventDefault();
    const r = row.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
    document.querySelectorAll(".ql.drop-before,.ql.drop-after").forEach(function (x) {
      if (x !== row) x.classList.remove("drop-before", "drop-after");
    });
    row.classList.toggle("drop-after", after);
    row.classList.toggle("drop-before", !after);
    return;
  }
  if (e.type === "drop") {
    e.preventDefault();
    const from = lineIndex(s.qDrag);
    if (row && from >= 0) {
      const targetId = row.getAttribute("data-line");
      const after = row.classList.contains("drop-after");
      if (targetId !== s.qDrag) {
        const moved = s.q.items.splice(from, 1)[0];
        let to = lineIndex(targetId);
        if (after) to++;
        s.q.items.splice(to, 0, moved);
        s.qDrag = null; clearDropMarks();
        touch(true);
        return;
      }
    }
  }
  if (e.type === "drop" || e.type === "dragend") { s.qDrag = null; clearDropMarks(); }
}

const S = function () { return C.S; };

/* ==================== açma / yeni ==================== */

export function openQuote(id) {
  const s = S();
  const q = byId(data.quotes, id);
  if (!q) { toast("Teklif bulunamadı."); return; }
  flush();
  loadDraft(Q.clone(q), id);
  s.view = "teklif"; lsSet("toysmar.view", "teklif");
  window.scrollTo(0, 0);
  rebuild();
}

function loadDraft(q, id) {
  const s = S();
  q.id = id || null;
  s.q = q; s.qKey = uid(); s.qBase = q.updatedAt || ""; s.qDirty = false; s.qSaving = false;
  s.qSaveError = ""; s.qRemote = null; s.qPreview = false; s.qLogged = false; s.qAdd = ""; s.qAddActive = 0;
  s.qPendingImage = null; s.confirm = null;
  if (id) {
    lsSet("toysmar.quote", id);
    if (q.hasImage && !s.qImg[id]) {
      Q.loadImage(id).then(function (img) {
        if (img) { s.qImg[id] = img; if (s.q && s.q.id === id) rebuild(); }
      }).catch(function () {});
    }
  }
}

export function newQuote() {
  const s = S();
  flush();
  loadDraft(Q.newQuote(), null);
  s.view = "teklif";
  // Numara ilk kayıtta verilince kimlik de hatırlanır; o ana kadar eski teklif geri açılmasın.
  lsSet("toysmar.view", "teklif"); lsSet("toysmar.quote", "");
  window.scrollTo(0, 0);
  s.focusNext = "qf-customer-company";
  rebuild();
}

// Sayfa yenilenince son açık teklif geri gelir.
export function ensureDraft() {
  const s = S();
  if (s.q || s.view !== "teklif" || !data.loaded.quotes) return;
  const id = lsGet("toysmar.quote");
  const q = id && byId(data.quotes, id);
  if (q) loadDraft(Q.clone(q), id);
  else s.view = "teklifler";
}

/* ==================== çizim ==================== */

function rebuild() { S().qRebuild = true; C.render(); }

// Düzenleyici zaten ekrandaysa yalnızca canlı parçaları günceller.
export function tryPatch() {
  const s = S();
  if (s.view !== "teklif" || !s.q || s.qPreview || s.qRebuild) { s.qRebuild = false; return false; }
  const ed = document.getElementById("q-editor");
  if (!ed || ed.getAttribute("data-key") !== s.qKey) return false;
  checkRemote();
  setHtml("q-save", QV.saveStateHtml(s));
  setHtml("q-remote", QV.remoteHtml(s));
  setHtml("q-revs", QV.revsHtml(s));
  return true;
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el && el.innerHTML !== html) el.innerHTML = html;
}

function live() {
  const s = S(), q = s.q;
  if (!q) return;
  setHtml("q-totals", QV.totalsHtml(q));
  setHtml("q-warn", QV.warnHtml(q));
  setHtml("q-save", QV.saveStateHtml(s));
}

function checkRemote() {
  const s = S(), q = s.q;
  if (!q || !q.id) return;
  const r = byId(data.quotes, q.id);
  if (!r) return;
  if (r.updatedAt && r.updatedAt !== s.qBase && r.updatedBy !== myEmail() && !s.qSaving) s.qRemote = r;
  // Kendi başka ekrandan yaptığımız durum değişikliği (ör. revize) sessizce alınır.
  if (r.supersededBy && !q.supersededBy) { q.supersededBy = r.supersededBy; s.qBase = r.updatedAt; s.qRebuild = true; }
}

/* ==================== kaydetme ==================== */

function touch(structural) {
  const s = S();
  s.qDirty = true; s.qRev++;
  clearTimeout(s.qTimer);
  s.qTimer = setTimeout(saveNow, SAVE_DELAY);
  if (structural) rebuild(); else live();
}

export function flush() {
  const s = S();
  if (s && s.q && s.qDirty) saveNow();
}

export async function saveNow() {
  const s = S(), q = s.q;
  if (!q || !s.qDirty) return true;
  if (s.qSaving) { clearTimeout(s.qTimer); s.qTimer = setTimeout(saveNow, 400); return false; }
  clearTimeout(s.qTimer);
  const locked = Q.isLocked(q);
  const rev = s.qRev, first = !q.id, key = s.qKey;
  s.qSaving = true; s.qSaveError = "";
  setHtml("q-save", QV.saveStateHtml(s));
  try {
    const meta = locked ? await Q.saveNotes(q) : await Q.saveQuote(q);
    if (s.qKey !== key) return true;       // bu arada başka teklife geçildi
    Object.assign(q, meta);
    s.qBase = meta.updatedAt;
    if (s.qRev === rev) s.qDirty = false;
    if (first) {
      lsSet("toysmar.quote", q.id);
      if (s.qPendingImage) {
        await Q.saveImage(q.id, s.qPendingImage);
        s.qImg[q.id] = s.qPendingImage; s.qPendingImage = null;
      }
      s.qLogged = true;
      s.qSaving = false;
      rebuild();
      return true;
    }
    // Her otomatik kayıt günlüğe yazılmaz; açılıştan sonraki ilk düzenleme yeterli.
    if (!s.qLogged && !locked) {
      s.qLogged = true;
      writeLog("teklif", q.id, Q.quoteLabel(q) + " düzenlendi");
    }
  } catch (e) {
    s.qSaveError = (e && e.message) || "bilinmeyen hata";
    if (/permission|insufficient/i.test(s.qSaveError)) toast("Teklifi kaydetme yetkiniz yok.", "error");
    clearTimeout(s.qTimer); s.qTimer = setTimeout(saveNow, 5000);
  }
  s.qSaving = false;
  setHtml("q-save", QV.saveStateHtml(s));
  if (s.qDirty && !s.qSaveError) { clearTimeout(s.qTimer); s.qTimer = setTimeout(saveNow, SAVE_DELAY); }
  return !s.qSaveError;
}

/* ==================== satırlar ==================== */

function lineIndex(id) {
  const items = S().q.items;
  for (let i = 0; i < items.length; i++) if (items[i].id === id) return i;
  return -1;
}

function addProductLine(p) {
  const s = S(), l = Q.newLine("item", p);
  s.q.items.push(l);
  s.qAdd = ""; s.qAddActive = 0;
  s.focusNext = "ql-" + l.id + "-qty";
  touch(true);
  toast("“" + l.name + "” eklendi — miktar ve fiyatı girin.");
}

function addFreeLine(name) {
  const s = S(), l = Q.newLine("item");
  l.name = name || "";
  s.q.items.push(l);
  s.qAdd = ""; s.qAddActive = 0;
  s.focusNext = "ql-" + l.id + (name ? "-qty" : "-name");
  touch(true);
}

function applyProductToLine(l, p) {
  l.productId = p.id; l.code = p.code || ""; l.name = p.name;
  if (p.unit) l.unit = p.unit;
}

/* ==================== yazdırma ==================== */

function fileName(q) {
  const c = (q.customer && q.customer.company) || "teklif";
  return (Q.quoteLabel(q) + " " + c).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
}

function doPrint(draft) {
  /* Safari yazdirma penceresini yalnizca dokunusun dogrudan devaminda acar.
     Arada await olursa cagri sessizce yok sayilir; bu yuzden fonksiyon senkron. */
  const s = S(), q = s.q;
  let host = document.getElementById("print-root");
  if (!host) { host = document.createElement("div"); host.id = "print-root"; document.body.appendChild(host); }
  const img = (q.id ? s.qImg[q.id] : null) || s.qPendingImage;
  host.innerHTML = QV.documentHtml(q, Q.settings(), img, { draft: draft });
  const oldTitle = document.title;
  document.title = fileName(q);
  let cleaned = false;
  const done = function () {
    if (cleaned) return;
    cleaned = true;
    document.title = oldTitle; host.innerHTML = "";
    window.removeEventListener("afterprint", done);
  };
  /* iOS Safari afterprint tetiklemiyor; zaman asimi yedegi birakiliyor. */
  window.addEventListener("afterprint", done);
  setTimeout(done, 60000);
  try {
    window.print();
  } catch (err) {
    done();
    toast("Tarayici yazdirmayi acamadi. Sayfayi Safari'de acip paylas menusunden yazdirin.", "error");
  }
}

/* ==================== durum ==================== */

async function changeStatus(status, msg) {
  const s = S(), q = s.q;
  if (!q.id) return;
  if (!(await saveNow())) { toast("Önce kaydedilmeli; kayıt başarısız oldu.", "error"); return; }
  const patch = await C.guard(Q.setStatus(q, status));
  if (!patch) return;
  Object.assign(q, patch);
  s.qBase = patch.updatedAt;
  if (msg) toast(msg);
  rebuild();
}

async function sendAndPrint() {
  const s = S(), q = s.q;
  const c = (q.customer && q.customer.company) || "";
  const totals = calcTotals(q);
  if (!c.trim()) { toast("Göndermeden önce müşteri firma adını girin."); return; }
  if (!totals.count) { toast("Teklifte kalem yok."); return; }
  if (totals.missing) { toast(totals.missing + " kalemde birim fiyat girilmedi. Fiyatsız teklif gönderilemez."); return; }
  if (!q.id || s.qDirty) {
    s.qDirty = true;
    if (!(await saveNow())) { toast("Teklif kaydedilemedi, gönderilmedi.", "error"); return; }
  }
  const patch = await C.guard(Q.setStatus(q, "gonderildi"));
  if (!patch) return;
  Object.assign(q, patch);
  s.qBase = patch.updatedAt;
  /* Gonderme ag islemi oldugundan yazdirma burada otomatik acilamaz
     (Safari dokunus baglami disinda print() cagrisini yok sayar).
     Onizlemeye gecilir, kullanici Yazdir / PDF ile belgeyi alir. */
  s.qPreview = true;
  toast(Q.quoteLabel(q) + " gönderildi ve kilitlendi. Yazdır / PDF ile belgeyi alabilirsiniz.");
  window.scrollTo(0, 0);
  rebuild();
}

async function revise() {
  const s = S(), q = s.q;
  if (s.qDirty) await saveNow();
  const body = await C.guard(Q.reviseQuote(q));
  if (!body) return;
  q.supersededBy = body.id;
  if (q.hasImage && s.qImg[q.id]) s.qImg[body.id] = s.qImg[q.id];
  const fresh = byId(data.quotes, body.id) || body;
  loadDraft(Q.clone(fresh), body.id);
  toast(Q.quoteLabel(body) + " açıldı. Önceki sürüm olduğu gibi saklandı.");
  window.scrollTo(0, 0);
  rebuild();
}

/* ==================== onaylı işlemler ==================== */

export async function confirmed(kind, id) {
  const s = S(), q = s.q;
  if (kind === "qdel") {
    if (!q || !q.id) return true;
    await C.guard(Q.deleteQuote(q));
    s.q = null; s.qDirty = false; clearTimeout(s.qTimer);
    lsSet("toysmar.quote", "");
    s.view = "teklifler"; lsSet("toysmar.view", "teklifler");
    toast("Taslak silindi.");
    return true;
  }
  if (kind === "qback") { await changeStatus("taslak", "Teklif taslağa alındı, yeniden düzenlenebilir."); return true; }
  if (kind === "qcancel") { await changeStatus("iptal", "Teklif iptal edildi. Kaydı saklanıyor."); return true; }
  if (kind === "qundo") { await changeStatus("gonderildi", "Karar geri alındı."); return true; }
  if (kind === "qproddel") {
    const p = byId(data.products, id);
    await C.guard(Q.saveProducts(data.products.filter(function (x) { return x.id !== id; }),
      "katalogdan çıkarıldı: " + ((p && p.name) || id)));
    toast("Ürün katalogdan çıkarıldı. Mevcut teklifler etkilenmez.");
    return true;
  }
  return false;
}

/* ==================== olaylar ==================== */

export async function onClick(e) {
  const s = S();
  let el;

  if (e.target.closest("[data-qseed]")) {
    await C.guard(Q.seedSales());
    toast("Teklif modülü hazır: katalog ve koşullar yüklendi.");
    return true;
  }
  if (e.target.closest("[data-qnew]")) { newQuote(); return true; }
  if ((el = e.target.closest("[data-qopen]"))) { openQuote(el.getAttribute("data-qopen")); return true; }
  if ((el = e.target.closest("[data-qfilter]"))) { s.qFilter = el.getAttribute("data-qfilter"); C.render(); return true; }

  /* ---- ayarlar ---- */
  if (e.target.closest("[data-ssave]")) {
    await C.guard(Q.saveSettings(s.salesDraft));
    s.salesDirty = false; s.salesDraft = null;
    toast("Teklif ayarları kaydedildi.");
    C.render();
    return true;
  }
  if (e.target.closest("[data-sreset]")) { s.salesDraft = null; s.salesDirty = false; C.render(); return true; }
  if (e.target.closest("[data-stadd]")) {
    s.salesDraft.terms = (s.salesDraft.terms || []).concat([""]);
    s.salesDirty = true; s.focusNext = "st-" + (s.salesDraft.terms.length - 1); C.render(); return true;
  }
  if ((el = e.target.closest("[data-stdel]"))) {
    s.salesDraft.terms.splice(Number(el.getAttribute("data-stdel")), 1);
    s.salesDirty = true; C.render(); return true;
  }
  if (e.target.closest("[data-sstampdel]")) { s.salesDraft.stamp = ""; s.salesDirty = true; C.render(); return true; }
  if (e.target.closest("[data-padd]")) {
    const v = function (id) { const x = document.getElementById(id); return x ? x.value.trim() : ""; };
    const name = v("pn-name");
    if (!name) { toast("Ürün adı gerekli."); return true; }
    if (Q.productByName(name)) { toast("“" + name + "” katalogda zaten var."); return true; }
    const p = { id: uid(), code: v("pn-code"), name: name, unit: v("pn-unit") || "Adet", group: v("pn-group"), note: "" };
    await C.guard(Q.saveProducts(data.products.concat([p]), "kataloğa eklendi: " + name));
    s.focusNext = "pn-name";
    toast("“" + name + "” kataloğa eklendi.");
    return true;
  }

  if (s.view !== "teklif" || !s.q) return false;
  const q = s.q, locked = Q.isLocked(q);

  /* ---- düzenleyici ---- */
  if ((el = e.target.closest("[data-qremote]"))) {
    if (el.getAttribute("data-qremote") === "load" && s.qRemote) {
      loadDraft(Q.clone(s.qRemote), q.id);
      toast("Güncel sürüm yüklendi.");
    } else {
      s.qBase = s.qRemote ? s.qRemote.updatedAt : s.qBase;
      s.qRemote = null; s.qDirty = true; saveNow();
    }
    rebuild(); return true;
  }
  if (e.target.closest("[data-qpreview]")) {
    if (s.qDirty) saveNow();
    s.qPreview = true; window.scrollTo(0, 0); rebuild(); return true;
  }
  if (e.target.closest("[data-qpreviewclose]")) { s.qPreview = false; rebuild(); return true; }
  if ((el = e.target.closest("[data-qprint]"))) { doPrint(el.getAttribute("data-qprint") === "taslak"); return true; }
  if (e.target.closest("[data-qsend]")) { await sendAndPrint(); return true; }
  if ((el = e.target.closest("[data-qstatus]"))) {
    const st = el.getAttribute("data-qstatus");
    await changeStatus(st, st === "kabul" ? "Teklif kabul edildi." : "Teklif reddedildi. İsterseniz kayıp nedenini yazın.");
    if (st === "red") s.focusNext = "qf-lostReason";
    return true;
  }
  if (e.target.closest("[data-qrevise]")) { await revise(); return true; }
  if (e.target.closest("[data-qproject]")) { if (s.qDirty) await saveNow(); C.startProjectFromQuote(q); return true; }
  if (e.target.closest("[data-qcopy]")) {
    if (s.qDirty) await saveNow();
    const img = q.hasImage ? ((q.id && s.qImg[q.id]) || s.qPendingImage) : null;
    loadDraft(Q.copyOf(q), null);
    if (img) s.qPendingImage = img; else s.q.hasImage = false;
    lsSet("toysmar.quote", "");
    s.focusNext = "qf-customer-company";
    toast("Benzer teklif hazır — müşteriyi girin. Yeni numara ilk kayıtta verilir.");
    window.scrollTo(0, 0);
    rebuild(); return true;
  }
  if (e.target.closest("[data-qimgdel]") && !locked) {
    if (q.id) await C.guard(Q.removeImage(q.id));
    if (q.id) delete s.qImg[q.id];
    s.qPendingImage = null; q.hasImage = false; q.imageCaption = "";
    touch(true); return true;
  }

  if (locked) return false;

  if ((el = e.target.closest("[data-qmode]"))) { q.priceMode = el.getAttribute("data-qmode"); touch(true); return true; }
  if ((el = e.target.closest("[data-qaddprod]"))) {
    const p = byId(data.products, el.getAttribute("data-qaddprod"));
    if (p) addProductLine(p);
    return true;
  }
  if (e.target.closest("[data-qaddfree]")) { addFreeLine(s.qAdd.trim()); return true; }
  if (e.target.closest("[data-qaddblank]")) { addFreeLine(""); return true; }
  if (e.target.closest("[data-qaddhead]")) {
    const l = Q.newLine("head");
    q.items.push(l); s.focusNext = "ql-" + l.id + "-name"; touch(true); return true;
  }
  if ((el = e.target.closest("[data-lmove]"))) {
    const parts = el.getAttribute("data-lmove").split(":");
    const i = lineIndex(parts[0]), j = i + Number(parts[1]);
    if (i < 0 || j < 0 || j >= q.items.length) return true;
    const tmp = q.items[i]; q.items[i] = q.items[j]; q.items[j] = tmp;
    touch(true); return true;
  }
  if ((el = e.target.closest("[data-ldup]"))) {
    const i = lineIndex(el.getAttribute("data-ldup"));
    if (i < 0) return true;
    const copy = Object.assign({}, q.items[i], { id: uid() });
    q.items.splice(i + 1, 0, copy);
    s.focusNext = "ql-" + copy.id + "-qty";
    touch(true); return true;
  }
  if ((el = e.target.closest("[data-ldel]"))) {
    const i = lineIndex(el.getAttribute("data-ldel"));
    if (i < 0) return true;
    const gone = q.items.splice(i, 1)[0];
    s.qUndoLine = { line: gone, index: i };
    touch(true);
    toast("“" + (gone.name || "Kalem") + "” silindi. Geri almak için Ctrl+Z.");
    return true;
  }
  if ((el = e.target.closest("[data-luse]"))) {
    const l = q.items[lineIndex(el.getAttribute("data-luse"))];
    const lp = l && Q.lastPrice(l.productId, q.currency, q.id);
    if (lp) { l.price = lp.price; s.focusNext = "ql-" + l.id + "-price"; touch(true); }
    return true;
  }
  if ((el = e.target.closest("[data-lcat]"))) {
    const l = q.items[lineIndex(el.getAttribute("data-lcat"))];
    if (!l || !String(l.name || "").trim()) return true;
    const existing = Q.productByName(l.name);
    if (existing) { applyProductToLine(l, existing); touch(true); return true; }
    const p = { id: uid(), code: l.code || "", name: String(l.name).trim(), unit: l.unit || "Adet", group: "", note: "" };
    await C.guard(Q.saveProducts(data.products.concat([p]), "kataloğa eklendi (tekliften): " + p.name));
    l.productId = p.id;
    toast("“" + p.name + "” kataloğa eklendi.");
    touch(true); return true;
  }
  if (e.target.closest("[data-tadd]")) {
    q.terms = (q.terms || []).concat([""]); s.focusNext = "qt-" + (q.terms.length - 1); touch(true); return true;
  }
  if ((el = e.target.closest("[data-tdel]"))) { q.terms.splice(Number(el.getAttribute("data-tdel")), 1); touch(true); return true; }
  if (e.target.closest("[data-treset]")) {
    const st = Q.settings();
    q.intro = st.intro; q.terms = (st.terms || []).slice(); q.privacy = st.privacy;
    toast("Belge metinleri varsayılana döndü."); touch(true); return true;
  }
  return false;
}

function setPath(obj, path, value) {
  const parts = path.split(".");
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) { if (!o[parts[i]]) o[parts[i]] = {}; o = o[parts[i]]; }
  o[parts[parts.length - 1]] = value;
}

export function onInput(e) {
  const s = S(), t = e.target;
  if (!t || !t.getAttribute) return false;

  if (t.id === "q-search") { s.qSearch = t.value; C.render(); return true; }
  if (t.id === "p-search") { s.pSearch = t.value; C.render(); return true; }

  if (t.hasAttribute("data-sf")) {
    s.salesDraft[t.getAttribute("data-sf")] = t.value;
    markSalesDirty(); return true;
  }
  if (t.hasAttribute("data-stf")) {
    s.salesDraft.terms[Number(t.getAttribute("data-stf"))] = t.value;
    autoGrow(t); markSalesDirty(); return true;
  }

  if (s.view !== "teklif" || !s.q) return false;
  const q = s.q;

  if (t.id === "q-add") {
    s.qAdd = t.value; s.qAddActive = 0;
    setHtml("q-add-results", QV.addResultsHtml(s));
    return true;
  }
  if (t.hasAttribute("data-qf")) {
    const path = t.getAttribute("data-qf");
    if (Q.isLocked(q) && path !== "notes" && path !== "lostReason") return true;
    if (t.tagName === "SELECT") return false;          // seçimler change'de işlenir
    setPath(q, path, t.value);
    if (path === "date" || path === "validDays") {
      q.validUntil = Q.addDays(q.date, parseNum(q.validDays) || 0);
      setHtml("qf-validDays-hint", "Son geçerlilik: <strong>" + Q.longDate(q.validUntil) + "</strong>");
    }
    if (t.tagName === "TEXTAREA") autoGrow(t);
    touch(false); return true;
  }
  if (t.hasAttribute("data-tf")) {
    if (Q.isLocked(q)) return true;
    q.terms[Number(t.getAttribute("data-tf"))] = t.value;
    autoGrow(t); touch(false); return true;
  }
  const row = t.closest("[data-line]");
  if (row && t.hasAttribute("data-lf") && t.tagName !== "SELECT") {
    if (Q.isLocked(q)) return true;
    const l = q.items[lineIndex(row.getAttribute("data-line"))];
    if (!l) return true;
    const f = t.getAttribute("data-lf");
    l[f] = t.value;
    if (f === "name" && l.productId) {
      // Katalog adından elle değiştirilen kalem artık serbest kalemdir.
      const p = byId(data.products, l.productId);
      if (!p || p.name !== t.value) l.productId = "";
    }
    if (f === "qty" || f === "price") {
      const price = parseNum(l.price);
      setHtml("ql-" + l.id + "-total", price === null ? '<span class="muted">—</span>' : fmtMoney(lineTotal(l), q.currency));
      row.classList.toggle("is-noprice", price === null);
    }
    touch(false); return true;
  }
  return false;
}

export async function onChange(e) {
  const s = S(), t = e.target;
  if (!t || !t.getAttribute) return false;

  if (t.id === "s-stamp") {
    const file = t.files && t.files[0];
    if (!file) return true;
    try {
      const img = await Q.compressImage(file, 700, 180000);
      s.salesDraft.stamp = img.src; s.salesDirty = true; C.render();
      toast("Kaşe görseli eklendi. Kaydetmeyi unutmayın.");
    } catch (err) { toast(err.message, "error"); }
    return true;
  }
  if (t.hasAttribute("data-sf") && t.tagName === "SELECT") {
    s.salesDraft[t.getAttribute("data-sf")] = t.value; markSalesDirty(); return true;
  }
  if (t.hasAttribute("data-pf")) {
    const parts = t.getAttribute("data-pf").split(":");
    const p = byId(data.products, parts[0]);
    if (!p) return true;
    const val = t.value.trim();
    if (parts[1] === "name" && !val) { toast("Ürün adı boş olamaz."); t.value = p.name; return true; }
    if ((p[parts[1]] || "") === val) return true;
    const next = data.products.map(function (x) {
      if (x.id !== p.id) return x;
      const o = Object.assign({}, x); o[parts[1]] = val; return o;
    });
    await C.guard(Q.saveProducts(next, "katalog: " + p.name + " · " + parts[1] + " = " + val));
    return true;
  }

  if (s.view !== "teklif" || !s.q) return false;
  const q = s.q, locked = Q.isLocked(q);

  if (t.id === "q-img") {
    const file = t.files && t.files[0];
    if (!file || locked) return true;
    try {
      toast("Görsel hazırlanıyor…");
      const img = await Q.compressImage(file, 1800, 900000);
      if (q.id) { await C.guard(Q.saveImage(q.id, img)); s.qImg[q.id] = img; }
      else s.qPendingImage = img;
      q.hasImage = true;
      touch(true);
      toast("Görsel eklendi (" + Math.round(img.src.length * 0.75 / 1024) + " KB).");
    } catch (err) { toast(err.message, "error"); }
    return true;
  }

  if (t.hasAttribute("data-qf")) {
    const path = t.getAttribute("data-qf");
    if (locked && path !== "notes" && path !== "lostReason") return true;
    if (t.tagName === "SELECT") {
      setPath(q, path, path === "vatRate" ? Number(t.value) : t.value);
      touch(path === "currency" || path === "discountType");
      return true;
    }
    if (path === "discountValue") { t.value = fmtInputMoney(q.discountValue); return true; }
    if (path === "customer.company") {
      // Daha önce teklif verilmiş firma: boş alanlar son teklifteki bilgilerle dolar.
      const known = Q.customerByCompany(t.value);
      if (known) {
        let filled = 0;
        ["contact", "phone", "email", "city", "address", "taxOffice", "taxNo"].forEach(function (k) {
          if (!q.customer[k] && known[k]) { q.customer[k] = known[k]; filled++; }
        });
        const renamed = q.customer.company !== known.company;
        q.customer.company = known.company;
        if (filled) toast("Firma bilgileri önceki tekliften dolduruldu.");
        if (filled || renamed) touch(true);
      }
      return true;
    }
    return true;
  }

  const row = t.closest("[data-line]");
  if (row && t.hasAttribute("data-lf")) {
    if (locked) return true;
    const l = q.items[lineIndex(row.getAttribute("data-line"))];
    if (!l) return true;
    const f = t.getAttribute("data-lf");
    if (f === "unit") { l.unit = t.value; touch(false); return true; }
    if (f === "qty") { const v = parseNum(l.qty); l.qty = v; t.value = fmtQty(v); touch(false); return true; }
    if (f === "price") {
      const v = parseNum(l.price); l.price = v; t.value = fmtInputMoney(v);
      setHtml("ql-" + l.id + "-hint", QV.lineHint(q, l));
      touch(false); return true;
    }
    if (f === "name" && l.kind !== "head") {
      const p = Q.productByName(t.value);
      if (p && l.productId !== p.id) { applyProductToLine(l, p); touch(true); return true; }
      setHtml("ql-" + l.id + "-hint", QV.lineHint(q, l));
      return true;
    }
    return true;
  }
  return false;
}

export function onKeydown(e) {
  const s = S(), t = e.target;
  if (!s || !s.q || s.view !== "teklif") {
    if ((e.ctrlKey || e.metaKey) && e.key === "s" && s && s.view === "teklif-ayar" && s.salesDirty) {
      e.preventDefault();
      const btn = document.querySelector("[data-ssave]"); if (btn) btn.click();
      return true;
    }
    return false;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault(); s.qDirty = true; saveNow(); return true;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "z" && s.qUndoLine && !(t && /INPUT|TEXTAREA/.test(t.tagName))) {
    e.preventDefault();
    s.q.items.splice(Math.min(s.qUndoLine.index, s.q.items.length), 0, s.qUndoLine.line);
    toast("“" + (s.qUndoLine.line.name || "Kalem") + "” geri geldi.");
    s.qUndoLine = null; touch(true); return true;
  }
  if (t && t.id === "q-add") {
    const res = document.querySelectorAll("#q-add-results .qres");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!res.length) return true;
      e.preventDefault();
      s.qAddActive = (s.qAddActive + (e.key === "ArrowDown" ? 1 : -1) + res.length) % res.length;
      setHtml("q-add-results", QV.addResultsHtml(s));
      return true;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const pick = res[s.qAddActive || 0];
      if (pick) pick.click();
      return true;
    }
    if (e.key === "Escape") { s.qAdd = ""; t.value = ""; setHtml("q-add-results", ""); return true; }
  }
  // Son kalemin fiyatında Enter: yeni ürün eklemeye geç.
  if (e.key === "Enter" && t && t.getAttribute && t.getAttribute("data-lf") === "price") {
    e.preventDefault();
    t.dispatchEvent(new Event("change", { bubbles: true }));
    const add = document.getElementById("q-add");
    if (add) add.focus();
    return true;
  }
  return false;
}

function markSalesDirty() {
  const s = S();
  if (!s.salesDirty) { s.salesDirty = true; C.render(); }
}

function autoGrow(t) {
  t.style.height = "auto";
  t.style.height = Math.min(t.scrollHeight + 2, 320) + "px";
}

// Ayarlar ekranı açılırken taslak kopya hazırlanır.
export function ensureSalesDraft() {
  const s = S();
  if (!s.salesDraft && data.sales) {
    s.salesDraft = Q.clone(Q.settings());
    s.salesDirty = false;
  }
}
