// Teklif hesapları: sayı okuma/yazma, para birimi, toplamlar, yazıyla tutar.
// Ekrandan bağımsızdır; teklif ekranı da yazdırılan belge de aynı hesabı kullanır.

export const CURRENCIES = {
  TRY: { code: "TRY", symbol: "₺", label: "Türk lirası (₺)", major: "Türk Lirası", minor: "Kuruş" },
  USD: { code: "USD", symbol: "$", label: "ABD doları ($)", major: "ABD Doları", minor: "Sent" },
  EUR: { code: "EUR", symbol: "€", label: "Avro (€)", major: "Avro", minor: "Sent" }
};

export const VAT_RATES = [
  { v: 20, l: "%20 KDV ekle" },
  { v: 10, l: "%10 KDV ekle" },
  { v: 1, l: "%1 KDV ekle" },
  { v: 0, l: "KDV ekleme — “KDV hariç” yazılır" }
];

export function cur(code) { return CURRENCIES[code] || CURRENCIES.TRY; }

export function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

// Türkçe yazımı da, düz yazımı da okur: "165.000", "165000", "1.250,50", "45.5", "₺ 12.000".
// Boş ya da okunamayan değer null döner — "fiyat girilmedi" ile "0" ayrı tutulur.
export function parseNum(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v == null ? "" : v).trim().replace(/\s|₺|\$|€|TL/gi, "");
  if (!s) return null;
  const commas = (s.match(/,/g) || []).length;
  if (commas > 1) s = s.replace(/,/g, "");
  else if (commas === 1) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return isFinite(n) ? n : null;
}

const nfCache = {};
function nf(min, max) {
  const k = min + ":" + max;
  if (!nfCache[k]) {
    try { nfCache[k] = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: min, maximumFractionDigits: max }); }
    catch (e) { nfCache[k] = { format: function (n) { return Number(n).toFixed(max); } }; }
  }
  return nfCache[k];
}

export function fmtNum(n, dec) {
  if (n === null || n === undefined || n === "" || !isFinite(Number(n))) return "";
  return nf(dec, dec).format(Number(n));
}

// Giriş kutusunda gösterim: küsurat yoksa göstermez ("165.000"), varsa iki hane ("1.250,50").
export function fmtInputMoney(n) {
  const v = parseNum(n);
  if (v === null) return "";
  return Math.round(v * 100) % 100 === 0 ? fmtNum(v, 0) : fmtNum(v, 2);
}

export function fmtQty(n) {
  const v = parseNum(n);
  if (v === null) return "";
  return nf(0, 3).format(v);
}

export function fmtMoney(n, code) {
  return fmtNum(round2(n || 0), 2) + " " + cur(code).symbol;
}

// Büyük tutarları KPI kutularında kısa gösterir: "4,4 mn ₺".
export function fmtMoneyShort(n, code) {
  const v = Number(n) || 0, s = cur(code).symbol, a = Math.abs(v);
  if (a >= 1e9) return nf(0, 1).format(v / 1e9) + " mr " + s;
  if (a >= 1e6) return nf(0, 1).format(v / 1e6) + " mn " + s;
  if (a >= 1e4) return nf(0, 0).format(v / 1e3) + " bin " + s;
  return nf(0, 0).format(v) + " " + s;
}

/* ---------------- hesap ---------------- */

export function lineTotal(l) {
  if (!l || l.kind === "head") return 0;
  const q = parseNum(l.qty), p = parseNum(l.price);
  if (q === null || p === null) return 0;
  return round2(q * p);
}

export function calcTotals(q) {
  let sub = 0, missing = 0, count = 0;
  (q.items || []).forEach(function (l) {
    if (l.kind === "head") return;
    count++;
    if (parseNum(l.price) === null) missing++;
    sub += lineTotal(l);
  });
  sub = round2(sub);
  const dv = parseNum(q.discountValue) || 0;
  let disc = q.discountType === "tutar" ? round2(dv) : round2(sub * dv / 100);
  disc = Math.min(Math.max(disc, 0), sub);
  const net = round2(sub - disc);
  const rate = Number(q.vatRate) || 0;
  const vat = round2(net * rate / 100);
  return { sub: sub, disc: disc, net: net, vat: vat, grand: round2(net + vat), rate: rate, missing: missing, count: count };
}

/* ---------------- yazıyla ---------------- */

const ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
const SCALES = ["", "bin", "milyon", "milyar", "trilyon"];

function hundreds(n) {
  const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10, w = [];
  if (h) { if (h > 1) w.push(ONES[h]); w.push("yüz"); }
  if (t) w.push(TENS[t]);
  if (o) w.push(ONES[o]);
  return w.join(" ");
}

export function intWords(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return "sıfır";
  const parts = [];
  for (let i = 0; n > 0 && i < SCALES.length; i++) {
    const chunk = n % 1000;
    // "bir bin" denmez, yalnızca "bin".
    if (chunk) parts.unshift(((i === 1 && chunk === 1) ? "" : hundreds(chunk) + " ") + SCALES[i]);
    n = Math.floor(n / 1000);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function amountWords(total, code) {
  const c = cur(code);
  const cents = Math.round((Number(total) || 0) * 100);
  const major = Math.floor(cents / 100), minor = cents % 100;
  return "Yalnız " + intWords(major) + " " + c.major + (minor ? " " + intWords(minor) + " " + c.minor : "");
}
