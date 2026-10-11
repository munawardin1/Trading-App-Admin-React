import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Login from './pages/Login';
import NotAdmin from './pages/NotAdmin';
import Dashboard from './pages/Dashboard';
import Signals from './pages/Signals';
import News from './pages/News';

export default function App() {
  const { user, isAdmin, loading, logout } = useAuth();

  if (loading) return <div className="center muted">Loading…</div>;
  if (!user) return <Login />;
  if (!isAdmin) return <NotAdmin />;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="" />
          <div>
            <strong>Cron Trading</strong>
            <span>Admin</span>
          </div>
        </div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/signals">Signals</NavLink>
          <NavLink to="/news">News alerts</NavLink>
        </nav>
        <div className="sidebar-foot">
          <span className="muted small" title={user.email ?? ''}>{user.email}</span>
          <button className="btn ghost small" onClick={logout}>Sign out</button>
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
