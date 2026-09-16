// Roller, gördükleri ekranlar ve düzenleme kapsamları.
//
// Ekran gizlemek güvenlik değildir — asıl sınır firestore.rules dosyasındadır.
// Buradaki rol adları ile oradaki rol adları birebir aynı kalmalı.

export const ROLES = {
  yonetici: {
    label: "Yönetici",
    desc: "Her şeyi yönetir, giriş yetkisi verir",
    views: ["panel", "projeler", "proje", "projedisi", "isler", "yeni", "teklifler", "teklif", "teklif-ayar",
      "talepler", "kayitlar", "ayarlar"],
    scope: "hepsi"
  },
  satis: {
    label: "Satış",
    desc: "Teklif hazırlar, üretimdeki projeleri izler",
    views: ["teklifler", "teklif", "teklif-ayar", "projeler", "proje"],
    scope: "kendi"
  },
  planlamaci: {
    label: "Planlamacı",
    desc: "Proje açar, iş emirlerini dağıtır",
    views: ["panel", "projeler", "proje", "projedisi", "isler", "yeni", "kayitlar"],
    scope: "hepsi"
  },
  muhasebe: {
    label: "Muhasebe",
    desc: "Tüm projeleri izler; muhasebe bilgilerini ve Muhasebe iş emirlerini yürütür",
    views: ["panel", "projeler", "proje", "projedisi", "isler"],
    scope: "departman"
  },
  sef: {
    label: "Şef",
    desc: "Departmanının tüm bölümlerini görür ve yürütür",
    views: ["panel", "projeler", "proje", "projedisi", "isler"],
    scope: "departman"
  },
  personel: {
    label: "Personel",
    desc: "Bölümünün işlerini görür; kendine ya da bölümüne açılanı yapar",
    views: ["projeler", "proje", "projedisi", "isler"],
    scope: "bolum"
  }
};

// Yetkiden yetkisize doğru — yönetici ekranındaki sıralama budur.
export const ROLE_ORDER = ["yonetici", "planlamaci", "muhasebe", "satis", "sef", "personel"];

// Tüm projeleri ve iş emirlerini gören roller (karar 6). Şef yalnızca
// departmanını, personel yalnızca bölümünü görür; sınır firestore.rules'ta da var.
export const SEE_ALL_ROLES = ["yonetici", "planlamaci", "muhasebe", "satis"];

export const DEFAULT_ROLE = "personel";

// Proje açma, termin ve atama değiştirme yetkisi olan roller.
export const PLANNER_ROLES = ["yonetici", "planlamaci"];

// Teklif hazırlayan ve fiyatları görebilen roller.
export const SALES_ROLES = ["yonetici", "satis"];

// Proje muhasebe bilgilerini (tutar, ödeme, borç-alacak) gören ve yazan roller.
export const ACCOUNT_ROLES = ["yonetici", "muhasebe"];

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
