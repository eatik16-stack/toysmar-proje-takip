# Toysmar Proje Takip

Toysmar Oyun Grupları üretim planlama için proje yönetim ve takip uygulaması.
Projenin kapsamı 33 adımlık katalogdan seçilir, seçilen her adım bir personele
**iş emri** olarak atanır, termin ve tamamlanma takip edilir.

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
olan girer. `firestore.rules` bir kez yayınlanır ve bir daha değiştirilmesi
gerekmez.

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
| Şef | Panel, Projeler, İşlerim | Kendi departmanınınkiler |
| Personel | Projeler, İşlerim | Yalnızca kendine atananlar |

Silme, giriş yetkisi verme ve Ayarlar yalnızca yöneticide.

Ekran gizlemek güvenlik değildir: aynı sınır `firestore.rules` içinde de
yazılıdır. Rol adları iki dosyada birebir aynı olmalı — `js/roles.js` ve
`firestore.rules`.

## Veri kaybolmaz

- Projeler **arşivlenir**, silinmez. Arşivdeki projenin iş emirleri olduğu gibi durur.
- Kalıcı silme yalnızca yöneticide ve yalnızca arşivlenmiş projede, çift onayla.
- Her değişiklik `log` koleksiyonuna kim–ne zaman–ne bilgisiyle yazılır.
  Bu koleksiyon **salt eklemedir**: kurallar update ve delete işlemlerini kapatır,
  yani geçmiş hiç kimse tarafından değiştirilemez.

## Adet kuralı

Adet girilen adımlarda iki ayrı alan vardır: **gereken** ve **yapılan**.
Yapılan miktar gerekenden azsa adım tamamlanamaz. Gereken miktar sonradan
artırılırsa tamamlanmış adım kendiliğinden yeniden açılır. Yönetici isterse
"eksik kapat" diyebilir; bu durum satırda kalıcı olarak etiketlenir.

## Dosya düzeni

```
index.html            uygulama kabuğu
assets/app.css        tasarım sistemi (renk yalnızca durum için)
js/config.js          Firebase bağlantı değerleri
js/fb.js              SDK yükleme — sürüm tek yerde
js/auth.js            giriş, erişim talebi ve yetki kapısı
js/roles.js           roller: hangi rol hangi ekranı görür
js/store.js           Firestore okuma/yazma + günlük
js/seed.js            ilk kurulumdaki 33 adımlık katalog
js/views.js           ekran çizimleri
js/app.js             yönlendirme, olaylar, iş kuralları
firestore.rules       yetki kuralları (Console'a bir kez yapıştırılır)
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
ilk personel kaydını oluşturur.

## Revize akışı

Tek kaynak bu depo. Elle dosya kopyalama ya da yükleme yoktur.

1. Değişiklik Claude'a yazılır.
2. Claude dosyaları düzenler ve testleri koşar — testler geçmeden commit atılmaz.
   Davranış değişiyorsa o davranışın testi de eklenir.
3. Claude doğrudan GitHub API ile bu depoya commit atar; GitHub Pages birkaç
   dakika içinde yayına alır.
