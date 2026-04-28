// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuth } from './services/firebase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import './App.css';

export default function App() {
  const [user, setUser]       = useState(undefined); // undefined = yükleniyor
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuth(u => { setUser(u); setLoading(false); });
    return unsub;
  }, []);

  if (loading) return (
    <div className="splash">
      <div className="splash-logo">DYO</div>
      <p>Yükleniyor…</p>
    </div>
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/*"    element={user  ? <Dashboard user={user} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
