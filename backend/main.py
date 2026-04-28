# backend/main.py
"""
DYO DSS — FastAPI Backend
- POST /simulate  → simülasyonu çalıştırır, sonuçları Firestore'a yazar
- GET  /health    → sağlık kontrolü
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import json
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, firestore

# ── Firebase başlatma ────────────────────────────────────────────────────────
# Railway/Render'da FIREBASE_SERVICE_ACCOUNT ortam değişkeni olarak JSON string girin
_sa = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
if _sa:
    cred = credentials.Certificate(json.loads(_sa))
else:
    # Local geliştirme: serviceAccountKey.json dosyası
    cred = credentials.Certificate('serviceAccountKey.json')

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# ── FastAPI ──────────────────────────────────────────────────────────────────
app = FastAPI(title='DYO DSS API', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],   # Production'da sadece Firebase Hosting URL'ini yazın
    allow_methods=['*'],
    allow_headers=['*'],
)

# ── Veri modelleri ───────────────────────────────────────────────────────────
class PartInput(BaseModel):
    id:        Optional[str] = None
    name:      str
    code:      Optional[str] = ''
    ved:       str
    abc:       str
    dist:      str
    lam:       Optional[float] = None
    r_nb:      Optional[float] = None
    p_nb:      Optional[float] = None
    lt_mean:   float = 2.0
    lt_std:    float = 0.5
    price:     float = 100.0
    minstock:  int   = 1

class SimulateRequest(BaseModel):
    parts: List[PartInput]
    n_rep:     int = 50       # Hız için azaltıldı; production'da 100 kullanın
    sim_days:  int = 365
    warmup:    int = 60

# ── Simülasyon ───────────────────────────────────────────────────────────────
# Kodunuzdaki run_simulation, monte_carlo, optimize_policy fonksiyonlarını buraya import edin.
# Şimdilik kısa bir adapter ile çağırıyoruz.

def run_for_part(part: PartInput, n_rep: int, sim_days: int, warmup: int) -> dict:
    """
    Gerçek simülasyon kodunuzu buraya bağlayın.
    Şu an dyo.txt içindeki fonksiyonları doğrudan import etmek için:

        import sys
        sys.path.append('/app/sim')   # sim/ klasörüne kodu koyun
        from dyo_simulation import monte_carlo, optimize_policy, evaluate_current

    Demo modunda rastgele ama gerçekçi değerler döndürüyor.
    """
    import random
    random.seed(hash(part.name) % 10000)

    SL_MIN = {
        ('A','V'):0.98, ('A','E'):0.95, ('A','D'):0.90,
        ('B','V'):0.95, ('B','E'):0.90, ('B','D'):0.80,
        ('C','V'):0.90, ('C','E'):0.75, ('C','D'):0.60,
    }
    target = SL_MIN.get((part.abc, part.ved), 0.90)

    # Simüle edilmiş değerler — gerçek entegrasyonda monte_carlo() ile değiştirin
    current_sl   = target - random.uniform(0.01, 0.08)
    optimal_sl   = target + random.uniform(0.0,  0.02)
    current_cost = part.price * random.uniform(200, 500)
    optimal_cost = current_cost * random.uniform(0.65, 0.90)
    savings      = current_cost - optimal_cost

    return {
        'code':        part.code or f'P{random.randint(1,99):03d}',
        'name':        part.name,
        'ved':         part.ved,
        'abc':         part.abc,
        'winner':      random.choice(['Qr', 'Ss']),
        'optimal_r':   part.minstock + random.randint(0, 3),
        'optimal_q':   max(1, int(part.lt_mean * 2)),
        'current_sl':  round(current_sl, 4),
        'optimal_sl':  round(optimal_sl, 4),
        'target_sl':   target,
        'current_cost': round(current_cost),
        'optimal_cost': round(optimal_cost),
        'savings':      round(savings),
        'sim_sl':       round(optimal_sl, 4),
    }


@app.get('/health')
def health():
    return {'status': 'ok', 'timestamp': datetime.utcnow().isoformat()}


@app.post('/simulate')
async def simulate(req: SimulateRequest):
    if not req.parts:
        raise HTTPException(status_code=400, detail='Parça listesi boş.')

    summary = []
    for part in req.parts:
        result = run_for_part(part, req.n_rep, req.sim_days, req.warmup)
        summary.append(result)

        # Firestore'daki parçanın sim_sl alanını güncelle
        if part.id:
            try:
                db.collection('parts').document(part.id).update({
                    'sim_sl': result['sim_sl'],
                    'sim_winner': result['winner'],
                    'sim_optimal_r': result['optimal_r'],
                    'sim_optimal_q': result['optimal_q'],
                })
            except Exception:
                pass   # Parça silinmiş olabilir, devam et

    total_savings  = sum(r['savings']  for r in summary)
    sl_ok_count    = sum(1 for r in summary if r['optimal_sl'] >= r['target_sl'])
    sl_warn_count  = len(summary) - sl_ok_count

    # Sonuçları Firestore'a kaydet
    doc = {
        'createdAt':     datetime.utcnow().isoformat(),
        'parts_count':   len(summary),
        'total_savings': total_savings,
        'sl_ok_count':   sl_ok_count,
        'sl_warn_count': sl_warn_count,
        'n_rep':         req.n_rep,
        'sim_days':      req.sim_days,
        'summary':       summary,
    }
    db.collection('results').add(doc)

    return {
        'ok':            True,
        'parts_count':   len(summary),
        'total_savings': total_savings,
        'summary':       summary,
    }
