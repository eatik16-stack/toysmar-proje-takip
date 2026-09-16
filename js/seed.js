// Adım kataloğu (sürüm 2) — Toysmar'ın gerçek süreç adımları.
// Kaynak: "TOYSMAR PROJE ADIMLARI (EMRENİN DÜŞÜNCESİ).xlsx" ve 16.09.2026 kararları
// (tools/GOREV-toysmar-adimlari.md, tools/toysmar-adim-katalogu.json).
//
// Dokuz departman; Üretim Planlama dört bölüme (Metal, Kaplama, MDF, Dikiş)
// ayrılır. Her grup bir departmana karşılık gelir; ekranlar adımları
// departman → bölüm başlıklarıyla gösterir.

export const CATALOG_VERSION = 2;

export const DEFAULT_DEPTS = [
  { id: "d-muhasebe",  name: "Muhasebe" },
  { id: "d-satis",     name: "Satış Pazarlama" },
  { id: "d-tasarim",   name: "Tasarım" },
  { id: "d-uretim",    name: "Üretim Planlama" },
  { id: "d-satinalma", name: "Satın Alma" },
  { id: "d-depo",      name: "Depo" },
  { id: "d-kalite",    name: "Kalite" },
  { id: "d-sevkiyat",  name: "Sevkiyat" },
  { id: "d-montaj",    name: "Montaj" }
];

// Departman altındaki bölümler. İş emri hem departmana hem bölüme bağlıdır;
// personel kaydındaki "section" alanı İşlerim ekranını ve görünürlüğü süzer.
export const DEFAULT_SECTIONS = {
  "d-uretim": [
    { id: "metal",   name: "Metal" },
    { id: "kaplama", name: "Kaplama" },
    { id: "mdf",     name: "MDF" },
    { id: "dikis",   name: "Dikiş" }
  ]
};

export const DEFAULT_GROUPS = [
  { id: "muhasebe",  label: "Muhasebe",         dept: "d-muhasebe",  order: 1 },
  { id: "satis",     label: "Satış Pazarlama",  dept: "d-satis",     order: 2 },
  { id: "tasarim",   label: "Tasarım",          dept: "d-tasarim",   order: 3 },
  { id: "uretim",    label: "Üretim Planlama",  dept: "d-uretim",    order: 4 },
  { id: "satinalma", label: "Satın Alma",       dept: "d-satinalma", order: 5 },
  { id: "depo",      label: "Depo",             dept: "d-depo",      order: 6 },
  { id: "kalite",    label: "Kalite",           dept: "d-kalite",    order: 7 },
  { id: "sevkiyat",  label: "Sevkiyat",         dept: "d-sevkiyat",  order: 8 },
  { id: "montaj",    label: "Montaj",           dept: "d-montaj",    order: 9 }
];

// Adım tipleri ve tamamlanma kuralı.
//   check: Tamamla düğmesi
//   qty:   yapılan ≥ gereken
//   file:  en az bir dosya yüklenmiş olmalı
//   text:  metin girilince tamamlanmış sayılır
// Her adıma isteğe bağlı dosya eklenebilir; yalnızca "file" tipinde zorunludur.
export const STEP_TYPES = [
  { v: "check", l: "Tamamlandı işareti" },
  { v: "qty",   l: "Adet girilir" },
  { v: "file",  l: "Dosya yüklenir" },
  { v: "text",  l: "Metin girilir" }
];

export function stepTypeLabel(type, unit) {
  if (type === "qty") return unit || "adet";
  const t = STEP_TYPES.filter(function (x) { return x.v === type; })[0];
  return t ? t.l.toLocaleLowerCase("tr-TR") : "tamamlandı işareti";
}

// Satın alma kalemlerinin sipariş durumu.
// "imalatta": Toysmar'ın kendi ürettiği kalemler (palmiye, dönerge).
export const ORDER_STATUS = [
  { v: "bekliyor",        l: "Bekliyor" },
  { v: "siparis-verildi", l: "Sipariş verildi" },
  { v: "imalatta",        l: "İmalatta" },
  { v: "geldi",           l: "Geldi" },
  { v: "eksik",           l: "Eksik" }
];

export function orderStatusLabel(v) {
  const o = ORDER_STATUS.filter(function (x) { return x.v === v; })[0];
  return o ? o.l : (v || "");
}

function s(id, name, group, dept, type, unit, order, section, note) {
  const o = { id: id, name: name, group: group, dept: dept, type: type, unit: unit || "", order: order };
  if (section) o.section = section;
  if (type === "file") o.requiresFile = true;
  if (note) o.note = note;
  return o;
}

function sa(id, name, unit, order) {
  return s(id, name, "satinalma", "d-satinalma", "qty", unit || "adet", order, "",
    "Adet + özellik (renk/model) + tedarikçi + sipariş durumu");
}

export const DEFAULT_STEPS = [
  s("m-findeks",        "Findeks raporu",                 "muhasebe", "d-muhasebe", "file",  "", 1, "", "Rapor proje dosyasına yüklenmeden tamamlanamaz"),
  s("m-siparis-onay",   "Sipariş onayı",                  "muhasebe", "d-muhasebe", "check", "", 2, "", "Onay alındıysa tamamla"),
  s("m-odeme-tamam",    "Ödemenin tamamı alındı",         "muhasebe", "d-muhasebe", "check", "", 3),

  s("sp-3d",            "3D çizim",                       "satis",    "d-satis",    "file",  "", 4, "", "3D görsel proje dosyasına yüklenir"),
  s("sp-sozlesme",      "Sözleşme görüntüsü",             "satis",    "d-satis",    "file",  "", 5),

  s("t-2d",             "2D çizim",                       "tasarim",  "d-tasarim",  "check", "", 6, "", "Yapıldı düğmesi yeterli; çizim dosyası eklemek isteğe bağlı"),

  s("u-metal-panel",    "Metal — panel sayısı",           "uretim",   "d-uretim",   "qty",   "adet", 7,  "metal",   "İstenen / tamamlanan iki ayrı adet"),
  s("u-metal-durum",    "Metal — mekanik imalat",         "uretim",   "d-uretim",   "check", "",     8,  "metal"),
  s("u-kaplama-panel",  "Kaplama — panel sayısı",         "uretim",   "d-uretim",   "qty",   "adet", 9,  "kaplama"),
  s("u-kaplama-durum",  "Kaplama — kaplama tamamlandı",   "uretim",   "d-uretim",   "check", "",     10, "kaplama"),
  s("u-mdf-adet",       "MDF — MDF sayısı",               "uretim",   "d-uretim",   "qty",   "adet", 11, "mdf"),
  s("u-mdf-durum",      "MDF — MDF siparişleri",          "uretim",   "d-uretim",   "check", "",     12, "mdf"),
  s("u-dikis-iscilik",  "Dikiş — dikim işçilik",          "uretim",   "d-uretim",   "check", "",     13, "dikis"),
  s("u-dikis-dijital",  "Dikiş — dijital siparişleri",    "uretim",   "d-uretim",   "check", "",     14, "dikis"),
  s("u-dikis-firma",    "Dikiş — dijital baskı firması",  "uretim",   "d-uretim",   "text",  "",     15, "dikis", "Tedarikçi adı yazılır"),
  s("u-stok",           "Stok kontrolleri yapıldı",       "uretim",   "d-uretim",   "check", "",     16),

  sa("sa-tatami",           "Tatami",                       "adet", 17),
  sa("sa-top",              "Top",                          "koli", 18),
  sa("sa-balik-palmiye",    "Balık palmiye",                "adet", 19),
  sa("sa-palmiye",          "Palmiye",                      "adet", 20),
  sa("sa-donerge",          "Dönerge",                      "adet", 21),
  sa("sa-piyano",           "Piyano",                       "adet", 22),
  sa("sa-top-ufleme",       "Top üfleme",                   "adet", 23),
  sa("sa-ziplavur",         "Zıplavur oyunu",               "adet", 24),
  sa("sa-hava-labirenti",   "Hava labirenti oyunu",         "adet", 25),
  sa("sa-atli-karinca",     "Atlı karınca",                 "adet", 26),
  sa("sa-top-atma",         "Top atma",                     "adet", 27),
  sa("sa-ufo",              "UFO",                          "adet", 28),
  sa("sa-top-fiskiyesi",    "Top fıskiyesi",                "adet", 29),
  sa("sa-top-selalesi",     "Top şelalesi",                 "adet", 30),
  sa("sa-air-hokey",        "Elektronik air hokey",         "adet", 31),
  sa("sa-langirt",          "Elektronik langırt",           "adet", 32),
  sa("sa-basket",           "Elektronik basket",            "adet", 33),
  sa("sa-sunger-engel",     "Sünger engel",                 "adet", 34),
  sa("sa-bingo-kaydirak",   "Bingo kaydırak",               "adet", 35),
  sa("sa-kule-spiral",      "Kule spiral kaydırak",         "adet", 36),
  sa("sa-acik-spiral",      "Açık spiral kaydırak",         "adet", 37),
  sa("sa-duz-tup",          "Düz tüp kaydırak",             "adet", 38),
  sa("sa-tup-gecis",        "Tüp geçiş",                    "adet", 39),
  sa("sa-plastik-kaydirak", "Plastik kaydırak",             "adet", 40),
  sa("sa-huni-kaydirak",    "Huni kaydırak",                "adet", 41),
  sa("sa-isikli-250",       "250'den kayan ışıklı model",   "adet", 42),
  sa("sa-isikli-150",       "150'den kayan ışıklı model",   "adet", 43),
  sa("sa-isikli-100",       "100'den kayan ışıklı model",   "adet", 44),
  sa("sa-kum",              "Kum",                          "ton",  45),
  sa("sa-tuz",              "Tuz",                          "ton",  46),
  sa("sa-kum-tuz-oyuncak",  "Kum-tuz oyuncak",              "adet", 47),
  sa("sa-mineflo",          "Zemin mineflo",                "m²",   48),
  sa("sa-sallanan",         "Sallanan oyuncak",             "adet", 49),
  sa("sa-tirtil",           "Plastik tırtıl",               "adet", 50),
  sa("sa-tas-ev",           "Plastik taş ev",               "adet", 51),
  sa("sa-aktivite-masa",    "Aktivite masa",                "adet", 52),
  sa("sa-ayakkabilik",      "Ayakkabılık",                  "adet", 53),
  sa("sa-isikli-kasa",      "Işıklı kasa",                  "adet", 54),
  sa("sa-izleme-sandalye",  "İzleme alanı sandalyesi",      "adet", 55),
  sa("sa-pota",             "Plastik pota",                 "adet", 56),
  sa("sa-tirmanma",         "6 gen tırmanma",               "adet", 57),

  s("dp-malzeme",         "Malzemeler geldi",               "depo",     "d-depo",     "check", "", 58, "", "Projedeki tüm satın alma kalemleri gelmeden kapanmaz"),
  s("dp-koli",            "Koli hazırlık",                  "depo",     "d-depo",     "check", "", 59),
  s("dp-yukleme-listesi", "Yükleme listesi ve +/-",         "depo",     "d-depo",     "check", "", 60),

  s("k-kontrol",          "Teklif kalemleri kontrol edildi", "kalite",  "d-kalite",   "check", "", 61),

  s("sv-tamam",           "Sevkiyat tamamlandı",            "sevkiyat", "d-sevkiyat", "check", "", 62, "", "Üretim, satın alma, depo ve kalite tamamlanmadan kapanmaz; tamamlanma tarihi yükleme tarihidir"),
  s("sv-foto",            "Sevkiyat fotoğrafları",          "sevkiyat", "d-sevkiyat", "file",  "", 63),

  s("mo-tamam",           "Montaj tamamlandı",              "montaj",   "d-montaj",   "check", "", 64, "", "Sevkiyat tamamlanmadan kapanmaz; atanan kişi montaj ustasıdır"),
  s("mo-foto",            "Montaj fotoğrafları",            "montaj",   "d-montaj",   "file",  "", 65)
];

/* ---------- eski veriden geçiş ---------- */

// Sürüm 1 departmanları → sürüm 2 departman + bölüm.
// Kimliği değişmeyenler (d-montaj, d-satinalma, d-sevkiyat) tabloda yok.
export const LEGACY_DEPT_MAP = {
  "d-cizim":   { dept: "d-tasarim", section: "" },
  "d-metal":   { dept: "d-uretim",  section: "metal" },
  "d-kaplama": { dept: "d-uretim",  section: "kaplama" },
  "d-mdf":     { dept: "d-uretim",  section: "mdf" }
};

// Sürüm 1 adım kimlikleri → sürüm 2. Mevcut iş emirleri eski stepId ile
// kalır; matris ve ekranlar bu tabloyla yeni sütuna oturtur.
export const LEGACY_STEP_MAP = {
  "s-cizim": "t-2d", "s-metal": "u-metal-durum", "s-kaplama": "u-kaplama-durum", "s-mdf": "u-mdf-durum",
  "s-tatami": "sa-tatami", "s-top": "sa-top", "s-kum": "sa-kum", "s-tuz": "sa-tuz",
  "s-palmiye": "sa-palmiye", "s-donerge": "sa-donerge", "s-piyano": "sa-piyano",
  "s-topufleme": "sa-top-ufleme", "s-topatma": "sa-top-atma", "s-ufo": "sa-ufo",
  "s-fiskiye": "sa-top-fiskiyesi", "s-selale": "sa-top-selalesi", "s-sunger": "sa-sunger-engel",
  "s-sallanan": "sa-sallanan", "s-tirtil": "sa-tirtil", "s-tasev": "sa-tas-ev",
  "s-aktivite": "sa-aktivite-masa", "s-ayakkabilik": "sa-ayakkabilik", "s-pota": "sa-pota",
  "s-tirmanma": "sa-tirmanma", "s-kulespiral": "sa-kule-spiral", "s-acikspiral": "sa-acik-spiral",
  "s-duztup": "sa-duz-tup", "s-plastikkaydirak": "sa-plastik-kaydirak", "s-hunikaydirak": "sa-huni-kaydirak",
  "s-sevkiyat": "sv-tamam", "s-montaj": "mo-tamam"
};

export function canonicalStepId(id) {
  return LEGACY_STEP_MAP[id] || id;
}

// Teklif kalemi → satın alma adımı. Kabul edilen tekliften proje açılırken
// kalem adı bu tabloyla eşlenir; eşleşmeyen kalemler sihirbazda "serbest
// kalem" olarak listelenir, kullanıcı elle seçer. Sıra önemli: ilk eşleşen kazanır.
export const QUOTE_STEP_MAP = [
  { match: /tatami/i,                         step: "sa-tatami" },
  { match: /bal[ıi]k\s*palmiye/i,             step: "sa-balik-palmiye" },
  { match: /palmiye/i,                        step: "sa-palmiye" },
  { match: /d[öo]nerge/i,                     step: "sa-donerge" },
  { match: /piyano/i,                         step: "sa-piyano" },
  { match: /top\s*[üu]fleme/i,                step: "sa-top-ufleme" },
  { match: /z[ıi]plavur/i,                    step: "sa-ziplavur" },
  { match: /hava\s*labirent/i,                step: "sa-hava-labirenti" },
  { match: /atl[ıi]\s*kar[ıi]nca/i,           step: "sa-atli-karinca" },
  { match: /top\s*atma/i,                     step: "sa-top-atma" },
  { match: /\bufo\b/i,                        step: "sa-ufo" },
  { match: /f[ıi]skiye/i,                     step: "sa-top-fiskiyesi" },
  { match: /[şs]elale/i,                      step: "sa-top-selalesi" },
  { match: /air\s*hokey/i,                    step: "sa-air-hokey" },
  { match: /lang[ıi]rt/i,                     step: "sa-langirt" },
  { match: /basket/i,                         step: "sa-basket" },
  { match: /s[üu]nger\s*engel/i,              step: "sa-sunger-engel" },
  { match: /bingo/i,                          step: "sa-bingo-kaydirak" },
  { match: /kule.*spiral|spiral.*kule/i,      step: "sa-kule-spiral" },
  { match: /a[çc][ıi]k\s*spiral/i,            step: "sa-acik-spiral" },
  { match: /d[üu]z\s*t[üu]p/i,                step: "sa-duz-tup" },
  { match: /t[üu]p\s*ge[çc]i[şs]/i,           step: "sa-tup-gecis" },
  { match: /plastik\s*kayd[ıi]rak/i,          step: "sa-plastik-kaydirak" },
  { match: /huni/i,                           step: "sa-huni-kaydirak" },
  { match: /250.*(kayan|[ıi][şs][ıi]kl[ıi])/i, step: "sa-isikli-250" },
  { match: /150.*(kayan|[ıi][şs][ıi]kl[ıi])/i, step: "sa-isikli-150" },
  { match: /100.*(kayan|[ıi][şs][ıi]kl[ıi])/i, step: "sa-isikli-100" },
  { match: /kum[-\s]*tuz/i,                   step: "sa-kum-tuz-oyuncak" },
  { match: /\bkum\b/i,                        step: "sa-kum" },
  { match: /\btuz\b/i,                        step: "sa-tuz" },
  { match: /mineflo|zemin/i,                  step: "sa-mineflo" },
  { match: /sallanan/i,                       step: "sa-sallanan" },
  { match: /t[ıi]rt[ıi]l/i,                   step: "sa-tirtil" },
  { match: /ta[şs]\s*ev/i,                    step: "sa-tas-ev" },
  { match: /aktivite\s*masa/i,                step: "sa-aktivite-masa" },
  { match: /ayakkab[ıi]l[ıi]k/i,              step: "sa-ayakkabilik" },
  { match: /[ıi][şs][ıi]kl[ıi]\s*kasa/i,      step: "sa-isikli-kasa" },
  { match: /izleme.*sandalye|sandalye/i,      step: "sa-izleme-sandalye" },
  { match: /\bpota\b/i,                       step: "sa-pota" },
  { match: /t[ıi]rmanma/i,                    step: "sa-tirmanma" },
  { match: /\btop\b|toplar/i,                 step: "sa-top" }
];

export function quoteItemStep(name) {
  const n = String(name || "");
  for (let i = 0; i < QUOTE_STEP_MAP.length; i++) if (QUOTE_STEP_MAP[i].match.test(n)) return QUOTE_STEP_MAP[i].step;
  return "";
}
