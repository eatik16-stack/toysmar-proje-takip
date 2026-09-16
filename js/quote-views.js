// Teklif ekranları: liste, düzenleyici, önizleme/belge ve teklif ayarları.
// Her fonksiyon HTML metni döndürür; olaylar quote-app.js'te.

import { esc, fmtDate, fmtDateTime, daysBetween, todayISO } from "./util.js";
import { data } from "./store.js";
import { canSee, isAdmin } from "./auth.js";
import {
  CURRENCIES, VAT_RATES, cur, parseNum, fmtNum, fmtQty, fmtInputMoney, fmtMoney, fmtMoneyShort,
  lineTotal, calcTotals, amountWords
} from "./money.js";
import {
  STATES, settings, quoteLabel, quoteState, isLocked, latestQuotes, revisionsOf, lastPrice,
  knownCustomers, units, productGroups, productUsage, longDate, fillTokens, searchProducts, trLower,
  activeProducts, isActive
} from "./quotes.js";

function kpi(n, label, desc, cls) {
  return '<div class="kpi ' + (cls || "") + '"><div class="n">' + n + '</div>' +
    '<div class="l">' + esc(label) + '</div><div class="d">' + esc(desc) + '</div></div>';
}

function chip(q) {
  const s = quoteState(q), d = STATES[s] || STATES.taslak;
  return '<span class="st ' + d.cls + '">' + esc(d.label) + '</span>';
}

function confirmBtn(S, key, label, cls) {
  const armed = S.confirm === key;
  return '<button class="btn btn-sm ' + (armed ? "btn-danger" : (cls || "btn-ghost")) + '" data-confirm="' + esc(key) + '">' +
    (armed ? "Emin misiniz?" : esc(label)) + '</button>';
}

function sumByCurrency(list) {
  const by = {};
  list.forEach(function (q) {
    const t = q.totals || calcTotals(q), c = q.currency || "TRY";
    by[c] = (by[c] || 0) + (t.grand || 0);
  });
  const keys = Object.keys(by);
  if (!keys.length) return "—";
  return keys.map(function (c) { return fmtMoneyShort(by[c], c); }).join(" · ");
}

/* ================= kurulum ================= */

function setupHtml() {
  return '<div class="panel"><div class="panel-body">' +
    '<h3 style="font-size:16px; margin-bottom:6px">Teklif modülünü başlatın</h3>' +
    '<p style="max-width:68ch; margin:0 0 14px" class="muted">Tek seferlik. Örnek teklif Excel’inizden alınarak ' +
    '<strong>26 ürünlük başlangıç kataloğu</strong>, şirket bilgileri ve teklif koşulları yüklenecek. ' +
    'Ürün adları yazım hataları düzeltilerek alındı; fiyatlar alınmadı, her teklifte elle girilir. ' +
    'Hepsi sonradan Teklif ayarlarından değiştirilebilir.</p>' +
    '<button class="btn btn-pri" data-qseed="1">Başlangıç verilerini yükle</button></div></div>';
}

function loadingHtml(title) {
  return '<div class="page-head"><div><h1>' + esc(title) + '</h1></div></div>' +
    '<div class="panel"><div class="empty"><h3>Yükleniyor…</h3></div></div>';
}

/* ================= liste ================= */

const FILTERS = [
  { id: "acik", label: "Açık" }, { id: "taslak", label: "Taslak" }, { id: "gonderildi", label: "Karar bekleyen" },
  { id: "kabul", label: "Kabul" }, { id: "kapali", label: "Red / iptal" }, { id: "tumu", label: "Tümü" }
];

function passFilter(q, f) {
  const s = q.status || "taslak";
  if (f === "acik") return s === "taslak" || s === "gonderildi";
  if (f === "kapali") return s === "red" || s === "iptal";
  if (f === "tumu") return true;
  return s === f;
}

export function viewQuotes(S) {
  if (!data.loaded.sales || !data.loaded.quotes) return loadingHtml("Teklifler");
  let h = '<div class="page-head"><div><h1>Teklifler</h1><div class="sub">';
  if (!data.sales) {
    return h + 'Satış teklifi hazırlama ve takip</div></div></div>' + setupHtml();
  }
  const all = latestQuotes();
  const open = all.filter(function (q) { return passFilter(q, "acik"); });
  const waiting = all.filter(function (q) { return q.status === "gonderildi"; });
  const expired = waiting.filter(function (q) { return quoteState(q) === "suresi"; });
  const year = todayISO().slice(0, 4);
  const won = all.filter(function (q) { return q.status === "kabul" && String(q.decidedAt || q.date || "").slice(0, 4) === year; });
  const decidedAll = all.filter(function (q) { return q.status === "kabul" || q.status === "red"; });
  const wonAll = decidedAll.filter(function (q) { return q.status === "kabul"; });
  const rate = decidedAll.length ? Math.round(wonAll.length / decidedAll.length * 100) : null;

  h += all.length + ' teklif · ' + open.length + ' açık</div></div>' +
    '<div class="row-actions"><button class="btn btn-sm" data-nav="teklif-ayar">Teklif ayarları</button>' +
    '<button class="btn btn-pri" data-qnew="1">Yeni teklif</button></div></div>';

  h += '<div class="kpis">' +
    kpi(open.length, "Açık teklif", sumByCurrency(open), "") +
    kpi(waiting.length, "Karar bekleyen", expired.length ? expired.length + " tanesinin süresi doldu" : "Müşteriden yanıt bekleniyor", expired.length ? "warn" : "") +
    kpi(won.length, "Kabul (" + year + ")", sumByCurrency(won), "") +
    kpi(rate === null ? "—" : "%" + rate, "Kazanma oranı", decidedAll.length + " karara bağlanmış tekliften", "") +
    '</div>';

  const term = trLower(S.qSearch || "").trim();
  const rows = all.filter(function (q) { return passFilter(q, S.qFilter || "acik"); })
    .filter(function (q) {
      if (!term) return true;
      const c = q.customer || {};
      return trLower([quoteLabel(q), c.company, c.contact, q.title, q.createdByName].join(" ")).indexOf(term) !== -1;
    })
    .sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || "")) || (b.seq || 0) - (a.seq || 0);
    });

  h += '<div class="panel"><div class="panel-head qlist-head"><div class="seg" role="group" aria-label="Durum süzgeci">' +
    FILTERS.map(function (f) {
      const n = all.filter(function (q) { return passFilter(q, f.id); }).length;
      return '<button class="' + ((S.qFilter || "acik") === f.id ? "on" : "") + '" data-qfilter="' + f.id + '">' +
        esc(f.label) + ' <span class="mono">' + n + '</span></button>';
    }).join("") + '</div>' +
    '<input id="q-search" class="inp-sm qsearch" type="search" placeholder="Müşteri, teklif no, konu…" ' +
    'value="' + esc(S.qSearch || "") + '" aria-label="Tekliflerde ara" autocomplete="off"></div>';

  if (!rows.length) {
    h += '<div class="empty"><h3>' + (all.length ? "Bu görünümde teklif yok" : "Henüz teklif yok") + '</h3>' +
      '<p>' + (all.length ? "Süzgeci ya da aramayı değiştirin." : "“Yeni teklif” ile ilk teklifinizi hazırlayın.") + '</p></div></div>';
    return h;
  }

  h += '<div class="tw"><table><thead><tr><th>Teklif</th><th>Müşteri / konu</th><th>Tarih</th><th>Geçerlilik</th>' +
    '<th style="text-align:right">Tutar</th><th>Durum</th><th>Hazırlayan</th></tr></thead><tbody>';
  rows.forEach(function (q) {
    const t = q.totals || calcTotals(q), c = q.customer || {}, st = quoteState(q);
    const d = daysBetween(q.validUntil);
    let valid = '<span class="mono">' + fmtDate(q.validUntil) + '</span>';
    if (q.status === "gonderildi" && d !== null)
      valid += '<span class="muted"> (' + (d < 0 ? Math.abs(d) + " gün geçti" : d + " gün") + ')</span>';
    h += '<tr class="click" data-qopen="' + esc(q.id) + '">' +
      '<td class="mono" style="white-space:nowrap">' + esc(q.no || "—") +
        (q.rev ? ' <span class="tag">R' + q.rev + '</span>' : '') + '</td>' +
      '<td><div class="t-name">' + esc(c.company || "Müşteri girilmedi") + '</div>' +
        (q.title ? '<div class="muted" style="font-size:12px">' + esc(q.title) + '</div>' : '') + '</td>' +
      '<td class="mono">' + fmtDate(q.date) + '</td>' +
      '<td>' + valid + '</td>' +
      '<td class="mono" style="text-align:right; white-space:nowrap">' + fmtMoney(t.grand, q.currency) +
        (t.missing ? '<div class="qmiss">' + t.missing + ' kalem fiyatsız</div>' : '') + '</td>' +
      '<td>' + chip(q) +
        (q.status === "kabul" && !q.projectId ? ' <span class="tag tag-warn">proje bekliyor</span>' : '') +
        (q.projectId ? ' <span class="tag">üretimde</span>' : '') + '</td>' +
      '<td class="muted">' + esc(q.createdByName || "—") + '</td></tr>';
  });
  return h + '</tbody></table></div></div>';
}

/* ================= düzenleyici ================= */

function qf(path, label, val, opts) {
  opts = opts || {};
  const id = "qf-" + path.replace(/\./g, "-");
  const attrs = ' id="' + id + '" data-qf="' + esc(path) + '"' + (opts.dis ? " disabled" : "") +
    (opts.list ? ' list="' + opts.list + '"' : '') + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') +
    (opts.mode ? ' inputmode="' + opts.mode + '"' : '');
  let control;
  if (opts.area) control = '<textarea' + attrs + ' rows="' + (opts.rows || 3) + '">' + esc(val || "") + '</textarea>';
  else control = '<input' + attrs + ' type="' + (opts.type || "text") + '" value="' + esc(val == null ? "" : val) + '"' +
    (opts.auto ? ' autocomplete="' + opts.auto + '"' : ' autocomplete="off"') + '>';
  return '<div class="f' + (opts.full ? " full" : "") + '"><label for="' + id + '">' + esc(label) +
    (opts.req ? ' *' : '') + '</label>' + control + (opts.hint ? '<div class="qhint" id="' + id + '-hint">' + opts.hint + '</div>' : '') + '</div>';
}

function validHint(q) {
  return "Son geçerlilik: <strong>" + esc(longDate(q.validUntil)) + "</strong>";
}

export function lineHint(q, l) {
  if (l.kind === "head") return "";
  const parts = [];
  if (!isLocked(q)) {
    if (l.productId && parseNum(l.price) === null) {
      const lp = lastPrice(l.productId, q.currency, q.id);
      if (lp) parts.push('Son teklif: <strong class="mono">' + esc(fmtMoney(lp.price, q.currency)) + '</strong> · ' +
        esc(lp.label) + ' <button class="linkish" data-luse="' + esc(l.id) + '">bu fiyatı kullan</button>');
    }
    if (!l.productId && String(l.name || "").trim())
      parts.push('<button class="linkish" data-lcat="' + esc(l.id) + '">kataloğa ekle</button>');
  }
  return parts.join(" · ");
}

function lineRow(q, l, n, locked) {
  const dis = locked ? " disabled" : "";
  const acts = locked ? '' : '<div class="ql-act">' +
    '<button class="ibtn" data-lmove="' + esc(l.id) + ':-1" title="Yukarı taşı" aria-label="Yukarı taşı">↑</button>' +
    '<button class="ibtn" data-lmove="' + esc(l.id) + ':1" title="Aşağı taşı" aria-label="Aşağı taşı">↓</button>' +
    '<button class="ibtn" data-ldup="' + esc(l.id) + '" title="Çoğalt" aria-label="Çoğalt">⧉</button>' +
    '<button class="ibtn ibtn-del" data-ldel="' + esc(l.id) + '" title="Sil" aria-label="Sil">✕</button></div>';

  const grip = locked ? '' : ' draggable="true" data-drag="' + esc(l.id) + '" title="Sürükleyerek taşıyın"';
  if (l.kind === "head") {
    return '<div class="ql ql-head" data-line="' + esc(l.id) + '"><div class="ql-n"' + grip + '>§</div>' +
      '<div class="ql-headin"><input id="ql-' + esc(l.id) + '-name" class="inp inp-head" data-lf="name" value="' + esc(l.name) +
      '" placeholder="Bölüm başlığı — örn. Softplay ürünleri" aria-label="Bölüm başlığı" autocomplete="off"' + dis + '></div>' + acts + '</div>';
  }
  const us = units();
  if (l.unit && us.indexOf(l.unit) === -1) us.push(l.unit);
  const price = parseNum(l.price);
  return '<div class="ql' + (price === null ? " is-noprice" : "") + '" data-line="' + esc(l.id) + '">' +
    '<div class="ql-n mono"' + grip + '>' + n + '</div>' +
    '<div class="ql-prod">' +
      '<input id="ql-' + esc(l.id) + '-name" class="inp" data-lf="name" list="q-products" value="' + esc(l.name) +
        '" title="' + esc(l.name) + '" placeholder="Ürün adı" aria-label="Ürün adı" autocomplete="off"' + dis + '>' +
      '<input id="ql-' + esc(l.id) + '-note" class="inp inp-note" data-lf="note" value="' + esc(l.note || "") +
        '" placeholder="Açıklama / ölçü / renk (isteğe bağlı)" aria-label="Açıklama" autocomplete="off"' + dis + '>' +
      '<div class="ql-hint" id="ql-' + esc(l.id) + '-hint">' + lineHint(q, l) + '</div>' +
    '</div>' +
    '<div><label class="ql-lbl" for="ql-' + esc(l.id) + '-qty">Miktar</label>' +
      '<input id="ql-' + esc(l.id) + '-qty" class="inp mono num" data-lf="qty" inputmode="decimal" value="' + esc(fmtQty(l.qty)) +
      '" aria-label="Miktar" autocomplete="off"' + dis + '></div>' +
    '<div><label class="ql-lbl" for="ql-' + esc(l.id) + '-unit">Birim</label>' +
      '<select id="ql-' + esc(l.id) + '-unit" class="inp" data-lf="unit" aria-label="Birim"' + dis + '>' +
      us.map(function (u) { return '<option' + (u === l.unit ? " selected" : "") + '>' + esc(u) + '</option>'; }).join("") +
      '</select></div>' +
    '<div><label class="ql-lbl" for="ql-' + esc(l.id) + '-price">Birim fiyat</label>' +
      '<input id="ql-' + esc(l.id) + '-price" class="inp mono num" data-lf="price" inputmode="decimal" value="' + esc(fmtInputMoney(l.price)) +
      '" placeholder="fiyat girin" aria-label="Birim fiyat" autocomplete="off"' + dis + '></div>' +
    '<div class="ql-total mono" id="ql-' + esc(l.id) + '-total">' + (price === null ? '<span class="muted">—</span>' : esc(fmtMoney(lineTotal(l), q.currency))) + '</div>' +
    acts + '</div>';
}

export function totalsHtml(q) {
  const t = calcTotals(q), c = q.currency;
  let h = '<div class="qt-row"><span>Ara toplam</span><span class="mono">' + fmtMoney(t.sub, c) + '</span></div>';
  if (t.disc > 0) {
    const lbl = q.discountType === "tutar" ? "İskonto" : "İskonto (%" + fmtNum(parseNum(q.discountValue) || 0, 0) + ")";
    h += '<div class="qt-row"><span>' + esc(lbl) + '</span><span class="mono">− ' + fmtMoney(t.disc, c) + '</span></div>';
    h += '<div class="qt-row"><span>Net</span><span class="mono">' + fmtMoney(t.net, c) + '</span></div>';
  }
  if (t.rate > 0) h += '<div class="qt-row"><span>KDV %' + t.rate + '</span><span class="mono">' + fmtMoney(t.vat, c) + '</span></div>';
  h += '<div class="qt-grand"><span>' + (t.rate > 0 ? "Genel toplam" : "Toplam (KDV hariç)") + '</span>' +
    '<span class="mono">' + fmtMoney(t.grand, c) + '</span></div>' +
    '<div class="qt-words">' + esc(amountWords(t.grand, c)) + '</div>';
  return h;
}

export function warnHtml(q) {
  if (isLocked(q)) return "";
  const t = calcTotals(q), w = [];
  if (!String((q.customer && q.customer.company) || "").trim()) w.push("Müşteri firma adı girilmedi.");
  if (!t.count) w.push("Teklifte kalem yok.");
  if (t.missing) w.push(t.missing + " kalemde birim fiyat girilmedi.");
  if (q.validUntil && daysBetween(q.validUntil) < 0) w.push("Geçerlilik tarihi geçmiş — tarihi ya da gün sayısını güncelleyin.");
  if (!w.length) return '<div class="qok">Göndermeye hazır.</div>';
  return '<ul class="qwarn">' + w.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>';
}

export function saveStateHtml(S) {
  const q = S.q;
  if (!q) return "";
  if (S.qSaveError) return '<span class="qsave is-err" title="' + esc(S.qSaveError) + '">Kaydedilemedi — tekrar deneniyor</span>';
  if (S.qSaving) return '<span class="qsave">Kaydediliyor…</span>';
  if (S.qDirty) return '<span class="qsave is-dirty">Kaydedilmemiş değişiklik</span>';
  if (!q.id) return '<span class="qsave">Numara ilk kayıtta verilir</span>';
  return '<span class="qsave is-ok">Kaydedildi · ' + esc(fmtDateTime(q.updatedAt)) + '</span>';
}

export function remoteHtml(S) {
  const r = S.qRemote;
  if (!r) return "";
  return '<div class="banner banner-warn"><span aria-hidden="true">!</span><div><strong>Bu teklif başka bir oturumda değiştirildi.</strong>' +
    esc((r.updatedByName || r.updatedBy || "Başka bir kullanıcı") + " · " + fmtDateTime(r.updatedAt)) +
    ' <div class="row-actions" style="margin-top:6px"><button class="btn btn-sm" data-qremote="load">Onların sürümünü yükle</button>' +
    '<button class="btn btn-sm btn-ghost" data-qremote="keep">Benimkini koru</button></div></div></div>';
}

export function revsHtml(S) {
  const q = S.q;
  const revs = revisionsOf(q);
  if (revs.length < 2) return "";
  return '<div class="panel"><div class="panel-head"><h2>Revizyonlar</h2><span class="muted mono">' + revs.length + '</span></div>' +
    '<div class="panel-body qrevs">' + revs.map(function (r) {
      const cur0 = r.id === q.id;
      return '<button class="qrev' + (cur0 ? " on" : "") + '" data-qopen="' + esc(r.id) + '"' + (cur0 ? " disabled" : "") + '>' +
        '<span class="mono">' + (r.rev ? "R" + r.rev : "İlk") + '</span>' +
        '<span class="muted">' + fmtDate(r.date) + '</span>' +
        '<span class="mono">' + fmtMoneyShort((r.totals || calcTotals(r)).grand, r.currency) + '</span>' + chip(r) + '</button>';
    }).join("") + '</div></div>';
}

function statusActions(S) {
  const q = S.q, st = quoteState(q), id = q.id || "yeni";
  let h = '';
  if (st === "revize") {
    h += '<button class="btn btn-wide" data-qopen="' + esc(q.supersededBy) + '">Güncel revizyona git →</button>';
    return h;
  }
  h += '<button class="btn btn-pri btn-wide" data-qpreview="1">' + (q.status === "taslak" ? "Önizle, gönder, yazdır" : "Önizle / yazdır") + '</button>';
  const row = [];
  if (q.status === "taslak") {
    if (q.id) row.push(confirmBtn(S, "qdel:" + id, "Taslağı sil"));
  } else if (q.status === "gonderildi") {
    row.push('<button class="btn btn-sm" data-qstatus="kabul">Kabul edildi</button>');
    row.push('<button class="btn btn-sm" data-qstatus="red">Reddedildi</button>');
    row.push('<button class="btn btn-sm" data-qrevise="1">Revize et</button>');
    // Gönderilmiş belgeyi yeniden düzenlemeye açmak kurallarda da yalnızca yöneticide.
    if (isAdmin()) row.push(confirmBtn(S, "qback:" + id, "Taslağa geri al"));
    row.push(confirmBtn(S, "qcancel:" + id, "İptal et"));
  } else if (q.status === "kabul") {
    if (q.projectId) row.push('<button class="btn btn-sm btn-pri" data-open-proj="' + esc(q.projectId) + '">Üretim projesine git</button>');
    else if (canSee("yeni")) row.push('<button class="btn btn-sm btn-pri" data-qproject="1">Üretim projesi aç</button>');
    else row.push('<span class="muted" style="font-size:12px">Üretim projesini planlama açacak.</span>');
    row.push(confirmBtn(S, "qundo:" + id, "Kararı geri al"));
  } else if (q.status === "red") {
    row.push('<button class="btn btn-sm" data-qrevise="1">Revize et</button>');
    row.push(confirmBtn(S, "qundo:" + id, "Kararı geri al"));
  } else if (q.status === "iptal") {
    row.push(confirmBtn(S, "qundo:" + id, "İptali geri al"));
  }
  if (row.length) h += '<div class="row-actions qacts">' + row.join("") + '</div>';
  if (q.status === "red") {
    h += '<div class="f" style="margin-top:10px"><label for="qf-lostReason">Kayıp nedeni</label>' +
      '<input id="qf-lostReason" data-qf="lostReason" list="q-lost" value="' + esc(q.lostReason || "") + '" placeholder="Fiyat, süre, rakip…" autocomplete="off">' +
      '<datalist id="q-lost"><option>Fiyat yüksek bulundu</option><option>Teslim süresi uzun</option>' +
      '<option>Rakip firma tercih edildi</option><option>Proje ertelendi / iptal oldu</option><option>Bütçe onaylanmadı</option></datalist></div>';
  }
  return h;
}

export function viewQuote(S) {
  const q = S.q;
  if (!q) return viewQuotes(S);
  if (!data.sales) return viewQuotes(S);
  if (S.qPreview) return previewHtml(S);

  const locked = isLocked(q), st = quoteState(q), dis = { dis: locked };
  const t = calcTotals(q);
  const c = q.customer || {};

  let h = '<div id="q-editor" data-key="' + esc(S.qKey) + '">';
  h += '<div class="page-head"><div>' +
    '<button class="btn btn-sm btn-ghost" data-nav="teklifler" style="margin-bottom:6px">← Teklifler</button>' +
    '<h1><span class="mono">' + esc(quoteLabel(q)) + '</span> ' + (q.id ? chip(q) : '<span class="st st-bekliyor">Taslak</span>') + '</h1>' +
    '<div class="sub">' + esc([c.company || "Müşteri girilmedi", q.title].filter(Boolean).join(" · ")) +
      (q.createdByName ? ' · hazırlayan ' + esc(q.createdByName) : '') + '</div></div>' +
    '<div class="row-actions">' +
      '<span id="q-save">' + saveStateHtml(S) + '</span>' +
      (q.id || t.count ? '<button class="btn btn-sm" data-qcopy="1" title="Kalemleri ve metinleri yeni bir teklife kopyalar">Benzer teklif oluştur</button>' : '') +
    '</div></div>';

  h += '<div id="q-remote">' + remoteHtml(S) + '</div>';

  if (st === "revize") {
    h += '<div class="banner banner-info"><span aria-hidden="true">i</span><div><strong>Bu sürüm revize edildi.</strong>' +
      'Eski sürüm olduğu gibi saklanıyor; güncel teklif sağdaki revizyon listesinde.</div></div>';
  } else if (locked) {
    h += '<div class="banner banner-info"><span aria-hidden="true">i</span><div><strong>Bu teklif “' + esc(STATES[st].label.toLowerCase()) +
      '” durumunda, içeriği kilitli.</strong>Müşteriye giden belge değişmesin diye kalemler ve fiyatlar düzenlenemez. ' +
      (q.status === "gonderildi" || q.status === "red" ? 'Değişiklik gerekiyorsa <strong>Revize et</strong>: aynı numara R' + ((q.rev || 0) + 1) + ' olarak açılır, bu sürüm saklanır.' : '') +
      '</div></div>';
  }

  h += '<div class="qgrid"><div class="qmain">';

  /* müşteri */
  h += '<div class="panel"><div class="panel-head"><h2>Müşteri</h2>' +
    (knownCustomers().length ? '<span class="muted" style="font-size:12px">Kayıtlı firma adı yazınca bilgiler dolar</span>' : '') +
    '</div><div class="panel-body"><div class="form">' +
    qf("customer.company", "Firma", c.company, { req: true, list: "q-customers", dis: locked, ph: "örn. Baktat AVM" }) +
    qf("customer.contact", "Yetkili", c.contact, { dis: locked, ph: "Ad soyad" }) +
    qf("customer.phone", "Telefon", c.phone, { dis: locked, mode: "tel" }) +
    qf("customer.email", "E-posta", c.email, { dis: locked, type: "email" }) +
    qf("customer.city", "İl / ülke", c.city, { dis: locked }) +
    qf("customer.taxOffice", "Vergi dairesi", c.taxOffice, { dis: locked }) +
    qf("customer.address", "Adres", c.address, { dis: locked, area: true, rows: 2, full: true }) +
    qf("customer.taxNo", "Vergi no / TCKN", c.taxNo, { dis: locked }) +
    '</div></div></div>';

  /* teklif bilgileri */
  h += '<div class="panel"><div class="panel-head"><h2>Teklif bilgileri</h2></div><div class="panel-body"><div class="form">' +
    qf("title", "Konu", q.title, { dis: locked, full: true, ph: "örn. AVM çocuk oyun alanı — softplay ve elektronik oyunlar" }) +
    qf("date", "Teklif tarihi", q.date, { dis: locked, type: "date" }) +
    qf("validDays", "Geçerlilik (gün)", q.validDays, { dis: locked, type: "number", hint: validHint(q) }) +
    qf("reference", "Müşteri referansı", q.reference, { dis: locked, ph: "talep no, ihale no…" }) +
    qf("sender.name", "Hazırlayan", q.sender && q.sender.name, { dis: locked }) +
    qf("sender.phone", "Hazırlayan telefonu", q.sender && q.sender.phone, { dis: locked }) +
    qf("sender.email", "Hazırlayan e-postası", q.sender && q.sender.email, { dis: locked, type: "email" }) +
    '</div></div></div>';

  /* kalemler */
  let n = 0;
  h += '<div class="panel"><div class="panel-head"><h2>Kalemler</h2><span class="muted"><span class="mono">' + t.count +
    '</span> kalem' + (t.missing ? ' · <span class="qmiss-inline">' + t.missing + ' fiyatsız</span>' : '') + '</span></div>';
  if ((q.items || []).length) {
    h += '<div class="ql-headrow"><span>#</span><span>Ürün</span><span>Miktar</span><span>Birim</span>' +
      '<span>Birim fiyat (' + esc(cur(q.currency).symbol) + ')</span><span style="text-align:right">Tutar</span><span></span></div>';
    h += '<div id="q-lines">' + q.items.map(function (l) {
      if (l.kind !== "head") n++;
      return lineRow(q, l, n, locked);
    }).join("") + '</div>';
  } else {
    h += '<div class="empty" style="padding:22px 16px"><h3>Henüz kalem yok</h3><p>Aşağıdaki kutuya ürün adının bir kısmını yazın — katalogdan seçip ekleyin.</p></div>';
  }
  if (!locked) {
    h += '<div class="qadd"><div class="qadd-in">' +
      '<input id="q-add" class="inp" type="text" placeholder="＋ Ürün ara ve ekle — örn. “kaydırak”, “çit”, “tatami” (Enter ile ekler)" ' +
      'aria-label="Ürün ara ve ekle" autocomplete="off" value="' + esc(S.qAdd || "") + '">' +
      '<div id="q-add-results" class="qadd-res">' + addResultsHtml(S) + '</div></div>' +
      '<div class="row-actions"><button class="btn btn-sm btn-ghost" data-qaddhead="1">＋ Bölüm başlığı</button>' +
      '<button class="btn btn-sm btn-ghost" data-qaddblank="1">＋ Katalog dışı kalem</button></div></div>';
  }
  h += '</div>';

  /* görsel */
  const img = S.qImg && (q.id ? S.qImg[q.id] : null) || S.qPendingImage;
  h += '<div class="panel"><div class="panel-head"><h2>Yerleşim görseli</h2>' +
    '<span class="muted" style="font-size:12px">3D çizim, yerleşim planı — belgede kalemlerin altında basılır</span></div><div class="panel-body">';
  if (q.hasImage) {
    h += '<div class="qimg">' + (img ? '<img src="' + esc(img.src) + '" alt="Teklif görseli">' : '<div class="qimg-wait">Görsel yükleniyor…</div>') +
      '<div class="qimg-side">' + qf("imageCaption", "Görsel açıklaması", q.imageCaption, { dis: locked, ph: "örn. Önerilen yerleşim — 3D görünüm" }) +
      (locked ? '' : '<div class="row-actions"><label class="btn btn-sm" for="q-img">Değiştir</label>' +
        '<button class="btn btn-sm btn-ghost" data-qimgdel="1">Kaldır</button></div>') + '</div></div>';
  } else if (!locked) {
    h += '<label class="qdrop" for="q-img"><strong>Görsel seçin</strong><span>JPG veya PNG · büyük görseller otomatik küçültülür</span></label>';
  } else {
    h += '<p class="muted" style="margin:0">Görsel eklenmemiş.</p>';
  }
  if (!locked) h += '<input id="q-img" type="file" accept="image/*" hidden>';
  h += '</div></div>';

  /* metinler */
  h += '<div class="panel"><div class="panel-head"><h2>Belge metinleri</h2>' +
    (locked ? '' : '<button class="btn btn-sm btn-ghost" data-treset="1" title="Giriş yazısı, koşullar ve gizlilik metnini ayarlardaki varsayılana döndürür">Varsayılana döndür</button>') +
    '</div><div class="panel-body">' +
    '<div class="form">' + qf("intro", "Giriş yazısı", q.intro, { dis: locked, area: true, rows: 3, full: true }) + '</div>' +
    '<div class="f" style="margin-top:12px"><label>Teklif koşulları</label><div class="qterms" id="q-terms">' +
    (q.terms || []).map(function (tx, i) {
      return '<div class="qterm"><span class="qterm-n mono">' + (i + 1) + '</span>' +
        '<textarea id="qt-' + i + '" data-tf="' + i + '" rows="1" aria-label="Koşul ' + (i + 1) + '"' + (locked ? " disabled" : "") + '>' + esc(tx) + '</textarea>' +
        (locked ? '' : '<button class="ibtn ibtn-del" data-tdel="' + i + '" title="Koşulu sil" aria-label="Koşulu sil">✕</button>') + '</div>';
    }).join("") + '</div>' +
    (locked ? '' : '<button class="btn btn-sm btn-ghost" data-tadd="1" style="margin-top:6px">＋ Koşul ekle</button>') + '</div>' +
    '<div class="form" style="margin-top:12px">' + qf("privacy", "Gizlilik notu", q.privacy, { dis: locked, area: true, rows: 2, full: true }) + '</div>' +
    '<p class="muted qtokens">Metinlerde <code>{musteri}</code>, <code>{yetkili}</code>, <code>{gecerlilik}</code>, <code>{gun}</code> ' +
    'yazarsanız belgede firmanın adı, yetkili, son geçerlilik tarihi ve gün sayısı yazılır.</p>' +
    '</div></div>';

  h += '</div>';

  /* yan panel */
  h += '<aside class="qside"><div class="panel qsum"><div class="panel-head"><h2>Tutar</h2>' +
    '<span class="muted mono" style="font-size:12px">' + esc(cur(q.currency).code) + '</span></div><div class="panel-body">' +
    '<div class="qctl"><div class="f"><label for="qf-currency">Para birimi</label><select id="qf-currency" data-qf="currency"' + (locked ? " disabled" : "") + '>' +
    Object.keys(CURRENCIES).map(function (k) { return '<option value="' + k + '"' + (q.currency === k ? " selected" : "") + '>' + esc(CURRENCIES[k].label) + '</option>'; }).join("") +
    '</select></div>' +
    '<div class="f"><label for="qf-vatRate">KDV</label><select id="qf-vatRate" data-qf="vatRate"' + (locked ? " disabled" : "") + '>' +
    VAT_RATES.map(function (v) { return '<option value="' + v.v + '"' + (Number(q.vatRate) === v.v ? " selected" : "") + '>' + esc(v.l) + '</option>'; }).join("") +
    '</select></div>' +
    '<div class="f"><label for="qf-discountValue">İskonto</label><div class="qdisc">' +
    '<input id="qf-discountValue" data-qf="discountValue" class="mono" inputmode="decimal" value="' + esc(fmtInputMoney(q.discountValue)) + '" placeholder="0" autocomplete="off"' + (locked ? " disabled" : "") + '>' +
    '<select id="qf-discountType" data-qf="discountType" aria-label="İskonto türü"' + (locked ? " disabled" : "") + '>' +
    '<option value="yuzde"' + (q.discountType !== "tutar" ? " selected" : "") + '>%</option>' +
    '<option value="tutar"' + (q.discountType === "tutar" ? " selected" : "") + '>' + esc(cur(q.currency).symbol) + '</option></select></div></div>' +
    '<div class="f"><label>Belgede fiyatlar</label><div class="seg seg-full" role="group" aria-label="Fiyat gösterimi">' +
    '<button class="' + (q.priceMode !== "toplam" ? "on" : "") + '" data-qmode="detay"' + (locked ? " disabled" : "") + '>Kalem kalem</button>' +
    '<button class="' + (q.priceMode === "toplam" ? "on" : "") + '" data-qmode="toplam"' + (locked ? " disabled" : "") + '>Yalnız toplam</button></div>' +
    '<div class="qhint">' + (q.priceMode === "toplam" ? "Müşteri birim fiyatları görmez; yalnızca toplam basılır." : "Her kalemin birim fiyatı ve tutarı basılır.") + '</div></div></div>' +
    '<div id="q-totals" class="qtotals">' + totalsHtml(q) + '</div>' +
    '<div id="q-warn">' + warnHtml(q) + '</div>' +
    statusActions(S) +
    '</div></div>';

  h += '<div id="q-revs">' + revsHtml(S) + '</div>';

  h += '<div class="panel"><div class="panel-head"><h2>İç not</h2><span class="muted" style="font-size:12px">belgeye basılmaz</span></div>' +
    '<div class="panel-body"><textarea id="qf-notes" class="qnotes" data-qf="notes" rows="3" placeholder="Görüşme notları, müşteri istekleri…">' +
    esc(q.notes || "") + '</textarea>' +
    (q.sentAt ? '<div class="qhint">Gönderildi: ' + esc(fmtDateTime(q.sentAt)) + '</div>' : '') +
    (q.decidedAt ? '<div class="qhint">Karar: ' + esc(fmtDateTime(q.decidedAt)) + '</div>' : '') +
    '</div></div>';

  h += '</aside></div>';

  h += '<datalist id="q-products">' + activeProducts().map(function (p) { return '<option value="' + esc(p.name) + '"></option>'; }).join("") + '</datalist>';
  h += '<datalist id="q-customers">' + knownCustomers().map(function (x) { return '<option value="' + esc(x.company) + '"></option>'; }).join("") + '</datalist>';
  return h + '</div>';
}

function groupOf(p) { return p.group || "Grupsuz"; }

// Ürün seçici: kutu boşken gruplar, grup seçilince o grubun ürünleri, yazınca arama.
// Klavye: aşağı/yukarı ok .qres satırlarında gezer, Enter ekler (quote-app.js).
export function addResultsHtml(S) {
  const term = String(S.qAdd || "").trim();
  const grp = S.qAddGroup || "";
  const act = activeProducts();

  if (!term && !grp) {
    const counts = {};
    act.forEach(function (p) { counts[groupOf(p)] = (counts[groupOf(p)] || 0) + 1; });
    const keys = Object.keys(counts).sort(function (a, b) { return a.localeCompare(b, "tr"); });
    if (!keys.length) return "";
    return '<div class="qgroups">' + keys.map(function (g) {
      return '<button type="button" class="qgrp" data-qaddgroup="' + esc(g) + '">' + esc(g) +
        ' <span class="mono">' + counts[g] + '</span></button>';
    }).join("") + '</div>';
  }

  const MAX = 60;
  const list = term
    ? searchProducts(term, grp ? MAX : 14, grp || "")
    : act.filter(function (p) { return groupOf(p) === grp; }).slice(0, MAX);
  const cur = S.q ? S.q.currency : "TRY";

  let h = '';
  if (grp) h += '<div class="qres-head"><span>' + esc(grp) + '</span>' +
    '<button type="button" class="linkish" data-qaddgroupclear="1">tüm gruplar</button></div>';

  let prevG = null, idx = 0;
  list.forEach(function (p) {
    if (!grp && groupOf(p) !== prevG) { h += '<div class="qres-grp">' + esc(groupOf(p)) + '</div>'; prevG = groupOf(p); }
    const lp = S.q ? lastPrice(p.id, cur, S.q.id) : null;
    const meta = [p.code, p.size, p.unit].filter(Boolean).map(esc).join(" · ");
    h += '<button type="button" class="qres' + (idx === (S.qAddActive || 0) ? " on" : "") + '" data-qaddprod="' + esc(p.id) + '">' +
      '<span class="qres-nm">' + esc(p.name) + '</span>' +
      '<span class="qres-meta">' + meta +
      (p.priceMissing ? ' <span class="tag tag-warn">fiyat girilmedi</span>'
        : (p.price > 0 ? ' · <strong>' + esc(fmtMoney(p.price, "TRY")) + '</strong>' : '')) +
      (lp ? ' · son teklif ' + esc(fmtMoney(lp.price, cur)) : '') + '</span></button>';
    idx++;
  });
  if (!list.length && !term) h += '<div class="qres-grp">Bu grupta ürün yok</div>';
  if (term) {
    h += '<button type="button" class="qres qres-free' + (!list.length ? " on" : "") + '" data-qaddfree="1">' +
      '<span class="qres-nm">“' + esc(term) + '” adıyla katalog dışı kalem ekle</span>' +
      '<span class="qres-meta">Sonra “kataloğa ekle” ile listeye kaydedebilirsiniz</span></button>';
  }
  return h;
}

/* ================= fiyat listesi içe aktarma özeti ================= */

function money(n) { return fmtMoney(n, "TRY"); }

export function importSummaryHtml(S) {
  const p = S.importPlan;
  if (!p) return "";
  const li = function (arr, fn, max) {
    const rows = arr.slice(0, max || 40).map(fn).join("");
    const more = arr.length > (max || 40) ? '<li class="muted">… ve ' + (arr.length - (max || 40)) + ' tane daha</li>' : '';
    return '<ul class="imp-list">' + rows + more + '</ul>';
  };
  let h = '<div class="imp-meta">' + esc(p.source || "Fiyat listesi") +
    (p.listDate ? ' · liste tarihi <strong>' + esc(p.listDate) + '</strong>' : '') +
    (p.rate ? ' · kur ' + esc(String(p.rate)) + ' TL' : '') +
    ' · <strong>' + p.sheetCount + '</strong> ürün' +
    (p.manualCount ? ' · elle eklenen ' + p.manualCount + ' ürün korunur' : '') + '</div>';

  h += '<div class="imp-kpis">' +
    '<div class="imp-kpi"><b>' + p.added.length + '</b>yeni</div>' +
    '<div class="imp-kpi' + (p.priceChanged.length ? " is-warn" : "") + '"><b>' + p.priceChanged.length + '</b>fiyat değişti</div>' +
    '<div class="imp-kpi"><b>' + p.textChanged.length + '</b>ad/ebat değişti</div>' +
    '<div class="imp-kpi' + (p.dropped.length ? " is-warn" : "") + '"><b>' + p.dropped.length + '</b>listeden düştü</div>' +
    (p.reactivated.length ? '<div class="imp-kpi"><b>' + p.reactivated.length + '</b>yeniden aktif</div>' : '') +
    '</div>';

  if (p.priceChanged.length) {
    h += '<h3 class="imp-h">Fiyatı değişen</h3>' + li(p.priceChanged, function (c) {
      return '<li><span class="mono">' + esc(c.id) + '</span> ' + esc(c.name) +
        ' <span class="imp-price">' + esc(money(c.oldPrice)) + ' → <strong>' + esc(money(c.newPrice)) + '</strong>' +
        (c.pct !== null ? ' <span class="' + (c.pct >= 0 ? "imp-up" : "imp-down") + '">' + (c.pct >= 0 ? "+" : "") + c.pct + '%</span>' : '') + '</span></li>';
    });
  }
  if (p.added.length) {
    h += '<h3 class="imp-h">Yeni ürün</h3>' + li(p.added, function (x) {
      return '<li><span class="mono">' + esc(x.id) + '</span> ' + esc(x.name) + (x.size ? ' <span class="muted">' + esc(x.size) + '</span>' : '') +
        ' <span class="imp-price">' + (x.priceMissing ? '<span class="tag tag-warn">fiyat girilmedi</span>' : esc(money(x.price))) + '</span></li>';
    });
  }
  if (p.textChanged.length) {
    h += '<h3 class="imp-h">Adı / ebadı / grubu değişen</h3>' + li(p.textChanged, function (x) {
      const parts = [];
      if (x.oldName !== x.newName) parts.push('ad: ' + esc(x.oldName) + ' → ' + esc(x.newName));
      if (x.oldSize !== x.newSize) parts.push('ebat: ' + esc(x.oldSize || "—") + ' → ' + esc(x.newSize || "—"));
      if (x.oldGroup !== x.newGroup) parts.push('grup: ' + esc(x.oldGroup || "—") + ' → ' + esc(x.newGroup || "—"));
      return '<li><span class="mono">' + esc(x.id) + '</span> ' + parts.join(" · ") + '</li>';
    });
  }
  if (p.dropped.length) {
    h += '<h3 class="imp-h">Listeden düşen — silinmez, pasife alınır</h3>' + li(p.dropped, function (x) {
      return '<li><span class="mono">' + esc(x.id) + '</span> ' + esc(x.name) + '</li>';
    });
  }
  if (p.warnings.length) {
    h += '<h3 class="imp-h">Sayfadaki veri uyarıları <span class="muted">(uygulama düzeltmez, sayfada düzeltilmeli)</span></h3>' +
      li(p.warnings, function (w) { return '<li>' + esc(w) + '</li>'; }, 30);
  }
  h += '<p class="muted" style="font-size:12px; margin:12px 0 0">Onaylanınca katalog tek işlemde güncellenir ve günlüğe yazılır. ' +
    'Mevcut tekliflerdeki kalem fiyatları değişmez.</p>';
  return h;
}

/* ================= önizleme ve belge ================= */

function previewHtml(S) {
  const q = S.q, draft = q.status === "taslak";
  const img = (q.id && S.qImg ? S.qImg[q.id] : null) || S.qPendingImage;
  let h = '<div class="page-head"><div>' +
    '<button class="btn btn-sm btn-ghost" data-qpreviewclose="1" style="margin-bottom:6px">← Düzenlemeye dön</button>' +
    '<h1>Önizleme <span class="mono" style="font-size:15px; color:var(--ink-soft)">' + esc(quoteLabel(q)) + '</span></h1>' +
    '<div class="sub">PDF için yazdırma penceresinde hedef olarak “PDF olarak kaydet”i seçin.</div></div>' +
    '<div class="row-actions">';
  if (draft) {
    h += '<button class="btn" data-qprint="taslak" title="Üzerinde TASLAK yazar, teklif kilitlenmez">Taslak olarak yazdır</button>' +
      '<button class="btn btn-pri" data-qsend="1" title="Teklifi gönderildi olarak işaretler ve içeriği kilitler; ardından Yazdır / PDF ile belge alınır">Gönder ve kilitle</button>';
  } else {
    h += '<button class="btn btn-pri" data-qprint="1">Yazdır / PDF</button>';
  }
  h += '</div></div>';
  if (draft) h += '<div id="q-warn" class="qwarn-wide">' + warnHtml(q) + '</div>';
  // Önizleme müşterinin göreceği belgeyi gösterir; TASLAK filigranı yalnızca taslak baskıda çıkar.
  return h + '<div class="paper-wrap"><div class="paper">' + documentHtml(q, settings(), img, { draft: false }) + '</div></div>';
}

function logoSrc() {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--logo") || "";
    const m = v.match(/url\(\s*["']?([^"')]+)["']?\s*\)/);
    return m ? m[1] : "";
  } catch (e) { return ""; }
}

function pre(text) { return esc(text || "").replace(/\n/g, "<br>"); }

export function documentHtml(q, st, img, opts) {
  opts = opts || {};
  const c = q.customer || {}, s = q.sender || {}, t = calcTotals(q), code = q.currency;
  const detail = q.priceMode !== "toplam";
  const hasCode = (q.items || []).some(function (l) { return l.kind !== "head" && l.code; });
  const cols = 3 + (hasCode ? 1 : 0) + (detail ? 2 : 0);
  const logo = logoSrc();

  let h = '<div class="qdoc">';
  if (opts.draft) h += '<div class="qdoc-wm" aria-hidden="true">TASLAK</div>';

  h += '<header class="qd-head"><div class="qd-brand">' +
    (logo ? '<img class="qd-logo" src="' + esc(logo) + '" alt="' + esc(st.company) + '">' : '<div class="qd-company">' + esc(st.company) + '</div>') +
    (st.slogan ? '<div class="qd-slogan">' + esc(st.slogan) + '</div>' : '') + '</div>' +
    '<div class="qd-title"><div class="qd-kind">Fiyat Teklifi</div><table class="qd-meta">' +
    '<tr><th>Teklif no</th><td>' + esc(quoteLabel(q)) + '</td></tr>' +
    '<tr><th>Tarih</th><td>' + esc(longDate(q.date)) + '</td></tr>' +
    '<tr><th>Geçerlilik</th><td>' + esc(longDate(q.validUntil)) + '</td></tr>' +
    (q.reference ? '<tr><th>Referans</th><td>' + esc(q.reference) + '</td></tr>' : '') +
    '</table></div></header>';

  const custLines = [
    c.contact || "",
    [c.address, c.city].filter(Boolean).join(", "),
    [c.phone, c.email].filter(Boolean).join(" · "),
    [c.taxOffice ? c.taxOffice + " V.D." : "", c.taxNo ? "No: " + c.taxNo : ""].filter(Boolean).join(" ")
  ].filter(Boolean);
  const sendLines = [s.name, [s.phone, s.email].filter(Boolean).join(" · ")].filter(Boolean);

  h += '<section class="qd-parties">' +
    '<div class="qd-box"><div class="qd-lbl">Müşteri</div><div class="qd-strong">' + esc(c.company || "—") + '</div>' +
      custLines.map(function (x) { return '<div>' + esc(x) + '</div>'; }).join("") + '</div>' +
    '<div class="qd-box"><div class="qd-lbl">Teklifi veren</div><div class="qd-strong">' + esc(st.company) + '</div>' +
      sendLines.map(function (x) { return '<div>' + esc(x) + '</div>'; }).join("") + '</div>' +
    '</section>';

  if (q.title) h += '<div class="qd-subject"><span>Konu</span>' + esc(q.title) + '</div>';
  if (q.intro || c.contact) {
    h += '<p class="qd-intro">' + (c.contact ? 'Sayın ' + esc(c.contact) + ',<br>' : '') + pre(fillTokens(q.intro, q)) + '</p>';
  }

  h += '<table class="qd-items"><thead><tr><th class="qd-no">No</th>' + (hasCode ? '<th class="qd-code">Kod</th>' : '') +
    '<th>Ürün / açıklama</th><th class="qd-qty">Miktar</th>' +
    (detail ? '<th class="qd-num">Birim fiyat</th><th class="qd-num">Tutar</th>' : '') + '</tr></thead><tbody>';
  let n = 0;
  (q.items || []).forEach(function (l) {
    if (l.kind === "head") {
      if (String(l.name || "").trim()) h += '<tr class="qd-grp"><td colspan="' + cols + '">' + esc(l.name) + '</td></tr>';
      return;
    }
    n++;
    const price = parseNum(l.price);
    h += '<tr><td class="qd-no">' + n + '</td>' + (hasCode ? '<td class="qd-code">' + esc(l.code || "") + '</td>' : '') +
      '<td><div class="qd-name">' + esc(l.name || "—") + '</div>' + (l.note ? '<div class="qd-note">' + esc(l.note) + '</div>' : '') + '</td>' +
      '<td class="qd-qty">' + esc(fmtQty(l.qty)) + ' ' + esc(l.unit || "") + '</td>' +
      (detail ? '<td class="qd-num">' + (price === null ? "—" : esc(fmtMoney(price, code))) + '</td>' +
        '<td class="qd-num">' + (price === null ? "—" : esc(fmtMoney(lineTotal(l), code))) + '</td>' : '') + '</tr>';
  });
  h += '</tbody></table>';

  h += '<div class="qd-sum"><div class="qd-words">' + esc(amountWords(t.grand, code)) +
    (t.rate === 0 ? '<div class="qd-vatnote">Fiyatlara KDV dahil değildir.</div>' : '') + '</div>' +
    '<table class="qd-totals">' +
    '<tr><th>Ara toplam</th><td>' + esc(fmtMoney(t.sub, code)) + '</td></tr>' +
    (t.disc > 0 ? '<tr><th>' + (q.discountType === "tutar" ? "İskonto" : "İskonto (%" + esc(fmtNum(parseNum(q.discountValue) || 0, 0)) + ")") +
      '</th><td>− ' + esc(fmtMoney(t.disc, code)) + '</td></tr><tr><th>Net toplam</th><td>' + esc(fmtMoney(t.net, code)) + '</td></tr>' : '') +
    (t.rate > 0 ? '<tr><th>KDV %' + t.rate + '</th><td>' + esc(fmtMoney(t.vat, code)) + '</td></tr>' : '') +
    '<tr class="qd-grand"><th>' + (t.rate > 0 ? "Genel toplam" : "Toplam (KDV hariç)") + '</th><td>' + esc(fmtMoney(t.grand, code)) + '</td></tr>' +
    '</table></div>';

  const terms = (q.terms || []).filter(function (x) { return String(x || "").trim(); });
  if (terms.length) {
    h += '<section class="qd-sec"><h3>Teklif koşulları</h3><ol>' +
      terms.map(function (x) { return '<li>' + esc(fillTokens(x, q)) + '</li>'; }).join("") + '</ol></section>';
  }
  if (String(st.bank || "").trim()) h += '<section class="qd-sec"><h3>Banka bilgileri</h3><p>' + pre(st.bank) + '</p></section>';
  if (String(q.privacy || "").trim()) h += '<section class="qd-sec qd-privacy"><h3>Gizlilik</h3><p>' + pre(fillTokens(q.privacy, q)) + '</p></section>';

  h += '<section class="qd-sign"><div class="qd-signbox"><div class="qd-lbl">' + esc(st.company) + '</div>' +
    '<div class="qd-stamp">' + (st.stamp ? '<img src="' + esc(st.stamp) + '" alt="Kaşe ve imza">' : '') + '</div>' +
    '<div class="qd-line">Kaşe / imza</div></div>' +
    '<div class="qd-signbox"><div class="qd-lbl">Müşteri onayı</div><div class="qd-stamp"></div>' +
    '<div class="qd-line">Kaşe / imza / tarih</div></div></section>';

  const foot = [
    st.company, st.address, st.phone ? "Tel: " + st.phone : "", st.email, st.web,
    st.taxOffice || st.taxNo ? [st.taxOffice ? st.taxOffice + " V.D." : "", st.taxNo].filter(Boolean).join(" ") : "",
    st.tradeNo ? "Ticaret sicil no: " + st.tradeNo : "", st.mersis ? "Mersis no: " + st.mersis : ""
  ].filter(Boolean);
  h += '<footer class="qd-foot">' + foot.map(esc).join(" · ") + '</footer>';

  // Büyük yerleşim görseli fiyat ve imza sayfasını bölmesin diye ek sayfada basılır.
  if (q.hasImage && img && img.src) {
    h += '<figure class="qd-fig"><div class="qd-annex">Ek · ' + esc(quoteLabel(q)) + '</div>' +
      '<img src="' + esc(img.src) + '" alt="' + esc(q.imageCaption || "Teklif görseli") + '">' +
      (q.imageCaption ? '<figcaption>' + esc(q.imageCaption) + '</figcaption>' : '') + '</figure>';
  }
  return h + '</div>';
}

/* ================= teklif ayarları ================= */

function sf(key, label, val, opts) {
  opts = opts || {};
  const id = "sf-" + key;
  const a = ' id="' + id + '" data-sf="' + key + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '');
  return '<div class="f' + (opts.full ? " full" : "") + '"><label for="' + id + '">' + esc(label) + '</label>' +
    (opts.area ? '<textarea' + a + ' rows="' + (opts.rows || 3) + '">' + esc(val || "") + '</textarea>'
      : '<input' + a + ' type="' + (opts.type || "text") + '" value="' + esc(val == null ? "" : val) + '" autocomplete="off">') + '</div>';
}

export function viewSalesSettings(S) {
  if (!data.loaded.sales || !data.loaded.products) return loadingHtml("Teklif ayarları");
  let h = '<div class="page-head"><div>' +
    '<button class="btn btn-sm btn-ghost" data-nav="teklifler" style="margin-bottom:6px">← Teklifler</button>' +
    '<h1>Teklif ayarları</h1><div class="sub">Belgede basılan şirket bilgileri, varsayılan koşullar ve ürün kataloğu</div></div>';
  if (!data.sales) return h + '</div>' + setupHtml();
  const d = S.salesDraft;
  h += '<div class="row-actions">' + (S.salesDirty ? '<span class="qsave is-dirty">Kaydedilmemiş değişiklik</span>' +
    '<button class="btn btn-sm btn-ghost" data-sreset="1">Vazgeç</button>' : '') +
    '<button class="btn btn-pri" data-ssave="1"' + (S.salesDirty ? "" : " disabled") + '>Ayarları kaydet</button></div></div>';

  h += '<div class="grid2"><div style="display:flex; flex-direction:column; gap:16px">';

  h += '<div class="panel"><div class="panel-head"><h2>Şirket bilgileri</h2><span class="muted" style="font-size:12px">belgenin başında ve altında</span></div>' +
    '<div class="panel-body"><div class="form">' +
    sf("company", "Şirket adı", d.company) + sf("slogan", "Slogan", d.slogan) +
    sf("address", "Adres", d.address, { full: true }) +
    sf("phone", "Telefon", d.phone) + sf("email", "E-posta", d.email) +
    sf("web", "Web", d.web) + sf("taxOffice", "Vergi dairesi", d.taxOffice) +
    sf("taxNo", "Vergi no", d.taxNo) + sf("tradeNo", "Ticaret sicil no", d.tradeNo) +
    sf("mersis", "Mersis no", d.mersis) +
    sf("bank", "Banka bilgileri (isteğe bağlı)", d.bank, { area: true, rows: 3, full: true, ph: "Banka, şube, IBAN — boş bırakılırsa basılmaz" }) +
    '</div></div></div>';

  h += '<div class="panel"><div class="panel-head"><h2>Kaşe / imza</h2></div><div class="panel-body">' +
    '<p class="muted" style="margin:0 0 10px; font-size:12.5px">Belgenin altındaki imza alanına basılır. Görsel yalnızca yetkili ' +
    'girişle erişilen veritabanında durur, herkese açık dosyalarda yer almaz.</p>' +
    (d.stamp ? '<div class="qstamp"><img src="' + esc(d.stamp) + '" alt="Kaşe ve imza"><div class="row-actions">' +
      '<label class="btn btn-sm" for="s-stamp">Değiştir</label><button class="btn btn-sm btn-ghost" data-sstampdel="1">Kaldır</button></div></div>'
      : '<label class="qdrop" for="s-stamp"><strong>Kaşe / imza görseli seçin</strong><span>Beyaz zeminli taranmış görsel en iyi sonucu verir</span></label>') +
    '<input id="s-stamp" type="file" accept="image/*" hidden></div></div>';

  h += '</div><div style="display:flex; flex-direction:column; gap:16px">';

  /* fiyat listesi kaynağı — yalnızca yönetici */
  if (isAdmin()) {
    const src = S.source, meta = data.catalogMeta;
    const sheetCount = data.products.filter(function (p) { return p.source === "sheet" && isActive(p); }).length;
    h += '<div class="panel"><div class="panel-head"><h2>Fiyat listesi kaynağı</h2>' +
      '<span class="muted" style="font-size:12px">Google Sheet · Apps Script köprüsü</span></div><div class="panel-body">';
    if (!src) {
      h += '<p class="muted" style="margin:0">Kaynak bilgisi yükleniyor…</p>';
    } else {
      h += '<div class="form">' +
        '<div class="f full"><label for="src-url">Köprü adresi</label>' +
        '<input id="src-url" data-src="url" type="url" value="' + esc(src.url || "") + '" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></div>' +
        '<div class="f full"><label for="src-key">Anahtar</label>' +
        '<input id="src-key" data-src="key" type="password" value="' + esc(src.key || "") + '" placeholder="Apps Script’teki ANAHTAR değeri" autocomplete="off"></div>' +
        '</div>' +
        '<div class="row-actions" style="margin-top:10px">' +
        '<button class="btn btn-sm" data-srcsave="1"' + (S.sourceDirty ? "" : " disabled") + '>Kaynağı kaydet</button>' +
        '<button class="btn btn-sm btn-pri" data-srcimport="1"' + (S.importing ? " disabled" : "") + '>' +
        (S.importing ? "Liste çekiliyor…" : "Fiyat listesini güncelle") + '</button></div>' +
        '<div class="qhint" style="margin-top:10px">' +
        (meta
          ? 'Son güncelleme: <strong>' + esc(fmtDateTime(meta.at)) + '</strong>' + (meta.byName ? ' · ' + esc(meta.byName) : '') +
            (meta.listDate ? ' · liste tarihi ' + esc(meta.listDate) : '') + ' · ' + meta.count + ' ürün' +
            (meta.priceChanged ? ' · ' + meta.priceChanged + ' fiyat değişti' : '') +
            (meta.warnings ? ' · <span class="qmiss-inline">' + meta.warnings + ' veri uyarısı</span>' : '')
          : 'Henüz listeden içe aktarılmadı.') +
        (sheetCount ? '<br>Katalogda listeden gelen <strong>' + sheetCount + '</strong> aktif ürün var.' : '') +
        '</div>' +
        '<p class="muted" style="margin:10px 0 0; font-size:12px">Köprü yalnızca kod, ad, ebat, perakende fiyat ve grubu verir; ' +
        'toptan fiyat ve maliyet sayfada kalır. Adres ve anahtar yalnızca yöneticinin okuyabildiği bir kayıtta durur.</p>';
    }
    h += '</div></div>';
  }

  h += '<div class="panel"><div class="panel-head"><h2>Yeni teklif varsayılanları</h2></div><div class="panel-body"><div class="form">' +
    sf("validDays", "Geçerlilik (gün)", d.validDays, { type: "number" }) +
    '<div class="f"><label for="sf-currency">Para birimi</label><select id="sf-currency" data-sf="currency">' +
    Object.keys(CURRENCIES).map(function (k) { return '<option value="' + k + '"' + (d.currency === k ? " selected" : "") + '>' + esc(CURRENCIES[k].label) + '</option>'; }).join("") + '</select></div>' +
    '<div class="f"><label for="sf-vatRate">KDV</label><select id="sf-vatRate" data-sf="vatRate">' +
    VAT_RATES.map(function (v) { return '<option value="' + v.v + '"' + (Number(d.vatRate) === v.v ? " selected" : "") + '>' + esc(v.l) + '</option>'; }).join("") + '</select></div>' +
    '<div class="f"><label for="sf-priceMode">Belgede fiyatlar</label><select id="sf-priceMode" data-sf="priceMode">' +
    '<option value="detay"' + (d.priceMode !== "toplam" ? " selected" : "") + '>Kalem kalem</option>' +
    '<option value="toplam"' + (d.priceMode === "toplam" ? " selected" : "") + '>Yalnız toplam</option></select></div>' +
    sf("intro", "Giriş yazısı", d.intro, { area: true, rows: 3, full: true }) +
    '</div>' +
    '<div class="f" style="margin-top:12px"><label>Teklif koşulları</label><div class="qterms">' +
    (d.terms || []).map(function (tx, i) {
      return '<div class="qterm"><span class="qterm-n mono">' + (i + 1) + '</span>' +
        '<textarea id="st-' + i + '" data-stf="' + i + '" rows="1" aria-label="Koşul ' + (i + 1) + '">' + esc(tx) + '</textarea>' +
        '<button class="ibtn ibtn-del" data-stdel="' + i + '" title="Koşulu sil" aria-label="Koşulu sil">✕</button></div>';
    }).join("") + '</div><button class="btn btn-sm btn-ghost" data-stadd="1" style="margin-top:6px">＋ Koşul ekle</button></div>' +
    '<div class="form" style="margin-top:12px">' + sf("privacy", "Gizlilik notu", d.privacy, { area: true, rows: 2, full: true }) + '</div>' +
    '<p class="muted qtokens">Yer tutucular: <code>{musteri}</code> <code>{yetkili}</code> <code>{gecerlilik}</code> <code>{gun}</code>. ' +
    'Değişiklikler yalnızca bundan sonra açılan tekliflere uygulanır; mevcut teklifler etkilenmez.</p>' +
    '</div></div>';

  h += '</div></div>';

  /* katalog */
  const term = trLower(S.pSearch || "").trim();
  const groups = productGroups();
  const inactiveCount = data.products.filter(function (p) { return !isActive(p); }).length;
  const list = data.products.filter(function (p) {
    if (!isActive(p) && !S.pShowInactive) return false;
    return !term || trLower([p.name, p.code, p.codeRaw, p.size, p.group].filter(Boolean).join(" ")).indexOf(term) !== -1;
  });
  h += '<div class="panel"><div class="panel-head"><h2>Ürün kataloğu</h2><span class="muted mono">' + activeProducts().length + '</span></div>' +
    '<div class="panel-body pcat-add"><div class="pcat-grid">' +
    '<input id="pn-name" class="inp" placeholder="Yeni ürün adı (listede olmayan)" aria-label="Yeni ürün adı" autocomplete="off">' +
    '<select id="pn-unit" class="inp" aria-label="Birim">' + units().map(function (u) { return '<option>' + esc(u) + '</option>'; }).join("") + '</select>' +
    '<input id="pn-group" class="inp" list="p-groups" placeholder="Grup" aria-label="Grup" autocomplete="off">' +
    '<input id="pn-code" class="inp mono" placeholder="Kod" aria-label="Ürün kodu" autocomplete="off">' +
    '<button class="btn btn-sm btn-pri" data-padd="1">Ekle</button></div>' +
    '<div class="row-actions" style="margin-top:10px; align-items:center">' +
    '<input id="p-search" class="inp-sm" type="search" placeholder="Kod, ad, ebat…" value="' + esc(S.pSearch || "") + '" aria-label="Katalogda ara" autocomplete="off" style="width:220px">' +
    (inactiveCount ? '<button class="btn btn-sm btn-ghost" data-pinactive="1">' + (S.pShowInactive ? "Pasifleri gizle" : "Pasifleri göster (" + inactiveCount + ")") + '</button>' : '') +
    '</div></div>';
  if (!list.length) h += '<div class="empty"><h3>' + (data.products.length ? "Aramayla eşleşen ürün yok" : "Katalog boş") + '</h3></div>';
  groups.concat([""]).forEach(function (g) {
    const items = list.filter(function (p) { return (p.group || "") === g; });
    if (!items.length) return;
    h += '<div class="gband"><span>' + esc(g || "Grupsuz") + '</span><span class="n">' + items.length + '</span></div><div class="panel-body" style="padding:4px 14px">';
    items.forEach(function (p) {
      const used = productUsage(p.id);
      if (p.source === "sheet") {
        // Listeden gelen ürün elle düzenlenmez; bir sonraki içe aktarma üzerine yazar.
        h += '<div class="pcat-row pcat-sheet' + (isActive(p) ? "" : " is-off") + '">' +
          '<div><div class="pcat-name">' + esc(p.name) +
            (isActive(p) ? '' : ' <span class="tag tag-arch">listeden düştü</span>') +
            (p.priceMissing ? ' <span class="tag tag-warn">fiyat girilmedi</span>' : '') + '</div>' +
          '<div class="muted" style="font-size:11.5px">' + esc([p.codeRaw || p.code, p.size].filter(Boolean).join(" · ")) + '</div></div>' +
          '<select id="pf-' + esc(p.id) + '-unit" class="inp" data-pf="' + esc(p.id) + ':unit" aria-label="Birim">' +
            units().map(function (u) { return '<option' + (u === p.unit ? " selected" : "") + '>' + esc(u) + '</option>'; }).join("") + '</select>' +
          '<span class="mono pcat-price">' + (p.priceMissing ? '—' : esc(fmtMoney(p.price, "TRY"))) + '</span>' +
          '<span class="muted pcat-used" title="Bu ürünün geçtiği teklif sayısı">' + (used ? used + " teklif" : "") + '</span>' +
          '<span class="tag" title="Fiyat listesinden">liste</span></div>';
        return;
      }
      h += '<div class="pcat-row">' +
        '<input id="pf-' + esc(p.id) + '-name" class="inp" data-pf="' + esc(p.id) + ':name" value="' + esc(p.name) + '" aria-label="Ürün adı" autocomplete="off">' +
        '<select id="pf-' + esc(p.id) + '-unit" class="inp" data-pf="' + esc(p.id) + ':unit" aria-label="Birim">' +
          units().map(function (u) { return '<option' + (u === p.unit ? " selected" : "") + '>' + esc(u) + '</option>'; }).join("") + '</select>' +
        '<input id="pf-' + esc(p.id) + '-group" class="inp" data-pf="' + esc(p.id) + ':group" list="p-groups" value="' + esc(p.group || "") + '" aria-label="Grup" autocomplete="off">' +
        '<input id="pf-' + esc(p.id) + '-code" class="inp mono" data-pf="' + esc(p.id) + ':code" value="' + esc(p.code || "") + '" placeholder="kod" aria-label="Kod" autocomplete="off">' +
        '<span class="muted pcat-used" title="Bu ürünün geçtiği teklif sayısı">' + (used ? used + " teklif" : "") + '</span>' +
        confirmBtn(S, "qproddel:" + p.id, "✕") + '</div>';
    });
    h += '</div>';
  });
  h += '<datalist id="p-groups">' + groups.map(function (g) { return '<option value="' + esc(g) + '"></option>'; }).join("") + '</datalist>';
  h += '<div class="panel-body"><p class="muted" style="margin:0; font-size:12px">Katalogdan ürün silmek ya da fiyatını değiştirmek ' +
    'mevcut teklifleri değiştirmez; teklifteki kalem kendi adını ve fiyatını saklar. ' +
    'Listeden gelen ürünler burada düzenlenmez, sayfada düzeltilip yeniden içe aktarılır.</p></div>';
  return h + '</div>';
}
