import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import Modal from '../components/Modal';
import type { NewsAlert, NewsContentType } from '../types';

const MAX_MB = 100;

export default function News() {
  const [items, setItems] = useState<NewsAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.listNews());
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

  const rows = items.filter((n) => Boolean(n.isDeleted) === showDeleted);

  return (
    <>
      <header className="page-head">
        <div className="titles">
          <span className="eyebrow">03 · NEWS ALERTS</span>
          <h1>News &amp; <em>analysis</em></h1>
        </div>
        <button className="btn primary" onClick={() => setUploading(true)}>Upload news</button>
      </header>

      <div className="alert info">
        Uploading needs real AWS S3 keys on the server (Railway variables <code>AWS_*</code>). With placeholder keys the
        upload will fail. The server also caches this list, so changes can take a while to appear here.
      </div>
      {error && <div className="alert error">{error}</div>}
      {notice && (
        <div className="alert ok row between">
          <span>{notice}</span>
          <button className="btn ghost small" onClick={() => setNotice('')}>✕</button>
        </div>
      )}

      <div className="tabs">
        <button className={!showDeleted ? 'active' : ''} onClick={() => setShowDeleted(false)}>
          Active <span className="count">{items.filter((n) => !n.isDeleted).length}</span>
        </button>
        <button className={showDeleted ? 'active' : ''} onClick={() => setShowDeleted(true)}>
          Deleted <span className="count">{items.filter((n) => n.isDeleted).length}</span>
        </button>
        <button className="btn ghost small push" onClick={load} disabled={loading}>Refresh</button>
      </div>

      <div className="card table-wrap">
        {loading && items.length === 0 ? (
          <p className="muted pad">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="muted pad">No news alerts here.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Media</th>
                <th>Processing</th>
                <th>Created</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n._id} className={busyId === n._id ? 'busy' : ''}>
                  <td>
                    <strong>{n.title}</strong>
                    <div className="muted small clamp">{n.description}</div>
                  </td>
                  <td className="cap">{n.contentType}</td>
                  <td>{n.type === 'video' ? 'Video' : `${n.rawAwsLinkImages?.length ?? 0} image(s)`}</td>
                  <td className="small">{n.processingStatus ?? '—'}</td>
                  <td className="small">{new Date(n.createdAt).toLocaleDateString()}</td>
                  <td>
                    {n.isDeleted ? <span className="badge bad">Deleted</span> : n.isLive ? <span className="badge ok">Live</span> : <span className="badge">Not live</span>}
                  </td>
                  <td className="actions">
                    {n.isDeleted ? (
                      <>
                        <button className="btn ghost small" onClick={() => act(n._id, () => api.restoreNews(n._id), 'News restored (not live).')}>Restore</button>
                        <button
                          className="btn danger small"
                          onClick={() =>
                            confirm('Delete this news alert forever?') &&
                            act(n._id, () => api.deleteNewsForever(n._id), 'News deleted forever.')
                          }
                        >
                          Delete forever
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn ghost small" onClick={() => act(n._id, () => api.toggleNewsLive(n._id), n.isLive ? 'News taken offline.' : 'News is now live.')}>
                          {n.isLive ? 'Take offline' : 'Go live'}
                        </button>
                        <button className="btn danger small" onClick={() => act(n._id, () => api.deleteNews(n._id), 'News moved to Deleted.')}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {uploading && (
        <Modal title="Upload news alert" onClose={() => setUploading(false)}>
          <UploadForm
            onDone={async () => {
              setUploading(false);
              setNotice('News uploaded. It starts as not live: click "Go live" to show it in the app.');
              await load();
            }}
            onCancel={() => setUploading(false)}
          />
        </Modal>
      )}
    </>
  );
}

function UploadForm({ onDone, onCancel }: { onDone: () => Promise<void>; onCancel: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState<NewsContentType>('crypto');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const videos = files.filter((f) => f.type.startsWith('video/'));
    if (files.length === 0) return setError('Choose at least one image, or one video.');
    if (videos.length > 0 && files.length > 1) return setError('Upload either one video, or up to 7 images, not both.');
    if (videos.length === 1 && !videos[0].name.toLowerCase().endsWith('.mp4')) return setError('Videos must be .mp4 files.');
    if (files.length > 7) return setError('Maximum 7 images.');
    const big = files.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (big) return setError(`${big.name} is larger than ${MAX_MB} MB.`);

    const form = new FormData();
    form.append('title', title.trim());
    form.append('description', description.trim());
    form.append('contentType', contentType);
    form.append('createdBy', user?.email ?? 'admin');
    files.forEach((f) => form.append('files', f));

    setBusy(true);
    try {
      await api.uploadNews(form);
      await onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="span-2">
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="span-2">
        Description
        <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required />
      </label>
      <label>
        Category
        <select value={contentType} onChange={(e) => setContentType(e.target.value as NewsContentType)}>
          <option value="crypto">Crypto</option>
          <option value="stocks">Stocks</option>
          <option value="gold">Gold</option>
        </select>
      </label>
      <label>
        Images (up to 7) or one .mp4 video
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp,video/mp4"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </label>
      {files.length > 0 && (
        <p className="muted small span-2">
          {files.length} file(s), {(files.reduce((n, f) => n + f.size, 0) / 1024 / 1024).toFixed(1)} MB
        </p>
      )}
      {error && <div className="alert error span-2">{error}</div>}
      <div className="row span-2 end">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn primary" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>
      </div>
    </form>
  );
}
