// src/pages/ResultsPage.js
import React, { useState, useEffect } from 'react';
import { subscribeResults, subscribeParts } from '../services/firebase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function ResultsPage() {
  const [results,  setResults]  = useState([]);
  const [parts,    setParts]    = useState([]);
  const [running,  setRunning]  = useState(false);
  const [runMsg,   setRunMsg]   = useState('');
  const [latest,   setLatest]   = useState(null);

  useEffect(() => {
    const u1 = subscribeResults(data => {
      setResults(data);
      if (data.length > 0) setLatest(data[0]);
    });
    const u2 = subscribeParts(setParts);
    return () => { u1(); u2(); };
  }, []);

  const runSimulation = async () => {
    if (!parts.length) { setRunMsg('Önce parça ekleyin.'); return; }
    setRunning(true);
    setRunMsg('Simülasyon başlatılıyor…');
    try {
      const res = await fetch(`${API_URL}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRunMsg(`✓ Simülasyon tamamlandı — ${data.parts_count} parça işlendi.`);
    } catch (err) {
      setRunMsg(`Hata: Backend bağlantısı kurulamadı. (${err.message}) — Backend'i deploy ettikten sonra çalışacak.`);
    } finally {
      setRunning(false);
    }
  };

  // For demo: use mock chart data if no real results
  const chartData = latest?.summary
    ? latest.summary.map(p => ({
        name:    p.name?.slice(0, 12),
        current: Math.round(p.current_cost / 1000),
        optimal: Math.round(p.optimal_cost / 1000),
        saving:  Math.round(p.savings / 1000),
      }))
    : parts.slice(0, 8).map(p => ({
        name:    p.name?.slice(0, 12),
        current: Math.round(Math.random() * 80 + 20),
        optimal: Math.round(Math.random() * 50 + 10),
        saving:  Math.round(Math.random() * 30 + 5),
      }));

  const totalSaving = latest?.total_savings ?? 0;
  const partsCount  = latest?.parts_count ?? parts.length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Simülasyon Sonuçları</div>
          <div className="page-sub">
            {latest ? `Son çalışma: ${new Date(latest.createdAt).toLocaleString('tr-TR')}` : 'Henüz simülasyon çalıştırılmadı'}
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={runSimulation}
          disabled={running}
        >
          {running ? <><span className="spinner" /> Çalışıyor…</> : '▶ Simülasyonu Çalıştır'}
        </button>
      </div>

      {runMsg && (
        <div className={`notice ${runMsg.startsWith('✓') ? 'notice-success' : runMsg.startsWith('Hata') ? 'notice-warning' : 'notice-info'}`}>
          {runMsg}
        </div>
      )}

      {!latest && (
        <div className="notice notice-info">
          Backend henüz kurulmadı. Kurulum adımları için aşağıya bakın. Grafik şu an örnek verilerle gösteriliyor.
        </div>
      )}

      {/* Summary stats */}
      <div className="stats-grid" style={{marginBottom:24}}>
        <div className="stat-card">
          <div className="label">İşlenen Parça</div>
          <div className="value">{partsCount}</div>
        </div>
        <div className="stat-card">
          <div className="label">Toplam Tasarruf</div>
          <div className="value green">{totalSaving ? totalSaving.toLocaleString('tr-TR') + ' ₺' : '—'}</div>
          <div className="sub">yıllık tahmini</div>
        </div>
        <div className="stat-card">
          <div className="label">SL Hedef Karşılayan</div>
          <div className="value">{latest?.sl_ok_count ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="label">Uyarı</div>
          <div className="value amber">{latest?.sl_warn_count ?? '—'}</div>
        </div>
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div className="table-card" style={{padding:'20px', marginBottom:20}}>
          <div style={{fontSize:13, fontWeight:500, marginBottom:16}}>
            Mevcut vs Optimal Maliyet (Bin TL / yıl)
            {!latest && <span style={{fontSize:11, color:'var(--text-3)', marginLeft:8}}>(örnek veri)</span>}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={16} barGap={4}>
              <XAxis dataKey="name" tick={{fontSize:11}} tickLine={false} axisLine={false} />
              <YAxis tick={{fontSize:11}} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{fontSize:12, borderRadius:8, border:'1px solid var(--border)'}}
                formatter={(v) => [`${v}k TL`]}
              />
              <Bar dataKey="current" name="Mevcut" fill="#E2DED6" radius={[3,3,0,0]} />
              <Bar dataKey="optimal" name="Optimal" fill="#C0001A" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Results list */}
      {latest?.summary ? (
        <>
          <div style={{fontSize:13, fontWeight:500, marginBottom:12}}>Parça Bazlı Sonuçlar</div>
          {latest.summary.map((p, i) => (
            <div key={i} className={`result-card ${p.savings > 0 ? 'winner' : ''}`}>
              <div>
                <div style={{fontWeight:500}}>{p.name} <span style={{fontSize:11, color:'var(--text-3)'}}>{p.code}</span></div>
                <div className="result-meta">
                  Politika: {p.winner} &nbsp;·&nbsp; r={p.optimal_r}, Q={p.optimal_q}
                  &nbsp;·&nbsp; SL: {(p.optimal_sl * 100).toFixed(1)}%
                  {p.optimal_sl >= p.target_sl ? ' ✓' : ' ⚠'}
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div className="savings" style={{color: p.savings >= 0 ? 'var(--green)' : 'var(--amber)'}}>
                  {p.savings >= 0 ? '+' : ''}{Math.round(p.savings).toLocaleString('tr-TR')} ₺
                </div>
                <div style={{fontSize:11, color:'var(--text-3)'}}>yıllık tasarruf</div>
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="table-card">
          <div style={{padding:24}}>
            <div style={{fontSize:13, fontWeight:500, marginBottom:12}}>Backend Kurulum Adımları</div>
            <ol style={{fontSize:13, color:'var(--text-2)', lineHeight:2, paddingLeft:18}}>
              <li>Railway.app'e üye olun → "New Project" → "Deploy from GitHub repo"</li>
              <li><span className="mono">backend/</span> klasörünü repo'ya push edin</li>
              <li>Railway ortam değişkenlerine Firebase bilgilerini ekleyin</li>
              <li>Deploy edilen URL'yi <span className="mono">REACT_APP_API_URL</span>'e yazın</li>
              <li>"Simülasyonu Çalıştır" butonuna basın — sonuçlar otomatik gelir</li>
            </ol>
          </div>
        </div>
      )}

      {/* Run history */}
      {results.length > 1 && (
        <div style={{marginTop:24}}>
          <div style={{fontSize:13, fontWeight:500, marginBottom:12}}>Önceki Çalışmalar</div>
          {results.slice(1).map(r => (
            <div key={r.id} style={{
              background:'var(--surface)', border:'1px solid var(--border)',
              borderRadius:'var(--radius)', padding:'10px 16px',
              marginBottom:8, display:'flex', justifyContent:'space-between',
              fontSize:13, color:'var(--text-2)'
            }}>
              <span>{new Date(r.createdAt).toLocaleString('tr-TR')}</span>
              <span>{r.parts_count} parça &nbsp;·&nbsp; {r.total_savings?.toLocaleString('tr-TR')} ₺ tasarruf</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
