// src/pages/Login.js
import React, { useState } from 'react';
import { login } from '../services/firebase';

export default function Login() {
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError('E-posta veya şifre hatalı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">DYO</div>
        <h1>Envanter DSS</h1>
        <p>DYO Boya Yedek Parça Karar Destek Sistemi</p>

        <form onSubmit={handleLogin}>
          <div className="field">
            <label>E-posta</label>
            <input
              type="email"
              placeholder="isim@dyo.com.tr"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Şifre</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}
