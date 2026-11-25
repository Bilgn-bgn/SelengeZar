/* ===== SelengeZar - app.js ===== */

// ---------- Тохиргоо ----------
const SUPABASE_URL = "https://ocjpkwlkwtvqjpnwnfes.supabase.co";
const KEY = "sb_publishable_ZIYp3CB6jyjXzaBxdQv1Dw_rpfE1s21";
const API = SUPABASE_URL + "/rest/v1/ads";
const BUCKET = "ads-images";
const DEFAULT_IMG = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600";
// Зураг оруулаагүй хэрэглэгчийн анхдагч зураг
const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2096%2096%27%3E%3Crect%20width=%2796%27%20height=%2796%27%20fill=%27%23E2F2EE%27/%3E%3Ccircle%20cx=%2748%27%20cy=%2737%27%20r=%2716%27%20fill=%27%230E6B5C%27/%3E%3Cpath%20d=%27M15%2096c0-19%2015-31%2033-31s33%2012%2033%2031z%27%20fill=%27%230E6B5C%27/%3E%3C/svg%3E";
const DEFAULT_LOC = "Сүхбаатар, Сэлэнгэ";
// Сэлэнгэ аймгийн сумд (зар оруулах, нүүрийн шүүлтүүрт ижил дараалал)
const SOUMS = [
  ["Сүхбаатар", "Сүхбаатар (аймгийн төв)"], ["Шаамар", "Шаамар"], ["Алтанбулаг", "Алтанбулаг"], ["Мандал", "Мандал (Зүүнхараа)"],
  ["Ерөө", "Ерөө"], ["Зүүнбүрэн", "Зүүнбүрэн"], ["Цагааннуур", "Цагааннуур"], ["Хүдэр", "Хүдэр"], ["Сайхан", "Сайхан"],
  ["Баянгол", "Баянгол"], ["Жавхлант", "Жавхлант"], ["Орхонтуул", "Орхонтуул"], ["Орхон", "Орхон"], ["Баруунбүрэн", "Баруунбүрэн"],
  ["Түшиг", "Түшиг"], ["Сант", "Сант"], ["Хушаат", "Хушаат"]
];
const locValue = k => k === "Сүхбаатар" ? DEFAULT_LOC : k + ", Сэлэнгэ";
// Зарын байршлаас сумын нэрийг олно (эхний хэсэг нь сумын нэртэй таарвал)
function soumOf(loc) {
  const t = String(loc || "").trim().toLowerCase();
  const first = t.split(",")[0].trim();
  const hit = SOUMS.find(([k]) => k.toLowerCase() === first) || SOUMS.find(([k]) => t.startsWith(k.toLowerCase() + " "));
  return hit ? hit[0] : "";
}
// Онцлох зарын төлбөр (өөрчлөхдөө энд засна)
const PAY = { bank: "Хаан банк", account: "5688106076", name: "Билгүүн", price: 5000, days: 7 };
const CATS = ["Бүгд", "Утас", "Машин", "Байр", "Тавилга", "Хувцас", "Бусад"];

const $ = id => document.getElementById(id);
// SVG дүрс (index.html дахь sprite-аас)
const ico = (name, cls) => `<svg class="i${cls ? " " + cls : ""}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
// ---------- Цонхны удирдлага: нэг дор зөвхөн нэг цонх, цаад талын хуудас гүйхгүй ----------
const MODAL_IDS = ["verifyModal", "payModal"];
function closeAllModals() { MODAL_IDS.forEach(id => $(id).classList.remove("open")); }
function syncScrollLock() {
  const anyOpen = MODAL_IDS.some(id => $(id).classList.contains("open"));
  document.documentElement.classList.toggle("lock", anyOpen);
  document.body.classList.toggle("lock", anyOpen);
}
let myUid = null, chatChannel = null, chatCur = null, pollT = null;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Supabase client (window.supabase бол CDN сан, sb бол манай client)
let sb = null;
try {
  if (window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(SUPABASE_URL, KEY);
  } else {
    console.warn("Supabase сан ачаалагдаагүй байна");
  }
} catch (e) {
  console.error("createClient алдаа:", e);
}

// =====================================================
// 1. HERO СЛАЙД
// =====================================================
const heroApi = (function initHero() {
  const hero = $("hero"), track = $("heroTrack"), dotsBox = $("heroDots");
  let n = 0, dots = [], index = 0, timer = null, holding = false, startX = 0;

  // Зургуудыг (дахин) байрлуулна: админаас ирсэн жагсаалтаар солигдоно
  function setSlides(urls) {
    stop();
    track.innerHTML = ""; dotsBox.innerHTML = ""; index = 0;
    n = urls.length;
    hero.hidden = n === 0;
    if (!n) return;
    urls.forEach(u => { const im = document.createElement("img"); im.src = u; im.alt = ""; track.appendChild(im); });
    if (n > 1) track.appendChild(track.firstElementChild.cloneNode(true)); // төгсгөлд эхний зургийн хуулбар
    dots = urls.map((_, i) => {
      const b = document.createElement("button");
      b.setAttribute("aria-label", "Зураг " + (i + 1));
      b.addEventListener("pointerdown", e => e.stopPropagation());
      b.onclick = () => { index = i; update(); restart(); };
      dotsBox.appendChild(b);
      return b;
    });
    dotsBox.hidden = n < 2;
    jump(0);
    if (n > 1) start();
  }
  function update() {
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle("active", i === index % n));
  }
  function jump(i) { // анимацигүйгээр шилжих
    track.style.transition = "none";
    index = i;
    update();
    void track.offsetWidth; // reflow
    track.style.transition = "";
  }
  function next() { index++; update(); }
  function prev() {
    if (index <= 0) jump(n);
    index--;
    update();
  }

  // Хуулбар зураг дээр ирмэгц чимээгүйхэн эхэнд буцна
  track.addEventListener("transitionend", e => {
    if (e.target === track && n > 1 && index >= n) jump(0);
  });

  function start() { stop(); timer = setInterval(() => { if (!holding && n > 1) next(); }, 3000); }
  function stop() { clearInterval(timer); }
  function restart() { stop(); if (n > 1) start(); }

  hero.addEventListener("pointerdown", e => { holding = true; startX = e.clientX; });
  hero.addEventListener("pointerup", e => {
    if (!holding) return;
    holding = false;
    const diff = e.clientX - startX;
    if (n > 1) { if (diff < -50) next(); else if (diff > 50) prev(); }
    restart();
  });
  hero.addEventListener("pointercancel", () => { holding = false; });
  hero.addEventListener("pointerleave", () => { holding = false; });

  return { setSlides };
})();

// Рекламын зургууд: админаас (banners хүснэгт). Хуучин зураг түр харагдахаас сэргийлж
// сүүлд харуулсан жагсаалтыг хөтөч дээр хадгалж, нэн түрүүнд тэрийг үзүүлнэ.
(async function loadBanners() {
  const DEFAULTS = ["zurag1.jpg", "zurag2.jpg", "zurag3.jpg", "zurag4.jpg"];
  const KEY_C = "heroBanners";
  let shown = null;
  const show = list => { const sig = JSON.stringify(list); if (sig === shown) return; shown = sig; heroApi.setSlides(list); };
  try { const c = JSON.parse(localStorage.getItem(KEY_C) || "null"); if (Array.isArray(c)) show(c); } catch (e) {}
  try {
    const r = await fetch(SUPABASE_URL + "/rest/v1/banners?select=img,ends_at&order=id.asc", { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
    if (!r.ok) throw new Error("banners " + r.status);
    const rows = (await r.json()).filter(b => !b.ends_at || new Date(b.ends_at) > new Date());
    const list = rows.map(b => /^https?:/i.test(b.img) ? b.img : "/" + String(b.img).replace(/^\//, ""));
    try { localStorage.setItem(KEY_C, JSON.stringify(list)); } catch (e) {}
    show(list);
  } catch (e) {
    console.warn("banners", e);
    if (shown === null) show(DEFAULTS);   // хүснэгт байхгүй / сүлжээ тасарсан үед анхны зургууд
  }
})();

// =====================================================
// 2. ЗАРУУД
// =====================================================
let ads = [], cat = "Бүгд", locSel = "";

const catsEl = $("cats");
CATS.forEach(c => {
  const b = document.createElement("button");
  b.className = "cat" + (c === cat ? " active" : "");
  b.textContent = c;
  b.onclick = () => {
    cat = c;
    document.querySelectorAll("#cats .cat").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    render();
  };
  catsEl.appendChild(b);
});
// Байршлын шүүлтүүр (анхдагчаар бүх байршил)
const locsEl = $("locs");
[["", "Бүх байршил"], ...SOUMS.map(([k, l]) => [k, k === "Сүхбаатар" ? "Сүхбаатар" : l])].forEach(([k, l]) => {
  const b = document.createElement("button");
  b.className = "cat" + (k === locSel ? " active" : "");
  b.dataset.loc = k;
  b.textContent = l;
  b.onclick = () => {
    locSel = k;
    document.querySelectorAll("#locs .cat").forEach(x => x.classList.toggle("active", x === b));
    render();
  };
  locsEl.appendChild(b);
});
// Ad form: сумын сонголт
$("f-loc").innerHTML = SOUMS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
$("set-loc").innerHTML = $("f-loc").innerHTML;   // тохиргооны байршил: ижил сумын жагсаалт
$("f-loc").value = "Сүхбаатар";

// Өөрийн загвартай сонголт (dropdown): утсан дээр бүтэн дэлгэц биш, талбарын доор нээгдэнэ
function enhanceSelect(sel) {
  const wrap = document.createElement("div");
  wrap.className = "csel";
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "csel-btn";
  btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
  const list = document.createElement("div");
  list.className = "csel-list"; list.setAttribute("role", "listbox"); list.hidden = true;
  wrap.append(btn, list);
  sel.parentNode.insertBefore(wrap, sel);
  sel.classList.add("csel-native"); sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true");
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  const sync = () => {
    const o = sel.options[sel.selectedIndex];
    btn.textContent = o ? o.textContent : "";
    btn.classList.toggle("ph", !sel.value);
    [...list.children].forEach(x => { const on = x.dataset.v === sel.value; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); });
  };
  const build = () => {
    list.innerHTML = "";
    [...sel.options].filter(o => !o.disabled).forEach(o => {
      const it = document.createElement("button");
      it.type = "button"; it.className = "csel-opt"; it.setAttribute("role", "option");
      it.dataset.v = o.value; it.textContent = o.textContent;
      it.onclick = () => { desc.set.call(sel, o.value); sync(); close(); sel.dispatchEvent(new Event("change", { bubbles: true })); btn.focus(); };
      list.appendChild(it);
    });
    sync();
  };
  const close = () => { list.hidden = true; wrap.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); };
  const open = () => {
    document.querySelectorAll(".csel.open").forEach(w => w !== wrap && w.querySelector(".csel-btn").click());
    list.hidden = false; wrap.classList.add("open"); btn.setAttribute("aria-expanded", "true");
    const on = list.querySelector(".on"); if (on) list.scrollTop = Math.max(0, on.offsetTop - 60);
  };
  btn.onclick = () => (list.hidden ? open() : close());
  document.addEventListener("click", e => { if (!wrap.contains(e.target)) close(); });
  wrap.addEventListener("keydown", e => { if (e.key === "Escape") { close(); btn.focus(); } });
  Object.defineProperty(sel, "value", { configurable: true, get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); sync(); } });
  build();
}
["f-cat", "f-loc", "set-loc"].forEach(id => enhanceSelect($(id)));
$("q").addEventListener("input", render);

async function load() {
  try {
    const r = await fetch(API + "?select=*&order=created_at.desc",
      { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    ads = (await r.json()).filter(a => a.status !== "hidden" && a.status !== "deleted");   // админ нуусан зар харагдахгүй
    statusText = "Нийт " + ads.filter(isPublic).length + " зар";
  } catch (e) {
    statusText = "Серверт холбогдож чадсангүй: " + e.message;
    ads = [];
  }
  adsLoaded = true;
  render();
  updateMyCount();
  if (document.body.dataset.page === "ad") renderAd(decodeURIComponent(location.hash.slice(5)));
  if (document.body.dataset.page === "mine") renderMine();
  if (document.body.dataset.page === "saved") renderSaved();
}

let view = "all", statusText = "";

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 3200);
}

// "Өнөөдөр", "1 өдрийн өмнө", "2 долоо хоногийн өмнө" ...
function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const startOf = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (days <= 0) {
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "Дөнгөж сая";
    if (mins < 60) return mins + " минутын өмнө";
    return "Өнөөдөр";
  }
  if (days < 7) return days + " өдрийн өмнө";
  if (days < 30) return Math.floor(days / 7) + " долоо хоногийн өмнө";
  if (days < 365) return Math.floor(days / 30) + " сарын өмнө";
  return Math.floor(days / 365) + " жилийн өмнө";
}

// ---------- Хадгалсан зар (энэ төхөөрөмжид) ----------
function savedIds() { try { return JSON.parse(localStorage.getItem("savedAds") || "[]"); } catch (e) { return []; } }
function isSaved(id) { return savedIds().includes(String(id)); }
function toggleSave(id) {
  id = String(id);
  const cur = savedIds();
  const on = !cur.includes(id);
  localStorage.setItem("savedAds", JSON.stringify(on ? [id, ...cur] : cur.filter(x => x !== id)));
  toast(on ? "Хадгаллаа" : "Хадгалснаас хаслаа");
  render();
  if (document.body.dataset.page === "mine") renderMine();
  if (document.body.dataset.page === "saved") renderSaved();
  syncAdSaveBtn();
}
function myAds() { return myUid ? ads.filter(a => a.user_id && String(a.user_id) === String(myUid)) : []; }
function updateMyCount() { const el = $("my-ads-count"); if (el) el.textContent = myAds().length; }
function showMyAds() { go("#/mine"); }
const findAd = id => ads.find(a => String(a.id) === String(id));

// Зарын хугацаа: энгийн зар 30 хоног, онцгой зар featured_until хүртэл (ихэвчлэн 7 хоног)
const AD_DAYS = 30;
function expiryOf(a) {
  if (a.featured_until) return +new Date(a.featured_until);
  if (a.featured) return Infinity;   // хугацаагүй онцгой
  return a.created_at ? +new Date(a.created_at) + AD_DAYS * 864e5 : Infinity;
}
const isExpired = a => a.status === "expired" || Date.now() > expiryOf(a);
// Төлбөр баталгаажаагүй (pending) болон хугацаа дууссан зар нийтэд харагдахгүй, зөвхөн эзэнд харагдана
const isPublic = a => a.status !== "pending" && !isExpired(a);
const isFeat = a => a.featured === true && (!a.featured_until || new Date(a.featured_until) > new Date());
const fmtDate = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
function featAction(a) {
  if (isExpired(a)) return `<button class="feat-btn" data-renew="${esc(a.id)}">${ico("clock")} Хугацаа дууссан · Дахин нийтлэх</button>`;
  if (isFeat(a)) return `<div class="feat-note">${ico("star")} Онцлох${a.featured_until ? " · " + fmtDate(a.featured_until) + " хүртэл" : ""}</div>`;
  if (a.feature_requested) return `<button class="feat-btn pending" data-pay="${esc(a.id)}">${ico("clock")} ${a.status === "pending" ? "Төлбөр хүлээж байна · Нийтлэгдээгүй" : "Төлбөр хүлээгдэж байна"}</button>`;
  return `<button class="feat-btn" data-pay="${esc(a.id)}">${ico("star")} Онцлох болгох</button>`;
}
function cardHTML(a, opts) {
  const feat = isFeat(a);
  return `
    <div class="card${feat ? " featured" : ""}" data-id="${esc(a.id)}">
      <div class="card-img">
        <img src="${esc(a.img || DEFAULT_IMG)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_IMG}'">
        ${feat ? `<span class="feat-badge">${ico("star")} Онцлох</span>` : `<span class="cat-tag">${esc(a.cat || "Бусад")}</span>`}
        <button class="save-btn${isSaved(a.id) ? " on" : ""}" data-save="${esc(a.id)}" aria-label="Хадгалах">${ico("bookmark")}</button>
      </div>
      <div class="card-body">
        <div class="price">${Number(a.price || 0).toLocaleString()}₮</div>
        <h3>${esc(a.title)}</h3>
        <div class="meta">${ico("pin")}<span>${esc(a.loc)}</span></div>
        <div class="time">${ico("clock")}<span>${esc(timeAgo(a.created_at))}</span></div>
      </div>
      ${opts && opts.edit ? `<div class="card-actions"><div class="act-row"><button class="edit-btn" data-edit="${esc(a.id)}">${ico("pencil")} Засах</button><button class="del-btn" data-del="${esc(a.id)}">${ico("trash")} Устгах</button></div>${featAction(a)}</div>` : ""}
    </div>`;
}

// ---------- Онцлох зарын карусель: хажуу тийш 3 секунд тутам урсана, гараар чирж болно ----------
const FT = { sig: "", list: [], S: 0, w: 0, per: 1, loop: false, touch: 0, norm: null, down: null, moved: false };
function featMetrics(t) {
  const c = t.querySelector(".card");
  if (!c || !t.clientWidth) return null;
  const gap = parseFloat(getComputedStyle(t).columnGap) || 12;
  const w = c.getBoundingClientRect().width + gap;
  return { w, per: Math.max(1, Math.round((t.clientWidth - 12 + gap) / w)) };
}
function setupFeatured(feat, force) {
  const t = $("featured-grid");
  FT.list = feat;
  const sig = feat.map(a => [a.id, a.title, a.price, a.img].join(":")).join("|");
  if (!force && sig === FT.sig && t.children.length) {   // өөрчлөлтгүй бол дахин байгуулахгүй (байрлал хэвээр)
    t.querySelectorAll("[data-save]").forEach(b => b.classList.toggle("on", isSaved(b.dataset.save)));
    return;
  }
  const one = feat.map(a => cardHTML(a)).join("");
  t.innerHTML = one;
  FT.loop = false;
  if (!feat.length) { FT.sig = sig; return; }
  const m = featMetrics(t);
  if (!m) { FT.sig = ""; return; }                      // нүүр хуудас харагдахгүй байна - буцаж ирэхэд дахин байгуулна
  FT.sig = sig; FT.w = m.w; FT.per = m.per;
  if (feat.length > m.per) {                            // төгсгөлгүй гүйлгэхийн тулд 3 хувь
    t.innerHTML = one + one + one;
    FT.loop = true; FT.S = feat.length * m.w;
    t.scrollLeft = FT.S;
  }
}
(function featInit() {
  const t = $("featured-grid");
  const touch = () => { FT.touch = Date.now(); };
  ["touchstart", "wheel"].forEach(ev => t.addEventListener(ev, touch, { passive: true }));
  t.addEventListener("scroll", () => {
    if (!FT.loop) return;
    clearTimeout(FT.norm);
    FT.norm = setTimeout(() => {                         // гүйлт зогсмогц дунд хувь руу нууцаар буцаана
      const sl = t.scrollLeft;
      if (sl < FT.S - FT.w / 2) t.scrollLeft = sl + FT.S;
      else if (sl >= 2 * FT.S - FT.w / 2) t.scrollLeft = sl - FT.S;
    }, 140);
  }, { passive: true });
  // Хулганаар чирэх (компьютер)
  t.addEventListener("pointerdown", e => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    FT.down = { x: e.clientX, sl: t.scrollLeft }; FT.moved = false; touch();
  });
  window.addEventListener("pointermove", e => {
    if (!FT.down) return;
    const dx = e.clientX - FT.down.x;
    if (!FT.moved && Math.abs(dx) < 5) return;
    FT.moved = true; t.classList.add("drag"); touch();
    t.scrollLeft = FT.down.sl - dx;
  });
  window.addEventListener("pointerup", () => {
    if (!FT.down) return;
    FT.down = null; touch();
    if (FT.moved) {
      t.classList.remove("drag");
      if (FT.w) t.scrollTo({ left: Math.round(t.scrollLeft / FT.w) * FT.w, behavior: "smooth" });
      setTimeout(() => { FT.moved = false; }, 0);
    }
  });
  t.addEventListener("click", e => { if (FT.moved) { e.stopPropagation(); e.preventDefault(); } }, true);
  t.addEventListener("dragstart", e => e.preventDefault());
  // Автомат урсалт: 3 секунд тутам 1 хуудас (нэг дор харагдаж буй тооны зар)
  setInterval(() => {
    if (!FT.loop || document.hidden || document.body.dataset.page !== "home" || FT.down) return;
    if (Date.now() - FT.touch < 3000) return;            // хэрэглэгч оролцсон бол түр хүлээнэ
    t.scrollBy({ left: FT.per * FT.w, behavior: "smooth" });
  }, 3000);
  let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => setupFeatured(FT.list, true), 250); });
})();

function render() {
  const q = ($("q").value || "").trim().toLowerCase();
  const saved = savedIds();
  const base = ads.filter(a =>
    isPublic(a) &&
    (view !== "saved" || saved.includes(String(a.id))) &&
    (cat === "Бүгд" || (a.cat || "Бусад") === cat) &&
    (!locSel || soumOf(a.loc) === locSel) &&
    [a.title, a.description, a.loc].some(t => (t || "").toLowerCase().includes(q))
  );
  // Онцлох зарууд нүүрэнд тусдаа хэсэгт (хадгалсан харагдацад бүгд нэг дор)
  const feat = view === "saved" ? [] : base.filter(a => isFeat(a));
  const main = view === "saved" ? base : base.filter(a => !isFeat(a));

  $("status").textContent = statusText;
  $("featured-wrap").hidden = !feat.length;
  setupFeatured(feat);

  const g = $("grid");
  if (!base.length) {
    g.innerHTML = view === "saved"
      ? "<div class='empty'>Хадгалсан зар алга. Зарын зураг дээрх тэмдэгийг дарж хадгална уу.</div>"
      : "<div class='empty'>Одоогоор зар алга. Эхлээд зар оруулаарай.</div>";
    return;
  }
  g.innerHTML = main.map(a => cardHTML(a)).join("");
}

// ---------- "Хадгалсан" хуудас ----------
function renderSaved() {
  const ids = savedIds();
  const list = ids.map(findAd).filter(a => a && isPublic(a));   // хамгийн сүүлд хадгалсан нь эхэнд
  $("saved-title").textContent = "Хадгалсан зар (" + list.length + ")";
  $("saved-grid").innerHTML = list.length
    ? list.map(a => cardHTML(a)).join("")
    : "<div class='empty'>Хадгалсан зар алга. Зарын зураг дээрх тэмдэгийг дарж хадгална уу.</div>";
}

// ---------- "Миний зарууд" хуудас ----------
async function renewAd(id) {
  if (!sb) return;
  const { error } = await sb.rpc("renew_my_ad", { p_id: String(id) });
  if (error) { toast("Дахин нийтэлж чадсангүй: " + error.message + " (expire-ads.sql ажилласан эсэхээ шалгана уу)"); return; }
  const i = ads.findIndex(x => String(x.id) === String(id));
  if (i >= 0) ads[i] = { ...ads[i], status: "active", created_at: new Date().toISOString(), featured: false, featured_until: null, feature_requested: false };
  render(); renderMine();
  toast("Зар дахин нийтлэгдлээ (" + AD_DAYS + " хоног)");
}
function renderMine() {
  const list = myAds();
  $("mine-title").textContent = "Миний зарууд (" + list.length + ")";
  $("mine-grid").innerHTML = !isLoggedIn()
    ? "<div class='empty'>Зараа харахын тулд нэвтэрнэ үү.</div>"
    : list.length
      ? list.map(a => cardHTML(a, { edit: true })).join("")
      : "<div class='empty'>Таны оруулсан зар алга. «Зар нэмэх» товчоор зар оруулна уу.</div>";
}

["grid", "featured-grid", "mine-grid", "saved-grid"].forEach(gid => $(gid).addEventListener("click", e => {
  const ren = e.target.closest("[data-renew]");
  if (ren) { e.stopPropagation(); renewAd(ren.dataset.renew); return; }
  const pay = e.target.closest("[data-pay]");
  if (pay) { e.stopPropagation(); onFeatureClick(pay.dataset.pay); return; }
  const dl = e.target.closest("[data-del]");
  if (dl) { e.stopPropagation(); deleteAd(dl.dataset.del); return; }
  const ed = e.target.closest("[data-edit]");
  if (ed) { e.stopPropagation(); editAd(ed.dataset.edit); return; }
  const sv = e.target.closest("[data-save]");
  if (sv) { e.stopPropagation(); toggleSave(sv.dataset.save); return; }
  const card = e.target.closest(".card");
  if (card) openAd(card.dataset.id);
}));

// ---------- Зарын дэлгэрэнгүй ----------
let curAd = null;
let cameFromApp = false, adsLoaded = false;
function openAd(id) { cameFromApp = true; go("#/ad/" + encodeURIComponent(id)); }
function adBack() { if (cameFromApp && history.length > 1) history.back(); else go("#/"); }

// Зарын зургууд: imgs (дээд тал нь 4), байхгүй бол img
const adImages = a => (Array.isArray(a.imgs) && a.imgs.length ? a.imgs : (a.img && a.img !== DEFAULT_IMG ? [a.img] : [])).slice(0, 4);
let galList = [], galIdx = 0;
const slidesHtml = list => list.map(u => `<div class="gal-slide"><img src="${esc(u)}" alt="" draggable="false" onerror="this.onerror=null;this.src='${DEFAULT_IMG}'"></div>`).join("");
function trackIdx(t) { return Math.max(0, Math.min(galList.length - 1, Math.round(t.scrollLeft / (t.clientWidth || 1)))); }
function setCount(el, i) {
  el.hidden = galList.length < 2; el.textContent = (i + 1) + " / " + galList.length;
  const pre = el.id === "lb-count" ? "lb" : "gal";
  $(pre + "-prev").hidden = galList.length < 2 || i <= 0;
  $(pre + "-next").hidden = galList.length < 2 || i >= galList.length - 1;
}
function navStep(trackId, d) { const t = $(trackId); trackTo(t, Math.max(0, Math.min(galList.length - 1, trackIdx(t) + d)), true); }
["gal", "lb"].forEach(p => { const tr = p + "-track"; $(p + "-prev").addEventListener("click", e => { e.stopPropagation(); navStep(tr, -1); }); $(p + "-next").addEventListener("click", e => { e.stopPropagation(); navStep(tr, 1); }); });
function trackTo(t, i, smooth) { t.scrollTo({ left: i * t.clientWidth, behavior: smooth ? "smooth" : "auto" }); }
function showGallery(list) {
  galList = list.length ? list : [DEFAULT_IMG]; galIdx = 0;
  const t = $("gal-track");
  t.innerHTML = slidesHtml(galList);
  t.classList.toggle("one", galList.length < 2);
  t.scrollLeft = 0; setCount($("gal-count"), 0);
}
$("gal-track").addEventListener("scroll", () => { galIdx = trackIdx($("gal-track")); setCount($("gal-count"), galIdx); }, { passive: true });
$("gal-track").addEventListener("click", () => openLightbox(galIdx));
function openLightbox(i) {
  const t = $("lb-track");
  t.innerHTML = slidesHtml(galList);
  t.classList.toggle("one", galList.length < 2);
  $("lb").hidden = false; document.body.classList.add("lb-open");
  trackTo(t, i, false); setCount($("lb-count"), i);
}
function closeLightbox() {
  if ($("lb").hidden) return;
  const i = trackIdx($("lb-track"));
  $("lb").hidden = true; document.body.classList.remove("lb-open");
  galIdx = i; trackTo($("gal-track"), i, false); setCount($("gal-count"), i);
}
$("lb-track").addEventListener("scroll", () => setCount($("lb-count"), trackIdx($("lb-track"))), { passive: true });
$("lb-x").addEventListener("click", closeLightbox);
$("lb-track").addEventListener("click", e => { if (e.target.classList.contains("gal-slide")) closeLightbox(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeLightbox(); });
window.addEventListener("hashchange", closeLightbox);

// Зарын хуудсыг бөглөх (route() дуудна)
function renderAd(id) {
  const a0 = findAd(id);
  const a = a0 && (isPublic(a0) || (myUid && String(a0.user_id) === String(myUid))) ? a0 : null;
  curAd = a || null;
  if (!a) {
    if (adsLoaded) { toast("Зар олдсонгүй"); go("#/"); }
    else { $("ad-title").textContent = "Ачаалж байна..."; ["ad-price", "ad-meta", "ad-desc"].forEach(k => { $(k).innerHTML = ""; }); }
    return;
  }
  showGallery(adImages(a));
  $("ad-price").textContent = Number(a.price || 0).toLocaleString() + "₮";
  $("ad-title").textContent = a.title || "";
  $("ad-meta").innerHTML =
    (a.loc ? `<span>${ico("pin")}${esc(a.loc)}</span>` : "") +
    (a.cat ? `<span>${esc(a.cat)}</span>` : "") +
    (a.created_at ? `<span>${ico("clock")}${esc(timeAgo(a.created_at))}</span>` : "");
  $("ad-desc").textContent = a.description || "Тайлбар оруулаагүй байна.";
  const ph = localPhone(a.phone || "");
  const call = $("ad-call");
  if (ph) { call.href = "tel:" + ph.replace(/[^\d+]/g, ""); call.innerHTML = ico("phone") + " " + esc(ph); call.style.display = ""; }
  else { call.style.display = "none"; }
  $("ad-desc").scrollTop = 0;
  syncAdSaveBtn();
}
function syncAdSaveBtn() {
  if (!curAd) return;
  const on = isSaved(curAd.id);
  $("ad-save").classList.toggle("on", on);
  $("ad-save").setAttribute("aria-label", on ? "Хадгалснаас хасах" : "Хадгалах");
}
function saveFromAd() { if (curAd) toggleSave(curAd.id); }
function chatFromAd() {
  if (!curAd) return;
  if (!curAd.user_id) { toast("Энэ зарын эзэнтэй чатлах боломжгүй. Утсаар холбогдоно уу."); return; }
  if (!isLoggedIn() || !myUid) { toast("Чат бичихийн тулд нэвтэрнэ үү"); openProfile(); return; }
  if (curAd.user_id === myUid) { toast("Энэ таны өөрийн зар байна"); return; }
  const a = curAd;
  pendingThread = [String(a.id), a.title || "Зар", a.user_id, "Зарын эзэн"];
  openChat();
}

// ---------- Зар оруулах цонх ----------
function openModal() {
  if (!isLoggedIn()) {            // 1) нэвтрээгүй бол эхлээд нэвтрүүлнэ
    localStorage.setItem("wantPost", "1");
    openProfile();
    return;
  }
  if (!isPhoneVerified()) {       // 2) утас баталгаажаагүй бол нэг удаа баталгаажуулна
    openVerify();
    return;
  }
  if (editingId) { resetAdForm(); setFormMode(null); }   // өмнөх засварын үлдэгдэл арилгана
  syncAdPhone();
  if (!editingId) $("f-loc").value = myDefaultSoum();
  go("#/add");
}
// Зар оруулах/засах хуудсаас буцах
function closeModal() {
  const dest = editingId ? "#/mine" : "#/";
  go(dest);   // route() нь хуудаснаас гарахад засварын төлөвийг цэвэрлэнэ
}

// ---------- Өөрийн зарыг устгах ----------
async function deleteAd(id) {
  const a = findAd(id);
  if (!a) return;
  if (!confirm("«" + (a.title || "Зар") + "» зарыг устгах уу?\nЭнийг буцаах боломжгүй.")) return;
  try {
    const { data: sess } = await sb.auth.getSession();
    const token = sess && sess.session && sess.session.access_token;
    if (!token) throw new Error("Дахин нэвтэрнэ үү");
    const r = await fetch(API + "?id=eq." + encodeURIComponent(id), {
      method: "DELETE",
      headers: { apikey: KEY, Authorization: "Bearer " + token, Prefer: "return=representation" }
    });
    if (!r.ok) throw new Error(await r.text());
    const rows = await r.json();
    if (!rows.length) throw new Error("Устгах эрх олгогдоогүй байна (ads-delete.sql ажиллуулсан эсэхээ шалгана уу)");
    ads = ads.filter(x => String(x.id) !== String(id));
    render(); renderMine(); renderSaved();
    toast("Зар устгагдлаа");
  } catch (e) { toast("Алдаа: " + e.message); }
}

// ---------- Онцлох зар: сонголт + төлбөрийн мэдээлэл ----------
let plan = "normal";
const money = n => Number(n).toLocaleString() + "₮";
const adCode = id => { const t = String(id); return "ZAR-" + (t.length > 8 ? t.replace(/-/g, "").slice(0, 6).toUpperCase() : t); };
function setPlan(p) {
  plan = p;
  document.querySelectorAll("#plan-pick .plan").forEach(b => {
    const on = b.dataset.plan === p;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", on);
  });
  $("plan-note").hidden = p !== "featured";
}
$("plan-price").textContent = money(PAY.price) + " / " + PAY.days + " хоног";
$("plan-pick").addEventListener("click", e => { const b = e.target.closest(".plan"); if (b) setPlan(b.dataset.plan); });

let payCode = "";
function openPay(a) {
  payCode = adCode(a.id);
  $("pay-ad").textContent = a.title || "";
  $("pay-amount").textContent = money(PAY.price) + " (" + PAY.days + " хоног)";
  $("pay-bank").textContent = PAY.bank;
  $("pay-acc").textContent = PAY.account;
  $("pay-name").textContent = PAY.name;
  $("pay-code").textContent = payCode;
  closeAllModals();
  $("payModal").classList.add("open");
}
function closePay() { $("payModal").classList.remove("open"); }
$("payModal").addEventListener("click", e => {
  const c = e.target.closest("[data-copy]");
  if (!c) { if (e.target === $("payModal")) closePay(); return; }
  const txt = c.dataset.copy === "acc" ? PAY.account : payCode;
  try { navigator.clipboard.writeText(txt).then(() => toast("Хууллаа: " + txt), () => toast(txt)); }
  catch (_) { toast(txt); }
});

async function patchAd(id, patch) {
  const { data: sess } = await sb.auth.getSession();
  const token = sess && sess.session && sess.session.access_token;
  if (!token) throw new Error("Дахин нэвтэрнэ үү");
  const pr = await fetch(API + "?id=eq." + encodeURIComponent(id), {
    method: "PATCH",
    headers: { apikey: KEY, Authorization: "Bearer " + token, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(patch)
  });
  if (!pr.ok) throw new Error(await pr.text());
  const rows = await pr.json();
  if (!rows.length) throw new Error("Засах эрх олгогдоогүй байна");
  const i = ads.findIndex(x => String(x.id) === String(id));
  if (i >= 0) ads[i] = { ...ads[i], ...rows[0] };
  return ads[i] || rows[0];
}
async function onFeatureClick(id) {
  const a = findAd(id);
  if (!a) return;
  if (a.feature_requested) { openPay(a); return; }
  try {
    const row = await patchAd(id, { feature_requested: true });
    renderMine();
    openPay(row);
  } catch (e) {
    toast(e.message.includes("feature_requested") ? "featured-paid.sql-ийг Supabase дээр ажиллуулна уу" : "Алдаа: " + e.message);
  }
}

// ---------- Зар засах ----------
let editingId = null;
function setFormMode(id) {
  editingId = id;
  if (!id) { $("plan-pick").hidden = false; setPlan("normal"); }
  $("ad-form-title").textContent = id ? "Зар засах" : "Шинэ зар оруулах";
  $("publishBtn").textContent = id ? "Хадгалах" : "Зар нийтлэх";
}
function editAd(id) {
  const a = findAd(id);
  if (!a) return;
  if (!myUid || String(a.user_id) !== String(myUid)) { toast("Зөвхөн өөрийн зарыг засна"); return; }
  resetAdForm();
  setFormMode(String(a.id));
  $("plan-pick").hidden = isFeat(a) || a.status === "pending";
  setPlan(a.feature_requested ? "featured" : "normal");
  syncAdPhone();
  $("f-title").value = a.title || "";
  $("f-price").value = String(a.price ?? "").replace(/\D/g, "");
  $("f-cat").value = a.cat || "Бусад";
  $("f-loc").value = soumOf(a.loc) || "Сүхбаатар";
  $("f-desc").value = a.description || "";
  photos = adImages(a).map(url => ({ url }));
  renderPhotos();
  $("err").textContent = "";
  go("#/add");
}

// Зарын утас = зөвхөн хэрэглэгчийн баталгаажсан бүртгэлтэй дугаар (засах боломжгүй)
function myRegPhone() { return isPhoneVerified() ? localPhone(localStorage.getItem("userPhone") || "") : ""; }
function syncAdPhone() { $("f-phone").value = myRegPhone(); }
// Шинэ зарын анхдагч байршил = тохиргоонд сонгосон сум
const myDefaultSoum = () => soumOf(localStorage.getItem("userLoc")) || "Сүхбаатар";
// Үнэ: зөвхөн тоо (цэг, зураас, таслал, "e" оруулахгүй)
$("f-price").addEventListener("input", e => { const v = e.target.value.replace(/\D/g, ""); if (v !== e.target.value) e.target.value = v; });
$("f-price").addEventListener("keydown", e => { if (e.key.length === 1 && !/\d/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); });
$("f-phone").addEventListener("focus", e => e.target.blur());   // босоо зураас (курсор) гарахгүй
function resetAdForm() {
  ["f-title", "f-price", "f-desc"].forEach(id => $(id).value = "");
  $("f-loc").value = myDefaultSoum();   // анхдагч: тохиргоонд сонгосон сум
  $("f-cat").value = "";   // ангилалыг заавал сонгуулна
  $("f-file").value = "";
  photos.forEach(p => p.prev && URL.revokeObjectURL(p.prev));
  photos = [];
  renderPhotos();
  $("err").textContent = "";
  setPlan("normal");
  syncAdPhone();
}

// ---- Зургийн жагсаалт (дээд тал нь 4) ----
const MAX_PHOTOS = 4;
let photos = [];   // {url} (хуучин) эсвэл {file, prev} (шинэ)
function renderPhotos() {
  $("ph-count").textContent = photos.length + "/" + MAX_PHOTOS;
  $("photo-grid").innerHTML = photos.map((p, i) =>
    `<div class="ph-item"><img src="${esc(p.url || p.prev)}" alt="">${i === 0 ? '<span class="ph-cov">Нүүр</span>' : ""}<button type="button" class="ph-del" data-i="${i}" aria-label="Зураг устгах">${ico("x")}</button></div>`).join("") +
    (photos.length < MAX_PHOTOS ? `<button type="button" class="ph-add" data-add="1" aria-label="Зураг нэмэх">${ico("plus")}<span>Нэмэх</span></button>` : "");
}
renderPhotos();   // «Нэмэх» товч эхнээс харагдана
$("photo-grid").parentElement.querySelector(".upload-title").addEventListener("click", () => { if (photos.length < MAX_PHOTOS) $("f-file").click(); });
$("photo-grid").addEventListener("click", e => {
  const d = e.target.closest(".ph-del");
  if (d) { const [r] = photos.splice(Number(d.dataset.i), 1); if (r && r.prev) URL.revokeObjectURL(r.prev); renderPhotos(); $("err").textContent = ""; return; }
  if (e.target.closest("[data-add]")) $("f-file").click();
});
$("f-file").addEventListener("change", e => {
  const files = [...e.target.files];
  e.target.value = "";   // ижил зургийг дахин сонгож болно
  let skipped = 0;
  files.forEach(f => {
    if (!/^image\//.test(f.type)) return;
    if (photos.length >= MAX_PHOTOS) { skipped++; return; }
    photos.push({ file: f, prev: URL.createObjectURL(f) });
  });
  renderPhotos();
  $("err").textContent = skipped ? "Дээд тал нь " + MAX_PHOTOS + " зураг оруулна" : "";
});

// Том зургийг автоматаар жижигрүүлэх
function compressImage(f) {
  if (f.size < 500 * 1024) return Promise.resolve(f);
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onerror = () => resolve(f);
    reader.onload = e => {
      const img = new Image();
      img.onerror = () => resolve(f);
      img.onload = () => {
        let w = img.width, h = img.height;
        const max = 1200;
        if (w > max || h > max) {
          const ratio = Math.min(max / w, max / h);
          w = Math.round(w * ratio); h = Math.round(h * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => {
          if (!blob) return resolve(f);
          const name = f.name.replace(/\.[^.]+$/, "") + ".jpg";
          resolve(new File([blob], name, { type: "image/jpeg" }));
        }, "image/jpeg", 0.82);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(f);
  });
}

$("publishBtn").onclick = async () => {
  const err = $("err"), btn = $("publishBtn");
  if (!editingId && !isPhoneVerified()) { openVerify(); return; }
  const title = $("f-title").value.trim();
  const price = $("f-price").value.trim();
  if (!title) { err.textContent = "Нэрийг бичнэ үү"; return; }
  if (!price) { err.textContent = "Үнийг бичнэ үү"; return; }
  if (!$("f-cat").value) { err.textContent = "Ангилал сонгоно уу"; return; }
  const regPhone = myRegPhone();
  if (!regPhone) { openVerify(); return; }

  btn.disabled = true;
  err.textContent = editingId ? "Хадгалж байна..." : "Зар оруулж байна...";
  try {
    const urls = [];
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (p.url) { urls.push(p.url); continue; }
      err.textContent = "Зураг " + (i + 1) + "/" + photos.length + " хуулж байна...";
      const small = await compressImage(p.file);
      const fn = Date.now() + "-" + i + "-" + (small.name || p.file.name || "img.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
      const up = await fetch(SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + fn, {
        method: "POST",
        headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": small.type || "image/jpeg" },
        body: small
      });
      if (!up.ok) throw new Error("Зураг хуулахад алдаа: " + await up.text());
      urls.push(SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/" + fn);
    }
    const imgUrl = urls[0] || DEFAULT_IMG;

    if (editingId) {   // ---- Одоо байгаа зарыг засах (нэвтэрсэн хэрэглэгчийн token-оор, зөвхөн өөрийн зар) ----
      const patch = {
        title, price: Number(price), cat: $("f-cat").value,
        phone: regPhone,
        loc: locValue($("f-loc").value),
        description: $("f-desc").value.trim()
      };
      patch.img = imgUrl; patch.imgs = urls;
      const cur = findAd(editingId);
      const askPay = plan === "featured" && cur && !isFeat(cur);
      if (cur && !isFeat(cur) && (plan === "featured") !== !!cur.feature_requested) patch.feature_requested = plan === "featured";
      const { data: sess } = await sb.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      if (!token) throw new Error("Дахин нэвтэрнэ үү");
      const doPatch = () => fetch(API + "?id=eq." + encodeURIComponent(editingId), {
        method: "PATCH",
        headers: { apikey: KEY, Authorization: "Bearer " + token, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(patch)
      });
      let pr = await doPatch();
      if (!pr.ok) {
        const t = await pr.text();
        if (t.includes("imgs")) { delete patch.imgs; pr = await doPatch(); }   // imgs багана хараахан нэмээгүй бол
        else throw new Error("Засахад алдаа: " + t);
      }
      if (!pr.ok) throw new Error("Засахад алдаа: " + await pr.text());
      const rows = await pr.json();
      if (!rows.length) throw new Error("Засах эрх олгогдоогүй байна (ads-features.sql-ийг Supabase дээр ажиллуулсан эсэхээ шалгана уу)");
      const i = ads.findIndex(x => String(x.id) === String(editingId));
      if (i >= 0) ads[i] = { ...ads[i], ...rows[0] };
      closeModal();
      render();
      renderMine();
      toast("Зар шинэчлэгдлээ");
      if (askPay) setTimeout(() => openPay(ads[i] || rows[0]), 200);
      return;
    }

    const body = {
      user_id: myUid || null,
      title,
      price: Number(price),
      cat: $("f-cat").value,
      phone: regPhone,
      loc: locValue($("f-loc").value),
      img: imgUrl,
      imgs: urls,
      description: $("f-desc").value.trim()
    };
    const wantFeat = plan === "featured";
    if (wantFeat) { body.feature_requested = true; body.status = "pending"; }   // админ зөвшөөрөх хүртэл нийтэд харагдахгүй
    const post = b => fetch(API, {
      method: "POST",
      headers: {
        apikey: KEY, Authorization: "Bearer " + KEY,
        "Content-Type": "application/json", Prefer: "return=representation"
      },
      body: JSON.stringify(b)
    });
    let r = await post(body);
    for (let k = 0; k < 2 && !r.ok; k++) {   // багана хараахан нэмээгүй бол түүнгүйгээр оруулна
      const t = await r.text();
      const col = ["feature_requested", "status", "imgs", "user_id"].find(c => c in body && t.includes(c));
      if (!col) throw new Error("Алдаа: " + t);
      delete body[col];
      if (col === "feature_requested") delete body.status;   // хүсэлтгүй, нуугдсан зар үлдэхээс сэргийлнэ
      r = await post(body);
    }
    if (!r.ok) throw new Error("Алдаа: " + await r.text());
    const d = await r.json();
    ads.unshift(d[0]);
    statusText = "Нийт " + ads.filter(isPublic).length + " зар";
    render();
    renderMine();
    resetAdForm();
    closeModal();
    toast(body.status === "pending" ? "Зар хүлээн авлаа. Төлбөр баталгаажсаны дараа нийтлэгдэнэ" : "Зар амжилттай нийтлэгдлээ!");
    if (wantFeat && body.feature_requested) setTimeout(() => openPay(d[0]), 200);
  } catch (e) {
    err.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
};

// =====================================================
// 3. НЭВТРЭХ / ПРОФАЙЛ
// =====================================================
const LS_KEYS = ["userEmail", "userPhone", "userName", "userLoc", "userCreated", "pendingPhone", "pendingVerify", "phoneVerified", "wantPost", "providers", "userCustomName", "userProviderName", "userAvatar"];

// +97699751740 / 97699751740 -> 99751740 (зөвхөн 8 оронтой дотоодын дугаар)
function localPhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("976") ? d.slice(3) : (p || "");
}

function saveUserLocal(u, fallbackPhone) {
  if (!u) return;
  const meta = u.user_metadata || {};
  const phone = localPhone(u.phone || meta.phone || fallbackPhone || "");
  // custom_name / custom_avatar - хэрэглэгчийн өөрөө тохируулсан (Google/Facebook нэвтрэх бүрт дарагдахгүй)
  const customName = meta.custom_name || "";
  const providerName = meta.full_name || meta.name || "";
  localStorage.setItem("userEmail", u.email || "");
  localStorage.setItem("userPhone", phone);
  localStorage.setItem("userCustomName", customName);
  if (meta.custom_loc) localStorage.setItem("userLoc", meta.custom_loc);
  const baseName = providerName || u.email || phone || "";
  localStorage.setItem("userProviderName", baseName);
  localStorage.setItem("userName", customName || baseName);
  localStorage.setItem("userAvatar", meta.custom_avatar || meta.avatar_url || meta.picture || "");
  // Supabase талд баталгаажсан дугаартай эсэх (SMS-ээр нэвтэрсэн эсвэл холбосон)
  localStorage.setItem("phoneVerified", (u.phone && u.phone_confirmed_at) ? "1" : "0");
  const prov = (u.identities || []).map(i => i.provider);
  if (u.phone && !prov.includes("phone")) prov.push("phone");
  localStorage.setItem("providers", JSON.stringify(prov));
  if (u.id && u.id !== myUid) { myUid = u.id; initChat(); }
}
function isPhoneVerified() { return localStorage.getItem("phoneVerified") === "1"; }
function clearUserLocal() {
  LS_KEYS.forEach(k => localStorage.removeItem(k));
  stopChat();
}
function isLoggedIn() {
  return !!(localStorage.getItem("userEmail") || localStorage.getItem("userPhone") || localStorage.getItem("userName"));
}

function showLoginView() {
  $("login-view").style.display = "block";
  $("profile-info").style.display = "none";
  $("step-phone").style.display = "block";
  $("step-code").style.display = "none";
}

function showProfile(name) {
  $("login-view").style.display = "none";
  $("profile-info").style.display = "block";
  showTab("profile");

  const email = localStorage.getItem("userEmail") || "";
  const phone = localPhone(localStorage.getItem("userPhone") || "");
  const loc = localStorage.getItem("userLoc") || DEFAULT_LOC;
  const customName = localStorage.getItem("userCustomName") || "";
  const displayName = localPhone(name || localStorage.getItem("userName") || phone || "Хэрэглэгч");

  $("profile-name").textContent = displayName;
  const verified = isPhoneVerified();
  let prov = [];
  try { prov = JSON.parse(localStorage.getItem("providers") || "[]"); } catch (e) {}
  $("profile-phone").innerHTML = phone
    ? esc(phone) + (verified ? ' <span class="ok">' + ico("check-circle") + '</span>' : ' <button class="btn btn-outline btn-sm" onclick="openVerify(\'verify\')">Баталгаажуулах</button>')
    : '<button class="btn btn-outline btn-sm" onclick="openVerify(\'verify\')">Баталгаажуулах</button>';
  updateMyCount();
  $("profile-loc").textContent = loc;
  renderAvatar(displayName);
  $("set-name").value = displayName;
  $("set-phone").value = phone;
  syncPhoneBtn();
  $("set-loc").value = soumOf(loc) || "Сүхбаатар";
}

function showTab(tab) {
  $("tab-profile").style.display = tab === "profile" ? "flex" : "none";
  $("tab-settings").style.display = tab === "settings" ? "flex" : "none";
  $("tab-profile-btn").classList.toggle("active", tab === "profile");
  $("tab-settings-btn").classList.toggle("active", tab === "settings");
}

let pendingTab = null;
function openProfile(tab) { pendingTab = tab || null; go("#/profile"); }
function closeProfile() {
  localStorage.removeItem("wantPost");
  go("#/");
}

async function saveSettings() {
  const name = $("set-name").value.trim();
  const phone = localPhone(localStorage.getItem("userPhone") || "");   // дугаарыг зөвхөн баталгаажуулалтаар солино
  const loc = locValue($("set-loc").value || "Сүхбаатар");

  // Нэр нь Google/Facebook/и-мэйлийн анхны нэрээс өөр бол "өөрийн нэр" гэж тооцно
  const base = localStorage.getItem("userProviderName") || "";
  const custom = name && name !== base ? name : "";
  localStorage.setItem("userCustomName", custom);
  if (name) localStorage.setItem("userName", name);
  localStorage.setItem("userLoc", loc);

  try { if (sb) await sb.auth.updateUser({ data: { custom_name: custom, custom_loc: loc } }); } catch (e) { console.warn(e); }

  const typedRaw = $("set-phone").value;   // баталгаажуулаагүй шинэ дугаарыг хадгалахад арилгахгүй
  showProfile(name);
  showTab("settings");
  $("set-phone").value = typedRaw;
  syncPhoneBtn();
  const typed = (typedRaw || "").replace(/\D/g, "");
  $("settings-err").textContent = (typed && localPhone(typed) !== phone && $("change-phone-btn").style.display !== "none")
    ? "Хадгалагдлаа. Дугаарыг «Баталгаажуулах» товчоор баталгаажуулна уу."
    : "Хадгалагдлаа";
  setTimeout(() => { $("settings-err").textContent = ""; }, 2500);
}

async function logout() {
  try { if (sb) await sb.auth.signOut(); } catch (e) { console.warn(e); }
  clearUserLocal();
  $("login-phone").value = "";
  $("login-code").value = "";
  $("login-err").textContent = "";
  showLoginView();
  go("#/");
}

// ---------- Утасны дугаараар (SMS) ----------
function formatPhone(p) {
  p = p.replace(/\D/g, "");
  if (p.startsWith("976")) return "+" + p;
  if (p.length === 8) return "+976" + p;
  return "+" + p;
}

// ---------- SMS хэмнэлт: 60 секундын завсар ----------
const SMS_GAP = 60;
function smsWait() {
  const last = Number(localStorage.getItem("smsLast") || 0);
  return Math.max(0, Math.ceil(SMS_GAP - (Date.now() - last) / 1000));
}
function runCooldown(btn, label) {
  if (!btn) return;
  clearInterval(btn._t);
  const tick = () => {
    const w = smsWait();
    if (w <= 0) { btn.disabled = false; btn.textContent = label; clearInterval(btn._t); return; }
    btn.disabled = true; btn.textContent = label + " (" + w + "с)";
  };
  tick();
  btn._t = setInterval(tick, 1000);
}
function smsErrText(error) {
  const m = (error && error.message || "").toLowerCase();
  if (m.includes("already") || m.includes("registered") || m.includes("exists")) return "Энэ дугаар өөр бүртгэл дээр бүртгэлтэй байна. Өмнө нь дугаараар нэвтэрч байсан бол «Утасны дугаараар нэвтрэх»-ээр орно уу";
  if (m.includes("sms_daily_limit")) return "Энэ дугаарт өнөөдөр хэт олон код илгээлээ. Маргааш дахин оролдоно уу";
  if (m.includes("sms_global_limit")) return "Систем түр ачаалалтай байна. Хэсэг хугацааны дараа дахин оролдоно уу";
  if (m.includes("rate") || m.includes("seconds") || m.includes("too many")) return "Хэт олон удаа оролдлоо. Түр хүлээгээд дахин оролдоно уу";
  if (m.includes("trial") || m.includes("unsupported")) return "Энэ дугаар руу код илгээх боломжгүй байна";
  return "Алдаа: " + (error && error.message || "");
}

function togglePhoneLogin() {}   // утасны нэвтрэлт үргэлж нээлттэй

let sendingCode = false;
// Supabase "N секундын дараа дахин хүсэх" гэвэл код саяхан явсан гэсэн үг - код оруулах алхам руу шилжинэ
const isTooSoon = e => /\d+ seconds/i.test((e && e.message) || "");
async function sendCode() {
  const err = $("login-err");
  const raw = $("login-phone").value.trim();
  if (sendingCode) return;
  if (raw.replace(/\D/g, "").length < 8) { err.textContent = "Дугаарыг бүтэн оруулна уу"; return; }
  if (!sb) { err.textContent = "Supabase ачаалагдаагүй байна"; return; }

  const w = smsWait();
  if (w > 0 && localStorage.getItem("pendingPhone") === formatPhone(raw)) {
    // саяхан ийм дугаарт код явуулсан - дахин явуулахгүй, код оруулах хэсэг рүү шилжинэ
    $("step-phone").style.display = "none"; $("step-code").style.display = "block";
    $("show-phone").textContent = formatPhone(raw); err.textContent = "";
    return;
  }
  if (w > 0) { err.textContent = w + " секундын дараа дахин оролдоно уу"; return; }

  const phone = formatPhone(raw);
  sendingCode = true;
  err.textContent = "Код явуулж байна...";
  try {
    const { error } = await sb.auth.signInWithOtp({ phone, options: { channel: "sms" } });
    if (error && !isTooSoon(error)) { err.textContent = smsErrText(error); return; }
    if (!error) localStorage.setItem("smsLast", String(Date.now()));
    runCooldown($("login-resend"), "Дахин илгээх");
    err.textContent = "";
    $("step-phone").style.display = "none";
    $("step-code").style.display = "block";
    $("show-phone").textContent = phone;
    localStorage.setItem("pendingPhone", phone);
    if (error) toast("Код саяхан явсан. Ирсэн кодоо оруулна уу");
  } finally { sendingCode = false; }
}

async function verifyCode() {
  const err = $("login-err");
  const phone = localStorage.getItem("pendingPhone");
  const token = $("login-code").value.trim();
  if (token.length !== 6) { err.textContent = "6 оронтой кодыг оруулна уу"; return; }
  if (!sb || !phone) { err.textContent = "Дахин код авна уу"; return; }

  err.textContent = "Шалгаж байна...";
  const { data, error } = await sb.auth.verifyOtp({ phone, token, type: "sms" });
  if (error || !data?.user) { err.textContent = "Код буруу байна"; return; }

  err.textContent = "";
  saveUserLocal(data.user, phone);
  localStorage.setItem("phoneVerified", "1");   // SMS-ээр нэвтэрсэн = дугаар баталгаажсан
  localStorage.removeItem("pendingPhone");
  afterLogin();
}

function backToPhone() {
  $("step-code").style.display = "none";
  $("step-phone").style.display = "block";
  $("login-err").textContent = "";
}

// ---------- Профайл зураг ----------
function renderAvatar(displayName) {
  const av = $("profile-avatar");
  const url = localStorage.getItem("userAvatar") || DEFAULT_AVATAR;
  av.style.backgroundImage = 'url("' + url.replace(/"/g, "%22") + '")';
  av.textContent = "";
}
function pickAvatar() { $("avatar-file").click(); }
function squareJpeg(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Зургийг уншиж чадсангүй"));
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const cv = document.createElement("canvas");
      cv.width = cv.height = size;
      cv.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      cv.toBlob(b => b ? resolve(b) : reject(new Error("Зураг боловсруулж чадсангүй")), "image/jpeg", 0.85);
    };
    img.src = URL.createObjectURL(file);
  });
}
$("avatar-file").addEventListener("change", async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f || !sb || !myUid) return;
  toast("Зураг хуулж байна...");
  try {
    const blob = await squareJpeg(f, 256);
    const fn = "avatars/" + myUid + "-" + Date.now() + ".jpg";
    const up = await fetch(SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + fn, {
      method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "image/jpeg" },
      body: blob
    });
    if (!up.ok) throw new Error(await up.text());
    const url = SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/" + fn;
    const { error } = await sb.auth.updateUser({ data: { custom_avatar: url } });
    if (error) throw error;
    localStorage.setItem("userAvatar", url);
    renderAvatar($("profile-name").textContent);
    toast("Зураг солигдлоо");
  } catch (err) {
    toast("Зураг солиход алдаа: " + (err.message || err));
  }
});

// ---------- Тохиргоо: утасны дугаар засаж баталгаажуулах ----------
function syncPhoneBtn() {
  const typed = ($("set-phone").value || "").replace(/\D/g, "");
  const valid = typed.length === 8 || (typed.length === 11 && typed.startsWith("976"));
  const current = isPhoneVerified() ? localPhone(localStorage.getItem("userPhone") || "") : "";
  const btn = $("change-phone-btn");
  btn.style.display = valid && localPhone(typed) !== current ? "" : "none";
}
$("set-phone").addEventListener("input", syncPhoneBtn);
function startPhoneVerify() {
  const typed = ($("set-phone").value || "").replace(/\D/g, "");
  openVerify(isPhoneVerified() ? "change" : "verify", localPhone(typed));
}

// Нэвтэрсний дараа: зар оруулах гэж байсан бол шууд үргэлжлүүлнэ
function afterLogin() {
  if (localStorage.getItem("wantPost") === "1") {
    localStorage.removeItem("wantPost");
    openModal();
  } else if (document.body.dataset.page === "profile") {
    showProfile();   // нэвтрэх хуудаснаас профайл руу шилжинэ
  }
}

// ---------- Утас баталгаажуулах (Google/Facebook-ээр орсон хэрэглэгчид, нэг удаа) ----------
let verifyMode = "post";   // "post" = зар оруулахын өмнө, "verify" = тохиргооноос баталгаажуулах, "change" = дугаар солих
function openVerify(mode, prefill) {
  verifyMode = mode === "change" || mode === "verify" ? mode : "post";
  $("v-title").textContent = verifyMode === "change" ? "Утасны дугаар солих" : "Утсаа баталгаажуулна уу";
  $("v-sub").textContent = verifyMode === "change"
    ? "Шинэ дугаараа оруулбал баталгаажуулах код ирнэ. Код оруулсны дараа дугаар солигдоно."
    : verifyMode === "verify"
      ? "Дугаараа оруулж, ирсэн кодоор баталгаажуулна уу."
      : "Зар оруулахын тулд утасны дугаараа нэг удаа баталгаажуулна. Дараа нь дахин шаардахгүй.";
  $("v-phone").value = prefill || "";
  $("v-code").value = "";
  closeAllModals();
  $("v-err").textContent = "";
  vBack();
  $("verifyModal").classList.add("open");
}
function closeVerify() { $("verifyModal").classList.remove("open"); }
function vBack() {
  $("v-step-code").style.display = "none";
  $("v-step-phone").style.display = "block";
  $("v-err").textContent = "";
}

let sendingVerify = false;
async function sendVerify() {
  const err = $("v-err");
  const raw = $("v-phone").value.trim();
  const digits = raw.replace(/\D/g, "");
  if (!(digits.length === 8 || (digits.length === 11 && digits.startsWith("976")))) {
    err.textContent = "8 оронтой дугаараа зөв оруулна уу"; return;
  }
  if (!sb) { err.textContent = "Supabase ачаалагдаагүй байна"; return; }
  const w = smsWait();
  if (w > 0) { err.textContent = w + " секундын дараа дахин оролдоно уу"; return; }

  const phone = formatPhone(raw);
  if (verifyMode === "change" && isPhoneVerified() && localPhone(phone) === localPhone(localStorage.getItem("userPhone"))) {
    err.textContent = "Энэ дугаар одоогийн дугаартай адил байна"; return;
  }
  if (sendingVerify) return;
  sendingVerify = true;
  err.textContent = "Код явуулж байна...";
  let error;
  try { ({ error } = await sb.auth.updateUser({ phone })); } finally { sendingVerify = false; }
  if (error && !isTooSoon(error)) { err.textContent = smsErrText(error); return; }

  if (!error) localStorage.setItem("smsLast", String(Date.now()));
  else toast("Код саяхан явсан. Ирсэн кодоо оруулна уу");
  localStorage.setItem("pendingVerify", phone);
  err.textContent = "";
  $("v-show").textContent = localPhone(phone);
  $("v-step-phone").style.display = "none";
  $("v-step-code").style.display = "block";
  runCooldown($("v-resend"), "Дахин илгээх");
}

async function confirmVerify() {
  const err = $("v-err");
  const phone = localStorage.getItem("pendingVerify");
  const token = $("v-code").value.trim();
  if (token.length !== 6) { err.textContent = "6 оронтой кодыг оруулна уу"; return; }
  if (!sb || !phone) { err.textContent = "Дахин код авна уу"; return; }

  err.textContent = "Шалгаж байна...";
  const { data, error } = await sb.auth.verifyOtp({ phone, token, type: "phone_change" });
  if (error) { err.textContent = "Код буруу эсвэл хугацаа дууссан байна"; return; }

  if (data && data.user) saveUserLocal(data.user, phone);
  localStorage.setItem("phoneVerified", "1");
  localStorage.setItem("userPhone", localPhone(phone));
  localStorage.removeItem("pendingVerify");
  $("v-code").value = "";
  closeVerify();
  if (verifyMode === "change" || verifyMode === "verify") {
    toast(verifyMode === "change" ? "Утасны дугаар солигдлоо" : "Утас баталгаажлаа");
    openProfile("settings");
  } else {
    openModal();   // шууд зар оруулах цонх руу
  }
}

// =====================================================
// ЧАТ (Supabase: messages хүснэгт + realtime)
// =====================================================
const chatMissing = e => e && (e.code === "42P01" || e.code === "PGRST205" || /relation|schema cache|does not exist/i.test(e.message || ""));
const hhmm = iso => { const d = new Date(iso); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };

function setBadge(n) {
  const b = $("chatBadge");
  b.textContent = n > 9 ? "9+" : String(n);
  b.classList.toggle("show", n > 0);
}
async function refreshBadge() {
  if (!sb || !myUid) { setBadge(0); return; }
  const { count, error } = await sb.from("messages").select("id", { count: "exact", head: true })
    .eq("receiver_id", myUid).eq("read", false);
  if (!error) setBadge(count || 0);
}

function initChat() {
  if (!sb || !myUid) return;
  stopChat(true);
  refreshBadge();
  try {
    chatChannel = sb.channel("msgs-" + myUid)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "receiver_id=eq." + myUid }, onIncoming)
      .subscribe();
  } catch (e) { console.warn("realtime алдаа", e); }
  pollT = setInterval(() => { if (!document.hidden) refreshBadge(); }, 30000);  // realtime байхгүй үед нөөц
}
function stopChat(keepUid) {
  if (chatChannel && sb) { try { sb.removeChannel(chatChannel); } catch (e) {} }
  chatChannel = null;
  clearInterval(pollT);
  if (!keepUid) { myUid = null; chatCur = null; setBadge(0); }
}

function onIncoming(payload) {
  const m = payload.new;
  const onChat = document.body.dataset.page === "chat";
  const inThread = onChat && chatCur && String(m.ad_id) === chatCur.adId && m.sender_id === chatCur.otherId;
  if (inThread) {
    appendBubble(m);
    markRead(chatCur.adId, chatCur.otherId);
  } else {
    refreshBadge();
    if (onChat) loadConversations();
    else toast("Шинэ мессеж ирлээ");
  }
}

function openChat() { go("#/chat"); }   // мессеж байхгүй ч, нэвтрээгүй ч нээгдэнэ
function chatBack() {
  chatCur = null;
  $("chat-layout").classList.remove("in-thread");
  $("page-chat").classList.remove("in-thread");
  $("chat-thread-view").style.display = "none";
  loadConversations();
}

// Админы нэр, зураг (site_profile хүснэгтээс; байхгүй бол "SelengeZar · Админ")
let adminProf = null;
const adminProfP = fetch(SUPABASE_URL + "/rest/v1/site_profile?select=name,avatar_url&id=eq.1", { headers: { apikey: KEY, Authorization: "Bearer " + KEY } })
  .then(r => r.ok ? r.json() : []).then(d => { adminProf = d && d[0] || null; }).catch(() => {});
const convTitle = (adId, t) => String(adId) === "admin" && adminProf && adminProf.name ? adminProf.name : t;
function avatarHTML(adId, title) {
  const adm = String(adId) === "admin", url = adm && adminProf && adminProf.avatar_url;
  return `<span class="cav${adm ? " admin" : ""}${url ? " img" : ""}"${url ? ` style="background-image:url('${esc(url)}')"` : ""}>${url ? "" : esc(initialOf(title))}</span>`;
}
const initialOf = t => (String(t || "?").replace(/^[^\p{L}\p{N}]+/u, "").charAt(0) || "?").toUpperCase();
async function loadConversations() {
  const box = $("chat-list");
  await adminProfP;
  if (!sb || !myUid) {
    box.innerHTML = "<div class='empty'>Чат ашиглахын тулд нэвтэрнэ үү.</div><button class='btn btn-block btn-stack' onclick='openProfile()'>Нэвтрэх</button>";
    return;
  }
  box.innerHTML = "<div class='empty'>Ачаалж байна...</div>";
  const { data, error } = await sb.from("messages").select("*")
    .or("sender_id.eq." + myUid + ",receiver_id.eq." + myUid)
    .order("created_at", { ascending: false }).limit(300);
  if (error) {
    box.innerHTML = "<div class='empty'>" + (chatMissing(error) ? "Чат хараахан тохируулагдаагүй байна." : "Алдаа: " + esc(error.message)) + "</div>";
    return;
  }
  const map = new Map();
  for (const m of data) {
    const other = m.sender_id === myUid ? m.receiver_id : m.sender_id;
    const key = m.ad_id + "|" + other;
    if (!map.has(key)) map.set(key, { adId: String(m.ad_id), title: m.ad_title || "Зар", other, last: m, unread: 0, mine: m.sender_id === myUid });
    if (m.receiver_id === myUid && !m.read) map.get(key).unread++;
  }
  if (!map.size) {
    box.innerHTML = "<div class='empty chat-empty'>" + ico("chat") + "<b>Мессеж алга</b><span>Зар дээрх «Чат бичих» товчоор эхэлнэ.</span></div>";
    return;
  }
  box.innerHTML = [...map.values()].map(c => `
    <button class="chat-item" data-ad="${esc(c.adId)}" data-other="${esc(c.other)}" data-title="${esc(c.title)}">
      ${avatarHTML(c.adId, convTitle(c.adId, c.title))}
      <div class="ci-main">
        <div class="ci-title">${esc(convTitle(c.adId, c.title))}</div>
        <div class="ci-last">${c.mine ? "Та: " : ""}${esc(c.last.body)}</div>
      </div>
      <div class="ci-time">${esc(hhmm(c.last.created_at))}</div>
      ${c.unread ? `<span class="dot">${c.unread}</span>` : ""}
    </button>`).join("");
}
$("chat-list").addEventListener("click", e => {
  const it = e.target.closest(".chat-item");
  if (it) openThread(it.dataset.ad, it.dataset.title, it.dataset.other, "");
});

async function openThread(adId, title, otherId, sub) {
  await adminProfP;
  chatCur = { adId: String(adId), adTitle: title, otherId };
  title = convTitle(adId, title);
  $("chat-layout").classList.add("in-thread");
  $("page-chat").classList.add("in-thread");
  $("chat-thread-view").style.display = "flex";
  $("chat-title").textContent = title;
  $("chat-sub").textContent = sub || (String(adId) === "admin" ? "Админ" : "Зарын чат");
  const av = $("chat-av"), aurl = String(adId) === "admin" && adminProf && adminProf.avatar_url;
  av.textContent = aurl ? "" : initialOf(title);
  av.style.backgroundImage = aurl ? `url('${aurl.replace(/'/g, "%27")}')` : "";
  av.classList.toggle("img", !!aurl);
  av.classList.toggle("admin", String(adId) === "admin");
  const box = $("chat-msgs");
  box.innerHTML = "<div class='empty'>Ачаалж байна...</div>";
  const { data, error } = await sb.from("messages").select("*")
    .eq("ad_id", chatCur.adId)
    .or("and(sender_id.eq." + myUid + ",receiver_id.eq." + otherId + "),and(sender_id.eq." + otherId + ",receiver_id.eq." + myUid + ")")
    .order("created_at", { ascending: true }).limit(500);
  if (error) {
    box.innerHTML = "<div class='empty'>" + (chatMissing(error) ? "Чат хараахан тохируулагдаагүй байна." : "Алдаа: " + esc(error.message)) + "</div>";
    return;
  }
  box.innerHTML = data.length ? "" : "<div class='empty'>Мессеж бичиж эхлээрэй</div>";
  data.forEach(appendBubble);
  markRead(chatCur.adId, otherId);
  $("chat-input").focus();
}

function appendBubble(m) {
  const box = $("chat-msgs");
  const empty = box.querySelector(".empty");
  if (empty) empty.remove();
  const d = document.createElement("div");
  d.className = "bubble " + (m.sender_id === myUid ? "me" : "them");
  d.innerHTML = esc(m.body) + "<small>" + esc(hhmm(m.created_at)) + "</small>";
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}

async function markRead(adId, otherId) {
  await sb.from("messages").update({ read: true })
    .eq("receiver_id", myUid).eq("sender_id", otherId).eq("ad_id", adId).eq("read", false);
  refreshBadge();
}

async function sendMsg() {
  const inp = $("chat-input");
  const body = inp.value.trim();
  if (!body || !chatCur || !myUid) return;
  inp.value = "";
  const row = { ad_id: chatCur.adId, ad_title: chatCur.adTitle, sender_id: myUid, receiver_id: chatCur.otherId, body };
  const { data, error } = await sb.from("messages").insert(row).select().single();
  if (error) {
    inp.value = body;
    toast(chatMissing(error) ? "Чат хараахан тохируулагдаагүй байна" : "Илгээж чадсангүй: " + error.message);
    return;
  }
  appendBubble(data);
}
$("chat-input").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); sendMsg(); } });

// ---------- Session ----------
if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session) {
      saveUserLocal(session.user);
      if (window.location.hash.includes("access_token")) {
        history.replaceState(null, "", window.location.pathname);
      }
      afterLogin();
    }
    if (event === "SIGNED_OUT") clearUserLocal();
  });

  sb.auth.getSession().then(({ data }) => {
    if (data && data.session) saveUserLocal(data.session.user);
  }).catch(() => {});
}

// =====================================================
// 4. ДООД BAR
// =====================================================
function setActiveNav(btn) {
  document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
  if (btn) btn.classList.add("active");
}
function syncNav() {
  const page = document.body.dataset.page || "home";
  const items = document.querySelectorAll(".bottom-nav .nav-item");
  const idx = { home: 0, saved: 1, add: 2, ad: 0, chat: 3, profile: 4, mine: 4 }[page] ?? 0;
  setActiveNav(items[idx]);
}

// ---------- Хуудас солих (hash router): #/ нүүр, #/mine миний зарууд, #/chat чат ----------
let pendingThread = null;
function go(hash) {
  if (location.hash === hash || (hash === "#/" && (location.hash === "" || location.hash === "#"))) route();
  else location.hash = hash;
}
const PAGES = ["home", "saved", "add", "ad", "chat", "profile", "mine"];
function route() {
  closeAllModals();
  const h = location.hash;
  const page = PAGES.find(p => p !== "home" && h.startsWith("#/" + p)) || "home";
  // Зар оруулах/засах хуудаснаас гарахад засварын төлөвийг цэвэрлэнэ
  if (page !== "add" && editingId) { resetAdForm(); setFormMode(null); }
  document.body.dataset.page = page;
  PAGES.forEach(p => { $("page-" + p).hidden = p !== page; });
  if (page === "mine") renderMine();
  if (page === "saved") renderSaved();
  if (page === "ad") renderAd(decodeURIComponent(h.slice(5)));
  if (page === "profile") {
    if (isLoggedIn()) { showProfile(); if (pendingTab) showTab(pendingTab); }
    else showLoginView();
    pendingTab = null;
  }
  if (page === "chat") {
    if (pendingThread && sb && myUid) { const t = pendingThread; pendingThread = null; openThread(...t); }
    else { pendingThread = null; chatBack(); }
  }
  if (page === "home") setTimeout(() => setupFeatured(FT.list, !FT.sig), 0);
  syncNav();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

function goHome(btn) {
  view = "all";
  cat = "Бүгд";
  locSel = "";
  document.querySelectorAll("#cats .cat").forEach(x => x.classList.toggle("active", x.textContent === "Бүгд"));
  document.querySelectorAll("#locs .cat").forEach(x => x.classList.toggle("active", x.dataset.loc === ""));
  $("q").value = "";
  render();
  go("#/");
}
function goSaved(btn) { go("#/saved"); }
function goChat(btn) { go("#/chat"); }
function goProfile(btn) { openProfile(); }

// Цонхны гадна дарвал / Esc дарвал хаах
// Профайлын цонх гадна дарж хаагдахгүй - зөвхөн ✕ товчоор хаагдана
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && document.body.dataset.page === "ad") adBack();
});

// Цонх нээгдэх/хаагдах бүрт цаад талын гүйлтийг түгжинэ/тайлна
const lockObserver = new MutationObserver(syncScrollLock);
MODAL_IDS.forEach(id => lockObserver.observe($(id), { attributes: true, attributeFilter: ["class"] }));

route();
load();
