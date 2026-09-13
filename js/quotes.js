// Teklif veri katmanı: numara verme, kaydetme, durum, revizyon, katalog.
//
// Kurallar:
//  - Numara ilk kayıtta, sayaç üzerinden işlem (transaction) ile verilir;
//    iki kişi aynı anda teklif açsa da aynı numara çıkmaz.
//  - Gönderilmiş teklif değiştirilmez. Değişiklik "revize" ile yapılır:
//    aynı numara R1, R2… olarak yeni belge açılır, eski sürüm olduğu gibi kalır.
//  - Gönderilmiş teklif silinmez, iptal edilir.

import { fb } from "./fb.js";
import { data, writeLog } from "./store.js";
import { myEmail, myName } from "./auth.js";
import { uid, todayISO, daysBetween } from "./util.js";
import { calcTotals, parseNum } from "./money.js";
import { DEFAULT_SETTINGS, DEFAULT_PRODUCTS, UNITS, PRODUCT_GROUPS } from "./sales-seed.js";

export const STATES = {
  taslak:     { label: "Taslak",        cls: "st-bekliyor" },
  gonderildi: { label: "Gönderildi",    cls: "st-devam" },
  suresi:     { label: "Süresi doldu",  cls: "st-yakin" },
  kabul:      { label: "Kabul edildi",  cls: "st-tamam" },
  red:        { label: "Reddedildi",    cls: "st-gecikti" },
  iptal:      { label: "İptal",         cls: "st-pasif" },
  revize:     { label: "Revize edildi", cls: "st-pasif" }
};

export function settings() {
  return Object.assign({}, DEFAULT_SETTINGS, data.sales || {});
}

export function clone(o) { return JSON.parse(JSON.stringify(o)); }

export function addDays(iso, n) {
  const d = new Date(String(iso || todayISO()).slice(0, 10) + "T00:00:00");
  if (isNaN(d)) return "";
  d.setDate(d.getDate() + (Number(n) || 0));
  const m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
}

export function quoteLabel(q) {
  if (!q || !q.no) return "Yeni teklif";
  return q.no + (q.rev ? "-R" + q.rev : "");
}

export function quoteState(q) {
  if (q.supersededBy) return "revize";
  const s = q.status || "taslak";
  if (s === "gonderildi" && q.validUntil && daysBetween(q.validUntil) < 0) return "suresi";
  return s;
}

// Gönderilmiş, karara bağlanmış ya da revize edilmiş teklifin içeriği değişmez.
export function isLocked(q) {
  return !!q && ((q.status || "taslak") !== "taslak" || !!q.supersededBy);
}

/* ---------------- yeni belge ---------------- */

export function newLine(kind, product) {
  const pr = product || {};
  return {
    id: uid(), kind: kind || "item",
    productId: pr.id || "", code: pr.code || "",
    name: pr.name || "", note: "", unit: kind === "head" ? "" : (pr.unit || "Adet"),
    qty: kind === "head" ? null : 1, price: null
  };
}

export function newQuote() {
  const st = settings();
  const today = todayISO();
  return {
    id: null, no: "", seq: 0, year: 0, rev: 0, parentId: "", supersededBy: "",
    status: "taslak", title: "", date: today,
    validDays: Number(st.validDays) || 7, validUntil: addDays(today, st.validDays),
    currency: st.currency || "TRY", vatRate: Number(st.vatRate), priceMode: st.priceMode || "detay",
    discountType: "yuzde", discountValue: null,
    customer: { company: "", contact: "", phone: "", email: "", city: "", address: "", taxOffice: "", taxNo: "" },
    sender: { name: myName(), phone: st.phone || "", email: myEmail() },
    reference: "", intro: st.intro || "", terms: (st.terms || []).slice(), privacy: st.privacy || "",
    items: [], notes: "", lostReason: "", hasImage: false, imageCaption: "",
    projectId: "", totals: null,
    createdAt: "", createdBy: "", createdByName: "",
    updatedAt: "", updatedBy: "", updatedByName: "", sentAt: "", decidedAt: ""
  };
}

// Benzer teklif: kalemler, metinler ve ayarlar kopyalanır; müşteri boşaltılır,
// numara ilk kayıtta yeniden verilir.
export function copyOf(q) {
  const n = newQuote();
  const c = clone(q);
  ["currency", "vatRate", "priceMode", "discountType", "discountValue", "intro", "terms", "privacy",
    "validDays", "imageCaption", "hasImage"].forEach(function (k) { n[k] = c[k]; });
  n.validUntil = addDays(n.date, n.validDays);
  n.items = (c.items || []).map(function (l) { return Object.assign({}, l, { id: uid() }); });
  return n;
}

/* ---------------- kaydetme ---------------- */

function serialize(q) {
  const body = clone(q);
  delete body.id;
  body.items = (body.items || []).map(function (l) {
    const o = {
      id: l.id || uid(), kind: l.kind === "head" ? "head" : "item",
      productId: l.productId || "", code: String(l.code || "").trim(),
      name: String(l.name || "").trim(), note: String(l.note || "").trim(), unit: l.unit || ""
    };
    o.qty = o.kind === "head" ? null : parseNum(l.qty);
    o.price = o.kind === "head" ? null : parseNum(l.price);
    return o;
  });
  body.validDays = parseNum(body.validDays) || 0;
  body.validUntil = addDays(body.date, body.validDays);
  body.discountValue = parseNum(body.discountValue);
  body.vatRate = Number(body.vatRate) || 0;
  body.terms = (body.terms || []).map(function (t) { return String(t || "").trim(); }).filter(Boolean);
  body.totals = calcTotals(body);
  return body;
}

// Kaydeder; ilk kayıtta numara verir. Belgeye yazılan üst bilgileri döndürür.
export async function saveQuote(q) {
  const body = serialize(q);
  const f = await fb();
  const now = new Date().toISOString();
  body.updatedAt = now; body.updatedBy = myEmail(); body.updatedByName = myName();

  if (q.id) {
    await f.setDoc(f.doc(f.db, "quotes", q.id), body);
    return { id: q.id, updatedAt: now, updatedBy: body.updatedBy, updatedByName: body.updatedByName,
      validUntil: body.validUntil, totals: body.totals };
  }

  const id = uid();
  const year = Number(String(body.date).slice(0, 4)) || new Date().getFullYear();
  await f.runTransaction(f.db, async function (tx) {
    const cref = f.doc(f.db, "sales", "counter");
    const snap = await tx.get(cref);
    const c = (snap.exists() && snap.data()) || {};
    const seq = (Number(c["y" + year]) || 0) + 1;
    const next = Object.assign({}, c); next["y" + year] = seq;
    tx.set(cref, next);
    body.seq = seq; body.year = year; body.rev = 0;
    body.no = "TKL-" + year + "-" + String(seq).padStart(4, "0");
    body.createdAt = now; body.createdBy = myEmail(); body.createdByName = myName();
    tx.set(f.doc(f.db, "quotes", id), body);
  });
  writeLog("teklif-olustur", id, body.no + " · " + (body.customer.company || "müşteri girilmedi"));
  return {
    id: id, no: body.no, seq: body.seq, year: body.year, rev: 0,
    createdAt: now, createdBy: body.createdBy, createdByName: body.createdByName,
    updatedAt: now, updatedBy: body.updatedBy, updatedByName: body.updatedByName,
    validUntil: body.validUntil, totals: body.totals
  };
}

const STATUS_LOG = {
  taslak: "taslağa geri alındı", gonderildi: "gönderildi", kabul: "kabul edildi",
  red: "reddedildi", iptal: "iptal edildi"
};

export async function setStatus(q, status) {
  const f = await fb();
  const now = new Date().toISOString();
  const patch = { status: status, updatedAt: now, updatedBy: myEmail(), updatedByName: myName() };
  if (status === "gonderildi") { patch.sentAt = q.sentAt || now; patch.decidedAt = ""; }
  if (status === "taslak") { patch.sentAt = ""; patch.decidedAt = ""; }
  if (status === "kabul" || status === "red" || status === "iptal") patch.decidedAt = now;
  if (status !== "red") patch.lostReason = "";
  await f.updateDoc(f.doc(f.db, "quotes", q.id), patch);
  writeLog("teklif-durum", q.id, quoteLabel(q) + " " + (STATUS_LOG[status] || status));
  return patch;
}

// Kilitli teklifte yalnızca iç not ve kayıp nedeni değişebilir.
export async function saveNotes(q) {
  const f = await fb();
  const now = new Date().toISOString();
  const patch = { notes: q.notes || "", lostReason: q.lostReason || "", updatedAt: now,
    updatedBy: myEmail(), updatedByName: myName() };
  await f.updateDoc(f.doc(f.db, "quotes", q.id), patch);
  return patch;
}

export function revisionsOf(q) {
  if (!q || !q.no) return [];
  return data.quotes.filter(function (x) { return x.year === q.year && x.seq === q.seq; })
    .sort(function (a, b) { return (a.rev || 0) - (b.rev || 0); });
}

export async function reviseQuote(q) {
  const f = await fb();
  const now = new Date().toISOString();
  const revs = revisionsOf(q);
  const top = revs.reduce(function (m, x) { return Math.max(m, x.rev || 0); }, q.rev || 0);
  const nid = uid();
  const body = serialize(q);
  Object.assign(body, {
    rev: top + 1, parentId: q.id, supersededBy: "", status: "taslak",
    date: todayISO(), sentAt: "", decidedAt: "", lostReason: "", projectId: "",
    createdAt: now, createdBy: myEmail(), createdByName: myName(),
    updatedAt: now, updatedBy: myEmail(), updatedByName: myName()
  });
  body.validUntil = addDays(body.date, body.validDays);

  const batch = f.writeBatch(f.db);
  batch.set(f.doc(f.db, "quotes", nid), body);
  batch.update(f.doc(f.db, "quotes", q.id), { supersededBy: nid, updatedAt: now, updatedBy: myEmail(), updatedByName: myName() });
  await batch.commit();

  if (q.hasImage) {
    const img = await loadImage(q.id);
    if (img) await saveImage(nid, img);
  }
  writeLog("teklif-revize", nid, quoteLabel(q) + " → R" + body.rev);
  body.id = nid;
  return body;
}

export async function deleteQuote(q) {
  const f = await fb();
  await f.deleteDoc(f.doc(f.db, "quotes", q.id));
  if (q.hasImage) { try { await f.deleteDoc(f.doc(f.db, "quoteFiles", q.id)); } catch (e) {} }
  writeLog("teklif-sil", q.id, quoteLabel(q) + " · " + ((q.customer && q.customer.company) || ""));
}

export async function linkProject(quoteId, projectId, name) {
  const f = await fb();
  await f.updateDoc(f.doc(f.db, "quotes", quoteId), { projectId: projectId });
  writeLog("teklif-proje", quoteId, "üretim projesi açıldı: " + (name || projectId));
}

/* ---------------- görsel ---------------- */

export async function saveImage(id, img) {
  const f = await fb();
  await f.setDoc(f.doc(f.db, "quoteFiles", id), { src: img.src, w: img.w || 0, h: img.h || 0, at: new Date().toISOString() });
}

export async function loadImage(id) {
  const f = await fb();
  const s = await f.getDoc(f.doc(f.db, "quoteFiles", id));
  return s.exists() ? s.data() : null;
}

export async function removeImage(id) {
  const f = await fb();
  await f.deleteDoc(f.doc(f.db, "quoteFiles", id));
}

// Görseli tarayıcıda küçültüp JPEG'e çevirir. Firestore belge sınırı 1 MB olduğu için
// hedef boyutun altına inene kadar önce kaliteyi, sonra ölçüyü düşürür.
export function compressImage(file, maxSide, maxLen) {
  return new Promise(function (resolve, reject) {
    if (!file || !/^image\//.test(file.type || "")) { reject(new Error("Lütfen bir görsel dosyası seçin.")); return; }
    const reader = new FileReader();
    reader.onerror = function () { reject(new Error("Dosya okunamadı.")); };
    reader.onload = function () {
      const img = new Image();
      img.onerror = function () { reject(new Error("Görsel açılamadı.")); };
      img.onload = function () {
        let side = maxSide, quality = 0.86;
        for (let i = 0; i < 10; i++) {
          const k = Math.min(1, side / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          const x = c.getContext("2d");
          x.fillStyle = "#fff"; x.fillRect(0, 0, w, h);
          x.drawImage(img, 0, 0, w, h);
          const out = c.toDataURL("image/jpeg", quality);
          if (out.length <= maxLen) { resolve({ src: out, w: w, h: h }); return; }
          if (quality > 0.62) quality -= 0.08; else side = Math.round(side * 0.8);
        }
        reject(new Error("Görsel çok büyük; daha küçük bir görsel deneyin."));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------------- ayarlar ve katalog ---------------- */

export async function seedSales() {
  const f = await fb();
  const now = new Date().toISOString();
  await f.setDoc(f.doc(f.db, "sales", "settings"), Object.assign({}, DEFAULT_SETTINGS, { seededAt: now }));
  await f.setDoc(f.doc(f.db, "sales", "catalog"), { products: DEFAULT_PRODUCTS, updatedAt: now });
  writeLog("teklif-ayar", "sales", "teklif modülü kuruldu: " + DEFAULT_PRODUCTS.length + " ürünlük katalog");
}

export async function saveSettings(body) {
  const f = await fb();
  const clean = clone(body);
  clean.terms = (clean.terms || []).map(function (t) { return String(t || "").trim(); }).filter(Boolean);
  clean.validDays = parseNum(clean.validDays) || 0;
  clean.vatRate = Number(clean.vatRate) || 0;
  clean.updatedAt = new Date().toISOString();
  await f.setDoc(f.doc(f.db, "sales", "settings"), clean);
  writeLog("teklif-ayar", "sales/settings", "teklif ayarları güncellendi");
}

export async function saveProducts(products, logText) {
  const f = await fb();
  await f.setDoc(f.doc(f.db, "sales", "catalog"), { products: products, updatedAt: new Date().toISOString() });
  if (logText) writeLog("urun-katalog", "sales/catalog", logText);
}

export function units() {
  const set = UNITS.slice();
  data.products.forEach(function (p) { if (p.unit && set.indexOf(p.unit) === -1) set.push(p.unit); });
  return set;
}

export function productGroups() {
  const set = PRODUCT_GROUPS.slice();
  data.products.forEach(function (p) { if (p.group && set.indexOf(p.group) === -1) set.push(p.group); });
  return set;
}

/* ---------------- türetilmiş ---------------- */

export function trLower(s) {
  try { return String(s || "").toLocaleLowerCase("tr-TR"); } catch (e) { return String(s || "").toLowerCase(); }
}

// Listeye yalnızca her teklifin son sürümü çıkar.
export function latestQuotes() {
  return data.quotes.filter(function (q) { return !q.supersededBy; });
}

export function productByName(name) {
  const k = trLower(String(name || "").trim());
  if (!k) return null;
  for (let i = 0; i < data.products.length; i++) if (trLower(data.products[i].name) === k) return data.products[i];
  return null;
}

export function searchProducts(term, max) {
  const words = trLower(term).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return data.products.filter(function (p) {
    const hay = trLower(p.name + " " + (p.code || "") + " " + (p.group || ""));
    return words.every(function (w) { return hay.indexOf(w) !== -1; });
  }).slice(0, max || 8);
}

// Aynı üründe, aynı para biriminde verilmiş en son fiyat — elle girişe yol gösterir.
export function lastPrice(productId, currency, exceptId) {
  if (!productId) return null;
  const list = data.quotes.filter(function (q) { return q.id !== exceptId && (q.currency || "TRY") === currency; })
    .sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")) || (b.seq || 0) - (a.seq || 0); });
  for (let i = 0; i < list.length; i++) {
    const items = list[i].items || [];
    for (let j = 0; j < items.length; j++) {
      if (items[j].productId === productId && items[j].price !== null && items[j].price !== undefined) {
        return { price: items[j].price, label: quoteLabel(list[i]), date: list[i].date };
      }
    }
  }
  return null;
}

// Daha önce teklif verilmiş müşteriler — firma adı yazılınca bilgiler dolar.
export function knownCustomers() {
  const map = {};
  data.quotes.slice().sort(function (a, b) { return String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")); })
    .forEach(function (q) {
      const c = q.customer || {};
      if (c.company) map[trLower(c.company.trim())] = c;
    });
  return Object.keys(map).map(function (k) { return map[k]; })
    .sort(function (a, b) { return a.company.localeCompare(b.company, "tr"); });
}

export function customerByCompany(name) {
  const k = trLower(String(name || "").trim());
  if (!k) return null;
  const list = knownCustomers();
  for (let i = 0; i < list.length; i++) if (trLower(list[i].company.trim()) === k) return list[i];
  return null;
}

export function productUsage(productId) {
  let n = 0;
  data.quotes.forEach(function (q) {
    if ((q.items || []).some(function (l) { return l.productId === productId; })) n++;
  });
  return n;
}

export function longDate(iso) {
  if (!iso) return "—";
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  if (isNaN(d)) return "—";
  try { return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }); }
  catch (e) { return iso; }
}

export function fillTokens(text, q) {
  const c = (q && q.customer) || {};
  return String(text || "")
    .replace(/\{musteri\}/g, c.company || "müşterimiz")
    .replace(/\{yetkili\}/g, c.contact || "")
    .replace(/\{gecerlilik\}/g, longDate(q && q.validUntil))
    .replace(/\{gun\}/g, String((q && q.validDays) || ""));
}
