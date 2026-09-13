// Roller, gördükleri ekranlar ve düzenleme kapsamları.
//
// Ekran gizlemek güvenlik değildir — asıl sınır firestore.rules dosyasındadır.
// Buradaki rol adları ile oradaki rol adları birebir aynı kalmalı.

export const ROLES = {
  yonetici: {
    label: "Yönetici",
    desc: "Her şeyi yönetir, giriş yetkisi verir",
    views: ["panel", "projeler", "proje", "isler", "yeni", "talepler", "kayitlar", "ayarlar"],
    scope: "hepsi"
  },
  planlamaci: {
    label: "Planlamacı",
    desc: "Proje açar, iş emirlerini dağıtır",
    views: ["panel", "projeler", "proje", "isler", "yeni", "kayitlar"],
    scope: "hepsi"
  },
  sef: {
    label: "Şef",
    desc: "Departmanının işlerini yürütür",
    views: ["panel", "projeler", "proje", "isler"],
    scope: "departman"
  },
  personel: {
    label: "Personel",
    desc: "Kendine atanan işleri yapar",
    views: ["projeler", "proje", "isler"],
    scope: "kendi"
  }
};

// Yetkiden yetkisize doğru — yönetici ekranındaki sıralama budur.
export const ROLE_ORDER = ["yonetici", "planlamaci", "sef", "personel"];

export const DEFAULT_ROLE = "personel";

// Proje açma, termin ve atama değiştirme yetkisi olan roller.
export const PLANNER_ROLES = ["yonetici", "planlamaci"];

export function roleDef(role) {
  return ROLES[role] || ROLES[DEFAULT_ROLE];
}

export function roleLabel(role) {
  return roleDef(role).label;
}

export function roleViews(role) {
  return roleDef(role).views;
}

export function roleSees(role, view) {
  return roleViews(role).indexOf(view) !== -1;
}
