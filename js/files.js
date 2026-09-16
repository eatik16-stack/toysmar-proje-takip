// Proje dosyaları: iş emrine bağlı yüklemeler (Findeks raporu, 3D görsel,
// sözleşme, montaj fotoğrafları…).
//
// Dosyanın kendisi Firebase Storage'da (projeler/{proje}/{isEmri}/{id}-{ad}),
// kaydı Firestore "files" koleksiyonunda durur. Dosya silinmez; "arşive alındı"
// işareti alır. Görseller yüklenmeden önce tarayıcıda 1600 px'e küçültülür.

import { fb, fbStorage } from "./fb.js";
import { data, writeLog } from "./store.js";
import { myEmail, myName } from "./auth.js";
import { uid } from "./util.js";

export const ALLOWED_EXT = ["jpg", "jpeg", "png", "pdf", "dwg", "dxf", "skp"];
export const MAX_BYTES = 20 * 1024 * 1024;
const IMAGE_MAX_SIDE = 1600;

export function fileExt(name) {
  const m = /\.([A-Za-z0-9]+)$/.exec(String(name || ""));
  return m ? m[1].toLowerCase() : "";
}

// İş emrinin arşivlenmemiş dosyaları.
export function filesOf(taskId) {
  return data.files.filter(function (f) { return f.taskId === taskId && !f.archived; });
}

export function projectFiles(pid, includeArchived) {
  return data.files.filter(function (f) { return f.projectId === pid && (includeArchived || !f.archived); })
    .sort(function (a, b) { return String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")); });
}

export function fmtSize(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
  return (Math.round(n / 1024 / 1024 * 10) / 10) + " MB";
}

// Montaj fotoğrafları telefondan 4-8 MB geliyor; en uzun kenar 1600 px'e indirilir.
export function resizeImage(file, maxSide) {
  maxSide = maxSide || IMAGE_MAX_SIDE;
  return new Promise(function (resolve) {
    if (!/^image\/(jpeg|png)$/.test(file.type)) { resolve(file); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h || Math.max(w, h) <= maxSide) { resolve(file); return; }
      const k = maxSide / Math.max(w, h);
      const c = document.createElement("canvas");
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function (blob) { resolve(blob || file); }, file.type === "image/png" ? "image/png" : "image/jpeg", 0.86);
    };
    img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export function checkFile(file) {
  const ext = fileExt(file.name);
  if (ALLOWED_EXT.indexOf(ext) === -1) return "Bu dosya türü kabul edilmiyor. İzin verilen: " + ALLOWED_EXT.join(", ") + ".";
  if (file.size > MAX_BYTES) return "Dosya 20 MB'tan büyük.";
  return "";
}

// Storage kapalıysa ya da kurallar reddettiyse anlaşılır mesaj.
export function storageHint(e) {
  const code = (e && e.code) || "";
  const msg = (e && e.message) || "";
  if (/unauthorized|permission/i.test(code + msg)) return "Depolama izni yok: Firebase Storage kuralları (storage.rules) yayınlanmamış olabilir.";
  if (/retry-limit|unknown|project-not-found|bucket-not-found|network|quota|not enabled|404/i.test(code + msg) || !code) {
    return "Depolama açık değil ya da ulaşılamıyor. Firebase projesinde Storage'ın açık olması (Blaze planı) gerekir.";
  }
  return "Dosya yüklenemedi: " + (msg || code);
}

export async function uploadTaskFile(task, file) {
  const problem = checkFile(file);
  if (problem) throw new Error(problem);
  const blob = await resizeImage(file);
  const id = uid();
  const safe = String(file.name).replace(/[^\w.\-çğıöşüÇĞİÖŞÜ ]+/g, "_");
  const path = "projeler/" + (task.projectId || "projedisi") + "/" + task.id + "/" + id + "-" + safe;
  const st = await fbStorage();
  const r = st.ref(path);
  await st.uploadBytes(r, blob, { contentType: file.type || "application/octet-stream" });
  const url = await st.getDownloadURL(r);
  const f = await fb();
  const body = {
    projectId: task.projectId || "", taskId: task.id, taskName: task.name || "",
    name: file.name, type: file.type || "", size: blob.size || file.size || 0,
    path: path, url: url,
    dept: task.dept || "", section: task.section || "",
    uploadedBy: myEmail(), uploadedByName: myName(), uploadedAt: new Date().toISOString(),
    archived: false
  };
  await f.setDoc(f.doc(f.db, "files", id), body);
  writeLog("dosya", task.id, "“" + task.name + "” için dosya yüklendi: " + file.name + " (" + fmtSize(body.size) + ")");
  return id;
}

// Dosya silinmez; arşive alınır (listeden düşer, kayıt ve dosya durur).
export async function archiveFile(id, on) {
  const f = await fb();
  const rec = data.files.filter(function (x) { return x.id === id; })[0];
  await f.updateDoc(f.doc(f.db, "files", id), {
    archived: !!on, archivedAt: on ? new Date().toISOString() : "", archivedBy: on ? myEmail() : ""
  });
  writeLog("dosya", (rec && rec.taskId) || id, (on ? "dosya arşive alındı: " : "dosya arşivden çıkarıldı: ") + ((rec && rec.name) || id));
}
