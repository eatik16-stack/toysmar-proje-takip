# Toysmar Proje Takip

Toysmar Oyun Grupları üretim planlama için proje yönetim ve takip uygulaması.
Projenin kapsamı 33 adımlık katalogdan seçilir, seçilen her adım bir personele
**iş emri** olarak atanır, termin ve tamamlanma takip edilir.

**Canlı adres:** https://eatik16-stack.github.io/toysmar-proje-takip/
**Giriş:** yalnızca yetkilendirilmiş Google hesapları

---

## Nasıl çalışıyor

| Katman | Ne | Nerede |
|---|---|---|
| Arayüz | Statik tek sayfa uygulama, çerçeve yok | GitHub Pages |
| Giriş | Firebase Authentication — Google | `js/auth.js` |
| Veri | Cloud Firestore, gerçek zamanlı | `js/store.js` |
| Yetki | `allowed` koleksiyonu + `firestore.rules` | Firestore |

Kimin gireceği **kurallarda değil, veride** tutulur: `allowed/<e-posta>` belgesi
olan girer. Yeni personel Ayarlar ekranından eklenir; `firestore.rules` bir kez
yayınlanır ve bir daha değiştirilmesi gerekmez.

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
js/auth.js            Google girişi ve yetki kapısı
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

Tarayıcıda elle denemek için `test/index.html` açılır.
`?as=eposta` ile başka bir kullanıcı, `?as=yok` ile çıkış durumu denenebilir.

## Kurulum (bir kez yapıldı)

1. Firebase Console → proje oluştur
2. Firestore Database → production mode → `eur3`
3. Authentication → Sign-in method → Google → etkinleştir
4. Project settings → Your apps → Web → `firebaseConfig` değerlerini `js/config.js` içine yaz
5. Authentication → Settings → Authorized domains → `<kullanici>.github.io` ekle
6. Firestore → Rules → `firestore.rules` içeriğini yapıştır → Publish
7. Firestore → Data → `allowed` koleksiyonu → belge kimliği = yöneticinin Gmail'i,
   alanlar: `name` (string), `role` = `yonetici`

Uygulamaya ilk girişte "Kataloğu yükle ve başla" düğmesi katalog, departman ve
ilk personel kaydını oluşturur.

## Revize akışı

Kaynağın iki kopyası var: bilgisayardaki `C:\Toysmar` klasörü ve bu depo.
İkisini de Claude güncel tutar, elle dosya kopyalama ya da yükleme yoktur.

1. Değişiklik Claude'a yazılır.
2. Claude `C:\Toysmar` klasöründeki dosyaları düzenler.
3. `node test/run.mjs` çalıştırılır — testler geçmeden sonraki adıma geçilmez.
   Davranış değişiyorsa o davranışın testi de eklenir.
4. Değişen dosyalar `C:\Toysmar` klasörüne geri yazılır. Klasördeki dosya
   aradan sen değiştirdiysen üzerine yazılmaz, önce haber verilir.
5. Claude, Claude uygulamasının tarayıcı panelinden bu depoya commit atar;
   GitHub Pages birkaç dakika içinde yayına alır.

5. adım için panelde GitHub oturumunun açık olması yeterlidir; oturum panelde
kalıcıdır. Depo Claude oturumuna doğrudan bağlanabilirse bu adım commit'i
doğrudan GitHub API ile atmaya döner, akışın geri kalanı aynı kalır.
