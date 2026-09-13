// Testte gerçek Firebase yerine geçen sahte katman.
// Yalnızca test/index.html tarafından yüklenir; üretimde hiç çalışmaz.
// Gerçek SDK'nın davranışını taklit eder: belgeler donmuş döner,
// dinleyiciler yazmadan sonra yeniden tetiklenir.

(function () {
  // Sayfa yenilense de veri kalsın (giriş/çıkış senaryolarını test edebilmek için).
  const KEY = "toysmar.mockdb";
  const UKEY = "toysmar.mockusers";
  let seeded = {}, seededUsers = {};
  try { seeded = JSON.parse(sessionStorage.getItem(KEY) || "{}"); } catch (e) {}
  try { seededUsers = JSON.parse(sessionStorage.getItem(UKEY) || "{}"); } catch (e) {}

  const DB = seeded;          // "koleksiyon/kimlik" -> gövde
  const USERS = seededUsers;  // e-posta -> { password, displayName, emailVerified }
  const docListeners = [];    // { path, cb }
  const colListeners = [];    // { col, cb }
  const auth = { __mock: true, currentUser: null };
  let authCb = null;

  function persist() {
    try { sessionStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {}
  }
  function persistUsers() {
    try { sessionStorage.setItem(UKEY, JSON.stringify(USERS)); } catch (e) {}
  }

  window.__MOCK_DB__ = DB;
  window.__MOCK_USERS__ = USERS;
  window.__MOCK_MAILS__ = [];     // gönderilmiş sayılan e-postalar
  window.__MOCK_WRITES__ = [];
  window.__MOCK_RESET__ = function () {
    Object.keys(DB).forEach(function (k) { delete DB[k]; });
    persist();
  };
  // Kullanıcının doğrulama bağlantısına tıklamasını taklit eder.
  window.__MOCK_VERIFY__ = function (mail) {
    const rec = USERS[String(mail || "").toLowerCase()];
    if (rec) { rec.emailVerified = true; persistUsers(); }
  };

  function userObj(key) {
    const rec = USERS[key] || {};
    return {
      email: key, displayName: rec.displayName || "",
      photoURL: "", emailVerified: !!rec.emailVerified
    };
  }
  function setUser(u) {
    auth.currentUser = u;
    if (authCb) authCb(u);
  }

  function deepFreeze(o) {
    if (o && typeof o === "object" && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.getOwnPropertyNames(o).forEach(function (k) { deepFreeze(o[k]); });
    }
    return o;
  }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }

  function docSnap(path) {
    const body = DB[path];
    return {
      id: path.split("/").pop(),
      exists: function () { return body !== undefined; },
      data: function () { return body === undefined ? undefined : deepFreeze(clone(body)); }
    };
  }
  function colSnap(col) {
    const rows = Object.keys(DB).filter(function (p) { return p.indexOf(col + "/") === 0; })
      .map(function (p) { return docSnap(p); });
    return {
      docs: rows, size: rows.length, empty: !rows.length,
      forEach: function (fn) { rows.forEach(fn); }
    };
  }
  function fire(path) {
    const col = path.split("/")[0];
    docListeners.filter(function (l) { return l.path === path; }).forEach(function (l) { l.cb(docSnap(path)); });
    colListeners.filter(function (l) { return l.col === col; }).forEach(function (l) { l.cb(colSnap(col)); });
  }

  function ref(col, id) { return { __path: col + "/" + id, __col: col, id: id }; }

  const api = {
    db: { __mock: true },
    auth: auth,

    /* ---- auth ---- */
    GoogleAuthProvider: function () { this.setCustomParameters = function () {}; },
    signInWithPopup: function () {
      setUser(window.__MOCK_GOOGLE_USER__ || window.__MOCK_USER__ || null);
      return Promise.resolve({ user: auth.currentUser });
    },
    signOut: function () { setUser(null); return Promise.resolve(); },
    onAuthStateChanged: function (a, cb) {
      authCb = cb;
      setTimeout(function () {
        auth.currentUser = window.__MOCK_USER__ || null;
        cb(auth.currentUser);
      }, 0);
      return function () {};
    },

    createUserWithEmailAndPassword: function (a, mail, pass) {
      const key = String(mail || "").toLowerCase();
      if (USERS[key]) return Promise.reject({ code: "auth/email-already-in-use" });
      if (!pass || pass.length < 6) return Promise.reject({ code: "auth/weak-password" });
      USERS[key] = { password: pass, displayName: "", emailVerified: false };
      persistUsers();
      setUser(userObj(key));
      return Promise.resolve({ user: auth.currentUser });
    },
    signInWithEmailAndPassword: function (a, mail, pass) {
      const key = String(mail || "").toLowerCase();
      const rec = USERS[key];
      if (!rec) return Promise.reject({ code: "auth/user-not-found" });
      if (rec.password !== pass) return Promise.reject({ code: "auth/wrong-password" });
      setUser(userObj(key));
      return Promise.resolve({ user: auth.currentUser });
    },
    sendEmailVerification: function (u) {
      window.__MOCK_MAILS__.push(["dogrulama", u && u.email]);
      return Promise.resolve();
    },
    sendPasswordResetEmail: function (a, mail) {
      const key = String(mail || "").toLowerCase();
      if (!USERS[key]) return Promise.reject({ code: "auth/user-not-found" });
      window.__MOCK_MAILS__.push(["sifirlama", key]);
      return Promise.resolve();
    },
    updateProfile: function (u, patch) {
      const key = String((u && u.email) || "").toLowerCase();
      if (USERS[key]) { USERS[key].displayName = (patch && patch.displayName) || ""; persistUsers(); }
      if (u) u.displayName = (patch && patch.displayName) || "";
      return Promise.resolve();
    },
    reload: function (u) {
      const rec = USERS[String((u && u.email) || "").toLowerCase()];
      if (rec && u) u.emailVerified = !!rec.emailVerified;
      return Promise.resolve();
    },

    /* ---- firestore ---- */
    doc: function (db, col, id) { return ref(col, id); },
    collection: function (db, col) { return { __col: col }; },

    getDoc: function (r) { return Promise.resolve(docSnap(r.__path)); },
    getDocs: function (q) {
      const col = q.__col;
      let rows = colSnap(col).docs;
      if (q.__order) {
        rows = rows.slice().sort(function (a, b) {
          const av = String((a.data() || {})[q.__order.field] || "");
          const bv = String((b.data() || {})[q.__order.field] || "");
          return q.__order.dir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
        });
      }
      if (q.__limit) rows = rows.slice(0, q.__limit);
      return Promise.resolve({
        docs: rows, size: rows.length, empty: !rows.length,
        forEach: function (fn) { rows.forEach(fn); }
      });
    },

    setDoc: function (r, body) {
      DB[r.__path] = clone(body);
      window.__MOCK_WRITES__.push(["set", r.__path]); persist();
      fire(r.__path); return Promise.resolve();
    },
    updateDoc: function (r, patch) {
      if (DB[r.__path] === undefined) return Promise.reject(new Error("No document to update: " + r.__path));
      DB[r.__path] = Object.assign({}, DB[r.__path], clone(patch));
      window.__MOCK_WRITES__.push(["update", r.__path]); persist();
      fire(r.__path); return Promise.resolve();
    },
    deleteDoc: function (r) {
      delete DB[r.__path];
      window.__MOCK_WRITES__.push(["delete", r.__path]); persist();
      fire(r.__path); return Promise.resolve();
    },
    addDoc: function (c, body) {
      const id = "a" + Math.random().toString(36).slice(2, 10);
      DB[c.__col + "/" + id] = clone(body);
      window.__MOCK_WRITES__.push(["add", c.__col + "/" + id]); persist();
      fire(c.__col + "/" + id);
      return Promise.resolve(ref(c.__col, id));
    },

    onSnapshot: function (target, cb) {
      if (target.__path) {
        docListeners.push({ path: target.__path, cb: cb });
        setTimeout(function () { cb(docSnap(target.__path)); }, 0);
      } else {
        colListeners.push({ col: target.__col, cb: cb });
        setTimeout(function () { cb(colSnap(target.__col)); }, 0);
      }
      return function () {};
    },

    query: function (c) {
      const q = { __col: c.__col };
      for (let i = 1; i < arguments.length; i++) Object.assign(q, arguments[i]);
      return q;
    },
    where: function () { return {}; },
    orderBy: function (field, dir) { return { __order: { field: field, dir: dir || "asc" } }; },
    limit: function (n) { return { __limit: n }; },

    // İşlem: okumalar anında, yazmalar sonunda topluca uygulanır.
    runTransaction: function (db, fn) {
      const ops = [];
      const tx = {
        get: function (r) { return Promise.resolve(docSnap(r.__path)); },
        set: function (r, b) { ops.push(["set", r.__path, b]); return tx; },
        update: function (r, b) { ops.push(["update", r.__path, b]); return tx; }
      };
      return Promise.resolve(fn(tx)).then(function (res) {
        ops.forEach(function (o) {
          if (o[0] === "set") DB[o[1]] = clone(o[2]);
          else DB[o[1]] = Object.assign({}, DB[o[1]], clone(o[2]));
          window.__MOCK_WRITES__.push(["tx-" + o[0], o[1]]);
        });
        persist();
        ops.forEach(function (o) { fire(o[1]); });
        return res;
      });
    },

    writeBatch: function () {
      const ops = [];
      return {
        set: function (r, b) { ops.push(["set", r.__path, b]); },
        update: function (r, b) { ops.push(["update", r.__path, b]); },
        delete: function (r) { ops.push(["delete", r.__path]); },
        commit: function () {
          ops.forEach(function (o) {
            if (o[0] === "set") DB[o[1]] = clone(o[2]);
            else if (o[0] === "update") DB[o[1]] = Object.assign({}, DB[o[1]], clone(o[2]));
            else delete DB[o[1]];
            window.__MOCK_WRITES__.push([o[0], o[1]]);
          });
          persist();
          const cols = {};
          ops.forEach(function (o) { cols[o[1].split("/")[0]] = true; });
          Object.keys(cols).forEach(function (c) {
            colListeners.filter(function (l) { return l.col === c; }).forEach(function (l) { l.cb(colSnap(c)); });
          });
          return Promise.resolve();
        }
      };
    },

    serverTimestamp: function () { return new Date().toISOString(); }
  };

  window.__TOYSMAR_MOCK__ = api;
})();
