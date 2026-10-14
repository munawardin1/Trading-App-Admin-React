import { API_URL } from './config';
import { auth } from './firebase';
import type { NewsAlert, Signal, SignalInput, SignalType } from './types';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Calls the backend with the signed-in admin's Firebase ID token. */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new ApiError('You are signed out. Please sign in again.', 401);
  const token = await user.getIdToken();

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body; // browser sets the multipart boundary itself
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/${path.replace(/^\//, '')}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(`Cannot reach the server at ${API_URL}. Is it online?`, 0);
  }

  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* plain-text response, e.g. "News alert deleted successfully" */
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && 'message' in data
        ? Array.isArray((data as { message: unknown }).message)
          ? ((data as { message: string[] }).message).join(', ')
          : String((data as { message: unknown }).message)
        : typeof data === 'string' && data
          ? data
          : res.statusText) || 'Request failed';
    throw new ApiError(`${msg} (HTTP ${res.status})`, res.status);
  }
  return data as T;
}

/** Some list endpoints return a JSON string when served from the server's Redis cache. */
function asArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export const api = {
  // Signals
  listSignals: async () => asArray<Signal>(await request('GET', 'signals/admin/all')),
  createSignal: (input: SignalInput) => request<Signal>('POST', 'signals/admin/create', input),
  updateSignal: (id: string, input: Partial<SignalInput>) => request<Signal>('PUT', `signals/admin/update/${id}`, input),
  toggleSignalLive: (id: string) => request<Signal>('GET', `signals/admin/${id}/toggle-live`),
  deleteSignal: (id: string) => request<Signal>('DELETE', `signals/admin/${id}`),
  restoreSignal: (id: string) => request<Signal>('GET', `signals/admin/undelete/${id}`),
  deleteSignalForever: (id: string) => request<Signal>('DELETE', `signals/admin/delete/hard/${id}`),

  // News alerts
  listNews: async () => asArray<NewsAlert>(await request('GET', 'news-alerts/admin/all/list')),
  uploadNews: (form: FormData) => request<NewsAlert>('POST', 'news-alerts/admin/upload', form),
  toggleNewsLive: (id: string) => request<NewsAlert>('GET', `news-alerts/admin/toggle-isLive/${id}`),
  deleteNews: (id: string) => request<string>('DELETE', `news-alerts/admin/delete-partially/${id}`),
  restoreNews: (id: string) => request<NewsAlert>('GET', `news-alerts/admin/recover-partially-deleted-news-alerts/${id}`),
  deleteNewsForever: (id: string) => request<string>('DELETE', `news-alerts/admin/permanently-delete/${id}`),
};

/** Latest spot price from the server's public Binance proxy, or null if unavailable. */
export async function getSpotPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`${API_URL}/market/ticker?market=spot&symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;
    const price = Number(((await res.json()) as { lastPrice?: string }).lastPrice);
    return price > 0 ? price : null;
  } catch {
    return null;
  }
}

/** Public endpoint used as a health check (no login needed). */
export async function pingServer(): Promise<{ ok: boolean; ms: number; btc?: string }> {
  const start = performance.now();
  try {
    const res = await fetch(`${API_URL}/market/ticker?market=spot&symbol=BTCUSDT`);
    const ms = Math.round(performance.now() - start);
    if (!res.ok) return { ok: false, ms };
    const data = (await res.json()) as { lastPrice?: string };
    return { ok: true, ms, btc: data.lastPrice };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - start) };
  }
}

/**
 * Current price for a signal symbol, or null if unavailable:
 * crypto from Binance spot, gold (XAUUSD) from the Binance XAUUSDT contract,
 * forex (EURUSD) from the server's forex quotes.
 */
export async function getLivePrice(type: SignalType, symbol: string): Promise<number | null> {
  const s = symbol.trim().toUpperCase();
  if (!s) return null;
  try {
    if (type === 'FOREX') {
      const res = await fetch(`${API_URL}/market/fx/quotes`);
      if (!res.ok) return null;
      const quotes = (await res.json()) as { symbol: string; lastPrice: number }[];
      const price = Number(quotes.find((q) => q.symbol === s)?.lastPrice);
      return price > 0 ? price : null;
    }
    if (type === 'GOLD') {
      const contract = s.replace(/USDT?$/, '') + 'USDT';
      const res = await fetch(`${API_URL}/market/ticker?market=usdt_perp&symbol=${encodeURIComponent(contract)}`);
      if (!res.ok) return null;
      const price = Number(((await res.json()) as { lastPrice?: string }).lastPrice);
      return price > 0 ? price : null;
    }
    return await getSpotPrice(s);
  } catch {
    return null;
  }
}

/**
 * Uploads news media (one video or up to 7 images) and reports progress
 * from 0 to 1, so large videos don't look stuck.
 */
export async function uploadNewsWithProgress(form: FormData, onProgress: (fraction: number) => void): Promise<NewsAlert> {
  const user = auth.currentUser;
  if (!user) throw new ApiError('You are signed out. Please sign in again.', 401);
  const token = await user.getIdToken();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/news-alerts/admin/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new ApiError(`Cannot reach the server at ${API_URL}. Is it online?`, 0));
    xhr.onload = () => {
      let data: unknown = xhr.responseText;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        /* plain text */
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data as NewsAlert);
      const msg =
        data && typeof data === 'object' && 'message' in data
          ? String((data as { message: unknown }).message)
          : xhr.statusText || 'Upload failed';
      reject(new ApiError(`${msg} (HTTP ${xhr.status})`, xhr.status));
    };
    xhr.send(form);
  });
}
