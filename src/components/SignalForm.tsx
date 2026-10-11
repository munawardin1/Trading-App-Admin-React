import { useState, type FormEvent } from 'react';
import type { Direction, Signal, SignalInput, SignalType, SubscriptionValue } from '../types';
import { SUBSCRIPTION_LABELS } from '../types';

interface Props {
  initial?: Signal;
  adminEmail: string;
  onSubmit: (input: SignalInput) => Promise<void>;
  onCancel: () => void;
}

/** Percentage move from entry to exit, positive when the trade wins. */
export function calcGainLoss(direction: Direction, entry: number, exit: number): number {
  if (!entry) return 0;
  const pct = direction === 'LONG' ? ((exit - entry) / entry) * 100 : ((entry - exit) / entry) * 100;
  return Math.round(pct * 100) / 100;
}

/** <input type="datetime-local"> wants local time without seconds or zone. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inAWeek = () => new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

export default function SignalForm({ initial, adminEmail, onSubmit, onCancel }: Props) {
  const [type, setType] = useState<SignalType>(initial?.type ?? 'CRYPTO');
  const [coin, setCoin] = useState(initial?.coin ?? '');
  const [direction, setDirection] = useState<Direction>(initial?.direction ?? 'LONG');
  const [entry, setEntry] = useState(initial ? String(initial.entryPrice) : '');
  const [exit, setExit] = useState(initial ? String(initial.exitPrice) : '');
  const [gain, setGain] = useState(initial ? String(initial.gainLossPercentage) : '');
  const [gainEdited, setGainEdited] = useState(Boolean(initial));
  const [portfolio, setPortfolio] = useState(initial ? String(initial.portfolioPercentage) : '5');
  const [expireAt, setExpireAt] = useState(toLocalInput(initial?.expireAt ?? inAWeek()));
  const [plan, setPlan] = useState<SubscriptionValue>(initial?.subscriptionValue ?? 'spot-free');
  const [isLive, setIsLive] = useState(initial?.isLive ?? true);
  const [analysis, setAnalysis] = useState(typeof initial?.tradingAnalysis === 'string' ? initial.tradingAnalysis : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const autoGain = calcGainLoss(direction, Number(entry), Number(exit));
  const shownGain = gainEdited ? gain : entry && exit ? String(autoGain) : '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const entryN = Number(entry);
    const exitN = Number(exit);
    if (type !== 'GOLD' && !coin.trim()) return setError('Enter the coin or stock symbol, e.g. BTCUSDT or AAPL.');
    if (!(entryN > 0) || !(exitN > 0)) return setError('Entry and exit prices must be greater than 0.');
    if (new Date(expireAt).getTime() <= Date.now()) return setError('Expiry must be in the future, or the app will hide the signal.');

    setBusy(true);
    try {
      await onSubmit({
        type,
        // The server rejects a coin on GOLD signals.
        coin: type === 'GOLD' ? undefined : coin.trim().toUpperCase(),
        direction,
        entryPrice: entryN,
        exitPrice: exitN,
        gainLossPercentage: Number(shownGain) || 0,
        portfolioPercentage: Number(portfolio) || 0,
        expireAt: new Date(expireAt).toISOString(),
        subscriptionValue: plan,
        isLive,
        hasTradingAnalysis: Boolean(analysis.trim()),
        tradingAnalysis: analysis.trim() || undefined,
        createdBy: initial?.createdBy ?? adminEmail,
      });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label>
        Market
        <select value={type} onChange={(e) => setType(e.target.value as SignalType)}>
          <option value="CRYPTO">Crypto</option>
          <option value="GOLD">Gold</option>
          <option value="STOCKS">Stocks</option>
        </select>
      </label>
      <label>
        Symbol
        <input
          value={type === 'GOLD' ? '' : coin}
          onChange={(e) => setCoin(e.target.value)}
          placeholder={type === 'GOLD' ? 'Not used for gold' : type === 'CRYPTO' ? 'BTCUSDT' : 'AAPL'}
          disabled={type === 'GOLD'}
        />
      </label>
      <label>
        Direction
        <select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
          <option value="LONG">Long (buy)</option>
          <option value="SHORT">Short (sell)</option>
        </select>
      </label>
      <label>
        Plan
        <select value={plan} onChange={(e) => setPlan(e.target.value as SubscriptionValue)}>
          {Object.entries(SUBSCRIPTION_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>
      <label>
        Entry price
        <input type="number" step="any" min="0" value={entry} onChange={(e) => setEntry(e.target.value)} required />
      </label>
      <label>
        Target (exit) price
        <input type="number" step="any" min="0" value={exit} onChange={(e) => setExit(e.target.value)} required />
      </label>
      <label>
        Gain / loss %
        <input
          type="number"
          step="any"
          value={shownGain}
          onChange={(e) => {
            setGainEdited(true);
            setGain(e.target.value);
          }}
          placeholder="Auto"
        />
        {!gainEdited && <small className="muted">Calculated from entry and target</small>}
      </label>
      <label>
        Portfolio %
        <input type="number" step="any" min="0" max="100" value={portfolio} onChange={(e) => setPortfolio(e.target.value)} required />
      </label>
      <label>
        Expires at
        <input type="datetime-local" value={expireAt} onChange={(e) => setExpireAt(e.target.value)} required />
      </label>
      <label className="check">
        <input type="checkbox" checked={isLive} onChange={(e) => setIsLive(e.target.checked)} />
        Live (visible in the app)
      </label>
      <label className="span-2">
        Trading analysis (optional)
        <textarea rows={3} value={analysis} onChange={(e) => setAnalysis(e.target.value)} placeholder="Why this trade?" />
      </label>
      {error && <div className="alert error span-2">{error}</div>}
      <div className="row span-2 end">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Create signal'}</button>
      </div>
    </form>
  );
}
