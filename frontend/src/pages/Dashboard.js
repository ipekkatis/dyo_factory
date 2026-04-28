// src/pages/Dashboard.js
import React from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { logout } from '../services/firebase';
import PartsPage   from './PartsPage';
import ImportPage  from './ImportPage';
import ResultsPage from './ResultsPage';

const NAV = [
  { to: '/',        label: 'Parçalar',     icon: '⊞' },
  { to: '/import',  label: 'CSV / Excel',  icon: '↑' },
  { to: '/results', label: 'Simülasyon',   icon: '◈' },
];

export default function Dashboard({ user }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="mark">DYO</div>
          <div className="brand">
            Envanter DSS
            <span>Karar Destek Sistemi</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span style={{ fontSize: 15 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          <span className="email">{user.email}</span>
          <button className="logout-btn" onClick={handleLogout}>Çıkış</button>
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/"        element={<PartsPage />} />
          <Route path="/import"  element={<ImportPage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </main>
    </div>
  );
}
