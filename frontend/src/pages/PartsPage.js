// src/pages/PartsPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { subscribeParts, addPart, updatePart, deletePart } from '../services/firebase';

const SL_TARGETS = {
  'A-V':0.98,'A-E':0.95,'A-D':0.90,
  'B-V':0.95,'B-E':0.90,'B-D':0.80,
  'C-V':0.90,'C-E':0.75,'C-D':0.60,
};
const getTarget = (abc, ved) => SL_TARGETS[`${abc}-${ved}`] ?? 0.90;

const EMPTY_FORM = {
  name:'', code:'', ved:'V', abc:'A',
  dist:'Poisson', lam:'', r_nb:'', p_nb:'',
  lt_mean:'', lt_std:'', price:'', minstock:'',
};

export default function PartsPage() {
  const [parts,   setParts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filVed,  setFilVed]  = useState('');
  const [filAbc,  setFilAbc]  = useState('');
  const [modal,   setModal]   = useState(null); // null | 'add' | 'edit'
  const [form,    setForm]    = useState(EMPTY_FORM);
  const [editId,  setEditId]  = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const unsub = subscribeParts(data => { setParts(data); setLoading(false); });
    return unsub;
  }, []);

  const filtered = useMemo(() => parts.filter(p =>
    (!search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.code?.toLowerCase().includes(search.toLowerCase())) &&
    (!filVed || p.ved === filVed) &&
    (!filAbc || p.abc === filAbc)
  ), [parts, search, filVed, filAbc]);

  const stats = useMemo(() => ({
    total:  parts.length,
    vital:  parts.filter(p => p.ved === 'V').length,
    warn:   parts.filter(p => (p.sim_sl ?? null) !== null && p.sim_sl < getTarget(p.abc, p.ved)).length,
    avgSl:  parts.length ? parts.reduce((a, p) => a + (p.sim_sl ?? getTarget(p.abc, p.ved)), 0) / parts.length : 0,
  }), [parts]);

  const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setError(''); setModal('add'); };
  const openEdit = (p) => {
    setForm({
      name: p.name, code: p.code, ved: p.ved, abc: p.abc,
      dist: p.dist, lam: p.lam ?? '', r_nb: p.r_nb ?? '', p_nb: p.p_nb ?? '',
      lt_mean: p.lt_mean, lt_std: p.lt_std, price: p.price, minstock: p.minstock,
    });
    setEditId(p.id);
    setError('');
    setModal('edit');
  };
  const closeModal = () => { setModal(null); setEditId(null); };

  const f = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Parça adı zorunludur.'); return; }
    setSaving(true);
    setError('');
    try {
      const data = {
        name:     form.name.trim(),
        code:     form.code.trim() || `P${String(parts.length + 1).padStart(3, '0')}`,
        ved:      form.ved,
        abc:      form.abc,
        dist:     form.dist,
        lam:      form.dist === 'Poisson' ? parseFloat(form.lam) || 0 : null,
        r_nb:     form.dist === 'NegBinom' ? parseFloat(form.r_nb) || 0 : null,
        p_nb:     form.dist === 'NegBinom' ? parseFloat(form.p_nb) || 0 : null,
        lt_mean:  parseFloat(form.lt_mean) || 2.0,
        lt_std:   parseFloat(form.lt_std) || 0.5,
        price:    parseFloat(form.price) || 0,
        minstock: parseInt(form.minstock) || 1,
        updatedAt: new Date().toISOString(),
      };
      if (modal === 'edit') {
        await updatePart(editId, data);
      } else {
        data.createdAt = new Date().toISOString();
        await addPart(data);
      }
      closeModal();
    } catch (err) {
      setError('Kaydetme hatası: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`"${name}" silinsin mi?`)) return;
    await deletePart(id);
  };

  if (loading) return <div className="page"><div className="empty-state">Yükleniyor…</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Yedek Parçalar</div>
          <div className="page-sub">Firebase'den gerçek zamanlı — değişiklikler anında yansır</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Parça Ekle</button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Toplam Parça</div>
          <div className="value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="label">Vital (V)</div>
          <div className="value red">{stats.vital}</div>
        </div>
        <div className="stat-card">
          <div className="label">SL Hedef Altı</div>
          <div className="value amber">{stats.warn}</div>
        </div>
        <div className="stat-card">
          <div className="label">Ort. Servis Seviyesi</div>
          <div className="value green">{(stats.avgSl * 100).toFixed(1)}%</div>
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-toolbar">
          <input
            className="search-input"
            placeholder="Parça adı veya kod ara…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="filter" value={filVed} onChange={e => setFilVed(e.target.value)}>
            <option value="">Tüm VED</option>
            <option>V</option><option>E</option><option>D</option>
          </select>
          <select className="filter" value={filAbc} onChange={e => setFilAbc(e.target.value)}>
            <option value="">Tüm ABC</option>
            <option>A</option><option>B</option><option>C</option>
          </select>
          <button className="btn btn-sm" onClick={() => exportCSV(parts)}>↓ CSV İndir</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Kod</th><th>Parça Adı</th><th>VED</th><th>ABC</th>
              <th>Talep Dağılımı</th><th>LT Ort.</th><th>Fiyat (TL)</th>
              <th>Min Stok</th><th>SL Hedef</th><th>Sim. SL</th><th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="empty-state">Sonuç bulunamadı.</td></tr>
            )}
            {filtered.map(p => {
              const tgt = getTarget(p.abc, p.ved);
              const sl  = p.sim_sl ?? null;
              const ok  = sl !== null && sl >= tgt;
              const distLabel = p.dist === 'Poisson'
                ? `Poisson(λ=${p.lam})`
                : `NegBinom(r=${p.r_nb}, p=${p.p_nb})`;
              return (
                <tr key={p.id}>
                  <td className="mono">{p.code}</td>
                  <td>{p.name}</td>
                  <td><span className={`badge badge-${p.ved}`}>{p.ved}</span></td>
                  <td><span className={`badge badge-${p.abc}`}>{p.abc}</span></td>
                  <td className="mono" style={{fontSize:11}}>{distLabel}</td>
                  <td>{p.lt_mean} hf</td>
                  <td>{Number(p.price).toLocaleString('tr-TR')}</td>
                  <td>{p.minstock}</td>
                  <td style={{fontSize:12}}>≥ {(tgt*100).toFixed(0)}%</td>
                  <td>
                    {sl !== null
                      ? <span className={ok ? 'sl-ok' : 'sl-warn'}>{ok ? '✓' : '⚠'} {(sl*100).toFixed(1)}%</span>
                      : <span style={{color:'var(--text-3)',fontSize:11}}>—</span>
                    }
                  </td>
                  <td style={{display:'flex', gap:4}}>
                    <button className="btn btn-sm" onClick={() => openEdit(p)}>Düzenle</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id, p.name)}>Sil</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <h2>{modal === 'edit' ? 'Parçayı Düzenle' : 'Yeni Parça Ekle'}</h2>

            <div className="form-grid">
              <div className="field">
                <label>Parça Adı *</label>
                <input value={form.name} onChange={f('name')} placeholder="Kompresör Valfi" />
              </div>
              <div className="field">
                <label>Kod (opsiyonel)</label>
                <input value={form.code} onChange={f('code')} placeholder="P007" />
              </div>
            </div>

            <div className="form-grid" style={{marginTop:12}}>
              <div className="field">
                <label>VED Sınıfı</label>
                <select value={form.ved} onChange={f('ved')}>
                  <option value="V">V — Vital (Hayati)</option>
                  <option value="E">E — Essential (Önemli)</option>
                  <option value="D">D — Desirable (İstenen)</option>
                </select>
              </div>
              <div className="field">
                <label>ABC Sınıfı</label>
                <select value={form.abc} onChange={f('abc')}>
                  <option value="A">A — Yüksek Değer</option>
                  <option value="B">B — Orta Değer</option>
                  <option value="C">C — Düşük Değer</option>
                </select>
              </div>
            </div>

            <div className="form-grid" style={{marginTop:12}}>
              <div className="field">
                <label>Talep Dağılımı</label>
                <select value={form.dist} onChange={f('dist')}>
                  <option value="Poisson">Poisson</option>
                  <option value="NegBinom">Negatif Binom</option>
                </select>
              </div>
              {form.dist === 'Poisson'
                ? <div className="field"><label>Lambda (aylık)</label><input type="number" value={form.lam} onChange={f('lam')} placeholder="2.5" step="0.1" /></div>
                : <div className="field"><label>r parametresi</label><input type="number" value={form.r_nb} onChange={f('r_nb')} placeholder="1.2" step="0.1" /></div>
              }
            </div>

            {form.dist === 'NegBinom' && (
              <div className="form-grid" style={{marginTop:12}}>
                <div className="field"><label>p parametresi</label><input type="number" value={form.p_nb} onChange={f('p_nb')} placeholder="0.45" step="0.01" /></div>
                <div />
              </div>
            )}

            <div className="form-grid" style={{marginTop:12}}>
              <div className="field"><label>LT Ortalama (hafta)</label><input type="number" value={form.lt_mean} onChange={f('lt_mean')} placeholder="2.5" step="0.5" /></div>
              <div className="field"><label>LT Std. Sapma (hafta)</label><input type="number" value={form.lt_std} onChange={f('lt_std')} placeholder="0.8" step="0.1" /></div>
            </div>

            <div className="form-grid" style={{marginTop:12}}>
              <div className="field"><label>Birim Fiyat (TL)</label><input type="number" value={form.price} onChange={f('price')} placeholder="850" /></div>
              <div className="field"><label>Min Stok (adet)</label><input type="number" value={form.minstock} onChange={f('minstock')} placeholder="3" /></div>
            </div>

            {error && <div className="notice notice-warning" style={{marginTop:12}}>{error}</div>}

            <div className="modal-footer">
              <button className="btn" onClick={closeModal}>İptal</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function exportCSV(parts) {
  const header = 'part,ved_class,abc_class,dist_type,dist_params,lead_time_mean_weeks,lead_time_std_weeks,unit_price,min_stock';
  const rows = parts.map(p => {
    const dp = p.dist === 'Poisson' ? `lambda = ${p.lam}` : `r = ${p.r_nb}, p = ${p.p_nb}`;
    return [p.name, p.ved, p.abc, p.dist, dp, p.lt_mean, p.lt_std, p.price, p.minstock].join(',');
  });
  const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dyo_demand_clean.csv';
  a.click();
}
