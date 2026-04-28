# DYO Boya — Yedek Parça Envanter DSS

React + Firebase + FastAPI ile geliştirilmiş Karar Destek Sistemi.

---

## Proje Yapısı

```
dyo-dss/
├── frontend/          React uygulaması (Firebase Hosting)
│   ├── src/
│   │   ├── services/firebase.js   ← Tüm Firestore işlemleri
│   │   ├── pages/
│   │   │   ├── Login.js           ← Giriş ekranı
│   │   │   ├── Dashboard.js       ← Ana layout + sidebar
│   │   │   ├── PartsPage.js       ← Parça listesi CRUD
│   │   │   ├── ImportPage.js      ← CSV/Excel yükleme
│   │   │   └── ResultsPage.js     ← Simülasyon sonuçları
│   │   └── App.css                ← DYO tema
│   └── package.json
├── backend/           FastAPI (Railway veya Render)
│   ├── main.py        ← API endpoint'leri + Firestore yazma
│   ├── requirements.txt
│   └── Procfile
├── .github/workflows/deploy.yml   ← Otomatik CI/CD
├── firebase.json
└── firestore.rules
```

---

## Kurulum Adımları

### 1. Firebase Projesi Oluşturun (15 dakika)

1. https://firebase.google.com → "Get Started"
2. **Yeni proje** oluşturun (örn: `dyo-dss`)
3. **Firestore Database** → "Create database" → **Production mode** → Bölge: `europe-west3`
4. **Authentication** → "Get started" → **Email/Password** etkinleştir
5. Authentication → Users → "Add user" → DYO çalışanlarının e-posta/şifrelerini ekleyin
6. **Proje Ayarları** (dişli ikon) → "Uygulamalarınız" → Web uygulaması ekle → `firebaseConfig`'i kopyalayın

### 2. GitHub Repo Oluşturun

```bash
git init
git add .
git commit -m "İlk commit"
git remote add origin https://github.com/KULLANICI_ADI/dyo-dss.git
git push -u origin main
```

### 3. Ortam Değişkenlerini Ayarlayın

`frontend/.env.local.example` → `frontend/.env.local` olarak kopyalayıp doldurun:

```
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=dyo-dss.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=dyo-dss
...
```

### 4. Firebase Hosting Bağlayın

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # "Use existing project" → dyo-dss seçin
```

GitHub Actions'ın otomatik deploy etmesi için repo'nun **Settings → Secrets** bölümüne aynı değişkenleri ekleyin.

### 5. Backend'i Railway'e Deploy Edin

1. https://railway.app → "New Project" → "Deploy from GitHub repo"
2. `backend/` klasörünü seçin (veya root'ta Procfile varsa direkt)
3. **Variables** sekmesi → `FIREBASE_SERVICE_ACCOUNT` ekleyin:
   - Firebase Console → Proje Ayarları → Hizmet hesapları → "Yeni özel anahtar oluştur"
   - İndirilen JSON dosyasının içeriğini bu değişkene yapıştırın
4. Deploy edilen URL'yi (örn: `https://dyo-dss-api.up.railway.app`) `REACT_APP_API_URL` secret'ına ekleyin

### 6. Gerçek Simülasyon Kodunu Bağlayın

`backend/main.py` içinde `run_for_part` fonksiyonunu bulun ve şunu yapın:

```python
# backend/sim/ klasörüne dyo.txt kodunu koyun (dyo_simulation.py adıyla)
import sys
sys.path.append('/app/sim')
from dyo_simulation import monte_carlo, optimize_policy, evaluate_current, SIM_CONFIG

def run_for_part(part, n_rep, sim_days, warmup):
    part_data = {
        'name': part.name,
        'ved_class': part.ved,
        'abc_class': part.abc,
        'demand': {'dist': part.dist, 'lambda': part.lam, 'r': part.r_nb, 'p': part.p_nb},
        'lead_time_mean': part.lt_mean,
        'lead_time_std': part.lt_std,
        'unit_cost': part.price,
        'holding_cost_rate': 0.25,
        'ordering_cost': 135,
        'current_stock': 1,
        'current_min_stock': part.minstock,
    }
    cur_p, cur_s = evaluate_current(part.id, part_data, n_rep, sim_days, warmup)
    best = optimize_policy(part.id, part_data, n_rep, sim_days, warmup)
    # ... winner seçimi ve return
```

### 7. Firestore Kurallarını Yükleyin

```bash
firebase deploy --only firestore:rules
```

---

## Kullanım

1. Tarayıcıda Firebase Hosting URL'sine gidin
2. DYO çalışan e-postası ve şifresi ile giriş yapın
3. **Parçalar** sekmesi → Parça ekle / düzenle / sil
4. **CSV/Excel Yükle** → `dyo_demand_clean.csv` dosyasını yükleyin
5. **Simülasyon** sekmesi → "Simülasyonu Çalıştır" → Sonuçlar otomatik gelir

---

## Notlar

- Firestore'daki tüm değişiklikler gerçek zamanlı yansır (başka kullanıcılar da anlık görür)
- Simülasyon backend'de koşar, tarayıcıyı yormaz
- Her simülasyon sonucu Firestore'da `results/` koleksiyonunda tarihiyle saklanır
