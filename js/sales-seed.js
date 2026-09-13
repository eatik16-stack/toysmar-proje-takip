// Teklif modülü ilk kurulumda yüklenen varsayılanlar.
// Kaynak: "Örnek Teklif.xlsx" — ürün adları yazım hataları ve çift boşluklar
// temizlenerek alındı; fiyatlar bilerek alınmadı, teklifte elle girilir.
// Kaşe/imza görseli burada YOK: depo herkese açık, görsel yalnızca
// Teklif ayarlarından yüklenir ve yetkili girişle korunan Firestore'da durur.

export const UNITS = ["Adet", "Metre", "m²", "Paket", "Takım", "Götürü"];

export const PRODUCT_GROUPS = ["Softplay", "Elektronik oyun", "Hizmet"];

function p(id, name, unit, group) {
  return { id: id, code: "", name: name, unit: unit, group: group, note: "" };
}

export const DEFAULT_PRODUCTS = [
  p("u-roller-200",    "Softplay Roller Kaydırak (H: 200 cm)",                      "Adet",   "Softplay"),
  p("u-isikli-200",    "Softplay Işıklı Kaydırak, Polyester 3'lü Model (H: 200 cm)", "Adet",   "Softplay"),
  p("u-isikli-300",    "Softplay Işıklı Kaydırak, Polyester 3'lü Model (H: 300 cm)", "Adet",   "Softplay"),
  p("u-tup-duz",       "Softplay Tüp Kaydırak, Düz",                                "Adet",   "Softplay"),
  p("u-tup-seffaf",    "Softplay Tüp Kaydırak, Düz Şeffaf",                         "Adet",   "Softplay"),
  p("u-mini-isikli",   "Softplay Mini Işıklı Kaydırak",                             "Adet",   "Softplay"),
  p("u-engel",         "Softplay Engel Parkur",                                     "Metre",  "Softplay"),
  p("u-atli",          "Softplay Atlı Karınca, Işıklı Çatılı",                      "Adet",   "Softplay"),
  p("u-engel-3yas",    "Softplay 3 Yaş Alanı Engel Parkur",                         "Metre",  "Softplay"),
  p("u-cit-350",       "Softplay Güvenlik Çiti (H: 350 cm)",                        "Metre",  "Softplay"),
  p("u-cit-120",       "Softplay Güvenlik Çiti (H: 120 cm)",                        "Metre",  "Softplay"),
  p("u-top-7",         "Top Havuzu Topu, 7 cm (500'lü paket)",                      "Paket",  "Softplay"),
  p("u-kule-spiral",   "Softplay Kule ve Spiral Kaydırak",                          "Adet",   "Softplay"),
  p("u-spiral-seffaf", "Softplay Kule Spiral Kaydırak, Şeffaf",                     "Adet",   "Softplay"),
  p("u-tatami-26",     "Softplay Tatami Zemin Minder Kaplama (26 mm)",              "m²",     "Softplay"),
  p("u-trambolin",     "Softplay Trambolin",                                        "Adet",   "Softplay"),
  p("u-palmiye-8",     "Softplay Palmiye, Elektronik Hız Kontrollü, 8 Kollu",       "Adet",   "Softplay"),
  p("u-zipline",       "Softplay Zipline, Tam Korumalı",                            "Adet",   "Softplay"),
  p("u-cati-susleme",  "Softplay Çatı Süsleme",                                     "Adet",   "Softplay"),
  p("u-kolon",         "Softplay Kolon Koruma",                                     "Adet",   "Softplay"),
  p("u-desk-cit",      "Softplay İzleme Deski Çiti",                                "Metre",  "Softplay"),
  p("u-desk-sandalye", "Softplay İzleme Deski Sandalyesi",                          "Adet",   "Softplay"),
  p("u-air-hockey",    "Elektronik Air Hockey",                                     "Adet",   "Elektronik oyun"),
  p("u-langirt",       "Elektronik Langırt",                                        "Adet",   "Elektronik oyun"),
  p("u-basket",        "Elektronik Basketbol",                                      "Adet",   "Elektronik oyun"),
  p("u-nakliye",       "Nakliye ve Montaj",                                         "Götürü", "Hizmet")
];

// Metinlerde kullanılabilen yer tutucular:
//   {musteri}  müşteri firma adı      {yetkili}  müşteri yetkilisi
//   {gecerlilik} geçerlilik bitiş tarihi   {gun} geçerlilik gün sayısı
export const DEFAULT_SETTINGS = {
  company: "Toysmar Oyun Grupları",
  slogan: "Çocuklar Gülerse Dünya Güler",
  address: "Güzelyurt Mah. 5769 Sk. No: 1/A Tekstilciler Sitesi, Yunusemre / Manisa",
  phone: "0236 302 02 27",
  email: "info@toysmar.com",
  web: "www.toysmar.com",
  taxOffice: "Mesir",
  taxNo: "14140948900",
  tradeNo: "13687",
  mersis: "3-4592-4573-7884414",
  bank: "",
  stamp: "",

  validDays: 7,
  currency: "TRY",
  vatRate: 20,
  priceMode: "detay",

  intro: "İhtiyacınız olan ürünlere ait fiyat teklifimizi aşağıda bilgilerinize sunarız. " +
    "Teklifimizin beklentilerinizi karşılayacağını umar, çalışmalarınızda başarılar dileriz.",
  terms: [
    "Fiyatlarımıza nakliye ve montaj dahildir.",
    "Ürün gruplarının oyun alanına taşınması alıcı firmaya aittir.",
    "Teklifimiz {gecerlilik} tarihine kadar geçerlidir.",
    "Döviz cinsinden verilen tekliflerde fatura tarihindeki T.C. Merkez Bankası döviz satış kuru esas alınarak Türk lirasına çevrilir.",
    "Sipariş, alıcı firmanın teklifi kaşe ve imza ile onaylamasıyla kesinleşir.",
    "Ödeme: sipariş onayında %50 banka havalesi, kalan tutar ürün tesliminden önce banka havalesi ile yapılır.",
    "Öngörülen üretim süresi 4–5 haftadır."
  ],
  privacy: "Bu teklif ve ekindeki tüm bilgiler yalnızca {musteri} için hazırlanmıştır; " +
    "teklifi veren ve alan dışındaki üçüncü kişi veya kurumlarla paylaşılamaz."
};
