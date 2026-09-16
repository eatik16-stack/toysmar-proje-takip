/**
 * Toysmar fiyat listesi köprüsü
 *
 * Bu betik "Toysmar Takip - 2026" e-tablosuna bağlı çalışır ve fiyat listesi
 * sayfasındaki ürünleri uygulamaya JSON olarak verir. Yalnızca şu alanlar
 * dışarı çıkar: ürün kodu, ürün adı, ebat, PERAKENDE fiyat, grup.
 * Toptan fiyat, maliyet, kâr oranı ve bayi sütunları hiçbir koşulda verilmez.
 *
 * KURULUM (bir kez):
 *  1. E-tabloyu aç → Uzantılar → Apps Script.
 *  2. Açılan editördeki her şeyi silip bu dosyanın içeriğini yapıştır.
 *  3. Aşağıdaki ANAHTAR değerini uzun, rastgele bir metinle değiştir
 *     (ör. 40 karakterlik harf-rakam karışımı). Aynı anahtar uygulamanın
 *     Teklif ayarlarına da girilecek.
 *  4. Dağıt → Yeni dağıtım → tür: Web uygulaması
 *       - Şu kimlikle çalıştır: Ben
 *       - Erişimi olanlar: Herkes
 *     "Dağıt" de, çıkan Web uygulaması URL'sini kopyala.
 *  5. Uygulamada Teklifler → Ayarlar → "Fiyat listesi kaynağı" alanına
 *     URL'yi ve anahtarı gir.
 *
 * Sayfa, adıyla değil kimliğiyle (gid) bulunur; sayfanın adı değişse de
 * bağlantı kopmaz. Sayfa taşınır veya silinirse hata döner.
 */

var ANAHTAR = "BURAYA-UZUN-RASTGELE-ANAHTAR-YAZ";
var SAYFA_GID = 233216101; // "28/07 GÜNCEL.." sayfasının kimliği

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.key !== ANAHTAR) {
    return cevap({ hata: "yetkisiz" });
  }
  try {
    return cevap(fiyatListesi());
  } catch (err) {
    return cevap({ hata: String(err && err.message || err) });
  }
}

function fiyatListesi() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sayfa = ss.getSheets().filter(function (s) { return s.getSheetId() === SAYFA_GID; })[0];
  if (!sayfa) throw new Error("Fiyat listesi sayfası bulunamadı (gid " + SAYFA_GID + ")");

  var satirlar = sayfa.getDataRange().getValues();

  // Kolonlar başlık satırından bulunur; sütun sırası değişse de çalışır.
  var baslikSatiri = -1, kol = {};
  for (var i = 0; i < Math.min(satirlar.length, 10); i++) {
    var idx = kolonlariBul(satirlar[i]);
    if (idx.kod >= 0 && idx.ad >= 0 && idx.perakende >= 0) { baslikSatiri = i; kol = idx; break; }
  }
  if (baslikSatiri < 0) throw new Error("Başlık satırı bulunamadı (ÜRÜN KODU / ÜRÜN ADI / PARAKENDE)");

  // Üst bilgi: liste tarihi ve kur, varsa
  var ust = satirlar.slice(0, baslikSatiri).map(function (r) { return r.join(" "); }).join(" ");
  var tarih = (ust.match(/\d{2}[.,]\d{2}[.,]\d{4}/) || [""])[0].replace(/,/g, ".");
  var kur = (ust.match(/(\d+[.,]\d{2})\s*TL/) || ["", ""])[1].replace(".", "").replace(",", ".");

  var urunler = [], grup = "", uyarilar = [];
  for (var r = baslikSatiri + 1; r < satirlar.length; r++) {
    var row = satirlar[r];
    var kodHam = metin(row[kol.kod]);
    var ad = metin(row[kol.ad]);
    var ebat = kol.ebat >= 0 ? metin(row[kol.ebat]) : "";
    var fiyat = sayi(row[kol.perakende]);

    // Boş satır
    if (!kodHam && !ad) continue;
    if ((kodHam === "0" || !kodHam) && (ad === "0" || !ad)) continue;

    // Kategori satırı: kod sütununda başlık var, ad yok, fiyat yok
    if (kodHam && !ad && !fiyat) { grup = kodHam; continue; }
    if (!ad || ad === "0") continue;

    var kod = kodHam.replace(/\s+/g, "").toUpperCase();
    if (!kod || kod === "0") {
      uyarilar.push("Satır " + (r + 1) + ": ürün kodu yok — " + ad);
      kod = "SATIR-" + (r + 1);
    }

    urunler.push({
      kod: kod,
      kodHam: kodHam,
      ad: ad,
      ebat: (ebat === "0" ? "" : ebat),
      fiyat: fiyat,          // KDV hariç perakende, TL; 0 ise fiyat girilmemiş
      grup: grup,
      satir: r + 1
    });
  }

  // Yinelenen kodlar raporlanır; uygulama tarafı karar verir
  var gorulen = {};
  urunler.forEach(function (u) {
    if (gorulen[u.kod]) uyarilar.push("Yinelenen kod " + u.kod + ": satır " + gorulen[u.kod] + " ve " + u.satir);
    else gorulen[u.kod] = u.satir;
  });

  return {
    kaynak: ss.getName() + " / " + sayfa.getName(),
    listeTarihi: tarih,
    kur: kur ? Number(kur) : null,
    alindi: new Date().toISOString(),
    adet: urunler.length,
    uyarilar: uyarilar,
    urunler: urunler
  };
}

function kolonlariBul(row) {
  var idx = { kod: -1, ad: -1, ebat: -1, perakende: -1 };
  for (var c = 0; c < row.length; c++) {
    var h = metin(row[c]).toUpperCase().replace(/İ/g, "I");
    if (h.indexOf("URUN KODU") === 0 || h.indexOf("ÜRÜN KODU") === 0 || h === "URUN KODU") idx.kod = c;
    else if (h.indexOf("URUN ADI") === 0 || h.indexOf("ÜRÜN ADI") === 0) idx.ad = c;
    else if (h.indexOf("EBAT") === 0) idx.ebat = c;
    else if (h.indexOf("PARAKENDE") === 0 || h.indexOf("PERAKENDE") === 0) idx.perakende = c;
  }
  return idx;
}

function metin(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

// "3.224,00TL", "₺3.224,00", 3224 → 3224 ; hata/boş → 0
function sayi(v) {
  if (typeof v === "number") return isFinite(v) ? Math.round(v * 100) / 100 : 0;
  var s = metin(v);
  if (!s || s.charAt(0) === "#") return 0;
  s = s.replace(/[^\d,.\-]/g, "");
  if (!s) return 0;
  // Türkçe biçim: binlik nokta, ondalık virgül
  if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, "");
  var n = Number(s);
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function cevap(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
