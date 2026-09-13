// Ekran çizimleri. Her fonksiyon HTML metni döndürür; olaylar app.js'te.

import {
  esc, byId, fmtDate, fmtDateTime, todayISO, daysBetween,
  needOf, doneOf, shortOf, taskState, stateLabel, dotClass
} from "./util.js";
import {
  data, projTasks, progress, activeProjects, deptName, personName, mePerson,
  canEditTask, pendingRequests
} from "./store.js";
import { session, isAdmin, canPlan, canSee, myRole, myName, myEmail } from "./auth.js";
import { ROLE_ORDER, roleDef, roleLabel } from "./roles.js";

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
  h += '<div class="c-name"><div class="tn">' + esc(t.name) + '</div>';
  const sub = [];
  if (t.spec) sub.push(esc(t.spec));
  if (t.orderStatus) sub.push('<span class="tag">' + esc(t.orderStatus) + '</span>');
  if (t.shortClosed) sub.push('<span class="tag tag-warn">eksik kapatıldı ' + made + '/' + need + '</span>');
  else if (!done && short > 0 && made > 0)
    sub.push('<span class="tag tag-warn">' + made + '/' + need + ' — ' + short + ' ' + esc(t.unit || "adet") + ' eksik</span>');
  if (done && t.completedAt)
    sub.push("✓ " + fmtDate(String(t.completedAt).slice(0, 10)) + (t.completedByName ? " · " + esc(t.completedByName) : ""));
  if (sub.length) h += '<div class="tspec">' + sub.join(" · ") + '</div>';
  h += '</div>';

  h += '<div>' + (t.type === "qty" ? qtyCell(t, plan, mine, need, made) : '<span class="muted">—</span>') + '</div>';

  h += '<div>' + selectEl("dept", t.dept, data.depts.map(function (d) { return { v: d.id, l: d.name }; }), !plan) + '</div>';
  h += '<div>' + selectEl("assignee", t.assignee,
    data.people.filter(function (x) { return !t.dept || x.dept === t.dept; })
      .map(function (x) { return { v: x.id, l: x.name }; }), !plan, "Atanmadı") + '</div>';
  h += '<div><input class="inp-sm inp-date" type="date" value="' + esc(t.dueDate || "") +
    '" data-f="dueDate" aria-label="Termin"' + (plan ? "" : " disabled") + '></div>';

  const canToggle = plan || mine;
  h += '<div class="c-act">';
  if (!canToggle) h += '<span class="st st-' + st + '">' + esc(stateLabel(st)) + '</span>';
  else if (done) h += '<button class="btn btn-sm" data-toggle="' + esc(t.id) + '">Geri al</button>';
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
  const items = [
    { id: "panel", ico: "◧", label: "Panel" },
    { id: "projeler", ico: "▦", label: "Projeler", count: activeProjects().length },
    { id: "isler", ico: "✓", label: "İşlerim", count: mineOpen || null },
    { id: "yeni", ico: "＋", label: "Yeni Proje" },
    { id: "talepler", ico: "◎", label: "Talepler", count: pendingRequests().length || null },
    { id: "kayitlar", ico: "≡", label: "Kayıtlar" },
    { id: "ayarlar", ico: "⚙", label: "Ayarlar" }
  ];
  return items.filter(function (i) { return canSee(i.id); });
}

export function navHtml(S) {
  return navItems(S).map(function (i) {
    return '<button data-nav="' + i.id + '" aria-current="' + (S.view === i.id) + '">' +
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
    '<div class="rl">' + esc(role + (p && p.dept ? " · " + deptName(p.dept) : "")) + '</div></div>' +
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
    '<p style="max-width:64ch; margin:0 0 14px">Excel’deki 36 sütundan türetilmiş <strong>33 adımlık katalog</strong>, ' +
    '5 grup ve 7 varsayılan departman yüklenecek. Kendinizi de personel listesine ekleyeceğim. ' +
    'Sonrasında hepsini Ayarlar’dan değiştirebilirsiniz.</p>' +
    '<button class="btn btn-pri" data-doseed="1">Kataloğu yükle ve başla</button>' +
    '</div></div>';
}

/* ================= panel ================= */

export function viewPanel(S) {
  const active = activeProjects();
  const activeIds = {};
  active.forEach(function (p) { activeIds[p.id] = true; });
  const open = data.tasks.filter(function (t) { return t.status !== "tamam" && activeIds[t.projectId]; });
  const late = open.filter(function (t) { const d = daysBetween(t.dueDate); return d !== null && d < 0; });
  const soon = open.filter(function (t) { const d = daysBetween(t.dueDate); return d !== null && d >= 0 && d <= 7; });
  const allT = data.tasks.filter(function (t) { return activeIds[t.projectId]; });

  let h = '<div class="page-head"><div><h1>Panel</h1><div class="sub">' +
    fmtDate(todayISO()) + ' · üretim planlama durumu</div></div>' +
    '<button class="btn btn-pri" data-nav="yeni">Yeni proje aç</button></div>';

  h += '<div class="kpis">' +
    kpi(active.length, "Aktif proje", data.projects.length + " proje kayıtlı", "") +
    kpi(open.length, "Açık iş emri", allT.length + " iş emrinin " + (allT.length - open.length) + " tanesi bitti", "") +
    kpi(late.length, "Geciken iş", late.length ? "Termini geçti" : "Gecikme yok", late.length ? "alert" : "") +
    kpi(soon.length, "7 gün içinde", "Termini yaklaşan iş", soon.length ? "warn" : "") + '</div>';

  const att = late.concat(soon).sort(function (a, b) {
    return String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999"));
  }).slice(0, 9);

  h += '<div class="grid2"><div class="panel"><div class="panel-head"><h2>Dikkat gerektiren işler</h2>' +
    '<span class="muted mono">' + att.length + '/' + (late.length + soon.length) + '</span></div>';
  if (!att.length) {
    h += '<div class="empty"><h3>Geciken iş yok</h3><p>Tüm açık iş emirleri terminin gerisinde değil.</p></div>';
  } else {
    h += '<div class="tw"><table><thead><tr><th>İş</th><th>Proje</th><th>Sorumlu</th><th>Termin</th><th>Durum</th></tr></thead><tbody>';
    att.forEach(function (t) {
      const p = byId(data.projects, t.projectId), st = taskState(t), d = daysBetween(t.dueDate);
      h += '<tr class="click" data-open-proj="' + esc(t.projectId) + '">' +
        '<td class="t-name">' + esc(t.name) + '</td>' +
        '<td class="muted">' + esc(p ? p.name : "—") + '</td>' +
        '<td>' + esc(personName(t.assignee) || "Atanmadı") + '</td>' +
        '<td class="mono">' + fmtDate(t.dueDate) + '<span class="muted"> (' +
          (d < 0 ? Math.abs(d) + " gün geç" : d + " gün") + ')</span></td>' +
        '<td><span class="st st-' + st + '">' + esc(stateLabel(st)) + '</span></td></tr>';
    });
    h += '</tbody></table></div>';
  }
  h += '</div>';

  const load = data.depts.map(function (d) {
    const o = open.filter(function (t) { return t.dept === d.id; });
    const l = o.filter(function (t) { const x = daysBetween(t.dueDate); return x !== null && x < 0; }).length;
    return { name: d.name, open: o.length, late: l };
  }).sort(function (a, b) { return b.open - a.open; });
  const max = Math.max.apply(null, [1].concat(load.map(function (x) { return x.open; })));

  h += '<div class="panel"><div class="panel-head"><h2>Departman yükü</h2>' +
    '<span class="muted" style="font-size:12px">açık iş emri</span></div><div class="panel-body">';
  load.forEach(function (x) {
    h += '<div class="bar-row"><div style="font-size:12.5px">' + esc(x.name) + '</div>' +
      '<div class="bar-track"><div class="bar-fill' + (x.late ? " is-late" : "") + '" style="width:' +
      Math.round(x.open / max * 100) + '%"></div></div><div class="bar-val">' + x.open + '</div></div>';
  });
  h += '<div class="legend" style="margin-top:10px"><span class="li"><span class="dot dot-devam"></span>açık</span>' +
    '<span class="li"><span class="dot dot-gecikti"></span>gecikmiş iş içeriyor</span></div></div></div></div>';

  h += '<div class="panel"><div class="panel-head"><h2>Proje ilerlemesi</h2>' +
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
  return h;
}

/* ================= projeler ================= */

export function viewProjects(S) {
  const list = S.showArchived ? data.projects.slice() : activeProjects();
  const archCount = data.projects.filter(function (p) { return p.archived; }).length;

  let h = '<div class="page-head"><div><h1>Projeler</h1><div class="sub">' +
    activeProjects().length + ' aktif · ' + archCount + ' arşivde · ' + data.tasks.length + ' iş emri</div></div>' +
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
    '<th>Proje</th><th>Müşteri</th><th>Panel</th><th>Tema</th><th>Teslim</th><th>İlerleme</th><th>Adım</th>' +
    (canPlan() ? '<th></th>' : '') + '</tr></thead><tbody>';
  list.sort(function (a, b) {
    return String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999"));
  }).forEach(function (p) {
    const pr = progress(p.id), d = daysBetween(p.dueDate);
    h += '<tr class="click' + (p.archived ? " is-arch" : "") + '" data-open-proj="' + esc(p.id) + '">' +
      '<td class="t-name">' + esc(p.name) +
        (p.archived ? ' <span class="tag tag-arch">arşiv</span>' : '') +
        (p.status === "tamam" ? ' <span class="st st-tamam">Bitti</span>' : '') + '</td>' +
      '<td class="muted">' + esc(String(p.customer || "—").slice(0, 40)) + '</td>' +
      '<td class="mono">' + (p.panelCount || "—") + '</td>' +
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
  data.tasks.forEach(function (t) { used[t.stepId] = true; });
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
    projTasks(p.id).forEach(function (t) { map[t.stepId] = t; });
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

  let h = '<div class="page-head"><div>' +
    '<button class="btn btn-sm btn-ghost" data-nav="projeler" style="margin-bottom:6px">← Projeler</button>' +
    '<h1>' + esc(p.name) + (p.archived ? ' <span class="tag tag-arch">arşiv</span>' : '') + '</h1>' +
    '<div class="sub">' + esc(p.customer || "Müşteri bilgisi girilmemiş") + '</div></div>' +
    '<div class="row-actions">' +
    (plan ? '<button class="btn btn-sm" data-edit-proj="1">Proje bilgileri</button>' : '') +
    (plan ? '<button class="btn btn-sm" data-add-steps="1">Adım ekle</button>' : '') +
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
    meta("Tema", p.theme) + meta("Panel sayısı", p.panelCount) + meta("Telefon", p.phone) +
    meta("Başlangıç", fmtDate(p.startDate)) + meta("Teslim", fmtDate(p.dueDate)) +
    meta("Adres", p.address) + '</div></div>';

  h += '<div class="panel"><div class="panel-head"><h2>İş emirleri</h2>' +
    '<span class="muted"><span class="mono">' + ts.length + '</span> adım</span></div>';
  if (!ts.length) {
    h += '<div class="empty"><h3>Adım seçilmemiş</h3><p>“Adım ekle” ile projenin kapsamını belirleyin.</p></div>';
  } else {
    h += '<div class="thead-row"><span class="c-name">Adım</span><span>Gereken / Yapılan</span>' +
      '<span>Departman</span><span>Sorumlu</span><span>Termin</span><span>Durum</span></div>';
    let prevG = null;
    ts.forEach(function (t) {
      if (t.group !== prevG) {
        const g = byId(data.groups, t.group);
        const cnt = ts.filter(function (x) { return x.group === t.group; }).length;
        h += '<div class="gband"><span>' + esc(g ? g.label : t.group) + '</span><span class="n">' + cnt + '</span></div>';
        prevG = t.group;
      }
      h += taskRow(t);
    });
  }
  return h + '</div>';
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
        (short > 0 && made > 0 ? ' <span class="tag tag-warn">' + made + '/' + need + ' — ' + short + ' eksik</span>' : '') + '</td>' +
        '<td class="muted click" data-open-proj="' + esc(t.projectId) + '">' + esc(pj ? pj.name : "—") + '</td>' +
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
      h += '<tr><td>' + esc(t.name) + '</td><td class="muted">' + esc(pj ? pj.name : "—") + '</td>' +
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

  if (w.step === 1) {
    return h + '<div class="panel"><div class="panel-head"><h2>1 · Proje bilgileri</h2></div><div class="panel-body">' +
      '<div class="form">' +
      fld("name", "Proje adı", w.p.name, "text", "örn. Ahmetli Belediyesi", true) +
      fld("theme", "Tema", w.p.theme, "text", "ORMAN / SOFT / DENİZ") +
      fld("customer", "Müşteri / teslimat yetkilisi", w.p.customer, "text", "") +
      fld("phone", "Telefon", w.p.phone, "text", "0500 000 00 00") +
      fld("panelCount", "Panel sayısı", w.p.panelCount, "number", "") +
      fld("startDate", "Başlangıç", w.p.startDate, "date", "") +
      fld("dueDate", "Teslim tarihi", w.p.dueDate, "date", "") +
      '<div class="f full"><label for="w-address">Teslimat adresi</label>' +
      '<textarea id="w-address" data-w="address" placeholder="Mahalle, cadde, no, ilçe/il">' + esc(w.p.address) + '</textarea></div>' +
      '</div></div><div class="modal-foot">' +
      '<button class="btn btn-pri" data-wnext="2">İçerik seçimine geç →</button></div></div>';
  }

  if (w.step === 2) {
    h += '<div class="panel"><div class="panel-head"><h2>2 · Proje içeriği</h2>' +
      '<span class="muted"><span class="mono">' + selCount + ' / ' + data.steps.length + '</span> adım seçildi</span></div><div class="panel-body">';
    h += '<p class="muted" style="margin:0 0 14px; max-width:64ch">Excel’de ✓ / X ile işaretlediğiniz alanlar. ' +
      'Seçtiğiniz her adım, bir sonraki ekranda iş emrine dönüşür.</p>';
    data.groups.forEach(function (g) {
      const items = data.steps.filter(function (s) { return s.group === g.id; });
      if (!items.length) return;
      const on = items.filter(function (s) { return w.sel[s.id]; }).length;
      h += '<div class="gwrap"><div class="gtitle"><h3>' + esc(g.label) + '</h3>' +
        '<span class="c">' + on + '/' + items.length + '</span>' +
        '<button class="btn btn-sm btn-ghost" style="margin-left:auto" data-gall="' + esc(g.id) + '">' +
        (on === items.length ? "Hiçbiri" : "Tümü") + '</button></div><div class="chips">';
      items.forEach(function (s) {
        const on2 = !!w.sel[s.id];
        h += '<button type="button" class="chip' + (on2 ? " on" : "") + '" data-pick="' + esc(s.id) + '">' +
          '<span class="box" aria-hidden="true">' + (on2 ? "✓" : "") + '</span>' +
          '<span><span class="nm">' + esc(s.name) + '</span>' +
          '<span class="dp">' + esc(deptName(s.dept)) + (s.type === "qty" ? " · adet girilir" : "") + '</span></span></button>';
      });
      h += '</div></div>';
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
      '<div>' + selectW("dept", v.dept, data.depts.map(function (d) { return { v: d.id, l: d.name }; })) + '</div>' +
      '<div>' + selectW("assignee", v.assignee,
        data.people.filter(function (x) { return !v.dept || x.dept === v.dept; })
          .map(function (x) { return { v: x.id, l: x.name }; }), "Atanmadı") + '</div>' +
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
      '<td class="muted">' + esc(d.views.filter(function (v) { return v !== "proje"; })
        .map(function (v) { return VIEW_LABEL[v] || v; }).join(", ")) + '</td>' +
      '<td class="muted">' + esc(SCOPE[d.scope] || d.scope) + '</td></tr>';
  });
  h += '</tbody></table></div></div></div>';

  return h;
}

const VIEW_LABEL = {
  panel: "Panel", projeler: "Projeler", isler: "İşlerim", yeni: "Yeni Proje",
  talepler: "Talepler", kayitlar: "Kayıtlar", ayarlar: "Ayarlar"
};

export function viewSettings(S) {
  let h = '<div class="page-head"><div><h1>Ayarlar</h1>' +
    '<div class="sub">Personel, giriş yetkileri, departmanlar ve adım kataloğu</div></div></div>';

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
      '<div class="muted" style="font-size:11.5px">' + esc(deptName(p.dept)) + ' · ' + open + ' açık iş' +
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
    h += '<div class="list-line"><div class="g"><div style="font-weight:600; font-size:13px">' + esc(d.name) + '</div>' +
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
        '<div class="muted" style="font-size:11.5px">' + esc(deptName(s.dept)) +
        (s.type === "qty" ? ' · ' + esc(s.unit || "adet") : ' · tamamlandı işareti') + '</div></div>' +
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
