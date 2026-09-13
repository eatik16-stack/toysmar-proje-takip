# Toysmar Proje Takip

Toysmar Oyun Grupları için satış teklifi ve üretim planlama uygulaması.
Teklif ürün kataloğundan hazırlanır, A4 belge olarak basılır ve takip edilir;
kabul edilen teklif üretim projesine dönüşür. Projenin kapsamı 33 adımlık
katalogdan seçilir, seçilen her adım bir personele **iş emri** olarak atanır,
termin ve tamamlanma takip edilir.

**Canlı adres:** https://eatik16-stack.github.io/toysmar-proje-takip/
**Giriş:** kendi şifresiyle ya da Google ile — yalnızca yetkilendirilmiş hesaplar

---

## Nasıl çalışıyor

| Katman | Ne | Nerede |
|---|---|---|
| Arayüz | Statik tek sayfa uygulama, çerçeve yok | GitHub Pages |
| Giriş | Firebase Authentication — e-posta/şifre ve Google | `js/auth.js` |
| Roller | Rol → ekran ve düzenleme kapsamı | `js/roles.js` |
| Veri | Cloud Firestore, gerçek zamanlı | `js/store.js` |
| Yetki | `allowed` koleksiyonu + `firestore.rules` | Firestore |

Kimin gireceği **kurallarda değil, veride** tutulur: `allowed/<e-posta>` belgesi
olan girer. `firestore.rules` yalnızca yeni bir modül ya da rol eklendiğinde
yeniden yayınlanır (en son: teklif modülü ve Satış rolü).

## Kim nasıl giriyor

Yeni kişi kendini ekleyemez, **bir kereliğine erişim talebi** bırakır:

1. Giriş ekranında “Erişim izni isteyin” — ad soyad, e-posta, **görevi** ve
   kendi belirlediği şifre.
2. Firebase doğrulama e-postası yollar. Talep, kişi e-postasını doğrulayana
   kadar Firestore'a **yazılmaz**; doğrulama tamamlanınca yöneticiye düşer.
3. Yönetici **Talepler** ekranında görevi görür, bir rol seçer ve onaylar.
   Onayla birlikte personel kaydı ve giriş yetkisi birlikte açılır.
4. Kişi bundan sonra e-postası ve şifresiyle girer. Google ile giriş de çalışır.

Talep belgesi e-posta başına tektir ve kurallarda yalnızca *create* açıktır —
reddedilen bir talep kişi tarafından tekrar açılamaz.

## Roller

| Rol | Gördüğü ekranlar | Düzenleyebildiği iş emirleri |
|---|---|---|
| Yönetici | Hepsi | Hepsi |
| Planlamacı | Panel, Projeler, İşlerim, Yeni Proje, Kayıtlar | Hepsi |
| Satış | Teklifler, Projeler (izleme) | Yalnızca kendine atananlar |
| Şef | Panel, Projeler, İşlerim | Kendi departmanınınkiler |
| Personel | Projeler, İşlerim | Yalnızca kendine atananlar |

Silme, giriş yetkisi verme ve Ayarlar yalnızca yöneticide. Fiyatlar yalnızca
Yönetici ve Satış rollerine açıktır; diğer rollerde teklif verisi hiç yüklenmez
ve kurallar okumayı reddeder.

Ekran gizlemek güvenlik değildir: aynı sınır `firestore.rules` içinde de
yazılıdır. Rol adları iki dosyada birebir aynı olmalı — `js/roles.js` ve
`firestore.rules`.

## Veri kaybolmaz

- Projeler **arşivlenir**, silinmez. Arşivdeki projenin iş emirleri olduğu gibi durur.
- Kalıcı silme yalnızca yöneticide ve yalnızca arşivlenmiş projede, çift onayla.
- Her değişiklik `log` koleksiyonuna kim–ne zaman–ne bilgisiyle yazılır.
  Bu koleksiyon **salt eklemedir**: kurallar update ve delete işlemlerini kapatır,
  yani geçmiş hiç kimse tarafından değiştirilemez.

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
- *Gönder: kilitle ve yazdır*: müşteri adı, kalem ve tüm fiyatlar tamsa teklifi
  “gönderildi” yapar ve **kilitler**. Gönderilmiş teklifin kalemleri değişmez.
- Değişiklik gerekiyorsa **Revize et**: aynı numara `-R1`, `-R2` olarak açılır,
  önceki sürüm olduğu gibi saklanır. Listede yalnızca son sürüm görünür.
- Durumlar: Taslak → Gönderildi (geçerlilik geçince “Süresi doldu”) →
  Kabul / Red (kayıp nedeni yazılır) / İptal. Gönderilmiş teklif silinmez, iptal edilir.
- Kabul edilen tekliften **Üretim projesi aç**: sihirbaz müşteri bilgileriyle dolu
  açılır, proje ile teklif birbirine bağlanır.
- Aynı teklif başka bir oturumda değiştirilirse düzenleyen kişi uyarılır.

**Ayarlar** (Teklifler → Teklif ayarları): şirket ve banka bilgileri, kaşe/imza
görseli, yeni teklif varsayılanları, koşullar ve ürün kataloğu. Kaşe/imza görseli
depoda değil, yalnızca yetkili girişle okunan Firestore'da durur. Metinlerde
`{musteri}`, `{yetkili}`, `{gecerlilik}`, `{gun}` yer tutucuları kullanılabilir.

Firestore'da: `quotes` (teklifler), `quoteFiles` (teklif görselleri),
`sales/settings`, `sales/catalog`, `sales/counter` (yıllık numara sayacı).

## Adet kuralı

Adet girilen adımlarda iki ayrı alan vardır: **gereken** ve **yapılan**.
Yapılan miktar gerekenden azsa adım tamamlanamaz. Gereken miktar sonradan
artırılırsa tamamlanmış adım kendiliğinden yeniden açılır. Yönetici isterse
"eksik kapat" diyebilir; bu durum satırda kalıcı olarak etiketlenir.

## Dosya düzeni

```
index.html            uygulama kabuğu
assets/app.css        tasarım sistemi (renk yalnızca durum için)
assets/teklif.css     teklif düzenleyicisi ve A4 baskı belgesi
js/config.js          Firebase bağlantı değerleri
js/fb.js              SDK yükleme — sürüm tek yerde
js/auth.js            giriş, erişim talebi ve yetki kapısı
js/roles.js           roller: hangi rol hangi ekranı görür
js/store.js           Firestore okuma/yazma + günlük
js/seed.js            ilk kurulumdaki 33 adımlık katalog
js/views.js           ekran çizimleri
js/app.js             yönlendirme, olaylar, iş kuralları
js/money.js           teklif hesapları: sayı okuma, toplam, KDV, yazıyla tutar
js/quotes.js          teklif verisi: numara, kaydetme, durum, revizyon, katalog
js/quote-views.js     teklif listesi, düzenleyici, ayarlar ve basılan belge
js/quote-app.js       teklif olayları: otomatik kayıt, ekleme, gönderme, yazdırma
js/sales-seed.js      teklif modülü başlangıç verileri (ürünler, koşullar)
firestore.rules       yetki kuralları (Console'a yapıştırılıp yayınlanır)
test/                 sahte Firebase ile uçtan uca test
```

## Test

Gerçek Firebase'e bağlanmadan, tarayıcıda tüm akışları çalıştırır:

```
node test/run.mjs
```

Playwright kurulu değilse aynı akışlar tarayıcıda elle koşulabilir:
`test/index.html` bir statik sunucuyla açılır (`file://` ile modüller yüklenmez).
`?as=eposta` ile başka bir kullanıcı, `?as=yok` ile çıkış durumu denenebilir.
Şifre akışları için `window.__MOCK_VERIFY__("eposta")` doğrulama bağlantısına
tıklanmasını taklit eder; gönderilmiş sayılan e-postalar `window.__MOCK_MAILS__`
içinde durur.

## Kurulum (bir kez yapıldı)

1. Firebase Console → proje oluştur
2. Firestore Database → production mode → `eur3`
3. Authentication → Sign-in method → **Google** ve **Email/Password** → ikisini de etkinleştir
4. Project settings → Your apps → Web → `firebaseConfig` değerlerini `js/config.js` içine yaz
5. Authentication → Settings → Authorized domains → `<kullanici>.github.io` ekle
6. Firestore → Rules → `firestore.rules` içeriğini yapıştır → Publish
7. Firestore → Data → `allowed` koleksiyonu → belge kimliği = yöneticinin Gmail'i,
   alanlar: `name` (string), `role` = `yonetici`

Uygulamaya ilk girişte "Kataloğu yükle ve başla" düğmesi katalog, departman ve
ilk personel kaydını oluşturur. Teklifler ekranındaki "Başlangıç verilerini yükle"
teklif modülünü kurar.

## Revize akışı

Tek kaynak bu depo.

1. Değişiklik Claude'a yazılır.
2. Claude dosyaları düzenler ve akışları sahte Firebase ile tarayıcıda koşar —
   testler geçmeden teslim edilmez.
3. Claude değişen dosyaları klasör yapısıyla zip olarak verir; github.com'da
   **Add file → Upload files** ile yüklenir (Claude'un GitHub bağlantısı yazamıyor).
4. Claude depodaki dosya özetlerini (hash) yerel kopyayla karşılaştırıp yüklemeyi
   doğrular; GitHub Pages birkaç dakika içinde yayına alır.
5. `firestore.rules` değiştiyse içeriği Firebase Console → Firestore → Rules'a
   yapıştırılıp **Publish** edilir.
