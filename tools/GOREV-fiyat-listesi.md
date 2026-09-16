# Görev: Fiyat listesini Google Sheet'ten kataloğa bağlamak

Toysmar'ın güncel fiyat listesi "Toysmar Takip - 2026" e-tablosunda tutuluyor
(sayfa: "28/07 GÜNCEL..", gid 233216101). Sayfanın yanında çalışan bir Apps
Script köprüsü (`fiyat-koprusu.gs`) bu listeyi JSON olarak veriyor. Bu görev,
uygulamanın kataloğunu o köprüden besleyecek ve teklif ekranında ürün seçimini
bu kataloğa bağlayacak.

Okumadan başlama: `README.md`, `CLAUDE.md`, `js/quotes.js`, `js/quote-views.js`,
`js/quote-app.js`, `js/sales-seed.js`.

## Köprünün verdiği veri

`GET <url>?key=<anahtar>` şu gövdeyi döner:

```json
{
  "kaynak": "Toysmar Takip - 2026 / 28/07 GÜNCEL..",
  "listeTarihi": "27.08.2026",
  "kur": 49,
  "alindi": "2026-09-15T10:00:00.000Z",
  "adet": 412,
  "uyarilar": ["Yinelenen kod TPT-125: satır 34 ve 35", "..."],
  "urunler": [
    { "kod": "TYT-1001", "kodHam": "TYT-1001", "ad": "Çocuk Salıncak 90 cm",
      "ebat": "120 çap H149 cm", "fiyat": 3224, "grup": "TEKLİ TRAMBOLİNLER (Bireysel)", "satir": 4 }
  ]
}
```

- `fiyat` KDV hariç perakende TL. `0` ise listede fiyat girilmemiş demektir.
- `kod` boşlukları temizlenmiş, büyük harfe çevrilmiş haldir. `kodHam` sayfadaki
  yazım. Kodu olmayan satırlar `SATIR-<n>` kimliği alır.
- Toptan fiyat, maliyet, kur oranı **gelmez** ve uygulamada hiçbir yerde
  tutulmaz. Bu kasıtlıdır; köprüyü genişletme.

## 1. Ayarlar

Teklifler → Ayarlar ekranına "Fiyat listesi kaynağı" bölümü:

- Köprü URL'si ve anahtar. İkisi de `sales/settings` belgesinde tutulur;
  yalnızca `yonetici` rolü görür ve değiştirir (rules'ta da).
- "Fiyat listesini güncelle" düğmesi ve son güncelleme bilgisi
  (liste tarihi, alınma zamanı, kaç ürün, kim güncelledi).

## 2. Güncelleme akışı

Düğmeye basılınca:

1. Köprü çağrılır. Hata dönerse anlaşılır bir mesaj: "Anahtar hatalı",
   "Sayfa bulunamadı", "Bağlantı kurulamadı".
2. Gelen liste mevcut `sales/products` ile **kod** üzerinden karşılaştırılır.
   Bir onay penceresinde özet gösterilir:
   - Yeni ürün (kaç adet, listesi)
   - Fiyatı değişen (kod, ad, eski → yeni, % fark)
   - Adı/ebadı değişen
   - Listeden düşen (kod uygulamada var, sayfada yok) — bunlar **silinmez**,
     `active:false` olur; teklif geçmişi kırılmaz
   - Köprünün `uyarilar` listesi olduğu gibi
3. Kullanıcı onaylarsa yazılır. Yazma tek bir toplu işlem olmalı; yarıda
   kalırsa katalog yarım güncellenmiş kalmamalı.
4. `log` koleksiyonuna kayıt: "Fiyat listesi güncellendi — 412 ürün, 37 fiyat
   değişti, 5 yeni, 2 pasif" ve liste tarihi.

Onay penceresinde hiçbir değişiklik yoksa "Katalog güncel" denir, yazılmaz.

## 3. Ürün belgesi

`sales/products` altında belge kimliği = normalize kod. Alanlar:

```
code, codeRaw, name, size, group, price (number, TL, KDV hariç),
priceMissing (bool, fiyat 0 ise), unit ("adet" varsayılan),
active (bool), source ("sheet" | "manuel"),
listDate, importedAt, importedBy
```

Elle eklenmiş ürünler (`source:"manuel"`) güncellemede dokunulmaz.

Yinelenen kod gelirse ilk satır kodu alır, sonrakiler `<kod>-2`, `<kod>-3`
olur ve onay özetinde açıkça listelenir. Kalıcı çözüm sayfada; uygulama
sessizce birleştirmez.

## 4. Teklif ekranında ürün seçimi

Mevcut "ürün ekle" akışını şu hale getir:

- Grup → ürün şeklinde daralan bir seçici; üstte arama kutusu (kod, ad ve
  ebatta arar, Türkçe karakter ve büyük/küçük harf duyarsız).
- Satırda kod, ad, ebat ve fiyat görünür. `priceMissing` olanlar
  "fiyat girilmedi" etiketiyle gelir; seçilince fiyat alanı boş ve odaklı gelir.
- `active:false` ürünler seçicide görünmez, ama eski tekliflerde kalem olarak
  durmaya devam eder.
- Seçilen ürünün fiyatı kaleme **kopyalanır** (bugünkü davranış). Katalog sonra
  değişse de teklifteki kalem değişmez. Bu kural test edilecek.
- Kalem açıklamasına ebat otomatik eklenir (ad + " — " + ebat), kullanıcı
  düzenleyebilir.

Klavyeyle kullanılabilir olmalı: yazıp aşağı ok, Enter ile ekleme.

## 5. Güvenlik

- `firestore.rules`: `sales/settings` içindeki köprü URL'si ve anahtar
  yalnızca `yonetici` okur/yazar. Satış rolü kataloğu okur, yazamaz.
- Köprü anahtarı tarayıcıya iner (istemci tarafı uygulama), bu bilinen bir
  sınır. Anahtar yalnızca perakende listesine erişim verir, sayfanın kendisine
  değil. README'ye bunu yaz.

## 6. Testler (`test/run.mjs`)

Sahte köprü cevabıyla:

- İlk içe aktarma: N ürün yazıldı, gruplar doğru.
- İkinci içe aktarma, üç fiyat değişmiş: özet doğru sayıları gösteriyor,
  onaydan sonra sadece o üçü değişmiş.
- Listeden düşen ürün: `active:false` oldu, silinmedi.
- Fiyatı 0 gelen ürün: `priceMissing:true`, seçicide etiketli.
- Yinelenen kod: `-2` eki ve uyarı.
- Teklif kalemine eklenen fiyat, katalog güncellendikten sonra değişmiyor.
- Ürün seçicide "trambolin 305" araması doğru satırları buluyor.
- Elle eklenen ürün içe aktarmada dokunulmadan kalıyor.

Sahte Firebase (`test/mock-firebase.js`) yeterli; köprü için `fetch`
yerine test içinde sabit bir JSON kullan.

## 7. Bilinen veri sorunları (sayfa sahibine iletilecek)

Uygulama bunları raporlar ama düzeltmez:

- TPT-125 kodu iki ayrı üründe (111×111 ve 125×125)
- TYP-155 üç ayrı üründe, TSP-113-13 iki, TSP-120 üç satırda
- TTO serisi 8 kişilik olimpik trambolinin kodu boş
- Kodlarda boşluk: "TYT-250 -1", "TPT- 240", "TSP- 117-22"
- ~100 üründe fiyat 0

## Teslim

Her adım için ayrı commit, testler geçmeden commit yok. `README.md` "Teklif
modülü" bölümüne "Fiyat listesi kaynağı" alt başlığı ekle. `firestore.rules`
değiştiyse kullanıcıya Firebase Console'da yayınlaması gerektiğini hatırlat.
