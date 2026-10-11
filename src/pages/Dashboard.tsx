import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, pingServer } from '../api';
import { API_URL } from '../config';
import type { NewsAlert, Signal } from '../types';

export default function Dashboard() {
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [news, setNews] = useState<NewsAlert[] | null>(null);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof pingServer>> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    pingServer().then(setHealth);
    api.listSignals().then(setSignals).catch((e: Error) => setError(e.message));
    api.listNews().then(setNews).catch((e: Error) => setError(e.message));
  }, []);

  const now = Date.now();
  const visible = signals?.filter(
    (s) => s.isLive && !s.isDeleted && !s.expired && new Date(s.expireAt).getTime() > now,
  ).length;

  return (
    <>
      <header className="page-head">
        <h1>Dashboard</h1>
      </header>
      {error && <div className="alert error">{error}</div>}

      <section className="stats">
        <Stat label="Signals shown in app" value={visible} hint="Live, not deleted, not expired" />
        <Stat label="All signals" value={signals?.length} />
        <Stat label="Not live (drafts)" value={signals?.filter((s) => !s.isLive && !s.isDeleted).length} />
        <Stat label="News alerts" value={news?.filter((n) => !n.isDeleted).length} />
      </section>

      <section className="card">
        <h2>Server</h2>
        <p className="mono small">{API_URL}</p>
        {health === null ? (
          <p className="muted">Checking…</p>
        ) : health.ok ? (
          <p>
            <span className="badge ok">Online</span> responded in {health.ms} ms · BTC/USDT{' '}
            {Number(health.btc).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        ) : (
          <p>
            <span className="badge bad">Offline</span> the server did not respond. Check Railway.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Quick start</h2>
        <ol className="steps">
          <li>
            Go to <Link to="/signals">Signals</Link> and click <strong>Add sample signals</strong> to fill the app
            with test data, or <strong>New signal</strong> to create one.
          </li>
          <li>Only signals that are <strong>live</strong> and on the <strong>Spot · Free</strong> plan show for free users.</li>
          <li>The app caches the signal list for up to 5 minutes, so pull to refresh after a short wait.</li>
        </ol>
      </section>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | undefined; hint?: string }) {
  return (
    <div className="card stat" title={hint}>
      <span className="muted small">{label}</span>
      <strong>{value ?? '–'}</strong>
    </div>
  );
}
