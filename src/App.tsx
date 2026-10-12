import { useState } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Login from './pages/Login';
import NotAdmin from './pages/NotAdmin';
import Dashboard from './pages/Dashboard';
import Signals from './pages/Signals';
import News from './pages/News';

type Theme = 'light' | 'dark';

/** Light (Cream) by default; dark is remembered in this browser (applied before paint in index.html). */
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    if (next === 'dark') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem('cron-theme', next);
    } catch {
      /* private mode: the choice just isn't remembered */
    }
    setTheme(next);
  };
  return [theme, toggle];
}

export default function App() {
  const { user, isAdmin, loading, logout } = useAuth();
  const [theme, toggleTheme] = useTheme();

  if (loading) return <div className="center muted">Loading…</div>;
  if (!user) return <Login />;
  if (!isAdmin) return <NotAdmin />;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="avatar">
            <img src="/cron-mark.png" alt="" />
          </div>
          <div>
            <strong>Cron Trading</strong>
            <span>TECHNOLOGIES · ADMIN</span>
          </div>
        </div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/signals">Signals</NavLink>
          <NavLink to="/news">News alerts</NavLink>
        </nav>
        <div className="sidebar-foot">
          <span className="muted small email" title={user.email ?? ''}>{user.email}</span>
          <button className="btn ghost small" onClick={toggleTheme}>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button className="btn ghost small" onClick={logout}>Sign out</button>
          <span className="label company">A Cron company</span>
        </div>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/signals" element={<Signals />} />
          <Route path="/news" element={<News />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
