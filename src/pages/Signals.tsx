import { useCallback, useEffect, useState } from 'react';
import { api, getLivePrice } from '../api';
import { useAuth } from '../auth';
import Modal from '../components/Modal';
import SignalForm, { calcGainLoss } from '../components/SignalForm';
import type { Signal, SignalInput } from '../types';
import { displaySymbol, planLabel } from '../types';

type Tab = 'live' | 'drafts' | 'expired' | 'deleted' | 'all';

const isExpired = (s: Signal) => s.expired || new Date(s.expireAt).getTime() <= Date.now();

const TABS: { id: Tab; label: string; match: (s: Signal) => boolean }[] = [
  { id: 'live', label: 'Live', match: (s) => s.isLive && !s.isDeleted && !isExpired(s) },
  { id: 'drafts', label: 'Not live', match: (s) => !s.isLive && !s.isDeleted },
  { id: 'expired', label: 'Expired', match: (s) => !s.isDeleted && isExpired(s) },
  { id: 'deleted', label: 'Deleted', match: (s) => s.isDeleted },
  { id: 'all', label: 'All', match: () => true },
];

const fmtPrice = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 8 });
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Signals() {
  const { user } = useAuth();
  const adminEmail = user?.email ?? 'admin';
  const [signals, setSignals] = useState<Signal[]>([]);
  const [tab, setTab] = useState<Tab>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Signal | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listSignals();
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSignals(list);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, fn: () => Promise<unknown>, done: string) {
    setBusyId(id);
    setError('');
    try {
      await fn();
      setNotice(done);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function save(input: SignalInput) {
    if (editing && editing !== 'new') {
      await api.updateSignal(editing._id, input);
      setNotice('Signal updated. The app may take up to 5 minutes to show the change.');
    } else {
      await api.createSignal(input);
      setNotice(input.isLive ? 'Signal created and pushed live to connected apps.' : 'Signal saved as not live.');
    }
    setEditing(null);
    await load();
  }

  async function addSamples() {
    setBusyId('samples');
    setError('');
    const [btc, eth, sol, eur, gbpjpy, xau] = await Promise.all([
      getLivePrice('CRYPTO', 'BTCUSDT'),
      getLivePrice('CRYPTO', 'ETHUSDT'),
      getLivePrice('CRYPTO', 'SOLUSDT'),
      getLivePrice('FOREX', 'EURUSD'),
      getLivePrice('FOREX', 'GBPJPY'),
      getLivePrice('GOLD', 'XAUUSD'),
    ]);
    const expireAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const make = (s: Omit<SignalInput, 'gainLossPercentage' | 'createdBy' | 'expireAt' | 'isLive' | 'hasTradingAnalysis' | 'tradingAnalysis'>): SignalInput => ({
      ...s,
      gainLossPercentage: calcGainLoss(s.direction, s.entryPrice, s.exitPrice),
      createdBy: adminEmail,
      expireAt,
      isLive: true,
      hasTradingAnalysis: true,
      tradingAnalysis: 'Sample signal created from the admin panel for testing.',
    });
    const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
    const btcP = btc ?? 80000;
    const ethP = eth ?? 3000;
    const solP = sol ?? 150;
    const eurP = eur ?? 1.08;
    const gjP = gbpjpy ?? 195;
    const xauP = xau ?? 2400;
    const samples: SignalInput[] = [
      make({ type: 'CRYPTO', coin: 'BTCUSDT', direction: 'LONG', entryPrice: round(btcP), exitPrice: round(btcP * 1.06), portfolioPercentage: 5, subscriptionValue: 'spot-free' }),
      make({ type: 'CRYPTO', coin: 'ETHUSDT', direction: 'SHORT', entryPrice: round(ethP), exitPrice: round(ethP * 0.93), portfolioPercentage: 3, subscriptionValue: 'spot-free' }),
      make({ type: 'CRYPTO', coin: 'SOLUSDT', direction: 'LONG', entryPrice: round(solP), exitPrice: round(solP * 1.12), portfolioPercentage: 4, subscriptionValue: 'future-paid' }),
      make({ type: 'FOREX', coin: 'EURUSD', direction: 'LONG', entryPrice: round(eurP, 5), exitPrice: round(eurP * 1.008, 5), portfolioPercentage: 5, subscriptionValue: 'spot-free' }),
      make({ type: 'FOREX', coin: 'GBPJPY', direction: 'SHORT', entryPrice: round(gjP, 3), exitPrice: round(gjP * 0.99, 3), portfolioPercentage: 3, subscriptionValue: 'spot-paid' }),
      make({ type: 'GOLD', coin: 'XAUUSD', direction: 'LONG', entryPrice: round(xauP), exitPrice: round(xauP * 1.03), portfolioPercentage: 10, subscriptionValue: 'spot-free' }),
    ];
    try {
      for (const s of samples) await api.createSignal(s);
      setNotice('Added 6 sample signals: crypto (BTC, ETH free; SOL futures paid), forex (EUR/USD free; GBP/JPY paid) and gold (free). Paid ones are locked for free users.');
      setTab('live');
      await load();
    } catch (e) {
      setError(`Could not add samples: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  }

  const current = TABS.find((t) => t.id === tab)!;
  const rows = signals.filter(current.match);

  return (
    <>
      <header className="page-head">
        <div className="titles">
          <span className="eyebrow">02 · SIGNALS</span>
          <h1>Manage <em>signals</em></h1>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={addSamples} disabled={busyId === 'samples'}>
            {busyId === 'samples' ? 'Adding…' : 'Add sample signals'}
          </button>
          <button className="btn primary" onClick={() => setEditing('new')}>New signal</button>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}
      {notice && (
        <div className="alert ok row between">
          <span>{notice}</span>
          <button className="btn ghost small" onClick={() => setNotice('')}>✕</button>
        </div>
      )}

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label} <span className="count">{signals.filter(t.match).length}</span>
          </button>
        ))}
        <button className="btn ghost small push" onClick={load} disabled={loading}>Refresh</button>
      </div>

      <div className="card table-wrap">
        {loading && signals.length === 0 ? (
          <p className="muted pad">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="muted pad">No signals here.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Signal</th>
                <th>Entry → Target</th>
                <th>Gain/Loss</th>
                <th>Portfolio</th>
                <th>Plan</th>
                <th>Expires</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s._id} className={busyId === s._id ? 'busy' : ''}>
                  <td>
                    <strong>{displaySymbol(s.type, s.coin)}</strong>
                    <span className={`dir ${s.direction === 'LONG' ? 'up' : 'down'}`}>{s.direction}</span>
                    <div className="muted small">{s.type}</div>
                  </td>
                  <td className="mono">{fmtPrice(s.entryPrice)} → {fmtPrice(s.exitPrice)}</td>
                  <td className={`mono ${s.gainLossPercentage >= 0 ? 'up' : 'down'}`}>
                    {s.gainLossPercentage > 0 ? '+' : ''}{s.gainLossPercentage}%
                  </td>
                  <td className="mono">{s.portfolioPercentage}%</td>
                  <td>{planLabel(s.type, s.subscriptionValue)}</td>
                  <td className="small">{fmtDate(s.expireAt)}</td>
                  <td>
                    {s.isDeleted ? (
                      <span className="badge bad">Deleted</span>
                    ) : isExpired(s) ? (
                      <span className="badge">Expired</span>
                    ) : s.isLive ? (
                      <span className="badge ok">Live</span>
                    ) : (
                      <span className="badge">Not live</span>
                    )}
                  </td>
                  <td className="actions">
                    {s.isDeleted ? (
                      <>
                        <button className="btn ghost small" onClick={() => act(s._id, () => api.restoreSignal(s._id), 'Signal restored (not live).')}>Restore</button>
                        <button
                          className="btn danger small"
                          onClick={() =>
                            confirm('Delete this signal forever? This cannot be undone.') &&
                            act(s._id, () => api.deleteSignalForever(s._id), 'Signal deleted forever.')
                          }
                        >
                          Delete forever
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn ghost small" onClick={() => act(s._id, () => api.toggleSignalLive(s._id), s.isLive ? 'Signal taken offline.' : 'Signal is now live.')}>
                          {s.isLive ? 'Take offline' : 'Go live'}
                        </button>
                        <button className="btn ghost small" onClick={() => setEditing(s)}>Edit</button>
                        <button className="btn danger small" onClick={() => act(s._id, () => api.deleteSignal(s._id), 'Signal moved to Deleted.')}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <Modal title={editing === 'new' ? 'New signal' : 'Edit signal'} onClose={() => setEditing(null)}>
          <SignalForm
            initial={editing === 'new' ? undefined : editing}
            adminEmail={adminEmail}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </>
  );
}
