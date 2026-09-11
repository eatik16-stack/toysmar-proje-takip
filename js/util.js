// Ortak yardımcılar: kaçış, kimlik, tarih, adet ve bildirim.

export function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

export function byId(list, id) {
  for (var i = 0; i < (list || []).length; i++) if (list[i].id === id) return list[i];
  return null;
}

export function uid() {
  try {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  } catch (e) {}
  return "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
export function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

/* ---------- tarih ---------- */

export function todayISO() {
  var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
}

export function daysBetween(iso) {
  if (!iso) return null;
  var a = new Date(iso + "T00:00:00"), b = new Date(todayISO() + "T00:00:00");
  if (isNaN(a)) return null;
  return Math.round((a - b) / 86400000);
}

export function fmtDate(iso) {
  if (!iso) return "—";
  var d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  if (isNaN(d)) return "—";
  try { return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }); }
  catch (e) { return iso; }
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  var d = new Date(iso);
  if (isNaN(d)) return "—";
  try { return d.toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return iso; }
}

/* ---------- adet: gereken / yapılan ---------- */

export function numOf(v) {
  if (v === null || v === undefined || v === "") return 0;
  var n = parseFloat(String(v).replace(",", "."));
  return isFinite(n) ? n : 0;
}

export function needOf(t) { return t && t.type === "qty" ? numOf(t.qty) : 0; }

export function doneOf(t) {
  if (!t || t.type !== "qty") return 0;
  if (t.doneQty !== null && t.doneQty !== undefined && t.doneQty !== "") return numOf(t.doneQty);
  // Adet takibi eklenmeden önce tamamlanmış kayıtlar tam sayılır.
  return t.status === "tamam" ? numOf(t.qty) : 0;
}

export function shortOf(t) {
  var n = needOf(t); if (!n) return 0;
  var d = doneOf(t);
  return d >= n ? 0 : Math.round((n - d) * 1000) / 1000;
}

/* ---------- durum ---------- */

export function taskState(t) {
  if (t.status === "tamam") return "tamam";
  var d = daysBetween(t.dueDate);
  if (d !== null && d < 0) return "gecikti";
  if (t.status === "devam") return "devam";
  if (d !== null && d <= 3) return "yakin";
  return "bekliyor";
}

export function stateLabel(s) {
  return {
    tamam: "Tamamlandı", gecikti: "Gecikti", devam: "Devam ediyor",
    yakin: "Termine az", bekliyor: "Bekliyor"
  }[s] || s;
}

export function dotClass(t) {
  if (!t) return "dot-none";
  if (t.status === "tamam") return "dot-tamam";
  var d = daysBetween(t.dueDate);
  if (d !== null && d < 0) return "dot-gecikti";
  if (t.status === "devam") return "dot-devam";
  return "dot-bekliyor";
}

/* ---------- bildirim ---------- */

var toastTimer = null;
export function toast(msg, kind) {
  var t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = kind ? "toast-" + kind : "";
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.hidden = true; }, kind === "error" ? 5200 : 2900);
}
