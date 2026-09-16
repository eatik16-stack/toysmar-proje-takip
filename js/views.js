// Ekran çizimleri. Her fonksiyon HTML metni döndürür; olaylar app.js'te.

import {
  esc, byId, fmtDate, fmtDateTime, todayISO, daysBetween,
  needOf, doneOf, shortOf, taskState, stateLabel, dotClass
} from "./util.js";
import {
  data, projTasks, progress, activeProjects, deptName, personName, mePerson,
  canEditTask, pendingRequests, jobs, isJob, activeProjectTasks,
  sectionsOf, sectionName, peopleFor, accountingOf
} from "./store.js";
import { session, isAdmin, canPlan, canSee, canAccount, myRole, myName, myEmail } from "./auth.js";
import { ROLE_ORDER, roleDef, roleLabel } from "./roles.js";
import { stepTypeLabel, CATALOG_VERSION, canonicalStepId } from "./seed.js";
import { filesOf, projectFiles, fmtSize } from "./files.js";

// İş emrinin dosyaları + yükleme bağlantısı. "file" tipinde dosya zorunlu,
// diğer tiplerde isteğe bağlıdır; ekranda aynı parça kullanılır.
function attachHtml(t, canEdit) {
  const list = filesOf(t.id);
  let h = '<div class="att">';
  list.slice(0, 3).forEach(function (f) {
    h += '<a href="' + esc(f.url) + '" target="_blank" rel="noopener" title="' + esc(f.uploadedByName || "") + '">📎 ' + esc(f.name) + '</a>';
  });
  if (list.length > 3) h += '<span class="cnt">+' + (list.length - 3) + ' dosya daha</span>';
  if (t.type === "file" && !list.length) h += '<span class="cnt">' + (canEdit ? "dosya bekleniyor" : "dosya yok") + '</span>';
  if (canEdit) {
    h += '<label class="up">' + (t.type === "file" ? "dosya yükle" : "dosya ekle") +
      '<input type="file" data-upload="' + esc(t.id) + '" accept=".jpg,.jpeg,.png,.pdf,.dwg,.dxf,.skp"></label>';
  }
  return h + '</div>';
}

// Departman + bölüm etiketi: "Üretim Planlama · Metal".
export function deptLabel(deptId, sectionId) {
  const sn = sectionName(deptId, sectionId);
  return deptName(deptId) + (sn ? " · " + sn : "");
}

// Departman seçicisinin altında, departmanın bölümü varsa bölüm seçicisi.
function sectionSelect(attr, deptId, val, disabled) {
  const list = sectionsOf(deptId);
  if (!list.length) return "";
  let h = '<select class="inp-sm sec-sel" ' + attr + '="section"' + (disabled ? " disabled" : "") +
    ' aria-label="Bölüm"><option value="">Bölüm seçin</option>';
  list.forEach(function (s) {
    h += '<option value="' + esc(s.id) + '"' + (s.id === val ? " selected" : "") + '>' + esc(s.name) + '</option>';
  });
  return h + '</select>';
}

/* ================= ortak parçalar ================= */

export function kpi(n, label, desc, cls) {
  return '<div class="kpi ' + (cls || "") + '"><div class="n">' + n + '</div>' +
    '<div class="l">' + esc(label) + '</div><div class="d">' + esc(desc) + '</div></div>';
}

export function progBar(pct) {
  return '<div class="prog"><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
    '<span class="pct">%' + pct + '</span></div>';
}

export function selectEl(field, val, opts, disabled, placeholder) {
  let h = '<select class="inp-sm" data-f="' + field + '"' + (disabled ? " disabled" : "") +
    ' aria-label="' + esc(field) + '"><option value="">' + esc(placeholder || "—") + '</option>';
  opts.forEach(function (o) {
    h += '<option value="' + esc(o.v) + '"' + (o.v === val ? " selected" : "") + '>' + esc(o.l) + '</option>';
  });
  return h + '</select>';
}

function selectW(field, val, opts, placeholder) {
  let h = '<select class="inp-sm" data-wf="' + field + '"><option value="">' + esc(placeholder || "—") + '</option>';
  opts.forEach(function (o) {
    h += '<option value="' + esc(o.v) + '"' + (o.v === val ? " selected" : "") + '>' + esc(o.l) + '</option>';
  });
  return h + '</select>';
}

export function meta(label, val) {
  if (val === undefined || val === null || val === "" || val === "—") val = "—";
  return '<div style="min-width:110px; max-width:340px"><div class="eyebrow">' + esc(label) + '</div>' +
    '<div style="font-size:13.5px; margin-top:2px">' + esc(val) + '</div></div>';
}

export function delBtn(S, id, label, kind) {
  const armed = S.confirm === kind + ":" + id;
  return '<button class="btn btn-sm ' + (armed ? "btn-danger" : "btn-ghost") + '" data-confirm="' +
    esc(kind + ":" + id) + '">' + (armed ? "Emin misiniz?" : esc(label)) + '</button>';
}

export function qtyCell(t, plan, mine, need, made) {
  const pct = need > 0 ? Math.min(100, Math.round(made / need * 100)) : (made > 0 ? 100 : 0);
  const ok = need > 0 && made >= need;
  let h = '<div class="qcell"><div class="qrow">' +
    '<input class="inp-sm mono qin" type="text" inputmode="decimal" value="' + esc(t.qty == null ? "" : t.qty) + '" ' +
      'data-f="qty" aria-label="Gereken adet" title="Gereken" placeholder="—"' + (plan ? "" : " disabled") + '>' +
    '<span class="qsep" aria-hidden="true">/</span>' +
    '<input class="inp-sm mono qin' + (ok ? " qin-ok" : (made > 0 ? " qin-short" : "")) + '" type="text" inputmode="decimal" ' +
      'value="' + esc(t.doneQty == null ? "" : t.doneQty) + '" data-f="doneQty" aria-label="Yapılan adet" ' +
      'title="Yapılan" placeholder="0"' + ((plan || mine) ? "" : " disabled") + '></div>';
  if (need > 0) {
    h += '<div class="qinfo"><div class="qbar"><div class="qfill' + (ok ? " is-ok" : "") + '" style="width:' + pct + '%"></div></div>';
    if (!ok && (plan || mine) && t.status !== "tamam")
      h += '<button class="qall" data-qall="' + esc(t.id) + '" title="Yapılanı gerekene eşitle">tümü</button>';
    else h += '<span class="qunit">' + esc(t.unit || "adet") + '</span>';
    h += '</div>';
  }
  return h + '</div>';
}

export function taskRow(t) {
  const plan = canPlan();
  const mine = canEditTask(t);
  const st = taskState(t), done = t.status === "tamam";
  const need = needOf(t), made = doneOf(t), short = shortOf(t);

  let h = '<div class="trow' + (done ? " done" : "") + '" data-task="' + esc(t.id) + '">';
  h += '<div class="c-name"><div class="tn">' + esc(t.name) +
    (isJob(t) && plan ? ' <button class="linkish tedit" data-editjob="' + esc(t.id) + '">düzenle</button>' : '') + '</div>';
  const sub = [];
  if (t.urgent && !done) sub.push('<span class="tag tag-urgent">Acil</span>');
  if (t.section && isJob(t)) sub.push('<span class="tag">' + esc(sectionName(t.dept, t.section)) + '</span>');
  if (t.spec) sub.push(esc(t.spec));
  if (t.orderStatus) sub.push('<span class="tag">' + esc(t.orderStatus) + '</span>');
  if (t.shortClosed) sub.push('<span class="tag tag-warn">eksik kapatıldı ' + made + '/' + need + '</span>');
  else if (!done && short > 0 && made > 0)
    sub.push('<span class="tag tag-warn">' + made + '/' + need + ' — ' + short + ' ' + esc(t.unit || "adet") + ' eksik</span>');
  if (done && t.completedAt)
    sub.push("✓ " + fmtDate(String(t.completedAt).slice(0, 10)) + (t.completedByName ? " · " + esc(t.completedByName) : ""));
  if (sub.length) h += '<div class="tspec">' + sub.join(" · ") + '</div>';
  // Dosya tipinde olmayan adımlara da isteğe bağlı dosya eklenebilir.
  if (t.type !== "file" && (plan || mine || filesOf(t.id).length)) h += attachHtml(t, plan || mine);
  h += '</div>';

  if (t.type === "qty") h += '<div>' + qtyCell(t, plan, mine, need, made) + '</div>';
  else if (t.type === "file") h += '<div>' + attachHtml(t, plan || mine) + '</div>';
  else if (t.type === "text") {
    h += '<div class="tcell"><input class="inp-sm" type="text" data-f="text" value="' + esc(t.text || "") +
      '" placeholder="metin girin" aria-label="Metin"' + ((plan || mine) ? "" : " disabled") + '></div>';
  } else h += '<div><span class="muted">—</span></div>';

  h += '<div class="dcell">' + selectEl("dept", t.dept, data.depts.map(function (d) { return { v: d.id, l: d.name }; }), !plan) +
    sectionSelect("data-f", t.dept, t.section, !plan) + '</div>';
  h += '<div>' + selectEl("assignee", t.assignee,
    peopleFor(t.dept, t.section).map(function (x) { return { v: x.id, l: x.name }; }), !plan, "Atanmadı") + '</div>';
  h += '<div><input class="inp-sm inp-date" type="date" value="' + esc(t.dueDate || "") +
    '" data-f="dueDate" aria-label="Termin"' + (plan ? "" : " disabled") + '></div>';

  const canToggle = plan || mine;
  const needsFile = t.type === "file" && !filesOf(t.id).length;
  const needsText = t.type === "text" && !String(t.text || "").trim();
  h += '<div class="c-act">';
  if (!canToggle) h += '<span class="st st-' + st + '">' + esc(stateLabel(st)) + '</span>';
  else if (done) h += '<button class="btn btn-sm" data-toggle="' + esc(t.id) + '">Geri al</button>';
  else if (needsFile || needsText) {
    h += '<button class="btn btn-sm btn-block" data-toggle="' + esc(t.id) + '" title="' +
      (needsFile ? "Önce dosya yükleyin" : "Önce metni girin") + '">Tamamla</button>';
  }
  else if (short > 0) {
    h += '<button class="btn btn-sm btn-block" data-toggle="' + esc(t.id) + '" title="' +
      esc(need + " " + (t.unit || "adet") + " gerekiyor, " + made + " girildi") + '">Tamamla</button>';
    if (plan) h += '<button class="btn btn-sm btn-ghost btn-xs" data-shortclose="' + esc(t.id) + '">Eksik kapat</button>';
  } else h += '<button class="btn btn-sm btn-pri" data-toggle="' + esc(t.id) + '">Tamamla</button>';
  h += '</div></div>';
  return h;
}

/* ================= kabuk ================= */

export function navItems(S) {
  let mineOpen = 0;
  const p = mePerson();
  if (p) mineOpen = data.tasks.filter(function (t) { return t.assignee === p.id && t.status !== "tamam"; }).length;
  const openQuotes = data.quotes.filter(function (q) {
    return !q.supersededBy && (q.status === "taslak" || q.status === "gonderildi");
  }).length;
  // Kişinin yürütebildiği açık proje dışı işler: planlayana hepsi, şefe departmanı, personele kendisi.
  const openJobs = jobs().filter(function (t) { return t.status !== "tamam" && canEditTask(t); }).length;
  const items = [
    { id: "panel", ico: "◧", label: "Panel" },
    { id: "projeler", ico: "▦", label: "Projeler", count: activeProjects().length },
    { id: "projedisi", ico: "◇", label: "Proje Dışı İşler", count: openJobs || null },
    { id: "isler", ico: "✓", label: "İşlerim", count: mineOpen || null },
    { id: "yeni", ico: "＋", label: "Yeni Proje" },
    { id: "teklifler", ico: "₺", label: "Teklifler", count: openQuotes || null },
    { id: "talepler", ico: "◎", label: "Talepler", count: pendingRequests().length || null },
    { id: "kayitlar", ico: "≡", label: "Kayıtlar" },
    { id: "ayarlar", ico: "⚙", label: "Ayarlar" }
  ];
  return items.filter(function (i) { return canSee(i.id); });
}

// Menüde görünmeyen alt ekranlar, bağlı oldukları menü öğesini işaretler.
const NAV_PARENT = { proje: "projeler", teklif: "teklifler", "teklif-ayar": "teklifler" };

export function navHtml(S) {
  const active = NAV_PARENT[S.view] || S.view;
  return navItems(S).map(function (i) {
    return '<button data-nav="' + i.id + '" aria-current="' + (active === i.id) + '">' +
      '<span class="ico" aria-hidden="true">' + i.ico + '</span><span>' + esc(i.label) + '</span>' +
      (i.count ? '<span class="count">' + i.count + '</span>' : '') + '</button>';
  }).join("");
}

export function meCardHtml() {
  const nm = myName(), photo = session.user && session.user.photo;
  const initials = nm.trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0] || ""; }).join("").toUpperCase();
  const role = roleLabel(myRole());
  const p = mePerson();
  return '<div class="mecard">' +
    (photo ? '<img class="avatar" src="' + esc(photo) + '" alt="">' : '<div class="avatar">' + esc(initials) + '</div>') +
    '<div class="who"><div class="nm">' + esc(nm) + '</div>' +
    '<div class="rl">' + esc(role + (p && p.dept ? " · " + deptLabel(p.dept, p.section) : "")) + '</div></div>' +
    '<button class="btn btn-sm btn-ghost" data-signout="1" title="Oturumu kapat">Çık</button></div>';
}

/* ================= kurulum ================= */

export function viewSetup() {
  if (!isAdmin()) {
    return '<div class="page-head"><div><h1>Kurulum bekleniyor</h1>' +
      '<div class="sub">Adım kataloğu henüz yüklenmemiş.</div></div></div>' +
      '<div class="panel"><div class="empty"><h3>Yönetici kurulumu tamamlamalı</h3>' +
      '<p>Katalog yüklendiğinde işleriniz burada görünecek.</p></div></div>';
  }
  return '<div class="page-head"><div><h1>Kurulum</h1>' +
    '<div class="sub">Tek seferlik: katalog ve departmanlar yüklenecek</div></div></div>' +
    '<div class="panel"><div class="panel-body">' +
    '<p style="max-width:64ch; margin:0 0 14px">Toysmar’ın süreç adımlarından türetilmiş <strong>65 adımlık katalog</strong>, ' +
    '9 departman (Üretim Planlama altında Metal, Kaplama, MDF, Dikiş bölümleri) yüklenecek. ' +
    'Kendinizi de personel listesine ekleyeceğim. Sonrasında hepsini Ayarlar’dan değiştirebilirsiniz.</p>' +
    '<button class="btn btn-pri" data-doseed="1">Kataloğu yükle ve başla</button>' +
    '</div></div>';
}

/* ================= panel ================= */

// Eski (sürüm 1) katalogla çalışan kurulumda yöneticiye geçiş hatırlatması.
export function migrationBanner() {
  if (!isAdmin() || !data.steps.length || data.catalogVersion >= CATALOG_VERSION) return "";
  return '<div class="banner banner-warn"><span aria-hidden="true">!</span><div>' +
    '<strong>Adım kataloğu eski sürümde.</strong>Departmanlar, bölümler ve 65 adımlık yeni katalog için ' +
    '<button class="linkish" data-nav="ayarlar">Ayarlar</button> ekranından “Yeni kataloğa geç” deyin. ' +
    'Mevcut projeler ve iş emirleri korunur.</div></div>';
}

// Açık / geciken / 7 gün içinde / acil sayımları — panelin iki yarısı ve sekme aynı hesabı kullanır.
export function workStats(list) {
  const open = list.filter(function (t) { return t.status !== "tamam"; });
  const late = open.filter(function (t) { const d = daysBetween(t.dueDate); return d !== null && d < 0; });
  const soon = open.filter(function (t) { const d = daysBetween(t.dueDate); return d !== null && d >= 0 && d <= 7; });
  const urgent = open.filter(function (t) { return !!t.urgent; });
  return { all: list, open: open, late: late, soon: soon, urgent: urgent, done: list.length - open.length };
}

// Dikkat gerektiren: geciken, termini 7 gün içinde olan ya da acil işaretli açık iş.
// Sıra: önce geciken, sonra acil, sonra termine göre.
export function attentionOf(list) {
  return list.filter(function (t) {
    if (t.status === "tamam") return false;
    const d = daysBetween(t.dueDate);
    return (d !== null && d <= 7) || !!t.urgent;
  }).sort(attentionOrder);
}

function attentionOrder(a, b) {
  const da = daysBetween(a.dueDate), db = daysBetween(b.dueDate);
  const la = da !== null && da < 0 ? 0 : 1, lb = db !== null && db < 0 ? 0 : 1;
  if (la !== lb) return la - lb;
  if (!!a.urgent !== !!b.urgent) return a.urgent ? -1 : 1;
  return String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999"));
}

function dueText(t) {
  const d = daysBetween(t.dueDate);
  if (d === null) return '<span class="muted">termin yok</span>';
  return '<span class="mono">' + fmtDate(t.dueDate) + '</span><span class="muted"> (' +
    (d < 0 ? Math.abs(d) + " gün geç" : d === 0 ? "bugün" : d + " gün") + ')</span>';
}

function attentionTable(list, job) {
  const MAX = 8;
  if (!list.length) {
    return '<div class="empty"><h3>Dikkat gerektiren iş yok</h3>' +
      '<p>Geciken, termini 7 gün içinde olan ya da acil açık iş bulunmuyor.</p></div>';
  }
  let h = '<div class="tw"><table class="att"><thead><tr><th>İş</th><th>Termin</th><th>Durum</th></tr></thead><tbody>';
  list.slice(0, MAX).forEach(function (t) {
    const st = taskState(t);
    const p = job ? null : byId(data.projects, t.projectId);
    const where = job ? deptName(t.dept) : (p ? p.name : "—");
    h += '<tr class="click" ' + (job ? 'data-nav="projedisi"' : 'data-open-proj="' + esc(t.projectId) + '"') + '>' +
      '<td><div class="t-name">' + esc(t.name) + (t.urgent ? ' <span class="tag tag-urgent">Acil</span>' : '') + '</div>' +
      '<div class="muted att-sub">' + esc(where) + ' · ' + esc(personName(t.assignee) || "Atanmadı") + '</div></td>' +
      '<td style="white-space:nowrap">' + dueText(t) + '</td>' +
      '<td><span class="st st-' + st + '">' + esc(stateLabel(st)) + '</span></td></tr>';
  });
  h += '</tbody></table></div>';
  if (list.length > MAX) {
    h += '<div class="panel-body att-more"><button class="btn btn-sm btn-ghost" ' +
      (job ? 'data-nav="projedisi"' : 'data-nav="projeler"') + '>+' + (list.length - MAX) + ' iş daha →</button></div>';
  }
  return h;
}

export function viewPanel(S) {
  const active = activeProjects();
  const P = workStats(activeProjectTasks());
  const J = workStats(jobs());
  const pAtt = attentionOf(P.all), jAtt = attentionOf(J.all);

  let h = '<div class="page-head"><div><h1>Panel</h1><div class="sub">' +
    fmtDate(todayISO()) + ' · proje işleri ve proje dışı işler</div></div><div class="row-actions">' +
    (canSee("yeni") ? '<button class="btn" data-nav="yeni">Yeni proje</button>' : '') +
    (canPlan() ? '<button class="btn btn-pri" data-newjob="1">Proje dışı iş emri</button>' : '') +
    '</div></div>';

  h += migrationBanner();

  h += '<div class="split">';

  h += '<section class="side" aria-label="Proje işleri"><div class="side-head"><h2>Proje işleri</h2>' +
    '<span class="muted">' + active.length + ' aktif proje</span>' +
    '<button class="btn btn-sm btn-ghost" data-nav="projeler">Projeler →</button></div>' +
    '<div class="kpis">' +
    kpi(P.open.length, "Açık iş", P.done + " / " + P.all.length + " bitti", "") +
    kpi(P.late.length, "Geciken", P.late.length ? "Termini geçti" : "Gecikme yok", P.late.length ? "alert" : "") +
    kpi(P.soon.length, "7 gün içinde", "Termini yaklaşan", P.soon.length ? "warn" : "") +
    kpi(active.length, "Aktif proje", data.projects.length + " proje kayıtlı", "") + '</div>' +
    '<div class="panel"><div class="panel-head"><h2>Dikkat gerektiren</h2><span class="muted mono">' + pAtt.length + '</span></div>' +
    attentionTable(pAtt, false) + '</div></section>';

  h += '<section class="side" aria-label="Proje dışı işler"><div class="side-head"><h2>Proje dışı işler</h2>' +
    '<span class="muted">' + J.all.length + ' iş emri</span>' +
    '<button class="btn btn-sm btn-ghost" data-nav="projedisi">Proje dışı işler →</button></div>' +
    '<div class="kpis">' +
    kpi(J.open.length, "Açık iş", J.done + " / " + J.all.length + " bitti", "") +
    kpi(J.late.length, "Geciken", J.late.length ? "Termini geçti" : "Gecikme yok", J.late.length ? "alert" : "") +
    kpi(J.soon.length, "7 gün içinde", "Termini yaklaşan", J.soon.length ? "warn" : "") +
    kpi(J.urgent.length, "Acil", J.urgent.length ? "Acil işaretli açık iş" : "Acil iş yok", J.urgent.length ? "alert" : "") + '</div>' +
    '<div class="panel"><div class="panel-head"><h2>Dikkat gerektiren</h2><span class="muted mono">' + jAtt.length + '</span></div>' +
    attentionTable(jAtt, true) + '</div></section>';

  h += '</div>';

  const load = data.depts.map(function (d) {
    const p = P.open.filter(function (t) { return t.dept === d.id; });
    const j = J.open.filter(function (t) { return t.dept === d.id; });
    const late = p.concat(j).filter(function (t) { const x = daysBetween(t.dueDate); return x !== null && x < 0; }).length;
    return { name: d.name, p: p.length, j: j.length, late: late };
  }).sort(function (a, b) { return (b.p + b.j) - (a.p + a.j); });
  const max = Math.max.apply(null, [1].concat(load.map(function (x) { return x.p + x.j; })));

  h += '<div class="grid2"><div class="panel"><div class="panel-head"><h2>Proje ilerlemesi</h2>' +
    '<button class="btn btn-sm btn-ghost" data-nav="projeler">Tümü →</button></div><div class="tw"><table>' +
    '<thead><tr><th>Proje</th><th>Tema</th><th>Teslim</th><th>İlerleme</th><th>Açık iş</th></tr></thead><tbody>';
  active.slice().sort(function (a, b) {
    return String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999"));
  }).forEach(function (p) {
    const pr = progress(p.id);
    const o = projTasks(p.id).filter(function (t) { return t.status !== "tamam"; }).length;
    const d = daysBetween(p.dueDate);
    h += '<tr class="click" data-open-proj="' + esc(p.id) + '"><td class="t-name">' + esc(p.name) + '</td>' +
      '<td class="muted">' + esc(p.theme || "—") + '</td>' +
      '<td class="mono">' + fmtDate(p.dueDate) + (d !== null && d < 0 ? ' <span style="color:var(--late)">geç</span>' : '') + '</td>' +
      '<td>' + progBar(pr.pct) + '</td><td class="mono">' + o + '</td></tr>';
  });
  if (!active.length)
    h += '<tr><td colspan="5"><div class="empty"><h3>Aktif proje yok</h3><p>Yeni proje açarak başlayın.</p></div></td></tr>';
  h += '</tbody></table></div></div>';

  h += '<div class="panel"><div class="panel-head"><h2>Departman yükü</h2>' +
    '<span class="muted" style="font-size:12px">açık iş emri</span></div><div class="panel-body">';
  load.forEach(function (x) {
    h += '<div class="bar-row bar-row-load"><div style="font-size:12.5px">' + esc(x.name) + '</div>' +
      '<div class="bar-track bar-stack" title="' + esc(x.p + " proje işi, " + x.j + " proje dışı iş") + '">' +
      '<div class="bar-fill" style="width:' + Math.round(x.p / max * 100) + '%"></div>' +
      '<div class="bar-fill is-job" style="width:' + Math.round(x.j / max * 100) + '%"></div></div>' +
      '<div class="bar-val">' + (x.p + x.j) + '</div>' +
      '<div>' + (x.late ? '<span class="bar-late">' + x.late + ' geç</span>' : '') + '</div></div>';
  });
  h += '<div class="legend" style="margin-top:10px"><span class="li"><span class="dot dot-devam"></span>proje işi</span>' +
    '<span class="li"><span class="dot dot-job"></span>proje dışı iş</span>' +
    '<span class="li"><span class="bar-late">geç</span>termini geçmiş iş</span></div></div></div></div>';
  return h;
}

/* ================= proje dışı işler ================= */

const JOB_FILTERS = [
  { id: "acik", label: "Açık" }, { id: "gecikti", label: "Geciken" }, { id: "acil", label: "Acil" },
  { id: "tamam", label: "Tamamlanan" }, { id: "tumu", label: "Tümü" }
];

function jobPass(t, f) {
  const done = t.status === "tamam";
  if (f === "acik") return !done;
  if (f === "gecikti") { const d = daysBetween(t.dueDate); return !done && d !== null && d < 0; }
  if (f === "acil") return !done && !!t.urgent;
  if (f === "tamam") return done;
  return true;
}

export function viewJobs(S) {
  const plan = canPlan();
  const all = jobs();
  const st = workStats(all);
  const f = S.jobFilter || "acik";

  let h = '<div class="page-head"><div><h1>Proje dışı işler</h1>' +
    '<div class="sub">Projeye bağlı olmayan iş emirleri — bakım, tamir, numune, iç işler</div></div>' +
    (plan ? '<button class="btn btn-pri" data-newjob="1">Yeni iş emri</button>' : '') + '</div>';

  h += '<div class="kpis">' +
    kpi(st.open.length, "Açık iş", st.done + " / " + all.length + " bitti", "") +
    kpi(st.late.length, "Geciken", st.late.length ? "Termini geçti" : "Gecikme yok", st.late.length ? "alert" : "") +
    kpi(st.soon.length, "7 gün içinde", "Termini yaklaşan", st.soon.length ? "warn" : "") +
    kpi(st.urgent.length, "Acil", "Acil işaretli açık iş", st.urgent.length ? "alert" : "") + '</div>';

  if (!all.length) {
    return h + '<div class="panel"><div class="empty"><h3>Henüz proje dışı iş emri yok</h3>' +
      '<p>' + (plan ? "“Yeni iş emri” ile bir departmana ya da kişiye iş açın." : "Size ya da departmanınıza açılan işler burada görünür.") + '</p>' +
      (plan ? '<button class="btn btn-pri" data-newjob="1" style="margin-top:10px">Yeni iş emri</button>' : '') + '</div></div>';
  }

  const term = String(S.jobSearch || "").toLocaleLowerCase("tr-TR").trim();
  const rows = all.filter(function (t) { return jobPass(t, f); })
    .filter(function (t) { return !S.jobDept || t.dept === S.jobDept; })
    .filter(function (t) {
      if (!term) return true;
      return [t.name, t.spec, personName(t.assignee), deptName(t.dept)].join(" ").toLocaleLowerCase("tr-TR").indexOf(term) !== -1;
    });

  h += '<div class="panel"><div class="panel-head job-head"><div class="seg" role="group" aria-label="Durum süzgeci">' +
    JOB_FILTERS.map(function (x) {
      const n = all.filter(function (t) { return jobPass(t, x.id); }).length;
      return '<button class="' + (f === x.id ? "on" : "") + '" data-jobfilter="' + x.id + '">' + esc(x.label) +
        ' <span class="mono">' + n + '</span></button>';
    }).join("") + '</div><div class="row-actions">' +
    '<select id="job-dept" class="inp-sm" style="width:160px" aria-label="Departman süzgeci"><option value="">Tüm departmanlar</option>' +
    data.depts.map(function (d) {
      return '<option value="' + esc(d.id) + '"' + (S.jobDept === d.id ? " selected" : "") + '>' + esc(d.name) + '</option>';
    }).join("") + '</select>' +
    '<input id="job-search" class="inp-sm" type="search" style="width:200px" placeholder="İş, kişi, açıklama…" value="' +
    esc(S.jobSearch || "") + '" aria-label="İşlerde ara" autocomplete="off"></div></div>';

  if (!rows.length) return h + '<div class="empty"><h3>Bu görünümde iş yok</h3><p>Süzgeci ya da aramayı değiştirin.</p></div></div>';

  h += '<div class="thead-row"><span class="c-name">İş</span><span>Gereken / Yapılan</span>' +
    '<span>Departman</span><span>Sorumlu</span><span>Termin</span><span>Durum</span></div>';
  const order = f === "tamam"
    ? function (a, b) { return String(b.completedAt || "").localeCompare(String(a.completedAt || "")); }
    : function (a, b) { return (a.status === "tamam") - (b.status === "tamam") || attentionOrder(a, b); };
  data.depts.concat([{ id: "", name: "Departman atanmamış" }]).forEach(function (d) {
    const items = rows.filter(function (t) {
      return d.id ? t.dept === d.id : !byId(data.depts, t.dept);
    }).sort(order);
    if (!items.length) return;
    h += '<div class="gband"><span>' + esc(d.name) + '</span><span class="n">' + items.length + '</span></div>';
    items.forEach(function (t) { h += taskRow(t); });
  });
  return h + '</div>';
}

/* ================= projeler ================= */

export function viewProjects(S) {
  const list = S.showArchived ? data.projects.slice() : activeProjects();
  const archCount = data.projects.filter(function (p) { return p.archived; }).length;

  const projTaskCount = data.tasks.filter(function (t) { return !isJob(t); }).length;
  let h = '<div class="page-head"><div><h1>Projeler</h1><div class="sub">' +
    activeProjects().length + ' aktif · ' + archCount + ' arşivde · ' + projTaskCount + ' iş emri</div></div>' +
    '<div class="row-actions">' +
    '<button class="btn btn-sm' + (S.projView === "liste" ? " btn-pri" : "") + '" data-projview="liste">Liste</button>' +
    '<button class="btn btn-sm' + (S.projView === "matris" ? " btn-pri" : "") + '" data-projview="matris">Matris</button>' +
    '<button class="btn btn-sm' + (S.showArchived ? " btn-pri" : "") + '" data-togglearch="1">Arşiv</button>' +
    (canSee("yeni") ? '<button class="btn btn-pri btn-sm" data-nav="yeni">Yeni proje</button>' : '') + '</div></div>';

  if (!list.length) {
    return h + '<div class="panel"><div class="empty"><h3>' +
      (S.showArchived ? "Bu görünümde proje yok" : "Henüz proje yok") + '</h3>' +
      '<p>Yeni proje açtığınızda seçtiğiniz adımlar iş emri olarak burada listelenir.</p></div></div>';
  }
  if (S.projView === "matris") return h + matrixView(list);

  h += '<div class="panel"><div class="tw"><table><thead><tr>' +
    '<th>Kod</th><th>Proje</th><th>Müşteri</th><th>Tema</th><th>Teslim</th><th>İlerleme</th><th>Adım</th>' +
    (canPlan() ? '<th></th>' : '') + '</tr></thead><tbody>';
  list.sort(function (a, b) {
    return String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999"));
  }).forEach(function (p) {
    const pr = progress(p.id), d = daysBetween(p.dueDate);
    h += '<tr class="click' + (p.archived ? " is-arch" : "") + '" data-open-proj="' + esc(p.id) + '">' +
      '<td class="mono">' + esc(p.code || "—") + '</td>' +
      '<td class="t-name">' + esc(p.name) +
        (p.archived ? ' <span class="tag tag-arch">arşiv</span>' : '') +
        (p.status === "tamam" ? ' <span class="st st-tamam">Bitti</span>' : '') + '</td>' +
      '<td class="muted">' + esc(String(p.customer || p.company || "—").slice(0, 40)) + '</td>' +
      '<td class="muted">' + esc(p.theme || "—") + '</td>' +
      '<td class="mono">' + fmtDate(p.dueDate) +
        (d !== null && d < 0 && p.status !== "tamam" && !p.archived ? ' <span style="color:var(--late)">geç</span>' : '') + '</td>' +
      '<td>' + progBar(pr.pct) + '</td>' +
      '<td class="mono muted">' + pr.done + '/' + pr.total + '</td>' +
      (canPlan() ? '<td style="text-align:right">' +
        '<button class="btn btn-sm btn-ghost" data-arch="' + esc(p.id) + '">' +
        (p.archived ? "Geri al" : "Arşivle") + '</button></td>' : '') + '</tr>';
  });
  h += '</tbody></table></div></div>';
  return h;
}

function matrixView(list) {
  const used = {};
  data.tasks.forEach(function (t) { used[canonicalStepId(t.stepId)] = true; });
  let cols = data.steps.filter(function (s) { return used[s.id]; });
  if (!cols.length) cols = data.steps.slice(0, 20);

  let h = '<div class="panel"><div class="panel-head"><h2>Adım matrisi</h2>' +
    '<div class="legend"><span class="li"><span class="dot dot-none"></span>kapsam dışı</span>' +
    '<span class="li"><span class="dot dot-bekliyor"></span>bekliyor</span>' +
    '<span class="li"><span class="dot dot-devam"></span>devam</span>' +
    '<span class="li"><span class="dot dot-tamam"></span>tamam</span>' +
    '<span class="li"><span class="dot dot-gecikti"></span>gecikti</span></div></div>';
  h += '<div class="matrix-wrap"><table class="matrix"><thead><tr><th class="sticky">Proje</th>';
  let prevG = null;
  cols.forEach(function (s) {
    const sep = (prevG !== null && s.group !== prevG) ? " gsep" : ""; prevG = s.group;
    h += '<th class="vert' + sep + '" title="' + esc(s.name) + '"><span>' + esc(s.name) + '</span></th>';
  });
  h += '</tr></thead><tbody>';
  list.forEach(function (p) {
    const map = {};
    projTasks(p.id).forEach(function (t) { map[canonicalStepId(t.stepId)] = t; });
    h += '<tr class="click' + (p.archived ? " is-arch" : "") + '" data-open-proj="' + esc(p.id) +
      '"><td class="sticky" title="' + esc(p.name) + '">' + esc(p.name) + '</td>';
    prevG = null;
    cols.forEach(function (s) {
      const sep = (prevG !== null && s.group !== prevG) ? " gsep" : ""; prevG = s.group;
      const t = map[s.id];
      const tip = s.name + " — " + (t ? stateLabel(taskState(t)) + (t.assignee ? " · " + personName(t.assignee) : "") : "kapsam dışı");
      h += '<td class="cell' + sep + '" title="' + esc(tip) + '"><span class="dot ' + dotClass(t) + '"></span></td>';
    });
    h += '</tr>';
  });
  return h + '</tbody></table></div></div>';
}

/* ================= proje detayı ================= */

export function viewProject(S) {
  const p = byId(data.projects, S.projectId);
  if (!p) return viewProjects(S);
  const ts = projTasks(p.id), pr = progress(p.id), d = daysBetween(p.dueDate);
  const plan = canPlan();

  const tab = S.projTab || "isler";

  let h = '<div class="page-head"><div>' +
    '<button class="btn btn-sm btn-ghost" data-nav="projeler" style="margin-bottom:6px">← Projeler</button>' +
    '<h1>' + (p.code ? '<span class="mono pcode">' + esc(p.code) + '</span> ' : '') + esc(p.name) +
      (p.archived ? ' <span class="tag tag-arch">arşiv</span>' : '') +
      (p.status === "tamam" ? ' <span class="st st-tamam">Bitti</span>' : '') + '</h1>' +
    '<div class="sub">' + esc([p.theme, p.company || p.customer].filter(Boolean).join(" · ") || "Müşteri bilgisi girilmemiş") +
      ' · ' + esc(fmtDate(p.startDate)) + ' → ' + esc(fmtDate(p.dueDate)) + '</div></div>' +
    '<div class="row-actions">' +
    (plan ? '<button class="btn btn-sm" data-edit-proj="1">Proje bilgileri</button>' : '') +
    (plan ? '<button class="btn btn-sm" data-add-steps="1">Adım / kalem ekle</button>' : '') +
    (plan ? '<button class="btn btn-sm" data-arch="' + esc(p.id) + '">' + (p.archived ? "Arşivden çıkar" : "Arşivle") + '</button>' : '') +
    (isAdmin() && p.archived ? delBtn(S, p.id, "Kalıcı sil", "delproj") : '') +
    '</div></div>';

  h += '<div class="kpis">' +
    kpi("%" + pr.pct, "Tamamlanan", pr.done + "/" + pr.total + " iş emri", "") +
    kpi(ts.filter(function (t) { return t.status !== "tamam"; }).length, "Açık iş", "Devam eden ve bekleyen", "") +
    kpi(ts.filter(function (t) {
      const x = daysBetween(t.dueDate); return t.status !== "tamam" && x !== null && x < 0;
    }).length, "Geciken", "Termini geçmiş", "alert") +
    kpi(d === null ? "—" : (d < 0 ? Math.abs(d) + " gün" : d + " gün"),
      d !== null && d < 0 ? "Teslimat gecikmesi" : "Teslimata kalan",
      fmtDate(p.dueDate), d !== null && d < 0 ? "alert" : (d !== null && d <= 7 ? "warn" : "")) + '</div>';

  h += '<div class="panel"><div class="panel-body" style="display:flex; gap:22px; flex-wrap:wrap">' +
    meta("Cari unvan", p.company) + meta("Müşteri / yetkili", p.customer) + meta("İletişim", p.contact || p.phone) +
    meta("Sipariş alan", p.salesperson) + meta("3D tasarım", p.designer3d) + meta("Çizim ve takip", p.drafter) +
    meta("Adres", p.address) + meta("Açıklama", p.description) + meta("Not", p.note) +
    (p.quoteNo ? '<div style="min-width:110px"><div class="eyebrow">Teklif</div><div style="font-size:13.5px; margin-top:2px">' +
      (canSee("teklifler") && p.quoteId
        ? '<button class="linkish mono" style="font-size:13.5px" data-qopen="' + esc(p.quoteId) + '">' + esc(p.quoteNo) + '</button>'
        : '<span class="mono">' + esc(p.quoteNo) + '</span>') + '</div></div>' : '') +
    '</div></div>';

  // Sekmeler: iş emirleri ve dosyalar herkese; muhasebe yalnızca yönetici ve muhasebe rolüne.
  const tabs = [{ id: "isler", label: "İş emirleri", n: ts.length }];
  if (canAccount()) tabs.push({ id: "muhasebe", label: "Muhasebe" });
  tabs.push({ id: "dosyalar", label: "Dosyalar", n: projectFiles(p.id).length });
  h += '<div class="tabs" role="tablist">' + tabs.map(function (x) {
    return '<button role="tab" aria-selected="' + (tab === x.id) + '" data-ptab="' + x.id + '">' + esc(x.label) +
      (x.n ? ' <span class="mono">' + x.n + '</span>' : '') + '</button>';
  }).join("") + '</div>';

  if (tab === "muhasebe" && canAccount()) return h + accountingTab(S, p);
  if (tab === "dosyalar") return h + filesTab(S, p, ts);

  h += '<div class="panel"><div class="panel-head"><h2>İş emirleri</h2>' +
    '<span class="muted"><span class="mono">' + ts.length + '</span> adım</span></div>';
  if (!ts.length) {
    h += '<div class="empty"><h3>Adım seçilmemiş</h3><p>“Adım ekle” ile projenin kapsamını belirleyin.</p></div>';
  } else {
    h += '<div class="thead-row"><span class="c-name">Adım</span><span>Gereken / Yapılan</span>' +
      '<span>Departman</span><span>Sorumlu</span><span>Termin</span><span>Durum</span></div>';
    let prevK = null;
    ts.forEach(function (t) {
      const key = (t.group || "") + "|" + (t.section || "");
      if (key !== prevK) {
        const g = byId(data.groups, t.group);
        const cnt = ts.filter(function (x) { return ((x.group || "") + "|" + (x.section || "")) === key; }).length;
        const sn = sectionName(t.dept, t.section);
        h += '<div class="gband"><span>' + esc(g ? g.label : (t.group || "Diğer")) + (sn ? ' · ' + esc(sn) : '') +
          '</span><span class="n">' + cnt + '</span></div>';
        prevK = key;
      }
      h += taskRow(t);
    });
  }
  return h + '</div>';
}

// Dosyalar sekmesi: projedeki tüm dosyalar, adıma göre gruplu. Bir yıl sonra
// sözleşme, 3D görsel ya da montaj fotoğrafı buradan bulunur.
function filesTab(S, p, ts) {
  const all = projectFiles(p.id, !!S.showArchivedFiles);
  const plan = canPlan();
  let h = '<div class="panel"><div class="panel-head"><h2>Dosyalar</h2><div class="row-actions">' +
    '<span class="muted mono">' + all.length + '</span>' +
    '<button class="btn btn-sm ' + (S.showArchivedFiles ? "btn-pri" : "btn-ghost") + '" data-filesarch="1">Arşivdekiler</button></div></div>';
  if (!all.length) {
    return h + '<div class="empty"><h3>Dosya yok</h3><p>İş emri satırındaki “dosya ekle / dosya yükle” ile yüklenen dosyalar burada toplanır.</p></div></div>';
  }
  const byTask = {};
  all.forEach(function (f) { (byTask[f.taskId] = byTask[f.taskId] || []).push(f); });
  ts.forEach(function (t) { if (byTask[t.id]) byTask[t.id]._task = t; });
  Object.keys(byTask).forEach(function (tid) {
    const list = byTask[tid], t = list._task;
    h += '<div class="gband"><span>' + esc(t ? t.name : (list[0].taskName || "İş emri")) + '</span><span class="n">' + list.length + '</span></div>';
    list.forEach(function (f) {
      h += '<div class="fline' + (f.archived ? " done" : "") + '"><div class="fn"><a href="' + esc(f.url) + '" target="_blank" rel="noopener">📎 ' + esc(f.name) + '</a>' +
        (f.archived ? ' <span class="tag tag-arch">arşiv</span>' : '') + '</div>' +
        '<div class="muted">' + esc(fmtSize(f.size)) + '</div>' +
        '<div class="muted">' + esc(f.uploadedByName || f.uploadedBy || "") + ' · ' + esc(fmtDate(String(f.uploadedAt || "").slice(0, 10))) + '</div>' +
        '<div style="text-align:right">' + (plan ? '<button class="btn btn-sm btn-ghost" data-filearch="' + esc(f.id) + '" data-on="' + (f.archived ? "0" : "1") + '">' +
          (f.archived ? "Geri al" : "Arşive al") + '</button>' : '') + '</div></div>';
    });
  });
  return h + '</div>';
}

// Muhasebe sekmesi: proje seviyesinde tutar, ödeme ve nakliye/montaj bilgileri.
// Veri ayrı koleksiyonda (accounting/<pid>); yalnızca yönetici ve muhasebe okur.
function accountingTab(S, p) {
  const a = accountingOf(p.id);
  const inc = function (key, label) {
    const v = a[key] || "";
    return '<div class="f"><label for="acc-' + key + '">' + esc(label) + '</label><select id="acc-' + key + '" data-acc="' + key + '">' +
      '<option value=""' + (v === "" ? " selected" : "") + '>Belirtilmedi</option>' +
      '<option value="dahil"' + (v === "dahil" ? " selected" : "") + '>Teklife dahil</option>' +
      '<option value="haric"' + (v === "haric" ? " selected" : "") + '>Hariç — alıcıya ait</option></select></div>';
  };
  return '<div class="panel"><div class="panel-head"><h2>Muhasebe</h2>' +
    (a.updatedAt ? '<span class="muted" style="font-size:12px">son güncelleme ' + esc(fmtDateTime(a.updatedAt)) + '</span>' : '') + '</div>' +
    '<div class="panel-body"><div class="form">' +
    '<div class="f"><label for="acc-total">Genel toplam (₺)</label><input id="acc-total" data-acc="total" type="text" inputmode="decimal" class="mono" value="' + esc(a.total) + '" placeholder="0"></div>' +
    '<div class="f"><label for="acc-balance">Müşteri borç / alacak (₺)</label><input id="acc-balance" data-acc="balance" type="text" inputmode="decimal" class="mono" value="' + esc(a.balance) + '" placeholder="eksi: alacaklı"></div>' +
    inc("shippingIncluded", "Nakliye") + inc("installIncluded", "Montaj") +
    '<div class="f full"><label for="acc-shippingNote">Nakliye / montaj notu</label><input id="acc-shippingNote" data-acc="shippingNote" type="text" value="' + esc(a.shippingNote) + '" placeholder="örn. gümrük dahil, nakliye alıcıya ait"></div>' +
    '<div class="f full"><label for="acc-paymentDetail">Ödeme detayı</label><textarea id="acc-paymentDetail" data-acc="paymentDetail" placeholder="ön ödeme, çek/senet tarihleri…">' + esc(a.paymentDetail) + '</textarea></div>' +
    '<div class="f full"><label for="acc-discussedDetail">Konuşulan detay</label><textarea id="acc-discussedDetail" data-acc="discussedDetail">' + esc(a.discussedDetail) + '</textarea></div>' +
    '</div></div><div class="modal-foot"><button class="btn btn-pri" data-accsave="' + esc(p.id) + '">Muhasebe bilgilerini kaydet</button></div></div>';
}

/* ================= işlerim ================= */

export function viewMyWork(S) {
  const person = mePerson();
  const mine = person
    ? data.tasks.filter(function (t) { return t.assignee === person.id; })
    : [];
  const open = mine.filter(function (t) { return t.status !== "tamam"; })
    .sort(function (a, b) { return String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999")); });
  const done = mine.filter(function (t) { return t.status === "tamam"; })
    .sort(function (a, b) { return String(b.completedAt || "").localeCompare(String(a.completedAt || "")); }).slice(0, 8);
  const late = open.filter(function (t) { const d = daysBetween(t.dueDate); return d !== null && d < 0; }).length;

  let h = '<div class="page-head"><div><h1>İşlerim</h1><div class="sub">' +
    esc(myName()) + (person && person.dept ? " · " + esc(deptName(person.dept)) : "") + '</div></div></div>';

  if (!person) {
    return h + '<div class="banner banner-warn"><span aria-hidden="true">!</span><div>' +
      '<strong>Personel kaydınız bulunamadı.</strong>' +
      'Size iş emri atanabilmesi için yöneticinin Ayarlar → Personel listesinde ' +
      esc(myEmail()) + ' e-postasıyla bir kayıt açması gerekiyor.</div></div>';
  }

  h += '<div class="kpis">' +
    kpi(open.length, "Açık iş", "Size atanmış, bitmemiş", "") +
    kpi(late, "Geciken", "Termini geçti", late ? "alert" : "") +
    kpi(open.filter(function (t) { const d = daysBetween(t.dueDate); return d !== null && d >= 0 && d <= 3; }).length,
      "3 gün içinde", "Termini yaklaşan", "warn") +
    kpi(mine.filter(function (t) { return t.status === "tamam"; }).length, "Tamamlanan", "Toplam", "") + '</div>';

  h += '<div class="panel"><div class="panel-head"><h2>Yapılacak işler</h2><span class="muted mono">' + open.length + '</span></div>';
  if (!open.length) {
    h += '<div class="empty"><h3>Açık iş yok</h3><p>Size atanmış bekleyen bir iş emri bulunmuyor.</p></div>';
  } else {
    h += '<div class="tw"><table><thead><tr><th>Adım</th><th>Proje</th><th>Gereken / Yapılan</th>' +
      '<th>Termin</th><th>Durum</th><th></th></tr></thead><tbody>';
    open.forEach(function (t) {
      const pj = byId(data.projects, t.projectId), st = taskState(t), d = daysBetween(t.dueDate);
      const need = needOf(t), made = doneOf(t), short = shortOf(t), adm = canPlan();
      let cell = "";
      if (t.type === "qty" && need > 0)
        cell = '<div data-task="' + esc(t.id) + '" style="max-width:132px">' + qtyCell(t, adm, true, need, made) + '</div>';
      if (t.spec) cell += '<div class="tspec">' + esc(t.spec) + '</div>';
      if (!cell) cell = '<span class="muted">—</span>';
      h += '<tr><td class="t-name">' + esc(t.name) +
        (t.urgent ? ' <span class="tag tag-urgent">Acil</span>' : '') +
        (short > 0 && made > 0 ? ' <span class="tag tag-warn">' + made + '/' + need + ' — ' + short + ' eksik</span>' : '') + '</td>' +
        (isJob(t)
          ? '<td><button class="tag tag-job" data-nav="projedisi">Proje dışı</button></td>'
          : '<td class="muted click" data-open-proj="' + esc(t.projectId) + '">' + esc(pj ? pj.name : "—") + '</td>') +
        '<td>' + cell + '</td>' +
        '<td class="mono">' + fmtDate(t.dueDate) +
          (d !== null ? '<span class="muted"> (' + (d < 0 ? Math.abs(d) + " gün geç" : d + " gün") + ')</span>' : '') + '</td>' +
        '<td><span class="st st-' + st + '">' + esc(stateLabel(st)) + '</span></td>' +
        '<td style="text-align:right"><div class="row-actions" style="justify-content:flex-end">' +
        (t.status === "bekliyor" ? '<button class="btn btn-sm" data-start="' + esc(t.id) + '">Başla</button>' : '') +
        '<button class="btn btn-sm ' + (short > 0 ? "btn-block" : "btn-pri") + '" data-toggle="' + esc(t.id) + '">Tamamla</button>' +
        (short > 0 && adm ? '<button class="btn btn-sm btn-ghost btn-xs" data-shortclose="' + esc(t.id) + '">Eksik kapat</button>' : '') +
        '</div></td></tr>';
    });
    h += '</tbody></table></div>';
  }
  h += '</div>';

  if (done.length) {
    h += '<div class="panel"><div class="panel-head"><h2>Son tamamlananlar</h2></div><div class="tw"><table>' +
      '<thead><tr><th>Adım</th><th>Proje</th><th>Tamamlandı</th><th></th></tr></thead><tbody>';
    done.forEach(function (t) {
      const pj = byId(data.projects, t.projectId);
      h += '<tr><td>' + esc(t.name) + '</td><td class="muted">' + esc(isJob(t) ? "Proje dışı" : (pj ? pj.name : "—")) + '</td>' +
        '<td class="mono muted">' + fmtDate(String(t.completedAt || "").slice(0, 10)) + '</td>' +
        '<td style="text-align:right"><button class="btn btn-sm btn-ghost" data-toggle="' + esc(t.id) + '">Geri al</button></td></tr>';
    });
    h += '</tbody></table></div></div>';
  }
  return h;
}

/* ================= yeni proje sihirbazı ================= */

export function viewWizard(S) {
  const w = S.wizard;
  const selCount = Object.keys(w.sel).length;
  let h = '<div class="page-head"><div><h1>Yeni proje</h1>' +
    '<div class="sub">Proje bilgileri → içerik seçimi → iş emri ataması</div></div>' +
    '<div class="steps-nav">' +
    ["Bilgiler", "İçerik", "Atama"].map(function (l, i) {
      return '<span class="s' + (w.step === i + 1 ? " on" : "") + '"><span class="n">' + (i + 1) + '</span>' + l + '</span>';
    }).join('<span aria-hidden="true">→</span>') + '</div></div>';

  if (w.quoteNo) {
    h += '<div class="banner banner-info"><span aria-hidden="true">i</span><div><strong>' + esc(w.quoteNo) +
      ' teklifinden oluşturuluyor.</strong>Müşteri bilgileri tekliften geldi; proje açılınca teklife bağlanır.</div></div>';
  }

  if (w.step === 1) {
    return h + '<div class="panel"><div class="panel-head"><h2>1 · Proje bilgileri</h2></div><div class="panel-body">' +
      '<div class="form">' +
      '<div class="f"><label for="w-code">Proje kodu *</label>' +
      '<input id="w-code" type="text" data-w="code" class="mono" value="' + esc(w.p.code) + '" placeholder="AP, BP, KP…" maxlength="4" ' +
      'style="text-transform:uppercase" autocomplete="off"></div>' +
      fld("name", "Proje adı", w.p.name, "text", "örn. Ahmetli Belediyesi", true) +
      fld("company", "Cari unvan", w.p.company, "text", "Fatura kesilecek firma") +
      fld("theme", "Tema", w.p.theme, "text", "ORMAN / SOFT / DENİZ") +
      fld("customer", "Müşteri / teslimat yetkilisi", w.p.customer, "text", "") +
      fld("contact", "İletişim bilgileri", w.p.contact, "text", "0500 000 00 00 · e-posta") +
      fld("startDate", "Başlangıç", w.p.startDate, "date", "") +
      fld("dueDate", "Teslim tarihi", w.p.dueDate, "date", "") +
      fld("salesperson", "Sipariş alan", w.p.salesperson, "text", "") +
      fld("designer3d", "3D tasarım", w.p.designer3d, "text", "") +
      fld("drafter", "Çizim ve takip", w.p.drafter, "text", "") +
      '<div class="f"><span class="muted" style="font-size:12px; display:block; padding-top:20px">Panel sayısı Metal ve Kaplama iş emirlerinde gereken / yapılan adet olarak tutulur.</span></div>' +
      '<div class="f full"><label for="w-description">Proje açıklaması</label>' +
      '<textarea id="w-description" data-w="description" placeholder="örn. Softplay oyun parkı + trambolin, ilave tadilat">' + esc(w.p.description) + '</textarea></div>' +
      '<div class="f full"><label for="w-address">Teslimat adresi</label>' +
      '<textarea id="w-address" data-w="address" placeholder="Mahalle, cadde, no, ilçe/il">' + esc(w.p.address) + '</textarea></div>' +
      '<div class="f full"><label for="w-note">Proje notu</label>' +
      '<textarea id="w-note" data-w="note" placeholder="Sahada dikkat edilecekler, eksikler…">' + esc(w.p.note) + '</textarea></div>' +
      '</div></div><div class="modal-foot">' +
      '<button class="btn btn-pri" data-wnext="2">İçerik seçimine geç →</button></div></div>';
  }

  if (w.step === 2) {
    h += '<div class="panel"><div class="panel-head"><h2>2 · Proje içeriği</h2>' +
      '<span class="muted"><span class="mono">' + selCount + ' / ' + data.steps.length + '</span> adım seçildi</span></div><div class="panel-body">';
    h += '<p class="muted" style="margin:0 0 14px; max-width:64ch">Excel’de ✓ / X ile işaretlediğiniz alanlar. ' +
      'Seçtiğiniz her adım, bir sonraki ekranda iş emrine dönüşür.</p>';
    const chip = function (s) {
      const on2 = !!w.sel[s.id];
      return '<button type="button" class="chip' + (on2 ? " on" : "") + '" data-pick="' + esc(s.id) + '">' +
        '<span class="box" aria-hidden="true">' + (on2 ? "✓" : "") + '</span>' +
        '<span><span class="nm">' + esc(s.name) + '</span>' +
        '<span class="dp">' + esc(deptLabel(s.dept, s.section)) + ' · ' + esc(stepTypeLabel(s.type, s.unit)) + '</span></span></button>';
    };
    data.groups.forEach(function (g) {
      const items = data.steps.filter(function (s) { return s.group === g.id; });
      if (!items.length) return;
      const on = items.filter(function (s) { return w.sel[s.id]; }).length;
      h += '<div class="gwrap"><div class="gtitle"><h3>' + esc(g.label) + '</h3>' +
        '<span class="c">' + on + '/' + items.length + '</span>' +
        '<button class="btn btn-sm btn-ghost" style="margin-left:auto" data-gall="' + esc(g.id) + '">' +
        (on === items.length ? "Hiçbiri" : "Tümü") + '</button></div>';
      // Bölümlü departmanda (Üretim Planlama) adımlar bölüm başlıklarıyla ayrılır.
      const secs = g.dept ? sectionsOf(g.dept) : [];
      if (secs.length) {
        secs.concat([{ id: "", name: "Genel" }]).forEach(function (sec) {
          const sub = items.filter(function (s) { return (s.section || "") === sec.id; });
          if (!sub.length) return;
          h += '<div class="sec-title">' + esc(sec.name) + '</div><div class="chips">' + sub.map(chip).join("") + '</div>';
        });
      } else {
        h += '<div class="chips">' + items.map(chip).join("") + '</div>';
      }
      h += '</div>';
    });
    return h + '</div><div class="modal-foot"><button class="btn" data-wnext="1">← Geri</button>' +
      '<button class="btn btn-pri" data-wnext="3"' + (selCount ? "" : " disabled") + '>Atamaya geç →</button></div></div>';
  }

  const picked = data.steps.filter(function (s) { return w.sel[s.id]; });
  h += '<div class="panel"><div class="panel-head"><h2>3 · İş emri ataması</h2>' +
    '<span class="muted"><span class="mono">' + picked.length + '</span> iş emri</span></div>';
  h += '<div class="panel-body" style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; border-bottom:1px solid var(--line-soft)">' +
    '<div class="f"><label for="bulk-date">Tüm adımlara termin uygula</label>' +
    '<input id="bulk-date" type="date" class="inp-sm inp-date" style="width:150px"></div>' +
    '<button class="btn btn-sm" data-bulkdate="1">Uygula</button>' +
    '<span class="muted" style="font-size:12px">Tek tek de değiştirebilirsiniz.</span></div>';
  h += '<div class="thead-row"><span class="c-name">Adım</span><span>Gereken adet</span><span>Departman</span>' +
    '<span>Sorumlu</span><span>Termin</span><span>Not</span></div>';
  picked.forEach(function (s) {
    const v = w.sel[s.id];
    h += '<div class="trow" data-wrow="' + esc(s.id) + '">' +
      '<div class="c-name"><div class="tn">' + esc(s.name) + '</div>' +
      '<div class="tspec">' + esc((byId(data.groups, s.group) || {}).label || "") + '</div></div>' +
      '<div>' + (s.type === "qty"
        ? '<input class="inp-sm mono" type="text" inputmode="decimal" data-wf="qty" value="' + esc(v.qty || "") +
          '" placeholder="' + esc(s.unit || "adet") + '" aria-label="Gereken adet">'
        : '<span class="muted">—</span>') + '</div>' +
      '<div class="dcell">' + selectW("dept", v.dept, data.depts.map(function (d) { return { v: d.id, l: d.name }; })) +
        sectionSelect("data-wf", v.dept, v.section, false) + '</div>' +
      '<div>' + selectW("assignee", v.assignee,
        peopleFor(v.dept, v.section).map(function (x) { return { v: x.id, l: x.name }; }), "Atanmadı") + '</div>' +
      '<div><input class="inp-sm inp-date" type="date" data-wf="dueDate" value="' + esc(v.dueDate || "") + '" aria-label="Termin"></div>' +
      '<div><input class="inp-sm" type="text" data-wf="spec" value="' + esc(v.spec || "") +
        '" placeholder="spesifikasyon" aria-label="Spesifikasyon"></div></div>';
  });
  return h + '<div class="modal-foot"><button class="btn" data-wnext="2">← Geri</button>' +
    '<button class="btn btn-pri" data-wsave="1">Projeyi oluştur</button></div></div>';
}

function fld(key, label, val, type, ph, req) {
  return '<div class="f"><label for="w-' + key + '">' + esc(label) + (req ? ' *' : '') + '</label>' +
    '<input id="w-' + key + '" type="' + type + '" data-w="' + key + '" value="' + esc(val) +
    '" placeholder="' + esc(ph || "") + '"></div>';
}

/* ================= kayıtlar ================= */

export function viewLog(S) {
  let h = '<div class="page-head"><div><h1>Kayıtlar</h1>' +
    '<div class="sub">Kim, ne zaman, neyi değiştirdi — bu kayıtlar silinemez</div></div>' +
    '<button class="btn btn-sm" data-reloadlog="1">Yenile</button></div>';
  if (!S.log) {
    return h + '<div class="panel"><div class="empty"><h3>Yükleniyor…</h3></div></div>';
  }
  if (!S.log.length) {
    return h + '<div class="panel"><div class="empty"><h3>Kayıt yok</h3>' +
      '<p>Uygulamada yapılan her değişiklik buraya yazılır.</p></div></div>';
  }
  h += '<div class="panel"><div class="tw"><table><thead><tr>' +
    '<th>Zaman</th><th>Kişi</th><th>İşlem</th><th>Ayrıntı</th></tr></thead><tbody>';
  S.log.forEach(function (r) {
    h += '<tr><td class="mono muted" style="white-space:nowrap">' + esc(fmtDateTime(r.atISO)) + '</td>' +
      '<td>' + esc(r.byName || r.by || "—") + '</td>' +
      '<td><span class="tag">' + esc(r.action || "—") + '</span></td>' +
      '<td class="muted">' + esc(r.detail || "") + '</td></tr>';
  });
  return h + '</tbody></table></div></div>';
}

/* ================= ayarlar ================= */

/* ================= erişim talepleri ================= */

export function viewRequests(S) {
  const pend = pendingRequests();
  const decided = data.requests.filter(function (r) {
    return (r.status || "bekliyor") !== "bekliyor";
  }).sort(function (a, b) {
    return String(b.decidedAt || b.at || "").localeCompare(String(a.decidedAt || a.at || ""));
  });

  let h = '<div class="page-head"><div><h1>Erişim talepleri</h1>' +
    '<div class="sub">Görevine bakıp rol verin — rol, gireceği ekranları belirler</div></div></div>';

  h += '<div class="panel"><div class="panel-head"><h2>Bekleyen</h2>' +
    '<span class="muted mono">' + pend.length + '</span></div><div class="panel-body">';

  if (!pend.length) {
    h += '<div class="empty"><h3>Bekleyen talep yok</h3>' +
      '<p>Biri erişim istediğinde burada görünür.</p></div>';
  }
  pend.forEach(function (r) {
    h += '<div class="reqline"><div class="rq-who">' +
      '<div class="rq-name">' + esc(r.name || r.id) + '</div>' +
      '<div class="muted" style="font-size:11.5px">' + esc(r.id) + ' · ' + esc(fmtDateTime(r.at)) + '</div>' +
      '<div class="rq-gorev"><span class="eyebrow">Görevi</span>' + esc(r.gorev || "—") + '</div>' +
      '</div><div class="rq-act">' +
      '<select class="inp-sm rq-role" data-reqdept="' + esc(r.id) + '" aria-label="Departman">' +
      data.depts.map(function (d) {
        return '<option value="' + esc(d.id) + '">' + esc(d.name) + '</option>';
      }).join("") + '</select>' +
      '<select class="inp-sm rq-role" data-reqrole="' + esc(r.id) + '" aria-label="Verilecek rol">' +
      ROLE_ORDER.map(function (k) {
        return '<option value="' + esc(k) + '"' + (k === "personel" ? " selected" : "") + '>' +
          esc(roleDef(k).label) + '</option>';
      }).join("") + '</select>' +
      '<button class="btn btn-sm btn-pri" data-approve="' + esc(r.id) + '">Onayla</button>' +
      delBtn(S, r.id, "Reddet", "rejectreq") +
      '</div></div>';
  });
  h += '</div></div>';

  h += '<div class="panel"><div class="panel-head"><h2>Karara bağlananlar</h2>' +
    '<span class="muted mono">' + decided.length + '</span></div><div class="panel-body">';
  if (!decided.length) h += '<p class="muted">Henüz karara bağlanmış talep yok.</p>';
  decided.forEach(function (r) {
    const ok = r.status === "onaylandi";
    h += '<div class="list-line"><div class="g">' +
      '<div style="font-weight:600; font-size:13px">' + esc(r.name || r.id) +
      ' <span class="tag' + (ok ? '' : ' tag-warn') + '">' +
      (ok ? esc(roleLabel(r.role)) : "reddedildi") + '</span></div>' +
      '<div class="muted" style="font-size:11.5px">' + esc(r.id) +
      (r.gorev ? ' · ' + esc(r.gorev) : '') +
      (r.decidedAt ? ' · ' + esc(fmtDateTime(r.decidedAt)) : '') + '</div></div></div>';
  });
  h += '</div></div>';

  h += '<div class="panel"><div class="panel-head"><h2>Roller ne görür</h2></div>' +
    '<div class="panel-body"><div class="tw"><table><thead><tr><th>Rol</th><th>Ekranlar</th>' +
    '<th>Düzenleyebildiği iş emirleri</th></tr></thead><tbody>';
  const SCOPE = { hepsi: "Hepsi", departman: "Kendi departmanı", kendi: "Kendine atananlar" };
  ROLE_ORDER.forEach(function (k) {
    const d = roleDef(k);
    h += '<tr><td style="font-weight:600">' + esc(d.label) + '</td>' +
      '<td class="muted">' + esc(d.views.filter(function (v) { return VIEW_LABEL[v]; })
        .map(function (v) { return VIEW_LABEL[v]; }).join(", ")) + '</td>' +
      '<td class="muted">' + esc(SCOPE[d.scope] || d.scope) + '</td></tr>';
  });
  h += '</tbody></table></div></div></div>';

  return h;
}

const VIEW_LABEL = {
  panel: "Panel", projeler: "Projeler", projedisi: "Proje Dışı İşler", isler: "İşlerim", yeni: "Yeni Proje",
  teklifler: "Teklifler", talepler: "Talepler", kayitlar: "Kayıtlar", ayarlar: "Ayarlar"
};

export function viewSettings(S) {
  let h = '<div class="page-head"><div><h1>Ayarlar</h1>' +
    '<div class="sub">Personel, giriş yetkileri, departmanlar ve adım kataloğu</div></div></div>';

  if (data.steps.length && data.catalogVersion < CATALOG_VERSION) {
    const armed = S.confirm === "migrate:v2";
    h += '<div class="panel"><div class="panel-head"><h2>Yeni adım kataloğu (sürüm 2)</h2></div><div class="panel-body">' +
      '<p style="max-width:70ch; margin:0 0 10px">Katalog Toysmar’ın gerçek süreç adımlarına göre yeniden kuruldu: ' +
      '9 departman, Üretim Planlama altında Metal / Kaplama / MDF / Dikiş bölümleri, 65 adım ve dosya / metin tipinde adımlar. ' +
      'Geçişte mevcut adım kataloğu yenisiyle değişir; personel, giriş yetkileri ve açık iş emirleri eski departmandan yeni departman ve bölüme taşınır. ' +
      'Projeler ve iş emirleri silinmez, tamamlanmış işler olduğu gibi kalır.</p>' +
      '<p class="muted" style="margin:0 0 12px; font-size:12.5px">Metal, Kaplama, MDF → Üretim Planlama bölümleri · Çizim / Tasarım → Tasarım · ' +
      'diğer departmanlar aynı kalır, sizin eklediğiniz departmanlar korunur.</p>' +
      '<button class="btn ' + (armed ? "btn-danger" : "btn-pri") + '" data-confirm="migrate:v2">' +
      (armed ? "Emin misiniz? Geçişi başlat" : "Yeni kataloğa geç") + '</button></div></div>';
  }

  h += '<div class="grid2"><div style="display:flex; flex-direction:column; gap:16px">';

  /* personel */
  h += '<div class="panel"><div class="panel-head"><h2>Personel</h2>' +
    '<button class="btn btn-sm" data-addperson="1">Ekle</button></div><div class="panel-body">';
  data.people.forEach(function (p) {
    const open = data.tasks.filter(function (t) { return t.assignee === p.id && t.status !== "tamam"; }).length;
    const mem = data.members.filter(function (m) {
      return String(m.id || "").toLowerCase() === String(p.email || "").toLowerCase();
    })[0];
    h += '<div class="list-line"><div class="g">' +
      '<div style="font-weight:600; font-size:13px">' + esc(p.name) +
        (mem ? ' <span class="tag">' + esc(roleLabel(mem.role)) + '</span>' : '') + '</div>' +
      '<div class="muted" style="font-size:11.5px">' + esc(deptLabel(p.dept, p.section)) + ' · ' + open + ' açık iş' +
        (p.email ? ' · ' + esc(p.email) : ' · e-posta yok') + '</div></div>' +
      '<button class="btn btn-sm btn-ghost" data-editperson="' + esc(p.id) + '">Düzenle</button>' +
      delBtn(S, p.id, "Sil", "delperson") + '</div>';
  });
  if (!data.people.length) h += '<p class="muted">Personel yok.</p>';
  h += '</div></div>';

  /* giriş yetkileri */
  h += '<div class="panel"><div class="panel-head"><h2>Giriş yetkisi</h2>' +
    '<span class="muted mono">' + data.members.length + '</span></div><div class="panel-body">' +
    '<p class="muted" style="margin:0 0 10px; font-size:12.5px">Yalnızca bu listedeki hesaplar uygulamaya girebilir. ' +
    'Rol, kişinin hangi ekranları göreceğini belirler — dağılım <strong>Talepler</strong> ekranının altında yazılı.</p>';
  data.members.forEach(function (m) {
    h += '<div class="list-line"><div class="g">' +
      '<div style="font-weight:600; font-size:13px">' + esc(m.name || m.id) +
        ' <span class="tag">' + esc(roleLabel(m.role)) + '</span></div>' +
      '<div class="muted" style="font-size:11.5px">' + esc(m.id) + '</div></div>' +
      (String(m.id).toLowerCase() === myEmail()
        ? '<span class="tag">siz</span>'
        : delBtn(S, m.id, "Yetkiyi al", "delmember")) + '</div>';
  });
  h += '</div></div>';

  /* departmanlar */
  h += '<div class="panel"><div class="panel-head"><h2>Departmanlar</h2>' +
    '<button class="btn btn-sm" data-adddept="1">Ekle</button></div><div class="panel-body">';
  data.depts.forEach(function (d) {
    const load = data.tasks.filter(function (t) { return t.dept === d.id && t.status !== "tamam"; }).length;
    const secs = sectionsOf(d.id).map(function (s) { return s.name; }).join(", ");
    h += '<div class="list-line"><div class="g"><div style="font-weight:600; font-size:13px">' + esc(d.name) +
      (secs ? ' <span class="muted" style="font-weight:400; font-size:12px">— ' + esc(secs) + '</span>' : '') + '</div>' +
      '<div class="muted" style="font-size:11.5px">' +
      data.people.filter(function (p) { return p.dept === d.id; }).length + ' kişi · ' + load + ' açık iş</div></div>' +
      delBtn(S, d.id, "Sil", "deldept") + '</div>';
  });
  if (!data.depts.length) h += '<p class="muted">Departman yok.</p>';
  h += '</div></div></div>';

  /* katalog */
  h += '<div class="panel"><div class="panel-head"><h2>Adım kataloğu</h2>' +
    '<button class="btn btn-sm" data-addstep="1">Adım ekle</button></div>';
  data.groups.forEach(function (g) {
    const items = data.steps.filter(function (s) { return s.group === g.id; });
    if (!items.length) return;
    h += '<div class="gband"><span>' + esc(g.label) + '</span><span class="n">' + items.length + '</span></div>';
    h += '<div class="panel-body" style="padding:4px 14px">';
    items.forEach(function (s) {
      h += '<div class="list-line"><div class="g"><div style="font-weight:600; font-size:13px">' + esc(s.name) + '</div>' +
        '<div class="muted" style="font-size:11.5px">' + esc(deptLabel(s.dept, s.section)) +
        ' · ' + esc(stepTypeLabel(s.type, s.unit)) + '</div></div>' +
        '<select class="inp-sm" style="width:120px" data-stepdept="' + esc(s.id) + '">' +
        data.depts.map(function (d) {
          return '<option value="' + esc(d.id) + '"' + (d.id === s.dept ? " selected" : "") + '>' + esc(d.name) + '</option>';
        }).join("") + '</select>' +
        delBtn(S, s.id, "✕", "delstep") + '</div>';
    });
    h += '</div>';
  });
  return h + '</div></div>';
}
