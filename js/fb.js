// Firebase bağlantısı. Tek giriş noktası — SDK sürümü sadece burada geçer.
//
// Test için: sayfa yüklenmeden önce window.__TOYSMAR_MOCK__ tanımlanmışsa
// gerçek Firebase yerine o kullanılır. Üretimde bu değişken hiç tanımlanmaz.

import { firebaseConfig } from "./config.js";

const V = "12.19.0";
const BASE = "https://www.gstatic.com/firebasejs/" + V + "/";

let bundle = null;

export async function fb() {
  if (bundle) return bundle;

  if (window.__TOYSMAR_MOCK__) {
    bundle = window.__TOYSMAR_MOCK__;
    return bundle;
  }

  const [appMod, authMod, fsMod] = await Promise.all([
    import(BASE + "firebase-app.js"),
    import(BASE + "firebase-auth.js"),
    import(BASE + "firebase-firestore.js")
  ]);

  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  const db = fsMod.getFirestore(app);

  try { await authMod.setPersistence(auth, authMod.browserLocalPersistence); } catch (e) {}

  bundle = {
    app, auth, db,
    // auth
    GoogleAuthProvider: authMod.GoogleAuthProvider,
    signInWithPopup: authMod.signInWithPopup,
    signOut: authMod.signOut,
    onAuthStateChanged: authMod.onAuthStateChanged,
    // firestore
    doc: fsMod.doc,
    collection: fsMod.collection,
    getDoc: fsMod.getDoc,
    getDocs: fsMod.getDocs,
    setDoc: fsMod.setDoc,
    updateDoc: fsMod.updateDoc,
    deleteDoc: fsMod.deleteDoc,
    addDoc: fsMod.addDoc,
    onSnapshot: fsMod.onSnapshot,
    query: fsMod.query,
    where: fsMod.where,
    orderBy: fsMod.orderBy,
    limit: fsMod.limit,
    writeBatch: fsMod.writeBatch,
    serverTimestamp: fsMod.serverTimestamp
  };
  return bundle;
}
