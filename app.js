/* ===== SelengeZar - app.js ===== */

// ---------- Тохиргоо ----------
const SUPABASE_URL = "https://ocjpkwlkwtvqjpnwnfes.supabase.co";
const KEY = "sb_publishable_ZIYp3CB6jyjXzaBxdQv1Dw_rpfE1s21";
const API = SUPABASE_URL + "/rest/v1/ads";
const BUCKET = "ads-images";
const DEFAULT_IMG = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600";
const DEFAULT_LOC = "Сүхбаатар, Сэлэнгэ";
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
(function initHero() {
  const hero = $("hero"), track = $("heroTrack"), dotsBox = $("heroDots");
  const slides = [...track.querySelectorAll("img")];
  const n = slides.length;
  if (!n) return;

  track.appendChild(slides[0].cloneNode(true)); // төгсгөлд эхний зургийн хуулбар
  let index = 0, timer = null, holding = false, startX = 0;

  const dots = slides.map((_, i) => {
    const b = document.createElement("button");
    b.setAttribute("aria-label", "Зураг " + (i + 1));
    b.addEventListener("pointerdown", e => e.stopPropagation());
    b.onclick = () => { index = i; update(); restart(); };
    dotsBox.appendChild(b);
    return b;
  });

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
    if (e.target === track && index >= n) jump(0);
  });

  function start() { stop(); timer = setInterval(() => { if (!holding) next(); }, 3000); }
  function stop() { clearInterval(timer); }
  function restart() { stop(); start(); }

  hero.addEventListener("pointerdown", e => { holding = true; startX = e.clientX; });
  hero.addEventListener("pointerup", e => {
    if (!holding) return;
    holding = false;
    const diff = e.clientX - startX;
    if (diff < -50) next();
    else if (diff > 50) prev();
    restart();
  });
  hero.addEventListener("pointercancel", () => { holding = false; });
  hero.addEventListener("pointerleave", () => { holding = false; });

  update();
  start();
})();

// =====================================================
// 2. ЗАРУУД
// =====================================================
let ads = [], cat = "Бүгд", file = null;

const catsEl = $("cats");
CATS.forEach(c => {
  const b = document.createElement("button");
  b.className = "cat" + (c === cat ? " active" : "");
  b.textContent = c;
  b.onclick = () => {
    cat = c;
    document.querySelectorAll(".cat").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    render();
  };
  catsEl.appendChild(b);
});
$("q").addEventListener("input", render);

async function load() {
  try {
    const r = await fetch(API + "?select=*&order=created_at.desc",
      { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    ads = (await r.json()).filter(a => a.status !== "hidden");   // админ нуусан зар харагдахгүй
    statusText = "Нийт " + ads.length + " зар";
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

const isFeat = a => a.featured === true && (!a.featured_until || new Date(a.featured_until) > new Date());
const fmtDate = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
function featAction(a) {
  if (isFeat(a)) return `<div class="feat-note">${ico("star")} Онцлох${a.featured_until ? " · " + fmtDate(a.featured_until) + " хүртэл" : ""}</div>`;
  if (a.feature_requested) return `<button class="feat-btn pending" data-pay="${esc(a.id)}">${ico("clock")} Төлбөр хүлээгдэж байна</button>`;
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
      ${opts && opts.edit ? `<div class="card-actions"><button class="edit-btn" data-edit="${esc(a.id)}">${ico("pencil")} Зар засах</button>${featAction(a)}</div>` : ""}
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
    (view !== "saved" || saved.includes(String(a.id))) &&
    (cat === "Бүгд" || (a.cat || "Бусад") === cat) &&
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
  const list = ids.map(findAd).filter(Boolean);   // хамгийн сүүлд хадгалсан нь эхэнд
  $("saved-title").textContent = "Хадгалсан зар (" + list.length + ")";
  $("saved-grid").innerHTML = list.length
    ? list.map(a => cardHTML(a)).join("")
    : "<div class='empty'>Хадгалсан зар алга. Зарын зураг дээрх тэмдэгийг дарж хадгална уу.</div>";
}

// ---------- "Миний зарууд" хуудас ----------
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
  const pay = e.target.closest("[data-pay]");
  if (pay) { e.stopPropagation(); onFeatureClick(pay.dataset.pay); return; }
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

// Зарын хуудсыг бөглөх (route() дуудна)
function renderAd(id) {
  const a = findAd(id);
  curAd = a || null;
  if (!a) {
    if (adsLoaded) { toast("Зар олдсонгүй"); go("#/"); }
    else { $("ad-title").textContent = "Ачаалж байна..."; ["ad-price", "ad-meta", "ad-desc"].forEach(k => { $(k).innerHTML = ""; }); }
    return;
  }
  const img = $("ad-img");
  img.src = a.img || DEFAULT_IMG;
  img.onerror = function () { this.onerror = null; this.src = DEFAULT_IMG; };
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
  const ph = localStorage.getItem("userPhone");
  if (ph && !$("f-phone").value) $("f-phone").value = ph;
  go("#/add");
}
// Зар оруулах/засах хуудсаас буцах
function closeModal() {
  const dest = editingId ? "#/mine" : "#/";
  go(dest);   // route() нь хуудаснаас гарахад засварын төлөвийг цэвэрлэнэ
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
  $("plan-pick").hidden = isFeat(a);
  setPlan(a.feature_requested ? "featured" : "normal");
  $("f-title").value = a.title || "";
  $("f-price").value = a.price ?? "";
  $("f-cat").value = a.cat || "Бусад";
  $("f-phone").value = a.phone || "";
  $("f-loc").value = a.loc || "";
  $("f-desc").value = a.description || "";
  if (a.img) { $("preview").src = a.img; $("preview").style.display = "block"; }
  $("err").textContent = "Зураг солихгүй бол хуучнаараа үлдэнэ.";
  go("#/add");
}

function resetAdForm() {
  ["f-title", "f-price", "f-phone", "f-loc", "f-desc"].forEach(id => $(id).value = "");
  $("f-cat").selectedIndex = 0;
  $("f-file").value = "";
  $("preview").style.display = "none";
  $("preview").removeAttribute("src");
  $("err").textContent = "";
  file = null;
  setPlan("normal");
}

$("f-file").addEventListener("change", e => {
  file = e.target.files[0] || null;
  const p = $("preview");
  if (!file) { p.style.display = "none"; return; }
  p.src = URL.createObjectURL(file);
  p.style.display = "block";
  $("err").textContent = file.size > 500 * 1024
    ? "Зураг " + (file.size / 1024 / 1024).toFixed(1) + "MB байна. Оруулахад автоматаар жижигрүүлнэ."
    : "";
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

  btn.disabled = true;
  err.textContent = editingId ? "Хадгалж байна..." : "Зар оруулж байна...";
  try {
    let imgUrl = editingId ? null : DEFAULT_IMG;
    if (file) {
      err.textContent = "Зургийг жижигрүүлж байна... (" + (file.size / 1024 / 1024).toFixed(1) + "MB)";
      const small = await compressImage(file);
      const fn = Date.now() + "-" + small.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const up = await fetch(SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + fn, {
        method: "POST",
        headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": small.type },
        body: small
      });
      if (!up.ok) throw new Error("Зураг хуулахад алдаа: " + await up.text());
      imgUrl = SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/" + fn;
    }

    if (editingId) {   // ---- Одоо байгаа зарыг засах (нэвтэрсэн хэрэглэгчийн token-оор, зөвхөн өөрийн зар) ----
      const patch = {
        title, price: Number(price), cat: $("f-cat").value,
        phone: $("f-phone").value.trim(),
        loc: $("f-loc").value.trim() || DEFAULT_LOC,
        description: $("f-desc").value.trim()
      };
      if (imgUrl) patch.img = imgUrl;
      const cur = findAd(editingId);
      const askPay = plan === "featured" && cur && !isFeat(cur);
      if (cur && !isFeat(cur) && (plan === "featured") !== !!cur.feature_requested) patch.feature_requested = plan === "featured";
      const { data: sess } = await sb.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      if (!token) throw new Error("Дахин нэвтэрнэ үү");
      const pr = await fetch(API + "?id=eq." + encodeURIComponent(editingId), {
        method: "PATCH",
        headers: { apikey: KEY, Authorization: "Bearer " + token, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(patch)
      });
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
      phone: $("f-phone").value.trim(),
      loc: $("f-loc").value.trim() || DEFAULT_LOC,
      img: imgUrl,
      description: $("f-desc").value.trim()
    };
    const wantFeat = plan === "featured";
    if (wantFeat) body.feature_requested = true;
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
      const col = ["feature_requested", "user_id"].find(c => c in body && t.includes(c));
      if (!col) throw new Error("Алдаа: " + t);
      delete body[col];
      r = await post(body);
    }
    if (!r.ok) throw new Error("Алдаа: " + await r.text());
    const d = await r.json();
    ads.unshift(d[0]);
    statusText = "Нийт " + ads.length + " зар";
    render();
    resetAdForm();
    closeModal();
    toast("Зар амжилттай нийтлэгдлээ!");
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
  const displayName = localPhone(name || localStorage.getItem("userName") || email || phone || "Хэрэглэгч");

  $("profile-name").textContent = displayName;
  // Өөрийн нэр өгсөн бол зөвхөн нэр. Үгүй бол нэрний доор и-мэйл / утас / Facebook-ийн аль нэг нь.
  let provs = [];
  try { provs = JSON.parse(localStorage.getItem("providers") || "[]"); } catch (e) {}
  const ident = email || phone || (provs.includes("facebook") ? "Facebook" : "");
  $("profile-email").textContent = customName || ident === displayName ? "" : ident;
  const verified = isPhoneVerified();
  let prov = [];
  try { prov = JSON.parse(localStorage.getItem("providers") || "[]"); } catch (e) {}
  const linkBtn = p => `<button class="btn btn-outline btn-sm" onclick="linkProvider('${p}')">Холбох</button>`;
  $("profile-phone").innerHTML = phone
    ? esc(phone) + (verified ? ' <span class="ok">' + ico("check-circle") + '</span>' : ' <button class="btn btn-outline btn-sm" onclick="openVerify(\'verify\')">Баталгаажуулах</button>')
    : '<button class="btn btn-outline btn-sm" onclick="openVerify(\'verify\')">Баталгаажуулах</button>';
  $("st-google").innerHTML = prov.includes("google") ? '<span class="ok">' + ico("check") + ' Холбогдсон</span>' : linkBtn("google");
  $("st-facebook").innerHTML = prov.includes("facebook") ? '<span class="ok">' + ico("check") + ' Холбогдсон</span>' : linkBtn("facebook");
  updateMyCount();
  $("profile-loc").textContent = loc;
  renderAvatar(displayName);
  $("set-name").value = displayName;
  $("set-phone").value = phone;
  syncPhoneBtn();
  $("set-loc").value = loc;
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
  const loc = $("set-loc").value.trim() || DEFAULT_LOC;

  // Нэр нь Google/Facebook/и-мэйлийн анхны нэрээс өөр бол "өөрийн нэр" гэж тооцно
  const base = localStorage.getItem("userProviderName") || "";
  const custom = name && name !== base ? name : "";
  localStorage.setItem("userCustomName", custom);
  if (name) localStorage.setItem("userName", name);
  localStorage.setItem("userLoc", loc);

  try { if (sb) await sb.auth.updateUser({ data: { custom_name: custom } }); } catch (e) { console.warn(e); }

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

// ---------- Google / Facebook ----------
async function oauth(provider) {
  if (!sb) { alert("Supabase сан ачаалагдаагүй байна. Хуудсаа дахин ачаална уу."); return; }
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
  if (error) alert(provider + " алдаа: " + error.message);
}
const loginWithGoogle = () => oauth("google");
const loginWithFacebook = () => oauth("facebook");

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
  if (m.includes("already") || m.includes("registered") || m.includes("exists")) return "Энэ дугаар өөр бүртгэлд байна. Өмнө нь дугаараар нэвтэрч байсан бол «Утасны дугаараар нэвтрэх»-ээр орж, Профайл дээрээс Google/Facebook холбоорой";
  if (m.includes("rate") || m.includes("seconds") || m.includes("too many")) return "Хэт олон удаа оролдлоо. Түр хүлээгээд дахин оролдоно уу";
  if (m.includes("trial") || m.includes("unsupported")) return "Энэ дугаар руу код илгээх боломжгүй байна";
  return "Алдаа: " + (error && error.message || "");
}
// Нэг бүртгэлд Google / Facebook / утсыг холбох (Supabase identity linking)
async function linkProvider(provider) {
  if (!sb) return;
  const { error } = await sb.auth.linkIdentity({
    provider,
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
  if (error) {
    const m = (error.message || "").toLowerCase();
    toast(m.includes("manual linking") ? "Supabase дээр «Allow manual linking»-г асаана уу" : "Холбож чадсангүй: " + error.message);
  }
}

function togglePhoneLogin() {
  const box = $("phone-login");
  const open = box.style.display === "none";
  box.style.display = open ? "block" : "none";
  $("phone-toggle").style.display = open ? "none" : "block";
}

async function sendCode() {
  const err = $("login-err");
  const raw = $("login-phone").value.trim();
  if (raw.replace(/\D/g, "").length < 8) { err.textContent = "Дугаарыг бүтэн оруулна уу"; return; }
  if (!sb) { err.textContent = "Supabase ачаалагдаагүй байна"; return; }

  const w = smsWait();
  if (w > 0) { err.textContent = w + " секундын дараа дахин оролдоно уу"; return; }

  const phone = formatPhone(raw);
  err.textContent = "Код явуулж байна...";
  const { error } = await sb.auth.signInWithOtp({ phone, options: { channel: "sms" } });
  if (error) { err.textContent = smsErrText(error); return; }
  localStorage.setItem("smsLast", String(Date.now()));
  runCooldown($("login-resend"), "Дахин илгээх");

  err.textContent = "";
  $("step-phone").style.display = "none";
  $("step-code").style.display = "block";
  $("show-phone").textContent = phone;
  localStorage.setItem("pendingPhone", phone);
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
  const url = localStorage.getItem("userAvatar") || "";
  if (url) {
    av.style.backgroundImage = 'url("' + url.replace(/"/g, "%22") + '")';
    av.textContent = "";
  } else {
    av.style.backgroundImage = "";
    av.textContent = (displayName || "?").charAt(0).toUpperCase();
  }
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
  err.textContent = "Код явуулж байна...";
  const { error } = await sb.auth.updateUser({ phone });
  if (error) { err.textContent = smsErrText(error); return; }

  localStorage.setItem("smsLast", String(Date.now()));
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
  return `<span class="avatar${adm ? " admin" : ""}${url ? " img" : ""}"${url ? ` style="background-image:url('${esc(url)}')"` : ""}>${url ? "" : esc(initialOf(title))}</span>`;
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
  document.querySelectorAll(".cat").forEach(x => x.classList.toggle("active", x.textContent === "Бүгд"));
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
