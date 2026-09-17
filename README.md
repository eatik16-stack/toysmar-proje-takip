# Toysmar Proje Takip

Toysmar Oyun Grupları için satış teklifi ve üretim planlama uygulaması.
Teklif ürün kataloğundan hazırlanır, A4 belge olarak basılır ve takip edilir;
kabul edilen teklif üretim projesine dönüşür. Projenin kapsamı Toysmar'ın
gerçek süreç adımlarından türetilmiş **65 adımlık katalogdan** seçilir, seçilen
her adım bir departmana / bölüme **iş emri** olarak açılır, termin ve
tamamlanma takip edilir. Projeye bağlı olmayan işler için de departmanlara
**proje dışı iş emri** açılır.

**Canlı adres:** https://eatik16-stack.github.io/toysmar-proje-takip/
**Giriş:** kendi şifresiyle ya da Google ile — yalnızca yetkilendirilmiş hesaplar

---

## Nasıl çalışıyor

| Katman | Ne | Nerede |
|---|---|---|
| Arayüz | Statik tek sayfa uygulama, çerçeve yok | GitHub Pages |
| Giriş | Firebase Authentication — e-posta/şifre ve Google | `js/auth.js` |
| Roller | Rol → ekran, görünürlük ve düzenleme kapsamı | `js/roles.js` |
| Veri | Cloud Firestore, gerçek zamanlı | `js/store.js` |
| Dosyalar | Firebase Storage (Blaze planı gerekir) | `js/files.js`, `storage.rules` |
| Yetki | `allowed` koleksiyonu + `firestore.rules` | Firestore |

Kimin gireceği **kurallarda değil, veride** tutulur: `allowed/<e-posta>` belgesi
olan girer. `firestore.rules` yalnızca yeni bir modül ya da rol eklendiğinde
yeniden yayınlanır (en son: görünürlük modeli, muhasebe rolü, kilit özeti ve
dosyalar — 17.09.2026).

## Kim nasıl giriyor

Yeni kişi kendini ekleyemez, **bir kereliğine erişim talebi** bırakır:

1. Giriş ekranında “Erişim izni isteyin” — ad soyad, e-posta, **görevi** ve
   kendi belirlediği şifre.
2. Firebase doğrulama e-postası yollar. Talep, kişi e-postasını doğrulayana
   kadar Firestore'a **yazılmaz**; doğrulama tamamlanınca yöneticiye düşer.
3. Yönetici **Talepler** ekranında görevi görür; departman, (varsa) bölüm ve
   rol seçip onaylar. Onayla birlikte personel kaydı ve giriş yetkisi açılır.
4. Kişi bundan sonra e-postası ve şifresiyle girer. Google ile giriş de çalışır.

Talep belgesi e-posta başına tektir ve kurallarda yalnızca *create* açıktır —
reddedilen bir talep kişi tarafından tekrar açılamaz.

## Roller ve görünürlük

| Rol | Gördüğü ekranlar | Gördüğü iş emirleri | Kapatabildiği iş emirleri |
|---|---|---|---|
| Yönetici | Hepsi | Hepsi | Hepsi |
| Planlamacı | Panel, Projeler, Proje Dışı İşler, İşlerim, Yeni Proje, Kayıtlar | Hepsi | Hepsi |
| Muhasebe | Panel, Projeler, Proje Dışı İşler, İşlerim | Hepsi | Muhasebe departmanınınkiler + muhasebe sekmesi |
| Satış | Teklifler, Projeler (izleme) | Hepsi | Yalnızca kendine atananlar |
| Şef | Panel, Projeler, Proje Dışı İşler, İşlerim | Kendi departmanının tüm bölümleri | Kendi departmanınınkiler |
| Personel | Projeler, Proje Dışı İşler, İşlerim | Kendi bölümü; bölümü yoksa departmanı | Kendine ya da bölümüne açılanlar |

Herkes kendi açtığı ve kendine atanan iş emrini görür. Her rol **başka bir
departmana proje dışı iş emri açabilir**: açan kişi onu “Açtıklarım”
süzgecinde izler ama kapatamaz; kapatma hedef departmandadır.

Görünürlük ekranda değil, sorguda ve kurallardadır: şef ve personel `tasks`
koleksiyonunu departman/bölüm, `openedBy` ve `assignee` sorgularıyla çeker
(`store.js` `subscribeScoped`), `firestore.rules` kapsam dışı okumayı reddeder.
Muhasebe bilgileri (tutar, ödeme, borç-alacak) proje belgesinde değil
`accounting/<proje>` koleksiyonundadır; yalnızca yönetici ve muhasebe okur.
Silme, giriş yetkisi verme ve Ayarlar yalnızca yöneticide. Fiyatlar yalnızca
Yönetici ve Satış rollerine açıktır.

Ekran gizlemek güvenlik değildir: aynı sınır `firestore.rules` içinde de
yazılıdır. Rol adları iki dosyada birebir aynı olmalı — `js/roles.js` ve
`firestore.rules`.

## Adımlar

Katalog (`js/seed.js`, sürüm 2) dokuz departmana ayrılır: Muhasebe, Satış
Pazarlama, Tasarım, Üretim Planlama (Metal / Kaplama / MDF / Dikiş bölümleri),
Satın Alma (43 kalem), Depo, Kalite, Sevkiyat, Montaj. Proje açılırken kapsam
katalogdan seçilir; her seçim departman → bölüm başlığıyla iş emrine dönüşür.
Sürüm 1 katalogla kurulmuş bir kurulum Ayarlar'daki **“Yeni kataloğa geç”**
ile taşınır: personel, giriş yetkileri ve açık iş emirleri eski departmandan yeni
departman + bölüme geçer, eski adım kimlikleri iş emrinde kalır ve ekranlar
`LEGACY_STEP_MAP` ile yeni sütuna oturtur.

**Adım tipleri**

| Tip | Tamamlanma kuralı |
|---|---|
| `check` | Tamamla düğmesi |
| `qty` | yapılan ≥ gereken (bkz. Adet kuralı) |
| `file` | en az bir dosya yüklenmiş olmalı (Findeks raporu, 3D çizim, sevkiyat/montaj fotoğrafı) |
| `text` | metin girilince tamamlanmış sayılır, silinince yeniden açılır (dijital baskı firması) |

Her adıma isteğe bağlı dosya eklenebilir; yalnızca `file` tipinde zorunludur.
Dosyalar Firebase Storage'da `projeler/<proje>/<iş emri>/` altında durur
(jpg, png, pdf, dwg, dxf, skp; 20 MB; görseller 1600 px'e küçültülür), kaydı
`files` koleksiyonundadır ve **silinmez, arşive alınır**. Proje kartındaki
Dosyalar sekmesi projedeki tüm dosyaları adıma göre toplar.

**Satın alma kalemleri** proje kartında tek tabloda durur: kalem · gereken /
gelen · özellik · tedarikçi · sipariş durumu (bekliyor · sipariş verildi ·
imalatta · geldi · eksik) · termin. Kalem kapanınca sipariş durumu “geldi”,
eksik kapatıldıysa “eksik” olur; “geldi” seçilince gelen adet gereken kadar
sayılır. Kabul edilen tekliften proje açılırken teklif kalemleri
`QUOTE_STEP_MAP` ile satın alma adımlarına **ön seçilir** (adet ve özellikle);
eşleşmeyenler sihirbazda serbest kalem olarak listelenir.

**Kilitler** (`js/locks.js`, karar 4):

- *Malzemeler geldi* (Depo): projedeki tüm satın alma kalemleri gelmeden kapanmaz.
- *Sevkiyat tamamlandı*: Üretim Planlama'nın tüm iş emirleri, satın alma
  kalemleri, Depo'nun koli ve yükleme listesi, Kalite kontrolü bitmeden kapanmaz.
  Muhasebe adımları (Findeks, sipariş onayı, ödeme) kilide **dahil değildir**.
- *Montaj tamamlandı*: sevkiyat bitmeden kapanmaz.

Kilitli adımın satırında bekleyen koşullar listelenir (“Kaplama — panel sayısı
30/35”, “Işıklı kaydırak 150: sipariş verildi”). Yönetici **Kilidi aş** ile
geçebilir; iş emri “kilit aşıldı” etiketi alır, bekleyen koşullar günlüğe yazılır.
Şef ve personel diğer departmanların iş emirlerini okuyamadığı için kilit
`locks/<proje>` özet belgesinden değerlendirilir: her iş emri yazımı buraya ad,
adım, departman, durum, sipariş durumu ve adetten oluşan küçük bir özet bırakır.

**Panel**: proje işleri yarısında “Eksik malzeme” sayacı, aktif projelerde
sipariş durumu “geldi” olmayan satın alma kalemlerini sayar.

## Veri kaybolmaz

- Projeler **arşivlenir**, silinmez. Arşivdeki projenin iş emirleri olduğu gibi durur.
- Dosyalar silinmez, arşive alınır; Storage kuralları silmeyi kapatır.
- Kalıcı silme yalnızca yöneticide ve yalnızca arşivlenmiş projede, çift onayla.
- Her değişiklik `log` koleksiyonuna kim–ne zaman–ne bilgisiyle yazılır.
  Bu koleksiyon **salt eklemedir**: kurallar update ve delete işlemlerini kapatır,
  yani geçmiş hiç kimse tarafından değiştirilemez. Kayıt başkası adına ya da
  başka bir tarihle de yazılamaz: kurallar `by` alanının giriş yapan kişinin
  e-postası, `at` alanının sunucu saati olmasını şart koşar. Proje kartındaki
  **Kayıtlar** sekmesi projeye ve iş emirlerine ait satırları gösterir.

## Proje dışı işler

Bakım, tamir, numune, atölye düzenleme gibi bir projeye bağlı olmayan işler için
departmanlara ya da kişilere iş emri açılır.

- **Proje Dışı İşler** sekmesinde *Yeni iş emri* (her rol): iş adı, açıklama,
  departman, bölüm, sorumlu (boş bırakılırsa departmanın / bölümün işi), termin,
  takip türü (tamamlandı işareti ya da gereken adet) ve **Acil** işareti.
  İş emrinde `openedBy` / `openedByDept` tutulur; başka departmana açılan iş
  “Açtıklarım” süzgecinde izlenir, hedef departman kapatır.
- Liste departman bantlarıyla gruplanır; Açık / Geciken / Acil / Açtıklarım /
  Tamamlanan / Tümü süzgeçleri, departman süzgeci ve arama vardır. Ad, açıklama
  ve acil işareti “düzenle” ile (planlayan roller). Kalıcı silme yalnızca yöneticide.
- Proje dışı iş emri, `tasks` koleksiyonunda `projectId` boş olan iş emridir. Bu
  yüzden yetkiler, adet kuralı, İşlerim ekranı ve günlük proje iş emirleriyle
  birebir aynı çalışır.
- **Panel** iki yarıdır: solda *Proje işleri*, sağda *Proje dışı işler*. Her yarıda
  açık / geciken / 7 gün içinde sayıları ve **dikkat gerektiren** işler listesi
  vardır. Altta departman yükü iki iş türünü ayrı renkte gösterir.

## Teklif modülü

Excel'deki teklif formunun yerini alır. İlk açılışta "Başlangıç verilerini yükle"
26 ürünlük kataloğu (Excel'deki ürün adları, yazım hataları düzeltilmiş), şirket
bilgilerini ve teklif koşullarını yükler. Fiyatlar elle girilir.

**Hazırlama**
- Ürün kutusuna adın bir parçası yazılır (“kaydırak”, “çit”) → Enter ile eklenir,
  imleç miktara, oradan fiyata geçer; fiyatta Enter yeniden ürün aramaya döner.
- Birim katalogdan gelir. Aynı ürüne daha önce fiyat verildiyse
  “son teklif: 165.000 ₺ — bu fiyatı kullan” ipucu çıkar.
- Katalog dışı kalem serbestçe yazılır, istenirse tek tıkla kataloğa eklenir.
- Bölüm başlıkları eklenir; satırlar numarasından tutulup sürüklenerek taşınır.
  Silinen kalem Ctrl+Z ile geri gelir.
- Daha önce teklif verilmiş firma adı yazılınca yetkili, telefon, adres dolar.
- İskonto (% ya da tutar), KDV (%20/%10/%1 ya da “KDV hariç”), para birimi
  (₺ $ €) seçilir; toplam ve yazıyla tutar anında hesaplanır.
- Belgede fiyatlar “kalem kalem” ya da Excel'deki gibi “yalnız toplam” basılır.
- 3D çizim/yerleşim görseli eklenebilir; tarayıcıda küçültülür (1,7 MB → ~250 KB)
  ve belgenin sonunda ek sayfa olarak basılır.
- Yazılanlar kendiliğinden kaydedilir; numara ilk kayıtta verilir (`TKL-2026-0001`).

**Gönderme ve takip**
- *Önizle* ekranı müşterinin göreceği A4 belgeyi gösterir. PDF, yazdırma
  penceresinde “PDF olarak kaydet” ile alınır; dosya adı teklif no + firmadır.
- *Taslak olarak yazdır*: üzerinde TASLAK yazar, teklif değişmeye açık kalır.
- *Gönder ve kilitle*: müşteri adı, kalem ve tüm fiyatlar tamsa teklifi
  “gönderildi” yapar ve **kilitler**; önizlemede kalınır, belge *Yazdır / PDF* ile
  alınır. Yazdırma bilerek ayrı bir dokunuştur: Safari `print()` çağrısını dokunuşun
  hemen ardından gelmezse yok sayar, bu yüzden `doPrint` senkron tutulur
  (`run.mjs` 10b bunu denetler). Kilit yalnızca ekranda değil, `firestore.rules`
  içinde de yazılı: taslak olmayan teklifte yalnızca durum, iç not, kayıp nedeni
  ve bağlantı alanları değişebilir; kalemler, fiyatlar, müşteri, KDV, iskonto,
  toplamlar ve görsel kurallarca kilitlidir. Gönderilmiş teklifi yeniden taslağa
  almak yalnızca yöneticide.
- Değişiklik gerekiyorsa **Revize et**: aynı numara `-R1`, `-R2` olarak açılır,
  önceki sürüm olduğu gibi saklanır. Listede yalnızca son sürüm görünür.
- Durumlar: Taslak → Gönderildi (geçerlilik geçince “Süresi doldu”) →
  Kabul / Red (kayıp nedeni yazılır) / İptal. Gönderilmiş teklif silinmez, iptal edilir.
- Kabul edilen tekliften **Üretim projesi aç**: sihirbaz müşteri bilgileriyle dolu
  açılır, kalemler satın alma adımlarına ön seçilir, proje ile teklif bağlanır.
- Aynı teklif başka bir oturumda değiştirilirse düzenleyen kişi uyarılır.

**Fiyat listesi kaynağı.** Ürünler ve perakende fiyatlar "Toysmar Takip - 2026"
Google Sheet'inde ("28/07 GÜNCEL.." sayfası) tutulur. Sayfanın yanında çalışan
Apps Script köprüsü (`tools/fiyat-koprusu.gs`) `GET <url>?key=<anahtar>` ile
yalnızca kod, ad, ebat, perakende fiyat ve grubu JSON olarak verir; toptan fiyat,
maliyet ve kur sayfada kalır, uygulamaya hiç inmez.

- Köprü adresi ve anahtarı `sales/source` belgesinde durur; kurallarda yalnızca
  **yönetici** okur ve yazar. Anahtar tarayıcıya iner (istemci tarafı uygulama) —
  bilinen sınır; anahtar yalnızca perakende listesine erişim verir, sayfanın
  kendisine değil.
- Yönetici Teklif ayarları → **Fiyat listesini güncelle** der. Gelen liste mevcut
  katalogla **kod** üzerinden karşılaştırılır ve onay penceresinde özetlenir:
  yeni ürünler, fiyatı değişenler (eski → yeni, % fark), adı/ebadı değişenler,
  listeden düşenler ve sayfadaki veri uyarıları. Onaylanınca katalog **tek
  yazma işlemiyle** güncellenir ve günlüğe yazılır. Değişiklik yoksa "Katalog
  güncel" denir, yazılmaz.
- Listeden düşen ürün silinmez, **pasif** olur: seçicide çıkmaz, eski tekliflerde
  kalem olarak durur. Elle eklenen ürünlere (`source: "manuel"`) dokunulmaz.
- Yinelenen kodlar `-2`, `-3` eki alır ve özette listelenir; kalıcı çözüm sayfada.
  Fiyatı 0 gelen ürün "fiyat girilmedi" etiketiyle gelir, seçilince fiyat elle girilir.
- Teklif ekranında seçici grup → ürün olarak açılır; kutuya yazınca kod, ad ve
  ebatta arar. Seçilen ürünün liste fiyatı kaleme **kopyalanır**, ebat açıklamaya
  düşer. Katalog sonra değişse de teklifteki kalem değişmez (test edilir).
- Katalog tek belgede (`sales/catalog`) tutulur: bir okuma, atomik yazma;
  1 MB belge sınırı yazmadan önce ölçülür (400 ürün ≈ 100 KB).

**Ayarlar** (Teklifler → Teklif ayarları): şirket ve banka bilgileri, kaşe/imza
görseli, yeni teklif varsayılanları, koşullar ve ürün kataloğu. Kaşe/imza görseli
depoda değil, yalnızca yetkili girişle okunan Firestore'da durur. Metinlerde
`{musteri}`, `{yetkili}`, `{gecerlilik}`, `{gun}` yer tutucuları kullanılabilir.

Firestore'da: `quotes` (teklifler), `quoteFiles` (teklif görselleri),
`sales/settings`, `sales/catalog` (ürünler + son içe aktarma bilgisi),
`sales/source` (köprü adresi ve anahtarı, yalnızca yönetici), `sales/counter`
(yıllık numara sayacı).

## Adet kuralı

Adet girilen adımlarda iki ayrı alan vardır: **gereken** ve **yapılan**.
Yapılan miktar gerekenden azsa adım tamamlanamaz. Gereken miktar sonradan
artırılırsa tamamlanmış adım kendiliğinden yeniden açılır. Yönetici isterse
"eksik kapat" diyebilir; bu durum satırda kalıcı olarak etiketlenir.

## Mevcut projeleri içe aktarma

Excel'deki 13 proje `toysmar-mevcut-projeler.json` olarak çıkarıldı. Dosya
müşteri telefonu, adresi ve ödeme koşulları taşıdığı için **depoya konmaz**
(depo herkese açık); yöneticinin kendi bilgisayarında durur. Testler bu dosya
yoksa müşteri bilgisi içermeyen `test/ornek-projeler.json` ile çalışır.
Yönetici Ayarlar → **Mevcut projeleri içe aktar** ile dosyayı seçer ya da
içeriğini yapıştırır; önce özet gelir (eklenecek / atlanacak / kod bekliyor),
kodu boş projelere özet penceresinde 2–4 harflik kod yazılır, onaylanınca proje,
iş emirleri, muhasebe bilgisi ve kilit özeti tek toplu yazımla kaydedilir,
günlüğe tek satır düşer. Kurallar: `tamamlandi` → iş emri kapalı,
`completedBy: excel-aktarim`, tarih boş; `devam` → açık, notu “İmalatta (Excel)”;
`siparis-verildi` → açık, sipariş durumu “sipariş verildi”; adetler olduğu gibi;
ISO olmayan terminler proje notuna düşer. Aynı kodlu proje ikinci çalıştırmada
atlanır. 2 numaralı (bedelsiz montaj) ve 12 numaralı (yedek parça) kayıtlar
tam proje değildir, aktarılır ama not düşülür.

## Dosya düzeni

```
index.html            uygulama kabuğu
assets/app.css        tasarım sistemi (renk yalnızca durum için)
assets/teklif.css     teklif düzenleyicisi ve A4 baskı belgesi
js/config.js          Firebase bağlantı değerleri
js/fb.js              SDK yükleme — sürüm tek yerde (Storage tembel yüklenir)
js/auth.js            giriş, erişim talebi ve yetki kapısı
js/roles.js           roller: ekranlar, görünürlük ve düzenleme kapsamı
js/store.js           Firestore okuma/yazma, kapsamlı sorgular, kilit özeti, günlük
js/seed.js            65 adımlık katalog (sürüm 2), eski katalogdan geçiş eşlemesi, teklif kalemi → adım
js/locks.js           Malzemeler geldi / Sevkiyat / Montaj kilitleri
js/files.js           iş emri dosyaları (Storage yükleme, arşiv)
js/import.js          Excel'den çıkarılmış mevcut projeleri içe aktarma
js/views.js           ekran çizimleri
js/app.js             yönlendirme, olaylar, iş kuralları
js/money.js           teklif hesapları: sayı okuma, toplam, KDV, yazıyla tutar
js/quotes.js          teklif verisi: numara, kaydetme, durum, revizyon, katalog
js/quote-views.js     teklif listesi, düzenleyici, ayarlar ve basılan belge
js/quote-app.js       teklif olayları: otomatik kayıt, ekleme, gönderme, yazdırma
js/sales-seed.js      teklif modülü başlangıç verileri (ürünler, koşullar)
firestore.rules       Firestore yetki kuralları (Console'a yapıştırılıp yayınlanır)
storage.rules         Storage kuralları (Console → Storage → Rules)
tools/                görev dosyası, adım kataloğu (JSON), fiyat köprüsü
test/                 sahte Firebase ile uçtan uca test (ornek-projeler.json: müşteri bilgisiz içe aktarma örneği)
```

## Test

Gerçek Firebase'e bağlanmadan, tarayıcıda tüm akışları çalıştırır:

```
node test/run.mjs
```

Senaryolar sürücüden bağımsızdır (`test/*-scenario.mjs`); `run.mjs` onları
Playwright ile, `test/runner.html` tarayıcıdaki iframe sürücüsüyle çağırır
(Node olmayan makinede bir statik sunucuyla `test/runner.html?run=1` açılır).

- `quote-scenario.mjs` — teklif modülü: sayı okuma, kalem, iskonto, KDV, kilit,
  revizyon, kabulden proje açma, rol görünürlüğü.
- `job-scenario.mjs` — proje dışı iş emirleri: açma, süzgeçler, adet kuralı, panel.
- `price-scenario.mjs` — fiyat listesi köprüsü ve katalog güncellemesi.
- `steps-scenario.mjs` — dosya ve metin tipinde adımlar, Storage kapalıyken uyarı,
  Dosyalar sekmesi ve arşiv; sürüm 1 katalogdan geçiş.
- `visibility-scenario.mjs` — metal personeli yalnızca Metal'i, kaplama personeli
  Kaplama'yı, Üretim Planlama şefi dört bölümü, Satın Alma şefi yalnızca
  kalemini, muhasebe her şeyi görür; başka departmana iş açma ve “Açtıklarım”.
- `purchase-scenario.mjs` — satın alma tablosu, sipariş durumu, tedarikçi,
  kilitler ve bekleyen listesi, eksik malzeme sayacı, yönetici kilit aşımı,
  tekliften ön seçim.
- `import-scenario.mjs` — Kayıtlar sekmesi, İşlerim bölüm süzgeci, mevcut
  projelerin içe aktarımı ve ikinci çalıştırmada kopya oluşmaması.

Sahte Firebase `firestore.rules` ve `storage.rules` kurallarını uygulamaz; kural
katmanındaki sınırlar Firebase Console → Rules → *Rules Playground* ya da
Firestore emülatörüyle doğrulanır. Sahte katman `where()` süzgecini ve
`setDoc(merge)` birleştirmesini gerçek SDK gibi uygular.

`?as=eposta` ile başka bir kullanıcı, `?as=yok` ile çıkış durumu denenebilir.
Şifre akışları için `window.__MOCK_VERIFY__("eposta")` doğrulama bağlantısına
tıklanmasını taklit eder; `window.__MOCK_STORAGE_FAIL__ = "storage/unknown"`
Storage'ın kapalı olduğu durumu taklit eder.

## Kurulum (bir kez yapıldı)

1. Firebase Console → proje oluştur
2. Firestore Database → production mode → `eur3`
3. Authentication → Sign-in method → **Google** ve **Email/Password** → ikisini de etkinleştir
4. Project settings → Your apps → Web → `firebaseConfig` değerlerini `js/config.js` içine yaz
5. Authentication → Settings → Authorized domains → `<kullanici>.github.io` ekle
6. Firestore → Rules → `firestore.rules` içeriğini yapıştır → Publish
7. Firestore → Data → `allowed` koleksiyonu → belge kimliği = yöneticinin Gmail'i,
   alanlar: `name` (string), `role` = `yonetici`
8. Dosya yükleme için: proje **Blaze** planına alınır (5 GB'a kadar ücretsiz),
   Storage açılır, Storage → Rules → `storage.rules` yapıştırılır → Publish

Uygulamaya ilk girişte "Kataloğu yükle ve başla" düğmesi katalog, departman ve
ilk personel kaydını oluşturur. Teklifler ekranındaki "Başlangıç verilerini yükle"
teklif modülünü kurar. Eski kurulumda Ayarlar → “Yeni kataloğa geç”.

## Revize akışı

Tek kaynak bu depo. Değişiklik Claude'a yazılır; gerisi otomatiktir.

1. Claude depoyu çeker (`git pull`) — başkasının yaptığı değişikliğin üzerine yazılmaz.
2. Dosyaları düzenler, davranış değiştiyse testini de ekler, commit atıp `main`'e push'lar.
3. GitHub Actions (`.github/workflows/yayin.yml`) sırayla çalışır:
   - **test** — `node test/run.mjs`. Bir test kalırsa hiçbir şey yayına çıkmaz.
   - **kurallar** — `firestore.rules` değiştiyse Firebase'e yayınlanır; derlenemezse durur.
   - **site** — `index.html`, `assets/`, `js/` GitHub Pages'e çıkar (`test/` yayınlanmaz).
4. Claude çalışmanın sonucunu izler, canlı sitenin yeni sürümü sunduğunu doğrular
   ve sonucu bildirir. Kalan test ya da hata varsa düzeltip tekrar gönderir.

Tek seferlik kurulum: bu makinede git ve GitHub oturumu, depoda Pages kaynağının
“GitHub Actions” olması ve `FIREBASE_SERVICE_ACCOUNT` gizli anahtarı. Bu kurulum
tamamlanana kadar `firestore.rules` ve `storage.rules` Console'a elle yapıştırılır.
