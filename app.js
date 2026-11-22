/* ===== SelengeZar - app.js ===== */

// ---------- Тохиргоо ----------
const SUPABASE_URL = "https://ocjpkwlkwtvqjpnwnfes.supabase.co";
const KEY = "sb_publishable_ZIYp3CB6jyjXzaBxdQv1Dw_rpfE1s21";
const API = SUPABASE_URL + "/rest/v1/ads";
const BUCKET = "ads-images";
const DEFAULT_IMG = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600";
const DEFAULT_LOC = "Сүхбаатар, Сэлэнгэ";
const CATS = ["Бүгд", "Утас", "Машин", "Байр", "Тавилга", "Хувцас", "Бусад"];

const $ = id => document.getElementById(id);
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
    ads = await r.json();
    $("status").textContent = "✅ Supabase холбогдлоо. Нийт " + ads.length + " зар байна.";
  } catch (e) {
    $("status").textContent = "⚠ Supabase-д холбогдсонгүй: " + e.message;
    ads = [];
  }
  render();
}

function render() {
  const q = ($("q").value || "").trim().toLowerCase();
  const list = ads.filter(a =>
    (cat === "Бүгд" || (a.cat || "Бусад") === cat) &&
    [a.title, a.description, a.loc].some(t => (t || "").toLowerCase().includes(q))
  );
  const g = $("grid");
  if (!list.length) {
    g.innerHTML = "<div class='empty'>Одоогоор зар алга. Эхлээд зар оруулаарай.</div>";
    return;
  }
  g.innerHTML = list.map(a => `
    <div class="card">
      <img src="${esc(a.img || DEFAULT_IMG)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_IMG}'">
      <div class="card-body">
        <div class="price">${Number(a.price || 0).toLocaleString()}₮</div>
        <h3>${esc(a.title)}</h3>
        <div class="meta">${esc(a.loc)} • ${esc(a.cat)}</div>
        <div><span class="phone">☎ ${esc(a.phone)}</span></div>
        <div class="meta desc">${esc(a.description)}</div>
      </div>
    </div>`).join("");
}

// ---------- Зар оруулах цонх ----------
function openModal() { $("modal").classList.add("open"); }
function closeModal() { $("modal").classList.remove("open"); }

function resetAdForm() {
  ["f-title", "f-price", "f-phone", "f-loc", "f-desc"].forEach(id => $(id).value = "");
  $("f-cat").selectedIndex = 0;
  $("f-file").value = "";
  $("preview").style.display = "none";
  $("preview").removeAttribute("src");
  $("err").textContent = "";
  file = null;
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
  const title = $("f-title").value.trim();
  const price = $("f-price").value.trim();
  if (!title) { err.textContent = "Нэрийг бичнэ үү"; return; }
  if (!price) { err.textContent = "Үнийг бичнэ үү"; return; }

  btn.disabled = true;
  err.textContent = "Зар оруулж байна...";
  try {
    let imgUrl = DEFAULT_IMG;
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

    const body = {
      title,
      price: Number(price),
      cat: $("f-cat").value,
      phone: $("f-phone").value.trim(),
      loc: $("f-loc").value.trim() || DEFAULT_LOC,
      img: imgUrl,
      description: $("f-desc").value.trim()
    };
    const r = await fetch(API, {
      method: "POST",
      headers: {
        apikey: KEY, Authorization: "Bearer " + KEY,
        "Content-Type": "application/json", Prefer: "return=representation"
      },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error("Алдаа: " + await r.text());
    const d = await r.json();
    ads.unshift(d[0]);
    $("status").textContent = "✅ Supabase холбогдлоо. Нийт " + ads.length + " зар байна.";
    render();
    resetAdForm();
    closeModal();
    alert("Зар Supabase-д хадгалагдлаа!");
  } catch (e) {
    err.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
};

// =====================================================
// 3. НЭВТРЭХ / ПРОФАЙЛ
// =====================================================
const LS_KEYS = ["userEmail", "userPhone", "userName", "userLoc", "userCreated", "pendingPhone"];

function saveUserLocal(u, fallbackPhone) {
  if (!u) return;
  const meta = u.user_metadata || {};
  const name = meta.full_name || meta.name || u.email || u.phone || fallbackPhone || "";
  localStorage.setItem("userEmail", u.email || "");
  localStorage.setItem("userPhone", u.phone || meta.phone || fallbackPhone || "");
  localStorage.setItem("userName", name);
}
function clearUserLocal() { LS_KEYS.forEach(k => localStorage.removeItem(k)); }
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
  const phone = localStorage.getItem("userPhone") || "";
  const loc = localStorage.getItem("userLoc") || DEFAULT_LOC;
  const displayName = name || localStorage.getItem("userName") || email || phone || "Хэрэглэгч";
  if (!localStorage.getItem("userCreated")) {
    localStorage.setItem("userCreated", new Date().toLocaleDateString("mn-MN"));
  }

  $("profile-name").textContent = displayName;
  $("profile-email").textContent = email;
  $("profile-phone").textContent = phone || "-";
  $("profile-loc").textContent = loc;
  $("profile-avatar").textContent = displayName.charAt(0).toUpperCase();
  $("profile-date").textContent = localStorage.getItem("userCreated");
  $("set-name").value = displayName;
  $("set-phone").value = phone;
  $("set-loc").value = loc;
}

function showTab(tab) {
  $("tab-profile").style.display = tab === "profile" ? "flex" : "none";
  $("tab-settings").style.display = tab === "settings" ? "flex" : "none";
  $("tab-profile-btn").classList.toggle("active", tab === "profile");
  $("tab-settings-btn").classList.toggle("active", tab === "settings");
}

function openProfile() {
  if (isLoggedIn()) showProfile();
  else showLoginView();
  $("profileModal").classList.add("open");
}
function closeProfile() {
  $("profileModal").classList.remove("open");
  const home = document.querySelector(".bottom-nav .nav-item");
  if (home) setActiveNav(home);
}

async function saveSettings() {
  const name = $("set-name").value.trim();
  const phone = $("set-phone").value.trim();
  const loc = $("set-loc").value.trim() || DEFAULT_LOC;

  localStorage.setItem("userName", name);
  localStorage.setItem("userPhone", phone);
  localStorage.setItem("userLoc", loc);

  try { if (sb) await sb.auth.updateUser({ data: { full_name: name, phone } }); } catch (e) { console.warn(e); }

  showProfile(name);
  showTab("settings");
  $("settings-err").textContent = "✅ Хадгалагдлаа!";
  setTimeout(() => { $("settings-err").textContent = ""; }, 2000);
}

async function logout() {
  try { if (sb) await sb.auth.signOut(); } catch (e) { console.warn(e); }
  clearUserLocal();
  $("login-phone").value = "";
  $("login-code").value = "";
  $("login-err").textContent = "";
  showLoginView();
  closeProfile();
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

async function sendCode() {
  const err = $("login-err");
  const raw = $("login-phone").value.trim();
  if (raw.replace(/\D/g, "").length < 8) { err.textContent = "Дугаарыг бүтэн оруулна уу"; return; }
  if (!sb) { err.textContent = "Supabase ачаалагдаагүй байна"; return; }

  const phone = formatPhone(raw);
  err.textContent = "Код явуулж байна...";
  const { error } = await sb.auth.signInWithOtp({ phone, options: { channel: "sms" } });
  if (error) { err.textContent = "Алдаа: " + error.message; return; }

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
  localStorage.removeItem("pendingPhone");
  showProfile();
  alert("Амжилттай нэвтэрлээ!");
}

function backToPhone() {
  $("step-code").style.display = "none";
  $("step-phone").style.display = "block";
  $("login-err").textContent = "";
}

// ---------- Session ----------
if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session) {
      saveUserLocal(session.user);
      if (window.location.hash.includes("access_token")) {
        history.replaceState(null, "", window.location.pathname);
      }
      showProfile();
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

function goHome(btn) {
  setActiveNav(btn);
  cat = "Бүгд";
  document.querySelectorAll(".cat").forEach(x => x.classList.toggle("active", x.textContent === "Бүгд"));
  $("q").value = "";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function goSaved(btn) {
  setActiveNav(btn);
  alert("Хадгалсан зар хараахан хийгдээгүй байна.");
}
function goChat(btn) {
  setActiveNav(btn);
  alert("Чат хараахан хийгдээгүй байна.");
}
function goProfile(btn) {
  setActiveNav(btn);
  openProfile();
}

// Цонхны гадна дарвал / Esc дарвал хаах
$("modal").addEventListener("click", e => { if (e.target === $("modal")) closeModal(); });
// Профайлын цонх гадна дарж хаагдахгүй - зөвхөн ✕ товчоор хаагдана
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});

load();
