// Uygulama denetleyicisi: açılış, yönlendirme, olaylar ve işlemler.

import { firebaseConfig, configReady, APP } from "./config.js";
import {
  esc, byId, uid, lsGet, lsSet, todayISO, toast,
  numOf, needOf, doneOf, shortOf
} from "./util.js";
import {
  session, canSee, canSell, isAdmin, myEmail, myName, myDept,
  watchSession, signIn, signInWithPassword, signOutNow, resetPassword,
  registerAndRequest, submitRequest, resendVerification, refreshSession
} from "./auth.js";
import * as store from "./store.js";
import { data } from "./store.js";
import * as V from "./views.js";
import * as QV from "./quote-views.js";
import * as QA from "./quote-app.js";
import { linkProject, quoteLabel } from "./quotes.js";
import { ROLE_ORDER, roleDef } from "./roles.js";
import { DEFAULT_GROUPS, DEFAULT_DEPTS, DEFAULT_STEPS, DEFAULT_SECTIONS, STEP_TYPES, quoteItemStep, orderStatusLabel } from "./seed.js";
import { filesOf, uploadTaskFile, archiveFile, storageHint, checkFile } from "./files.js";
import { lockReasons, isPurchase } from "./locks.js";

const S = {
  view: lsGet("toysmar.view") || "panel",
  gate: "giris",      // giriş ekranı: giris | talep
  projectId: null,
  projView: "liste",
  showArchived: false,
  wizard: null,
  modal: null,
  confirm: null,
  confirmTimer: null,
  log: null,
  focusNext: null,
  jobFilter: "acik",  // proje dışı işler süzgeci: acik | gecikti | acil | tamam | tumu
  jobDept: "",
  jobSearch: "",
  booted: false
};

const root = () => document.getElementById("root");

QA.init({ S: S, render: render, guard: guard, startProjectFromQuote: startProjectFromQuote });

const QUOTE_VIEWS = ["teklifler", "teklif", "teklif-ayar"];

/* ==================== açılış ==================== */

function gate(inner) {
  root().innerHTML = '<div class="gate"><div class="gate-card">' +
    '<div class="gate-mark">TY</div>' + inner + '</div></div>';
}

const GOOGLE_ICON =
  '<svg viewBox="0 0 48 48" aria-hidden="true">' +
  '<path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.7l7.8 6.1C12.3 13.7 17.6 9.5 24 9.5z"/>' +
  '<path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>' +
  '<path fill="#FBBC05" d="M10.4 28.2c-.5-1.4-.8-2.9-.8-4.2s.3-2.8.8-4.2l-7.8-6.1C.9 16.8 0 20.3 0 24s.9 7.2 2.6 10.3l7.8-6.1z"/>' +
  '<path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.4-5.6l-7.5-5.8c-2.1 1.4-4.8 2.2-7.9 2.2-6.4 0-11.7-4.2-13.6-9.9l-7.8 6.1C6.5 42.1 14.6 47.5 24 47.5z"/></svg>';

function renderGate() {
  if (!configReady()) {
    gate('<h1>Kurulum tamamlanmadı</h1>' +
      '<p>Firebase bağlantı bilgileri henüz girilmemiş.</p>' +
      '<div class="err"><strong>js/config.js</strong> dosyasındaki <code>firebaseConfig</code> ' +
      'değerleri Firebase Console’daki gerçek değerlerle doldurulmalı.</div>');
    return true;
  }
  if (session.state === "loading") {
    gate('<h1>' + esc(APP.name) + '</h1><p>Bağlanıyor…</p>');
    return true;
  }
  if (session.state === "error") {
    gate('<h1>Bağlanılamadı</h1><div class="err">' + esc(session.error || "Bilinmeyen hata") + '</div>' +
      '<button class="btn" onclick="location.reload()">Yeniden dene</button>');
    return true;
  }
  if (session.state === "anon") {
    gate(S.gate === "talep" ? requestFormHtml(true) : loginHtml());
    return true;
  }
  if (session.state === "unverified") { gate(verifyHtml()); return true; }
  if (session.state === "denied")     { gate(requestFormHtml(false)); return true; }
  if (session.state === "pending")    { gate(pendingHtml()); return true; }
  if (session.state === "rejected")   { gate(rejectedHtml()); return true; }
  return false;
}

function loginHtml() {
  return '<h1>' + esc(APP.name) + '</h1>' +
    '<p>Üretim planlama ve iş emri takibi.</p>' +
    '<form class="gate-form" id="form-login">' +
    '<label for="g-email">E-posta</label>' +
    '<input id="g-email" type="email" autocomplete="username" required>' +
    '<label for="g-pass">Şifre</label>' +
    '<input id="g-pass" type="password" autocomplete="current-password" required>' +
    '<button class="btn btn-pri btn-wide" type="submit">Giriş yap</button>' +
    '</form>' +
    '<button class="linkish" id="btn-forgot">Şifremi unuttum</button>' +
    '<div class="gate-sep"><span>veya</span></div>' +
    '<button class="btn-google" id="btn-google">' + GOOGLE_ICON + '<span>Google ile giriş yap</span></button>' +
    '<div class="foot">Hesabınız yok mu? ' +
    '<button class="linkish" data-gate="talep">Erişim izni isteyin</button></div>';
}

// needPass: hesabı olmayan kişi aynı formda şifresini de belirler.
// Google ile girmiş kişide hesap zaten var, yalnızca görev sorulur.
function requestFormHtml(needPass) {
  return '<h1>Erişim izni iste</h1>' +
    '<p>Bilgileriniz yöneticiye gider. Yönetici görevinize göre bir rol verir; ' +
    'o rol hangi ekranları göreceğinizi belirler.</p>' +
    (needPass ? '' : '<div class="who">' + esc(myEmail()) + '</div>') +
    '<form class="gate-form" id="form-request">' +
    '<label for="g-name">Ad soyad</label>' +
    '<input id="g-name" type="text" autocomplete="name" value="' +
      esc((session.user && session.user.name) || "") + '" required>' +
    (needPass
      ? '<label for="g-email">Gmail adresiniz</label>' +
        '<input id="g-email" type="email" autocomplete="username" required>'
      : '') +
    '<label for="g-gorev">Göreviniz</label>' +
    '<input id="g-gorev" type="text" placeholder="örn. kaynak ustası, üretim planlama" required>' +
    (needPass
      ? '<label for="g-pass">Şifre belirleyin</label>' +
        '<input id="g-pass" type="password" autocomplete="new-password" minlength="6" required>' +
        '<label for="g-pass2">Şifre tekrar</label>' +
        '<input id="g-pass2" type="password" autocomplete="new-password" minlength="6" required>'
      : '') +
    '<button class="btn btn-pri btn-wide" type="submit">Erişim iste</button>' +
    '</form>' +
    (needPass
      ? '<div class="gate-sep"><span>veya</span></div>' +
        '<button class="btn-google" id="btn-google">' + GOOGLE_ICON + '<span>Google ile iste</span></button>' +
        '<div class="foot"><button class="linkish" data-gate="giris">← Girişe dön</button></div>'
      : '<div class="foot"><button class="linkish" data-signout="1">Başka hesapla dene</button></div>');
}

function verifyHtml() {
  return '<h1>E-postanızı doğrulayın</h1>' +
    '<div class="who">' + esc(myEmail()) + '</div>' +
    '<p>Bu adrese bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladıktan sonra ' +
    'aşağıdaki düğmeye basın — talebiniz o an yöneticiye iletilir.</p>' +
    '<button class="btn btn-pri btn-wide" id="btn-verified">Doğruladım, devam et</button>' +
    '<div class="foot"><button class="linkish" id="btn-resend">E-postayı tekrar gönder</button>' +
    ' · <button class="linkish" data-signout="1">Çık</button></div>';
}

function pendingHtml() {
  const r = session.request || {};
  return '<h1>Talebiniz iletildi</h1>' +
    '<div class="who">' + esc(myEmail()) + '</div>' +
    '<p>Yönetici görevinize göre bir rol verdiğinde uygulama açılır.' +
    (r.gorev ? ' Bildirdiğiniz görev: <strong>' + esc(r.gorev) + '</strong>.' : '') + '</p>' +
    '<button class="btn btn-pri btn-wide" id="btn-recheck">Durumu yenile</button>' +
    '<div class="foot"><button class="linkish" data-signout="1">Çık</button></div>';
}

function rejectedHtml() {
  return '<h1>Talebiniz onaylanmadı</h1>' +
    '<div class="who">' + esc(myEmail()) + '</div>' +
    '<p>Yönetici bu hesaba giriş yetkisi vermedi. Bunun bir yanlışlık olduğunu ' +
    'düşünüyorsanız yöneticiyle görüşün.</p>' +
    '<button class="btn" data-signout="1">Çık</button>';
}

function renderShell() {
  root().innerHTML =
    '<div class="shell"><aside class="rail">' +
    '<div class="brand"><div class="brand-mark">TY</div><div>' +
    '<div class="brand-name">' + esc(APP.short) + '</div>' +
    '<div class="brand-sub">Proje Takibi</div></div></div>' +
    '<nav class="nav" id="nav"></nav>' +
    '<div class="rail-foot" id="rail-foot"></div>' +
    '</aside><main class="main" id="main"></main></div>';
}

function render() {
  if (renderGate()) return;
  if (!document.getElementById("main")) { renderShell(); S.booted = true; }

  // Rolün göremediği bir ekranda kalınmaz — ilk açık ekrana düşülür.
  if (!canSee(S.view)) {
    const first = V.navItems(S)[0];
    S.view = first ? first.id : "isler";
  }

  document.getElementById("nav").innerHTML = V.navHtml(S);
  document.getElementById("rail-foot").innerHTML = V.meCardHtml();

  const main = document.getElementById("main");
  const ready = data.loaded.catalog && data.loaded.org;
  const quoteView = QUOTE_VIEWS.indexOf(S.view) !== -1;

  if (!ready) {
    main.innerHTML = '<div class="panel"><div class="empty"><h3>Veriler yükleniyor…</h3></div></div>';
    return;
  }
  // Teklif modülü üretim kataloğundan bağımsız çalışır.
  if (!data.steps.length && !quoteView) { main.innerHTML = V.viewSetup(); return; }

  if (quoteView) {
    QA.ensureDraft();
    // Teklif yazılırken gelen veri güncellemeleri düzenleyiciyi yeniden çizmez.
    if (QA.tryPatch()) { renderModal(); return; }
  }

  let html = "";
  if (S.view === "panel") html = V.viewPanel(S);
  else if (S.view === "projeler") html = V.viewProjects(S);
  else if (S.view === "proje") html = V.viewProject(S);
  else if (S.view === "projedisi") html = V.viewJobs(S);
  else if (S.view === "isler") html = V.viewMyWork(S);
  else if (S.view === "yeni") { if (!S.wizard) S.wizard = newWizard(); html = V.viewWizard(S); }
  else if (S.view === "teklifler") html = QV.viewQuotes(S);
  else if (S.view === "teklif") html = S.q ? QV.viewQuote(S) : QV.viewQuotes(S);
  else if (S.view === "teklif-ayar") { QA.ensureSalesDraft(); html = QV.viewSalesSettings(S); }
  else if (S.view === "talepler") html = V.viewRequests(S);
  else if (S.view === "kayitlar") html = V.viewLog(S);
  else if (S.view === "ayarlar") html = V.viewSettings(S);
  else html = V.viewMyWork(S);
  paint(main, html);
  renderModal();
}

// İçeriği değiştirirken odaktaki alanı ve imleç yerini korur; yazarken gelen
// bir güncelleme kullanıcının yazdığı kutudan atmasın.
function paint(main, html) {
  const ae = document.activeElement;
  let keep = null;
  if (ae && ae.id && main.contains(ae)) {
    keep = { id: ae.id, s: null, e: null };
    try { keep.s = ae.selectionStart; keep.e = ae.selectionEnd; } catch (err) {}
  }
  main.innerHTML = html;
  const explicit = S.focusNext;
  const want = explicit || (keep && keep.id);
  S.focusNext = null;
  if (!want) return;
  const el = document.getElementById(want);
  if (!el || el.disabled) return;
  // Açıkça istenen alana kaydırılır; yalnızca geri verilen odakta sayfa oynamaz.
  try { el.focus({ preventScroll: !explicit }); } catch (err) { el.focus(); }
  if (explicit) {
    // Yeni eklenen kalemin miktar kutusu gibi dolu gelen alanda yazılan, içeriğin yerine geçsin.
    if (el.tagName === "INPUT" && el.value) { try { el.select(); } catch (err) {} }
  } else if (keep && keep.id === want && typeof keep.s === "number") {
    try { el.setSelectionRange(keep.s, keep.e); } catch (err) {}
  }
}

function go(view) {
  if (!canSee(view)) { toast("Bu ekran için yetkiniz yok."); return; }
  if (S.view === "teklif" && view !== "teklif") QA.flush();
  if (S.view === "teklif-ayar" && view !== "teklif-ayar" && S.salesDirty) {
    toast("Kaydedilmemiş teklif ayarları bırakıldı.");
    S.salesDraft = null; S.salesDirty = false;
  }
  if (view === "teklifler" || view === "teklif-ayar") { S.q = null; S.qPreview = false; }
  S.view = view;
  lsSet("toysmar.view", view);
  window.scrollTo(0, 0);
  if (view === "kayitlar") loadLogNow();
  render();
}

function openProject(id) {
  if (S.projectId !== id) S.projTab = "isler";
  S.projectId = id; S.view = "proje"; window.scrollTo(0, 0); render();
}

/* ==================== açılış akışı ==================== */

(async function boot() {
  render();
  if (!configReady()) return;

  await watchSession(async function (s) {
    if (s.state === "ready") {
      try {
        await store.subscribeAll(render, function (label, e) {
          console.warn(label, e);
          toast(label + " okunamadı: " + ((e && e.message) || "yetki hatası"), "error");
        });
      } catch (e) {
        toast("Veriye bağlanılamadı: " + ((e && e.message) || ""), "error");
      }
    } else {
      store.stopAll();
    }
    render();
  });
})();

/* ==================== iş kuralları ==================== */

function newWizard() {
  return {
    step: 1,
    p: {
      code: "", name: "", description: "", company: "", customer: "", contact: "", address: "",
      theme: "", startDate: todayISO(), dueDate: "",
      salesperson: "", designer3d: "", drafter: "", note: ""
    },
    sel: {},
    quoteId: "", quoteNo: ""
  };
}

// Proje kodu: 2-4 büyük harf, benzersiz. Hata metni döner, sorun yoksa "".
function codeProblem(code, exceptId) {
  const c = store.normalizeCode(code);
  if (!c) return "Proje kodu gerekli — panellerin üzerine yazılan kısaltma (örn. AP, BP).";
  if (!/^[A-ZÇĞİÖŞÜ]{2,4}$/.test(c)) return "Proje kodu 2-4 büyük harf olmalı (örn. AP, KP, MP).";
  if (store.codeTaken(c, exceptId)) return "“" + c + "” kodu başka bir projede kullanılıyor.";
  return "";
}

// Kabul edilen tekliften üretim projesi: sihirbaz müşteri bilgileriyle dolu açılır.
function startProjectFromQuote(q) {
  const c = q.customer || {};
  S.wizard = newWizard();
  S.wizard.p.name = q.title || c.company || quoteLabel(q);
  S.wizard.p.company = c.company || "";
  S.wizard.p.customer = c.contact || "";
  S.wizard.p.contact = [c.phone, c.email].filter(Boolean).join(" · ");
  S.wizard.p.address = [c.address, c.city].filter(Boolean).join(", ");
  S.wizard.quoteId = q.id;
  S.wizard.quoteNo = quoteLabel(q);
  // Teklif kalemleri → satın alma adımları (seed.js QUOTE_STEP_MAP). Eşleşen kalem
  // adedi ve adıyla ön seçilir; eşleşmeyenler "serbest kalem" olarak listelenir.
  S.wizard.freeItems = [];
  S.wizard.preset = 0;
  (q.items || []).forEach(function (it) {
    if (!it || it.kind === "head" || !it.name) return;
    const sid = quoteItemStep(it.name);
    const st = sid ? byId(data.steps, sid) : null;
    if (!st) { S.wizard.freeItems.push({ name: it.name, qty: it.qty }); return; }
    const cur = S.wizard.sel[sid];
    const total = (cur ? numOf(cur.qty) : 0) + numOf(it.qty);
    S.wizard.sel[sid] = {
      dept: st.dept, section: st.section || "", assignee: "", qty: total ? String(total) : "",
      spec: cur && cur.spec ? cur.spec + " · " + it.name : it.name, dueDate: ""
    };
    S.wizard.preset++;
  });
  go("yeni");
}

async function toggleTask(id, force) {
  const t = byId(data.tasks, id); if (!t) return;
  const unit = t.unit || "adet";

  if (t.status === "tamam") {
    await guard(store.saveTask(id, { status: "bekliyor", completedAt: "", completedBy: "", completedByName: "", shortClosed: false, lockOverride: false },
      "“" + t.name + "” geri alındı"));
    return;
  }
  // Kilit (6a): bekleyen koşullar varken kapanmaz; yalnızca yönetici "Kilidi aş" ile geçer.
  const locks = lockReasons(t);
  if (locks.length && !(force && isAdmin())) {
    toast("“" + t.name + "” için önce: " + locks.slice(0, 3).join(", ") + (locks.length > 3 ? " (+" + (locks.length - 3) + ")" : "") + ".");
    return;
  }
  // Dosya tipinde en az bir dosya, metin tipinde metin olmadan tamamlanmaz.
  if (t.type === "file" && !filesOf(t.id).length) { toast("“" + t.name + "” için önce dosya yükleyin."); return; }
  if (t.type === "text" && !String(t.text || "").trim()) { toast("“" + t.name + "” için önce metni girin."); return; }
  const need = needOf(t), made = doneOf(t);
  if (t.type === "qty" && need > 0 && made < need && !force) {
    if (t.doneQty === null || t.doneQty === undefined || t.doneQty === "")
      toast("“" + t.name + "” için önce yapılan adedi girin. Gereken: " + need + " " + unit + ".");
    else
      toast("“" + t.name + "”: " + need + " " + unit + " gerekiyor, " + made + " girildi — " + (need - made) + " " + unit + " eksik.");
    return;
  }
  const patch = {
    status: "tamam", completedAt: new Date().toISOString(),
    completedBy: myEmail(), completedByName: myName()
  };
  if (locks.length) {
    patch.lockOverride = true; patch.lockOverrideBy = myName(); patch.lockOverrideNote = locks.join(", ");
  }
  const shortClose = force && need > 0 && made < need;
  // Satın alma kalemi kapanınca sipariş durumu da kapanır: tam ise geldi, eksik kapatıldıysa eksik.
  if (isPurchase(t)) patch.orderStatus = shortClose ? "eksik" : "geldi";
  if (shortClose) {
    patch.shortClosed = true; patch.shortNeed = need; patch.doneQty = String(made);
    await guard(store.saveTask(id, patch, "“" + t.name + "” eksik kapatıldı: " + made + "/" + need + " " + unit +
      (locks.length ? " · kilit aşıldı: " + locks.join(", ") : "")));
    toast("“" + t.name + "” eksik kapatıldı: " + made + "/" + need + " " + unit + ".");
  } else if (locks.length) {
    patch.shortClosed = false;
    await guard(store.saveTask(id, patch, "“" + t.name + "” kilit aşıldı: " + locks.join(", ")));
    toast("“" + t.name + "” kilit aşılarak tamamlandı. Bekleyen koşullar günlüğe yazıldı.");
  } else {
    patch.shortClosed = false;
    await guard(store.saveTask(id, patch, "“" + t.name + "” tamamlandı"));
    toast("“" + t.name + "” tamamlandı.");
  }
}

// Adet değişince tamamlanmış adım kendiliğinden yeniden açılır.
function qtyPatch(t, field, value) {
  const patch = {}; patch[field] = value;
  const explicit = !(t.doneQty === null || t.doneQty === undefined || t.doneQty === "");
  if (field === "qty" && !explicit && t.status === "tamam") patch.doneQty = String(numOf(t.qty));
  const next = Object.assign({}, t, patch);
  const need = needOf(next), made = doneOf(next);
  if (t.status === "tamam" && !t.shortClosed && need > 0 && made < need) {
    patch.status = "devam"; patch.completedAt = ""; patch.completedBy = ""; patch.completedByName = "";
    patch.shortClosed = false;
    toast("“" + t.name + "” yeniden açıldı: " + need + " " + (t.unit || "adet") + " gerekiyor, " + made + " yapılmış.");
  }
  if (t.shortClosed && need > 0 && made >= need) patch.shortClosed = false;
  return patch;
}

async function guard(promise) {
  try { return await promise; }
  catch (e) {
    const msg = (e && e.message) || "bilinmeyen hata";
    toast(/permission|insufficient/i.test(msg) ? "Bu işlem için yetkiniz yok." : "Kaydedilemedi: " + msg, "error");
  }
}

async function doSeed() {
  const me = myEmail();
  // Kurulumu yapan yönetici Üretim Planlama'ya yazılır; Ayarlar'dan değiştirilir.
  const person = { id: uid(), name: myName(), dept: "d-uretim", section: "", email: me };
  await guard(store.saveCatalog(DEFAULT_GROUPS, DEFAULT_STEPS,
    "başlangıç kataloğu yüklendi (" + DEFAULT_STEPS.length + " adım, sürüm 2)", DEFAULT_SECTIONS));
  await guard(store.saveOrg(DEFAULT_DEPTS, [person], "varsayılan departmanlar ve ilk personel kaydı"));
  toast("Katalog yüklendi. Ayarlar’dan personeli ekleyebilirsiniz.");
}

async function doMigrate() {
  const plan = store.migrationPlan(DEFAULT_DEPTS, DEFAULT_STEPS);
  await guard(store.migrateToV2(plan, DEFAULT_GROUPS, DEFAULT_SECTIONS));
  toast("Yeni katalog yüklendi: " + plan.steps.length + " adım · " + plan.people.length + " personel ve " +
    plan.tasks.length + " iş emri yeni departmanlara taşındı.");
}

async function createProjectNow() {
  const w = S.wizard;
  if (!w.p.name.trim()) { toast("Proje adı gerekli."); w.step = 1; render(); return; }
  const cp = codeProblem(w.p.code);
  if (cp) { toast(cp); w.step = 1; S.focusNext = "w-code"; render(); return; }
  const pid = uid(), now = new Date().toISOString();
  const picked = data.steps.filter(function (s) { return w.sel[s.id]; });
  const project = {
    code: store.normalizeCode(w.p.code), name: w.p.name.trim(), description: w.p.description || "",
    company: w.p.company || "", customer: w.p.customer || "", contact: w.p.contact || "", address: w.p.address || "",
    theme: w.p.theme || "", startDate: w.p.startDate || "", dueDate: w.p.dueDate || "",
    salesperson: w.p.salesperson || "", designer3d: w.p.designer3d || "", drafter: w.p.drafter || "", note: w.p.note || "",
    status: "aktif", archived: false, createdAt: now, createdBy: myEmail(),
    quoteId: w.quoteId || "", quoteNo: w.quoteNo || ""
  };
  const tasks = picked.map(function (s, i) {
    const v = w.sel[s.id];
    return {
      id: uid(), projectId: pid, stepId: s.id, name: s.name, group: s.group,
      type: s.type || "check", unit: s.unit || "",
      dept: v.dept || s.dept || "", section: v.section || s.section || "", assignee: v.assignee || "",
      qty: v.qty || "", doneQty: "", shortClosed: false,
      spec: v.spec || "", supplier: v.supplier || "", orderStatus: "", note: "",
      dueDate: v.dueDate || w.p.dueDate || "", status: "bekliyor",
      completedAt: "", completedBy: "", completedByName: "",
      order: (s.order || i) * 10, createdAt: now
    };
  });
  try {
    await store.createProject(pid, project, tasks);
    if (project.quoteId && canSell()) await guard(linkProject(project.quoteId, pid, project.name));
    S.wizard = null;
    toast(tasks.length + " iş emri oluşturuldu.");
    openProject(pid);
  } catch (e) {
    toast("Oluşturulamadı: " + ((e && e.message) || "hata"), "error");
  }
}

async function addStepsNow(pid, ids) {
  if (!ids.length) return;
  const now = new Date().toISOString();
  const p = byId(data.projects, pid);
  const base = store.projTasks(pid).length;
  const tasks = ids.map(function (id, i) {
    const s = byId(data.steps, id);
    if (!s) return null;
    return {
      id: uid(), projectId: pid, stepId: s.id, name: s.name, group: s.group,
      type: s.type || "check", unit: s.unit || "", dept: s.dept || "", section: s.section || "", assignee: "",
      qty: "", doneQty: "", shortClosed: false, spec: "", supplier: "", orderStatus: "", note: "",
      dueDate: (p && p.dueDate) || "", status: "bekliyor",
      completedAt: "", completedBy: "", completedByName: "",
      order: (s.order || (base + i)) * 10, createdAt: now
    };
  }).filter(Boolean);
  await guard(store.addTasks(pid, tasks));
  toast(tasks.length + " adım eklendi.");
}

async function loadLogNow() {
  try { S.log = await store.loadLog(80); }
  catch (e) { S.log = []; toast("Kayıtlar okunamadı.", "error"); }
  if (S.view === "kayitlar") render();
}

/* ==================== onaylı işlemler ==================== */

function arm(key) {
  clearTimeout(S.confirmTimer);
  S.confirm = key;
  // Teklif düzenleyicisi normalde yeniden çizilmez; onay düğmesinin değişmesi için zorlanır.
  S.qRebuild = true;
  render();
  toast("Onaylamak için tekrar tıklayın.");
  S.confirmTimer = setTimeout(function () { S.confirm = null; S.qRebuild = true; render(); }, 5000);
}

async function runConfirmed(key) {
  clearTimeout(S.confirmTimer);
  S.confirm = null;
  const i = key.indexOf(":");
  const kind = key.slice(0, i), id = key.slice(i + 1);

  if (kind.charAt(0) === "q" && await QA.confirmed(kind, id)) { S.qRebuild = true; render(); return; }

  if (kind === "migrate") { await doMigrate(); }
  else if (kind === "deljob") {
    const t = byId(data.tasks, id);
    await guard(store.deleteTask(id, t && t.name));
    S.modal = null;
    toast("İş emri silindi.");
  }
  else if (kind === "delproj") {
    const p = byId(data.projects, id);
    const ids = store.projTasks(id).map(function (t) { return t.id; });
    await guard(store.hardDeleteProject(id, p && p.name, ids));
    if (S.projectId === id) { S.projectId = null; S.view = "projeler"; }
    toast("Proje kalıcı olarak silindi.");
  }
  else if (kind === "delperson") {
    const p = byId(data.people, id);
    const open = data.tasks.filter(function (t) { return t.assignee === id && t.status !== "tamam"; }).length;
    if (open) { toast("Bu kişide " + open + " açık iş emri var. Önce başkasına devredin."); render(); return; }
    await guard(store.saveOrg(data.depts, data.people.filter(function (x) { return x.id !== id; }),
      "personel silindi: " + ((p && p.name) || id)));
  }
  else if (kind === "deldept") {
    if (data.people.filter(function (p) { return p.dept === id; }).length) {
      toast("Bu departmanda personel var. Önce onları taşıyın."); render(); return;
    }
    await guard(store.saveOrg(data.depts.filter(function (d) { return d.id !== id; }), data.people, "departman silindi"));
  }
  else if (kind === "delstep") {
    const s = byId(data.steps, id);
    await guard(store.saveCatalog(data.groups, data.steps.filter(function (x) { return x.id !== id; }),
      "katalogdan çıkarıldı: " + ((s && s.name) || id)));
    toast("Adım katalogdan çıkarıldı. Açık projeler etkilenmez.");
  }
  else if (kind === "delmember") {
    await guard(store.removeMember(id));
    toast("Giriş yetkisi kaldırıldı.");
  }
  else if (kind === "rejectreq") {
    const req = data.requests.filter(function (x) { return x.id === id; })[0];
    if (req) await guard(store.rejectRequest(req));
    toast("Talep reddedildi.");
  }
  render();
}

/* ==================== modaller ==================== */

function renderModal() {
  const host = document.getElementById("modal-root");
  if (!S.modal) { host.innerHTML = ""; host.removeAttribute("data-mkey"); return; }
  const m = S.modal;
  // Açık pencere her veri güncellemesinde yeniden çizilmez; yoksa yazılanlar silinirdi.
  // Yalnızca başka bir pencere açılınca ya da onay düğmesi durumu değişince çizilir.
  const key = m.kind + ":" + (m.id || "") + ":" + (S.confirm || "");
  if (host.firstChild && host.getAttribute("data-mkey") === key) return;
  host.setAttribute("data-mkey", key);
  let body = "", title = "", save = "Kaydet";

  if (m.kind === "proj") {
    title = "Proje bilgileri";
    const p = byId(data.projects, m.id) || {};
    body = '<div class="form">' +
      '<div class="f"><label for="m-code">Proje kodu</label><input id="m-code" data-m="code" type="text" class="mono" maxlength="4" ' +
        'style="text-transform:uppercase" value="' + esc(p.code || "") + '"></div>' +
      mf("name", "Proje adı", p.name, "text") +
      mf("company", "Cari unvan", p.company, "text") + mf("theme", "Tema", p.theme, "text") +
      mf("customer", "Müşteri / yetkili", p.customer, "text") + mf("contact", "İletişim bilgileri", p.contact || p.phone, "text") +
      mf("startDate", "Başlangıç", p.startDate, "date") + mf("dueDate", "Teslim", p.dueDate, "date") +
      mf("salesperson", "Sipariş alan", p.salesperson, "text") + mf("designer3d", "3D tasarım", p.designer3d, "text") +
      mf("drafter", "Çizim ve takip", p.drafter, "text") +
      '<div class="f"><label for="m-status">Durum</label><select id="m-status" data-m="status">' +
      ["aktif", "beklemede", "tamam"].map(function (s) {
        return '<option value="' + s + '"' + ((p.status || "aktif") === s ? " selected" : "") + '>' +
          { aktif: "Aktif", beklemede: "Beklemede", tamam: "Tamamlandı" }[s] + '</option>';
      }).join("") + '</select></div>' +
      '<div class="f full"><label for="m-description">Proje açıklaması</label>' +
      '<textarea id="m-description" data-m="description">' + esc(p.description || "") + '</textarea></div>' +
      '<div class="f full"><label for="m-address">Teslimat adresi</label>' +
      '<textarea id="m-address" data-m="address">' + esc(p.address || "") + '</textarea></div>' +
      '<div class="f full"><label for="m-note">Proje notu</label>' +
      '<textarea id="m-note" data-m="note">' + esc(p.note || "") + '</textarea></div></div>';
  }
  else if (m.kind === "addsteps") {
    title = "Projeye adım ekle"; save = "Ekle";
    const have = {};
    store.projTasks(m.id).forEach(function (t) { have[t.stepId] = true; });
    const avail = data.steps.filter(function (s) { return !have[s.id]; });
    if (!avail.length) body = '<p class="muted">Katalogdaki tüm adımlar bu projede zaten var.</p>';
    else {
      data.groups.forEach(function (g) {
        const items = avail.filter(function (s) { return s.group === g.id; });
        if (!items.length) return;
        body += '<div class="gwrap"><div class="gtitle"><h3>' + esc(g.label) + '</h3></div><div class="chips">';
        items.forEach(function (s) {
          body += '<button type="button" class="chip" data-mpick="' + esc(s.id) + '">' +
            '<span class="box" aria-hidden="true"></span><span><span class="nm">' + esc(s.name) + '</span>' +
            '<span class="dp">' + esc(store.deptName(s.dept)) + '</span></span></button>';
        });
        body += '</div></div>';
      });
    }
  }
  else if (m.kind === "person") {
    const p = m.id ? byId(data.people, m.id) : null;
    title = p ? "Personeli düzenle" : "Personel ekle";
    const mem = p ? data.members.filter(function (x) {
      return String(x.id || "").toLowerCase() === String(p.email || "").toLowerCase();
    })[0] : null;
    body = '<div class="form">' +
      mf("name", "Ad soyad", p ? p.name : "", "text") +
      '<div class="f"><label for="m-dept">Departman</label><select id="m-dept" data-m="dept">' +
      data.depts.map(function (d) {
        return '<option value="' + esc(d.id) + '"' + (p && p.dept === d.id ? " selected" : "") + '>' + esc(d.name) + '</option>';
      }).join("") + '</select></div>' +
      sectionField(p ? p.dept : (data.depts[0] || {}).id, p ? p.section : "") +
      mf("email", "E-posta", p ? p.email : "", "email") +
      '<div class="f"><label for="m-role">Uygulama yetkisi</label><select id="m-role" data-m="role">' +
      '<option value="">Giremez</option>' +
      ROLE_ORDER.map(function (k) {
        const rd = roleDef(k);
        return '<option value="' + esc(k) + '"' + (mem && mem.role === k ? " selected" : "") + '>' +
          esc(rd.label + " — " + rd.desc) + '</option>';
      }).join("") +
      '</select></div>' +
      '<p class="muted full" style="grid-column:1/-1; margin:0; font-size:12.5px">' +
      'E-posta yazıp rol seçerseniz kişi şifresiyle ya da Google hesabıyla girebilir. ' +
      'Rol, gireceği ekranları belirler. “Giremez” seçilirse kayıt kalır ama giriş yapamaz.</p></div>';
  }
  else if (m.kind === "import") {
    title = "Fiyat listesi güncellemesi"; save = "Kataloğu güncelle";
    body = QV.importSummaryHtml(S);
  }
  else if (m.kind === "job") {
    const t = m.id ? byId(data.tasks, m.id) : null;
    if (t) {
      title = "Proje dışı iş emrini düzenle";
      body = '<div class="form">' +
        '<div class="f full"><label for="m-name">İş</label><input id="m-name" data-m="name" type="text" value="' + esc(t.name) + '"></div>' +
        '<div class="f full"><label for="m-spec">Açıklama</label><textarea id="m-spec" data-m="spec">' + esc(t.spec || "") + '</textarea></div>' +
        '<label class="f full mcheck"><input id="m-urgent" data-m="urgent" type="checkbox"' + (t.urgent ? " checked" : "") + '> ' +
        '<span><strong>Acil</strong> — panelde termini beklemeden dikkat gerektirenlere düşer</span></label>' +
        '<p class="muted full" style="grid-column:1/-1; margin:0; font-size:12.5px">Departman, sorumlu, termin ve adet satırdan değiştirilir. ' +
        esc(t.createdByName ? "Açan: " + t.createdByName + " · " : "") + esc(t.createdAt ? String(t.createdAt).slice(0, 10) : "") + '</p>' +
        (isAdmin() ? '<div class="full" style="grid-column:1/-1">' + V.delBtn(S, t.id, "İş emrini kalıcı sil", "deljob") + '</div>' : '') +
        '</div>';
    } else {
      title = "Yeni proje dışı iş emri"; save = "İş emrini aç";
      const d0 = (data.depts[0] || {}).id || "";
      body = '<div class="form">' +
        '<div class="f full"><label for="m-name">İş *</label><input id="m-name" data-m="name" type="text" placeholder="örn. Kaynak makinesi bakımı, numune panel, atölye düzenleme"></div>' +
        '<div class="f full"><label for="m-spec">Açıklama</label><textarea id="m-spec" data-m="spec" placeholder="Ne yapılacak, ölçü, malzeme…"></textarea></div>' +
        '<div class="f"><label for="m-dept">Departman *</label><select id="m-dept" data-m="dept">' +
        data.depts.map(function (d) { return '<option value="' + esc(d.id) + '">' + esc(d.name) + '</option>'; }).join("") + '</select></div>' +
        sectionField(d0, "") +
        '<div class="f"><label for="m-assignee">Sorumlu</label><select id="m-assignee" data-m="assignee">' + assigneeOptions(d0, "", "") + '</select></div>' +
        mf("dueDate", "Termin", "", "date") +
        '<div class="f"><label for="m-type">Takip</label><select id="m-type" data-m="type">' +
        '<option value="check">Tamamlandı işareti</option><option value="qty">Adet girilir</option></select></div>' +
        '<div class="f" data-qtyonly hidden><label for="m-qty">Gereken adet *</label><input id="m-qty" data-m="qty" type="text" inputmode="decimal"></div>' +
        '<div class="f" data-qtyonly hidden><label for="m-unit">Birim</label><input id="m-unit" data-m="unit" type="text" placeholder="adet / metre / m²"></div>' +
        '<label class="f full mcheck"><input id="m-urgent" data-m="urgent" type="checkbox"> ' +
        '<span><strong>Acil</strong> — panelde termini beklemeden dikkat gerektirenlere düşer</span></label>' +
        '</div>';
    }
  }
  else if (m.kind === "dept") {
    title = "Departman ekle";
    body = '<div class="f"><label for="m-name">Departman adı</label>' +
      '<input id="m-name" data-m="name" type="text" placeholder="örn. Kaynak"></div>';
  }
  else if (m.kind === "step") {
    title = "Katalog adımı ekle";
    body = '<div class="form"><div class="f full"><label for="m-name">Adım adı</label>' +
      '<input id="m-name" data-m="name" type="text" placeholder="örn. Elektrik Tesisatı"></div>' +
      '<div class="f"><label for="m-group">Grup</label><select id="m-group" data-m="group">' +
      data.groups.map(function (g) { return '<option value="' + esc(g.id) + '">' + esc(g.label) + '</option>'; }).join("") +
      '</select></div>' +
      '<div class="f"><label for="m-dept">Departman</label><select id="m-dept" data-m="dept">' +
      data.depts.map(function (d) { return '<option value="' + esc(d.id) + '">' + esc(d.name) + '</option>'; }).join("") +
      '</select></div>' +
      sectionField((data.depts[0] || {}).id, "") +
      '<div class="f"><label for="m-type">Tip</label><select id="m-type" data-m="type">' +
      STEP_TYPES.map(function (t) { return '<option value="' + t.v + '">' + esc(t.l) + '</option>'; }).join("") + '</select></div>' +
      '<div class="f"><label for="m-unit">Birim</label><input id="m-unit" data-m="unit" type="text" placeholder="adet / ton / m²"></div></div>';
  }

  host.innerHTML = '<div class="modal-bg" data-mclose="1"><div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
    '<div class="modal-head"><h2>' + esc(title) + '</h2>' +
    '<button class="btn btn-sm btn-ghost" data-mclose="1">Kapat</button></div>' +
    '<div class="modal-body">' + body + '</div>' +
    '<div class="modal-foot"><button class="btn" data-mclose="1">Vazgeç</button>' +
    '<button class="btn btn-pri" data-msave="1">' + esc(save) + '</button></div></div></div>';
}

function assigneeOptions(deptId, sectionId, selected) {
  return '<option value="">Atanmadı — ' + (sectionId ? "bölümün" : "departmanın") + ' işi</option>' +
    store.peopleFor(deptId, sectionId).map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === selected ? " selected" : "") + '>' + esc(p.name) + '</option>';
    }).join("");
}

// Pencerelerdeki bölüm alanı: departmanın bölümü yoksa gizli durur.
function sectionField(deptId, selected) {
  return '<div class="f" id="m-section-wrap"' + (store.sectionsOf(deptId).length ? '' : ' hidden') + '>' +
    '<label for="m-section">Bölüm</label><select id="m-section" data-m="section">' + sectionOptions(deptId, selected) + '</select></div>';
}

function sectionOptions(deptId, selected) {
  return '<option value="">Bölüm seçin</option>' + store.sectionsOf(deptId).map(function (s) {
    return '<option value="' + esc(s.id) + '"' + (s.id === selected ? " selected" : "") + '>' + esc(s.name) + '</option>';
  }).join("");
}

// Penceredeki departman değişince bölüm ve sorumlu listeleri o departmana göre yenilenir.
function refreshModalDept() {
  const dept = (document.getElementById("m-dept") || {}).value || "";
  const wrap = document.getElementById("m-section-wrap"), sec = document.getElementById("m-section");
  if (sec) { sec.innerHTML = sectionOptions(dept, ""); }
  if (wrap) wrap.hidden = !store.sectionsOf(dept).length;
  const a = document.getElementById("m-assignee");
  if (a) a.innerHTML = assigneeOptions(dept, "", "");
}

function mf(key, label, val, type) {
  return '<div class="f"><label for="m-' + key + '">' + esc(label) + '</label>' +
    '<input id="m-' + key + '" type="' + type + '" data-m="' + key + '" value="' + esc(val == null ? "" : val) + '"></div>';
}

async function saveModal() {
  const m = S.modal; if (!m) return;
  const host = document.getElementById("modal-root");
  const val = function (k) { const e = host.querySelector('[data-m="' + k + '"]'); return e ? e.value : ""; };

  try {
    if (m.kind === "import") {
      await QA.confirmImport();
    }
    else if (m.kind === "job") {
      const name = val("name").trim();
      if (!name) { toast("İşin adını yazın."); return; }
      const urgent = !!(host.querySelector("#m-urgent") || {}).checked;
      if (m.id) {
        await guard(store.saveTask(m.id, { name: name, spec: val("spec").trim(), urgent: urgent },
          "proje dışı iş güncellendi: " + name));
        toast("İş emri güncellendi.");
      } else {
        const type = val("type") || "check";
        if (type === "qty" && !numOf(val("qty"))) { toast("Adet girilen işte gereken adedi yazın."); return; }
        const now = new Date().toISOString();
        const job = {
          id: uid(), projectId: "", stepId: "", group: "", name: name, spec: val("spec").trim(),
          type: type, unit: type === "qty" ? (val("unit").trim() || "adet") : "",
          dept: val("dept"), section: val("section"), assignee: val("assignee"),
          qty: type === "qty" ? val("qty").trim() : "", doneQty: "", shortClosed: false,
          supplier: "", orderStatus: "", note: "", dueDate: val("dueDate"), status: "bekliyor", urgent: urgent,
          completedAt: "", completedBy: "", completedByName: "",
          order: 0, createdAt: now, createdBy: myEmail(), createdByName: myName(),
          // Açan kişi ve departmanı: başka departmana açılan iş "Açtıklarım"da izlenir.
          openedBy: myEmail(), openedByName: myName(), openedByDept: myDept()
        };
        await guard(store.createJob(job));
        toast("“" + name + "” iş emri " + store.deptName(job.dept) + " departmanına açıldı.");
      }
    }
    else if (m.kind === "proj") {
      const cp = codeProblem(val("code"), m.id);
      if (cp) { toast(cp); return; }
      if (!val("name").trim()) { toast("Proje adı gerekli."); return; }
      await guard(store.saveProject(m.id, {
        code: store.normalizeCode(val("code")), name: val("name").trim(), theme: val("theme"),
        company: val("company"), customer: val("customer"), contact: val("contact"),
        salesperson: val("salesperson"), designer3d: val("designer3d"), drafter: val("drafter"),
        startDate: val("startDate"), dueDate: val("dueDate"), status: val("status"),
        description: val("description"), address: val("address"), note: val("note")
      }, "proje bilgileri güncellendi: " + val("name")));
      toast("Proje bilgileri güncellendi.");
    }
    else if (m.kind === "addsteps") {
      await addStepsNow(m.id, Object.keys(m.pick || {}));
    }
    else if (m.kind === "person") {
      const name = val("name").trim();
      if (!name) { toast("Ad soyad gerekli."); return; }
      const email = val("email").trim().toLowerCase();
      const role = val("role");
      if (role && !email) { toast("Giriş yetkisi için e-posta gerekli."); return; }

      let people = data.people.slice();
      let pid = m.id;
      let prevEmail = "";
      if (pid) {
        const old = byId(people, pid);
        prevEmail = String((old && old.email) || "").toLowerCase();
        people = people.map(function (x) {
          return x.id === pid ? { id: pid, name: name, dept: val("dept"), section: val("section"), email: email } : x;
        });
      } else {
        pid = uid();
        people = people.concat([{ id: pid, name: name, dept: val("dept"), section: val("section"), email: email }]);
      }
      await guard(store.saveOrg(data.depts, people, (m.id ? "personel güncellendi: " : "personel eklendi: ") + name));

      if (prevEmail && prevEmail !== email) await guard(store.removeMember(prevEmail));
      if (email && role) await guard(store.saveMember(email, {
        name: name, role: role, dept: val("dept"), section: val("section"), personId: pid
      }));
      else if (email && !role) {
        const existing = data.members.filter(function (x) { return String(x.id).toLowerCase() === email; })[0];
        if (existing) await guard(store.removeMember(email));
      }
      toast(m.id ? "Personel güncellendi." : "“" + name + "” eklendi.");
    }
    else if (m.kind === "dept") {
      const n = val("name").trim();
      if (!n) { toast("Departman adı gerekli."); return; }
      await guard(store.saveOrg(data.depts.concat([{ id: uid(), name: n }]), data.people, "departman eklendi: " + n));
      toast("“" + n + "” eklendi.");
    }
    else if (m.kind === "step") {
      const sn = val("name").trim();
      if (!sn) { toast("Adım adı gerekli."); return; }
      let maxo = 0;
      data.steps.forEach(function (s) { if ((s.order || 0) > maxo) maxo = s.order || 0; });
      const st = { id: uid(), name: sn, group: val("group") || (data.groups[0] || {}).id,
        dept: val("dept"), section: val("section"), type: val("type") || "check", unit: val("unit"), order: maxo + 1 };
      if (st.type === "file") st.requiresFile = true;
      await guard(store.saveCatalog(data.groups, data.steps.concat([st]), "kataloğa eklendi: " + sn));
      toast("“" + sn + "” kataloğa eklendi.");
    }
  } catch (e) {
    toast("Kaydedilemedi: " + ((e && e.message) || "hata"), "error");
  }
  S.modal = null;
  render();
}

/* ==================== olaylar ==================== */

document.addEventListener("click", async function (e) {
  let el;

  if (e.target.closest("#btn-google")) {
    try { await signIn(); }
    catch (err) { toast((err && err.message) || "Google ile giriş yapılamadı.", "error"); }
    return;
  }
  if ((el = e.target.closest("[data-gate]"))) { S.gate = el.getAttribute("data-gate"); render(); return; }
  if (e.target.closest("#btn-forgot")) {
    const mail = document.getElementById("g-email");
    try {
      await resetPassword(mail ? mail.value : "");
      toast("Şifre sıfırlama bağlantısı e-postanıza gönderildi.");
    } catch (err) { toast((err && err.message) || "Gönderilemedi.", "error"); }
    return;
  }
  if (e.target.closest("#btn-verified") || e.target.closest("#btn-recheck")) {
    await refreshSession();
    return;
  }
  if (e.target.closest("#btn-resend")) {
    try { await resendVerification(); toast("Doğrulama e-postası tekrar gönderildi."); }
    catch (err) { toast((err && err.message) || "Gönderilemedi.", "error"); }
    return;
  }
  if (e.target.closest("[data-signout]")) {
    store.stopAll(); S.gate = "giris"; await signOutNow(); return;
  }
  if ((el = e.target.closest("[data-approve]"))) {
    const id = el.getAttribute("data-approve");
    const req = data.requests.filter(function (x) { return x.id === id; })[0];
    if (!req) return;
    const sel = document.querySelector('[data-reqrole="' + id + '"]');
    const dsel = document.querySelector('[data-reqdept="' + id + '"]');
    const ssel = document.querySelector('[data-reqsection="' + id + '"]');
    const role = (sel && sel.value) || "personel";
    const dept = dsel && dsel.value;
    el.disabled = true;
    await guard(store.approveRequest(req, role, dept, ssel ? ssel.value : ""));
    toast((req.name || id) + " · " + roleDef(role).label + " · " + store.deptName(dept) + " olarak eklendi.");
    render();
    return;
  }
  if (e.target.closest("[data-doseed]")) { await doSeed(); return; }
  if (e.target.closest("[data-reloadlog]")) { S.log = null; render(); loadLogNow(); return; }

  if (!e.target.closest("[data-confirm]") && await QA.onClick(e)) return;

  if (e.target.closest("[data-newjob]")) {
    S.modal = { kind: "job", id: null }; renderModal();
    const n = document.getElementById("m-name"); if (n) n.focus();
    return;
  }
  if ((el = e.target.closest("[data-editjob]"))) { S.modal = { kind: "job", id: el.getAttribute("data-editjob") }; renderModal(); return; }
  if ((el = e.target.closest("[data-jobfilter]"))) { S.jobFilter = el.getAttribute("data-jobfilter"); render(); return; }

  if ((el = e.target.closest("[data-nav]"))) { go(el.getAttribute("data-nav")); return; }
  if ((el = e.target.closest("[data-projview]"))) { S.projView = el.getAttribute("data-projview"); render(); return; }
  if (e.target.closest("[data-togglearch]")) { S.showArchived = !S.showArchived; render(); return; }

  if ((el = e.target.closest("[data-confirm]"))) {
    const key = el.getAttribute("data-confirm");
    if (S.confirm === key) await runConfirmed(key); else arm(key);
    return;
  }
  if ((el = e.target.closest("[data-arch]"))) {
    const id = el.getAttribute("data-arch"), p = byId(data.projects, id);
    await guard(store.archiveProject(id, !(p && p.archived), p && p.name));
    toast(p && p.archived ? "Proje arşivden çıkarıldı." : "Proje arşivlendi. Verileri duruyor.");
    return;
  }
  if ((el = e.target.closest("[data-open-proj]"))) { openProject(el.getAttribute("data-open-proj")); return; }
  if ((el = e.target.closest("[data-ptab]"))) { S.projTab = el.getAttribute("data-ptab"); render(); return; }
  if (e.target.closest("[data-filesarch]")) { S.showArchivedFiles = !S.showArchivedFiles; render(); return; }
  if ((el = e.target.closest("[data-filearch]"))) {
    await guard(archiveFile(el.getAttribute("data-filearch"), el.getAttribute("data-on") === "1"));
    return;
  }
  if ((el = e.target.closest("[data-accsave]"))) {
    const pid = el.getAttribute("data-accsave");
    const body = {};
    document.querySelectorAll("#main [data-acc]").forEach(function (x) { body[x.getAttribute("data-acc")] = x.value; });
    const p = byId(data.projects, pid);
    await guard(store.saveAccounting(pid, body, "muhasebe bilgileri güncellendi: " + ((p && p.name) || pid)));
    toast("Muhasebe bilgileri kaydedildi.");
    return;
  }
  if ((el = e.target.closest("[data-toggle]"))) { await toggleTask(el.getAttribute("data-toggle")); return; }
  if ((el = e.target.closest("[data-shortclose]"))) { await toggleTask(el.getAttribute("data-shortclose"), true); return; }
  if ((el = e.target.closest("[data-override]"))) { await toggleTask(el.getAttribute("data-override"), true); return; }
  if ((el = e.target.closest("[data-start]"))) {
    const t = byId(data.tasks, el.getAttribute("data-start"));
    await guard(store.saveTask(el.getAttribute("data-start"), { status: "devam" }, "“" + (t ? t.name : "") + "” başlatıldı"));
    return;
  }
  if ((el = e.target.closest("[data-qall]"))) {
    const t = byId(data.tasks, el.getAttribute("data-qall"));
    if (t) await guard(store.saveTask(t.id, qtyPatch(t, "doneQty", String(needOf(t))), "yapılan adet gerekene eşitlendi: " + t.name));
    return;
  }

  /* sihirbaz */
  if ((el = e.target.closest("[data-wnext]"))) {
    const n = Number(el.getAttribute("data-wnext"));
    if (n === 2) {
      const cp = codeProblem(S.wizard.p.code);
      if (cp) { toast(cp); S.focusNext = "w-code"; render(); return; }
      if (!S.wizard.p.name.trim()) { toast("Önce proje adını yazın."); return; }
    }
    S.wizard.step = n; window.scrollTo(0, 0); render(); return;
  }
  if ((el = e.target.closest("[data-pick]"))) {
    const sid = el.getAttribute("data-pick"), w = S.wizard;
    if (w.sel[sid]) delete w.sel[sid];
    else {
      const st = byId(data.steps, sid);
      w.sel[sid] = { dept: st ? st.dept : "", section: st ? (st.section || "") : "", assignee: "", qty: "", spec: "", dueDate: "" };
    }
    render(); return;
  }
  if ((el = e.target.closest("[data-gall]"))) {
    const gid = el.getAttribute("data-gall"), w = S.wizard;
    const items = data.steps.filter(function (s) { return s.group === gid; });
    const allOn = items.every(function (s) { return w.sel[s.id]; });
    items.forEach(function (s) {
      if (allOn) delete w.sel[s.id];
      else if (!w.sel[s.id]) w.sel[s.id] = { dept: s.dept, section: s.section || "", assignee: "", qty: "", spec: "", dueDate: "" };
    });
    render(); return;
  }
  if (e.target.closest("[data-bulkdate]")) {
    const v = document.getElementById("bulk-date").value;
    if (!v) { toast("Önce bir tarih seçin."); return; }
    Object.keys(S.wizard.sel).forEach(function (k) { S.wizard.sel[k].dueDate = v; });
    render(); return;
  }
  if (e.target.closest("[data-wsave]")) { await createProjectNow(); return; }

  /* modaller */
  if (e.target.closest("[data-edit-proj]")) { S.modal = { kind: "proj", id: S.projectId }; renderModal(); return; }
  if (e.target.closest("[data-add-steps]")) { S.modal = { kind: "addsteps", id: S.projectId, pick: {} }; renderModal(); return; }
  if (e.target.closest("[data-adddept]")) { S.modal = { kind: "dept" }; renderModal(); return; }
  if (e.target.closest("[data-addperson]")) { S.modal = { kind: "person", id: null }; renderModal(); return; }
  if ((el = e.target.closest("[data-editperson]"))) { S.modal = { kind: "person", id: el.getAttribute("data-editperson") }; renderModal(); return; }
  if (e.target.closest("[data-addstep]")) { S.modal = { kind: "step" }; renderModal(); return; }
  if ((el = e.target.closest("[data-mpick]"))) {
    const id = el.getAttribute("data-mpick");
    if (S.modal.pick[id]) { delete S.modal.pick[id]; el.classList.remove("on"); el.querySelector(".box").textContent = ""; }
    else { S.modal.pick[id] = true; el.classList.add("on"); el.querySelector(".box").textContent = "✓"; }
    return;
  }
  const mc = e.target.closest("[data-mclose]");
  if (mc && !(mc.classList.contains("modal-bg") && e.target !== mc)) { S.modal = null; renderModal(); return; }
  if (e.target.closest("[data-msave]")) { await saveModal(); return; }
});

document.addEventListener("input", function (e) {
  if (e.target && e.target.id === "job-search") { S.jobSearch = e.target.value; render(); return; }
  QA.onInput(e);
});

document.addEventListener("change", async function (e) {
  const t = e.target;

  if (t.id === "job-dept") { S.jobDept = t.value; render(); return; }
  // Talep onayında departman değişince bölüm listesi o departmana göre yenilenir.
  if (t.hasAttribute && t.hasAttribute("data-reqdept")) {
    const sec = document.querySelector('[data-reqsection="' + t.getAttribute("data-reqdept") + '"]');
    if (sec) { sec.innerHTML = sectionOptions(t.value, ""); sec.hidden = !store.sectionsOf(t.value).length; }
    return;
  }
  // Pencerelerde departman değişince bölüm ve sorumlu listeleri o departmana göre yenilenir.
  if (S.modal && t.id === "m-dept") { refreshModalDept(); return; }
  if (S.modal && t.id === "m-section") {
    const a = document.getElementById("m-assignee");
    if (a) a.innerHTML = assigneeOptions((document.getElementById("m-dept") || {}).value || "", t.value, "");
    return;
  }
  if (S.modal && S.modal.kind === "job" && t.id === "m-type") {
    document.querySelectorAll("#modal-root [data-qtyonly]").forEach(function (x) { x.hidden = t.value !== "qty"; });
    return;
  }

  // Dosya yükleme: satırdaki "dosya ekle / dosya yükle" bağlantısı.
  if (t.hasAttribute && t.hasAttribute("data-upload")) {
    const task = byId(data.tasks, t.getAttribute("data-upload"));
    const file = t.files && t.files[0];
    if (!task || !file) return;
    const problem = checkFile(file);
    if (problem) { toast(problem, "error"); t.value = ""; return; }
    toast("“" + file.name + "” yükleniyor…");
    try {
      await uploadTaskFile(task, file);
      toast("“" + file.name + "” yüklendi.");
    } catch (err) {
      toast(storageHint(err), "error");
    }
    return;
  }

  if (await QA.onChange(e)) return;

  if (t.hasAttribute && t.hasAttribute("data-w")) {
    const k = t.getAttribute("data-w");
    S.wizard.p[k] = k === "code" ? store.normalizeCode(t.value) : t.value;
    if (k === "code") t.value = S.wizard.p.code;
    return;
  }

  const wrow = t.closest ? t.closest("[data-wrow]") : null;
  if (wrow && t.hasAttribute("data-wf")) {
    const sid = wrow.getAttribute("data-wrow"), f = t.getAttribute("data-wf");
    S.wizard.sel[sid][f] = t.value;
    if (f === "dept") { S.wizard.sel[sid].section = ""; S.wizard.sel[sid].assignee = ""; render(); }
    else if (f === "section") { S.wizard.sel[sid].assignee = ""; render(); }
    return;
  }

  const trow = t.closest ? t.closest("[data-task]") : null;
  if (trow && t.hasAttribute("data-f")) {
    const tid = trow.getAttribute("data-task"), f = t.getAttribute("data-f");
    const task = byId(data.tasks, tid); if (!task) return;
    let patch;
    if (f === "qty" || f === "doneQty") patch = qtyPatch(task, f, t.value);
    else if (f === "text") {
      // Metin tipi: metin girilince tamamlanmış sayılır, silinince yeniden açılır.
      const v = t.value.trim();
      patch = { text: v };
      if (v && task.status !== "tamam") {
        Object.assign(patch, { status: "tamam", completedAt: new Date().toISOString(), completedBy: myEmail(), completedByName: myName() });
      } else if (!v && task.status === "tamam") {
        Object.assign(patch, { status: "bekliyor", completedAt: "", completedBy: "", completedByName: "" });
      }
      await guard(store.saveTask(tid, patch, "“" + task.name + "”: " + (v ? v : "metin silindi")));
      if (v && task.status !== "tamam") toast("“" + task.name + "” tamamlandı.");
      return;
    }
    else if (f === "orderStatus") {
      // Sipariş durumu "geldi" olunca gelen adet girilmemişse gereken kadar sayılır.
      patch = { orderStatus: t.value };
      if (t.value === "geldi" && (task.doneQty === "" || task.doneQty === null || task.doneQty === undefined) && numOf(task.qty))
        patch.doneQty = String(numOf(task.qty));
      await guard(store.saveTask(tid, patch, task.name + " · sipariş durumu: " + (orderStatusLabel(t.value) || "—")));
      return;
    }
    else {
      patch = {}; patch[f] = t.value;
      if (f === "dept") { patch.section = ""; patch.assignee = ""; }
      if (f === "section") patch.assignee = "";
    }
    await guard(store.saveTask(tid, patch, task.name + " · " + (f === "supplier" ? "tedarikçi" : f) + " = " + t.value));
    return;
  }

  if (t.hasAttribute && t.hasAttribute("data-stepdept")) {
    const sid = t.getAttribute("data-stepdept"), v = t.value;
    await guard(store.saveCatalog(data.groups,
      data.steps.map(function (s) { return s.id === sid ? Object.assign({}, s, { dept: v }) : s; }),
      "adım departmanı değişti"));
    return;
  }
});

document.addEventListener("submit", async function (e) {
  const form = e.target;
  if (form.id !== "form-login" && form.id !== "form-request") return;
  e.preventDefault();

  const val = function (id) { const x = document.getElementById(id); return x ? x.value : ""; };
  const btn = form.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;

  try {
    if (form.id === "form-login") {
      await signInWithPassword(val("g-email"), val("g-pass"));
      return;
    }
    // Şifre alanı yalnızca hesabı olmayan kişiye çıkar.
    if (document.getElementById("g-pass")) {
      if (val("g-pass") !== val("g-pass2")) throw new Error("Şifreler aynı değil.");
      await registerAndRequest(val("g-name"), val("g-email"), val("g-pass"), val("g-gorev"));
      toast("Doğrulama e-postası gönderildi.");
    } else {
      await submitRequest(val("g-name"), val("g-gorev"));
      toast("Talebiniz yöneticiye iletildi.");
    }
  } catch (err) {
    toast((err && err.message) || "İşlem tamamlanamadı.", "error");
    if (btn) btn.disabled = false;
  }
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && S.modal) { S.modal = null; renderModal(); return; }
  QA.onKeydown(e);
});
