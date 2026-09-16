// Kilitler (karar 4, 6a): "Malzemeler geldi" tüm satın alma kalemleri gelmeden,
// "Sevkiyat tamamlandı" üretim + satın alma + depo + kalite bitmeden,
// "Montaj tamamlandı" sevkiyat bitmeden kapanmaz. Muhasebe adımları (Findeks,
// sipariş onayı, ödeme) kilide dahil değildir: ödeme montajda ya da aylar sonra
// alınabilir. Yönetici kilidi aşabilir; aşım iş emrinde etiketlenir ve günlüğe yazılır.
//
// Şef ve personel diğer departmanların iş emirlerini okuyamaz (görünürlük);
// kilidi yine de değerlendirebilsin diye her iş emri yazımı locks/{proje}
// belgesine küçük bir özet bırakır (store.js lockEntry). Görünen iş emirleri
// özetten daha tazedir, önce onlar alınır.

import { data, projTasks, sectionName } from "./store.js";
import { canonicalStepId, orderStatusLabel } from "./seed.js";
import { needOf, doneOf } from "./util.js";

// Satın alma kalemi: katalogdaki "sa-" adımları ya da satın alma grubundaki iş emri.
export function isPurchase(t) {
  return !!t && (t.group === "satinalma" || /^sa-/.test(canonicalStepId(t.stepId || "")));
}

// Kalem geldi sayılır: sipariş durumu "geldi" ya da iş emri (eksik kapatma dahil) tamamlanmış.
export function purchaseArrived(t) {
  return t.orderStatus === "geldi" || t.status === "tamam";
}

// Projedeki iş emirleri: görünenler + kilit özetindeki (görünmeyen) kayıtlar.
function projectEntries(pid) {
  const map = {};
  const doc = data.locks[pid];
  if (doc && doc.items) {
    Object.keys(doc.items).forEach(function (k) {
      const e = doc.items[k];
      if (e && e.status) map[k] = Object.assign({ id: k }, e);
    });
  }
  projTasks(pid).forEach(function (x) { map[x.id] = x; });
  return Object.keys(map).map(function (k) { return map[k]; });
}

// Ekranda listelenen bekleyen koşul: "Kaplama — Panel sayısı 30/35",
// "Işıklı kaydırak 150: sipariş verildi (0/2)".
function pendingLabel(t) {
  const need = needOf(t), made = doneOf(t);
  const cnt = need ? made + "/" + need : "";
  if (isPurchase(t)) {
    return t.name + ": " + (orderStatusLabel(t.orderStatus) || "Bekliyor").toLocaleLowerCase("tr-TR") + (cnt ? " (" + cnt + ")" : "");
  }
  const sn = sectionName(t.dept, t.section);
  return (sn ? sn + " — " : "") + t.name + (cnt ? " " + cnt : "");
}

const DEPO_KALITE = { "dp-koli": true, "dp-yukleme-listesi": true, "k-kontrol": true };

// Kapanmadan önce bekleyen koşullar; boş dizi = kilit yok.
export function lockReasons(t) {
  if (!t || !t.projectId) return [];
  const id = canonicalStepId(t.stepId || "");
  if (id !== "dp-malzeme" && id !== "sv-tamam" && id !== "mo-tamam") return [];
  const others = projectEntries(t.projectId).filter(function (x) { return x.id !== t.id; });
  const open = function (x) { return x.status !== "tamam"; };
  const out = [];
  if (id === "sv-tamam") {
    others.filter(function (x) { return x.dept === "d-uretim" && open(x); }).forEach(function (x) { out.push(pendingLabel(x)); });
  }
  if (id === "dp-malzeme" || id === "sv-tamam") {
    others.filter(function (x) { return isPurchase(x) && !purchaseArrived(x); }).forEach(function (x) { out.push(pendingLabel(x)); });
  }
  if (id === "sv-tamam") {
    others.filter(function (x) { return DEPO_KALITE[canonicalStepId(x.stepId || "")] && open(x); }).forEach(function (x) { out.push(pendingLabel(x)); });
  }
  if (id === "mo-tamam") {
    others.filter(function (x) { return canonicalStepId(x.stepId || "") === "sv-tamam" && open(x); }).forEach(function (x) { out.push(pendingLabel(x)); });
  }
  return out;
}

// Panel sayacı: verilen iş emirleri içinde gelmemiş satın alma kalemleri.
export function missingMaterials(tasks) {
  return tasks.filter(function (t) { return isPurchase(t) && !purchaseArrived(t); });
}
