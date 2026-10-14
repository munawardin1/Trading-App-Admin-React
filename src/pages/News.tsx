import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, uploadNewsWithProgress } from '../api';
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
  // Which upload form is open: a reel video, or an image post.
  const [uploading, setUploading] = useState<UploadMode | null>(null);
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
        <div className="row">
          <button className="btn ghost" onClick={() => setUploading('images')}>Upload images</button>
          <button className="btn primary" onClick={() => setUploading('video')}>▶ Upload video (Reel)</button>
        </div>
      </header>

      <div className="alert info">
        <strong>Videos</strong> show in the app under <strong>Analysis → Reels</strong>, <strong>images</strong> under
        Analysis → News, as soon as they are <strong>Live</strong>. Files are stored in AWS S3 (Railway variables{' '}
        <code>AWS_*</code> on the server).
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
                  <td>
                    {n.type === 'video' ? (
                      n.rawAwsLinkVideo ? (
                        <a href={n.rawAwsLinkVideo} target="_blank" rel="noreferrer">▶ Watch video</a>
                      ) : (
                        'Video'
                      )
                    ) : (
                      `${n.rawAwsLinkImages?.length ?? 0} image(s)`
                    )}
                  </td>
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
        <Modal title={uploading === 'video' ? 'Upload video (Reel)' : 'Upload images'} onClose={() => setUploading(null)}>
          <UploadForm
            mode={uploading}
            onDone={async (live) => {
              const what = uploading === 'video' ? 'Video' : 'Images';
              setUploading(null);
              setNotice(
                live
                  ? `${what} uploaded and live. Open the app: Analysis → ${uploading === 'video' ? 'Reels' : 'News'} (pull down to refresh).`
                  : `${what} uploaded as not live. Click "Go live" to show it in the app.`,
              );
              await load();
            }}
            onCancel={() => setUploading(null)}
          />
        </Modal>
      )}
    </>
  );
}

type UploadMode = 'video' | 'images';

function UploadForm({ mode, onDone, onCancel }: { mode: UploadMode; onDone: (live: boolean) => Promise<void>; onCancel: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState<NewsContentType>('crypto');
  const [files, setFiles] = useState<File[]>([]);
  const [live, setLive] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const isVideo = mode === 'video';
  const busy = progress !== null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (files.length === 0) return setError(isVideo ? 'Choose an .mp4 video.' : 'Choose at least one image.');
    if (isVideo && !files[0].name.toLowerCase().endsWith('.mp4')) return setError('Videos must be .mp4 files (H.264).');
    if (!isVideo && files.length > 7) return setError('Maximum 7 images.');
    const big = files.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (big) return setError(`${big.name} is larger than ${MAX_MB} MB.`);

    const form = new FormData();
    form.append('title', title.trim());
    form.append('description', description.trim());
    form.append('contentType', contentType);
    form.append('createdBy', user?.email ?? 'admin');
    form.append('isLive', String(live));
    files.forEach((f) => form.append('files', f));

    setProgress(0);
    try {
      await uploadNewsWithProgress(form, setProgress);
      await onDone(live);
    } catch (err) {
      setError((err as Error).message);
      setProgress(null);
    }
  }

  const sizeMb = files.reduce((n, f) => n + f.size, 0) / 1024 / 1024;
  const preview = isVideo && files[0] ? URL.createObjectURL(files[0]) : null;

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="span-2">
        {isVideo ? 'Video (.mp4, up to 100 MB)' : 'Images (JPG, PNG, WebP, up to 7)'}
        <input
          type="file"
          multiple={!isVideo}
          accept={isVideo ? 'video/mp4' : 'image/jpeg,image/png,image/gif,image/webp'}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          disabled={busy}
        />
        {files.length > 0 && (
          <small className="muted">
            {isVideo ? files[0].name : `${files.length} image(s)`} · {sizeMb.toFixed(1)} MB
          </small>
        )}
      </label>
      {preview && <video className="span-2 upload-preview" src={preview} controls muted playsInline />}
      <label className="span-2">
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required disabled={busy} />
      </label>
      <label className="span-2">
        {isVideo ? 'Caption' : 'Description'}
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required disabled={busy} />
      </label>
      <label>
        Category
        <select value={contentType} onChange={(e) => setContentType(e.target.value as NewsContentType)} disabled={busy}>
          <option value="crypto">Crypto</option>
          <option value="gold">Gold</option>
          <option value="stocks">Stocks</option>
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} disabled={busy} />
        Publish now (show in the app)
      </label>
      {busy && (
        <div className="span-2">
          <div className="progress"><span style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} /></div>
          <small className="muted">
            {(progress ?? 0) < 1 ? `Uploading… ${Math.round((progress ?? 0) * 100)}%` : 'Saving to S3… almost done'}
          </small>
        </div>
      )}
      {error && <div className="alert error span-2">{error}</div>}
      <div className="row span-2 end">
        <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn primary" disabled={busy}>{busy ? 'Uploading…' : isVideo ? 'Upload video' : 'Upload images'}</button>
      </div>
    </form>
  );
}
