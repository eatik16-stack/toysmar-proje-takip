# Görev: Uygulamayı Toysmar'ın gerçek süreç adımlarına göre yeniden kurmak

Toysmar bugün 13 aktif projeyi 85 sütunlu bir Excel ile takip ediyor
(`TOYSMAR PROJE TAKİP 16.09.2026.xlsx`). Emre bu Excel'i inceleyip
uygulamada olması gereken adımları departman bazında çıkardı
(`TOYSMAR PROJE ADIMLARI (EMRENİN DÜŞÜNCESİ).xlsx`). Bu görev, uygulamanın
adım kataloğunu, proje kartını ve iş emri tiplerini o yapıya taşımak.

Yanında üç dosya var:

- `toysmar-adim-katalogu.json` — yeni departmanlar, bölümler, adım tipleri ve
  65 adımın tamamı (id, ad, grup, departman, tip, birim, Excel'de karşılık
  gelen sütun). `js/seed.js` içindeki `DEFAULT_DEPTS` ve `DEFAULT_STEPS`'in
  yerine geçecek.
- `toysmar-mevcut-projeler.json` — Excel'deki 13 projenin yeni modele
  dönüştürülmüş hali. Eski verinin uygulamaya alınması için.
- Bu dosya.

Başlamadan oku: `README.md`, `CLAUDE.md`, `js/seed.js`, `js/app.js`
(`createProjectNow`, `newWizard`), `js/views.js`, `firestore.rules`.

---

## 1. Excel'in nasıl kullanıldığı (bağlam)

Tek sayfa, her satır bir proje. Sütunlar satır 1'de bölümlere ayrılmış:
Muhasebe (F–P), Teknik ekip (R–U), Metal (W–X), Kaplama (Y–Z), Dikim (AA–AC),
MDF (AD–AE), Tedarik (AF–CA), sonda depo/yükleme (CB–CD).

Hücrelerde üç tür bilgi var ve uygulamada üçü de ayrı tutulmalı:

| Excel'de | Örnek | Uygulamada |
|---|---|---|
| Durum kelimesi | BİTTİ / İMALATTA / BAŞLAMADI / SİPARİŞ VERİLDİ / GELDİ / YAPILDI / YAPILMADI | iş emri durumu veya sipariş durumu |
| Adet + özellik | "330 YEŞİL-KREM(AÇIK)", "1 PEMBE", "2 AT - 1 BALIK", "4,5 TON", "18 m2" | `qty` + `spec` |
| Serbest not | "1 GELMEDİ", "kaydırak bekliyoruz-Adre" | `orderStatus` + `note` |

Dikkat çeken şeyler:

- **PANEL KODLAMA** (AP, BP, KP…) panellerin üzerine yazılan proje kısaltması.
  Emre'nin "Proje Kodu" alanı bu. Her projede benzersiz olmalı.
- **DRİVER YÜKLEME = YÜKLENDİ** proje dosyalarının Google Drive'a atıldığını
  gösteriyor. Uygulamada bunun karşılığı dosya yükleme adımları.
- Kaydırak kalemleri dış tedarikçiden geliyor (ADRE, KOÇAK PARK); Excel bunu
  ayrı sütunlarda (FİRMA, ADRE SİPARİŞ DURUMU, RENK-MODEL) tutuyor. Uygulamada
  bu bilgi kalemin kendi alanları olmalı, ayrı adım değil.
- Kişi atamaları dört sütunda: SİPARİŞ ALAN, 3D TASARIM VE SATIŞ, ÇİZİM VE
  TAKİP, MONTAJ USTASI. İlk üçü proje kartına, montaj ustası montaj iş emrine.
- Muhasebe sütunları (genel toplam, ödeme detayı, konuşulan detay,
  kargo/nakliye, borç-alacak) proje seviyesinde bilgi; iş emri değil.

---

## 2. Proje kartı (yeni alanlar)

Emre'nin "proje oluşturulurken girilecek bilgiler" listesi + Excel'de olup
listede olmayan ama kaybedilmemesi gereken alanlar:

```
code            Proje kodu (panel kodu). Zorunlu, benzersiz, 2-4 büyük harf.
name            Proje adı
description     Proje açıklaması (Excel: Açıklaması)
company         Cari unvan
customer        Müşteri / teslimat yetkilisi
contact         İletişim bilgileri
address         Teslimat adresi
theme           Tema (SOFT, ORMAN, …) — mevcut alan
startDate       Başlangıç tarihi — mevcut
dueDate         Teslim tarihi — mevcut
salesperson     Sipariş alan (Excel L)
designer3d      3D tasarım (Excel Q)
drafter         Çizim ve takip (Excel R)
note            Proje notu (Excel P)

accounting: {   Yalnızca muhasebe rolü düzenler; ayrı sekme
  total           Genel toplam (TL)
  paymentDetail   Ödeme detayı — uzun metin
  discussedDetail Konuşulan detay — uzun metin
  shippingIncluded   "dahil" | "haric" | ""   — nakliye teklife dahil mi
  installIncluded    "dahil" | "haric" | ""   — montaj teklife dahil mi
  shippingNote       serbest not (ör. "gümrük dahil", "nakliye alıcıya ait")
  balance            Müşteri borç-alacak (TL, opsiyonel)
}
```

`panelCount` alanı kaldırılır; panel sayısı artık Metal ve Kaplama iş
emirlerinde gereken/yapılan olarak tutuluyor.

Proje oluşturma sihirbazı buna göre genişler. Muhasebe alanları sihirbazda
sorulmaz; proje açıldıktan sonra muhasebe kendi sekmesinden girer.

---

## 3. Departmanlar ve bölümler

Yedi departman dokuza çıkıyor:

Muhasebe · Satış Pazarlama · Tasarım · Üretim Planlama · Satın Alma · Depo ·
Kalite · Sevkiyat · Montaj

**Üretim Planlama** dört bölüme ayrılır: Metal, Kaplama, MDF, Dikiş. Bölüm,
departmanın altında bir etiket; iş emri hem departmana hem bölüme bağlı.
Personel kaydında `dept` yanına `section` gelir; "İşlerim" ekranı bölümüne göre
süzer. Bugünkü Metal / Kaplama / MDF departmanları bu bölümlere dönüşür,
mevcut personel kayıtları taşınır.

Rol ve görünürlük kuralları değişiyor; bkz. bölüm 3a.

### 3a. Kim neyi görür, kim ne yapar

Karar 6'ya göre üç görünürlük katmanı var:

| Rol | Görür | Kapatır / düzenler |
|---|---|---|
| `yonetici` (idare) | her şey | her şey |
| `muhasebe` | her şey (tüm projeler, tüm iş emirleri, ilerlemeler) | muhasebe sekmesi ve Muhasebe departmanının iş emirleri |
| `sef` (birim amiri) | kendi departmanının tüm bölümleri: iş emirleri, ilerleme, panel | kendi departmanının iş emirleri |
| `personel` | kendi bölümünün (`section`) iş emirleri; bölümü yoksa departmanının | kendine veya bölümüne atanmış iş emirleri |
| `satis` | teklif modülü + kendi açtığı projeler (mevcut) | teklif |

Somut örnek: metal ustası (`personel`, dept `d-uretim`, section `metal`)
yalnızca Metal bölümündeki iş emirlerini görür. Üretim Planlama sorumlusu
(`sef`, dept `d-uretim`) Metal, Kaplama, MDF ve Dikiş bölümlerinin tamamını
görür. Satın Alma şefi yalnızca Satın Alma kalemlerini ve o kalemlerin
ilerlemesini görür; Muhasebe ve idare her projeyi, her departmanı görür.

**Başka birime iş emri açma:** her rol, gerek görürse başka bir departmana
iş emri açabilir. "İş emri aç" ekranında hedef departman (ve varsa bölüm)
seçilir; açılan iş emrinde `openedBy` ve `openedByDept` tutulur. Açan kişi
kendi departmanı dışındaki o iş emrini "Açtıklarım" listesinde görür ve
durumunu izler, ama kapatamaz — kapatma yetkisi hedef departmandadır.

`js/roles.js` içindeki ekran eşlemesi buna göre yeniden yazılır. Aynı sınır
`firestore.rules` içinde de olmalı: `tasks` okuma, kullanıcının `allowed`
belgesindeki `role`, `dept`, `section` alanlarına ve iş emrinin
`dept`/`section`/`openedBy` alanlarına göre. Ekranda gizlemek yetmez
(CLAUDE.md).

Yeni rol `muhasebe`; `allowed` belgesine `section` alanı eklenir.

---

## 4. Adım tipleri

Bugün iki tip var (`check`, `qty`). İki tip daha geliyor:

| Tip | Tamamlanma kuralı | Ekranda |
|---|---|---|
| `check` | Tamamla düğmesi | mevcut |
| `qty` | yapılan ≥ gereken (README "Adet kuralı") | mevcut |
| `file` | en az bir dosya yüklenmiş olmalı | yükleme alanı + dosya listesi; dosya yoksa Tamamla pasif |
| `text` | metin girilmiş olmalı | tek satır metin; kaydedince tamamlanır |

Karar 1 gereği **her adıma** isteğe bağlı dosya eklenebilir (ör. 2D çizim
adımına çizim dosyası). `file` tipinde dosya zorunludur, diğerlerinde isteğe
bağlıdır; ekranda aynı yükleme alanı kullanılır.

`file` tipi Firebase Storage gerektirir. Kurgu şu:

- Dosya `projeler/{projectId}/{taskId}/{dosyaId}-{ad}` yoluna yüklenir.
- Firestore'da `files` alt koleksiyonu: ad, tür, boyut, yükleyen, tarih,
  storage yolu, taskId. Dosya silinmez; "arşive alındı" işareti alır.
- Görseller yüklenmeden önce tarayıcıda en fazla 1600 px genişliğe küçültülür
  (montaj fotoğrafları telefondan 4-8 MB geliyor).
- Storage kuralları: yalnızca `allowed` listesindekiler, dosya başına 20 MB,
  izin verilen türler: jpg, png, pdf, dwg, dxf, skp.
- Storage için Firebase projesinin Blaze planına alınması gerekiyor (Şubat
  2026'dan beri zorunlu; 5 GB'a kadar ücretsiz). Bunu kullanıcıya hatırlat;
  kod Storage olmadan da çalışmalı — `file` adımlarında "depolama açık değil"
  uyarısı gösterilir, adım tamamlanamaz.

Proje kartında ayrıca "Dosyalar" sekmesi: projedeki tüm dosyalar, adıma göre
gruplu. Bir yıl sonra girildiğinde sözleşme, 3D görsel, montaj fotoğrafları
buradan bulunur.

---

## 5. Adım kataloğu

Tamamı `toysmar-adim-katalogu.json` içinde. Özet:

**Muhasebe (3):** Findeks raporu (file) · Sipariş onayı (check) · Ödemenin
tamamı alındı (check)

**Satış Pazarlama (2):** 3D çizim (file) · Sözleşme görüntüsü (file)

**Tasarım (1):** 2D çizim (check; çizim dosyası isteğe bağlı — karar 1)

**Üretim Planlama (10):**
- Metal: panel sayısı (qty) · mekanik imalat (check)
- Kaplama: panel sayısı (qty) · kaplama tamamlandı (check)
- MDF: MDF sayısı (qty) · MDF siparişleri (check)
- Dikiş: dikim işçilik (check) · dijital siparişleri (check) · dijital baskı
  firması (text)
- Stok kontrolleri yapıldı (check)

Emre'nin tablosunda Metal, Kaplama, MDF, Dikiş birer adım ve altında
maddeler var. Bunlar ayrı iş emirleri olarak açılır (ör. "Metal — panel
sayısı", "Metal — mekanik imalat"); ekranda bölüm başlığı altında birlikte
gösterilir. Tek iş emrine iç içe alt adım koymak mevcut modeli bozar,
gerekmiyor.

**Satın Alma (41):** Emre'nin listesindeki kalemler, hepsi `qty` tipinde.
Her satın alma kaleminde beş alan: `qty` (gereken), `doneQty` (gelen),
`spec` (renk / model / ölçü), `supplier` (tedarikçi), `orderStatus`
(bekliyor · sipariş verildi · imalatta · geldi · eksik). `supplier` yeni
alan; kaydıraklar için ADRE / KOÇAK PARK gibi. "imalatta" seçeneği
Toysmar'ın kendi ürettiği kalemler (palmiye, dönerge) için — Excel'deki
"İMALAT DURUMU" sütununun karşılığı. Excel'deki "Koçak Park sipariş durumu"
sütunu ayrı adım değil; kaydırak kalemlerinin `supplier` + `orderStatus`
alanı (karar 2). Birimler: Top → koli, Kum ve Tuz → ton, Zemin mineflo → m²,
kalanı adet.

**Depo (3):** Malzemeler geldi (check) · Koli hazırlık (check) · Yükleme
listesi ve +/- (check — karar 5)

**Kalite (1):** Teklif kalemleri kontrol edildi (check)

**Sevkiyat (2):** Sevkiyat tamamlandı (check; tamamlanınca tarih Excel'deki
"yükleme tarihi" yerine geçer) · Sevkiyat fotoğrafları (file)

**Montaj (2):** Montaj tamamlandı (check; atanan kişi "montaj ustası") ·
Montaj fotoğrafları (file)

Mevcut katalogdan düşenler: "İçerik ve Kutu", "Halı Kaydırak" (Excel'de yok).
Adım kimlikleri değiştiği için mevcut projelerdeki iş emirleri eski `stepId`
ile kalır; eski kimlikleri yeni kimliklere eşleyen bir tablo tut ve proje
açılışında adım adını katalogtan değil iş emrinin kendi `name` alanından göster
(zaten öyle).

---

## 6. Sipariş durumu, teklif bağı

Satın alma kalemlerinde `orderStatus` bugün boş bir metin alanı. Seçenekli
olsun: bekliyor · sipariş verildi · imalatta · geldi · eksik. "Malzemeler geldi" depo
adımı, projedeki tüm satın alma kalemleri "geldi" olmadan tamamlanamaz;
yönetici eksik kapatabilir (mevcut "eksik kapat" mantığı).

Teklif kabul edilip proje açıldığında, teklif kalemleri → satın alma
adımlarına ön seçim olarak gelir (ürün kataloğundaki `kod` ile adım `id`
eşlemesi; eşleşmeyen kalemler "serbest kalem" olarak listelenir, kullanıcı
seçer). Bu eşleme tablosu `js/seed.js` içinde dursun, sonradan ayarlanabilir.

---

### 6a. Sevkiyat kilidi (karar 4)

"Sevkiyat tamamlandı" iş emri şu koşullar sağlanmadan kapanamaz:

- Üretim Planlama'nın seçili tüm iş emirleri tamamlanmış
- Seçili tüm satın alma kalemleri `orderStatus = geldi` (veya eksik kapatılmış)
- Depo: Koli hazırlık ve Yükleme listesi tamamlanmış
- Kalite: Teklif kalemleri kontrol edildi tamamlanmış

Muhasebe adımları (Findeks, sipariş onayı, ödemenin tamamı) kilide **dahil
değil**: ödeme montajda veya aylar sonra alınabiliyor. Sevkiyat ekranında
bekleyen koşullar liste halinde gösterilir ("Kaplama — panel sayısı 30/35",
"Işıklı kaydırak 150: sipariş verildi"). Yönetici gerekirse kilidi aşabilir;
aşıldığında iş emri "kilit aşıldı" etiketi alır ve `log`a yazılır.

Montaj, Sevkiyat tamamlanmadan kapanamaz.

## 7. Mevcut projeleri taşıma

`toysmar-mevcut-projeler.json` 13 projeyi ve 146 iş emri durumunu içeriyor.
`tools/` altına bir içe aktarma betiği: her proje için proje belgesi + JSON'da
durumu olan adımlar için iş emri. Kurallar:

- `status` "tamamlandi" → iş emri tamamlanmış, `completedBy: "excel-aktarim"`,
  tarih bilinmiyor (boş). "devam" → açık, `note: "İmalatta (Excel)"`.
  "siparis-verildi" → açık, `orderStatus: "siparis-verildi"`.
- `qty`/`doneQty` olduğu gibi. Adet dönüşümünde belirsiz olanlar JSON'da
  `spec` içinde tam metin olarak duruyor ("2 AT - 1 BALIK" gibi); kullanıcı
  sonradan düzeltir.
- Kodu boş dört proje (2, 6, 12, 13) için kod üretilmez; içe aktarma
  bunları listeler, kullanıcı kod verir.
- Proje 2 (bedelsiz montaj) ve 12 (yedek parça) tam
  proje değil; içe aktarılır ama not düşülür.
- Aktarım bir kez çalışır; ikinci çalıştırmada aynı `code` varsa atlar.

Aktarım öncesi kullanıcıya özet göster ve onay al. Aktarım `log`
koleksiyonuna tek satır yazar.

---

## 8. Ekranlar

- **Proje kartı:** üstte kod + ad + tema + tarihler; sekmeler: İş emirleri
  (departman → bölüm başlıklarıyla), Muhasebe (yalnızca muhasebe ve yönetici),
  Dosyalar, Kayıtlar.
- **İş emirleri sekmesi:** satın alma kalemleri tek tabloda: kalem · gereken ·
  gelen · özellik · tedarikçi · sipariş durumu · termin. 43 satır olabilir;
  seçilmemiş kalemler gizli, "kalem ekle" ile açılır.
- **Panel (yönetici):** proje başına ilerleme çubuğu departman kırılımıyla
  (bugünkü mantık), artı "eksik malzeme" sayacı (orderStatus ≠ geldi olan
  kalemler).
- **İşlerim:** bölüm etiketiyle süzme.

---

## 9. Testler

`test/run.mjs` içine, sahte Firebase ile:

- Yeni katalog yükleniyor: 9 departman, 65 adım, bölümler doğru.
- `file` tipi adım dosya yoksa tamamlanamıyor; dosya kaydı eklenince
  tamamlanabiliyor.
- `text` tipi adım metin girilince tamamlanıyor, boş metinle tamamlanmıyor.
- Satın alma kalemi: `orderStatus` seçenekleri, "Malzemeler geldi" adımı
  eksik kalem varken kapanmıyor, "eksik kapat" ile kapanıyor ve etiketleniyor.
- Proje kodu benzersizliği: aynı kodla ikinci proje açılamıyor.
- Muhasebe sekmesi personel rolünde görünmüyor, muhasebe rolünde
  düzenlenebiliyor.
- İçe aktarma: örnek JSON'dan 2 proje, iş emirleri ve durumları doğru;
  tekrar çalıştırınca kopya oluşmuyor.
- Eski `stepId` ile duran iş emri açılışta hata vermiyor.
- Sevkiyat kilidi: satın alma kalemi "sipariş verildi" iken Sevkiyat
  kapanmıyor; kalem "geldi" olunca kapanıyor; muhasebe adımı açıkken kapanıyor;
  yönetici aşınca etiket ve log var.
- Görünürlük: metal personeli kaplama iş emrini görmüyor; üretim şefi dört
  bölümü görüyor; satın alma şefi üretim iş emrini görmüyor; muhasebe rolü her
  projeyi görüyor ama üretim iş emrini kapatamıyor.
- Başka birime iş emri: satın alma şefi Metal'e iş emri açabiliyor, açtığını
  "Açtıklarım"da görüyor, kapatamıyor; metal şefi kapatabiliyor.
- Nakliye ve montaj dahil/hariç ayrı seçiliyor, not serbest.

`firestore.rules` ve `storage.rules` değiştiğinde kullanıcıya Firebase
Console'da yayınlaması gerektiğini söyle.

---

## 10. Alınmış kararlar (16.09.2026)

1. **2D çizim:** "yapıldı" düğmesi yeterli; çizim dosyası isteğe bağlı.
   Genel kural: her adıma dosya eklenebilir, yalnızca `file` tipinde zorunlu.
2. **İmalat durumu / Koçak Park:** ayrı adım değil. Palmiye ve dönerge
   kalemlerinde `orderStatus = imalatta`; kaydırak kalemlerinde `supplier` ve
   `orderStatus`.
3. **Nakliye / montaj:** iki ayrı dahil-hariç seçimi + serbest not.
4. **Sevkiyat:** ödeme alınmadan başlayabilir; üretim, satın alma, depo ve
   kalite adımları tamamlanmış olmalı. Ayrıntı 6a'da.
5. **Yükleme listesi ve +/-** Depo'ya eklendi.
6. **Görünürlük:** personel kendi bölümünü, birim amiri kendi departmanının
   tamamını, muhasebe ve idare her şeyi görür. Her birim başka birime iş emri
   açabilir. Ayrıntı 3a'da.

Kod yazmadan önce sorulacak soru kalmadı; bir belirsizlik çıkarsa varsayımı
yazıp devam et, commit mesajında belirt.

## Teslim

Her bölüm ayrı commit (katalog → proje kartı → adım tipleri → Storage →
ekranlar → içe aktarma). Testler geçmeden commit yok. README'de "Adımlar"
bölümü yeni kataloğu ve tipleri anlatacak şekilde güncellenir.
