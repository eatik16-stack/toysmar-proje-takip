# Toysmar Proje Takip — çalışma yönergesi

Satış teklifi + üretim planlama uygulaması. Çerçevesiz statik ES modülleri
(`js/`), Firebase Auth + Firestore, GitHub Pages. Derleme adımı yoktur.
Önce `README.md` oku; mimari, roller ve modüller orada.

## Çalışma düzeni

1. Başlamadan `git pull`. Depoyu başkaları da (claude.ai sohbeti, elle yükleme)
   değiştiriyor; yerelde olmayan değişikliğin üzerine yazma, birleştir.
2. Davranış değişiyorsa testi de değişir/eklenir. Senaryolar `test/*-scenario.mjs`
   içinde, sürücüden bağımsızdır; `test/run.mjs` onları Playwright ile çağırır.
3. Testler geçmeden commit yok. Node yoksa senaryolar tarayıcıda DOM sürücüsüyle
   koşturulur (`test/index.html` bir statik sunucuyla açılır, `file://` çalışmaz).
4. `main`'e push → `.github/workflows/yayin.yml`: test → `firestore.rules`
   değiştiyse Firebase'e yayın → GitHub Pages. Kurallar elle yapıştırılmaz.
5. Commit mesajı Türkçe, ilk satır neyin neden değiştiğini söyler.

## Kurallar (bunları bozma)

- **Ekran gizlemek güvenlik değildir.** Her yetki sınırı `firestore.rules`'ta da
  yazılır. Rol adları `js/roles.js` ile `firestore.rules`'ta birebir aynı.
- **Veri kaybolmaz.** Silme yerine arşiv/pasif; `log` koleksiyonu salt ekleme.
- **Gönderilmiş teklif değişmez.** Kilit hem ekranda hem kurallarda; değişiklik
  yeni revizyonla (`-R1`). Teklif kalemi katalog fiyatını kopyalar, sonradan
  katalog değişse de kalem değişmez.
- **Fiyatlar yalnızca `yonetici` ve `satis` rollerine iner.** Toptan fiyat,
  maliyet, kur uygulamaya hiç gelmez (`tools/fiyat-koprusu.gs` yalnızca perakende
  verir; köprüyü genişletme).
- **Yazdırma senkron kalır.** Safari `print()` çağrısını dokunuşun devamı değilse
  yok sayar; `doPrint` içine `await` koyma (`run.mjs` 10b bunu denetler).
- **Düzenleyici yeniden çizilmez.** Teklif düzenleyicisi ve açık modaller gelen
  veri güncellemesinde baştan çizilmez (yazılanı silerdi); canlı parçalar
  `setHtml` ile yamanır. Yapısal değişiklikte `rebuild()`.
- Renk yalnızca durum için; gruplar tipografiyle ayrılır (`assets/app.css`).
- Türkçe metinler doğru karakterle (ı/İ, ş, ğ); arama `toLocaleLowerCase("tr-TR")`.

## Tuzaklar

- Sahte Firebase (`test/mock-firebase.js`) kuralları uygulamaz; kural
  değişikliğini Rules Playground ya da emülatörle doğrula.
- `sales/catalog` tek belge: yazmadan önce boyut ölçülür (1 MB sınırı).
- Katalog ürün kimliği: listeden gelenlerde normalize kod, elle eklenenlerde `uid()`.
- Test sürücüsü `press` gerçek klavye olayı değil; `keydown` ile dinlenen
  tuşlar için yeterli, `input` üretmez.
