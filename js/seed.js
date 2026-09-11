// İlk kurulumda yüklenen varsayılan katalog.
// Kaynak: "Proje Takip Mevcut.xlsx" — C:AL arası 36 sütun.
//   2 sütun projenin kimliği oldu (Panel Sayısı, Tema)
//   3 sütun her adımda bulunan alana dönüştü (Sipariş Durumu ×2, Tuz Termin)
//   31 sütun iş adımı oldu; bunlara Sevkiyat ve Yerinde Montaj eklendi → 33 adım.

export const DEFAULT_GROUPS = [
  { id: "uretim",   label: "Üretim Prosesi",    order: 1 },
  { id: "malzeme",  label: "Malzeme & Sarf",    order: 2 },
  { id: "urun",     label: "Ürün & Alt Montaj", order: 3 },
  { id: "kaydirak", label: "Kaydıraklar",       order: 4 },
  { id: "sevkiyat", label: "Sevkiyat & Montaj", order: 5 }
];

export const DEFAULT_DEPTS = [
  { id: "d-cizim",     name: "Çizim / Tasarım" },
  { id: "d-metal",     name: "Metal" },
  { id: "d-kaplama",   name: "Kaplama" },
  { id: "d-mdf",       name: "MDF" },
  { id: "d-montaj",    name: "Montaj" },
  { id: "d-satinalma", name: "Satın Alma" },
  { id: "d-sevkiyat",  name: "Sevkiyat" }
];

function s(id, name, group, dept, type, unit, order) {
  return { id: id, name: name, group: group, dept: dept, type: type, unit: unit || "", order: order };
}

export const DEFAULT_STEPS = [
  s("s-cizim",            "Çizim",                  "uretim",   "d-cizim",     "check", "",      1),
  s("s-metal",            "Metal",                  "uretim",   "d-metal",     "check", "",      2),
  s("s-kaplama",          "Kaplama",                "uretim",   "d-kaplama",   "check", "",      3),
  s("s-mdf",              "MDF",                    "uretim",   "d-mdf",       "check", "",      4),
  s("s-icerik",           "İçerik ve Kutu",         "uretim",   "d-montaj",    "check", "",      5),

  s("s-tatami",           "Tatami",                 "malzeme",  "d-kaplama",   "qty",   "adet",  6),
  s("s-top",              "Top",                    "malzeme",  "d-satinalma", "qty",   "koli",  7),
  s("s-kum",              "Kum",                    "malzeme",  "d-satinalma", "qty",   "ton",   8),
  s("s-tuz",              "Tuz",                    "malzeme",  "d-satinalma", "qty",   "ton",   9),

  s("s-palmiye",          "Palmiye",                "urun",     "d-montaj",    "qty",   "adet", 10),
  s("s-donerge",          "Dönerge",                "urun",     "d-montaj",    "qty",   "adet", 11),
  s("s-piyano",           "Piyano",                 "urun",     "d-montaj",    "qty",   "adet", 12),
  s("s-topufleme",        "Top Üfleme",             "urun",     "d-montaj",    "qty",   "adet", 13),
  s("s-topatma",          "Top Atma",               "urun",     "d-montaj",    "qty",   "adet", 14),
  s("s-ufo",              "UFO",                    "urun",     "d-montaj",    "qty",   "adet", 15),
  s("s-fiskiye",          "Top Fıskiyesi",          "urun",     "d-montaj",    "qty",   "adet", 16),
  s("s-selale",           "Top Şelalesi",           "urun",     "d-montaj",    "qty",   "adet", 17),
  s("s-sunger",           "Sünger Engel",           "urun",     "d-kaplama",   "qty",   "adet", 18),
  s("s-sallanan",         "Sallanan Oyuncak",       "urun",     "d-satinalma", "qty",   "adet", 19),
  s("s-tirtil",           "Plastik Tırtıl",         "urun",     "d-satinalma", "qty",   "adet", 20),
  s("s-tasev",            "Plastik Taş Ev",         "urun",     "d-satinalma", "qty",   "adet", 21),
  s("s-aktivite",         "Aktivite Masa",          "urun",     "d-satinalma", "qty",   "adet", 22),
  s("s-ayakkabilik",      "Ayakkabılık",            "urun",     "d-satinalma", "qty",   "adet", 23),
  s("s-pota",             "Plastik Pota",           "urun",     "d-satinalma", "qty",   "adet", 24),
  s("s-tirmanma",         "6 Gen Tırmanma Kulesi",  "urun",     "d-metal",     "qty",   "adet", 25),

  s("s-kulespiral",       "Kule Spiral Kaydırak",   "kaydirak", "d-satinalma", "qty",   "adet", 26),
  s("s-acikspiral",       "Açık Spiral Kaydırak",   "kaydirak", "d-satinalma", "qty",   "adet", 27),
  s("s-duztup",           "Düz Tüp Kaydırak",       "kaydirak", "d-satinalma", "qty",   "adet", 28),
  s("s-plastikkaydirak",  "Plastik Kaydırak",       "kaydirak", "d-satinalma", "qty",   "adet", 29),
  s("s-halikaydirak",     "Halı Kaydırak",          "kaydirak", "d-satinalma", "qty",   "adet", 30),
  s("s-hunikaydirak",     "Huni Kaydırak Işıklı",   "kaydirak", "d-satinalma", "qty",   "adet", 31),

  s("s-sevkiyat",         "Sevkiyat",               "sevkiyat", "d-sevkiyat",  "check", "",     32),
  s("s-montaj",           "Yerinde Montaj",         "sevkiyat", "d-sevkiyat",  "check", "",     33)
];
