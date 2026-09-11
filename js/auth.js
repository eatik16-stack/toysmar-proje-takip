// Google ile giriş ve yetki kapısı.
//
// Giriş yapmak yetmez: kişinin e-postası Firestore'daki "allowed"
// koleksiyonunda kayıtlı olmalı. Kayıtlı değilse uygulama açılmaz.

import { fb } from "./fb.js";

export const session = {
  state: "loading",   // loading | anon | denied | ready | error
  user: null,         // { email, name, photo }
  member: null,       // allowed/<email> belgesi: { name, role, dept }
  error: ""
};

export function isAdmin() {
  return !!(session.member && session.member.role === "yonetici");
}

export function myEmail() {
  return session.user ? String(session.user.email || "").toLowerCase() : "";
}

export function myName() {
  if (session.member && session.member.name) return session.member.name;
  if (session.user && session.user.name) return session.user.name;
  return myEmail();
}

export async function watchSession(onChange) {
  let f;
  try {
    f = await fb();
  } catch (e) {
    session.state = "error";
    session.error = (e && e.message) || "Firebase başlatılamadı.";
    onChange(session);
    return;
  }

  f.onAuthStateChanged(f.auth, async function (user) {
    if (!user) {
      session.state = "anon"; session.user = null; session.member = null;
      onChange(session);
      return;
    }
    session.user = {
      email: String(user.email || "").toLowerCase(),
      name: user.displayName || "",
      photo: user.photoURL || ""
    };
    try {
      const snap = await f.getDoc(f.doc(f.db, "allowed", session.user.email));
      if (snap.exists()) {
        session.member = Object.assign({ role: "personel" }, snap.data());
        session.state = "ready";
      } else {
        session.member = null;
        session.state = "denied";
      }
    } catch (e) {
      // Kurallar erişimi engellediğinde de buraya düşer — sonuç aynı: yetki yok.
      session.member = null;
      session.state = "denied";
      session.error = (e && e.message) || "";
    }
    onChange(session);
  });
}

export async function signIn() {
  const f = await fb();
  const provider = new f.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await f.signInWithPopup(f.auth, provider);
  } catch (e) {
    const code = (e && e.code) || "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
    if (code === "auth/unauthorized-domain") {
      throw new Error("Bu adres Firebase'de yetkili değil. Authentication → Settings → Authorized domains listesine eklenmeli.");
    }
    if (code === "auth/operation-not-allowed") {
      throw new Error("Google ile giriş Firebase'de açık değil. Authentication → Sign-in method → Google açılmalı.");
    }
    throw e;
  }
}

export async function signOutNow() {
  const f = await fb();
  await f.signOut(f.auth);
}
