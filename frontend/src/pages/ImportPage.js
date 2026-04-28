// src/pages/ImportPage.js
import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { addPart } from '../services/firebase';

const REQUIRED_COLS = ['part','ved_class','abc_class','dist_type','dist_params',
                       'lead_time_mean_weeks','lead_time_std_weeks','unit_price','min_stock'];

export default function ImportPage() {
  const [preview,  setPreview]  = useState(null);  // { rows, errors }
  const [status,   setStatus]   = useState('idle'); // idle | loading | success | error
  const [message,  setMessage]  = useState('');
  const inputRef = useRef();

  const parseCSV = (text) => {
    const result = Papa.parse(text, { header: true, skipEmptyLines: true, trimHeaders: true });
    return result.data;
  };

  const parseXLSX = (buffer) => {
    const wb   = XLSX.read(buffer, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: '' });
  };

  const validateRows = (rows) => {
    const errors = [];
    const cols   = Object.keys(rows[0] || {});
    REQUIRED_COLS.forEach(c => { if (!cols.includes(c)) errors.push(`Eksik sütun: "${c}"`); });
    rows.forEach((r, i) => {
      if (!r.part)      errors.push(`Satır ${i+2}: part adı boş`);
      if (!['V','E','D'].includes(r.ved_class)) errors.push(`Satır ${i+2}: geçersiz ved_class "${r.ved_class}"`);
      if (!['A','B','C'].includes(r.abc_class)) errors.push(`Satır ${i+2}: geçersiz abc_class "${r.abc_class}"`);
    });
    return errors;
  };

  const handleFile = (file) => {
    if (!file) return;
    setStatus('loading'); setMessage('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let rows;
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          rows = parseXLSX(e.target.result);
        } else {
          rows = parseCSV(e.target.result);
        }
        const errors = validateRows(rows);
        setPreview({ rows: rows.slice(0, 10), allRows: rows, errors });
        setStatus('idle');
      } catch (err) {
        setStatus('error'); setMessage('Dosya okunamadı: ' + err.message);
      }
    };
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, 'utf-8');
    }
  };

  const handleImport = async () => {
    if (!preview?.allRows?.length) return;
    setStatus('loading');
    setMessage('');
    try {
      let count = 0;
      for (const row of preview.allRows) {
        const isDist = row.dist_type === 'Poisson';
        // parse dist_params: "lambda = 2.5" or "r = 1.2, p = 0.45"
        const params = {};
        row.dist_params.split(',').forEach(part => {
          const [k, v] = part.split('=').map(s => s.trim());
          params[k] = parseFloat(v);
        });
        await addPart({
          name:     row.part,
          code:     '',
          ved:      row.ved_class,
          abc:      row.abc_class,
          dist:     row.dist_type,
          lam:      isDist ? (params['lambda'] ?? 0) : null,
          r_nb:     !isDist ? (params['r'] ?? 0) : null,
          p_nb:     !isDist ? (params['p'] ?? 0) : null,
          lt_mean:  parseFloat(row.lead_time_mean_weeks) || 2,
          lt_std:   parseFloat(row.lead_time_std_weeks) || 0.5,
          price:    parseFloat(row.unit_price) || 0,
          minstock: parseInt(row.min_stock) || 1,
          createdAt: new Date().toISOString(),
        });
        count++;
      }
      setStatus('success');
      setMessage(`${count} parça başarıyla Firebase'e aktarıldı.`);
      setPreview(null);
    } catch (err) {
      setStatus('error');
      setMessage('Aktarma hatası: ' + err.message);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">CSV / Excel Yükle</div>
          <div className="page-sub">Mevcut simülasyon verisini toplu olarak içe aktarın</div>
        </div>
      </div>

      <div className="notice notice-info">
        Gerekli sütunlar: <span className="mono">{REQUIRED_COLS.join('  ·  ')}</span>
      </div>

      <div
        className="upload-zone"
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current.click()}
      >
        <div className="icon">📂</div>
        <p><strong>Dosya seçmek için tıklayın</strong> ya da sürükleyip bırakın</p>
        <p style={{marginTop:6, fontSize:12}}>CSV veya Excel (.xlsx) — dyo_demand_clean.csv formatı</p>
      </div>
      <input
        ref={inputRef} type="file" style={{display:'none'}}
        accept=".csv,.xlsx,.xls"
        onChange={e => handleFile(e.target.files[0])}
      />

      {status === 'success' && <div className="notice notice-success">{message}</div>}
      {status === 'error'   && <div className="notice notice-warning">{message}</div>}

      {preview && (
        <>
          {preview.errors.length > 0 && (
            <div className="notice notice-warning">
              <strong>Doğrulama hataları:</strong>
              <ul style={{marginTop:6, paddingLeft:16}}>
                {preview.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div style={{marginBottom:12, fontSize:13, color:'var(--text-2)'}}>
            <strong>{preview.allRows.length}</strong> satır bulundu — ilk 10 satır önizleme:
          </div>

          <div className="table-card" style={{marginBottom:16}}>
            <div style={{overflowX:'auto'}}>
              <table>
                <thead>
                  <tr>
                    {REQUIRED_COLS.map(c => <th key={c}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i}>
                      {REQUIRED_COLS.map(c => (
                        <td key={c} className="mono" style={{fontSize:11}}>{row[c] ?? '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{display:'flex', gap:8}}>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={status === 'loading' || preview.errors.length > 0}
            >
              {status === 'loading' ? <><span className="spinner" /> Aktarılıyor…</> : `Firebase'e Aktar (${preview.allRows.length} parça)`}
            </button>
            <button className="btn" onClick={() => setPreview(null)}>İptal</button>
          </div>
        </>
      )}

      <div style={{marginTop:32}}>
        <h3 style={{fontSize:14, fontWeight:500, marginBottom:12}}>Örnek CSV formatı</h3>
        <div className="table-card">
          <pre className="mono" style={{padding:'16px', fontSize:11, color:'var(--text-2)', overflowX:'auto', whiteSpace:'pre'}}>
{`part,ved_class,abc_class,dist_type,dist_params,lead_time_mean_weeks,lead_time_std_weeks,unit_price,min_stock
Kompresör Valfi,V,A,Poisson,lambda = 3.2,3.0,0.8,850,5
Pompa Contası,E,B,Poisson,lambda = 8.5,2.0,0.5,120,10
Redüktör Dişlisi,V,A,NegBinom,r = 1.2, p = 0.45,4.5,1.2,2400,2`}
          </pre>
        </div>
      </div>
    </div>
  );
}
