// Firebase web yapılandırması.
// Bu değerler gizli değildir — herkese açık olmak üzere tasarlanmışlardır.
// Güvenlik, Google girişi + firestore.rules içindeki yetki kurallarıyla sağlanır.
//
// Firebase Console → dişli → Project settings → Your apps → web uygulaması
// ekranındaki firebaseConfig bloğundaki değerler buraya yazılır.

export const firebaseConfig = {
  apiKey: "AIzaSyCGP2doo8iwCvHqIX4BRrctpgxrxDP4bUI",
  authDomain: "toysmar-takip.firebaseapp.com",
  projectId: "toysmar-takip",
  storageBucket: "toysmar-takip.firebasestorage.app",
  messagingSenderId: "654062694400",
  appId: "1:654062694400:web:97e6fbbb969674e629e8e5"
};

export const APP = {
  name: "Toysmar Proje Takip",
  short: "Toysmar",
  // Firebase SDK sürümü — js/fb.js buradan değil, kendi sabitinden okur;
  // sürüm değişikliği tek yerde, fb.js içinde yapılır.
  sdk: "12.19.0"
};

export function configReady() {
  // Testte sahte katman kullanılıyorsa gerçek değerlere gerek yok.
  if (typeof window !== "undefined" && window.__TOYSMAR_MOCK__) return true;
  return Object.keys(firebaseConfig).every(function (k) {
    var v = firebaseConfig[k];
    return typeof v === "string" && v && v.indexOf("YAPILANDIRMA_BEKLENIYOR") === -1;
  });
}
