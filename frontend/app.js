const API_URL = "/api/transactions";
const DEBTS_API_URL = "/api/debts";
const GOALS_API_URL = "/api/goals";

// ==========================================
// KİMLİK DOĞRULAMA (TOKEN & AUTH YÖNETİMİ)
// ==========================================
function getToken() {
  return localStorage.getItem("authToken");
}

function setToken(token) {
  localStorage.setItem("authToken", token);
}

function removeToken() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("currentUser");
}

// Güvenli Fetch Wrapper'ı (Tüm API isteklerine otomatik token ekler)
async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    ...options.headers,
    "Authorization": token ? `Bearer ${token}` : ""
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    // Oturum süresi bittiğinde veya geçersiz olduğunda çıkış yaptır
    oturumKapat();
    throw new Error("Oturum süresi doldu.");
  }

  return response;
}

// Auth DOM Elemanları
const authForm = document.getElementById("authForm");
const authUsernameInput = document.getElementById("authUsername");
const authPasswordInput = document.getElementById("authPassword");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authErrorMsg = document.getElementById("authErrorMsg");
const authTabLogin = document.getElementById("authTabLogin");
const authTabRegister = document.getElementById("authTabRegister");
const authTitleText = document.getElementById("authTitleText");
const authSubtitleText = document.getElementById("authSubtitleText");
const logoutBtn = document.getElementById("logoutBtn");
const userDisplayName = document.getElementById("userDisplayName");
const userAvatarText = document.getElementById("userAvatarText");

let authMode = "login"; // 'login' veya 'register'

function authModunuAyarla(mod) {
  authMode = mod;
  if (authErrorMsg) authErrorMsg.textContent = "";

  if (mod === "login") {
    authTabLogin.classList.add("active");
    authTabRegister.classList.remove("active");
    authTitleText.textContent = "Hesabınıza Giriş Yapın";
    authSubtitleText.textContent = "Kişisel finansınızı güvenle yönetmeye devam edin";
    authSubmitBtn.textContent = "Giriş Yap";
  } else {
    authTabRegister.classList.add("active");
    authTabLogin.classList.remove("active");
    authTitleText.textContent = "Yeni Hesap Oluşturun";
    authSubtitleText.textContent = "Hemen başlayın, gelir ve giderlerinizi kontrol altına alın";
    authSubmitBtn.textContent = "Hesap Oluştur";
  }
}

if (authTabLogin) authTabLogin.addEventListener("click", () => authModunuAyarla("login"));
if (authTabRegister) authTabRegister.addEventListener("click", () => authModunuAyarla("register"));

function kullaniciArayuzunuGuncelle(username) {
  if (userDisplayName) userDisplayName.textContent = username;
  if (userAvatarText) userAvatarText.textContent = username.charAt(0).toUpperCase();
}

function oturumuAc(username, token) {
  setToken(token);
  localStorage.setItem("currentUser", username);
  document.body.classList.remove("auth-locked");
  kullaniciArayuzunuGuncelle(username);
  baslat();
}

function oturumKapat() {
  removeToken();
  document.body.classList.add("auth-locked");
  if (authUsernameInput) authUsernameInput.value = "";
  if (authPasswordInput) authPasswordInput.value = "";
  if (authErrorMsg) authErrorMsg.textContent = "";
}

if (logoutBtn) logoutBtn.addEventListener("click", oturumKapat);

if (authForm) {
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value.trim();

    if (!username || !password) {
      authErrorMsg.textContent = "Lütfen kullanıcı adı ve şifre girin.";
      return;
    }

    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      authSubmitBtn.disabled = true;
      authSubmitBtn.textContent = "Lütfen bekleyin...";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "İşlem başarısız.");
      }

      oturumuAc(data.user.username, data.token);
    } catch (err) {
      authErrorMsg.textContent = err.message;
    } finally {
      authSubmitBtn.disabled = false;
      authSubmitBtn.textContent = authMode === "login" ? "Giriş Yap" : "Hesap Oluştur";
    }
  });
}

// ==========================================
// DÖVİZ VE PARA BİRİMİ YÖNETİMİ
// ==========================================
let seciliParaBirimi = localStorage.getItem("selectedCurrency") || "TRY";

let DOVIZ_KURLARI = {
  TRY: 1.0,
  USD: 0.029,
  EUR: 0.027,
  GBP: 0.023
};

const DOVIZ_SEMBOL = {
  TRY: "₺",
  USD: "$",
  EUR: "€",
  GBP: "£"
};

async function canliKurlariGuncelle() {
  const sonCekilmeTarihi = localStorage.getItem("lastRatesFetchDate");
  const bugunStr = bugununTarihiniAl();
  const kayitliKurlar = localStorage.getItem("cachedExchangeRates");

  if (kayitliKurlar && sonCekilmeTarihi === bugunStr) {
    try {
      DOVIZ_KURLARI = JSON.parse(kayitliKurlar);
      return;
    } catch (e) {
      console.warn("Önbellek okunamadı.");
    }
  }

  try {
    const cevap = await fetch("https://open.er-api.com/v6/latest/TRY");
    if (!cevap.ok) throw new Error("Kur API yanıt vermedi.");
    const data = await cevap.json();
    if (data && data.rates) {
      DOVIZ_KURLARI = {
        TRY: 1.0,
        USD: Number(data.rates.USD) || 0.029,
        EUR: Number(data.rates.EUR) || 0.027,
        GBP: Number(data.rates.GBP) || 0.023
      };
      localStorage.setItem("cachedExchangeRates", JSON.stringify(DOVIZ_KURLARI));
      localStorage.setItem("lastRatesFetchDate", bugunStr);
    }
  } catch (hata) {
    console.warn("Canlı kurlar çekilemedi, varsayılan kurlar devrede.");
  }
}

// DOM Elemanları
const currencySelector = document.getElementById("currencySelector");
const modalCurrencySelector = document.getElementById("modalCurrencySelector");
const balanceSymbol = document.getElementById("balanceSymbol");
const modalCurrencySymbol = document.getElementById("modalCurrencySymbol");

const bakiyeElement = document.getElementById("bakiye");
const toplamGelirElement = document.getElementById("toplamGelir");
const toplamGiderElement = document.getElementById("toplamGider");
const islemSayisiElement = document.getElementById("islemSayisi");
const islemTablosu = document.getElementById("islemTablosu");

const aiInsightsList = document.getElementById("aiInsightsList");

const setBudgetBtn = document.getElementById("setBudgetBtn");
const clearBudgetBtn = document.getElementById("clearBudgetBtn");
const budgetActiveArea = document.getElementById("budgetActiveArea");
const budgetInactiveArea = document.getElementById("budgetInactiveArea");
const budgetProgressBar = document.getElementById("budgetProgressBar");
const budgetSpentText = document.getElementById("budgetSpentText");
const budgetRemainingText = document.getElementById("budgetRemainingText");
const budgetStatusTitle = document.getElementById("budgetStatusTitle");

const miniIslemListesi = document.getElementById("miniIslemListesi");
const enCokHarcananKategoriElement = document.getElementById("enCokHarcananKategori");
const enCokHarcananTutarElement = document.getElementById("enCokHarcananTutar");
const ortalamaGiderElement = document.getElementById("ortalamaGider");
const butceDurumuElement = document.getElementById("butceDurumu");
const butceDurumuAciklamaElement = document.getElementById("butceDurumuAciklama");
const tumunuGorBtn = document.getElementById("tumunuGorBtn");

const aramaInput = document.getElementById("aramaInput");
const filtreSelect = document.getElementById("filtreSelect");
const kategoriFiltreSelect = document.getElementById("kategoriFiltreSelect");
const siralaSelect = document.getElementById("siralaSelect");
const baslangicTarihiInput = document.getElementById("baslangicTarihi");
const bitisTarihiInput = document.getElementById("bitisTarihi");
const filtrelenenAdet = document.getElementById("filtrelenenAdet");
const filtrelenenTutar = document.getElementById("filtrelenenTutar");

const aylikOzetMenu = document.getElementById("aylikOzetMenu");
const aylikOzetSection = document.getElementById("aylikOzet");
const aylikOzetTarih = document.getElementById("aylikOzetTarih");
const aylikGelirElement = document.getElementById("aylikGelir");
const aylikGiderElement = document.getElementById("aylikGider");
const aylikNetElement = document.getElementById("aylikNet");
const aylikIslemGrafik = document.getElementById("aylikIslemGrafik");
const aylikGelirGiderGrafik = document.getElementById("aylikGelirGiderGrafik");
const aylikIslemTablosu = document.getElementById("aylikIslemTablosu");
const aylikIslemSayisi = document.getElementById("aylikIslemSayisi");
const aylikKategoriDagitimListesi = document.getElementById("aylikKategoriDagitimListesi");

const borclarMenu = document.getElementById("borclarMenu");
const borclarSayfasi = document.getElementById("borclarSayfasi");
const borclarTablosu = document.getElementById("borclarTablosu");
const toplamAlacakTutar = document.getElementById("toplamAlacakTutar");
const toplamVerecekTutar = document.getElementById("toplamVerecekTutar");
const netBorcDurumu = document.getElementById("netBorcDurumu");
const yeniBorcEkleBtn = document.getElementById("yeniBorcEkleBtn");

const debtModal = document.getElementById("debtModal");
const debtModalKapat = document.getElementById("debtModalKapat");
const debtModalIptal = document.getElementById("debtModalIptal");
const debtForm = document.getElementById("debtForm");
const debtType = document.getElementById("debtType");
const debtAlacakBtn = document.getElementById("debtAlacakBtn");
const debtVerecekBtn = document.getElementById("debtVerecekBtn");
const debtPerson = document.getElementById("debtPerson");
const debtAmount = document.getElementById("debtAmount");
const debtCurrencySelector = document.getElementById("debtCurrencySelector");
const debtModalCurrencySymbol = document.getElementById("debtModalCurrencySymbol");
const debtDueDate = document.getElementById("debtDueDate");
const debtDescription = document.getElementById("debtDescription");

const hedeflerMenu = document.getElementById("hedeflerMenu");
const hedeflerSayfasi = document.getElementById("hedeflerSayfasi");
const hedeflerIzgarasi = document.getElementById("hedeflerIzgarasi");
const toplamHedefSayisi = document.getElementById("toplamHedefSayisi");
const toplamBirikenTutar = document.getElementById("toplamBirikenTutar");
const toplamHedefTutar = document.getElementById("toplamHedefTutar");
const yeniHedefEkleBtn = document.getElementById("yeniHedefEkleBtn");

const goalModal = document.getElementById("goalModal");
const goalModalKapat = document.getElementById("goalModalKapat");
const goalModalIptal = document.getElementById("goalModalIptal");
const goalForm = document.getElementById("goalForm");
const goalTitle = document.getElementById("goalTitle");
const goalIcon = document.getElementById("goalIcon");
const goalTargetAmount = document.getElementById("goalTargetAmount");
const goalCurrentAmount = document.getElementById("goalCurrentAmount");
const goalCurrencySelector = document.getElementById("goalCurrencySelector");
const goalModalCurrencySymbol = document.getElementById("goalModalCurrencySymbol");
const goalTargetDate = document.getElementById("goalTargetDate");

const transactionModal = document.getElementById("transactionModal");
const mobilYeniIslemButonu = document.getElementById("mobilYeniIslemButonu");
const islemlerYeniEkleBtn = document.getElementById("islemlerYeniEkleBtn");
const modalKapat = document.getElementById("modalKapat");
const modalIptal = document.getElementById("modalIptal");
const modalBaslik = document.getElementById("modalBaslik");
const islemForm = document.getElementById("islemForm");
const kaydetButonu = document.getElementById("kaydetButonu");
const turInput = document.getElementById("tur");
const gelirButonu = document.getElementById("gelirButonu");
const giderButonu = document.getElementById("giderButonu");
const miktarInput = document.getElementById("miktar");
const tarihInput = document.getElementById("tarih");
const aciklamaInput = document.getElementById("aciklama");
const kategoriInput = document.getElementById("kategori");

const acikTema = document.getElementById("temaButonu");
const koyuTema = document.getElementById("koyuTemaButonu");
const mobilTema = document.getElementById("mobilTemaButonu");
const islemlerMenuLink = document.getElementById("islemlerMenu");
const genelBakisMenu = document.getElementById("genelBakisMenu");

// Global Durum
let islemler = [];
let borclar = [];
let hedefler = [];
let duzenlenenIslemId = null;

const GIDER_KATEGORILERI = ["Market", "Kira", "Fatura", "Sağlık", "Eğlence", "Eğitim", "Yeme-İçme", "Birikim", "Diğer"];
const GELIR_KATEGORILERI = ["Maaş", "Yatırım", "Hediye / Ek Gelir", "Diğer"];

function kategoriSecenekleriniDoldur(tur, seciliKategori = "") {
  if (!kategoriInput) return;
  kategoriInput.innerHTML = "";
  const liste = tur === "gelir" ? GELIR_KATEGORILERI : GIDER_KATEGORILERI;

  liste.forEach(kat => {
    const opt = document.createElement("option");
    opt.value = kat;
    opt.textContent = kat;
    if (kat === seciliKategori) opt.selected = true;
    kategoriInput.appendChild(opt);
  });
}

function paraFormatla(tutarTRY) {
  const carpan = DOVIZ_KURLARI[seciliParaBirimi] || 1.0;
  const donusturulmus = (Number(tutarTRY) || 0) * carpan;

  let locale = "tr-TR";
  if (seciliParaBirimi === "USD") locale = "en-US";
  if (seciliParaBirimi === "EUR") locale = "de-DE";
  if (seciliParaBirimi === "GBP") locale = "en-GB";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: seciliParaBirimi,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(donusturulmus);
}

function tarihFormatla(tarih) {
  if (!tarih) return "Belirtilmedi";
  const parcalar = String(tarih).split("-");
  if (parcalar.length !== 3) return tarih;
  return `${parcalar[2]}.${parcalar[1]}.${parcalar[0]}`;
}

function bugununTarihiniAl() {
  const bugun = new Date();
  const yil = bugun.getFullYear();
  const ay = String(bugun.getMonth() + 1).padStart(2, "0");
  const gun = String(bugun.getDate()).padStart(2, "0");
  return `${yil}-${ay}-${gun}`;
}

function bugununAyiniAl() {
  const bugun = new Date();
  const yil = bugun.getFullYear();
  const ay = String(bugun.getMonth() + 1).padStart(2, "0");
  return `${yil}-${ay}`;
}

function guvenliMetin(metin) {
  const div = document.createElement("div");
  div.textContent = metin || "";
  return div.innerHTML;
}

function paraBiriminiAyarla(yeniBirim) {
  seciliParaBirimi = yeniBirim;
  localStorage.setItem("selectedCurrency", yeniBirim);

  const sembol = DOVIZ_SEMBOL[yeniBirim] || "₺";
  if (balanceSymbol) balanceSymbol.textContent = sembol;

  ekraniGuncelle();
  borclariEkranaCiz();
  hedefleriEkranaCiz();
  if (aylikOzetSection && aylikOzetSection.style.display !== "none") {
    aylikOzetiGuncelle();
  }
}

if (currencySelector) {
  currencySelector.value = seciliParaBirimi;
  currencySelector.addEventListener("change", (e) => {
    paraBiriminiAyarla(e.target.value);
  });
}

if (modalCurrencySelector) {
  modalCurrencySelector.addEventListener("change", (e) => {
    if (modalCurrencySymbol) {
      modalCurrencySymbol.textContent = DOVIZ_SEMBOL[e.target.value] || "₺";
    }
  });
}

if (debtCurrencySelector) {
  debtCurrencySelector.addEventListener("change", (e) => {
    if (debtModalCurrencySymbol) {
      debtModalCurrencySymbol.textContent = DOVIZ_SEMBOL[e.target.value] || "₺";
    }
  });
}

if (goalCurrencySelector) {
  goalCurrencySelector.addEventListener("change", (e) => {
    if (goalModalCurrencySymbol) {
      goalModalCurrencySymbol.textContent = DOVIZ_SEMBOL[e.target.value] || "₺";
    }
  });
}

// Bütçe Takibi
function butceDurumunuGuncelle() {
  const limitTRY = Number(localStorage.getItem("monthlyBudgetLimit")) || 0;
  if (!limitTRY || limitTRY <= 0) {
    if (budgetActiveArea) budgetActiveArea.style.display = "none";
    if (budgetInactiveArea) budgetInactiveArea.style.display = "block";
    if (clearBudgetBtn) clearBudgetBtn.style.display = "none";
    if (setBudgetBtn) setBudgetBtn.textContent = "+ Limit Belirle";
    if (budgetStatusTitle) budgetStatusTitle.textContent = "Aylık Harcama Limiti (Belirlenmedi)";
    return;
  }

  if (budgetActiveArea) budgetActiveArea.style.display = "block";
  if (budgetInactiveArea) budgetInactiveArea.style.display = "none";
  if (clearBudgetBtn) clearBudgetBtn.style.display = "inline-block";
  if (setBudgetBtn) setBudgetBtn.textContent = "✎ Limiti Güncelle";

  const buAy = bugununAyiniAl();
  let buAyGider = 0;
  islemler.forEach(islem => {
    if (islem.tur === "gider" && islem.tarih && islem.tarih.startsWith(buAy)) {
      buAyGider += islem.miktar;
    }
  });

  const oran = Math.min((buAyGider / limitTRY) * 100, 100);
  const kalanTRY = limitTRY - buAyGider;

  if (budgetProgressBar) {
    budgetProgressBar.style.width = `${oran}%`;
    if (oran >= 100) {
      budgetProgressBar.style.backgroundColor = "var(--expense)";
    } else if (oran >= 80) {
      budgetProgressBar.style.backgroundColor = "#f59e0b";
    } else {
      budgetProgressBar.style.backgroundColor = "var(--income)";
    }
  }

  if (budgetStatusTitle) {
    budgetStatusTitle.textContent = `Aylık Limit: ${paraFormatla(limitTRY)} (%${oran.toFixed(0)} Harcandı)`;
  }
  if (budgetSpentText) {
    budgetSpentText.textContent = `Bu ay harcanan: ${paraFormatla(buAyGider)}`;
  }
  if (budgetRemainingText) {
    if (kalanTRY >= 0) {
      budgetRemainingText.textContent = `Kalan: ${paraFormatla(kalanTRY)}`;
      budgetRemainingText.style.color = "var(--text-soft)";
    } else {
      budgetRemainingText.textContent = `Limit aşıldı! (${paraFormatla(Math.abs(kalanTRY))})`;
      budgetRemainingText.style.color = "var(--expense)";
    }
  }
}

if (setBudgetBtn) {
  setBudgetBtn.addEventListener("click", () => {
    const carpan = DOVIZ_KURLARI[seciliParaBirimi] || 1.0;
    const mevcutTRY = Number(localStorage.getItem("monthlyBudgetLimit")) || 0;
    const mevcutDoviz = mevcutTRY > 0 ? (mevcutTRY * carpan).toFixed(2) : "";
    const sembol = DOVIZ_SEMBOL[seciliParaBirimi];

    const yeni = prompt(`Aylık harcama bütçenizi girin (${sembol}):`, mevcutDoviz);
    if (yeni !== null) {
      const tutarDoviz = Number(yeni.replace(",", "."));
      if (!isNaN(tutarDoviz) && tutarDoviz > 0) {
        const tutarTRY = tutarDoviz / carpan;
        localStorage.setItem("monthlyBudgetLimit", tutarTRY);
        butceDurumunuGuncelle();
        aiDanismaniniGuncelle();
      } else {
        alert("Lütfen geçerli bir bütçe tutarı girin.");
      }
    }
  });
}

if (clearBudgetBtn) {
  clearBudgetBtn.addEventListener("click", () => {
    if (confirm("Bütçe limitini kaldırmak istediğinize emin misiniz?")) {
      localStorage.removeItem("monthlyBudgetLimit");
      butceDurumunuGuncelle();
      aiDanismaniniGuncelle();
    }
  });
}

// Borç / Alacak İşlemleri
async function borclariGetir() {
  try {
    const cevap = await authFetch(DEBTS_API_URL);
    if (!cevap.ok) throw new Error("Borçlar alınamadı.");
    borclar = await cevap.json();
    borclariEkranaCiz();
    aiDanismaniniGuncelle();
  } catch (hata) {
    console.error(hata);
  }
}

function borclariEkranaCiz() {
  if (!borclarTablosu) return;

  let toplamAlacak = 0;
  let toplamVerecek = 0;

  borclar.forEach(b => {
    if (b.status === "pending") {
      if (b.type === "alacak") toplamAlacak += Number(b.amount);
      else toplamVerecek += Number(b.amount);
    }
  });

  const netBorc = toplamAlacak - toplamVerecek;

  if (toplamAlacakTutar) toplamAlacakTutar.textContent = paraFormatla(toplamAlacak);
  if (toplamVerecekTutar) toplamVerecekTutar.textContent = paraFormatla(toplamVerecek);
  if (netBorcDurumu) {
    netBorcDurumu.textContent = (netBorc >= 0 ? "+" : "") + paraFormatla(netBorc);
    netBorcDurumu.style.color = netBorc >= 0 ? "var(--income)" : "var(--expense)";
  }

  if (borclar.length === 0) {
    borclarTablosu.innerHTML = `
      <tr class="empty-row">
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-icon">⇄</div>
            <strong>Kayıt bulunamadı</strong>
            <span>Henüz eklenmiş bir borç veya alacak kaydı yok.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  borclarTablosu.innerHTML = "";
  borclar.forEach(b => {
    const satir = document.createElement("tr");
    if (b.status === "completed") satir.className = "completed-row";

    const isAlacak = b.type === "alacak";
    const typeBadge = isAlacak
      ? '<span class="debt-type-badge debt-alacak">↗ Alacak</span>'
      : '<span class="debt-type-badge debt-verecek">↘ Verecek (Borç)</span>';

    const statusBadge = b.status === "completed"
      ? '<span class="status-badge status-completed">✓ Ödendi / Kapandı</span>'
      : '<span class="status-badge status-pending">⏳ Bekliyor</span>';

    const toggleBtnText = b.status === "completed" ? "Geri Al" : (isAlacak ? "Tahsil Edildi" : "Ödendi");

    satir.innerHTML = `
      <td>
        <div class="transaction-name">${guvenliMetin(b.person)}</div>
        ${b.description ? `<div class="transaction-description">\${guvenliMetin(b.description)}</div>` : ""}
      </td>
      <td>${typeBadge}</td>
      <td>
        <strong style="color: ${isAlacak ? 'var(--income)' : 'var(--expense)'};">
          ${isAlacak ? '+' : '-'}${paraFormatla(Number(b.amount))}
        </strong>
      </td>
      <td><span class="date-text">${tarihFormatla(b.dueDate)}</span></td>
      <td>${statusBadge}</td>
      <td style="text-align: right;">
        <div class="table-actions">
          <button type="button" class="toggle-status-btn" title="Durumu Değiştir">${toggleBtnText}</button>
          <button type="button" class="table-action delete" title="Sil">×</button>
        </div>
      </td>
    `;

    const toggleBtn = satir.querySelector(".toggle-status-btn");
    const silBtn = satir.querySelector(".table-action.delete");

    toggleBtn.addEventListener("click", () => borcDurumunuDegistir(b.id));
    silBtn.addEventListener("click", () => borcSil(b.id));

    borclarTablosu.appendChild(satir);
  });
}

async function borcDurumunuDegistir(id) {
  try {
    const cevap = await authFetch(`${DEBTS_API_URL}/${id}/toggle`, { method: "PATCH" });
    if (!cevap.ok) throw new Error("Durum güncellenemedi.");
    await borclariGetir();
  } catch (hata) {
    console.error(hata);
  }
}

async function borcSil(id) {
  if (!confirm("Bu borç/alacak kaydını silmek istediğinize emin misiniz?")) return;
  try {
    const cevap = await authFetch(`${DEBTS_API_URL}/${id}`, { method: "DELETE" });
    if (!cevap.ok) throw new Error("Silinemedi.");
    await borclariGetir();
  } catch (hata) {
    console.error(hata);
  }
}

function debtAlacakSec() {
  if (debtType) debtType.value = "alacak";
  if (debtAlacakBtn) debtAlacakBtn.classList.add("active");
  if (debtVerecekBtn) debtVerecekBtn.classList.remove("active");
}

function debtVerecekSec() {
  if (debtType) debtType.value = "verecek";
  if (debtVerecekBtn) debtVerecekBtn.classList.add("active");
  if (debtAlacakBtn) debtAlacakBtn.classList.remove("active");
}

function debtModalAc() {
  if (debtForm) debtForm.reset();
  debtAlacakSec();
  if (debtCurrencySelector) debtCurrencySelector.value = seciliParaBirimi;
  if (debtModalCurrencySymbol) debtModalCurrencySymbol.textContent = DOVIZ_SEMBOL[seciliParaBirimi] || "₺";
  if (debtModal) debtModal.classList.add("show");
  if (debtPerson) debtPerson.focus();
}

function debtModalKapatFunc() {
  if (debtModal) debtModal.classList.remove("show");
}

if (yeniBorcEkleBtn) yeniBorcEkleBtn.addEventListener("click", debtModalAc);
if (debtModalKapat) debtModalKapat.addEventListener("click", debtModalKapatFunc);
if (debtModalIptal) debtModalIptal.addEventListener("click", debtModalKapatFunc);
if (debtAlacakBtn) debtAlacakBtn.addEventListener("click", debtAlacakSec);
if (debtVerecekBtn) debtVerecekBtn.addEventListener("click", debtVerecekSec);

if (debtForm) {
  debtForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tur = debtType ? debtType.value : "alacak";
    const kisi = debtPerson ? debtPerson.value.trim() : "";
    const girilenMiktar = debtAmount ? Number(debtAmount.value) : 0;
    const vade = debtDueDate ? debtDueDate.value : "";
    const aciklama = debtDescription ? debtDescription.value.trim() : "";
    const secilenBirim = debtCurrencySelector ? debtCurrencySelector.value : "TRY";

    if (!kisi || girilenMiktar <= 0) {
      alert("Lütfen kişi ve geçerli bir miktar girin.");
      return;
    }

    const carpan = DOVIZ_KURLARI[secilenBirim] || 1.0;
    const gercekMiktarTRY = girilenMiktar / carpan;

    const veri = {
      person: kisi,
      type: tur,
      amount: gercekMiktarTRY,
      dueDate: vade,
      description: aciklama
    };

    try {
      const cevap = await authFetch(DEBTS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(veri)
      });
      if (!cevap.ok) throw new Error("Kaydedilemedi.");
      await borclariGetir();
      debtModalKapatFunc();
    } catch (hata) {
      console.error(hata);
      alert("Borç/Alacak eklenirken bir hata oluştu.");
    }
  });
}

// Birikim & Hedefler
async function hedefleriGetir() {
  try {
    const cevap = await authFetch(GOALS_API_URL);
    if (!cevap.ok) throw new Error("Hedefler alınamadı.");
    hedefler = await cevap.json();
    hedefleriEkranaCiz();
  } catch (hata) {
    console.error(hata);
  }
}

function hedefleriEkranaCiz() {
  if (!hedeflerIzgarasi) return;

  let toplamHedefTRY = 0;
  let toplamBirikenTRY = 0;

  hedefler.forEach(h => {
    toplamHedefTRY += Number(h.targetAmount) || 0;
    toplamBirikenTRY += Number(h.currentAmount) || 0;
  });

  if (toplamHedefSayisi) toplamHedefSayisi.textContent = hedefler.length;
  if (toplamBirikenTutar) toplamBirikenTutar.textContent = paraFormatla(toplamBirikenTRY);
  if (toplamHedefTutar) toplamHedefTutar.textContent = paraFormatla(toplamHedefTRY);

  if (hedefler.length === 0) {
    hedeflerIzgarasi.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 40px 20px;">
        <div class="empty-icon" style="font-size: 28px; width: 50px; height: 50px;">◎</div>
        <strong>Henüz bir hedefiniz yok</strong>
        <span>Yeni bir hedef veya kumbara oluşturarak birikim yapmaya başlayın!</span>
      </div>
    `;
    return;
  }

  hedeflerIzgarasi.innerHTML = "";
  hedefler.forEach(h => {
    const current = Number(h.currentAmount) || 0;
    const target = Number(h.targetAmount) || 1;
    const hesaplananYuzde = Math.min(Math.round((current / target) * 100), 100);
    const tamamlandi = current >= target;

    const yuzdeMetni = tamamlandi ? "🏆 Hedefe Ulaşıldı!" : ("%" + hesaplananYuzde + " Tamamlandı");

    const kart = document.createElement("div");
    kart.className = "goal-card";

    kart.innerHTML = `
      <div>
        <div class="goal-card-top">
          <div style="display: flex; align-items: center;">
            <div class="goal-icon-badge">${h.icon || '🎯'}</div>
            <div class="goal-info">
              <div class="goal-title">${guvenliMetin(h.title)}</div>
              <div class="goal-date">${h.targetDate ? ('Hedef: ' + tarihFormatla(h.targetDate)) : 'Süre sınırı yok'}</div>
            </div>
          </div>
          <button type="button" class="goal-delete-btn" title="Hedefi Sil">×</button>
        </div>

        <div class="goal-amounts">
          <div>
            <div class="goal-current">${paraFormatla(current)}</div>
            <div style="font-size: 11px; color: var(--text-soft); font-weight: 600;">BİRİKEN</div>
          </div>
          <div style="text-align: right;">
            <div class="goal-target">${paraFormatla(target)}</div>
            <div style="font-size: 11px; color: var(--text-soft); font-weight: 600;">HEDEF</div>
          </div>
        </div>

        <div class="goal-progress-track">
          <div class="goal-progress-fill ${tamamlandi ? 'completed' : ''}" style="width: ${hesaplananYuzde}%;"></div>
        </div>
      </div>

      <div class="goal-card-bottom">
        <span class="goal-percentage-text"></span>
        <button type="button" class="goal-add-fund-btn">+ Kumbaraya At</button>
      </div>
    `;

    kart.querySelector(".goal-percentage-text").textContent = yuzdeMetni;

    const silBtn = kart.querySelector(".goal-delete-btn");
    const paraEkleBtn = kart.querySelector(".goal-add-fund-btn");

    silBtn.addEventListener("click", () => hedefSil(h.id));
    paraEkleBtn.addEventListener("click", () => kumbarayaParaEkle(h));

    hedeflerIzgarasi.appendChild(kart);
  });
}

async function kumbarayaParaEkle(hedef) {
  const sembol = DOVIZ_SEMBOL[seciliParaBirimi];
  const girdi = prompt(`"${hedef.title}" hedefine ne kadar para aktaracaksınız? (${sembol}):`);
  if (girdi === null) return;

  const tutarDoviz = Number(girdi.replace(",", "."));
  if (isNaN(tutarDoviz) || tutarDoviz <= 0) {
    alert("Lütfen geçerli bir tutar girin.");
    return;
  }

  const carpan = DOVIZ_KURLARI[seciliParaBirimi] || 1.0;
  const tutarTRY = tutarDoviz / carpan;

  try {
    const cevapHedef = await authFetch(`${GOALS_API_URL}/${hedef.id}/add-funds`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountToAdd: tutarTRY })
    });
    if (!cevapHedef.ok) throw new Error("Kumbaraya eklenemedi.");

    await authFetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "gider",
        amount: tutarTRY,
        date: bugununTarihiniAl(),
        category: "Birikim",
        description: `Birikim: ${hedef.title}`
      })
    });

    await islemleriGetir();
    await hedefleriGetir();
  } catch (hata) {
    console.error(hata);
    alert("Para aktarılırken bir hata oluştu.");
  }
}

async function hedefSil(id) {
  if (!confirm("Bu birikim hedefini silmek istediğinize emin misiniz?")) return;
  try {
    const cevap = await authFetch(`${GOALS_API_URL}/${id}`, { method: "DELETE" });
    if (!cevap.ok) throw new Error("Silinemedi.");
    await hedefleriGetir();
  } catch (hata) {
    console.error(hata);
  }
}

function goalModalAc() {
  if (goalForm) goalForm.reset();
  if (goalCurrencySelector) goalCurrencySelector.value = seciliParaBirimi;
  if (goalModalCurrencySymbol) goalModalCurrencySymbol.textContent = DOVIZ_SEMBOL[seciliParaBirimi] || "₺";
  if (goalModal) goalModal.classList.add("show");
  if (goalTitle) goalTitle.focus();
}

function goalModalKapatFunc() {
  if (goalModal) goalModal.classList.remove("show");
}

if (yeniHedefEkleBtn) yeniHedefEkleBtn.addEventListener("click", goalModalAc);
if (goalModalKapat) goalModalKapat.addEventListener("click", goalModalKapatFunc);
if (goalModalIptal) goalModalIptal.addEventListener("click", goalModalKapatFunc);

if (goalForm) {
  goalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const baslik = goalTitle ? goalTitle.value.trim() : "";
    const ikon = goalIcon ? goalIcon.value : "🎯";
    const girilenHedef = goalTargetAmount ? Number(goalTargetAmount.value) : 0;
    const girilenBaslangic = goalCurrentAmount ? Number(goalCurrentAmount.value) : 0;
    const tarih = goalTargetDate ? goalTargetDate.value : "";
    const secilenBirim = goalCurrencySelector ? goalCurrencySelector.value : "TRY";

    if (!baslik || girilenHedef <= 0) {
      alert("Lütfen geçerli bir hedef tutarı girin.");
      return;
    }

    const carpan = DOVIZ_KURLARI[secilenBirim] || 1.0;
    const hedefTRY = girilenHedef / carpan;
    const baslangicTRY = girilenBaslangic > 0 ? (girilenBaslangic / carpan) : 0;

    const veri = {
      title: baslik,
      targetAmount: hedefTRY,
      currentAmount: baslangicTRY,
      targetDate: tarih,
      icon: ikon
    };

    try {
      const cevap = await authFetch(GOALS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(veri)
      });
      if (!cevap.ok) throw new Error("Hedef kaydedilemedi.");

      if (baslangicTRY > 0) {
        await authFetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "gider",
            amount: baslangicTRY,
            date: bugununTarihiniAl(),
            category: "Birikim",
            description: `Birikim Başlangıcı: ${baslik}`
          })
        });
        await islemleriGetir();
      }

      await hedefleriGetir();
      goalModalKapatFunc();
    } catch (hata) {
      console.error(hata);
      alert("Hedef eklenirken bir hata oluştu.");
    }
  });
}

// AI Danışmanı
function aiDanismaniniGuncelle() {
  if (!aiInsightsList) return;

  const buAy = bugununAyiniAl();
  let buAyGelir = 0;
  let buAyGider = 0;
  const kategoriHarcamalari = {};

  islemler.forEach(islem => {
    if (islem.tarih && islem.tarih.startsWith(buAy)) {
      if (islem.tur === "gelir") {
        buAyGelir += islem.miktar;
      } else {
        buAyGider += islem.miktar;
        const kat = islem.kategori || "Diğer";
        kategoriHarcamalari[kat] = (kategoriHarcamalari[kat] || 0) + islem.miktar;
      }
    }
  });

  const ipuclari = [];

  if (buAyGelir > 0) {
    const net = buAyGelir - buAyGider;
    const tasarrufOrani = ((net / buAyGelir) * 100).toFixed(0);
    if (net > 0) {
      ipuclari.push({
        icon: "💡",
        text: `Bu ay gelirinizin <strong>%${tasarrufOrani}</strong> kadarı birikime kaldı. Net durum pozitif.`
      });
    } else {
      ipuclari.push({
        icon: "⚠️",
        text: `Bu ay harcamalar geliri <strong>${paraFormatla(Math.abs(net))}</strong> aştı.`
      });
    }
  }

  if (buAyGider > 0) {
    let enCokKat = "";
    let enCokTutar = 0;
    for (const k in kategoriHarcamalari) {
      if (kategoriHarcamalari[k] > enCokTutar) {
        enCokTutar = kategoriHarcamalari[k];
        enCokKat = k;
      }
    }
    const pay = ((enCokTutar / buAyGider) * 100).toFixed(0);
    if (pay >= 40) {
      ipuclari.push({
        icon: "🔍",
        text: `Aylık harcamaların <strong>%${pay}</strong> kadarı <strong>${enCokKat}</strong> kategorisinde yoğunlaşıyor.`
      });
    }
  }

  const limitTRY = Number(localStorage.getItem("monthlyBudgetLimit")) || 0;
  if (limitTRY > 0) {
    const kalan = limitTRY - buAyGider;
    if (kalan < 0) {
      ipuclari.push({
        icon: "🚨",
        text: `Aylık bütçe limiti <strong>${paraFormatla(Math.abs(kalan))}</strong> aşıldı.`
      });
    } else if ((buAyGider / limitTRY) >= 0.8) {
      ipuclari.push({
        icon: "⚡",
        text: `Bütçenizin %80'ine ulaştınız. Kalan limitiniz: <strong>${paraFormatla(kalan)}</strong>.`
      });
    } else {
      ipuclari.push({
        icon: "🎯",
        text: `Bütçe kontrolünüz iyi gidiyor. Kalan limit: <strong>${paraFormatla(kalan)}</strong>.`
      });
    }
  }

  let bekleyenAlacak = 0;
  let bekleyenBorc = 0;
  borclar.forEach(b => {
    if (b.status === "pending") {
      if (b.type === "alacak") bekleyenAlacak += Number(b.amount);
      else bekleyenBorc += Number(b.amount);
    }
  });

  if (bekleyenAlacak > 0 && bekleyenAlacak > bekleyenBorc) {
    ipuclari.push({
      icon: "🤝",
      text: `Tahsil edilmeyi bekleyen toplam <strong>${paraFormatla(bekleyenAlacak)}</strong> alacağınız var.`
    });
  } else if (bekleyenBorc > 0) {
    ipuclari.push({
      icon: "📅",
      text: `Ödenmesi gereken toplam <strong>${paraFormatla(bekleyenBorc)}</strong> borç kaydınız var.`
    });
  }

  if (ipuclari.length === 0) {
    ipuclari.push({
      icon: "✨",
      text: "Henüz analiz için yeterli hareket yok. İşlem ve borç girdikçe içgörüler otomatik güncellenecek."
    });
  }

  aiInsightsList.innerHTML = "";
  ipuclari.forEach(i => {
    const div = document.createElement("div");
    div.className = "ai-insight-item";
    div.innerHTML = `
      <span class="ai-insight-icon">${i.icon}</span>
      <div>${i.text}</div>
    `;
    aiInsightsList.appendChild(div);
  });
}

// Standart İşlem Modalı
function modalAc() {
  duzenlenenIslemId = null;
  if (modalBaslik) modalBaslik.textContent = "Yeni İşlem Ekle";
  if (kaydetButonu) kaydetButonu.textContent = "İşlemi Kaydet";
  if (islemForm) islemForm.reset();
  if (turInput) turInput.value = "gider";
  giderButonunuAktifEt();

  if (modalCurrencySelector) modalCurrencySelector.value = "TRY";
  if (modalCurrencySymbol) modalCurrencySymbol.textContent = "₺";

  if (tarihInput) tarihInput.value = bugununTarihiniAl();
  if (transactionModal) transactionModal.classList.add("show");
  if (miktarInput) miktarInput.focus();
}

function modalKapatFunc() {
  if (transactionModal) transactionModal.classList.remove("show");
  duzenlenenIslemId = null;
}

function gelirButonunuAktifEt() {
  if (turInput) turInput.value = "gelir";
  if (gelirButonu) gelirButonu.classList.add("active");
  if (giderButonu) giderButonu.classList.remove("active");
  kategoriSecenekleriniDoldur("gelir");
}

function giderButonunuAktifEt() {
  if (turInput) turInput.value = "gider";
  if (giderButonu) giderButonu.classList.add("active");
  if (gelirButonu) gelirButonu.classList.remove("active");
  kategoriSecenekleriniDoldur("gider");
}

function islemDuzenle(islem) {
  duzenlenenIslemId = islem.id;
  if (modalBaslik) modalBaslik.textContent = "İşlemi Düzenle";
  if (kaydetButonu) kaydetButonu.textContent = "Değişiklikleri Kaydet";
  if (turInput) turInput.value = islem.tur;

  if (modalCurrencySelector) modalCurrencySelector.value = "TRY";
  if (modalCurrencySymbol) modalCurrencySymbol.textContent = "₺";
  if (miktarInput) miktarInput.value = Number(islem.miktar).toFixed(2);

  if (tarihInput) tarihInput.value = islem.tarih || "";
  if (aciklamaInput) aciklamaInput.value = islem.aciklama;

  if (islem.tur === "gelir") {
    if (gelirButonu) gelirButonu.classList.add("active");
    if (giderButonu) giderButonu.classList.remove("active");
    kategoriSecenekleriniDoldur("gelir", islem.kategori);
  } else {
    if (giderButonu) giderButonu.classList.add("active");
    if (gelirButonu) gelirButonu.classList.remove("active");
    kategoriSecenekleriniDoldur("gider", islem.kategori);
  }

  if (transactionModal) transactionModal.classList.add("show");
}

function siralanmisIslemleriAl(islemListesi) {
  const secim = siralaSelect ? siralaSelect.value : "tarihYeni";
  return [...islemListesi].sort((a, b) => {
    switch (secim) {
      case "tarihYeni":
        return (b.tarih || "").localeCompare(a.tarih || "");
      case "tarihEski":
        return (a.tarih || "").localeCompare(b.tarih || "");
      case "tutarAz":
        return a.miktar - b.miktar;
      case "tutarCok":
        return b.miktar - a.miktar;
      default:
        return 0;
    }
  });
}

function filtrelenmisIslemleriAl() {
  const arama = aramaInput ? aramaInput.value.trim().toLowerCase() : "";
  const turFiltre = filtreSelect ? filtreSelect.value : "tumu";
  const katFiltre = kategoriFiltreSelect ? kategoriFiltreSelect.value : "tumu";
  const baslangic = baslangicTarihiInput ? baslangicTarihiInput.value : "";
  const bitis = bitisTarihiInput ? bitisTarihiInput.value : "";

  return islemler.filter(islem => {
    const aramaUygun = (islem.aciklama || "").toLowerCase().includes(arama);
    const turUygun = turFiltre === "tumu" || islem.tur === turFiltre;
    const katUygun = katFiltre === "tumu" || islem.kategori === katFiltre;
    const baslangicUygun = !baslangic || (islem.tarih && islem.tarih >= baslangic);
    const bitisUygun = !bitis || (islem.tarih && islem.tarih <= bitis);
    return aramaUygun && turUygun && katUygun && baslangicUygun && bitisUygun;
  });
}

function genelBakisWidgetlariniGuncelle() {
  if (!miniIslemListesi) return;

  const sonBes = [...islemler]
    .sort((a, b) => (b.tarih || "").localeCompare(a.tarih || ""))
    .slice(0, 5);

  if (sonBes.length === 0) {
    miniIslemListesi.innerHTML = `
      <div class="empty-state" style="padding: 24px 0;">
        <div class="empty-icon" style="width:36px;height:36px;font-size:16px;">${DOVIZ_SEMBOL[seciliParaBirimi]}</div>
        <strong>Henüz hareket yok</strong>
        <span style="font-size:12px;">Yeni bir işlem ekleyerek başlayın.</span>
      </div>
    `;
  } else {
    miniIslemListesi.innerHTML = "";
    sonBes.forEach(islem => {
      const item = document.createElement("div");
      item.className = "mini-transaction-item";

      const sembol = islem.tur === "gelir" ? "↗" : "↘";
      const sembolSinif = islem.tur === "gelir" ? "income" : "expense";
      const tutarMetin = islem.tur === "gelir" ? `+${paraFormatla(islem.miktar)}` : `-${paraFormatla(islem.miktar)}`;
      const tutarStil = islem.tur === "gelir" ? "color: var(--income);" : "color: var(--expense);";

      item.innerHTML = `
        <div class="mini-item-left">
          <div class="mini-badge ${sembolSinif}">${sembol}</div>
          <div>
            <div class="mini-title">${guvenliMetin(islem.aciklama)}</div>
            <div class="mini-subtitle">${islem.kategori || "Genel"} • ${tarihFormatla(islem.tarih)}</div>
          </div>
        </div>
        <div class="mini-amount" style="${tutarStil}">
          ${tutarMetin}
        </div>
      `;
      miniIslemListesi.appendChild(item);
    });
  }

  const giderIslemleri = islemler.filter(i => i.tur === "gider");
  const kategoriHarcamalari = {};
  let toplamGiderTutar = 0;

  giderIslemleri.forEach(i => {
    toplamGiderTutar += i.miktar;
    const kat = i.kategori || "Diğer";
    kategoriHarcamalari[kat] = (kategoriHarcamalari[kat] || 0) + i.miktar;
  });

  let enCokKat = "-";
  let enCokTutar = 0;
  for (const kat in kategoriHarcamalari) {
    if (kategoriHarcamalari[kat] > enCokTutar) {
      enCokTutar = kategoriHarcamalari[kat];
      enCokKat = kat;
    }
  }

  if (enCokHarcananKategoriElement) {
    enCokHarcananKategoriElement.textContent = enCokKat !== "-" ? enCokKat : "Harcama yok";
  }
  if (enCokHarcananTutarElement) {
    enCokHarcananTutarElement.textContent = enCokTutar > 0 ? `Toplam ${paraFormatla(enCokTutar)} harcandı` : "Henüz gider kaydı yok";
  }

  if (ortalamaGiderElement) {
    const ortalama = giderIslemleri.length > 0 ? toplamGiderTutar / giderIslemleri.length : 0;
    ortalamaGiderElement.textContent = paraFormatla(ortalama);
  }

  let toplamGelir = 0;
  islemler.forEach(i => {
    if (i.tur === "gelir") toplamGelir += i.miktar;
  });
  const net = toplamGelir - toplamGiderTutar;

  if (butceDurumuElement && butceDurumuAciklamaElement) {
    if (net > 0) {
      butceDurumuElement.textContent = "Pozitif (Artıda)";
      butceDurumuElement.style.color = "var(--income)";
      butceDurumuAciklamaElement.textContent = "Gelirleriniz giderleri karşılıyor.";
    } else if (net < 0) {
      butceDurumuElement.textContent = "Dikkat (Ekside)";
      butceDurumuElement.style.color = "var(--expense)";
      butceDurumuAciklamaElement.textContent = "Harcamalarınız gelirlerinizi aştı.";
    } else {
      butceDurumuElement.textContent = "Dengede";
      butceDurumuElement.style.color = "var(--text)";
      butceDurumuAciklamaElement.textContent = "Gelir ve giderleriniz eşit durumda.";
    }
  }

  butceDurumunuGuncelle();
  aiDanismaniniGuncelle();
}

function ekraniGuncelle() {
  let toplamGelir = 0;
  let toplamGider = 0;

  islemler.forEach(islem => {
    if (islem.tur === "gelir") toplamGelir += islem.miktar;
    else toplamGider += islem.miktar;
  });

  const bakiye = toplamGelir - toplamGider;
  if (bakiyeElement) bakiyeElement.textContent = paraFormatla(bakiye);
  if (toplamGelirElement) toplamGelirElement.textContent = paraFormatla(toplamGelir);
  if (toplamGiderElement) toplamGiderElement.textContent = paraFormatla(toplamGider);
  if (islemSayisiElement) islemSayisiElement.textContent = islemler.length;

  genelBakisWidgetlariniGuncelle();

  if (!islemTablosu) return;

  const filtrelenenler = filtrelenmisIslemleriAl();
  const gorunenIslemler = siralanmisIslemleriAl(filtrelenenler);

  if (filtrelenenAdet) filtrelenenAdet.textContent = gorunenIslemler.length;
  if (filtrelenenTutar) {
    let filtreToplamTutar = 0;
    gorunenIslemler.forEach(islem => {
      filtreToplamTutar += islem.miktar;
    });
    filtrelenenTutar.textContent = paraFormatla(filtreToplamTutar);
  }

  if (gorunenIslemler.length === 0) {
    islemTablosu.innerHTML = `
      <tr class="empty-row">
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-icon">${DOVIZ_SEMBOL[seciliParaBirimi]}</div>
            <strong>Kayıt bulunamadı</strong>
            <span>Filtreleme kriterlerinizi değiştirerek tekrar deneyin.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  islemTablosu.innerHTML = "";
  gorunenIslemler.forEach(islem => {
    const satir = document.createElement("tr");

    const formatliMiktar = islem.tur === "gelir"
      ? `<span class="amount-income">+${paraFormatla(islem.miktar)}</span>`
      : `<span class="amount-expense">-${paraFormatla(islem.miktar)}</span>`;

    satir.innerHTML = `
      <td>
        <div class="transaction-name">${guvenliMetin(islem.aciklama)}</div>
      </td>
      <td>
        <span class="category-badge">${islem.kategori || "Diğer"}</span>
      </td>
      <td>
        ${islem.tur === "gelir" 
          ? '<span class="type-badge type-income">↗ Gelir</span>' 
          : '<span class="type-badge type-expense">↘ Gider</span>'}
      </td>
      <td>
        <span class="date-text">${tarihFormatla(islem.tarih)}</span>
      </td>
      <td>
        ${formatliMiktar}
      </td>
      <td style="text-align: right;">
        <div class="table-actions">
          <button type="button" class="table-action" title="Düzenle">✎</button>
          <button type="button" class="table-action delete" title="Sil">×</button>
        </div>
      </td>
    `;

    const duzenleBtn = satir.querySelector(".table-action:not(.delete)");
    const silBtn = satir.querySelector(".table-action.delete");

    duzenleBtn.addEventListener("click", () => islemDuzenle(islem));
    silBtn.addEventListener("click", () => islemSil(islem.id));

    islemTablosu.appendChild(satir);
  });
}

// API İşlemleri (Yetkilendirilmiş)
async function islemleriGetir() {
  try {
    const cevap = await authFetch(API_URL);
    if (!cevap.ok) throw new Error("İşlemler alınamadı.");
    const veriler = await cevap.json();
    islemler = veriler.map(islem => ({
      id: islem.id,
      tur: islem.type,
      miktar: Number(islem.amount),
      tarih: islem.date,
      kategori: islem.category || "Diğer",
      aciklama: islem.description
    }));
    ekraniGuncelle();
    if (aylikOzetSection && aylikOzetSection.style.display !== "none") {
      aylikOzetiGuncelle();
    }
  } catch (hata) {
    console.error(hata);
  }
}

async function islemSil(id) {
  if (!confirm("Bu işlemi silmek istediğinize emin misiniz?")) return;
  try {
    const cevap = await authFetch(`${API_URL}/${id}`, { method: "DELETE" });
    if (!cevap.ok) throw new Error("İşlem silinemedi.");
    await islemleriGetir();
  } catch (hata) {
    console.error(hata);
    alert("İşlem silinirken bir hata oluştu.");
  }
}

// Navigasyon
function tumSayfalariGizle() {
  const genel = document.getElementById("genelBakisSayfasi");
  const isl = document.getElementById("islemlerSayfasi");
  const aylik = document.getElementById("aylikOzet");
  const borc = document.getElementById("borclarSayfasi");
  const hedef = document.getElementById("hedeflerSayfasi");

  if (genel) genel.style.display = "none";
  if (isl) isl.style.display = "none";
  if (aylik) aylik.style.display = "none";
  if (borc) borc.style.display = "none";
  if (hedef) hedef.style.display = "none";
}

function genelBakisiGoster() {
  tumSayfalariGizle();
  const genel = document.getElementById("genelBakisSayfasi");
  if (genel) genel.style.display = "block";
  menuAktifliginiGuncelle("genel");
  butceDurumunuGuncelle();
  aiDanismaniniGuncelle();
}

function islemleriGoster() {
  tumSayfalariGizle();
  const isl = document.getElementById("islemlerSayfasi");
  if (isl) isl.style.display = "block";
  menuAktifliginiGuncelle("islemler");
}

function aylikOzetiGoster() {
  tumSayfalariGizle();
  const aylik = document.getElementById("aylikOzet");
  if (aylik) aylik.style.display = "block";
  menuAktifliginiGuncelle("aylik");
  aylikOzetiGuncelle();
}

function borclariGoster() {
  tumSayfalariGizle();
  const borc = document.getElementById("borclarSayfasi");
  if (borc) borc.style.display = "block";
  menuAktifliginiGuncelle("borclar");
  borclariEkranaCiz();
}

function hedefleriGoster() {
  tumSayfalariGizle();
  const hedef = document.getElementById("hedeflerSayfasi");
  if (hedef) hedef.style.display = "block";
  menuAktifliginiGuncelle("hedefler");
  hedefleriEkranaCiz();
}

function menuAktifliginiGuncelle(aktifMenu) {
  document.querySelectorAll(".menu-item").forEach(m => m.classList.remove("active"));
  if (aktifMenu === "aylik" && aylikOzetMenu) aylikOzetMenu.classList.add("active");
  else if (aktifMenu === "islemler" && islemlerMenuLink) islemlerMenuLink.classList.add("active");
  else if (aktifMenu === "borclar" && borclarMenu) borclarMenu.classList.add("active");
  else if (aktifMenu === "hedefler" && hedeflerMenu) hedeflerMenu.classList.add("active");
  else if (genelBakisMenu) genelBakisMenu.classList.add("active");
}

function hashIleSayfayiAc() {
  if (window.location.hash === "#aylikOzet") aylikOzetiGoster();
  else if (window.location.hash === "#islemler") islemleriGoster();
  else if (window.location.hash === "#borclar") borclariGoster();
  else if (window.location.hash === "#hedefler") hedefleriGoster();
  else genelBakisiGoster();
}

function aylikIslemleriAl() {
  if (!aylikOzetTarih || !aylikOzetTarih.value) return [];
  const secilenAy = aylikOzetTarih.value;
  return islemler.filter(islem => islem.tarih && islem.tarih.startsWith(secilenAy));
}

function aylikKategoriDagitiminiOlustur(aylikIslemler) {
  if (!aylikKategoriDagitimListesi) return;

  const giderler = aylikIslemler.filter(i => i.tur === "gider");
  let toplamGider = 0;
  const harcamalar = {};

  giderler.forEach(i => {
    toplamGider += i.miktar;
    const kat = i.kategori || "Diğer";
    harcamalar[kat] = (harcamalar[kat] || 0) + i.miktar;
  });

  if (giderler.length === 0 || toplamGider === 0) {
    aylikKategoriDagitimListesi.innerHTML = `
      <div class="empty-state" style="padding: 20px 0;">
        <span style="color: var(--text-soft); font-size: 13px;">Seçilen ayda kayıtlı gider bulunmuyor.</span>
      </div>
    `;
    return;
  }

  const siraliKategoriler = Object.entries(harcamalar).sort((a, b) => b[1] - a[1]);

  aylikKategoriDagitimListesi.innerHTML = "";
  siraliKategoriler.forEach(([kat, tutar]) => {
    const yuzde = ((tutar / toplamGider) * 100).toFixed(1);

    const item = document.createElement("div");
    item.className = "cat-bar-item";
    item.innerHTML = `
      <div class="cat-bar-top">
        <span>${kat} <small style="color: var(--text-soft); font-weight: normal;">(%${yuzde})</small></span>
        <span style="color: var(--expense);">${paraFormatla(tutar)}</span>
      </div>
      <div class="cat-bar-track">
        <div class="cat-bar-fill" style="width: ${yuzde}%;"></div>
      </div>
    `;
    aylikKategoriDagitimListesi.appendChild(item);
  });
}

function aylikOzetiGuncelle() {
  if (!aylikOzetSection) return;
  const aylikIslemler = aylikIslemleriAl();
  let gelir = 0;
  let gider = 0;

  aylikIslemler.forEach(islem => {
    if (islem.tur === "gelir") gelir += islem.miktar;
    else gider += islem.miktar;
  });

  const net = gelir - gider;
  if (aylikGelirElement) aylikGelirElement.textContent = paraFormatla(gelir);
  if (aylikGiderElement) aylikGiderElement.textContent = paraFormatla(gider);
  if (aylikNetElement) aylikNetElement.textContent = paraFormatla(net);

  aylikGelirGiderGrafiginiOlustur(gelir, gider);
  aylikIslemGrafiginiOlustur(aylikIslemler);
  aylikKategoriDagitiminiOlustur(aylikIslemler);
  aylikTabloyuOlustur(aylikIslemler);
}

function netRengi(net) {
  if (net > 0) return "var(--income)";
  if (net < 0) return "var(--expense)";
  return "var(--text-soft)";
}

function aylikGelirGiderGrafiginiOlustur(gelir, gider) {
  if (!aylikGelirGiderGrafik) return;
  const maksimum = Math.max(gelir, gider, 1);
  const gelirYuzde = (gelir / maksimum) * 100;
  const giderYuzde = (gider / maksimum) * 100;
  const net = gelir - gider;

  aylikGelirGiderGrafik.innerHTML = `
    <div style="width:100%;min-height:250px;display:flex;flex-direction:column;justify-content:flex-end;gap:18px;">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="width:70px;color:var(--text-soft);font-size:13px;font-weight:700;">Gelir</div>
        <div style="flex:1;height:34px;border-radius:10px;background:var(--surface-soft);overflow:hidden;">
          <div style="width:${gelirYuzde}%;height:100%;min-width:${gelir > 0 ? "8px" : "0"};border-radius:10px;background:var(--income);transition:width .4s ease;"></div>
        </div>
        <strong style="width:120px;text-align:right;font-size:14px;color:var(--income);">${paraFormatla(gelir)}</strong>
      </div>
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="width:70px;color:var(--text-soft);font-size:13px;font-weight:700;">Gider</div>
        <div style="flex:1;height:34px;border-radius:10px;background:var(--surface-soft);overflow:hidden;">
          <div style="width:${giderYuzde}%;height:100%;min-width:${gider > 0 ? "8px" : "0"};border-radius:10px;background:var(--expense);transition:width .4s ease;"></div>
        </div>
        <strong style="width:120px;text-align:right;font-size:14px;color:var(--expense);">${paraFormatla(gider)}</strong>
      </div>
      <div style="margin-top:15px;padding:18px;border-radius:14px;background:var(--surface-soft);display:flex;align-items:center;justify-content:space-between;">
        <span style="color:var(--text-soft);font-size:13px;font-weight:700;">Aylık Net</span>
        <strong style="color:${netRengi(net)};font-size:22px;">${paraFormatla(net)}</strong>
      </div>
    </div>
  `;
}

function aylikIslemGrafiginiOlustur(aylikIslemler) {
  if (!aylikIslemGrafik) return;
  let gelirSayisi = 0;
  let giderSayisi = 0;
  aylikIslemler.forEach(islem => {
    if (islem.tur === "gelir") gelirSayisi++;
    else giderSayisi++;
  });
  const toplam = gelirSayisi + giderSayisi;
  if (toplam === 0) {
    aylikIslemGrafik.innerHTML = `
      <div class="chart-placeholder">
        <span>#</span>
        <strong>Bu ayda işlem yok</strong>
        <small>Seçtiğiniz ay için henüz kayıt bulunamadı.</small>
      </div>
    `;
    return;
  }
  const gelirYuzde = (gelirSayisi / toplam) * 100;
  const giderYuzde = (giderSayisi / toplam) * 100;

  aylikIslemGrafik.innerHTML = `
    <div style="width:100%;min-height:250px;display:flex;flex-direction:column;justify-content:center;gap:22px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:15px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="width:12px;height:12px;border-radius:50%;background:var(--income);"></span>
          <strong style="font-size:14px;color:var(--text);">Gelir işlemleri</strong>
        </div>
        <strong style="font-size:18px;color:var(--income);">${gelirSayisi}</strong>
      </div>
      <div style="width:100%;height:32px;display:flex;overflow:hidden;border-radius:10px;background:var(--surface-soft);">
        <div style="width:${gelirYuzde}%;background:var(--income);transition:width .4s ease;"></div>
        <div style="width:${giderYuzde}%;background:var(--expense);transition:width .4s ease;"></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:15px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="width:12px;height:12px;border-radius:50%;background:var(--expense);"></span>
          <strong style="font-size:14px;color:var(--text);">Gider işlemleri</strong>
        </div>
        <strong style="font-size:18px;color:var(--expense);">${giderSayisi}</strong>
      </div>
      <div style="padding:15px;border-radius:12px;background:var(--surface-soft);text-align:center;color:var(--text-soft);font-size:13px;">
        Toplam <strong style="color:var(--text);font-size:16px;">${toplam}</strong> işlem
      </div>
    </div>
  `;
}

function aylikTabloyuOlustur(aylikIslemler) {
  if (!aylikIslemTablosu) return;
  if (aylikIslemSayisi) aylikIslemSayisi.textContent = `${aylikIslemler.length} işlem`;
  if (aylikIslemler.length === 0) {
    aylikIslemTablosu.innerHTML = `
      <tr class="empty-row">
        <td colspan="4">
          <div class="empty-state">
            <div class="empty-icon">${DOVIZ_SEMBOL[seciliParaBirimi]}</div>
            <strong>Bu ayda işlem yok</strong>
            <span>Seçtiğiniz ay için kayıt bulunamadı.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  aylikIslemTablosu.innerHTML = "";
  const siraliIslemler = [...aylikIslemler].sort((a, b) => String(b.tarih || "").localeCompare(String(a.tarih || "")));

  siraliIslemler.forEach(islem => {
    const satir = document.createElement("tr");

    const formatliTutar = islem.tur === "gelir"
      ? `<span class="amount-income">+${paraFormatla(islem.miktar)}</span>`
      : `<span class="amount-expense">-${paraFormatla(islem.miktar)}</span>`;

    satir.innerHTML = `
      <td>
        <div class="transaction-name">${guvenliMetin(islem.aciklama)}</div>
        <div class="transaction-description">${islem.kategori || "Genel"}</div>
      </td>
      <td>
        ${islem.tur === "gelir" ? '<span class="type-badge type-income">↗ Gelir</span>' : '<span class="type-badge type-expense">↘ Gider</span>'}
      </td>
      <td><span class="date-text">${tarihFormatla(islem.tarih)}</span></td>
      <td>${formatliTutar}</td>
    `;
    aylikIslemTablosu.appendChild(satir);
  });
}

function temaGorunumunuGuncelle() {
  const tema = document.documentElement.dataset.theme;
  if (tema === "dark") {
    if (acikTema) acikTema.classList.remove("active");
    if (koyuTema) koyuTema.classList.add("active");
    if (mobilTema) mobilTema.textContent = "☀";
  } else {
    if (acikTema) acikTema.classList.add("active");
    if (koyuTema) koyuTema.classList.remove("active");
    if (mobilTema) mobilTema.textContent = "☾";
  }
}

function temayiYukle() {
  const kayitliTema = localStorage.getItem("financeTheme") || "light";
  document.documentElement.dataset.theme = kayitliTema;
  temaGorunumunuGuncelle();
}

// Dinleyiciler
if (mobilYeniIslemButonu) mobilYeniIslemButonu.addEventListener("click", modalAc);
if (islemlerYeniEkleBtn) islemlerYeniEkleBtn.addEventListener("click", modalAc);
if (modalKapat) modalKapat.addEventListener("click", modalKapatFunc);
if (modalIptal) modalIptal.addEventListener("click", modalKapatFunc);

if (tumunuGorBtn) {
  tumunuGorBtn.addEventListener("click", () => {
    history.replaceState(null, "", "#islemler");
    islemleriGoster();
  });
}

if (transactionModal) {
  transactionModal.addEventListener("click", (event) => {
    if (event.target === transactionModal) modalKapatFunc();
  });
}

if (debtModal) {
  debtModal.addEventListener("click", (event) => {
    if (event.target === debtModal) debtModalKapatFunc();
  });
}

if (goalModal) {
  goalModal.addEventListener("click", (event) => {
    if (event.target === goalModal) goalModalKapatFunc();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (transactionModal && transactionModal.classList.contains("show")) modalKapatFunc();
    if (debtModal && debtModal.classList.contains("show")) debtModalKapatFunc();
    if (goalModal && goalModal.classList.contains("show")) goalModalKapatFunc();
  }
});

if (gelirButonu) gelirButonu.addEventListener("click", gelirButonunuAktifEt);
if (giderButonu) giderButonu.addEventListener("click", giderButonunuAktifEt);

if (aramaInput) aramaInput.addEventListener("input", ekraniGuncelle);
if (filtreSelect) filtreSelect.addEventListener("change", ekraniGuncelle);
if (kategoriFiltreSelect) kategoriFiltreSelect.addEventListener("change", ekraniGuncelle);
if (siralaSelect) siralaSelect.addEventListener("change", ekraniGuncelle);
if (baslangicTarihiInput) baslangicTarihiInput.addEventListener("change", ekraniGuncelle);
if (bitisTarihiInput) bitisTarihiInput.addEventListener("change", ekraniGuncelle);

if (acikTema) {
  acikTema.addEventListener("click", () => {
    document.documentElement.dataset.theme = "light";
    localStorage.setItem("financeTheme", "light");
    temaGorunumunuGuncelle();
  });
}

if (koyuTema) {
  koyuTema.addEventListener("click", () => {
    document.documentElement.dataset.theme = "dark";
    localStorage.setItem("financeTheme", "dark");
    temaGorunumunuGuncelle();
  });
}

if (mobilTema) {
  mobilTema.addEventListener("click", () => {
    const mevcutTema = document.documentElement.dataset.theme;
    const yeniTema = mevcutTema === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = yeniTema;
    localStorage.setItem("financeTheme", newTema);
    temaGorunumunuGuncelle();
  });
}

if (aylikOzetMenu) {
  aylikOzetMenu.addEventListener("click", (e) => {
    e.preventDefault();
    history.replaceState(null, "", "#aylikOzet");
    aylikOzetiGoster();
  });
}

if (genelBakisMenu) {
  genelBakisMenu.addEventListener("click", (e) => {
    e.preventDefault();
    history.replaceState(null, "", "#");
    genelBakisiGoster();
  });
}

if (islemlerMenuLink) {
  islemlerMenuLink.addEventListener("click", (e) => {
    e.preventDefault();
    history.replaceState(null, "", "#islemler");
    islemleriGoster();
  });
}

if (borclarMenu) {
  borclarMenu.addEventListener("click", (e) => {
    e.preventDefault();
    history.replaceState(null, "", "#borclar");
    borclariGoster();
  });
}

if (hedeflerMenu) {
  hedeflerMenu.addEventListener("click", (e) => {
    e.preventDefault();
    history.replaceState(null, "", "#hedefler");
    hedefleriGoster();
  });
}

if (aylikOzetTarih) {
  aylikOzetTarih.value = bugununAyiniAl();
  aylikOzetTarih.addEventListener("change", aylikOzetiGuncelle);
}

window.addEventListener("hashchange", hashIleSayfayiAc);

if (islemForm) {
  islemForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const tur = turInput ? turInput.value : "gider";
    const girilenMiktar = miktarInput ? Number(miktarInput.value) : 0;
    const tarih = tarihInput ? tarihInput.value : "";
    const kategori = kategoriInput ? kategoriInput.value : "Diğer";
    const secilenModalBirim = modalCurrencySelector ? modalCurrencySelector.value : "TRY";

    let aciklama = aciklamaInput ? aciklamaInput.value.trim() : "";
    if (!aciklama) {
      aciklama = kategori;
    }

    if (!girilenMiktar || girilenMiktar <= 0) {
      alert("Lütfen geçerli bir miktar girin.");
      return;
    }
    if (!tarih) {
      alert("Lütfen tarih seçin.");
      return;
    }

    const carpan = DOVIZ_KURLARI[secilenModalBirim] || 1.0;
    const gercekMiktarTRY = girilenMiktar / carpan;

    const veri = {
      type: tur,
      amount: gercekMiktarTRY,
      date: tarih,
      category: kategori,
      description: aciklama
    };

    try {
      let cevap;
      if (duzenlenenIslemId === null) {
        cevap = await authFetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(veri)
        });
      } else {
        cevap = await authFetch(`${API_URL}/${duzenlenenIslemId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(veri)
        });
      }

      if (!cevap.ok) throw new Error("İşlem gerçekleştirilemedi.");
      await islemleriGetir();
      modalKapatFunc();
    } catch (hata) {
      console.error(hata);
      alert("İşlem sırasında bir hata oluştu.");
    }
  });
}

// Uygulamayı Başlat
async function baslat() {
  const token = getToken();
  const kayitliKullanici = localStorage.getItem("currentUser");

  if (!token) {
    document.body.classList.add("auth-locked");
    return;
  }

  // Token geçerliliğini doğrula
  try {
    const res = await fetch("/api/auth/me", {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!res.ok) {
      oturumKapat();
      return;
    }

    const userData = await res.json();
    document.body.classList.remove("auth-locked");
    kullaniciArayuzunuGuncelle(userData.username);
  } catch (e) {
    oturumKapat();
    return;
  }

  temayiYukle();
  hashIleSayfayiAc();
  await canliKurlariGuncelle();
  paraBiriminiAyarla(seciliParaBirimi);
  await Promise.all([islemleriGetir(), borclariGetir(), hedefleriGetir()]);
}

baslat();
